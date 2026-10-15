import type { Artwork } from "./types";
import type { ExhibitionLaunch } from "./exhibition-launch";

export type ExhibitionPhase = "upcoming" | "live" | "closed";
export type ExhibitionAvailability = "Available" | "Reserved" | "Sold";
export interface ExhibitionRoom {
  key: string;
  name: string;
  description: string;
  artworkIds: string[];
}
export interface ExhibitionEvent {
  title: string;
  description: string;
  startAt: string;
  endAt?: string;
  timezone: string;
  url: string;
}
export interface ExhibitionArtist {
  id: string;
  name: string;
  slug: string;
  bio: string;
  image: string;
  location: string;
}
export interface ExhibitionWork extends Artwork {
  availability: ExhibitionAvailability;
  creatorSlug: string;
}
export interface OnlineExhibition {
  id: string;
  name: string;
  slug: string;
  theme: string;
  timezone: string;
  edition: string;
  description: string;
  coverImageUrl: string;
  storyImageUrl: string;
  curatorName: string;
  curatorNote: string;
  startAt: string;
  endAt: string;
  status: string;
  isPublished: boolean;
  advisorWhatsapp: string;
  previewEnabled: boolean;
  previewNote: string;
  artistIds: string[];
  artworkIds: string[];
  rooms: ExhibitionRoom[];
  events: ExhibitionEvent[];
}
export interface ExhibitionDetail {
  exhibition: OnlineExhibition;
  artworks: ExhibitionWork[];
  artists: ExhibitionArtist[];
}
export interface ExhibitionLanding {
  exhibitions: OnlineExhibition[];
  featured: ExhibitionDetail | null;
  launch: ExhibitionLaunch;
}
export const DEFAULT_EXHIBITION_ROOMS = [
  {
    key: "featured",
    name: "Featured Collection",
    description: "The essential works. A considered introduction to the exhibition.",
    artworkIds: [],
  },
  {
    key: "contemporary",
    name: "Contemporary Art",
    description: "New perspectives, expressed through material, gesture and form.",
    artworkIds: [],
  },
  {
    key: "emerging",
    name: "Emerging Artists",
    description: "Meet the voices shaping what comes next.",
    artworkIds: [],
  },
  {
    key: "collectors",
    name: "Collector’s Selection",
    description: "Distinctive works for a collection with a point of view.",
    artworkIds: [],
  },
] satisfies ExhibitionRoom[];

export function exhibitionPhase(
  exhibition: Pick<OnlineExhibition, "startAt" | "endAt" | "status">,
  now = Date.now(),
): ExhibitionPhase {
  if (exhibition.status === "completed" || now >= new Date(exhibition.endAt).getTime())
    return "closed";
  return now < new Date(exhibition.startAt).getTime() ? "upcoming" : "live";
}
