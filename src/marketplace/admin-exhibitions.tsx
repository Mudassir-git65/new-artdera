import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  Download,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ExhibitionService } from "./exhibition-service";
import { AdminExhibitionLaunch } from "./admin-exhibition-launch";
import {
  DEFAULT_EXHIBITION_ROOMS,
  type ExhibitionArtist,
  type ExhibitionEvent,
  type ExhibitionWork,
  type OnlineExhibition,
} from "./exhibition-types";
import { formatPKR } from "./config";

type ExhibitionInput = Omit<OnlineExhibition, "id">;
function newExhibition(): ExhibitionInput {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setMinutes(0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return {
    name: "",
    slug: "",
    theme: "",
    timezone: "Asia/Karachi",
    edition: "",
    description: "",
    coverImageUrl: "",
    storyImageUrl: "",
    curatorName: "",
    curatorNote: "",
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    status: "draft",
    isPublished: false,
    advisorWhatsapp: "",
    previewEnabled: true,
    previewNote: "",
    artistIds: [],
    artworkIds: [],
    rooms: DEFAULT_EXHIBITION_ROOMS.map((room) => ({ ...room, artworkIds: [] })),
    events: [],
  };
}
const fieldClass =
  "w-full rounded-lg border bg-[var(--porcelain)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oxblood)]";
function localDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AdminExhibitions() {
  const [items, setItems] = useState<OnlineExhibition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<OnlineExhibition | "new" | null>(null);
  async function load() {
    setLoading(true);
    const result = await ExhibitionService.adminList();
    setLoading(false);
    if (result.error) setError(result.error.message);
    else {
      setItems(result.data ?? []);
      setError("");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  if (editing)
    return (
      <ExhibitionEditor
        key={editing === "new" ? "new" : editing.id}
        initial={editing === "new" ? undefined : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
    );
  return (
    <div className="space-y-5">
      <AdminExhibitionLaunch exhibitions={items} />
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-[var(--porcelain)] p-6">
        <div>
          <h2 className="font-display text-2xl">Online viewing rooms</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Curate exhibitions, schedule openings and manage collector requests.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing("new")}>
          <Plus size={16} /> Create exhibition
        </button>
      </div>
      {loading ? (
        <p role="status">Loading exhibitions…</p>
      ) : error ? (
        <div role="alert">
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : !items.length ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h3 className="font-display text-3xl">Your next exhibition starts here.</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Create a draft, select artists and artworks, then publish when your collection is ready.
          </p>
        </div>
      ) : (
        items.map((item) => (
          <article
            key={item.id}
            className="flex flex-wrap items-center gap-5 rounded-xl border bg-[var(--porcelain)] p-5"
          >
            {item.coverImageUrl && (
              <img src={item.coverImageUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="eyebrow">
                {item.isPublished ? "Published" : "Unpublished"} · {item.status}
              </div>
              <h3 className="mt-1 font-display text-2xl">{item.name}</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(item.startAt).toLocaleDateString()} —{" "}
                {new Date(item.endAt).toLocaleDateString()} · {item.artworkIds.length} works ·{" "}
                {item.artistIds.length} artists
              </p>
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost" onClick={() => setEditing(item)}>
                Manage
              </button>
              {item.isPublished && (
                <a
                  className="btn-ghost"
                  href={`/exhibition/${item.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View <ArrowUpRight size={14} />
                </a>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function ExhibitionEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial?: OnlineExhibition;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ExhibitionInput>(() =>
    initial ? (({ id: _id, ...rest }) => rest)(initial) : newExhibition(),
  );
  const [works, setWorks] = useState<Record<string, ExhibitionWork>>({});
  const [artists, setArtists] = useState<ExhibitionArtist[]>([]);
  const [candidates, setCandidates] = useState<ExhibitionWork[]>([]);
  const [query, setQuery] = useState("");
  const [artistQuery, setArtistQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingWorks, setLoadingWorks] = useState(true);
  const [changing, setChanging] = useState("");
  const [error, setError] = useState("");
  const [requests, setRequests] =
    useState<Awaited<ReturnType<typeof ExhibitionService.registrations>>["data"]>();
  const [requestsError, setRequestsError] = useState("");
  const [detailReady, setDetailReady] = useState(!initial);
  function update<K extends keyof ExhibitionInput>(key: K, value: ExhibitionInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  useEffect(() => {
    if (!initial) return;
    let active = true;
    void ExhibitionService.adminDetail(initial.id).then((result) => {
      if (!active) return;
      if (result.error) {
        setError(result.error.message);
        return;
      }
      const { id: _id, ...data } = result.data!.exhibition;
      setForm(data);
      setWorks(Object.fromEntries(result.data!.artworks.map((work) => [work.id, work])));
      setDetailReady(true);
    });
    void ExhibitionService.registrations(initial.id).then((result) => {
      if (active) {
        setRequests(result.data);
        setRequestsError(result.error?.message ?? "");
      }
    });
    return () => {
      active = false;
    };
  }, [initial]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoadingWorks(true);
      void ExhibitionService.candidates(query).then((result) => {
        if (!active) return;
        setLoadingWorks(false);
        if (result.error) {
          setError(result.error.message);
          return;
        }
        setCandidates(result.data!.artworks);
        setArtists(result.data!.artists);
        setWorks((current) => ({
          ...current,
          ...Object.fromEntries(result.data!.artworks.map((work) => [work.id, work])),
        }));
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await ExhibitionService.save(initial?.id, form);
    setBusy(false);
    if (result.error) {
      const details = Object.entries(result.error.fieldErrors ?? {}).flatMap(([field, messages]) =>
        messages.map((message) => `${field}: ${message}`),
      );
      setError([result.error.message, ...details].join(" · "));
      return;
    }
    toast.success("Exhibition saved");
    onSaved();
  }
  function toggleWork(id: string) {
    const selected = form.artworkIds.includes(id);
    setForm((current) => ({
      ...current,
      artworkIds: selected
        ? current.artworkIds.filter((value) => value !== id)
        : [...current.artworkIds, id],
      rooms: selected
        ? current.rooms.map((room) => ({
            ...room,
            artworkIds: room.artworkIds.filter((value) => value !== id),
          }))
        : current.rooms,
    }));
  }
  function reorder(index: number, direction: number) {
    const ids = [...form.artworkIds];
    const next = index + direction;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    update("artworkIds", ids);
  }
  async function changeAvailability(work: ExhibitionWork, value: string) {
    if (!initial) return;
    setChanging(work.id);
    const result = await ExhibitionService.availability(initial.id, work.id, value);
    setChanging("");
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    setWorks((current) => ({
      ...current,
      [work.id]: { ...work, availability: value as ExhibitionWork["availability"] },
    }));
    toast.success("Marketplace availability updated");
  }
  function exportRequests() {
    const rows = [
      ["Name", "Email", "Type", "Country", "Artwork", "Message", "Received"],
      ...(requests?.items ?? []).map((item) => [
        item.name,
        item.email,
        item.kind,
        item.country,
        item.artworkTitle,
        item.message,
        item.createdAt,
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
    link.download = `${form.slug || "exhibition"}-collector-requests.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const input = (
    key: keyof ExhibitionInput,
    label: string,
    type = "text",
    required = false,
    hint = "",
  ) => (
    <label className="block text-xs font-semibold">
      {label}
      <input
        className={`${fieldClass} mt-2`}
        type={type}
        value={String(form[key])}
        required={required}
        maxLength={key === "name" ? 180 : 1000}
        onChange={(e) => update(key, e.target.value as never)}
      />
      {hint && <span className="mt-1 block font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
  const area = (key: "description" | "curatorNote" | "previewNote", label: string) => (
    <label className="block text-xs font-semibold">
      {label}
      <textarea
        className={`${fieldClass} mt-2 min-h-28`}
        maxLength={key === "curatorNote" ? 10000 : key === "description" ? 5000 : 1000}
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
      />
    </label>
  );
  const panel = "space-y-5 rounded-xl border bg-[var(--porcelain)] p-5 sm:p-7";
  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={onClose}>
          ← All exhibitions
        </button>
        <button className="btn-primary" disabled={busy || !detailReady}>
          {busy && <Loader2 className="animate-spin" size={16} />} Save exhibition
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <section className={panel}>
        <h2 className="font-display text-2xl">Exhibition identity</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {input("name", "Exhibition title", "text", true)}
          {input("slug", "Exhibition URL", "text", true, "/exhibition/your-exhibition-slug")}
          {input("theme", "Theme / subtitle")}
          {input("edition", "Edition label")}
        </div>
        {area("description", "Introduction")}
        <div className="grid gap-5 sm:grid-cols-2">
          {input(
            "coverImageUrl",
            "Hero image URL",
            "text",
            false,
            "HTTPS image or /api/uploads/…/content. Leave empty to use the first artwork.",
          )}
          {input("storyImageUrl", "Story image URL")}
        </div>
        {(form.coverImageUrl ||
          (form.artworkIds[0] && works[form.artworkIds[0]]?.images[0]?.url)) && (
          <img
            className="max-h-64 w-full rounded-lg bg-[var(--ink)] object-contain"
            src={form.coverImageUrl || works[form.artworkIds[0]]?.images[0]?.url}
            alt="Exhibition cover preview"
          />
        )}
      </section>
      <section className={panel}>
        <h2 className="font-display text-2xl">Schedule & publication</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {(["startAt", "endAt"] as const).map((key) => (
            <label key={key} className="text-xs font-semibold">
              {key === "startAt" ? "Opens" : "Closes"} (your local time)
              <input
                type="datetime-local"
                className={`${fieldClass} mt-2`}
                required
                value={localDate(form[key])}
                onChange={(e) => {
                  if (e.target.value) update(key, new Date(e.target.value).toISOString());
                }}
              />
            </label>
          ))}
          <label className="text-xs font-semibold">
            Editorial status
            <select
              className={`${fieldClass} mt-2`}
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
            >
              {["draft", "scheduled", "active", "completed", "cancelled"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => update("isPublished", e.target.checked)}
            />{" "}
            Publish online
          </label>
        </div>
        {input(
          "timezone",
          "Exhibition display time zone",
          "text",
          true,
          "IANA time zone, e.g. Asia/Karachi or Europe/London",
        )}
        <p className="text-xs text-muted-foreground">
          Dates automatically control the opening and closing countdowns. Scheduled exhibitions are
          visible before opening; purchasing starts when the exhibition opens. Unpublish to remove
          an exhibition from public view.
        </p>
      </section>
      <section className={panel}>
        <h2 className="font-display text-2xl">Participating artists</h2>
        <input
          className={fieldClass}
          placeholder="Search artist names"
          aria-label="Search participating artists"
          value={artistQuery}
          onChange={(e) => setArtistQuery(e.target.value)}
        />
        <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
          {artists
            .filter((artist) => artist.name.toLowerCase().includes(artistQuery.toLowerCase()))
            .map((artist) => (
              <label
                key={artist.id}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.artistIds.includes(artist.id)}
                  onChange={(e) =>
                    update(
                      "artistIds",
                      e.target.checked
                        ? [...form.artistIds, artist.id]
                        : form.artistIds.filter((id) => id !== artist.id),
                    )
                  }
                />
                {artist.image && (
                  <img src={artist.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                )}
                <span>{artist.name}</span>
              </label>
            ))}
        </div>
        {form.artistIds
          .filter((id) => !artists.some((artist) => artist.id === id))
          .map((id) => (
            <div
              key={id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3 text-xs"
            >
              <span>Selected artist is no longer publicly available.</span>
              <button
                type="button"
                className="underline"
                onClick={() =>
                  update(
                    "artistIds",
                    form.artistIds.filter((value) => value !== id),
                  )
                }
              >
                Remove selection
              </button>
            </div>
          ))}
        <p className="text-xs text-muted-foreground">
          Photos, bios and profile links come from each artist’s existing public profile.
        </p>
      </section>
      <section className={panel}>
        <h2 className="font-display text-2xl">Curated artworks</h2>
        <div className="relative">
          <Search className="absolute left-3 top-3" size={16} />
          <input
            className={`${fieldClass} pl-10`}
            placeholder="Search title or medium"
            aria-label="Search artworks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {loadingWorks ? (
          <p role="status" className="text-sm">
            Loading artworks…
          </p>
        ) : (
          <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
            {candidates.map((work) => (
              <button
                type="button"
                key={work.id}
                aria-pressed={form.artworkIds.includes(work.id)}
                onClick={() => toggleWork(work.id)}
                className="flex items-center gap-3 rounded-lg border p-3 text-left text-sm"
              >
                {work.images[0] && (
                  <img className="h-12 w-12 object-contain" src={work.images[0].url} alt="" />
                )}
                <span className="flex-1">
                  <span className="block font-semibold">{work.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {work.creatorName} · {formatPKR(work.discountPrice ?? work.price)}
                  </span>
                </span>
                {form.artworkIds.includes(work.id) ? <Check size={17} /> : <Plus size={17} />}
              </button>
            ))}
            {!candidates.length && (
              <p className="text-sm">No approved artworks found. Try a different search.</p>
            )}
          </div>
        )}
        <div className="space-y-2 border-t pt-5">
          <p className="text-xs font-semibold">Display order · {form.artworkIds.length} selected</p>
          {form.artworkIds.map((id, index) => {
            const work = works[id];
            return (
              <div
                key={id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--ivory)] p-3 text-xs"
              >
                <span className="flex-1">
                  {index + 1}. {work?.title ?? "Artwork unavailable — remove this selection"}
                </span>
                <button
                  type="button"
                  className="p-2"
                  aria-label={`Move ${work?.title ?? "artwork"} up`}
                  disabled={index === 0}
                  onClick={() => reorder(index, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="p-2"
                  aria-label={`Move ${work?.title ?? "artwork"} down`}
                  disabled={index === form.artworkIds.length - 1}
                  onClick={() => reorder(index, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                {work && initial?.artworkIds.includes(id) && (
                  <select
                    aria-label={`Availability of ${work.title}`}
                    className="rounded border bg-white p-2"
                    value={work.availability}
                    disabled={changing === id}
                    onChange={(e) => void changeAvailability(work, e.target.value)}
                  >
                    {["Available", "Reserved", "Sold"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="p-2"
                  aria-label={`Remove ${work?.title ?? "artwork"}`}
                  onClick={() => toggleWork(id)}
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Availability updates are saved immediately across the marketplace. Works with checkout
          reservations or orders are managed through order operations. Save new selections before
          changing their availability.
        </p>
      </section>
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Virtual rooms</h2>
          <button
            type="button"
            className="btn-ghost"
            disabled={form.rooms.length >= 12}
            onClick={() =>
              update("rooms", [
                ...form.rooms,
                { key: `room-${Date.now()}`, name: "New room", description: "", artworkIds: [] },
              ])
            }
          >
            <Plus size={14} /> Add room
          </button>
        </div>
        {form.rooms.map((room, index) => (
          <div key={room.key} className="space-y-3 rounded-lg border p-4">
            <div className="flex gap-2">
              <input
                className={fieldClass}
                aria-label={`Room ${index + 1} name`}
                required
                value={room.name}
                onChange={(e) =>
                  update(
                    "rooms",
                    form.rooms.map((item, i) =>
                      i === index ? { ...item, name: e.target.value } : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                aria-label={`Remove ${room.name}`}
                className="p-2"
                onClick={() =>
                  update(
                    "rooms",
                    form.rooms.filter((_, i) => i !== index),
                  )
                }
              >
                <X size={16} />
              </button>
            </div>
            <input
              className={fieldClass}
              aria-label={`${room.name} description`}
              placeholder="Room introduction"
              value={room.description}
              onChange={(e) =>
                update(
                  "rooms",
                  form.rooms.map((item, i) =>
                    i === index ? { ...item, description: e.target.value } : item,
                  ),
                )
              }
            />
            <div className="flex flex-wrap gap-3">
              {form.artworkIds.map((id) => (
                <label key={id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={room.artworkIds.includes(id)}
                    onChange={(e) =>
                      update(
                        "rooms",
                        form.rooms.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                artworkIds: e.target.checked
                                  ? [...item.artworkIds, id]
                                  : item.artworkIds.filter((value) => value !== id),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  {works[id]?.title ?? id}
                </label>
              ))}
            </div>
            {!room.artworkIds.length && (
              <p className="text-xs text-muted-foreground">
                Assign artworks to this room. The public room displays an empty state until works
                are assigned.
              </p>
            )}
          </div>
        ))}
      </section>
      <section className={panel}>
        <h2 className="font-display text-2xl">Curator’s note</h2>
        {input("curatorName", "Curator / author")}
        {area("curatorNote", "Exhibition story / curator’s note")}
      </section>
      <section className={panel}>
        <h2 className="font-display text-2xl">Private collector preview & advisor</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.previewEnabled}
            onChange={(e) => update("previewEnabled", e.target.checked)}
          />{" "}
          Accept private preview requests
        </label>
        {area("previewNote", "Preview invitation / instructions")}
        {input(
          "advisorWhatsapp",
          "ArtDera advisor WhatsApp number",
          "tel",
          false,
          "Country code + number, digits only (8–15 digits). Use ArtDera’s advisor number.",
        )}
      </section>
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Opening & live sessions</h2>
          <button
            type="button"
            className="btn-ghost"
            disabled={form.events.length >= 20}
            onClick={() =>
              update("events", [
                ...form.events,
                {
                  title: "",
                  description: "",
                  startAt: form.startAt,
                  timezone: "Asia/Karachi",
                  url: "",
                },
              ])
            }
          >
            <Plus size={14} /> Add event
          </button>
        </div>
        {form.events.map((event, index) => (
          <EventFields
            key={index}
            event={event}
            onChange={(value) =>
              update(
                "events",
                form.events.map((item, i) => (i === index ? value : item)),
              )
            }
            onRemove={() =>
              update(
                "events",
                form.events.filter((_, i) => i !== index),
              )
            }
          />
        ))}
      </section>
      {initial && (
        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl">Collector requests ({requests?.total ?? 0})</h2>
            <button
              type="button"
              className="btn-ghost"
              disabled={!requests?.items.length}
              onClick={exportRequests}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
          {requestsError && (
            <p role="alert" className="text-sm text-red-700">
              {requestsError}
            </p>
          )}
          {requests?.items.map((item) => (
            <article key={item.id} className="rounded-lg border p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-3">
                <strong>{item.name}</strong>
                <span className="text-xs text-muted-foreground">
                  {item.kind} · {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
              <a className="mt-1 block underline" href={`mailto:${item.email}`}>
                {item.email}
              </a>
              <p className="mt-2 text-xs">
                {[item.country, item.artworkTitle].filter(Boolean).join(" · ")}
              </p>
              {item.message && (
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{item.message}</p>
              )}
            </article>
          ))}
          {requests && !requests.items.length && (
            <p className="text-sm text-muted-foreground">
              Private preview requests and artwork enquiries will appear here.
            </p>
          )}
          {requests && requests.total > requests.items.length && (
            <p className="text-xs">
              Showing the latest {requests.items.length} of {requests.total} requests.
            </p>
          )}
        </section>
      )}
      <div className="flex justify-end">
        <button disabled={busy || !detailReady} className="btn-primary">
          {busy && <Loader2 className="animate-spin" size={16} />} Save exhibition
        </button>
      </div>
    </form>
  );
}

function EventFields({
  event,
  onChange,
  onRemove,
}: {
  event: ExhibitionEvent;
  onChange: (event: ExhibitionEvent) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex justify-between">
        <h3 className="text-sm font-semibold">Live session</h3>
        <button type="button" aria-label="Remove event" onClick={onRemove}>
          <X size={16} />
        </button>
      </div>
      <input
        className={fieldClass}
        required
        placeholder="Event title"
        aria-label="Event title"
        value={event.title}
        onChange={(e) => onChange({ ...event, title: e.target.value })}
      />
      <textarea
        className={fieldClass}
        placeholder="Session description"
        aria-label="Session description"
        value={event.description}
        onChange={(e) => onChange({ ...event, description: e.target.value })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          Starts (your local time)
          <input
            className={`${fieldClass} mt-2`}
            type="datetime-local"
            required
            value={localDate(event.startAt)}
            onChange={(e) => {
              if (e.target.value)
                onChange({ ...event, startAt: new Date(e.target.value).toISOString() });
            }}
          />
        </label>
        <label className="text-xs">
          Ends (optional)
          <input
            className={`${fieldClass} mt-2`}
            type="datetime-local"
            value={localDate(event.endAt || "")}
            onChange={(e) =>
              onChange({
                ...event,
                endAt: e.target.value ? new Date(e.target.value).toISOString() : "",
              })
            }
          />
        </label>
      </div>
      <input
        className={fieldClass}
        aria-label="Event time zone"
        placeholder="Time zone, e.g. Asia/Karachi"
        value={event.timezone}
        onChange={(e) => onChange({ ...event, timezone: e.target.value })}
      />
      <input
        className={fieldClass}
        type="url"
        aria-label="Live session URL"
        placeholder="https://… live session link (optional)"
        value={event.url}
        onChange={(e) => onChange({ ...event, url: e.target.value })}
      />
    </div>
  );
}
