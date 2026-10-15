import { ExhibitionLaunchPage } from "./ExhibitionLaunchPage";
import { ArtworkDetail, RegistrationForm } from "./ArtworkViewer";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Loader2,
  MessageCircle,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExhibitionService } from "@/marketplace/exhibition-service";
import {
  DEFAULT_EXHIBITION_ROOMS,
  exhibitionPhase,
  type ExhibitionDetail,
  type ExhibitionLanding,
  type ExhibitionWork,
  type OnlineExhibition,
} from "@/marketplace/exhibition-types";
import { CartService, NewsletterService } from "@/marketplace/services";
import { useAuth } from "@/marketplace/auth";
import { useCurrency } from "@/marketplace/currency";
import { artworkImageUrl, artworkImageSrcSet } from "@/lib/artwork-image";
import { artworkRouteSlug } from "@/lib/catalog-product";
import { toast } from "sonner";

const phaseLabel = { live: "Now showing", upcoming: "Opening soon", closed: "Past exhibition" };
function dateLabel(value: string, timezone = "Asia/Karachi") {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(value));
}
function useExhibitionClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
async function unwrap<T>(
  request: Promise<{ data?: T; error?: { message: string; code: string } }>,
) {
  const result = await request;
  if (result.error)
    throw Object.assign(new Error(result.error.message), { code: result.error.code });
  return result.data!;
}
export function ExhibitionLandingPage({ initial }: { initial: ExhibitionLanding }) {
  return <ExhibitionLaunchPage initial={initial} />;
}
export function ExhibitionDetailPage({ initial }: { initial: ExhibitionDetail }) {
  const { data, error } = useQuery({
    queryKey: ["exhibition", initial.exhibition.slug],
    queryFn: () => unwrap(ExhibitionService.detail(initial.exhibition.slug)),
    initialData: initial,
    staleTime: 45000,
    refetchInterval: 60000,
  });
  if ((error as { code?: string } | null)?.code === "EXHIBITION_NOT_FOUND")
    return (
      <div className="exhibition-shell ex-empty">
        <div className="eyebrow">Online exhibitions</div>
        <h1>This exhibition is no longer on view.</h1>
        <a className="btn-primary" href="/exhibition">
          Browse exhibitions <ArrowRight size={16} />
        </a>
      </div>
    );
  return <ExhibitionView detail={data} stale={Boolean(error)} />;
}

function ExhibitionView({
  detail,
  exhibitions = [],
  stale = false,
}: {
  detail: ExhibitionDetail;
  exhibitions?: OnlineExhibition[];
  stale?: boolean;
}) {
  const { exhibition: exhibition, artworks, artists } = detail;
  const now = useExhibitionClock();
  const phase = exhibitionPhase(exhibition, now ?? Date.now());
  const [room, setRoom] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const selected = artworks.find((work) => work.id === selectedId);
  const rooms = exhibition.rooms.length ? exhibition.rooms : DEFAULT_EXHIBITION_ROOMS;
  const activeRoom = rooms.find((item) => item.key === room);
  const visibleWorks = activeRoom
    ? artworks.filter((work) => activeRoom.artworkIds.includes(work.id))
    : artworks;
  const cover =
    exhibition.coverImageUrl || artworks[0]?.images[0]?.url || "/images/hero-studio.jpg";
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("exhibition-scroll");
    return () => root.classList.remove("exhibition-scroll");
  }, []);
  const enter = () => {
    document.getElementById("viewing-rooms")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <div className="exhibition-shell">
      <section className="ex-hero" aria-labelledby="exhibition-title">
        <img
          className="ex-hero-image"
          src={artworkImageUrl(cover, 1920)}
          srcSet={artworkImageSrcSet(cover)}
          sizes="100vw"
          alt={
            exhibition.coverImageUrl
              ? `${exhibition.name} exhibition cover`
              : (artworks[0]?.title ?? "An artist’s studio")
          }
          fetchPriority="high"
        />
        <div className="ex-hero-shade" />
        <div className="ex-hero-top">
          <a href="/exhibition">ArtDera / Online exhibitions</a>
          <span className="ex-on-air">
            <i /> {phaseLabel[phase]}
          </span>
        </div>
        <div className="ex-hero-content">
          <p className="ex-kicker">{exhibition.edition || "An ArtDera online exhibition"}</p>
          <h1 id="exhibition-title">{exhibition.name}</h1>
          <p className="ex-hero-theme">{exhibition.theme || "Art. In a different light."}</p>
          <div className="ex-hero-dates">
            {dateLabel(exhibition.startAt, exhibition.timezone)} <span>—</span>{" "}
            {dateLabel(exhibition.endAt, exhibition.timezone)}
            <small className="ex-hero-timezone">
              {exhibition.timezone.replaceAll("_", " ")} time
            </small>
          </div>
          <button className="ex-button ex-button-light" onClick={enter}>
            {phase === "closed" ? "Revisit Exhibition" : "Enter Exhibition"}
            <ArrowDown size={17} />
          </button>
          <div className="ex-hero-countdown">
            <Countdown exhibition={exhibition} now={now} />
          </div>
        </div>
        <div className="ex-hero-bottom">
          <span>A closer look. A deeper connection.</span>
          <div>
            <Globe2 size={14} /> An exhibition without borders
          </div>
        </div>
      </section>
      <div className="ex-timeline">
        <div>
          <span className="ex-kicker">
            {phase === "live"
              ? "On view, for a limited time"
              : phase === "upcoming"
                ? "Your invitation to discover"
                : "The exhibition archive"}
          </span>
          <p>
            {artists.length} artists <span>·</span> {artworks.length} selected works <span>·</span>{" "}
            Online, worldwide
          </p>
        </div>
        <a href="#curator-note" className="ex-text-link">
          The story behind the show <ArrowUpRight size={15} />
        </a>
      </div>
      {stale && (
        <p role="status" className="ex-sync-notice">
          We’re reconnecting to the gallery. Purchases will resume once availability is confirmed.
        </p>
      )}
      <section className="ex-intro ex-container">
        <div className="ex-section-label">
          <span>01 / The exhibition</span>
          <span className="ex-rule" />
        </div>
        <div className="ex-intro-grid">
          <h2>
            Some works ask
            <br />
            you to <em>stay a while.</em>
          </h2>
          <div>
            <p className="ex-intro-copy">
              {exhibition.description ||
                "Step into a considered selection of works from independent artists. Take your time with the details, discover the stories and find the work that speaks to you."}
            </p>
            <a href="#viewing-rooms" className="ex-text-link">
              Explore the viewing rooms <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>
      <section
        id="viewing-rooms"
        className="ex-gallery ex-container"
        aria-labelledby="viewing-room-title"
      >
        <div className="ex-section-label">
          <span>02 / The viewing rooms</span>
          <span className="ex-rule" />
        </div>
        <div className="ex-heading-row">
          <h2 id="viewing-room-title">
            A collection of <em>perspectives.</em>
          </h2>
          <p>Look closely. Find your connection.</p>
        </div>
        <div className="ex-room-tabs" role="group" aria-label="Choose a virtual room">
          <button aria-pressed={room === "all"} onClick={() => setRoom("all")}>
            All works <span>{artworks.length}</span>
          </button>
          {rooms.map((item) => (
            <button
              key={item.key}
              aria-pressed={room === item.key}
              onClick={() => setRoom(item.key)}
            >
              {item.name}
              <span>{artworks.filter((work) => item.artworkIds.includes(work.id)).length}</span>
            </button>
          ))}
        </div>
        <div className="ex-room-description" aria-live="polite">
          <p>
            {activeRoom?.description ||
              "The complete exhibition, curated to be experienced at your own pace."}
          </p>
          <span>{String(visibleWorks.length).padStart(2, "0")} works on view</span>
        </div>
        {visibleWorks.length ? (
          <div className="ex-artwork-grid" key={room}>
            {visibleWorks.map((work, index) => (
              <ArtworkCard
                key={work.id}
                work={work}
                index={index}
                onOpen={() => setSelectedId(work.id)}
              />
            ))}
          </div>
        ) : (
          <div className="ex-room-empty">
            <h3>
              {artworks.length
                ? "A new perspective is taking shape."
                : "The collection is being prepared."}
            </h3>
            <p>
              {artworks.length
                ? "Works for this room will be revealed soon. Explore the complete exhibition in the meantime."
                : "Return soon to discover the selected works."}
            </p>
            {artworks.length > 0 && (
              <button className="ex-text-link" onClick={() => setRoom("all")}>
                View all works <ArrowRight size={15} />
              </button>
            )}
          </div>
        )}
        <div className="ex-gallery-foot">
          <span>Every work has a story. Every collection begins with a connection.</span>
          <span>
            <i className="ex-status-dot" /> Available <i className="ex-status-dot reserved" />{" "}
            Reserved <i className="ex-status-dot sold" /> Sold
          </span>
        </div>
      </section>
      <section id="curator-note" className="ex-story">
        <div className="ex-story-image">
          <img
            src={artworkImageUrl(exhibition.storyImageUrl || cover, 1280)}
            alt={
              exhibition.storyImageUrl ? "Exhibition story" : `${exhibition.name} — a closer look`
            }
            loading="lazy"
          />
        </div>
        <div className="ex-story-content">
          <span className="ex-kicker">03 / Exhibition story</span>
          <h2>
            A note from
            <br />
            <em>the curator.</em>
          </h2>
          <div className="ex-story-note">
            {(
              exhibition.curatorNote ||
              exhibition.description ||
              "Art invites us to pause. This exhibition brings together individual perspectives and gives each work the space to be seen, considered and felt."
            )
              .split(/\n\s*\n/)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>
          <div className="ex-curator-signature">
            <span className="ex-signature-line" />
            <div>
              {exhibition.curatorName || "ArtDera Curatorial Team"}
              <small>Curator, {exhibition.name}</small>
            </div>
          </div>
        </div>
      </section>
      {artists.length > 0 && (
        <section id="exhibition-artists" className="ex-artists ex-container">
          <div className="ex-section-label">
            <span>04 / The artists</span>
            <span className="ex-rule" />
          </div>
          <div className="ex-heading-row">
            <h2>
              The people behind
              <br />
              <em>the perspectives.</em>
            </h2>
            <p>Independent voices. A shared conversation.</p>
          </div>
          <div className="ex-artist-grid">
            {artists.map((artist, index) => (
              <article key={artist.id} className="ex-artist">
                <a href={`/creator/${artist.slug}`} className="ex-artist-portrait">
                  {artist.image ? (
                    <img
                      src={artworkImageUrl(artist.image, 640)}
                      alt={artist.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="ex-artist-monogram">{artist.name.charAt(0)}</div>
                  )}
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </a>
                <span className="ex-kicker">{artist.location || "Participating artist"}</span>
                <h3>
                  <a href={`/creator/${artist.slug}`}>{artist.name}</a>
                </h3>
                <p>{artist.bio || `Discover the practice and selected works of ${artist.name}.`}</p>
                <a className="ex-text-link" href={`/creator/${artist.slug}`}>
                  Meet the artist <ArrowUpRight size={15} />
                </a>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="ex-invitations ex-container">
        <div className="ex-preview">
          <span className="ex-kicker">A personal invitation</span>
          <h2>
            Art is personal.
            <br />
            Your preview <em>should be too.</em>
          </h2>
          <p>
            {exhibition.previewNote ||
              "Spend time with the collection in a private viewing. Share your interests with our team and request a considered introduction to the works."}
          </p>
          {exhibition.previewEnabled && phase !== "closed" ? (
            <button className="ex-button" onClick={() => setPreview(true)}>
              Private Collector Preview <ArrowUpRight size={16} />
            </button>
          ) : (
            <p className="ex-preview-closed">Private preview registration is closed.</p>
          )}
          <small>By appointment · For collectors & art enthusiasts</small>
        </div>
        <div className="ex-events">
          <span className="ex-kicker">The exhibition programme</span>
          <h3>Join the conversation.</h3>
          {exhibition.events.length ? (
            exhibition.events.map((event, index) => {
              const eventTime = new Intl.DateTimeFormat("en-GB", {
                dateStyle: "long",
                timeStyle: "short",
                timeZone: event.timezone,
              }).format(new Date(event.startAt));
              const ended =
                now !== null &&
                now >=
                  new Date(
                    event.endAt || new Date(new Date(event.startAt).getTime() + 3600000),
                  ).getTime();
              const live = now !== null && now >= new Date(event.startAt).getTime() && !ended;
              return (
                <article key={index}>
                  <span className="ex-event-index">
                    {String(index + 1).padStart(2, "0")} /{" "}
                    {ended ? "Past session" : live ? "Live now" : "Opening & live session"}
                  </span>
                  <h4>{event.title}</h4>
                  <p className="ex-event-time">
                    {eventTime} · {event.timezone.replaceAll("_", " ")}
                  </p>
                  {event.description && <p>{event.description}</p>}
                  {event.url && (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ex-text-link"
                    >
                      {ended ? "Visit session page" : "Join live session"}{" "}
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                </article>
              );
            })
          ) : (
            <article>
              <h4>The next conversation is taking shape.</h4>
              <p>
                Opening events and artist conversations will be announced here. Join the Collectors
                Circle to hear first.
              </p>
              <a href="#collectors-circle" className="ex-text-link">
                Stay in the circle <ArrowRight size={15} />
              </a>
            </article>
          )}
        </div>
      </section>
      <section className="ex-closing">
        <div className="ex-container">
          <span className="ex-kicker">
            {phase === "closed"
              ? "An exhibition to remember"
              : "A moment in art. Yours to discover."}
          </span>
          <h2>
            {phase === "upcoming" ? (
              <>
                The doors open <em>soon.</em>
              </>
            ) : phase === "closed" ? (
              <>
                The story <em>continues.</em>
              </>
            ) : (
              <>
                On view for a <em>limited time.</em>
              </>
            )}
          </h2>
          <Countdown exhibition={exhibition} now={now} large />
          <button className="ex-text-link" onClick={enter}>
            Return to the collection <ArrowUpRight size={16} />
          </button>
        </div>
      </section>
      <CollectorsCircle />
      {exhibitions.filter((item) => item.id !== exhibition.id).length > 0 && (
        <section className="ex-other ex-container">
          <div className="ex-heading-row">
            <h2>
              More from <em>ArtDera.</em>
            </h2>
            <span className="ex-kicker">Upcoming & past exhibitions</span>
          </div>
          <div className="ex-other-grid">
            {exhibitions
              .filter((item) => item.id !== exhibition.id)
              .map((item) => (
                <a href={`/exhibition/${item.slug}`} key={item.id}>
                  <div>
                    {item.coverImageUrl && (
                      <img src={artworkImageUrl(item.coverImageUrl, 640)} alt="" loading="lazy" />
                    )}
                  </div>
                  <span className="ex-kicker">
                    {phaseLabel[exhibitionPhase(item, now ?? Date.now())]}
                  </span>
                  <h3>
                    {item.name} <ArrowUpRight size={20} />
                  </h3>
                  <p>
                    {dateLabel(item.startAt, item.timezone)} —{" "}
                    {dateLabel(item.endAt, item.timezone)}
                  </p>
                </a>
              ))}
          </div>
        </section>
      )}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="ex-artwork-dialog">
          <DialogHeader className="sr-only">
            <DialogTitle>{selected?.title ?? "Artwork details"}</DialogTitle>
            <DialogDescription>
              Artwork information, availability and collector enquiries.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <ArtworkDetail
              key={selected.id}
              work={selected}
              exhibition={exhibition}
              canBuy={phase === "live" && !stale}
              artworks={artworks}
              onNavigate={setSelectedId}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="ex-form-dialog">
          <DialogHeader>
            <p className="ex-kicker">A personal invitation</p>
            <DialogTitle className="font-display text-3xl">Private Collector Preview</DialogTitle>
            <DialogDescription>
              Request a private viewing of {exhibition.name}. Our team will follow up with
              availability and details.
            </DialogDescription>
          </DialogHeader>
          <RegistrationForm exhibition={exhibition} kind="preview" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Countdown({
  exhibition,
  now,
  large = false,
}: {
  exhibition: OnlineExhibition;
  now: number | null;
  large?: boolean;
}) {
  const phase = exhibitionPhase(exhibition, now ?? Date.now());
  const target = phase === "upcoming" ? exhibition.startAt : exhibition.endAt;
  const remaining =
    now === null ? null : Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
  const values =
    remaining === null
      ? ["—", "—", "—", "—"]
      : [
          Math.floor(remaining / 86400),
          Math.floor(remaining / 3600) % 24,
          Math.floor(remaining / 60) % 60,
          remaining % 60,
        ].map((value) => String(value).padStart(2, "0"));
  return (
    <div
      className={`ex-countdown ${large ? "large" : ""}`}
      role="timer"
      aria-label={
        phase === "closed"
          ? "Exhibition closed"
          : `${phase === "upcoming" ? "Opens" : "Closes"} ${dateLabel(target, exhibition.timezone)}`
      }
    >
      <span className="ex-kicker">
        {phase === "closed"
          ? "Exhibition closed"
          : phase === "upcoming"
            ? "Exhibition opens in"
            : "Exhibition closes in"}
      </span>
      {phase === "closed" ? (
        <p className="ex-closed-date">{dateLabel(exhibition.endAt, exhibition.timezone)}</p>
      ) : (
        <div aria-hidden="true">
          {values.map((value, index) => (
            <span key={index}>
              <strong>{value}</strong>
              <small>{["Days", "Hours", "Minutes", "Seconds"][index]}</small>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ArtworkCard({
  work,
  index,
  onOpen,
}: {
  work: ExhibitionWork;
  index: number;
  onOpen: () => void;
}) {
  const { formatPrice } = useCurrency();
  const image = work.images.find((image) => image.isPrimary)?.url || work.images[0]?.url;
  return (
    <article className={`ex-work ex-work-${index % 4}`}>
      <button
        className="ex-work-image"
        onClick={onOpen}
        aria-label={`View ${work.title} by ${work.creatorName}`}
      >
        <span className="ex-work-number">{String(index + 1).padStart(2, "0")}</span>
        {image ? (
          <img
            src={artworkImageUrl(image, 1280)}
            srcSet={artworkImageSrcSet(image)}
            sizes="(max-width: 767px) 90vw, 48vw"
            alt={`${work.title} by ${work.creatorName}`}
            loading="lazy"
          />
        ) : (
          <span className="ex-no-image">Image coming soon</span>
        )}
        <span className="ex-work-view">
          View artwork <Plus size={18} />
        </span>
      </button>
      <div className="ex-work-caption">
        <div>
          <a href={`/creator/${work.creatorSlug}`} className="ex-work-artist">
            {work.creatorName}
          </a>
          <h3>
            <button onClick={onOpen}>{work.title}</button>
          </h3>
          <p>{[work.medium, work.year].filter(Boolean).join(" · ")}</p>
          <p>{work.dimensions || "Dimensions on request"}</p>
        </div>
        <div className="ex-work-price">
          <span className={`ex-availability ${work.availability.toLowerCase()}`}>
            <i />
            {work.availability}
          </span>
          <strong>{formatPrice(work.discountPrice ?? work.price)}</strong>
          <button className="ex-text-link" onClick={onOpen}>
            {work.availability === "Available" ? "Discover & collect" : "View details"}{" "}
            <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

function CollectorsCircle() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const email = String(new FormData(event.currentTarget).get("email"));
    const result = await NewsletterService.subscribe(email, "exhibition-collectors-circle");
    setBusy(false);
    if (result.error) setError(result.error.message);
    else setDone(true);
  }
  return (
    <section id="collectors-circle" className="ex-circle ex-container">
      <div>
        <span className="ex-kicker">For those who see differently</span>
        <h2>
          Join ArtDera
          <br />
          <em>Collectors Circle.</em>
        </h2>
        <p>
          First access to new exhibitions, artist stories and considered collections. A more
          thoughtful way to stay connected to art.
        </p>
      </div>
      <div>
        {done ? (
          <div className="ex-form-success" role="status">
            <Check size={28} />
            <h3>You’re in the circle.</h3>
            <p>Thank you for joining. Look forward to exhibition news and stories from ArtDera.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="collector-email">Your email address</label>
            <div className="ex-circle-input">
              <input
                id="collector-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
              />
              <button type="submit" disabled={busy} aria-label="Join ArtDera Collectors Circle">
                {busy ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={22} />}
              </button>
            </div>
            <label className="ex-consent">
              <input type="checkbox" required />
              <span>
                I’d like to receive ArtDera exhibition news and accept the{" "}
                <a href="/legal/privacy">privacy policy</a>.
              </span>
            </label>
            {error && (
              <p role="alert" className="ex-form-error">
                {error}
              </p>
            )}
            <small>Considered updates, delivered occasionally.</small>
          </form>
        )}
      </div>
    </section>
  );
}

function ExhibitionLobby() {
  return (
    <div className="exhibition-shell">
      <section className="ex-hero ex-lobby">
        <img
          className="ex-hero-image"
          src="/images/hero-studio.jpg"
          alt="Inside an artist’s studio"
          fetchPriority="high"
        />
        <div className="ex-hero-shade" />
        <div className="ex-hero-content">
          <p className="ex-kicker">ArtDera / Online exhibitions</p>
          <h1>
            A new way
            <br />
            to <em>experience art.</em>
          </h1>
          <p className="ex-hero-theme">
            Considered collections. Independent voices.
            <br />
            An exhibition without borders.
          </p>
          <a className="ex-button ex-button-light" href="#collectors-circle">
            Be the first to discover <ArrowDown size={17} />
          </a>
        </div>
        <div className="ex-hero-bottom">
          <span>The next exhibition is taking shape.</span>
          <div>
            <Globe2 size={14} /> Online, worldwide
          </div>
        </div>
      </section>
      <section className="ex-intro ex-container">
        <div className="ex-section-label">
          <span>The ArtDera viewing rooms</span>
          <span className="ex-rule" />
        </div>
        <div className="ex-intro-grid">
          <h2>
            Space to look.
            <br />
            Time to <em>connect.</em>
          </h2>
          <div>
            <p className="ex-intro-copy">
              Our online exhibitions bring art into focus. Explore curated works, meet the artists
              behind them and discover a collection at your own pace. Join the Collectors Circle for
              upcoming exhibitions and private viewing invitations.
            </p>
            <a href="/discover" className="ex-text-link">
              Explore ArtDera’s collection <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
      </section>
      <CollectorsCircle />
    </div>
  );
}
