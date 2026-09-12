import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import helmet from "helmet";
import { getEnv } from "./config/env";
import { connectDatabase } from "./db";
import { optionalAuth } from "./middleware/auth";
import { ApiError, asyncRoute, errorHandler, notFound, ok } from "./lib/http";
import { isAllowedRequestOrigin, originGuard, payloadGuard } from "./lib/security";
import { authRouter } from "./routes/auth";
import { plansRouter } from "./routes/plans";
import { subscriptionsRouter } from "./routes/subscriptions";
import { storesRouter } from "./routes/stores";
import { artworksRouter } from "./routes/artworks";
import { uploadsRouter } from "./routes/uploads";
import { messagesRouter } from "./routes/messages";
import { commerceRouter } from "./routes/commerce";
import { operationsRouter } from "./routes/operations";
import { galleryRouter } from "./routes/gallery";
import { adminRouter } from "./routes/admin";
import { bootstrapRouter } from "./routes/bootstrap";
import { indexnowRouter } from "./routes/indexnow";
import { feedsRouter } from "./routes/feeds";
import { adminAffiliatesRouter, affiliatesRouter } from "./routes/affiliates";
import mongoose from "mongoose";

function rateLimitKey(req: Request) {
  const ip = req.ip || req.socket.remoteAddress;
  // Some development/serverless adapters do not provide Express with an IP.
  // Use a stable fail-safe bucket instead of letting draft-8 header generation
  // hash an undefined key and turn an otherwise valid API request into a 500.
  return ip ? ipKeyGenerator(ip) : "unknown-client";
}

const requireDatabase = asyncRoute(async (_req, _res, next) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      // All requests arriving during a cold start share the cached connection
      // promise. If a previous attempt failed, connectDatabase clears it so
      // this request can recover without requiring an API process restart.
      await connectDatabase();
    } catch {
      throw new ApiError(
        503,
        "DATABASE_UNAVAILABLE",
        "The marketplace is starting up. Please try again shortly.",
      );
    }
  }
  next();
});

export function createApp() {
  const env = getEnv();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          mediaSrc: ["'self'", "blob:", "https:"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use((req, res, next) =>
    cors({
      origin(origin, callback) {
        return callback(null, isAllowedRequestOrigin(req, origin));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "x-requested-with"],
      maxAge: 600,
    })(req, res, next),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(cookieParser());
  app.use(payloadGuard);
  app.use(originGuard);
  // Keep health checks available while MongoDB is connecting, then hold API
  // requests at the application boundary instead of letting the dev proxy
  // fail with a 502 because no backend is listening yet.
  app.get("/api/health", (_req, res) =>
    ok(res, { status: mongoose.connection.readyState === 1 ? "ready" : "starting" }),
  );
  app.use("/api", requireDatabase);
  app.use("/feeds", requireDatabase);
  app.use(optionalAuth);

  const generalLimit = rateLimit({
    windowMs: 60_000,
    limit: 240,
    keyGenerator: rateLimitKey,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again shortly.",
        fieldErrors: {},
      },
    },
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    keyGenerator: rateLimitKey,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many authentication attempts. Please wait and try again.",
        fieldErrors: {},
      },
    },
  });
  const messageLimit = rateLimit({
    windowMs: 60_000,
    limit: 30,
    keyGenerator: rateLimitKey,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Message limit reached. Please wait a moment.",
        fieldErrors: {},
      },
    },
  });
  const paymentLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 15,
    keyGenerator: rateLimitKey,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many payment attempts. Please wait and try again.",
        fieldErrors: {},
      },
    },
  });
  // Dedicated limiter for password-reset requests: stricter than general auth
  // to prevent abuse of the email-sending endpoint.
  const passwordResetLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 5,
    keyGenerator: rateLimitKey,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many password reset requests. Please wait 15 minutes and try again.",
        fieldErrors: {},
      },
    },
  });

  app.use("/api", generalLimit);
  app.post("/api/auth/forgot-password", passwordResetLimit);
  app.use("/api/auth", authLimit, authRouter);
  app.use("/api/plans", plansRouter);
  app.use("/api/subscriptions/payment", paymentLimit);
  app.use("/api/subscriptions", subscriptionsRouter);
  app.use("/api/stores", storesRouter);
  app.use("/api/artworks", artworksRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/messages", messageLimit, messagesRouter);
  app.use("/api/affiliate", affiliatesRouter);
  app.use("/api", commerceRouter);
  app.use("/api", operationsRouter);
  app.use("/api/gallery", galleryRouter);
  app.use("/api/admin/affiliate", adminAffiliatesRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/bootstrap", bootstrapRouter);
  app.use("/api/indexnow", indexnowRouter);
  app.use("/feeds", feedsRouter);
  if (env.UPLOAD_PROVIDER === "local") {
    app.use(
      "/uploads",
      express.static(path.resolve(process.cwd(), env.UPLOAD_DIR, "public"), {
        fallthrough: false,
        index: false,
        dotfiles: "deny",
        maxAge: env.NODE_ENV === "production" ? "1y" : 0,
      }),
    );
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
