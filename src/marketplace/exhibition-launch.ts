import type { ExhibitionDetail } from "./exhibition-types";

export const EXHIBITION_LAUNCH_START = "2026-11-24T00:00:00+05:00";
export const EXHIBITION_LAUNCH_SLUG = "artdera-online-exhibition-2026";
export const EXHIBITION_LAUNCH_TITLE = "ArtDera Online Exhibition 2026";
export const EXHIBITION_LAUNCH_SETTING = "exhibition-launch-2026";

export interface ExhibitionLaunchSettings {
  exhibitionSlug: string;
  heroVideoUrl: string;
  trailerVideoUrl: string;
  trailerPosterUrl: string;
  advisorWhatsapp: string;
}
export interface ExhibitionLaunch {
  detail: ExhibitionDetail;
  curated: boolean;
  settings: ExhibitionLaunchSettings;
  serverNow: number;
}
export type ExhibitionLaunchLeadKind = "early-access" | "notify" | "preview" | "enquiry";
export interface ExhibitionLaunchLead {
  id: string;
  kind: ExhibitionLaunchLeadKind;
  name: string;
  email: string;
  country: string;
  message: string;
  artworkTitle: string;
  createdAt: string;
}
export const DEFAULT_LAUNCH_SETTINGS: ExhibitionLaunchSettings = {
  exhibitionSlug: EXHIBITION_LAUNCH_SLUG,
  heroVideoUrl: "",
  trailerVideoUrl: "/hero.mp4",
  trailerPosterUrl: "",
  advisorWhatsapp: "",
};

export function exhibitionLaunchIsLive(now: number) {
  return now >= Date.parse(EXHIBITION_LAUNCH_START);
}
export function launchCountdownParts(now: number) {
  const remaining = Math.max(0, Math.floor((Date.parse(EXHIBITION_LAUNCH_START) - now) / 1000));
  return [
    Math.floor(remaining / 86400),
    Math.floor(remaining / 3600) % 24,
    Math.floor(remaining / 60) % 60,
    remaining % 60,
  ];
}
