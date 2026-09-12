import { randomUUID } from "node:crypto";
import { connectDatabase, disconnectDatabase } from "../db";
import { SubscriptionPlanModel, SystemSettingModel, TaxonomyModel } from "../models";

async function main() {
  await connectDatabase();
  const [plans, taxonomy] = await Promise.all([
    SubscriptionPlanModel.countDocuments({ isActive: true }),
    TaxonomyModel.countDocuments({ isActive: true }),
  ]);
  if (plans !== 4 || taxonomy === 0) throw new Error("Required seed records are missing");

  const key = `database-smoke-${randomUUID()}`;
  const created = await SystemSettingModel.create({
    key,
    value: { stage: "created" },
    isPublic: false,
  });
  const read = await SystemSettingModel.findById(created._id).lean();
  if (!read || (read.value as { stage?: string }).stage !== "created")
    throw new Error("Database read check failed");
  await SystemSettingModel.updateOne(
    { _id: created._id },
    { $set: { value: { stage: "updated" } } },
  );
  const updated = await SystemSettingModel.findById(created._id).lean();
  if (!updated || (updated.value as { stage?: string }).stage !== "updated")
    throw new Error("Database update check failed");
  await SystemSettingModel.deleteOne({ _id: created._id });
  if (await SystemSettingModel.exists({ _id: created._id }))
    throw new Error("Database delete check failed");
  process.stdout.write(
    `ArtDera database smoke test passed: ${plans} plans and ${taxonomy} taxonomy records available; CRUD verified.\n`,
  );
  await disconnectDatabase();
}

void main().catch(async () => {
  process.stderr.write(
    "ArtDera database smoke test failed. Check configuration and database permissions.\n",
  );
  await disconnectDatabase();
  process.exitCode = 1;
});
