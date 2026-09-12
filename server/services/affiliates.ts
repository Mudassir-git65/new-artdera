import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { ClientSession } from "mongoose";
import {
  AffiliateActivityModel,
  AffiliateCommissionModel,
  AffiliateModel,
  AffiliateReferralModel,
  OrderModel,
  SystemSettingModel,
  UserModel,
} from "../models";
import { getEnv } from "../config/env";
import { ApiError } from "../lib/http";
import { hashToken } from "../lib/security";
import { notify } from "./notifications";

export const AFFILIATE_COOKIE = "artdera_affiliate_ref";
export const AFFILIATE_SETTINGS_KEY = "affiliate_program";

export type AffiliateSettings = {
  enabled: boolean;
  defaultCommissionRate: number;
  defaultBuyerDiscountRate: number;
  attributionDays: number;
  minimumPayoutUsd: number;
  usdToPkrRate: number;
  autoApproveApplications: boolean;
  allowDiscountStacking: boolean;
};

export const DEFAULT_AFFILIATE_SETTINGS: AffiliateSettings = {
  enabled: true,
  defaultCommissionRate: 5,
  defaultBuyerDiscountRate: 10,
  attributionDays: 30,
  minimumPayoutUsd: 25,
  // A deliberately configurable administrative conversion rate. No checkout
  // or payout decision depends on an unverified client-side FX quote.
  usdToPkrRate: 280,
  autoApproveApplications: true,
  allowDiscountStacking: false,
};

export function normalizeAffiliateCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export async function getAffiliateSettings(): Promise<AffiliateSettings> {
  const stored = await SystemSettingModel.findOne({ key: AFFILIATE_SETTINGS_KEY }).lean();
  const value = stored?.value && typeof stored.value === "object" ? stored.value : {};
  return { ...DEFAULT_AFFILIATE_SETTINGS, ...(value as Partial<AffiliateSettings>) };
}

export function minimumPayoutPkr(settings: AffiliateSettings) {
  return Math.ceil(settings.minimumPayoutUsd * settings.usdToPkrRate);
}

export async function uniqueAffiliateCode(fullName: string, requested?: string) {
  const requestedCode = requested ? normalizeAffiliateCode(requested) : "";
  if (requestedCode) {
    if (!/^[A-Z0-9]{5,20}$/.test(requestedCode))
      throw new ApiError(
        422,
        "INVALID_AFFILIATE_CODE",
        "Use 5–20 letters and numbers without spaces or symbols",
      );
    if (await AffiliateModel.exists({ codeNormalized: requestedCode }))
      throw new ApiError(409, "AFFILIATE_CODE_TAKEN", "That ambassador code is already in use");
    return requestedCode;
  }

  const readableBase =
    normalizeAffiliateCode(fullName)
      .replace(/[AEIOU]/g, "")
      .slice(0, 12) || "ARTDERA";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = String(Math.floor(2 + Math.random() * 98));
    const candidate = `${readableBase.slice(0, 20 - suffix.length)}${suffix}`;
    if (!(await AffiliateModel.exists({ codeNormalized: candidate }))) return candidate;
  }
  return `ART${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function safeLandingPage(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 500);
}

function requestFingerprint(req: Request) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";
  return { ipHash: hashToken(ip), userAgentHash: hashToken(userAgent) };
}

async function recordActivity(
  affiliateId: unknown,
  type:
    | "self_referral"
    | "referral_override_attempt"
    | "repeated_clicks"
    | "duplicate_commission_attempt",
  req?: Request,
  severity: "low" | "medium" | "high" = "low",
  metadata: Record<string, unknown> = {},
) {
  const fingerprint = req ? requestFingerprint(req) : undefined;
  await Promise.all([
    AffiliateActivityModel.create({
      affiliateId,
      userId: req?.auth?.user._id,
      type,
      severity,
      ipHash: fingerprint?.ipHash,
      metadata,
    }),
    AffiliateModel.updateOne({ _id: affiliateId }, { $inc: { suspiciousActivityCount: 1 } }),
  ]);
}

async function findActiveAffiliate(
  lookup: { codeNormalized: string } | { _id: unknown },
  settings: AffiliateSettings,
) {
  const affiliate = await AffiliateModel.findOne(lookup);
  if (!affiliate) return null;

  // Applications created before automatic approval was enabled are upgraded
  // on their first use. This makes already-issued codes usable immediately
  // after deployment while still respecting an administrator who explicitly
  // disables automatic approval in the program settings.
  if (affiliate.status === "pending" && settings.autoApproveApplications) {
    affiliate.status = "approved";
    affiliate.approvedAt = new Date();
    affiliate.buyerDiscountRate = settings.defaultBuyerDiscountRate;
    await affiliate.save();
  }

  return affiliate.status === "approved" ? affiliate : null;
}

export async function captureAffiliateReferral(
  req: Request,
  res: Response,
  rawCode: string,
  landingPage: string,
  source: "url" | "code",
) {
  const settings = await getAffiliateSettings();
  if (!settings.enabled) return { captured: false, reason: "program_disabled" } as const;
  const code = normalizeAffiliateCode(rawCode);
  if (!/^[A-Z0-9]{5,20}$/.test(code))
    throw new ApiError(422, "INVALID_AFFILIATE_CODE", "This ambassador code is not valid");
  const requestedAffiliate = await findActiveAffiliate({ codeNormalized: code }, settings);
  if (!requestedAffiliate)
    throw new ApiError(404, "AFFILIATE_CODE_NOT_FOUND", "This ambassador code is not active");
  if (String(requestedAffiliate.userId) === String(req.auth?.user._id)) {
    await recordActivity(requestedAffiliate._id, "self_referral", req, "high");
    throw new ApiError(422, "SELF_REFERRAL_NOT_ALLOWED", "You cannot use your own ambassador code");
  }

  let visitorToken = req.cookies?.[AFFILIATE_COOKIE] as string | undefined;
  if (!visitorToken) visitorToken = randomUUID() + randomUUID();
  const visitorHash = hashToken(visitorToken);
  const now = new Date();
  const existing = await AffiliateReferralModel.findOne({
    visitorHash,
    expiresAt: { $gt: now },
  }).sort({ referredAt: -1 });
  if (existing) {
    existing.lastSeenAt = now;
    if (req.auth && !existing.userId) existing.userId = req.auth.user._id;
    await existing.save();
    if (String(existing.affiliateId) !== String(requestedAffiliate._id))
      await recordActivity(requestedAffiliate._id, "referral_override_attempt", req, "medium", {
        preservedAffiliateId: String(existing.affiliateId),
      });
    return {
      captured: true,
      preserved: true,
      code:
        String(existing.affiliateId) === String(requestedAffiliate._id)
          ? requestedAffiliate.code
          : undefined,
    } as const;
  }

  const fingerprint = requestFingerprint(req);
  const prior = await AffiliateReferralModel.exists({
    affiliateId: requestedAffiliate._id,
    visitorHash,
  });
  const expiresAt = new Date(now.getTime() + settings.attributionDays * 24 * 60 * 60_000);
  await AffiliateReferralModel.create({
    affiliateId: requestedAffiliate._id,
    visitorHash,
    userId: req.auth?.user._id,
    landingPage: safeLandingPage(landingPage),
    source,
    ...fingerprint,
    isUnique: !prior,
    referredAt: now,
    lastSeenAt: now,
    expiresAt,
  });
  await AffiliateModel.updateOne(
    { _id: requestedAffiliate._id },
    { $inc: { totalClicks: 1, uniqueClicks: prior ? 0 : 1 } },
  );
  res.cookie(AFFILIATE_COOKIE, visitorToken, {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: settings.attributionDays * 24 * 60 * 60_000,
  });

  const recentIpClicks = await AffiliateReferralModel.countDocuments({
    affiliateId: requestedAffiliate._id,
    ipHash: fingerprint.ipHash,
    referredAt: { $gte: new Date(now.getTime() - 60 * 60_000) },
  });
  if (recentIpClicks === 20) {
    await recordActivity(requestedAffiliate._id, "repeated_clicks", req, "high", {
      windowMinutes: 60,
      clickCount: recentIpClicks,
    });
    const admins = await UserModel.find({ role: "admin", status: "active" }).select("_id").lean();
    await Promise.all(
      admins.map((admin) =>
        notify(
          admin._id,
          "affiliate_suspicious_activity",
          "Suspicious affiliate activity",
          `Repeated referral clicks were detected for code ${requestedAffiliate.code}.`,
          "/admin/affiliates",
        ),
      ),
    );
  }
  return { captured: true, preserved: false, code: requestedAffiliate.code } as const;
}

export async function resolveAffiliateAttribution(req: Request, rawCode?: string) {
  const settings = await getAffiliateSettings();
  if (!settings.enabled) return undefined;
  const now = new Date();
  const visitorToken = req.cookies?.[AFFILIATE_COOKIE] as string | undefined;
  const referral = visitorToken
    ? await AffiliateReferralModel.findOne({
        visitorHash: hashToken(visitorToken),
        expiresAt: { $gt: now },
      }).sort({ referredAt: -1 })
    : null;
  const code = rawCode ? normalizeAffiliateCode(rawCode) : "";
  const affiliate = referral
    ? await findActiveAffiliate({ _id: referral.affiliateId }, settings)
    : code
      ? await findActiveAffiliate({ codeNormalized: code }, settings)
      : null;
  if (code && !affiliate)
    throw new ApiError(404, "AFFILIATE_CODE_NOT_FOUND", "This ambassador code is not active");
  if (!affiliate) return undefined;
  if (String(affiliate.userId) === String(req.auth?.user._id)) {
    await recordActivity(affiliate._id, "self_referral", req, "high");
    if (rawCode)
      throw new ApiError(
        422,
        "SELF_REFERRAL_NOT_ALLOWED",
        "You cannot use your own ambassador code",
      );
    return undefined;
  }
  if (referral && req.auth && !referral.userId) {
    referral.userId = req.auth.user._id;
    await referral.save();
  }
  return { affiliate, referral, settings };
}

export function affiliatePricing(
  artworkSubtotal: number,
  platformCommissionRate: number,
  affiliate?: { commissionRate: number; buyerDiscountRate: number },
) {
  if (!affiliate || affiliate.commissionRate + affiliate.buyerDiscountRate > platformCommissionRate)
    return {
      discount: 0,
      eligibleArtworkAmount: artworkSubtotal,
      commissionAmount: 0,
      applied: false,
    };
  const discount = Math.round(artworkSubtotal * (affiliate.buyerDiscountRate / 100));
  const eligibleArtworkAmount = Math.max(0, artworkSubtotal - discount);
  return {
    discount,
    eligibleArtworkAmount,
    commissionAmount: Math.round(eligibleArtworkAmount * (affiliate.commissionRate / 100)),
    applied: true,
  };
}

export async function createCommissionForPaidOrder(
  order: Record<string, any>,
  session?: ClientSession,
) {
  if (!order.affiliateId || !order.affiliateCommissionRate) return false;
  const eligibleSaleAmount = Number(
    order.eligibleArtworkAmount ?? Number(order.artworkSubtotal ?? 0) - Number(order.discount ?? 0),
  );
  const commissionAmount = Math.round(
    eligibleSaleAmount * (Number(order.affiliateCommissionRate) / 100),
  );
  const result = await AffiliateCommissionModel.updateOne(
    { orderId: order._id },
    {
      $setOnInsert: {
        affiliateId: order.affiliateId,
        orderId: order._id,
        artworkIds: (order.items ?? []).map((item: any) => item.artworkId),
        eligibleSaleAmount,
        commissionRate: order.affiliateCommissionRate,
        commissionAmount,
        buyerDiscountAmount: order.discount ?? 0,
        currency: order.currency ?? "PKR",
        status: "pending",
      },
    },
    { upsert: true, session },
  );
  return result.upsertedCount > 0;
}

export async function rejectCommissionForOrder(
  orderId: unknown,
  reason: string,
  session?: ClientSession,
) {
  return AffiliateCommissionModel.updateOne(
    { orderId, status: { $in: ["pending", "approved"] }, payoutId: { $exists: false } },
    { $set: { status: "rejected", rejectionReason: reason, rejectedAt: new Date() } },
    { session },
  );
}

export async function approveCommissionForOrder(orderId: unknown, session?: ClientSession) {
  const order = await OrderModel.findById(orderId)
    .session(session ?? null)
    .lean();
  if (
    !order ||
    order.status !== "completed" ||
    !order.inspectionEndsAt ||
    order.inspectionEndsAt > new Date()
  )
    return false;
  const result = await AffiliateCommissionModel.updateOne(
    { orderId, status: "pending" },
    { $set: { status: "approved", approvedAt: new Date() } },
    { session },
  );
  return result.modifiedCount > 0;
}

export async function reconcileAffiliateCommissions(affiliateId?: unknown) {
  const pending = await AffiliateCommissionModel.find({
    ...(affiliateId ? { affiliateId } : {}),
    status: "pending",
  })
    .select("orderId")
    .limit(500)
    .lean();
  const orderIds = pending.map((item) => item.orderId);
  if (!orderIds.length) return 0;
  const eligibleOrders = await OrderModel.find({
    _id: { $in: orderIds },
    status: "completed",
    inspectionEndsAt: { $lte: new Date() },
  })
    .select("_id orderNumber")
    .lean();
  if (!eligibleOrders.length) return 0;
  const approved = (
    await Promise.all(
      eligibleOrders.map((order) =>
        AffiliateCommissionModel.findOneAndUpdate(
          { orderId: order._id, status: "pending" },
          { $set: { status: "approved", approvedAt: new Date() } },
          { returnDocument: "after" },
        ).lean(),
      ),
    )
  ).filter(Boolean);
  if (!approved.length) return 0;
  const affiliates = await AffiliateModel.find({
    _id: { $in: approved.map((commission) => commission!.affiliateId) },
  })
    .select("userId")
    .lean();
  const affiliateMap = new Map(affiliates.map((affiliate) => [String(affiliate._id), affiliate]));
  const orderMap = new Map(eligibleOrders.map((order) => [String(order._id), order]));
  await Promise.all(
    approved.map((commission) => {
      const affiliate = affiliateMap.get(String(commission!.affiliateId));
      const order = orderMap.get(String(commission!.orderId));
      return affiliate
        ? notify(
            affiliate.userId,
            "affiliate_commission_approved",
            "Commission approved",
            `Commission for ${order?.orderNumber ?? "an ArtDera order"} is now available for payout.`,
            "/account/ambassador",
          )
        : Promise.resolve();
    }),
  );
  return approved.length;
}
