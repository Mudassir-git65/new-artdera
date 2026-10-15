import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ExhibitionService } from "./exhibition-service";
import {
  DEFAULT_LAUNCH_SETTINGS,
  EXHIBITION_LAUNCH_SLUG,
  type ExhibitionLaunchLead,
  type ExhibitionLaunchSettings,
} from "./exhibition-launch";
import type { OnlineExhibition } from "./exhibition-types";

export function AdminExhibitionLaunch({ exhibitions }: { exhibitions: OnlineExhibition[] }) {
  const [settings, setSettings] = useState<ExhibitionLaunchSettings>(DEFAULT_LAUNCH_SETTINGS);
  const [leads, setLeads] = useState<ExhibitionLaunchLead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true);
    const [config, requests] = await Promise.all([
      ExhibitionService.launchSettings(),
      ExhibitionService.launchLeads(),
    ]);
    if (config.data) setSettings(config.data);
    if (requests.data) {
      setLeads(requests.data.items);
      setTotal(requests.data.total);
    }
    setError(config.error?.message || requests.error?.message || "");
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const result = await ExhibitionService.saveLaunchSettings(settings);
    setSaving(false);
    if (result.error)
      setError(
        [result.error.message, ...Object.values(result.error.fieldErrors ?? {}).flat()].join(" · "),
      );
    else toast.success("2026 launch settings saved");
  }
  function exportLeads() {
    const rows = [
      ["Name", "Email", "Interest", "Country", "Artwork", "Message", "Registered"],
      ...leads.map((lead) => [
        lead.name,
        lead.email,
        lead.kind,
        lead.country,
        lead.artworkTitle,
        lead.message,
        lead.createdAt,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "artdera-exhibition-2026-launch-registrations.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  const inputClass = "mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm";
  return (
    <section className="rounded-xl border bg-[var(--porcelain)] p-5 sm:p-7">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <div className="eyebrow">Opening 24 November 2026 · 00:00 Pakistan time</div>
          <h2 className="mt-2 font-display text-3xl">The 2026 launch campaign</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Manage the cinematic landing page and registrations before the exhibition opens.
          </p>
        </div>
        <a href="/exhibition" target="_blank" rel="noreferrer" className="btn-ghost h-fit">
          View landing page <ArrowUpRight size={14} />
        </a>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="mt-5 text-sm">
          Loading campaign settings…
        </p>
      ) : (
        <>
          <details className="mt-6 border-t pt-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Campaign artwork, trailer & advisor settings
            </summary>
            <form onSubmit={save} className="mt-5 space-y-5">
              <label className="block text-xs font-semibold">
                Curated exhibition to feature
                <select
                  className={inputClass}
                  value={settings.exhibitionSlug}
                  onChange={(e) => setSettings({ ...settings, exhibitionSlug: e.target.value })}
                >
                  <option value={EXHIBITION_LAUNCH_SLUG}>
                    ArtDera Online Exhibition 2026 (publish this exhibition to curate the launch)
                  </option>
                  {exhibitions
                    .filter((item) => item.slug !== EXHIBITION_LAUNCH_SLUG)
                    .map((item) => (
                      <option key={item.id} value={item.slug}>
                        {item.name} · {item.isPublished ? "Published" : "Draft"}
                      </option>
                    ))}
                </select>
              </label>
              <p className="text-xs text-muted-foreground">
                The landing page opens automatically on 24 November. Until a selected exhibition is
                published, it previews real public ArtDera works and saves collector registrations.
                Create and publish the 2026 exhibition below to choose its participating artists and
                works.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {(
                  [
                    ["heroVideoUrl", "Hero video URL (optional)"],
                    ["trailerVideoUrl", "Exhibition trailer video URL"],
                    ["trailerPosterUrl", "Trailer poster image URL"],
                    ["advisorWhatsapp", "ArtDera advisor WhatsApp number"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-xs font-semibold">
                    {label}
                    <input
                      className={inputClass}
                      maxLength={1000}
                      value={settings[key]}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Use HTTPS videos or ArtDera upload paths. The existing ArtDera film is available at
                /hero.mp4; replace it with the final exhibition trailer here. Use country code and
                digits only for the official advisor number.
              </p>
              <button className="btn-primary" disabled={saving}>
                {saving && <Loader2 className="animate-spin" size={15} />} Save launch settings
              </button>
            </form>
          </details>
          <details className="mt-5 border-t pt-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Launch registrations ({total})
            </summary>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="btn-ghost" onClick={() => void load()}>
                Refresh requests
              </button>
              <button className="btn-ghost" disabled={!leads.length} onClick={exportLeads}>
                <Download size={14} /> Export CSV
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Early access, Notify Me, private previews and artwork enquiries are saved here. The
              ArtDera team follows up manually; forms do not send automated emails.
            </p>
            <div className="mt-5 space-y-3">
              {leads.map((lead) => (
                <article key={lead.id} className="rounded-lg border p-4 text-sm">
                  <div className="flex flex-wrap justify-between gap-3">
                    <strong>{lead.name || "Exhibition subscriber"}</strong>
                    <span className="text-xs text-muted-foreground">
                      {lead.kind} · {new Date(lead.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <a href={`mailto:${lead.email}`} className="mt-1 block underline">
                    {lead.email}
                  </a>
                  {(lead.country || lead.artworkTitle) && (
                    <p className="mt-2 text-xs">
                      {[lead.country, lead.artworkTitle].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {lead.message && (
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{lead.message}</p>
                  )}
                </article>
              ))}
              {!leads.length && (
                <p className="text-sm text-muted-foreground">
                  Opening-list and private preview registrations will appear here.
                </p>
              )}
              {total > leads.length && (
                <p className="text-xs">
                  Showing the latest {leads.length} of {total} requests.
                </p>
              )}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
