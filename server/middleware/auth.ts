import type { NextFunction, Request, Response } from "express";
import type {} from "../types/express.d.ts";
import mongoose from "mongoose";
import { AuthSessionModel, UserModel } from "../models";
import { ApiError } from "../lib/http";
import { hashToken } from "../lib/security";

export const SESSION_COOKIE = "artdera_session";

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return next();
  const session = await AuthSessionModel.findOne({
    tokenHash: hashToken(token),
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).select("+tokenHash");
  if (!session) return next();
  const user = await UserModel.findById(session.userId);
  if (!user || !["active", "pending_verification"].includes(user.status)) return next();
  req.auth = { user, sessionId: String(session._id) };
  void AuthSessionModel.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } });
  return next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(new ApiError(401, "AUTH_REQUIRED", "Please sign in to continue"));
  return next();
}

export function requireVerified(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(new ApiError(401, "AUTH_REQUIRED", "Please sign in to continue"));
  // Email verification is temporarily disabled. Keep this middleware as an
  // authentication boundary so existing route composition remains stable.
  return next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new ApiError(401, "AUTH_REQUIRED", "Please sign in to continue"));
    if (!roles.includes(req.auth.user.role))
      return next(new ApiError(403, "FORBIDDEN", "You do not have access to this action"));
    return next();
  };
}

export function objectId(value: string, field = "id") {
  if (!mongoose.isValidObjectId(value))
    throw new ApiError(422, "INVALID_ID", `The ${field} is not valid`);
  return new mongoose.Types.ObjectId(value);
}
