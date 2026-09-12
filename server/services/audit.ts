import type { Request } from "express";
import { AuditLogModel } from "../models";

const redactedKeys = new Set([
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "otp",
  "cvv",
  "cardNumber",
  "bankAccount",
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !redactedKeys.has(key))
      .map(([key, item]) => [key, redact(item)]),
  );
}

export async function audit(
  req: Request,
  action: string,
  entityType: string,
  entityId?: unknown,
  before?: unknown,
  after?: unknown,
) {
  await AuditLogModel.create({
    actorId: req.auth?.user._id,
    actorRole: req.auth?.user.role,
    action,
    entityType,
    entityId,
    before: redact(before),
    after: redact(after),
    ipAddress: req.ip,
    userAgent: req.get("user-agent")?.slice(0, 500),
  });
}
