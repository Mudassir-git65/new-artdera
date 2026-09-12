import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getEnv } from "../config/env";
import { ApiError } from "./http";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(token).digest("hex");
}

export function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone?: string) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("92")) return `+${digits}`;
  if (digits.startsWith("0")) return `+92${digits.slice(1)}`;
  return `+${digits}`;
}

export function sanitizeText(value: string, maximum = 4000) {
  return value
    .replace(/[<>\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

export function rejectMongoOperators(value: unknown, depth = 0): void {
  if (depth > 12) throw new ApiError(422, "INVALID_PAYLOAD", "The request is too deeply nested");
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => rejectMongoOperators(item, depth + 1));
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("$") || key.includes(".")) {
      throw new ApiError(422, "INVALID_PAYLOAD", "The request contains a disallowed field");
    }
    rejectMongoOperators(item, depth + 1);
  }
}

export function payloadGuard(req: Request, _res: Response, next: NextFunction) {
  try {
    rejectMongoOperators(req.body);
    rejectMongoOperators(req.query);
    next();
  } catch (error) {
    next(error);
  }
}

function normalizedOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function isLoopbackOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function isAllowedRequestOrigin(req: Request, origin?: string) {
  if (!origin) return true;
  const normalized = normalizedOrigin(origin);
  if (!normalized) return false;
  const env = getEnv();
  const configured = [env.APP_URL, ...env.ALLOWED_ORIGINS].map(normalizedOrigin);
  if (configured.includes(normalized)) return true;
  // Vite selects the next free port during local development. Allow only
  // explicit loopback hosts outside production so that a harmless port
  // change does not break every mutation while deployed origins remain strict.
  if (env.NODE_ENV !== "production" && isLoopbackOrigin(normalized)) return true;

  // Requests to either the custom domain or a Vercel deployment stay
  // same-origin because the browser client uses relative /api URLs.
  const host = req.get("host");
  return Boolean(host && normalized === `${req.protocol}://${host}`);
}

export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (isAllowedRequestOrigin(req, origin)) return next();
  return next(new ApiError(403, "INVALID_ORIGIN", "The request origin is not allowed"));
}

export function moderationFlags(text: string) {
  const flags: string[] = [];
  if (/(?:\+?92|0)?3\d{9}/i.test(text)) flags.push("phone");
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text)) flags.push("email");
  if (/wa\.me|whatsapp/i.test(text)) flags.push("whatsapp");
  if (/paypal|stripe|easypaisa|jazzcash|payment\s*link|https?:\/\//i.test(text))
    flags.push("external_payment");
  return [...new Set(flags)];
}
