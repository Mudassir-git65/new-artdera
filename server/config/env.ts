import "dotenv/config";
import { z } from "zod";

function normalizeVercelScalar(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

const nodeEnvironment = z
  .preprocess(
    (value) => (isVercelRuntime() ? "production" : normalizeVercelScalar(value)),
    z.enum(["development", "test", "production"]).default("development"),
  )
  .catch("development");

const booleanFromString = z.unknown().transform((value) => {
  const normalized = String(normalizeVercelScalar(value) ?? "").toLowerCase();
  return ["true", "1", "yes", "on"].includes(normalized);
});

const originsFromString = z.unknown().transform((value) =>
  String(normalizeVercelScalar(value) ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => z.string().url().safeParse(origin).success),
);

const optionalUrl = z
  .preprocess((value) => normalizeVercelScalar(value) || undefined, z.string().url().optional())
  .catch(undefined);

const envSchema = z.object({
  NODE_ENV: nodeEnvironment,
  MONGODB_URI: z.preprocess(normalizeVercelScalar, z.string().min(1, "MONGODB_URI is required")),
  MONGODB_DB_NAME: z
    .preprocess(
      normalizeVercelScalar,
      z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .default("artdera"),
    )
    .catch("artdera"),
  AUTH_SECRET: z.preprocess(
    normalizeVercelScalar,
    z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  ),
  APP_URL: z
    .preprocess(normalizeVercelScalar, z.string().url().default("https://www.artdera.com"))
    .catch("https://www.artdera.com"),
  ALLOWED_ORIGINS: originsFromString,
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001).catch(3001),
  DEMO_PAYMENT_MODE: booleanFromString,
  PAYMENT_PROVIDER: z
    .preprocess(normalizeVercelScalar, z.string().min(1).default("demo"))
    .catch("demo"),
  UPLOAD_PROVIDER: z
    .preprocess(
      normalizeVercelScalar,
      z.enum(["local", "mongodb", "cloudinary", "s3"]).default("mongodb"),
    )
    .catch("mongodb"),
  UPLOAD_DIR: z
    .preprocess(normalizeVercelScalar, z.string().min(1).default("uploads"))
    .catch("uploads"),
  UPLOAD_PUBLIC_BASE_URL: optionalUrl,
  MAX_ARTWORK_IMAGE_SIZE_MB: z.coerce.number().positive().max(25).default(10).catch(10),
  MAX_PROFILE_IMAGE_SIZE_MB: z.coerce.number().positive().max(10).default(5).catch(5),
  MAX_PAYMENT_PROOF_SIZE_MB: z.coerce.number().positive().max(10).default(5).catch(5),
  JAZZCASH_ACCOUNT_TITLE: z
    .preprocess((v) => normalizeVercelScalar(v) || undefined, z.string().min(2).max(120).optional())
    .catch(undefined),
  JAZZCASH_ACCOUNT_NUMBER: z
    .preprocess(
      (v) => normalizeVercelScalar(v) || undefined,
      z
        .string()
        .regex(/^\+?[0-9][0-9 -]{6,20}$/)
        .optional(),
    )
    .catch(undefined),
  EASYPAISA_ACCOUNT_TITLE: z
    .preprocess((v) => normalizeVercelScalar(v) || undefined, z.string().min(2).max(120).optional())
    .catch(undefined),
  EASYPAISA_ACCOUNT_NUMBER: z
    .preprocess(
      (v) => normalizeVercelScalar(v) || undefined,
      z
        .string()
        .regex(/^\+?[0-9][0-9 -]{6,20}$/)
        .optional(),
    )
    .catch(undefined),
  HBL_ACCOUNT_TITLE: z
    .preprocess((v) => normalizeVercelScalar(v) || undefined, z.string().min(2).max(120).optional())
    .catch(undefined),
  HBL_ACCOUNT_NUMBER: z
    .preprocess(
      (v) => normalizeVercelScalar(v) || undefined,
      z
        .string()
        .regex(/^[0-9][0-9 -]{8,30}$/)
        .optional(),
    )
    .catch(undefined),
  HBL_IBAN: z
    .preprocess(
      (v) => normalizeVercelScalar(v) || undefined,
      z
        .string()
        .regex(/^PK[0-9A-Z]{22}$/i)
        .optional(),
    )
    .catch(undefined),
  HBL_QR_CODE_PATH: z
    .preprocess(
      (v) => normalizeVercelScalar(v) || undefined,
      z.string().startsWith("/").max(500).optional(),
    )
    .catch(undefined),
  SEED_DEMO_DATA: booleanFromString,
  // Email Providers (Resend, Gmail SMTP / Nodemailer, EmailJS, or Console)
  RESEND_API_KEY: z
    .preprocess((v) => normalizeVercelScalar(v) || undefined, z.string().min(1).optional())
    .catch(undefined),
  EMAIL_FROM: z
    .preprocess(
      (v) => normalizeVercelScalar(v) || undefined,
      z.string().min(1).default("ArtDera <artdera4@gmail.com>"),
    )
    .catch("ArtDera <artdera4@gmail.com>"),
  GMAIL_USER: z
    .preprocess((v) => normalizeVercelScalar(v) || undefined, z.string().email().optional())
    .catch(undefined),
  GMAIL_APP_PASSWORD: z
    .preprocess((v) => normalizeVercelScalar(v) || undefined, z.string().min(1).optional())
    .catch(undefined),
  EMAILJS_SERVICE_ID: z
    .preprocess((v) => normalizeVercelScalar(v) || undefined, z.string().min(1).optional())
    .catch(undefined),
  EMAILJS_TEMPLATE_ID: z
    .preprocess((v) => normalizeVercelScalar(v) || undefined, z.string().min(1).optional())
    .catch(undefined),
  EMAILJS_PUBLIC_KEY: z
    .preprocess((v) => normalizeVercelScalar(v) || undefined, z.string().min(1).optional())
    .catch(undefined),
  EMAILJS_PRIVATE_KEY: z
    .preprocess((v) => normalizeVercelScalar(v) || undefined, z.string().min(1).optional())
    .catch(undefined),
});

export type AppEnv = z.infer<typeof envSchema>;

export class EnvironmentConfigurationError extends Error {
  readonly fields: string[];

  constructor(fields: string[]) {
    super(`Server configuration is invalid or incomplete: ${fields.join(", ")}`);
    this.name = "EnvironmentConfigurationError";
    this.fields = fields;
  }
}

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new EnvironmentConfigurationError(fields);
  }
  const production = result.data.NODE_ENV === "production";
  const appUrl = new URL(result.data.APP_URL);
  if (
    production &&
    (appUrl.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname))
  )
    throw new EnvironmentConfigurationError(["APP_URL"]);
  if (production && (result.data.DEMO_PAYMENT_MODE || result.data.SEED_DEMO_DATA)) {
    console.warn("Development-only modes were configured in production and have been disabled.");
  }
  cachedEnv = production
    ? {
        ...result.data,
        DEMO_PAYMENT_MODE: false,
        SEED_DEMO_DATA: false,
        UPLOAD_PROVIDER:
          isVercelRuntime() && result.data.UPLOAD_PROVIDER === "local"
            ? "mongodb"
            : result.data.UPLOAD_PROVIDER,
      }
    : result.data;
  return cachedEnv;
}

export function resetEnvForTests() {
  cachedEnv = undefined;
}
