import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { z } from "zod";
import { getEnv } from "../config/env";
import { ApiError, asyncRoute, ok } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { UploadModel } from "../models";

export const uploadsRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

function gridFsBucket() {
  if (!mongoose.connection.db)
    throw new ApiError(503, "UPLOAD_STORAGE_UNAVAILABLE", "Upload storage is not ready");
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "artderaUploads",
  });
}

function safeLocalTarget(storageKey: string) {
  const root = path.resolve(process.cwd(), getEnv().UPLOAD_DIR);
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new ApiError(403, "FORBIDDEN", "Invalid file path");
  return target;
}

function providerFor(record: { provider?: string; storageKey: string }) {
  if (record.provider) return record.provider;
  return mongoose.Types.ObjectId.isValid(record.storageKey) ? "mongodb" : "local";
}

async function sendStoredUpload(
  record: {
    provider?: string;
    storageKey: string;
    mimeType: string;
    originalName?: string | null;
    access: string;
  },
  res: Parameters<typeof ok>[0],
) {
  res.type(record.mimeType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${record.originalName?.replace(/["\r\n]/g, "") ?? "document"}"`,
  );
  res.setHeader(
    "Cache-Control",
    record.access === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
  );

  if (providerFor(record) === "local") {
    await new Promise<void>((resolve, reject) => {
      res.sendFile(safeLocalTarget(record.storageKey), (error) =>
        error ? reject(error) : resolve(),
      );
    });
    return;
  }

  if (providerFor(record) === "mongodb") {
    if (!mongoose.Types.ObjectId.isValid(record.storageKey))
      throw new ApiError(404, "UPLOAD_NOT_FOUND", "File not found");
    const id = new mongoose.Types.ObjectId(record.storageKey);
    const bucket = gridFsBucket();
    const stored = await bucket.find({ _id: id }).next();
    if (!stored) throw new ApiError(404, "UPLOAD_NOT_FOUND", "File not found");
    try {
      await pipeline(bucket.openDownloadStream(id), res);
    } catch (error) {
      // Browsers routinely cancel image requests during navigation or HMR.
      // Once the response is gone there is no server error to send or log.
      if (
        res.destroyed &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ERR_STREAM_PREMATURE_CLOSE"
      )
        return;
      throw error;
    }
    return;
  }

  throw new ApiError(
    503,
    "UPLOAD_PROVIDER_UNAVAILABLE",
    "The configured upload provider is not available",
  );
}

async function deleteStoredUpload(record: { provider?: string; storageKey: string }) {
  if (providerFor(record) === "local") {
    await unlink(safeLocalTarget(record.storageKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    return;
  }
  if (providerFor(record) === "mongodb") {
    if (!mongoose.Types.ObjectId.isValid(record.storageKey)) return;
    await gridFsBucket()
      .delete(new mongoose.Types.ObjectId(record.storageKey))
      .catch((error: { code?: number }) => {
        if (error.code !== 26) throw error;
      });
  }
}

function sniffMime(buffer: Buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return { mime: "image/jpeg", ext: "jpg" };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: "image/png", ext: "png" };
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  if (buffer.subarray(0, 4).toString("ascii") === "%PDF")
    return { mime: "application/pdf", ext: "pdf" };
  return null;
}

uploadsRouter.post(
  "/",
  requireAuth,
  upload.single("file"),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        purpose: z.enum([
          "artwork",
          "profile",
          "cover",
          "message",
          "verification",
          "payment_proof",
        ]),
        access: z.enum(["public", "private"]).optional(),
      })
      .strict()
      .parse(req.body);
    if (!req.file) throw new ApiError(422, "FILE_REQUIRED", "Choose a file to upload");
    const detected = sniffMime(req.file.buffer);
    if (!detected)
      throw new ApiError(422, "UNSUPPORTED_FILE_TYPE", "Use JPG, PNG, WebP, or PDF files");
    const imagePurpose = ["artwork", "profile", "cover", "payment_proof"].includes(input.purpose);
    if (imagePurpose && !detected.mime.startsWith("image/"))
      throw new ApiError(422, "UNSUPPORTED_FILE_TYPE", "This upload must be an image");
    const env = getEnv();
    if (!["local", "mongodb"].includes(env.UPLOAD_PROVIDER))
      throw new ApiError(
        503,
        "UPLOAD_PROVIDER_UNAVAILABLE",
        "The configured upload provider is not available",
      );
    const maximumMb =
      input.purpose === "artwork"
        ? env.MAX_ARTWORK_IMAGE_SIZE_MB
        : input.purpose === "payment_proof"
          ? env.MAX_PAYMENT_PROOF_SIZE_MB
          : env.MAX_PROFILE_IMAGE_SIZE_MB;
    if (req.file.size > maximumMb * 1024 * 1024)
      throw new ApiError(413, "FILE_TOO_LARGE", `The maximum upload size is ${maximumMb} MB`);
    const access = ["verification", "payment_proof"].includes(input.purpose)
      ? "private"
      : (input.access ?? "public");
    const publicId = randomUUID();
    const filename = `${publicId}.${detected.ext}`;
    let storageKey: string;
    if (env.UPLOAD_PROVIDER === "local") {
      const root = path.resolve(process.cwd(), env.UPLOAD_DIR);
      const workspace = path.resolve(process.cwd());
      if (!(root === workspace || root.startsWith(`${workspace}${path.sep}`)))
        throw new ApiError(
          500,
          "UPLOAD_CONFIGURATION_INVALID",
          "Upload storage is not configured safely",
        );
      const directory = path.join(root, access);
      await mkdir(directory, { recursive: true });
      storageKey = path.join(access, filename);
      await writeFile(path.join(directory, filename), req.file.buffer, { flag: "wx" });
    } else {
      const stream = gridFsBucket().openUploadStream(filename, {
        metadata: {
          publicId,
          ownerId: String(req.auth!.user._id),
          access,
          purpose: input.purpose,
          mimeType: detected.mime,
        },
      });
      await new Promise<void>((resolve, reject) => {
        stream.once("error", reject);
        stream.once("finish", resolve);
        stream.end(req.file!.buffer);
      });
      storageKey = String(stream.id);
    }
    const base = (env.UPLOAD_PUBLIC_BASE_URL ?? "/uploads").replace(/\/$/, "");
    const url =
      access === "public"
        ? env.UPLOAD_PROVIDER === "mongodb"
          ? `/api/uploads/${publicId}/content`
          : `${base}/${filename}`
        : `/api/uploads/${publicId}/download`;
    const record = await UploadModel.create({
      ownerId: req.auth!.user._id,
      publicId,
      url,
      storageKey,
      provider: env.UPLOAD_PROVIDER,
      originalName: path.basename(req.file.originalname).slice(0, 255),
      mimeType: detected.mime,
      size: req.file.size,
      access,
      purpose: input.purpose,
    });
    return ok(
      res,
      {
        id: String(record._id),
        publicId,
        url,
        mimeType: record.mimeType,
        size: record.size,
        access,
      },
      "File uploaded",
      201,
    );
  }),
);

uploadsRouter.get(
  "/:publicId/content",
  asyncRoute(async (req, res) => {
    const record = await UploadModel.findOne({
      publicId: req.params.publicId,
      access: "public",
    }).select("+storageKey");
    if (!record) throw new ApiError(404, "UPLOAD_NOT_FOUND", "File not found");
    await sendStoredUpload(record, res);
  }),
);

uploadsRouter.get(
  "/:publicId/download",
  requireAuth,
  asyncRoute(async (req, res) => {
    const record = await UploadModel.findOne({ publicId: req.params.publicId }).select(
      "+storageKey",
    );
    if (!record) throw new ApiError(404, "UPLOAD_NOT_FOUND", "File not found");
    if (
      record.access === "private" &&
      String(record.ownerId) !== String(req.auth!.user._id) &&
      req.auth!.user.role !== "admin"
    )
      throw new ApiError(403, "FORBIDDEN", "You do not have access to this file");
    await sendStoredUpload(record, res);
  }),
);

uploadsRouter.delete(
  "/:publicId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const record = await UploadModel.findOne({ publicId: req.params.publicId }).select(
      "+storageKey",
    );
    if (!record) throw new ApiError(404, "UPLOAD_NOT_FOUND", "File not found");
    if (String(record.ownerId) !== String(req.auth!.user._id) && req.auth!.user.role !== "admin")
      throw new ApiError(403, "FORBIDDEN", "You do not have access to this file");
    if (record.purpose === "payment_proof" && record.attachedTo && req.auth!.user.role !== "admin")
      throw new ApiError(
        409,
        "PAYMENT_PROOF_ATTACHED",
        "A submitted payment screenshot cannot be deleted",
      );
    await deleteStoredUpload(record);
    await record.deleteOne();
    return ok(res, { publicId: record.publicId, deleted: true }, "File deleted");
  }),
);
