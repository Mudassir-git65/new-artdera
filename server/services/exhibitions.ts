import { ArtworkModel, ArtistProfileModel, ExhibitionModel, StoreModel } from "../models";
import { publicArtwork, publicAssetUrl } from "../lib/serializers";
import { publicStoreFilter } from "./catalog";
import {
  exhibitionPhase,
  type ExhibitionDetail,
  type ExhibitionLanding,
  type OnlineExhibition,
} from "../../src/marketplace/exhibition-types";

export const visibleExhibitionFilter = {
  isPublished: true,
  isDemo: { $ne: true },
  type: { $in: ["online", "hybrid"] },
  status: { $in: ["scheduled", "active", "completed"] },
  startAt: { $type: "date" },
  endAt: { $type: "date" },
};
export const exhibitionArtworkFilter = {
  status: { $in: ["published", "reserved", "sold"] },
  moderationStatus: "approved",
  isDemo: { $ne: true },
};
const date = (value: any) => value?.toISOString?.() ?? value ?? "";

export function serializeOnlineExhibition(item: Record<string, any>): OnlineExhibition {
  return {
    id: String(item._id),
    name: item.name,
    slug: item.slug,
    theme: item.theme ?? "",
    timezone: item.timezone ?? "Asia/Karachi",
    edition: item.edition ?? "",
    description: item.description ?? "",
    coverImageUrl: String(publicAssetUrl(item.coverImageUrl) ?? ""),
    storyImageUrl: String(publicAssetUrl(item.storyImageUrl) ?? ""),
    curatorName: item.curatorName ?? "",
    curatorNote: item.curatorNote ?? "",
    startAt: date(item.startAt),
    endAt: date(item.endAt),
    status: item.status,
    isPublished: Boolean(item.isPublished),
    advisorWhatsapp: item.advisorWhatsapp ?? "",
    previewEnabled: item.previewEnabled !== false,
    previewNote: item.previewNote ?? "",
    artistIds: (item.artistIds ?? []).map(String),
    artworkIds: (item.artworkIds ?? []).map(String),
    rooms: (item.rooms ?? []).map((room: any) => ({
      key: room.key,
      name: room.name,
      description: room.description ?? "",
      artworkIds: (room.artworkIds ?? []).map(String),
    })),
    events: (item.events ?? []).map((event: any) => ({
      title: event.title,
      description: event.description ?? "",
      startAt: date(event.startAt),
      endAt: date(event.endAt),
      timezone: event.timezone ?? "UTC",
      url: event.url ?? "",
    })),
  };
}

export async function exhibitionDetail(item: Record<string, any>): Promise<ExhibitionDetail> {
  // Publication and moderation checks also apply to works already selected by a curator.
  const rows = await ArtworkModel.find({
    ...exhibitionArtworkFilter,
    _id: { $in: item.artworkIds ?? [] },
  })
    .populate("artistId", "fullName")
    .lean();
  const stores = await StoreModel.find({
    ...publicStoreFilter,
    $or: [
      { _id: { $in: rows.map((work) => work.storeId) } },
      { ownerId: { $in: item.artistIds ?? [] } },
    ],
  })
    .select("ownerId slug name logoUrl shortDescription city country")
    .lean();
  const storeMap = new Map(stores.map((store) => [String(store._id), store]));
  const workMap = new Map(rows.map((work) => [String(work._id), work]));
  const artworks = (item.artworkIds ?? []).map(String).flatMap((id: string) => {
    const work = workMap.get(id);
    if (!work) return [];
    const store = storeMap.get(String(work.storeId));
    if (!store) return [];
    return [
      {
        ...publicArtwork(work),
        creatorSlug: store!.slug,
        availability: (work.status === "sold" || work.quantity <= 0
          ? "Sold"
          : work.status === "reserved"
            ? "Reserved"
            : "Available") as "Available" | "Reserved" | "Sold",
      },
    ];
  });
  const artists = await ArtistProfileModel.find({ userId: { $in: item.artistIds ?? [] } }).lean();
  const profileMap = new Map(artists.map((artist) => [String(artist.userId), artist]));
  const ownerMap = new Map(stores.map((store) => [String(store.ownerId), store]));
  return {
    exhibition: serializeOnlineExhibition(item),
    artworks,
    artists: (item.artistIds ?? []).map(String).flatMap((id: string) => {
      const store = ownerMap.get(id);
      if (!store) return [];
      const profile = profileMap.get(id);
      return [
        {
          id,
          name: profile?.displayName || store.name,
          slug: store.slug,
          bio: profile?.fullBio || profile?.shortBio || store.shortDescription || "",
          image: publicAssetUrl(profile?.profileImageUrl || store.logoUrl) || "",
          location: [profile?.city || store.city, profile?.country || store.country]
            .filter(Boolean)
            .join(", "),
        },
      ];
    }),
  };
}

export async function readExhibition(slug: string) {
  const item = await ExhibitionModel.findOne({ ...visibleExhibitionFilter, slug }).lean();
  return item ? exhibitionDetail(item) : null;
}

export async function readExhibitionLanding(): Promise<ExhibitionLanding> {
  const { readExhibitionLaunch } = await import("./exhibition-launch");
  const items = await ExhibitionModel.find(visibleExhibitionFilter)
    .sort({ startAt: -1 })
    .limit(100)
    .lean();
  const exhibitions = items.map(serializeOnlineExhibition);
  const now = Date.now();
  const selected =
    exhibitions.find((item) => exhibitionPhase(item, now) === "live") ??
    [...exhibitions].reverse().find((item) => exhibitionPhase(item, now) === "upcoming") ??
    exhibitions[0];
  return {
    exhibitions,
    launch: await readExhibitionLaunch(),
    featured: selected
      ? await exhibitionDetail(items.find((item) => String(item._id) === selected.id)!)
      : null,
  };
}
