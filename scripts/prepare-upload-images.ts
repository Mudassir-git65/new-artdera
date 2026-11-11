import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { connectDatabase, disconnectDatabase } from "../server/db";
import { UploadModel } from "../server/models";
import { preparePublicImageVariants } from "../server/routes/uploads";
import mongoose from "mongoose";

await connectDatabase();
try {
  const filter = { access: "public", mimeType: /^image\// };
  const stats = await mongoose.connection.db!.stats();
  const count = await UploadModel.countDocuments(filter);
  const report = {
    measuredAt: new Date().toISOString(),
    applied: process.argv.includes("--apply"),
    publicImages: count,
    databaseDataBytes: stats.dataSize,
    processed: 0,
    generatedSizes: 0,
    failed: [] as string[],
  };
  if (report.applied) {
    // At most four original downloads and two transforms. Resumable and
    // idempotent: existing variants are skipped; no originals are modified.
    const pending = new Set<Promise<void>>();
    for await (const record of UploadModel.find(filter)
      .select("+storageKey")
      .sort({ createdAt: -1 })
      .lean()
      .cursor({ batchSize: 16 })) {
      const job: Promise<void> = (async () => {
        try {
          const widths = await preparePublicImageVariants(record);
          report.processed++;
          report.generatedSizes += widths.length;
        } catch {
          report.failed.push(record.publicId);
        }
        if (report.processed % 10 === 0)
          console.log(
            JSON.stringify({ processed: report.processed, generatedSizes: report.generatedSizes }),
          );
      })().finally(() => pending.delete(job));
      pending.add(job);
      if (pending.size >= 4) await Promise.race(pending);
    }
    await Promise.all(pending);
    await mkdir(".performance", { recursive: true });
    await writeFile(".performance/upload-images.json", JSON.stringify(report, null, 2));
    if (report.failed.length) process.exitCode = 1;
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await disconnectDatabase();
}
