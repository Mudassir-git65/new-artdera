import { ArtworkModel, PromotionModel } from "../models";

export function mergeSponsoredResults<T>(organic: T[], sponsored: T[], limit: number): T[] {
  if (limit <= 0) return [];
  const result: T[] = [];
  let organicIndex = 0;
  let sponsoredIndex = 0;
  while (
    result.length < limit &&
    (organicIndex < organic.length || sponsoredIndex < sponsored.length)
  ) {
    const positionInBlock = result.length % 5;
    const canPlaceSponsored = positionInBlock === 4 && sponsoredIndex < sponsored.length;
    if (canPlaceSponsored) {
      result.push(sponsored[sponsoredIndex++]);
    } else if (organicIndex < organic.length) {
      result.push(organic[organicIndex++]);
    } else if (
      sponsoredIndex < sponsored.length &&
      result.filter((_, index) => index % 5 === 4).length < Math.ceil(limit / 5)
    ) {
      while (result.length % 5 !== 4 && result.length < limit && organicIndex < organic.length) {
        result.push(organic[organicIndex++]);
      }
      if (result.length % 5 === 4) result.push(sponsored[sponsoredIndex++]);
      else break;
    } else break;
  }
  return result.slice(0, limit);
}

/**
 * Keeps the denormalized Artwork.isSponsored flag aligned with the authoritative
 * promotion window. The promotion collection remains the source of truth used
 * by marketplace queries; this maintenance prevents stale badges in bootstrap
 * and store responses.
 */
export async function refreshPromotionStates(now = new Date()) {
  const [starting, expiring] = await Promise.all([
    PromotionModel.find({
      status: "scheduled",
      startAt: { $lte: now },
      endAt: { $gt: now },
    })
      .select("_id artworkId")
      .lean(),
    PromotionModel.find({
      status: { $in: ["scheduled", "active"] },
      endAt: { $lte: now },
    })
      .select("_id artworkId")
      .lean(),
  ]);

  const startingIds = starting.map((item) => item._id);
  const expiringIds = expiring.map((item) => item._id);
  const expiringArtworkIds = expiring.flatMap((item) => (item.artworkId ? [item.artworkId] : []));

  await Promise.all([
    expiringIds.length
      ? PromotionModel.updateMany({ _id: { $in: expiringIds } }, { $set: { status: "completed" } })
      : Promise.resolve(),
    expiringArtworkIds.length
      ? ArtworkModel.updateMany(
          { _id: { $in: expiringArtworkIds }, promotionId: { $in: expiringIds } },
          { $set: { isSponsored: false }, $unset: { promotionId: 1 } },
        )
      : Promise.resolve(),
  ]);
  await Promise.all([
    startingIds.length
      ? PromotionModel.updateMany({ _id: { $in: startingIds } }, { $set: { status: "active" } })
      : Promise.resolve(),
    ...starting.map((item) =>
      item.artworkId
        ? ArtworkModel.updateOne(
            { _id: item.artworkId },
            { $set: { isSponsored: true, promotionId: item._id } },
          )
        : Promise.resolve(),
    ),
  ]);

  return { activated: startingIds.length, completed: expiringIds.length };
}
