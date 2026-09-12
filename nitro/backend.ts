import { fromNodeMiddleware, type NodeMiddleware } from "h3";
import type { IncomingMessage, ServerResponse } from "node:http";

import { createApp } from "../server/app";
import { EnvironmentConfigurationError } from "../server/config/env";
import { connectDatabase } from "../server/db";
import { releaseExpiredReservations } from "../server/services/reservations";
import { refreshPromotionStates } from "../server/services/sponsored";

let app: ReturnType<typeof createApp> | undefined;
let lastMaintenanceAt = 0;

function publicInitializationError(error: unknown) {
  if (error instanceof EnvironmentConfigurationError) {
    return {
      code: "SERVER_CONFIGURATION_INVALID",
      message: `Required Vercel environment variables are missing or invalid: ${error.fields.join(", ")}`,
    };
  }

  return {
    code: "DATABASE_UNAVAILABLE",
    message:
      "MongoDB could not be reached. Check the Atlas connection string, database user, and Network Access rules.",
  };
}

function getApp() {
  app ??= createApp();
  return app;
}

function runMaintenanceWhenDue() {
  const now = Date.now();
  if (now - lastMaintenanceAt < 60_000) return;
  lastMaintenanceAt = now;
  void Promise.all([releaseExpiredReservations(), refreshPromotionStates()]).catch((error) => {
    console.error("ArtDera serverless maintenance could not complete.", error);
  });
}

/**
 * Nitro's Vercel Node entry supplies native Node request/response objects.
 * This bridge keeps one warm Express application and one cached Mongoose
 * connection per function instance while still reconnecting safely after a
 * cold start.
 */
const nodeBackend: NodeMiddleware = async (req, res, _next) => {
  try {
    await connectDatabase();
    runMaintenanceWhenDue();
    getApp()(req as IncomingMessage, res as ServerResponse);
  } catch (error) {
    console.error("ArtDera API initialization failed.", error);
    if (res.headersSent) {
      res.end();
      return;
    }
    res.statusCode = 503;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    const publicError = publicInitializationError(error);
    res.end(
      JSON.stringify({
        success: false,
        error: {
          ...publicError,
          fieldErrors: {},
        },
      }),
    );
  }
};

export const backendHandler = fromNodeMiddleware(nodeBackend);
export default backendHandler;
