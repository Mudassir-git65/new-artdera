import { AnalyticsEventModel, ArtworkModel, StoreModel } from "../models";

// In-memory cache for recent visits to prevent duplicate view increments within 15 minutes
const recentVisits = new Map<string, number>();
const DEDUP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getVisitorKey(req: any): string {
  const userId = req.auth?.user?._id ? String(req.auth.user._id) : "";
  const ip =
    (typeof req.headers?.["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]
      : req.socket?.remoteAddress) || "unknown_ip";
  return userId ? `user:${userId}` : `ip:${ip}`;
}

export async function trackStoreView(storeId: any, req: any) {
  if (!storeId) return;
  const visitorKey = getVisitorKey(req);
  const cacheKey = `store:${String(storeId)}:${visitorKey}`;
  const now = Date.now();
  const lastVisit = recentVisits.get(cacheKey);

  if (lastVisit && now - lastVisit < DEDUP_WINDOW_MS) {
    // Duplicate visit within window, do not increment
    return;
  }

  recentVisits.set(cacheKey, now);

  try {
    await StoreModel.updateOne({ _id: storeId }, { $inc: { totalViews: 1 } });
    await AnalyticsEventModel.create({
      storeId,
      type: "store_view",
      count: 1,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("Error tracking store view:", err);
  }
}

export async function trackArtworkView(artwork: any, req: any) {
  if (!artwork || !artwork._id) return;
  const visitorKey = getVisitorKey(req);
  const cacheKey = `artwork:${String(artwork._id)}:${visitorKey}`;
  const now = Date.now();
  const lastVisit = recentVisits.get(cacheKey);

  if (lastVisit && now - lastVisit < DEDUP_WINDOW_MS) {
    // Duplicate visit within window, do not increment
    return;
  }

  recentVisits.set(cacheKey, now);

  try {
    await ArtworkModel.updateOne({ _id: artwork._id }, { $inc: { views: 1 } });
    if (artwork.storeId) {
      await AnalyticsEventModel.create({
        storeId: artwork.storeId,
        artworkId: artwork._id,
        type: "artwork_view",
        count: 1,
        createdAt: new Date(),
      });
    }
  } catch (err) {
    console.error("Error tracking artwork view:", err);
  }
}

export async function trackWishlistSave(storeId: any, artworkId: any, userId: any) {
  if (!artworkId) return;
  try {
    if (storeId) {
      await AnalyticsEventModel.create({
        storeId,
        artworkId,
        userId,
        type: "save",
        count: 1,
        createdAt: new Date(),
      });
    }
  } catch (err) {
    console.error("Error tracking wishlist save:", err);
  }
}
