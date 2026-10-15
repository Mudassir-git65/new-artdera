import { apiClient } from "./services";
import type {
  ExhibitionLaunchLead,
  ExhibitionLaunchLeadKind,
  ExhibitionLaunchSettings,
} from "./exhibition-launch";
import type {
  ExhibitionArtist,
  ExhibitionDetail,
  ExhibitionLanding,
  ExhibitionWork,
  OnlineExhibition,
} from "./exhibition-types";

export const ExhibitionService = {
  launchRegister: (input: {
    kind: ExhibitionLaunchLeadKind;
    name: string;
    email: string;
    country: string;
    message: string;
    consent: true;
    artworkId?: string;
  }) => apiClient.post<{ registered: boolean }>("/api/exhibitions/launch/registrations", input),
  launchSettings: () =>
    apiClient.get<ExhibitionLaunchSettings>("/api/admin/exhibitions/launch-settings"),
  saveLaunchSettings: (input: ExhibitionLaunchSettings) =>
    apiClient.patch<ExhibitionLaunchSettings>("/api/admin/exhibitions/launch-settings", input),
  launchLeads: () =>
    apiClient.get<{ items: ExhibitionLaunchLead[]; total: number }>(
      "/api/admin/exhibitions/launch-registrations",
    ),
  landing: () => apiClient.get<ExhibitionLanding>("/api/exhibitions"),
  detail: (slug: string) =>
    apiClient.get<ExhibitionDetail>(`/api/exhibitions/${encodeURIComponent(slug)}`),
  register: (
    slug: string,
    input: {
      kind: "preview" | "enquiry";
      name: string;
      email: string;
      country: string;
      message: string;
      consent: true;
      artworkId?: string;
    },
  ) =>
    apiClient.post<{ registered: boolean }>(
      `/api/exhibitions/${encodeURIComponent(slug)}/registrations`,
      input,
    ),
  adminList: () => apiClient.get<OnlineExhibition[]>("/api/admin/exhibitions"),
  adminDetail: (id: string) => apiClient.get<ExhibitionDetail>(`/api/admin/exhibitions/${id}`),
  save: (id: string | undefined, input: Omit<OnlineExhibition, "id">) =>
    id
      ? apiClient.patch<OnlineExhibition>(`/api/admin/exhibitions/${id}`, input)
      : apiClient.post<OnlineExhibition>("/api/admin/exhibitions", input),
  candidates: (query = "") =>
    apiClient.get<{ artworks: ExhibitionWork[]; artists: ExhibitionArtist[] }>(
      `/api/admin/exhibitions/candidates?q=${encodeURIComponent(query)}`,
    ),
  availability: (id: string, artworkId: string, availability: string) =>
    apiClient.patch<{ updated: boolean }>(
      `/api/admin/exhibitions/${id}/artworks/${artworkId}/availability`,
      { availability },
    ),
  registrations: (id: string) =>
    apiClient.get<{
      items: Array<{
        id: string;
        kind: string;
        name: string;
        email: string;
        country: string;
        message: string;
        artworkTitle: string;
        createdAt: string;
      }>;
      total: number;
    }>(`/api/admin/exhibitions/${id}/registrations`),
};
