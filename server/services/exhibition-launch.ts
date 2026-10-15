import { ArtworkModel, ExhibitionModel, StoreModel, SystemSettingModel } from "../models";
import { exhibitionDetail, visibleExhibitionFilter } from "./exhibitions";
import { publicArtworkFilter, publicStoreFilter } from "./catalog";
import {
  DEFAULT_LAUNCH_SETTINGS,
  EXHIBITION_LAUNCH_SETTING,
  EXHIBITION_LAUNCH_SLUG,
  EXHIBITION_LAUNCH_START,
  EXHIBITION_LAUNCH_TITLE,
  type ExhibitionLaunch,
  type ExhibitionLaunchSettings,
} from "../../src/marketplace/exhibition-launch";

export async function readLaunchSettings(): Promise<ExhibitionLaunchSettings> {
  const setting = await SystemSettingModel.findOne({ key: EXHIBITION_LAUNCH_SETTING }).lean();
  // Return only the five public campaign fields, never unrelated system settings.
  return Object.fromEntries(
    Object.entries(DEFAULT_LAUNCH_SETTINGS).map(([key, fallback]) => [
      key,
      typeof setting?.value?.[key] === "string" ? setting.value[key] : fallback,
    ]),
  ) as unknown as ExhibitionLaunchSettings;
}

export async function readExhibitionLaunch(): Promise<ExhibitionLaunch> {
  const settings = await readLaunchSettings();
  const exhibition = await ExhibitionModel.findOne({
    ...visibleExhibitionFilter,
    slug: settings.exhibitionSlug,
  }).lean();
  let detail;
  if (exhibition) {
    detail = await exhibitionDetail(exhibition);
  } else {
    const stores = await StoreModel.find(publicStoreFilter).select("_id ownerId").lean();
    const works = await ArtworkModel.find({
      ...publicArtworkFilter,
      storeId: { $in: stores.map((store) => store._id) },
    })
      .sort({ isSponsored: -1, createdAt: -1, _id: -1 })
      .limit(8)
      .select("_id storeId")
      .lean();
    const selectedStores = stores.filter((store) =>
      works.some((work) => String(work.storeId) === String(store._id)),
    );
    detail = await exhibitionDetail({
      _id: "launch-2026",
      slug: EXHIBITION_LAUNCH_SLUG,
      name: EXHIBITION_LAUNCH_TITLE,
      theme: "Discover Pakistan's Artists. Collect From Anywhere.",
      timezone: "Asia/Karachi",
      description:
        "An invitation to discover the artists, ideas and original works shaping Pakistan’s creative landscape. A meeting place for independent voices and collectors around the world.",
      curatorNote:
        "Art can carry a place, a memory, a way of seeing. This exhibition brings Pakistan’s creative voices into a shared space — inviting a closer encounter with the work and the people behind it.\n\nOur aim is simple: to give each artwork room to speak, and each artist the opportunity to be discovered beyond borders. Take your time. Look closely. Find the work that stays with you.",
      curatorName: "ArtDera Curatorial Team",
      startAt: EXHIBITION_LAUNCH_START,
      endAt: "",
      status: "scheduled",
      isPublished: false,
      artistIds: [...new Set(selectedStores.map((store) => String(store.ownerId)))],
      artworkIds: works.map((work) => work._id),
      previewEnabled: true,
      rooms: [],
      events: [],
    });
  }
  return {
    detail,
    curated: Boolean(exhibition),
    settings: {
      ...settings,
      advisorWhatsapp: settings.advisorWhatsapp || detail.exhibition.advisorWhatsapp,
    },
    serverNow: Date.now(),
  };
}
