import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Play,
  Pause,
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
  EXHIBITION_LAUNCH_START,
  exhibitionLaunchIsLive,
  launchCountdownParts,
  type ExhibitionLaunchLeadKind,
} from "@/marketplace/exhibition-launch";
import {
  DEFAULT_EXHIBITION_ROOMS,
  type ExhibitionLanding,
  type ExhibitionWork,
} from "@/marketplace/exhibition-types";
import { artworkImageSrcSet, artworkImageUrl } from "@/lib/artwork-image";
import { editorialCopy } from "@/lib/editorial-copy";
import { ArtworkDetail, RegistrationForm } from "./ArtworkViewer";

function useLaunchClock(serverNow: number) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const baseline = performance.now();
    const update = () => setNow(serverNow + performance.now() - baseline);
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [serverNow]);
  return now;
}
function useGalleryMotion(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    document.documentElement.classList.add("exhibition-scroll");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches || typeof IntersectionObserver === "undefined") {
      element.querySelectorAll("video").forEach((video) => {
        video.autoplay = false;
        video.pause();
      });
      return () => document.documentElement.classList.remove("exhibition-scroll");
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-revealed", "true");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    element.querySelectorAll(".launch-reveal").forEach((target) => observer.observe(target));
    element.classList.add("launch-motion-ready");
    let frame = 0;
    const scroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const hero = element.querySelector<HTMLElement>(".launch-hero-art");
        if (hero && window.innerWidth > 900 && window.scrollY < window.innerHeight * 1.3)
          hero.style.setProperty("--launch-parallax", `${Math.min(window.scrollY * 0.055, 45)}px`);
        frame = 0;
      });
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scroll);
      window.cancelAnimationFrame(frame);
      document.documentElement.classList.remove("exhibition-scroll");
    };
  }, [root]);
}
function primaryImage(work?: ExhibitionWork) {
  return work?.images.find((image) => image.isPrimary)?.url || work?.images[0]?.url;
}
function scrollToGallery() {
  document.getElementById("viewing-rooms")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
}

export function ExhibitionLaunchPage({ initial }: { initial: ExhibitionLanding }) {
  const { data, error } = useQuery({
    queryKey: ["exhibitions"],
    initialData: initial,
    staleTime: 45000,
    refetchInterval: 60000,
    queryFn: async () => {
      const result = await ExhibitionService.landing();
      if (result.error) throw new Error(result.error.message);
      return result.data!;
    },
  });
  const launch = data.launch;
  const { exhibition, artworks, artists } = launch.detail;
  const now = useLaunchClock(launch.serverNow);
  const live = exhibitionLaunchIsLive(now);
  const root = useRef<HTMLDivElement>(null);
  useGalleryMotion(root);
  const [signup, setSignup] = useState<"early-access" | "notify" | null>(null);
  const [film, setFilm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [room, setRoom] = useState("all");
  const [activeArt, setActiveArt] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const heroVideo = useRef<HTMLVideoElement>(null);
  const [videoPaused, setVideoPaused] = useState(false);
  const selected = artworks.find((work) => work.id === selectedId);
  const heroWorks = artworks.slice(0, 3);
  const cover = exhibition.coverImageUrl || primaryImage(heroWorks[0]) || "/images/hero-studio.jpg";
  const previewWorks = artworks.slice(0, 4);
  const rooms = exhibition.rooms.length ? exhibition.rooms : DEFAULT_EXHIBITION_ROOMS;
  const activeRoom = rooms.find((item) => item.key === room);
  const visibleWorks = activeRoom
    ? artworks.filter((work) => activeRoom.artworkIds.includes(work.id))
    : artworks;
  useEffect(() => {
    if (
      heroWorks.length < 2 ||
      carouselPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActiveArt((index) => (index + 1) % heroWorks.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [heroWorks.length, carouselPaused]);
  const openAccess = () => setSignup("early-access");
  const exhibitionForViewer = {
    ...exhibition,
    advisorWhatsapp: launch.settings.advisorWhatsapp,
    startAt: EXHIBITION_LAUNCH_START,
  };
  return (
    <div ref={root} className="exhibition-shell launch-shell">
      <section className="launch-hero" aria-labelledby="launch-title">
        <div className="launch-hero-art" aria-label="Exhibition artwork preview">
          {launch.settings.heroVideoUrl ? (
            <video
              ref={heroVideo}
              src={launch.settings.heroVideoUrl}
              poster={cover}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="ArtDera exhibition atmosphere"
              onPause={() => setVideoPaused(true)}
              onPlay={() => setVideoPaused(false)}
            />
          ) : heroWorks.length ? (
            heroWorks.map((work, index) => (
              <div
                key={work.id}
                className={`launch-hero-slide ${activeArt % heroWorks.length === index ? "is-active" : ""}`}
                aria-hidden={activeArt % heroWorks.length !== index}
              >
                <img
                  src={artworkImageUrl(primaryImage(work), 1920)}
                  srcSet={artworkImageSrcSet(primaryImage(work))}
                  sizes="(max-width: 800px) 100vw, 55vw"
                  alt={`${work.title} by ${work.creatorName}`}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </div>
            ))
          ) : (
            <img src={cover} alt="ArtDera’s creative world" fetchPriority="high" />
          )}
          {!launch.settings.heroVideoUrl && heroWorks.length > 0 && (
            <div className="launch-hero-art-label">
              <span>
                {heroWorks[activeArt % heroWorks.length].title}
                <small>{heroWorks[activeArt % heroWorks.length].creatorName}</small>
              </span>
              <div role="group" aria-label="Artwork preview controls">
                {heroWorks.map((work, index) => (
                  <button
                    key={work.id}
                    aria-label={`Show artwork preview ${index + 1}`}
                    aria-pressed={activeArt % heroWorks.length === index}
                    onClick={() => {
                      setActiveArt(index);
                      setCarouselPaused(true);
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </button>
                ))}
                {heroWorks.length > 1 && (
                  <button
                    aria-label={
                      carouselPaused ? "Resume artwork slideshow" : "Pause artwork slideshow"
                    }
                    onClick={() => setCarouselPaused(!carouselPaused)}
                  >
                    {carouselPaused ? <Play size={12} /> : <Pause size={12} />}
                  </button>
                )}
              </div>
            </div>
          )}
          {launch.settings.heroVideoUrl && (
            <button
              className="launch-hero-video-toggle"
              aria-label={videoPaused ? "Play hero video" : "Pause hero video"}
              onClick={() => {
                if (heroVideo.current?.paused)
                  void heroVideo.current.play().catch(() => setVideoPaused(true));
                else heroVideo.current?.pause();
              }}
            >
              {videoPaused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          )}
        </div>
        <div className="launch-hero-copy">
          <p className="launch-eyebrow">ArtDera Presents</p>
          <h1 id="launch-title">
            ArtDera Online
            <br />
            <em>Exhibition</em> <span>2026</span>
          </h1>
          <p className="launch-tagline">
            Discover Pakistan's Artists.
            <br />
            Collect From Anywhere.
          </p>
          <div className="launch-opening">
            <span className="launch-opening-dot" />
            {live ? "Exhibition Now Live" : "Opening 24 November 2026"}
            <small>00:00 PKT · Online, worldwide</small>
          </div>
          {live ? (
            <div className="launch-live-message" role="status">
              Exhibition Now Live — Enter Exhibition.
            </div>
          ) : (
            <LaunchCountdown now={now} />
          )}
          <div className="launch-hero-actions">
            {live ? (
              <button className="launch-button launch-button-light" onClick={scrollToGallery}>
                Enter Exhibition <ArrowUpRight size={17} />
              </button>
            ) : (
              <>
                <button className="launch-button launch-button-light" onClick={openAccess}>
                  Get Early Access <ArrowUpRight size={17} />
                </button>
                <button
                  className="launch-link launch-link-light"
                  onClick={() => setSignup("notify")}
                >
                  Notify Me <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>
        <a className="launch-scroll-cue" href="#exhibition-preview">
          <span>Explore the preview</span>
          <ArrowDown size={15} />
        </a>
        <div className="launch-hero-edition">
          An ArtDera exhibition <span>Pakistan → The world</span>
        </div>
      </section>

      <section id="exhibition-preview" className="launch-preview launch-container launch-reveal">
        <SectionIndex number="01" text="Exhibition preview" />
        <div className="launch-preview-intro">
          <h2>
            A world of art.
            <br />
            <em>A place to discover.</em>
          </h2>
          <div>
            <p>
              An invitation to see Pakistan through the eyes of its artists. Original works.
              Individual voices. A collection made to be experienced, wherever you are.
            </p>
            <span className="launch-editorial-label">
              24 November 2026 / A new perspective begins
            </span>
          </div>
        </div>
        <div className="launch-preview-stage">
          <div className="launch-preview-image">
            <img
              src={artworkImageUrl(primaryImage(artworks[0]) || cover, 1920)}
              alt={
                artworks[0]
                  ? `${artworks[0].title} by ${artworks[0].creatorName}`
                  : "Inside the ArtDera exhibition"
              }
              loading="lazy"
            />
          </div>
          <div className="launch-preview-caption">
            <span>Look closer.</span>
            {artworks[0] && (
              <p>
                {artworks[0].title} <span>— {artworks[0].creatorName}</span>
              </p>
            )}
            <button className="launch-link" onClick={openAccess}>
              Be part of the opening <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
        <div className="launch-stats" aria-label="Exhibition statistics">
          <div>
            <strong>{artists.length ? String(artists.length).padStart(2, "0") : "Soon"}</strong>
            <span>{launch.curated ? "Participating artists" : "Artists to discover"}</span>
          </div>
          <div>
            <strong>{artworks.length ? String(artworks.length).padStart(2, "0") : "Soon"}</strong>
            <span>{launch.curated ? "Selected artworks" : "Works in the preview"}</span>
          </div>
          <div>
            <strong>24.11</strong>
            <span>Opening day, 2026</span>
          </div>
          <div>
            <strong>
              <Globe2 size={43} strokeWidth={1} />
            </strong>
            <span>Collect from anywhere</span>
          </div>
        </div>
      </section>

      <section className="launch-featured launch-container launch-reveal">
        <SectionIndex number="02" text="Featured artworks" />
        <div className="launch-section-heading">
          <h2>
            The work comes <em>first.</em>
          </h2>
          <p>
            {launch.curated
              ? "A first encounter with the exhibition’s selected works."
              : "An early look at the ArtDera collection. Exhibition selections will be revealed soon."}
          </p>
        </div>
        {previewWorks.length ? (
          <div className="launch-artwork-edit">
            {previewWorks.map((work, index) => (
              <PreviewArtwork
                key={work.id}
                work={work}
                index={index}
                onOpen={() => setSelectedId(work.id)}
              />
            ))}
          </div>
        ) : (
          <div className="launch-selection-soon">
            <span>Selection in progress</span>
            <h3>
              Some things are worth
              <br />
              <em>the anticipation.</em>
            </h3>
            <p>The first works will be revealed here. Join the opening list for a closer look.</p>
            <button className="launch-link" onClick={openAccess}>
              Get early access <ArrowUpRight size={16} />
            </button>
          </div>
        )}
      </section>

      <section
        id="viewing-rooms"
        className={`launch-doors ${live ? "is-open" : ""}`}
        aria-labelledby="launch-doors-title"
      >
        {!live ? (
          <>
            <img
              className="launch-doors-image"
              src={artworkImageUrl(primaryImage(artworks[1]) || cover, 1920)}
              alt=""
              loading="lazy"
            />
            <div className="launch-doors-content">
              <LockKeyhole size={23} strokeWidth={1} />
              <span className="launch-eyebrow">The full exhibition is waiting</span>
              <h2 id="launch-doors-title">
                The Doors Open
                <br />
                <em>24.11.2026</em>
              </h2>
              <p>
                A first look is only the beginning.
                <br />
                The complete viewing room opens on 24 November.
              </p>
              <button className="launch-button launch-button-light" onClick={openAccess}>
                Get Early Access <ArrowUpRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="launch-container">
            <SectionIndex number="03" text="The doors are open" />
            <div className="launch-section-heading">
              <h2 id="launch-doors-title">
                Exhibition Now Live.
                <br />
                <em>Step inside.</em>
              </h2>
              <p>Take your time with the collection. Find the work that speaks to you.</p>
            </div>
            {error && (
              <p role="status" className="launch-connection">
                We’re reconnecting to the gallery. Purchases will resume when availability is
                confirmed.
              </p>
            )}
            <div className="launch-room-tabs" role="group" aria-label="Choose a virtual room">
              <button aria-pressed={room === "all"} onClick={() => setRoom("all")}>
                All works
              </button>
              {rooms
                .filter((item) => launch.curated || item.artworkIds.length)
                .map((item) => (
                  <button
                    key={item.key}
                    aria-pressed={room === item.key}
                    onClick={() => setRoom(item.key)}
                  >
                    {item.name}
                  </button>
                ))}
            </div>
            {activeRoom?.description && (
              <p className="launch-room-note">{activeRoom.description}</p>
            )}
            <div className="launch-artwork-edit">
              {visibleWorks.map((work, index) => (
                <PreviewArtwork
                  key={work.id}
                  work={work}
                  index={index}
                  onOpen={() => setSelectedId(work.id)}
                  showAvailability
                />
              ))}
            </div>
            {!visibleWorks.length && (
              <p className="launch-room-note">
                The collection is being prepared.{" "}
                <a href="/discover">Explore the ArtDera marketplace.</a>
              </p>
            )}
          </div>
        )}
      </section>

      <section id="meet-the-artists" className="launch-artists launch-container launch-reveal">
        <SectionIndex number="04" text="Meet the artists" />
        <div className="launch-section-heading">
          <h2>
            Different voices.
            <br />
            <em>A shared horizon.</em>
          </h2>
          <p>
            {launch.curated
              ? "Meet the artists behind the exhibition."
              : "Discover artists on ArtDera. The exhibition lineup will be announced here."}
          </p>
        </div>
        <div className="launch-artist-grid">
          {artists.slice(0, 6).map((artist, index) => (
            <article key={artist.id}>
              <a className="launch-artist-image" href={`/creator/${artist.slug}`}>
                {artist.image ? (
                  <img src={artworkImageUrl(artist.image, 640)} alt={artist.name} loading="lazy" />
                ) : (
                  <span>{artist.name.slice(0, 1)}</span>
                )}
                <small>{String(index + 1).padStart(2, "0")}</small>
                <ArrowUpRight size={21} />
              </a>
              <span className="launch-editorial-label">{artist.location || "ArtDera artist"}</span>
              <h3>
                <a href={`/creator/${artist.slug}`}>{artist.name}</a>
              </h3>
              <p>
                {editorialCopy(artist.bio, 240) ||
                  "Discover the artist’s practice and original works on ArtDera."}
              </p>
              <a className="launch-link" href={`/creator/${artist.slug}`}>
                Meet the artist <ArrowUpRight size={14} />
              </a>
            </article>
          ))}
        </div>
        {!artists.length && (
          <div className="launch-selection-soon">
            <h3>The voices are coming into view.</h3>
            <p>Our artist introductions will be revealed here ahead of the opening.</p>
            <a className="launch-link" href="/creators">
              Discover ArtDera’s artists <ArrowUpRight size={16} />
            </a>
          </div>
        )}
      </section>

      <section id="exhibition-story" className="launch-story launch-reveal">
        <div className="launch-story-photo">
          <img
            src={artworkImageUrl(exhibition.storyImageUrl || "/images/hero-studio.jpg", 1280)}
            alt="Inside an artist’s creative world"
            loading="lazy"
          />
        </div>
        <div className="launch-story-copy">
          <span className="launch-eyebrow">05 / Exhibition story · Curator’s note</span>
          <h2>
            Art carries a place.
            <br />
            <em>And travels beyond it.</em>
          </h2>
          {(exhibition.curatorNote || exhibition.description)
            .split(/\n\s*\n/)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          <div className="launch-curator">
            <span />
            {exhibition.curatorName || "ArtDera Curatorial Team"}
          </div>
        </div>
      </section>

      <section className="launch-film launch-reveal" aria-labelledby="launch-film-title">
        <div className="launch-film-image">
          <img
            src={
              launch.settings.trailerPosterUrl ||
              artworkImageUrl(primaryImage(artworks[2]) || cover, 1920)
            }
            alt="ArtDera exhibition film preview"
            loading="lazy"
          />
        </div>
        <div className="launch-film-overlay">
          <span className="launch-eyebrow">06 / The exhibition film</span>
          <h2 id="launch-film-title">
            A glimpse of
            <br />
            <em>what awaits.</em>
          </h2>
          {launch.settings.trailerVideoUrl ? (
            <button
              className="launch-play"
              aria-label="Play exhibition trailer"
              onClick={() => setFilm(true)}
            >
              <Play size={24} fill="currentColor" strokeWidth={1} />
            </button>
          ) : (
            <span className="launch-film-coming">Exhibition trailer coming soon</span>
          )}
          <p>
            {launch.settings.trailerVideoUrl
              ? "Watch the exhibition trailer"
              : "Join the opening list to stay connected."}
          </p>
        </div>
      </section>

      <section className="launch-stories launch-container launch-reveal">
        <SectionIndex number="07" text="Artwork stories" />
        <div className="launch-section-heading">
          <h2>
            Every work.
            <br />
            <em>A world within.</em>
          </h2>
          <p>Look beyond the surface. Discover the stories behind the work.</p>
        </div>
        {artworks.slice(0, 2).map((work, index) => (
          <article className="launch-work-story" key={work.id}>
            <button
              className="launch-work-story-image"
              onClick={() => setSelectedId(work.id)}
              aria-label={`Read the story of ${work.title}`}
            >
              <img
                src={artworkImageUrl(primaryImage(work), 1280)}
                alt={work.title}
                loading="lazy"
              />
            </button>
            <div>
              <span className="launch-eyebrow">
                {String(index + 1).padStart(2, "0")} / {work.creatorName}
              </span>
              <h3>{work.title}</h3>
              <p>
                {editorialCopy(work.story?.text || work.description, 650) ||
                  `Discover ${work.title}, an original perspective from ${work.creatorName}. Meet the artist and explore the details of the work.`}
              </p>
              <button className="launch-link" onClick={() => setSelectedId(work.id)}>
                Explore the artwork story <ArrowUpRight size={16} />
              </button>
            </div>
          </article>
        ))}
        {!artworks.length && (
          <p className="launch-room-note">
            Stories from the selected artists will be shared here as the collection is revealed.
          </p>
        )}
      </section>

      <section className="launch-mission launch-reveal">
        <span className="launch-eyebrow">The ArtDera mission</span>
        <h2>
          Pakistan’s creative voices.
          <br />
          <em>A place on the world stage.</em>
        </h2>
        <p>
          We believe extraordinary art deserves to be discovered beyond borders. ArtDera connects
          Pakistan’s independent artists with people who see the world differently — making it
          possible to discover, experience and collect art from anywhere.
        </p>
        <a href="/about" className="launch-link">
          Discover ArtDera <ArrowUpRight size={16} />
        </a>
      </section>

      <section
        id="private-collector-preview"
        className="launch-private launch-container launch-reveal"
      >
        <div>
          <span className="launch-eyebrow">A personal invitation</span>
          <h2>
            Before the opening.
            <br />
            <em>A closer connection.</em>
          </h2>
          <p>
            {exhibition.previewNote ||
              "Request a Private Collector Preview. Tell us what draws your eye, and let our team introduce you to the works, artists and details that matter to your collection."}
          </p>
          <span className="launch-editorial-label">Private Collector Preview / By request</span>
        </div>
        <div className="launch-private-form">
          {exhibition.previewEnabled ? (
            <RegistrationForm exhibition={exhibitionForViewer} kind="preview" launch />
          ) : (
            <p>Private previews are currently closed. Join the opening list to stay connected.</p>
          )}
        </div>
      </section>

      <section className="launch-advisor launch-container">
        <div>
          <MessageCircle size={27} strokeWidth={1} />
          <div>
            <span className="launch-eyebrow">A conversation, considered</span>
            <h3>Your ArtDera Art Advisor.</h3>
            <p>Questions about a work, collecting or shipping? Let’s begin with a conversation.</p>
          </div>
        </div>
        {launch.settings.advisorWhatsapp ? (
          <a
            href={`https://wa.me/${launch.settings.advisorWhatsapp}?text=${encodeURIComponent("Hello ArtDera, I would like advice about the ArtDera Online Exhibition 2026.")}`}
            className="launch-button launch-button-outline"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp Art Advisor <ArrowUpRight size={16} />
          </a>
        ) : (
          <button
            className="launch-button launch-button-outline"
            disabled
            title="ArtDera’s advisor number will be announced soon"
          >
            WhatsApp Art Advisor<small>Advisor details coming soon</small>
          </button>
        )}
      </section>

      <section className="launch-finale">
        <span className="launch-eyebrow">ArtDera Online Exhibition 2026</span>
        <h2>
          {live ? (
            <>
              The doors are open.
              <br />
              <em>The discovery is yours.</em>
            </>
          ) : (
            <>
              Be here when
              <br />
              <em>the doors open.</em>
            </>
          )}
        </h2>
        {live ? (
          <p className="launch-finale-live">Exhibition Now Live — Enter Exhibition.</p>
        ) : (
          <>
            <p className="launch-finale-date">Opening 24 November 2026</p>
            <LaunchCountdown now={now} />
          </>
        )}
        <div className="launch-hero-actions">
          {live ? (
            <button className="launch-button launch-button-light" onClick={scrollToGallery}>
              Enter Exhibition <ArrowUpRight size={17} />
            </button>
          ) : (
            <>
              <button className="launch-button launch-button-light" onClick={openAccess}>
                Get Early Access <ArrowUpRight size={17} />
              </button>
              <button className="launch-link launch-link-light" onClick={() => setSignup("notify")}>
                Notify Me <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
        <span className="launch-finale-foot">
          Discover Pakistan's Artists. Collect From Anywhere.
        </span>
      </section>

      <Dialog
        open={Boolean(signup)}
        onOpenChange={(open) => {
          if (!open) setSignup(null);
        }}
      >
        <DialogContent className="launch-signup-dialog">
          <DialogHeader>
            <span className="launch-eyebrow">ArtDera / Opening 24 November 2026</span>
            <DialogTitle className="launch-dialog-title">
              {signup === "notify" ? "Be there at the beginning." : "Your first look starts here."}
            </DialogTitle>
            <DialogDescription>
              {signup === "notify"
                ? "Join the opening list for exhibition news and launch updates."
                : "Register your interest for early access to the exhibition and collector previews."}
            </DialogDescription>
          </DialogHeader>
          {signup && <LaunchSignup key={signup} kind={signup} />}
        </DialogContent>
      </Dialog>
      <Dialog open={film} onOpenChange={setFilm}>
        <DialogContent className="launch-film-dialog">
          <DialogHeader className="sr-only">
            <DialogTitle>ArtDera exhibition trailer</DialogTitle>
            <DialogDescription>A cinematic first look at the world of ArtDera.</DialogDescription>
          </DialogHeader>
          {film && (
            <video
              src={launch.settings.trailerVideoUrl}
              controls
              autoPlay
              playsInline
              preload="metadata"
              poster={launch.settings.trailerPosterUrl || cover}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="ex-artwork-dialog launch-artwork-dialog">
          <DialogHeader className="sr-only">
            <DialogTitle>{selected?.title || "Artwork preview"}</DialogTitle>
            <DialogDescription>
              Discover the artwork, its story and artist. Collecting opens on 24 November 2026.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <ArtworkDetail
              key={selected.id}
              work={selected}
              exhibition={exhibitionForViewer}
              artworks={artworks}
              onNavigate={setSelectedId}
              canBuy={live && !error}
              launch
              onEarlyAccess={() => {
                setSelectedId(null);
                openAccess();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionIndex({ number, text }: { number: string; text: string }) {
  return (
    <div className="launch-section-index">
      <span>
        {number} / {text}
      </span>
      <i />
    </div>
  );
}
function LaunchCountdown({ now }: { now: number }) {
  return (
    <div
      className="launch-countdown"
      role="timer"
      aria-label="Exhibition opens 24 November 2026 at midnight Pakistan time"
    >
      <div aria-hidden="true">
        {launchCountdownParts(now).map((value, index) => (
          <span key={index}>
            <strong>{String(value).padStart(2, "0")}</strong>
            <small>{["Days", "Hours", "Minutes", "Seconds"][index]}</small>
          </span>
        ))}
      </div>
    </div>
  );
}
function PreviewArtwork({
  work,
  index,
  onOpen,
  showAvailability = false,
}: {
  work: ExhibitionWork;
  index: number;
  onOpen: () => void;
  showAvailability?: boolean;
}) {
  const image = primaryImage(work);
  return (
    <article className={`launch-artwork launch-artwork-${index % 4}`}>
      <button
        className="launch-artwork-image"
        onClick={onOpen}
        aria-label={`Preview ${work.title} by ${work.creatorName}`}
      >
        <span>{String(index + 1).padStart(2, "0")}</span>
        {image && (
          <img
            src={artworkImageUrl(image, 1280)}
            srcSet={artworkImageSrcSet(image)}
            sizes="(max-width: 800px) 90vw, 48vw"
            alt={`${work.title} by ${work.creatorName}`}
            loading="lazy"
          />
        )}
        <i>
          <ArrowUpRight size={21} />
        </i>
      </button>
      <div className="launch-artwork-caption">
        <div>
          <a href={`/creator/${work.creatorSlug}`}>{work.creatorName}</a>
          <h3>
            <button onClick={onOpen}>{work.title}</button>
          </h3>
          <p>{[work.medium, work.year].filter(Boolean).join(" / ")}</p>
        </div>
        {showAvailability ? (
          <span className={`ex-availability ${work.availability.toLowerCase()}`}>
            <i />
            {work.availability}
          </span>
        ) : (
          <button
            className="launch-artwork-caption-arrow"
            aria-label={`View details of ${work.title}`}
            onClick={onOpen}
          >
            <ArrowUpRight size={19} />
          </button>
        )}
      </div>
    </article>
  );
}
function LaunchSignup({ kind }: { kind: ExhibitionLaunchLeadKind }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const result = await ExhibitionService.launchRegister({
      kind,
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      country: "",
      message: "",
      consent: true,
    });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else setDone(true);
  }
  if (done)
    return (
      <div className="launch-signup-success" role="status">
        <Check size={28} strokeWidth={1} />
        <h3>You’re on the list.</h3>
        <p>
          Your interest has been saved. We look forward to welcoming you to ArtDera Online
          Exhibition 2026.
        </p>
        <span>24 November 2026 / Online, worldwide</span>
      </div>
    );
  return (
    <form onSubmit={submit} className="launch-signup-form">
      {kind === "early-access" && (
        <label>
          Your name <span>(optional)</span>
          <input name="name" autoComplete="name" maxLength={120} placeholder="Your name" />
        </label>
      )}
      <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
        />
      </label>
      <label className="ex-consent">
        <input type="checkbox" required />
        <span>
          I’d like to receive ArtDera exhibition updates and accept the{" "}
          <a href="/legal/privacy" target="_blank" rel="noreferrer">
            privacy policy
          </a>
          .
        </span>
      </label>
      {error && (
        <p className="launch-signup-error" role="alert">
          {error}
        </p>
      )}
      <button className="launch-button" disabled={busy}>
        {busy && <Loader2 className="animate-spin" size={16} />}
        {kind === "notify" ? "Notify Me" : "Get Early Access"}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
