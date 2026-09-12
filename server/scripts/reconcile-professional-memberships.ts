import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../db";
import {
  ArtistProfileModel,
  AuditLogModel,
  ListingQuotaModel,
  StoreModel,
  SubscriptionModel,
  SubscriptionPlanModel,
} from "../models";
import { isActiveProfessionalSubscription } from "../services/plans";

const requestedSlugs = ["meenh", "waheed"] as const;
const apply = process.argv.includes("--apply");

async function resolveIntendedStores() {
  const direct = await StoreModel.find({ slug: { $in: requestedSlugs } }).lean();
  if (direct.length === requestedSlugs.length) return direct;

  // The display-name fallback handles the historical Meehn/Meenh spelling
  // without making that spelling part of runtime badge logic.
  const profiles = await ArtistProfileModel.find({
    displayName: { $regex: /^(meenh|meehn|waheed)$/i },
  }).lean();
  const fallback = profiles.length
    ? await StoreModel.find({ ownerId: { $in: profiles.map((profile) => profile.userId) } }).lean()
    : [];
  const byOwner = new Map(
    [...direct, ...fallback].map((store) => [String(store.ownerId), store] as const),
  );
  return [...byOwner.values()];
}

async function main() {
  await connectDatabase();
  const stores = await resolveIntendedStores();
  if (stores.length !== 2) {
    throw new Error(
      `Expected exactly two intended Professional stores, but resolved ${stores.length}. No records were changed.`,
    );
  }

  const plan = await SubscriptionPlanModel.findOne({
    planId: "professional",
    isActive: true,
  }).lean();
  if (!plan) throw new Error("The active Professional plan configuration is missing.");

  const intendedOwnerIds = stores.map((store) => store.ownerId);
  const [targetSubscriptions, otherActiveProfessional] = await Promise.all([
    SubscriptionModel.find({ userId: { $in: intendedOwnerIds } })
      .sort({ createdAt: -1 })
      .lean(),
    SubscriptionModel.find({
      userId: { $nin: intendedOwnerIds },
      planId: "professional",
      status: "active",
    }).lean(),
  ]);

  const targetSummary = stores.map((store) => {
    const subscription = targetSubscriptions.find(
      (item) => String(item.userId) === String(store.ownerId),
    );
    return {
      slug: store.slug,
      name: store.name,
      activeProfessional: isActiveProfessionalSubscription(subscription),
      status: subscription?.status ?? "missing",
      expiresAt: subscription?.currentPeriodEnd?.toISOString?.() ?? null,
    };
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        intended: targetSummary,
        otherActiveProfessionalCount: otherActiveProfessional.length,
      },
      null,
      2,
    )}\n`,
  );
  if (!apply) return;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const annualExpiry = new Date(now);
      annualExpiry.setFullYear(annualExpiry.getFullYear() + 1);

      for (const store of stores) {
        const current = await SubscriptionModel.findOne({ userId: store.ownerId })
          .sort({ createdAt: -1 })
          .session(session);
        if (!isActiveProfessionalSubscription(current, now)) {
          const values = {
            userId: store.ownerId,
            storeId: store._id,
            planId: "professional" as const,
            billingCycle: "annual" as const,
            status: "active" as const,
            price: plan.annualPrice ?? plan.monthlyPrice,
            currency: "PKR" as const,
            commissionRate: plan.commissionRate,
            listingLimit: plan.listingLimit,
            startedAt: now,
            currentPeriodStart: now,
            currentPeriodEnd: annualExpiry,
            nextBillingAt: annualExpiry,
            cancelAtPeriodEnd: false,
            paymentProvider: "membership_data_correction",
            featuresSnapshot: [...plan.permissions],
          };
          const subscription = current
            ? await SubscriptionModel.findByIdAndUpdate(
                current._id,
                { $set: values, $unset: { cancelledAt: 1, pendingPlanId: 1, pendingChangeAt: 1 } },
                { returnDocument: "after", runValidators: true, session },
              )
            : (await SubscriptionModel.create([values], { session }))[0];
          await AuditLogModel.create(
            [
              {
                actorRole: "system",
                action: "subscription.professional_membership_reconciled",
                entityType: "Subscription",
                entityId: subscription!._id,
                before: current?.toObject(),
                after: subscription!.toObject(),
              },
            ],
            { session },
          );
        }
        await ListingQuotaModel.updateOne(
          { userId: store.ownerId },
          { $setOnInsert: { activeListings: 0 } },
          { upsert: true, session },
        );
      }

      for (const stale of otherActiveProfessional) {
        await SubscriptionModel.updateOne(
          { _id: stale._id, status: "active", planId: "professional" },
          {
            $set: { status: "expired", currentPeriodEnd: now },
            $unset: { nextBillingAt: 1 },
          },
          { session },
        );
        await AuditLogModel.create(
          [
            {
              actorRole: "system",
              action: "subscription.incorrect_professional_status_removed",
              entityType: "Subscription",
              entityId: stale._id,
              before: stale,
              after: { ...stale, status: "expired", currentPeriodEnd: now },
            },
          ],
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  process.stdout.write("Professional membership reconciliation completed successfully.\n");
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
