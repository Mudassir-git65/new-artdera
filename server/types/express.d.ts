import type { HydratedDocument } from "mongoose";
import type { UserDocument } from "../models";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        user: HydratedDocument<UserDocument>;
        sessionId: string;
      };
    }
  }
}

export {};
