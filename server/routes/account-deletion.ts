import { Router } from "express";
import { z } from "zod";
import {
  AccountDeletionRequestModel,
  UserModel,
  ArtistProfileModel,
  GalleryProfileModel,
  StoreModel,
  ArtworkModel,
  UserDraftModel,
  NotificationModel,
  AuthSessionModel,
} from "../models";
import { ApiError, asyncRoute, ok, pageQuery, limitQuery } from "../lib/http";
import { requireRole } from "../middleware/auth";
import {
  sendAccountDeletionSubmittedEmail,
  sendAccountDeletionProcessedEmail,
} from "../services/email";
import { audit } from "../services/audit";

export const accountDeletionRouter = Router();

// Public route to submit account deletion request
accountDeletionRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(2, "Name is required").max(120),
        email: z.string().trim().email("Valid email address is required").max(254),
        reason: z.string().trim().max(2000).optional().default(""),
        confirmation: z.boolean().refine((val) => val === true, {
          message: "You must confirm that you are the owner of this account",
        }),
      })
      .strict()
      .parse(req.body);

    const emailNormalized = input.email.toLowerCase();

    // Check if matching user exists
    const matchingUser = await UserModel.findOne({ emailNormalized }).lean();

    // Check if there is already a pending request for this email
    const existingPending = await AccountDeletionRequestModel.findOne({
      emailNormalized,
      status: { $in: ["pending", "processing"] },
    }).lean();

    if (existingPending) {
      return ok(
        res,
        {
          requestId: String(existingPending._id),
          alreadySubmitted: true,
        },
        "An account deletion request is already under review for this email address.",
      );
    }

    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.ip || "";
    const userAgent = (req.headers["user-agent"] as string) || "";

    const requestRecord = await AccountDeletionRequestModel.create({
      name: input.name,
      email: input.email,
      emailNormalized,
      userId: matchingUser ? matchingUser._id : undefined,
      reason: input.reason,
      status: "pending",
      ipAddress: String(ipAddress).slice(0, 100),
      userAgent: String(userAgent).slice(0, 300),
    });

    // Send email confirmation
    void sendAccountDeletionSubmittedEmail(input.email, input.name, String(requestRecord._id));

    return ok(
      res,
      {
        requestId: String(requestRecord._id),
        email: input.email,
        matchedAccount: Boolean(matchingUser),
      },
      "Your account deletion request has been submitted successfully.",
      201,
    );
  }),
);

// Admin route to list account deletion requests
export const adminAccountDeletionRouter = Router();
adminAccountDeletionRouter.use(requireRole("admin"));

adminAccountDeletionRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const page = pageQuery(req);
    const limit = limitQuery(req, 50);
    const status = z
      .enum(["pending", "processing", "completed", "rejected", "all"])
      .optional()
      .parse(req.query.status);
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const filter: Record<string, any> = {};
    if (status && status !== "all") {
      filter.status = status;
    }
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      AccountDeletionRequestModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", "fullName email role status createdAt sellerType")
        .lean(),
      AccountDeletionRequestModel.countDocuments(filter),
    ]);

    return ok(res, {
      items: items.map((item) => ({
        id: String(item._id),
        name: item.name,
        email: item.email,
        reason: item.reason,
        status: item.status,
        rejectionReason: item.rejectionReason,
        adminNotes: item.adminNotes,
        processedAt: item.processedAt ? item.processedAt.toISOString() : undefined,
        createdAt: item.createdAt.toISOString(),
        userId: item.userId ? String((item.userId as any)._id || item.userId) : undefined,
        user:
          item.userId && typeof item.userId === "object"
            ? {
                id: String((item.userId as any)._id),
                fullName: (item.userId as any).fullName,
                email: (item.userId as any).email,
                role: (item.userId as any).role,
                status: (item.userId as any).status,
                createdAt: (item.userId as any).createdAt,
              }
            : undefined,
      })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    });
  }),
);

// Admin route to update request status
adminAccountDeletionRouter.patch(
  "/:id/status",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        status: z.enum(["pending", "processing", "completed", "rejected"]),
        adminNotes: z.string().trim().max(2000).optional(),
        rejectionReason: z.string().trim().max(1000).optional(),
      })
      .strict()
      .parse(req.body);

    const requestRecord = await AccountDeletionRequestModel.findById(req.params.id);
    if (!requestRecord) {
      throw new ApiError(404, "REQUEST_NOT_FOUND", "Account deletion request not found.");
    }

    requestRecord.status = input.status;
    if (input.adminNotes !== undefined) requestRecord.adminNotes = input.adminNotes;
    if (input.rejectionReason !== undefined) requestRecord.rejectionReason = input.rejectionReason;
    if (input.status === "completed" || input.status === "rejected") {
      requestRecord.processedBy = req.auth!.user._id;
      requestRecord.processedAt = new Date();

      // Send email notification
      void sendAccountDeletionProcessedEmail(
        requestRecord.email,
        requestRecord.name,
        input.status,
        input.rejectionReason,
      );
    }

    await requestRecord.save();

    await audit(
      req,
      `admin.account_deletion_${input.status}`,
      "AccountDeletionRequest",
      requestRecord._id,
      undefined,
      { status: input.status, rejectionReason: input.rejectionReason },
    );

    return ok(res, requestRecord, "Account deletion request status updated successfully.");
  }),
);

// Admin route to permanently delete user account and associated data
adminAccountDeletionRouter.delete(
  "/:id/execute",
  asyncRoute(async (req, res) => {
    const { adminNotes } = z
      .object({ adminNotes: z.string().trim().max(2000).optional() })
      .strict()
      .parse(req.body || {});

    const requestRecord = await AccountDeletionRequestModel.findById(req.params.id);
    if (!requestRecord) {
      throw new ApiError(404, "REQUEST_NOT_FOUND", "Account deletion request not found.");
    }

    const emailNormalized = requestRecord.emailNormalized;
    const user = await UserModel.findOne({ emailNormalized });

    if (user) {
      const userId = user._id;

      // Revoke sessions
      await AuthSessionModel.updateMany(
        { userId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
      );

      // Anonymize/mark user as deleted to satisfy privacy laws while preserving order integrity
      user.status = "deleted";
      user.passwordHash = "DELETED_ACCOUNT";
      user.avatarUrl = undefined;
      user.phone = undefined;
      user.phoneNormalized = undefined;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      // Clean up profiles
      await ArtistProfileModel.deleteOne({ userId });
      await GalleryProfileModel.deleteOne({ userId });

      // Deactivate associated stores and archive artworks
      await StoreModel.updateMany(
        { ownerId: userId },
        { $set: { status: "archived", isPublished: false } },
      );
      await ArtworkModel.updateMany({ artistId: userId }, { $set: { status: "archived" } });

      // Clean up user drafts and notifications
      await UserDraftModel.deleteMany({ userId });
      await NotificationModel.deleteMany({ userId });
    }

    requestRecord.status = "completed";
    requestRecord.processedBy = req.auth!.user._id;
    requestRecord.processedAt = new Date();
    if (adminNotes) requestRecord.adminNotes = adminNotes;
    await requestRecord.save();

    await audit(
      req,
      "admin.account_deletion_executed",
      "AccountDeletionRequest",
      requestRecord._id,
      undefined,
      { email: requestRecord.email, userFound: Boolean(user) },
    );

    // Send final completion email
    void sendAccountDeletionProcessedEmail(
      requestRecord.email,
      requestRecord.name,
      "completed",
    );

    return ok(
      res,
      { success: true, requestId: String(requestRecord._id) },
      "User account and data permanently deleted successfully.",
    );
  }),
);
