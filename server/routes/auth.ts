import bcrypt from "bcryptjs";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { getEnv } from "../config/env";
import {
  ArtistProfileModel,
  AuthSessionModel,
  GalleryProfileModel,
  ListingQuotaModel,
  PendingPlanSelectionModel,
  SubscriptionModel,
  UserModel,
} from "../models";
import { ApiError, asyncRoute, ok } from "../lib/http";
import {
  hashToken,
  normalizeEmail,
  normalizePhone,
  randomToken,
  sanitizeText,
} from "../lib/security";
import { SESSION_COOKIE, requireAuth } from "../middleware/auth";
import { serializeSubscription, serializeUser } from "../lib/serializers";
import { notify } from "../services/notifications";
import { PLAN_SELECTION_COOKIE, pendingPlanSelectionFor } from "./plans";
import { getActivePlan } from "../services/plans";
import { audit } from "../services/audit";
import { sendPasswordResetEmail } from "../services/email";

export const authRouter = Router();
const SESSION_MS = 7 * 24 * 60 * 60_000;

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/\d/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a symbol");

function cookieOptions() {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MS,
  };
}

async function startSession(
  req: Parameters<typeof audit>[0],
  res: Parameters<typeof ok>[0],
  userId: unknown,
) {
  const token = randomToken();
  await AuthSessionModel.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_MS),
    ipAddress: req.ip,
    userAgent: req.get("user-agent")?.slice(0, 500),
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

async function destinationFor(user: { _id: unknown; role: string; emailVerified: boolean }) {
  if (user.role === "admin") return "/admin";
  if (user.role === "buyer") return "/account";
  const subscription = await SubscriptionModel.findOne({ userId: user._id })
    .sort({ createdAt: -1 })
    .lean();
  if (!subscription) return "/sell/plans";
  const paidPlanExpired =
    subscription.planId !== "free" &&
    (!subscription.currentPeriodEnd || subscription.currentPeriodEnd <= new Date());
  if (subscription.planId !== "free" && (subscription.status !== "active" || paidPlanExpired))
    return "/artist/checkout";
  const profile =
    user.role === "gallery"
      ? await GalleryProfileModel.findOne({ userId: user._id }).lean()
      : await ArtistProfileModel.findOne({ userId: user._id }).lean();
  return profile?.onboardingCompleted ? "/artist/dashboard" : "/artist/onboarding";
}

authRouter.post(
  "/register",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        fullName: z.string().trim().min(2).max(120),
        email: z.string().email().max(254),
        phone: z.string().trim().min(7).max(30).optional(),
        mobile: z.string().trim().min(7).max(30).optional(),
        password: passwordSchema,
        role: z.enum(["buyer", "artist", "gallery"]).default("buyer"),
        sellerType: z.string().trim().max(80).optional(),
        city: z.string().trim().min(2).max(100),
        province: z.string().trim().max(100).optional(),
        country: z.string().trim().max(80).default("Pakistan"),
        termsAccepted: z.boolean().optional(),
        privacyAccepted: z.boolean().optional(),
        terms: z.boolean().optional(),
        planId: z.enum(["free", "professional", "gallery"]).optional(),
        billingCycle: z.enum(["free", "monthly", "annual"]).optional(),
      })
      .strict()
      .parse(req.body);
    if (!(input.termsAccepted ?? input.terms))
      throw new ApiError(422, "TERMS_REQUIRED", "Accept the Terms and Privacy Policy to continue");
    const emailNormalized = normalizeEmail(input.email);
    const phone = input.phone ?? input.mobile;
    const phoneNormalized = normalizePhone(phone);
    const exists = await UserModel.exists({
      $or: [{ emailNormalized }, ...(phoneNormalized ? [{ phoneNormalized }] : [])],
    });
    if (exists)
      throw new ApiError(409, "ACCOUNT_EXISTS", "An account already uses that email or phone");

    let selection: { planId: string; billingCycle: string } | undefined;
    const selectionToken = req.cookies?.[PLAN_SELECTION_COOKIE] as string | undefined;
    if (selectionToken) {
      const pending = await PendingPlanSelectionModel.findOne({
        tokenHash: hashToken(selectionToken),
        expiresAt: { $gt: new Date() },
      })
        .select("+tokenHash")
        .lean();
      if (pending) selection = { planId: pending.planId, billingCycle: pending.billingCycle };
    }
    if (!selection && input.planId) {
      selection = {
        planId: input.planId,
        billingCycle: input.billingCycle ?? (input.planId === "free" ? "free" : "monthly"),
      };
    }
    if (["artist", "gallery"].includes(input.role) && !selection)
      throw new ApiError(
        422,
        "PLAN_SELECTION_REQUIRED",
        "Choose a valid plan before creating a seller account",
      );
    if (input.role === "gallery" && selection?.planId !== "gallery")
      throw new ApiError(422, "GALLERY_PLAN_REQUIRED", "Gallery accounts require the Gallery plan");

    const now = new Date();
    const user = await UserModel.create({
      fullName: sanitizeText(input.fullName, 120),
      email: emailNormalized,
      emailNormalized,
      phone,
      phoneNormalized,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: input.role,
      sellerType: input.role === "buyer" ? null : input.role,
      status: "active",
      emailVerified: true,
      city: sanitizeText(input.city, 100),
      province: input.province ? sanitizeText(input.province, 100) : undefined,
      country: sanitizeText(input.country, 80),
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
    });

    if (input.role === "artist") {
      await ArtistProfileModel.create({
        userId: user._id,
        displayName: user.fullName,
        city: user.city,
        province: user.province,
        country: user.country,
      });
    } else if (input.role === "gallery") {
      await GalleryProfileModel.create({
        userId: user._id,
        galleryName: user.fullName,
        city: user.city,
        province: user.province,
        country: user.country,
      });
    }
    if (selection) {
      const { plan, cycle, price } = await getActivePlan(selection.planId, selection.billingCycle);
      const freePlan = plan.planId === "free";
      await SubscriptionModel.create({
        userId: user._id,
        planId: plan.planId,
        billingCycle: cycle,
        status: freePlan ? "active" : "pending",
        price,
        commissionRate: plan.commissionRate,
        listingLimit: plan.listingLimit,
        currency: "PKR",
        featuresSnapshot: plan.permissions,
        startedAt: freePlan ? now : undefined,
        currentPeriodStart: freePlan ? now : undefined,
      });
      await ListingQuotaModel.updateOne(
        { userId: user._id },
        { $setOnInsert: { activeListings: 0 } },
        { upsert: true },
      );
    }
    await notify(
      user._id,
      "new_account",
      "Welcome to ArtDera",
      "Your account was created successfully.",
    );
    await startSession(req, res, user._id);
    if (selectionToken)
      await PendingPlanSelectionModel.updateOne(
        { tokenHash: hashToken(selectionToken) },
        { $set: { userId: user._id } },
      );
    await audit(req, "user.registered", "User", user._id, undefined, {
      role: user.role,
      status: user.status,
    });
    return ok(res, serializeUser(user), "Account created", 201);
  }),
);

authRouter.post(
  "/become-seller",
  requireAuth,
  asyncRoute(async (req, res) => {
    const selection = await pendingPlanSelectionFor(req, req.auth!.user._id);
    if (!selection)
      throw new ApiError(
        422,
        "PLAN_SELECTION_REQUIRED",
        "Choose a seller plan before starting store setup",
      );

    const sellerRole = selection.planId === "gallery" ? "gallery" : "artist";
    const currentRole = req.auth!.user.role;
    if (["artist", "gallery"].includes(currentRole)) {
      const subscription = await SubscriptionModel.findOne({ userId: req.auth!.user._id })
        .sort({ createdAt: -1 })
        .lean();
      return ok(res, {
        user: serializeUser(req.auth!.user),
        subscription: subscription ? serializeSubscription(subscription) : null,
        destination: await destinationFor(req.auth!.user),
      });
    }
    if (currentRole !== "buyer")
      throw new ApiError(
        403,
        "SELLER_CONVERSION_NOT_AVAILABLE",
        "This account cannot create a seller profile",
      );

    const { plan, cycle, price } = await getActivePlan(selection.planId, selection.billingCycle);
    const now = new Date();
    const freePlan = plan.planId === "free";
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const converted = await UserModel.findOneAndUpdate(
          { _id: req.auth!.user._id, role: "buyer" },
          { $set: { role: sellerRole, sellerType: sellerRole } },
          { returnDocument: "after", runValidators: true, session: dbSession },
        );
        if (!converted) {
          const existing = await UserModel.findById(req.auth!.user._id).session(dbSession);
          if (!existing || !["artist", "gallery"].includes(existing.role))
            throw new ApiError(
              409,
              "SELLER_CONVERSION_CONFLICT",
              "Your account changed while seller setup was starting. Please try again.",
            );
          return;
        }

        if (sellerRole === "gallery") {
          await GalleryProfileModel.updateOne(
            { userId: converted._id },
            {
              $setOnInsert: {
                userId: converted._id,
                galleryName: converted.fullName,
                city: converted.city,
                province: converted.province,
                country: converted.country,
              },
            },
            { upsert: true, session: dbSession },
          );
        } else {
          await ArtistProfileModel.updateOne(
            { userId: converted._id },
            {
              $setOnInsert: {
                userId: converted._id,
                displayName: converted.fullName,
                city: converted.city,
                province: converted.province,
                country: converted.country,
              },
            },
            { upsert: true, session: dbSession },
          );
        }

        const existingSubscription = await SubscriptionModel.findOne({
          userId: converted._id,
        })
          .sort({ createdAt: -1 })
          .session(dbSession);
        const subscriptionValues = {
          planId: plan.planId,
          billingCycle: cycle,
          status: freePlan ? ("active" as const) : ("pending" as const),
          price,
          commissionRate: plan.commissionRate,
          listingLimit: plan.listingLimit,
          currency: "PKR" as const,
          featuresSnapshot: plan.permissions,
          startedAt: freePlan ? now : undefined,
          currentPeriodStart: freePlan ? now : undefined,
        };
        if (existingSubscription) {
          existingSubscription.set(subscriptionValues);
          await existingSubscription.save({ session: dbSession });
        } else {
          await SubscriptionModel.create([{ userId: converted._id, ...subscriptionValues }], {
            session: dbSession,
          });
        }
        await ListingQuotaModel.updateOne(
          { userId: converted._id },
          { $setOnInsert: { activeListings: 0 } },
          { upsert: true, session: dbSession },
        );
      });
    } finally {
      await dbSession.endSession();
    }

    const user = await UserModel.findById(req.auth!.user._id);
    if (!user) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Your account could not be loaded");
    const subscription = await SubscriptionModel.findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .lean();
    await notify(
      user._id,
      "seller_profile_started",
      "Seller setup started",
      "Your collector account can now create and manage an ArtDera store.",
      freePlan ? "/artist/onboarding" : "/artist/checkout",
    );
    await audit(
      req,
      "user.became_seller",
      "User",
      user._id,
      { role: "buyer" },
      {
        role: user.role,
        sellerType: user.sellerType,
        planId: plan.planId,
      },
    );
    return ok(res, {
      user: serializeUser(user),
      subscription: subscription ? serializeSubscription(subscription) : null,
      destination: await destinationFor(user),
    });
  }),
);

authRouter.post(
  "/login",
  asyncRoute(async (req, res) => {
    const input = z
      .object({ email: z.string().email(), password: z.string().min(1).max(128) })
      .strict()
      .parse(req.body);
    const user = await UserModel.findOne({ emailNormalized: normalizeEmail(input.email) }).select(
      "+passwordHash +failedLoginAttempts +lockedUntil",
    );
    const generic = new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "The email or password is not correct",
    );
    if (!user) {
      await bcrypt.compare(
        input.password,
        "$2b$12$tR6Yh6F4QX9pFqD.Mq65ZupjHng9bGnhV7M99S5FsUjA0WmZs7teS",
      );
      throw generic;
    }
    if (["suspended", "deleted"].includes(user.status))
      throw new ApiError(
        403,
        "ACCOUNT_SUSPENDED",
        "This account is not available. Contact support.",
      );
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new ApiError(
        423,
        "ACCOUNT_TEMPORARILY_LOCKED",
        "Too many attempts. Try again later or reset your password.",
      );
    if (!(await bcrypt.compare(input.password, user.passwordHash))) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60_000);
        user.status = "locked";
      }
      await user.save();
      throw generic;
    }
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.emailVerified = true;
    if (["locked", "pending_verification"].includes(user.status)) user.status = "active";
    user.lastLoginAt = new Date();
    await user.save();
    await startSession(req, res, user._id);
    await audit(req, "auth.login", "User", user._id);
    return ok(res, { user: serializeUser(user), destination: await destinationFor(user) });
  }),
);

authRouter.get(
  "/session",
  asyncRoute(async (req, res) => {
    if (!req.auth) return ok(res, { user: null, subscription: null });
    const [subscription, planSelection] = await Promise.all([
      SubscriptionModel.findOne({ userId: req.auth.user._id }).sort({ createdAt: -1 }).lean(),
      pendingPlanSelectionFor(req, req.auth.user._id),
    ]);
    return ok(res, {
      user: serializeUser(req.auth.user),
      subscription: subscription ? serializeSubscription(subscription) : null,
      planSelection,
      destination: await destinationFor(req.auth.user),
    });
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncRoute(async (req, res) => {
    await AuthSessionModel.updateOne(
      { _id: req.auth!.sessionId },
      { $set: { revokedAt: new Date() } },
    );
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
    return ok(res, { loggedOut: true });
  }),
);

authRouter.post(
  "/refresh",
  requireAuth,
  asyncRoute(async (req, res) => {
    await AuthSessionModel.updateOne(
      { _id: req.auth!.sessionId },
      { $set: { revokedAt: new Date() } },
    );
    await startSession(req, res, req.auth!.user._id);
    return ok(res, { user: serializeUser(req.auth!.user) });
  }),
);

authRouter.post(
  "/change-password",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })
      .strict()
      .parse(req.body);
    const user = await UserModel.findById(req.auth!.user._id).select("+passwordHash");
    if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash)))
      throw new ApiError(422, "CURRENT_PASSWORD_INCORRECT", "The current password is not correct");
    user.passwordHash = await bcrypt.hash(input.newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();
    await AuthSessionModel.updateMany(
      { userId: user._id, _id: { $ne: req.auth!.sessionId } },
      { $set: { revokedAt: new Date() } },
    );
    return ok(res, { changed: true }, "Password changed");
  }),
);

authRouter.patch(
  "/contact",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        email: z.string().email().optional(),
        phone: z.string().min(7).max(30).optional(),
        mobile: z.string().min(7).max(30).optional(),
      })
      .strict()
      .refine((v) => Boolean(v.email || v.phone || v.mobile))
      .parse(req.body);
    if (input.email) {
      const normalized = normalizeEmail(input.email);
      if (await UserModel.exists({ emailNormalized: normalized, _id: { $ne: req.auth!.user._id } }))
        throw new ApiError(409, "EMAIL_EXISTS", "An account already uses that email");
      req.auth!.user.email = normalized;
      req.auth!.user.emailNormalized = normalized;
      req.auth!.user.emailVerified = true;
      req.auth!.user.status = "active";
    }
    const phone = input.phone ?? input.mobile;
    if (phone) {
      const normalized = normalizePhone(phone);
      if (
        normalized &&
        (await UserModel.exists({ phoneNormalized: normalized, _id: { $ne: req.auth!.user._id } }))
      )
        throw new ApiError(409, "PHONE_EXISTS", "An account already uses that phone number");
      req.auth!.user.phone = phone;
      req.auth!.user.phoneNormalized = normalized;
      req.auth!.user.phoneVerified = false;
    }
    await req.auth!.user.save();
    return ok(res, serializeUser(req.auth!.user), "Contact details updated");
  }),
);

authRouter.patch(
  "/profile",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        fullName: z.string().trim().min(2).max(120).optional(),
        city: z.string().trim().min(2).max(100).optional(),
        province: z.string().trim().max(100).optional(),
        country: z.string().trim().min(2).max(80).optional(),
        avatarUrl: z.string().trim().max(1000).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0, "At least one profile field is required")
      .parse(req.body);
    const before = serializeUser(req.auth!.user);
    if (input.fullName) req.auth!.user.fullName = sanitizeText(input.fullName, 120);
    if (input.city) req.auth!.user.city = sanitizeText(input.city, 100);
    if (input.province !== undefined) req.auth!.user.province = sanitizeText(input.province, 100);
    if (input.country) req.auth!.user.country = sanitizeText(input.country, 80);
    if (input.avatarUrl !== undefined) req.auth!.user.avatarUrl = input.avatarUrl;
    await req.auth!.user.save();
    await audit(
      req,
      "user.profile_updated",
      "User",
      req.auth!.user._id,
      before,
      serializeUser(req.auth!.user),
    );
    return ok(res, serializeUser(req.auth!.user), "Profile updated");
  }),
);

authRouter.post(
  "/sessions/revoke-others",
  requireAuth,
  asyncRoute(async (req, res) => {
    const result = await AuthSessionModel.updateMany(
      {
        userId: req.auth!.user._id,
        _id: { $ne: req.auth!.sessionId },
        revokedAt: { $exists: false },
      },
      { $set: { revokedAt: new Date() } },
    );
    await audit(req, "auth.other_sessions_revoked", "AuthSession", req.auth!.sessionId);
    return ok(res, { revoked: result.modifiedCount }, "Other sessions signed out");
  }),
);

// ---------------------------------------------------------------------------
// POST /forgot-password
// Generates a secure reset token, stores it hashed, and emails the reset link.
// Always returns a generic 200 response — never reveals account existence.
// ---------------------------------------------------------------------------
authRouter.post(
  "/forgot-password",
  asyncRoute(async (req, res) => {
    const input = z
      .object({ email: z.string().email().max(254) })
      .strict()
      .parse(req.body);

    const emailNormalized = normalizeEmail(input.email);

    // Generic response used in all cases to prevent account-enumeration
    const genericOk = () =>
      ok(res, { sent: true }, "If an account exists for this email we've sent a reset link");

    const user = await UserModel.findOne({ emailNormalized })
      .select("+resetPasswordToken +resetPasswordExpires")
      .lean(false); // Need a mutable document

    if (!user || ["suspended", "deleted"].includes(user.status)) {
      return genericOk();
    }

    // Generate a cryptographically secure raw token (sent to user by email)
    const rawToken = randomToken(32); // 256 bits of entropy
    const tokenHash = hashToken(rawToken);
    const expires = new Date(Date.now() + 30 * 60_000); // 30 minutes

    // Store only the hashed token — never the raw token
    user.set("resetPasswordToken", tokenHash);
    user.set("resetPasswordExpires", expires);
    await user.save();

    const env = getEnv();
    const resetUrl = `${env.APP_URL}/auth/reset-password?token=${rawToken}`;

    const emailResult = await sendPasswordResetEmail(user.email, user.fullName, resetUrl);

    if (!emailResult.ok) {
      // Roll back the token so a failed send doesn't leave a dangling record
      user.set("resetPasswordToken", null);
      user.set("resetPasswordExpires", null);
      await user.save();
      // Keep the response indistinguishable from an unknown address. Provider
      // failures are already recorded server-side by the email service.
      return genericOk();
    }

    return genericOk();
  }),
);

// ---------------------------------------------------------------------------
// POST /reset-password
// Validates the raw token, hashes and updates the password, revokes sessions.
// ---------------------------------------------------------------------------
authRouter.post(
  "/reset-password",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        token: z.string().min(1).max(512),
        password: passwordSchema,
        confirmPassword: z.string().min(1).max(128),
      })
      .strict()
      .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      })
      .parse(req.body);

    const tokenHash = hashToken(input.token);

    const user = await UserModel.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+passwordHash +resetPasswordToken +resetPasswordExpires");

    if (!user) {
      throw new ApiError(
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "This password reset link is invalid or has expired.",
      );
    }

    // Hash with the same cost factor used in registration and change-password
    user.passwordHash = await bcrypt.hash(input.password, 12);
    user.passwordChangedAt = new Date();

    // Invalidate the reset token (single-use)
    user.set("resetPasswordToken", null);
    user.set("resetPasswordExpires", null);

    await user.save();

    // Revoke ALL existing sessions for this user so compromised devices
    // cannot remain authenticated after a password reset.
    await AuthSessionModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );

    await audit(req, "auth.password_reset", "User", user._id);

    return ok(res, { reset: true }, "Password changed successfully");
  }),
);
