import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export function ok<T>(res: Response, data: T, message?: string, status = 200) {
  return res.status(status).json({ success: true, data, ...(message ? { message } : {}) });
}

export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, "NOT_FOUND", "The requested resource was not found"));
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Please correct the highlighted fields",
        fieldErrors: error.flatten().fieldErrors,
      },
    });
  }
  if (error instanceof ApiError) {
    return res.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        fieldErrors: error.fieldErrors ?? {},
      },
    });
  }
  if (error instanceof mongoose.Error.CastError) {
    return res.status(422).json({
      success: false,
      error: {
        code: "INVALID_ID",
        message: "The requested identifier is not valid",
        fieldErrors: {},
      },
    });
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "The submitted data is not valid",
        fieldErrors: {},
      },
    });
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  ) {
    const fields = Object.keys(
      (error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {},
    );
    const label = fields.includes("slug") ? "URL" : fields.includes("email") ? "email" : "value";
    return res.status(409).json({
      success: false,
      error: {
        code: "DUPLICATE_VALUE",
        message: `That ${label} is already in use. Please choose another one.`,
        fieldErrors: {},
      },
    });
  }
  console.error(`Unhandled API error for ${req.method} ${req.path}`, error);
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "The request could not be completed",
      fieldErrors: {},
    },
  });
}

export function pageQuery(value: unknown, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : fallback;
}

export function limitQuery(value: unknown, fallback = 24, maximum = 100) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}
