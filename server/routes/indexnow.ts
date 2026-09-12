import { Router } from "express";
import { asyncRoute, ok, ApiError } from "../lib/http";

export const indexnowRouter = Router();

const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? "artdera2026indexnowkey7890123456";
const DEFAULT_HOST = process.env.PUBLIC_HOST ?? "www.artdera.com";

// Key verification endpoint — crawlers (Bing, Yandex) fetch this to confirm ownership
indexnowRouter.get("/key.txt", (_req, res) => {
  res.type("text/plain").send(INDEXNOW_KEY);
});

// Submit updated/new URLs to IndexNow (Bing/Yandex) for near-instant indexing
indexnowRouter.post(
  "/submit",
  asyncRoute(async (req, res) => {
    const { urlList, host } = req.body as { urlList?: string[]; host?: string };

    if (!Array.isArray(urlList) || urlList.length === 0) {
      throw new ApiError(400, "INVALID_INPUT", "urlList must be a non-empty array of URL strings.");
    }

    const payload = {
      host: host ?? DEFAULT_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${host ?? DEFAULT_HOST}/api/indexnow/key.txt`,
      urlList,
    };

    try {
      const response = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });

      return ok(res, {
        submittedCount: urlList.length,
        indexnowStatusCode: response.status,
        success: response.ok || response.status === 202,
      });
    } catch (error) {
      return ok(res, {
        submittedCount: urlList.length,
        success: false,
        error: error instanceof Error ? error.message : "IndexNow submit failed",
      });
    }
  }),
);
