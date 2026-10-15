import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/marketplace/auth";
import { useCurrency } from "@/marketplace/currency";
import { CartService } from "@/marketplace/services";
import { ExhibitionService } from "@/marketplace/exhibition-service";
import type { ExhibitionWork, OnlineExhibition } from "@/marketplace/exhibition-types";
import { artworkImageUrl } from "@/lib/artwork-image";
import { artworkRouteSlug } from "@/lib/catalog-product";
import { toast } from "sonner";
import { editorialCopy } from "@/lib/editorial-copy";

export function ArtworkDetail({
  work,
  exhibition,
  canBuy,
  artworks,
  onNavigate,
  launch = false,
  onEarlyAccess,
}: {
  work: ExhibitionWork;
  exhibition: OnlineExhibition;
  canBuy: boolean;
  artworks: ExhibitionWork[];
  onNavigate: (id: string) => void;
  launch?: boolean;
  onEarlyAccess?: () => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const [enquire, setEnquire] = useState(false);
  const [buying, setBuying] = useState(false);
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const index = artworks.findIndex((item) => item.id === work.id);
  async function buy() {
    if (!user) {
      window.location.assign(
        `/auth/login?redirect=${encodeURIComponent(launch ? "/exhibition" : `/exhibition/${exhibition.slug}`)}`,
      );
      return;
    }
    setBuying(true);
    const result = await CartService.add(work.id);
    setBuying(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    window.location.assign("/cart");
  }
  return (
    <div className="ex-detail-layout">
      <div className="ex-detail-images">
        {work.images[imageIndex] ? (
          <img
            src={artworkImageUrl(work.images[imageIndex].url, 1920)}
            alt={work.images[imageIndex].alt || work.title}
          />
        ) : (
          <span>Image coming soon</span>
        )}
        {work.images.length > 1 && (
          <div className="ex-image-controls">
            <button
              aria-label="Previous artwork image"
              onClick={() =>
                setImageIndex((imageIndex + work.images.length - 1) % work.images.length)
              }
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {imageIndex + 1} / {work.images.length}
            </span>
            <button
              aria-label="Next artwork image"
              onClick={() => setImageIndex((imageIndex + 1) % work.images.length)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
      <div className="ex-detail-info">
        <span className="ex-kicker">{exhibition.name}</span>
        <a className="ex-detail-artist" href={`/creator/${work.creatorSlug}`}>
          {work.creatorName} <ArrowUpRight size={15} />
        </a>
        <h2>{work.title}</h2>
        <span className={`ex-availability ${work.availability.toLowerCase()}`}>
          <i />
          {work.availability}
        </span>
        <dl>
          {[
            ["Medium", work.medium],
            ["Dimensions", work.dimensions || "On request"],
            ["Year", work.year || "On request"],
            ["Edition", work.kind],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {(!launch || canBuy) && (
          <div className="ex-detail-price">
            {formatPrice(work.discountPrice ?? work.price)}
            <small>Artwork price · Shipping calculated at checkout</small>
          </div>
        )}
        {work.description && (
          <p className="ex-detail-description">{editorialCopy(work.description)}</p>
        )}
        {work.story?.text && (
          <div className="launch-detail-story">
            <span className="ex-kicker">The artist’s artwork story</span>
            <p>{editorialCopy(work.story.text)}</p>
          </div>
        )}
        <div className="ex-detail-actions">
          {launch && !canBuy && onEarlyAccess ? (
            <button className="ex-button" onClick={onEarlyAccess}>
              Get Early Access <ArrowUpRight size={16} />
            </button>
          ) : (
            <button
              className="ex-button"
              disabled={!canBuy || work.availability !== "Available" || buying}
              onClick={() => void buy()}
            >
              {buying ? <Loader2 size={16} className="animate-spin" /> : null}Buy Artwork{" "}
              <ArrowRight size={16} />
            </button>
          )}
          {!canBuy && (
            <small>
              {launch
                ? "Collecting opens on 24 November 2026. Register for your first look."
                : "Purchasing is available during the exhibition’s opening dates while availability is confirmed."}
            </small>
          )}
          <button className="ex-button ex-button-outline" onClick={() => setEnquire(!enquire)}>
            Enquire <MessageCircle size={16} />
          </button>
          {exhibition.advisorWhatsapp ? (
            <a
              className="ex-advisor"
              href={`https://wa.me/${exhibition.advisorWhatsapp}?text=${encodeURIComponent(`Hello ArtDera, I would like advice on “${work.title}” by ${work.creatorName}, from ${exhibition.name}. ${typeof window !== "undefined" ? window.location.origin : "https://www.artdera.com"}/exhibition/${exhibition.slug}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={15} /> WhatsApp Art Advisor <ArrowUpRight size={14} />
            </a>
          ) : (
            <button
              className="ex-advisor"
              disabled
              title="The gallery has not configured an advisor number yet"
            >
              <MessageCircle size={15} /> WhatsApp Art Advisor
              <small>Contact details coming soon</small>
            </button>
          )}
        </div>
        {enquire && (
          <div className="ex-enquiry-form">
            <h3>Enquire about this work</h3>
            <RegistrationForm
              exhibition={exhibition}
              kind="enquiry"
              artworkId={work.id}
              launch={launch}
            />
          </div>
        )}
        {work.availability === "Available" && (!launch || canBuy) && (
          <a className="ex-text-link" href={`/product/${artworkRouteSlug(work)}`}>
            Full marketplace listing <ArrowUpRight size={14} />
          </a>
        )}
        <div className="ex-detail-navigation">
          <button disabled={index <= 0} onClick={() => onNavigate(artworks[index - 1].id)}>
            <ArrowLeft size={14} /> Previous work
          </button>
          <span>
            {index + 1} / {artworks.length}
          </span>
          <button
            disabled={index >= artworks.length - 1}
            onClick={() => onNavigate(artworks[index + 1].id)}
          >
            Next work <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function RegistrationForm({
  exhibition,
  kind,
  artworkId,
  launch = false,
}: {
  exhibition: OnlineExhibition;
  kind: "preview" | "enquiry";
  artworkId?: string;
  launch?: boolean;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const input = {
      kind,
      artworkId,
      name: String(form.get("name")),
      email: String(form.get("email")),
      country: String(form.get("country")),
      message: String(form.get("message")),
      consent: true as const,
    };
    const result = launch
      ? await ExhibitionService.launchRegister(input)
      : await ExhibitionService.register(exhibition.slug, input);
    setBusy(false);
    if (result.error) setError(result.error.message);
    else setDone(true);
  }
  if (done)
    return (
      <div className="ex-form-success" role="status">
        <Check size={28} />
        <h3>{kind === "preview" ? "Your invitation begins here." : "Your enquiry is with us."}</h3>
        <p>
          {kind === "preview"
            ? "Your request has been received. The ArtDera team will contact you by email to arrange your private preview."
            : "The ArtDera team will follow up by email about this work."}
        </p>
      </div>
    );
  return (
    <form className="ex-registration-form" onSubmit={submit}>
      <label>
        Full name
        <input
          name="name"
          autoComplete="name"
          defaultValue={user?.fullName}
          required
          minLength={2}
          maxLength={120}
          placeholder="Your name"
        />
      </label>
      <label>
        Email address
        <input
          name="email"
          autoComplete="email"
          type="email"
          defaultValue={user?.email}
          required
          maxLength={254}
          placeholder="you@example.com"
        />
      </label>
      <label>
        Country <span>(optional)</span>
        <input
          name="country"
          autoComplete="country-name"
          maxLength={100}
          placeholder="Where are you collecting from?"
        />
      </label>
      <label>
        {kind === "preview" ? "What would you like to discover?" : "Your enquiry"}{" "}
        <span>(optional)</span>
        <textarea
          name="message"
          rows={3}
          maxLength={2000}
          placeholder={
            kind === "preview"
              ? "Artists, interests or preferred viewing times…"
              : "Ask about the artwork, provenance or shipping…"
          }
        />
      </label>
      <label className="ex-consent">
        <input type="checkbox" name="consent" required />
        <span>
          I agree to be contacted about this {kind === "preview" ? "preview request" : "enquiry"}{" "}
          and accept ArtDera’s{" "}
          <a href="/legal/privacy" target="_blank" rel="noreferrer">
            privacy policy
          </a>
          .
        </span>
      </label>
      {error && (
        <p className="ex-form-error" role="alert">
          {error}
        </p>
      )}
      <button className="ex-button" disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
        {kind === "preview" ? "Request Private Preview" : "Send Enquiry"}
        <ArrowRight size={15} />
      </button>
    </form>
  );
}
