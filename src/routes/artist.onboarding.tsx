import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ImagePlus,
  Info,
  Laptop,
  LockKeyhole,
  Smartphone,
  Store as StoreIcon,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { IMAGES } from "@/lib/artdera";
import { CATEGORIES_LIST, STYLES_LIST, SUBJECTS_LIST } from "@/lib/taxonomy";
import { formatPKR, PLANS } from "@/marketplace/config";
import { useAuth } from "@/marketplace/auth";
import {
  ArtworkService,
  OnboardingService,
  sanitizeText,
  StoreService,
  SubscriptionService,
  UploadService,
} from "@/marketplace/services";
import type { Artwork, BillingCycle, PlanId, Store } from "@/marketplace/types";
import { PageLoading } from "@/components/site/PageLoading";

export const Route = createFileRoute("/artist/onboarding")({
  head: () => ({
    meta: [{ title: "Create Your Art Store — ArtDera" }, { name: "robots", content: "noindex" }],
  }),
  component: ArtistOnboarding,
});

const steps = [
  "Artist identity",
  "Store information",
  "Store appearance",
  "Art preferences",
  "Shipping preferences",
  "Verification information",
  "First artwork",
  "Review and publish",
];

type SlugAvailability = "idle" | "checking" | "available" | "unavailable" | "error";
const reservedStoreSlugs = new Set([
  "admin",
  "api",
  "artdera",
  "auth",
  "dashboard",
  "discover",
  "help",
  "new-store",
  "sell",
  "store",
  "stores",
  "support",
]);

type OnboardingData = {
  displayName: string;
  legalName: string;
  sellerType: string;
  city: string;
  province: string;
  country: string;
  languages: string;
  yearStarted: string;
  professionalTitle: string;
  profileImage: string;
  storeName: string;
  slug: string;
  tagline: string;
  shortBio: string;
  story: string;
  categories: string;
  styles: string;
  mediums: string;
  themes: string;
  commissions: boolean;
  instagram: string;
  portfolio: string;
  contactPreference: string;
  coverImage: string;
  accent: string;
  layout: string;
  about: string;
  contactButtons: boolean;
  pickupCity: string;
  domesticShipping: boolean;
  internationalInterest: boolean;
  packaging: string;
  framing: string;
  customOrders: boolean;
  processingTime: string;
  returnAcknowledged: boolean;
  ownershipDeclared: boolean;
  verificationSubmitted: boolean;
  cnicNumber: string;
  verificationPhone: string;
  identityDocumentId: string;
  identityDocumentName: string;
  galleryRegistrationNumber: string;
  addArtwork: boolean;
  artworkTitle: string;
  artworkDescription: string;
  artworkCategory: string;
  artworkMedium: string;
  artworkStyle: string;
  artworkSubject: string;
  artworkYear: string;
  artworkKind: "Original" | "Print" | "Limited Edition";
  artworkPrice: string;
  artworkDiscount: string;
  width: string;
  height: string;
  depth: string;
  unit: string;
  weight: string;
  framed: boolean;
  orientation: "Portrait" | "Landscape" | "Square";
  artworkImage: string;
  quantity: string;
  certificate: boolean;
  tags: string;
  artworkDraft: boolean;
};

const initial: OnboardingData = {
  displayName: "",
  legalName: "",
  sellerType: "Individual Artist",
  city: "Lahore",
  province: "Punjab",
  country: "Pakistan",
  languages: "English, Urdu",
  yearStarted: "2020",
  professionalTitle: "Contemporary Visual Artist",
  profileImage: IMAGES.creator1,
  storeName: "",
  slug: "",
  tagline: "",
  shortBio: "",
  story: "",
  categories: "Painting",
  styles: "Contemporary",
  mediums: "Acrylic, Mixed media",
  themes: "Landscape",
  commissions: true,
  instagram: "",
  portfolio: "",
  contactPreference: "ArtDera messages only",
  coverImage: IMAGES.heroStudio,
  accent: "Oxblood",
  layout: "Editorial grid",
  about: "",
  contactButtons: true,
  pickupCity: "Lahore",
  domesticShipping: true,
  internationalInterest: false,
  packaging: "I can package most works",
  framing: "Framed and unframed",
  customOrders: true,
  processingTime: "3–5 working days",
  returnAcknowledged: false,
  ownershipDeclared: false,
  verificationSubmitted: false,
  cnicNumber: "",
  verificationPhone: "",
  identityDocumentId: "",
  identityDocumentName: "",
  galleryRegistrationNumber: "",
  addArtwork: true,
  artworkTitle: "",
  artworkDescription: "",
  artworkCategory: "Painting",
  artworkMedium: "Acrylic on canvas",
  artworkStyle: "Contemporary",
  artworkSubject: "Landscape",
  artworkYear: "2026",
  artworkKind: "Original",
  artworkPrice: "",
  artworkDiscount: "",
  width: "24",
  height: "30",
  depth: "1",
  unit: "in",
  weight: "2.5",
  framed: false,
  orientation: "Portrait",
  artworkImage: IMAGES.art1,
  quantity: "1",
  certificate: true,
  tags: "abstract, pakistan, contemporary",
  artworkDraft: false,
};

function ArtistOnboarding() {
  const { user, ready, catalogReady } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(initial);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [error, setError] = useState("");
  const [planId, setPlanId] = useState<PlanId>("free");
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [activationNotice, setActivationNotice] = useState(false);
  const [creating, setCreating] = useState(false);
  const [slugAvailability, setSlugAvailability] = useState<SlugAvailability>("idle");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!catalogReady) return;
    const flow = SubscriptionService.getFlow();
    const subscription = user ? SubscriptionService.getForUser(user.id) : undefined;
    const selectedPlanId = flow.selection?.planId ?? subscription?.planId ?? "free";
    const selectedBilling = flow.selection?.billingCycle ?? subscription?.billingCycle ?? "free";
    const saved = OnboardingService.read<Partial<OnboardingData>>({});
    const internationalToolsAvailable = Boolean(
      PLANS[selectedPlanId]?.allowedModules.includes("international-tools"),
    );
    setData({
      ...initial,
      verificationPhone: user?.mobile ?? "",
      ...saved,
      // Drafts can survive a plan change. A locked optional feature must never prevent the core
      // store from being created.
      internationalInterest: internationalToolsAvailable
        ? Boolean(saved.internationalInterest ?? initial.internationalInterest)
        : false,
    });
    setPlanId(selectedPlanId);
    setBilling(selectedBilling);
    setStep(flow.onboardingStep);
    setActivationNotice(new URLSearchParams(window.location.search).get("activated") === "free");
    setInitialized(true);
  }, [catalogReady, user]);

  useEffect(() => {
    if (!initialized) return;
    OnboardingService.save(data, step);
  }, [data, initialized, step]);

  useEffect(() => {
    const slug = data.slug.trim().toLowerCase();
    if (!slug) {
      setSlugAvailability("idle");
      return;
    }
    if (
      slug.length < 3 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      reservedStoreSlugs.has(slug)
    ) {
      setSlugAvailability("unavailable");
      return;
    }
    let cancelled = false;
    setSlugAvailability("checking");
    const timer = window.setTimeout(() => {
      void StoreService.slugAvailable(slug).then((result) => {
        if (cancelled || data.slug !== slug) return;
        if (result.error) setSlugAvailability("error");
        else setSlugAvailability(result.data?.available ? "available" : "unavailable");
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [data.slug]);

  useEffect(() => {
    if (!ready || !catalogReady || !user || !["artist", "gallery"].includes(user.role)) return;
    const subscription = SubscriptionService.getForUser(user.id);
    if (!subscription) window.location.replace("/sell/plans");
    else if (subscription.planId !== "free" && subscription.status !== "Active")
      window.location.replace("/artist/checkout");
  }, [catalogReady, ready, user]);

  const update = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) =>
    setData((current) => ({ ...current, [key]: value }));
  const slugAvailable = slugAvailability === "available";
  const plan = PLANS[planId];
  const displayPrice =
    billing === "annual" && plan.annualPrice ? plan.annualPrice : plan.monthlyPrice;

  function next(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    if (step === 0 && (!data.displayName || !data.legalName || !data.city))
      return setError("Please add your display name, legal name and city.");
    if (step === 1 && slugAvailability === "checking")
      return setError("Checking whether this store URL is available. Please wait a moment.");
    if (step === 1 && (!data.storeName || !slugAvailable || data.shortBio.length < 30))
      return setError(
        "Add a store name, an available URL and a short biography of at least 30 characters.",
      );
    if (step === 4 && !data.returnAcknowledged)
      return setError(
        "Please acknowledge that the final return policy will apply to eligible orders.",
      );
    if (step === 5 && !data.ownershipDeclared)
      return setError("Please confirm the artwork ownership declaration before continuing.");
    if (step === 6 && data.addArtwork && (!data.artworkTitle || !Number(data.artworkPrice)))
      return setError("Add an artwork title and a valid price, or choose to skip this step.");
    setStep((value) => Math.min(7, value + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function chooseFile(
    key: "profileImage" | "coverImage" | "artworkImage",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Choose an image smaller than 5 MB.");
      return;
    }
    const purpose = key === "profileImage" ? "profile" : key === "coverImage" ? "cover" : "artwork";
    const result = await UploadService.upload(file, purpose);
    if (result.error) return toast.error(result.error.message);
    if (!result.data) return toast.error("The image could not be uploaded.");
    update(key, result.data.url);
    toast.success("Image uploaded securely");
  }

  async function createStore() {
    if (!user || creating) return;
    setError("");
    setCreating(true);
    const checkedSlug = await StoreService.slugAvailable(data.slug);
    if (checkedSlug.error || !checkedSlug.data?.available) {
      setCreating(false);
      setSlugAvailability(checkedSlug.error ? "error" : "unavailable");
      setStep(1);
      setError(
        checkedSlug.error
          ? "The store URL could not be checked. Please try again."
          : "That store URL is already taken. Choose an available URL before creating your store.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const internationalToolsAvailable = Boolean(
      PLANS[planId]?.allowedModules.includes("international-tools"),
    );
    const result = await OnboardingService.complete({
      ...data,
      internationalInterest: internationalToolsAvailable && data.internationalInterest,
    });
    if (result.error) {
      setCreating(false);
      if (["SLUG_TAKEN", "SLUG_RESERVED", "DUPLICATE_VALUE"].includes(result.error.code)) {
        setSlugAvailability("unavailable");
        setStep(1);
        setError("That store URL is no longer available. Choose another URL and try again.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      return setError(result.error.message);
    }
    if (!result.data) {
      setCreating(false);
      return setError("Your store could not be created.");
    }
    SubscriptionService.completeOnboarding(result.data.store.id);
    await navigate({ to: "/artist/store-created" });
    return;
  }

  if (!ready || !catalogReady || !initialized)
    return <PageLoading label="Loading your store setup" />;
  if (!user || !["artist", "gallery"].includes(user.role))
    return <AccessCard signedIn={Boolean(user)} />;
  return (
    <div className="container-editorial py-8 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 border-b border-[var(--color-border)] pb-7 lg:flex-row lg:items-end">
          <div>
            <div className="eyebrow">Store setup · Step {step + 1} of 8</div>
            <h1 className="mt-3 font-display text-4xl md:text-5xl">{steps[step]}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your progress is saved securely and can be resumed after signing in again.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                OnboardingService.save(data, step);
                toast.success("Onboarding draft saved");
              }}
              className="btn-ghost"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => {
                OnboardingService.save(data, step);
                window.location.assign("/sell");
              }}
              className="btn-ghost"
            >
              Exit and Continue Later
            </button>
          </div>
        </div>
        {activationNotice && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          >
            <strong>Your Free Plan is active.</strong> Complete your profile to create your store.
          </div>
        )}
        <div className="mt-6 overflow-x-auto pb-2">
          <ol className="flex min-w-max gap-2">
            {steps.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => index <= step && setStep(index)}
                  className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold ${index === step ? "bg-[var(--ink)] text-[var(--ivory)]" : index < step ? "bg-[var(--porcelain)] text-foreground" : "text-muted-foreground"}`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${index < step ? "bg-[var(--success)] text-white" : "bg-black/8"}`}
                  >
                    {index < step ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <form onSubmit={next} className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 md:p-8">
            {step === 0 && <IdentityStep data={data} update={update} chooseFile={chooseFile} />}{" "}
            {step === 1 && (
              <StoreIdentityStep data={data} update={update} availability={slugAvailability} />
            )}{" "}
            {step === 2 && (
              <AppearanceStep
                data={data}
                update={update}
                chooseFile={chooseFile}
                previewMode={previewMode}
                setPreviewMode={setPreviewMode}
              />
            )}{" "}
            {step === 3 && <ArtPreferencesStep data={data} update={update} />}{" "}
            {step === 4 && <BusinessStep data={data} update={update} planId={planId} />}{" "}
            {step === 5 && (
              <VerificationStep data={data} update={update} accountEmail={user.email} />
            )}{" "}
            {step === 6 && <ArtworkStep data={data} update={update} chooseFile={chooseFile} />}{" "}
            {step === 7 && <ReviewStep data={data} planId={planId} billing={billing} />}{" "}
            {error && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {error}
              </div>
            )}
            <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-[var(--color-border)] pt-6 sm:flex-row">
              <button
                type="button"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={step === 0}
                className="btn-ghost disabled:invisible"
              >
                <ArrowLeft className="h-4 w-4" /> Back and Edit
              </button>
              {step < 7 ? (
                <button className="btn-primary">
                  Save and continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={createStore}
                  disabled={creating}
                  className="btn-primary min-h-12 disabled:cursor-wait disabled:opacity-60"
                >
                  {creating ? `Creating ${data.storeName || "your store"}…` : "Create My Store"}
                  <StoreIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </main>
          <aside className="h-fit rounded-2xl border border-[var(--color-border)] bg-[var(--ivory)] p-5 lg:sticky lg:top-28">
            <div className="eyebrow">Live summary</div>
            <div className="mt-4 overflow-hidden rounded-xl bg-[var(--ink)] text-[var(--ivory)]">
              <img
                src={data.coverImage}
                alt="Store cover preview"
                className="h-28 w-full object-cover opacity-70"
              />
              <div className="p-4">
                <div className="-mt-10 h-16 w-16 overflow-hidden rounded-full border-4 border-[var(--ink)] bg-[var(--porcelain)]">
                  <img
                    src={data.profileImage}
                    alt="Profile preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-3 font-display text-2xl">
                  {data.storeName || data.displayName || "Your store"}
                </div>
                <div className="mt-1 text-xs text-white/55">
                  artdera.com/store/{data.slug || "store-name"}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-white/65">
                  {data.tagline || "Your store tagline will appear here."}
                </p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-xs">
              {[
                ["Plan", plan.name],
                ["Price", formatPKR(displayPrice)],
                ["Commission", `${plan.commission}%`],
                ["Listings", plan.listingLimit ?? "Fair-use unlimited"],
                ["Verification", data.verificationSubmitted ? "Pending Review" : "Not submitted"],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex gap-2 rounded-xl bg-[var(--porcelain)] p-3 text-[11px] leading-relaxed text-muted-foreground">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[var(--indigo)]" />
              Sensitive bank, identity and tax details stay private and are never shown on your
              public storefront.
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

function IdentityStep({ data, update, chooseFile }: StepProps & { chooseFile: ImageHandler }) {
  return (
    <StepLayout
      title="Introduce your practice"
      description="Use the name collectors should recognise. Legal details remain private and access-controlled."
    >
      <ImagePicker
        label="Profile photo or logo"
        value={data.profileImage}
        onChange={(event) => chooseFile("profileImage", event)}
        onRemove={() => update("profileImage", IMAGES.creator1)}
      />
      <FieldGrid>
        <Field id="display-name" label="Artist or gallery display name">
          <input
            id="display-name"
            required
            className="art-field"
            value={data.displayName}
            onChange={(event) => update("displayName", event.target.value)}
          />
        </Field>
        <Field id="legal-name" label="Legal / full name">
          <input
            id="legal-name"
            required
            className="art-field"
            value={data.legalName}
            onChange={(event) => update("legalName", event.target.value)}
          />
        </Field>
        <Field id="seller-type" label="Seller type">
          <select
            id="seller-type"
            className="art-field"
            value={data.sellerType}
            onChange={(event) => update("sellerType", event.target.value)}
          >
            {["Individual Artist", "Professional Artist", "Gallery", "Art Business"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </Field>
        <Field id="professional-title" label="Short professional title">
          <input
            id="professional-title"
            className="art-field"
            value={data.professionalTitle}
            onChange={(event) => update("professionalTitle", event.target.value)}
            placeholder="Landscape Painter"
          />
        </Field>
        <Field id="city" label="City">
          <input
            id="city"
            className="art-field"
            value={data.city}
            onChange={(event) => update("city", event.target.value)}
          />
        </Field>
        <Field id="province" label="Province">
          <input
            id="province"
            className="art-field"
            value={data.province}
            onChange={(event) => update("province", event.target.value)}
          />
        </Field>
        <Field id="country" label="Country">
          <input
            id="country"
            className="art-field"
            value={data.country}
            onChange={(event) => update("country", event.target.value)}
          />
        </Field>
        <Field id="languages" label="Languages spoken">
          <input
            id="languages"
            className="art-field"
            value={data.languages}
            onChange={(event) => update("languages", event.target.value)}
          />
        </Field>
        <Field id="year-started" label="Year started">
          <input
            id="year-started"
            type="number"
            min="1900"
            max="2026"
            className="art-field"
            value={data.yearStarted}
            onChange={(event) => update("yearStarted", event.target.value)}
          />
        </Field>
      </FieldGrid>
    </StepLayout>
  );
}

function StoreIdentityStep({
  data,
  update,
  availability,
}: StepProps & { availability: SlugAvailability }) {
  const available = availability === "available";
  const availabilityMessage =
    availability === "checking"
      ? "Checking availability…"
      : availability === "available"
        ? "Available"
        : availability === "unavailable"
          ? "Not available — choose another URL"
          : availability === "error"
            ? "Could not check availability — edit the URL to try again"
            : "Use at least 3 supported characters";
  return (
    <StepLayout
      title="Give your store a clear identity"
      description="This information appears publicly and helps collectors understand your work."
    >
      <FieldGrid>
        <Field id="store-name" label="Store name">
          <input
            id="store-name"
            className="art-field"
            value={data.storeName}
            onChange={(event) => {
              update("storeName", event.target.value);
              if (!data.slug) update("slug", slugify(event.target.value));
            }}
          />
        </Field>
        <Field id="slug" label="Store URL slug">
          <input
            id="slug"
            className={`art-field ${
              availability === "unavailable" || availability === "error"
                ? "!border-red-400"
                : available
                  ? "!border-emerald-500"
                  : ""
            }`}
            value={data.slug}
            onChange={(event) => update("slug", slugify(event.target.value))}
          />
          <div
            className={`mt-2 text-xs ${
              available
                ? "text-[var(--success)]"
                : availability === "unavailable" || availability === "error"
                  ? "text-[var(--destructive)]"
                  : "text-muted-foreground"
            }`}
            role="status"
            aria-live="polite"
          >
            {availabilityMessage} · artdera.com/store/{data.slug || "store-name"}
          </div>
        </Field>
        <Field id="tagline" label="Store tagline" wide>
          <input
            id="tagline"
            maxLength={140}
            className="art-field"
            value={data.tagline}
            onChange={(event) => update("tagline", event.target.value)}
          />
        </Field>
        <Field id="short-bio" label="Short biography" wide>
          <textarea
            id="short-bio"
            rows={3}
            className="art-field !rounded-xl"
            value={data.shortBio}
            onChange={(event) => update("shortBio", event.target.value)}
          />
          <div className="mt-1 text-right text-[11px] text-muted-foreground">
            {data.shortBio.length}/500 · minimum 30
          </div>
        </Field>
        <Field id="story" label="Detailed artist or gallery story" wide>
          <textarea
            id="story"
            rows={6}
            className="art-field !rounded-xl"
            value={data.story}
            onChange={(event) => update("story", event.target.value)}
          />
        </Field>
        <Field id="categories" label="Main art categories">
          <select
            id="categories"
            className="art-field"
            value={data.categories}
            onChange={(event) => update("categories", event.target.value)}
          >
            {CATEGORIES_LIST.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field id="styles" label="Art styles">
          <select
            id="styles"
            className="art-field"
            value={data.styles}
            onChange={(event) => update("styles", event.target.value)}
          >
            {STYLES_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field id="mediums" label="Mediums used">
          <input
            id="mediums"
            className="art-field"
            value={data.mediums}
            onChange={(event) => update("mediums", event.target.value)}
          />
        </Field>
        <Field id="themes" label="Themes (Subjects)">
          <select
            id="themes"
            className="art-field"
            value={data.themes}
            onChange={(event) => update("themes", event.target.value)}
          >
            {SUBJECTS_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field id="instagram" label="Instagram or social link">
          <input
            id="instagram"
            type="url"
            className="art-field"
            value={data.instagram}
            onChange={(event) => update("instagram", event.target.value)}
          />
        </Field>
        <Field id="portfolio" label="Portfolio website">
          <input
            id="portfolio"
            type="url"
            className="art-field"
            value={data.portfolio}
            onChange={(event) => update("portfolio", event.target.value)}
          />
        </Field>
        <Field id="contact" label="Public contact preference">
          <select
            id="contact"
            className="art-field"
            value={data.contactPreference}
            onChange={(event) => update("contactPreference", event.target.value)}
          >
            <option>ArtDera messages only</option>
            <option>Messages and video requests</option>
            <option>Offers and messages</option>
          </select>
        </Field>
        <Toggle
          label="Available for custom commissions"
          checked={data.commissions}
          onChange={(value) => update("commissions", value)}
        />
      </FieldGrid>
    </StepLayout>
  );
}

function AppearanceStep({
  data,
  update,
  chooseFile,
  previewMode,
  setPreviewMode,
}: StepProps & {
  chooseFile: ImageHandler;
  previewMode: "desktop" | "mobile";
  setPreviewMode: (mode: "desktop" | "mobile") => void;
}) {
  return (
    <StepLayout
      title="Choose a calm, readable storefront"
      description="ArtDera keeps theme choices accessible so artwork remains the focus."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <ImagePicker
          label="Profile image or logo"
          value={data.profileImage}
          onChange={(event) => chooseFile("profileImage", event)}
          onRemove={() => update("profileImage", IMAGES.creator1)}
        />
        <ImagePicker
          label="Store cover image"
          value={data.coverImage}
          landscape
          onChange={(event) => chooseFile("coverImage", event)}
          onRemove={() => update("coverImage", IMAGES.heroStudio)}
        />
      </div>
      <FieldGrid>
        <Field id="accent" label="Store accent">
          <select
            id="accent"
            className="art-field"
            value={data.accent}
            onChange={(event) => update("accent", event.target.value)}
          >
            <option>Oxblood</option>
            <option>Deep Indigo</option>
            <option>Terracotta</option>
          </select>
        </Field>
        <Field id="layout" label="Store layout">
          <select
            id="layout"
            className="art-field"
            value={data.layout}
            onChange={(event) => update("layout", event.target.value)}
          >
            <option>Editorial grid</option>
            <option>Quiet gallery</option>
            <option>Collection focus</option>
          </select>
        </Field>
        <Field id="about" label="About section" wide>
          <textarea
            id="about"
            rows={4}
            className="art-field !rounded-xl"
            value={data.about}
            onChange={(event) => update("about", event.target.value)}
          />
        </Field>
        <Toggle
          label="Show contact buttons"
          checked={data.contactButtons}
          onChange={(value) => update("contactButtons", value)}
        />
      </FieldGrid>
      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <div className="eyebrow">Responsive preview</div>
          <div className="flex rounded-full border border-[var(--color-border)] p-1">
            <button
              type="button"
              onClick={() => setPreviewMode("desktop")}
              className={`rounded-full p-2 ${previewMode === "desktop" ? "bg-[var(--ink)] text-white" : ""}`}
              aria-label="Desktop preview"
            >
              <Laptop className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("mobile")}
              className={`rounded-full p-2 ${previewMode === "mobile" ? "bg-[var(--ink)] text-white" : ""}`}
              aria-label="Mobile preview"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div
          className={`mx-auto overflow-hidden rounded-xl border border-[var(--color-border)] bg-white transition-all ${previewMode === "mobile" ? "max-w-[320px]" : "max-w-full"}`}
        >
          <img src={data.coverImage} alt="Cover preview" className="h-32 w-full object-cover" />
          <div className="p-5">
            <div className="font-display text-2xl">{data.storeName || "Your Store"}</div>
            <div className="mt-2 flex gap-2">
              <span className="chip">{data.categories.split(",")[0]}</span>
              <span className="chip">
                {data.city}, {data.country}
              </span>
            </div>
            <div
              className={`mt-5 grid gap-3 ${previewMode === "mobile" ? "grid-cols-2" : "grid-cols-3"}`}
            >
              {[IMAGES.art1, IMAGES.art2, IMAGES.art3].map((image, index) => (
                <img
                  key={image}
                  src={image}
                  alt={`Artwork preview ${index + 1}`}
                  className="aspect-[4/5] w-full rounded-lg object-cover"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </StepLayout>
  );
}

function ArtPreferencesStep({ data, update }: StepProps) {
  const selected = data.categories
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const toggle = (value: string) =>
    update(
      "categories",
      (selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
      ).join(", "),
    );
  return (
    <StepLayout
      title="Define the work collectors will find"
      description="Choose every relevant discipline, then add the styles, mediums and themes that describe your practice."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES_LIST.map((choice) => (
          <label
            key={choice}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm font-semibold ${selected.includes(choice) ? "border-[var(--oxblood)] bg-[var(--ivory)]" : "border-[var(--color-border)]"}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(choice)}
              onChange={() => toggle(choice)}
              className="accent-[var(--oxblood)]"
            />
            {choice}
          </label>
        ))}
      </div>
      <FieldGrid>
        <Field id="art-styles" label="Styles">
          <input
            id="art-styles"
            className="art-field"
            value={data.styles}
            onChange={(event) => update("styles", event.target.value)}
          />
        </Field>
        <Field id="art-mediums" label="Mediums">
          <input
            id="art-mediums"
            className="art-field"
            value={data.mediums}
            onChange={(event) => update("mediums", event.target.value)}
          />
        </Field>
        <Field id="art-themes" label="Themes" wide>
          <input
            id="art-themes"
            className="art-field"
            value={data.themes}
            onChange={(event) => update("themes", event.target.value)}
          />
        </Field>
      </FieldGrid>
    </StepLayout>
  );
}

function BusinessStep({ data, update, planId }: StepProps & { planId: PlanId }) {
  const internationalToolsAvailable = Boolean(
    PLANS[planId]?.allowedModules.includes("international-tools"),
  );
  return (
    <StepLayout
      title="Set practical expectations"
      description="These preferences create estimates only. No courier or payout provider is connected."
    >
      <FieldGrid>
        <Field id="pickup-city" label="Artwork pickup city">
          <input
            id="pickup-city"
            className="art-field"
            value={data.pickupCity}
            onChange={(event) => update("pickupCity", event.target.value)}
          />
        </Field>
        <Field id="processing" label="Estimated processing time">
          <select
            id="processing"
            className="art-field"
            value={data.processingTime}
            onChange={(event) => update("processingTime", event.target.value)}
          >
            <option>1–2 working days</option>
            <option>3–5 working days</option>
            <option>5–7 working days</option>
            <option>1–2 weeks</option>
          </select>
        </Field>
        <Field id="packaging" label="Packaging ability">
          <select
            id="packaging"
            className="art-field"
            value={data.packaging}
            onChange={(event) => update("packaging", event.target.value)}
          >
            <option>I can package most works</option>
            <option>I need packaging support</option>
            <option>Depends on the artwork</option>
          </select>
        </Field>
        <Field id="framing" label="Framed / unframed shipping">
          <select
            id="framing"
            className="art-field"
            value={data.framing}
            onChange={(event) => update("framing", event.target.value)}
          >
            <option>Framed and unframed</option>
            <option>Unframed only</option>
            <option>Rolled canvas only</option>
          </select>
        </Field>
        <Toggle
          label="Domestic shipping available"
          checked={data.domesticShipping}
          onChange={(value) => update("domesticShipping", value)}
        />
        <Toggle
          label={
            internationalToolsAvailable
              ? "Interested in international shipping"
              : "International shipping (Pro Plus or Gallery)"
          }
          checked={internationalToolsAvailable && data.internationalInterest}
          onChange={(value) => update("internationalInterest", value)}
          disabled={!internationalToolsAvailable}
          hint={
            internationalToolsAvailable
              ? undefined
              : "You can create your store now and enable this after upgrading."
          }
        />
        <Toggle
          label="Custom orders available"
          checked={data.customOrders}
          onChange={(value) => update("customOrders", value)}
        />
      </FieldGrid>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {[
          ["Identity verification", "Not submitted"],
          ["Bank details", "Required before the first payout"],
          ["Tax details", "Required where applicable"],
          ["Payout setup", "Pending"],
        ].map(([title, status]) => (
          <div key={title} className="rounded-xl border border-[var(--color-border)] p-4">
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{status}</div>
          </div>
        ))}
      </div>
      <label className="mt-6 flex items-start gap-3 rounded-xl bg-[var(--ivory)] p-4 text-sm">
        <input
          type="checkbox"
          checked={data.returnAcknowledged}
          onChange={(event) => update("returnAcknowledged", event.target.checked)}
          className="mt-1 accent-[var(--oxblood)]"
        />
        <span>
          I understand eligible orders follow ArtDera's published return and refund policy.
        </span>
      </label>
    </StepLayout>
  );
}

function VerificationStep({ data, update, accountEmail }: StepProps & { accountEmail: string }) {
  const [uploadingIdentity, setUploadingIdentity] = useState(false);
  const isGallery = data.sellerType.includes("Gallery");

  const focus = (id: string) => {
    const element = document.getElementById(id);
    if (element instanceof HTMLInputElement && element.type === "file") element.click();
    else element?.focus();
  };

  async function uploadIdentity(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      toast.error("Choose a PDF, JPG, PNG or WebP identity document.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Choose an identity document smaller than 5 MB.");
      event.target.value = "";
      return;
    }
    setUploadingIdentity(true);
    const result = await UploadService.upload(file, "verification");
    setUploadingIdentity(false);
    if (result.error) return toast.error(result.error.message);
    if (!result.data) return toast.error("The identity document could not be uploaded.");
    update("identityDocumentId", result.data.id);
    update("identityDocumentName", file.name);
    toast.success("Identity document added securely");
  }

  const cards = [
    {
      title: "Identity verification",
      status: data.identityDocumentId ? "Ready to submit" : "Not submitted",
      action: data.identityDocumentId ? "Replace document" : "Add document",
      onClick: () => focus("identity-document"),
    },
    {
      title: "Portfolio review",
      status: data.verificationSubmitted
        ? "Pending Review"
        : data.portfolio
          ? "Ready to submit"
          : "Not submitted",
      action: data.portfolio ? "Edit portfolio" : "Add portfolio",
      onClick: () => focus("verification-portfolio"),
    },
    {
      title: "Phone verification",
      status: data.verificationPhone ? "Ready to submit" : "Not submitted",
      action: data.verificationPhone ? "Edit phone" : "Add phone",
      onClick: () => focus("verification-phone"),
    },
    {
      title: "Email verification",
      status: "Verified account",
      action: "View email",
      onClick: () => focus("verification-email"),
    },
    {
      title: "Artwork ownership declaration",
      status: data.ownershipDeclared ? "Confirmed" : "Required",
      action: data.ownershipDeclared ? "Confirmed" : "Confirm now",
      onClick: () => update("ownershipDeclared", !data.ownershipDeclared),
    },
    {
      title: "Gallery registration",
      status: isGallery
        ? data.galleryRegistrationNumber
          ? "Ready to submit"
          : "Not submitted"
        : "Not applicable",
      action: isGallery ? "Add registration" : "Individual account",
      onClick: () =>
        isGallery
          ? focus("gallery-registration")
          : toast.info("Gallery registration is only required for gallery accounts."),
    },
  ];

  return (
    <StepLayout
      title="Verification is a review, not a purchase"
      description="A paid plan never guarantees a verified badge. Admin approval is required before any badge appears publicly."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ title, status, action, onClick }) => (
          <button
            type="button"
            key={title}
            onClick={onClick}
            className="rounded-xl border border-[var(--color-border)] p-4 text-left transition hover:border-[var(--oxblood)] hover:bg-[var(--ivory)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oxblood)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold">{title}</div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${status === "Pending Review" ? "bg-amber-100 text-amber-900" : "bg-[var(--ivory)] text-muted-foreground"}`}
              >
                {status}
              </span>
            </div>
            <span className="mt-3 inline-block text-xs font-semibold text-[var(--oxblood)]">
              {action}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field id="verification-cnic" label="CNIC / National ID Number">
          <input
            id="verification-cnic"
            className="art-field"
            value={data.cnicNumber}
            onChange={(event) => update("cnicNumber", event.target.value)}
            placeholder="e.g. 42101-1234567-1"
          />
        </Field>
        <Field id="identity-document" label="Identity document (CNIC / Passport)">
          <label className="art-field flex cursor-pointer items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm">
              {uploadingIdentity
                ? "Uploading identity document…"
                : data.identityDocumentName || "Choose a private document"}
            </span>
            <UploadCloud className="h-4 w-4 shrink-0 text-[var(--oxblood)]" />
            <input
              id="identity-document"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={uploadingIdentity}
              onChange={(event) => void uploadIdentity(event)}
              className="sr-only"
            />
          </label>
        </Field>
        <Field id="verification-phone" label="Phone number">
          <input
            id="verification-phone"
            type="tel"
            className="art-field"
            value={data.verificationPhone}
            onChange={(event) => update("verificationPhone", event.target.value)}
            placeholder="+92 300 0000000"
          />
        </Field>
        <Field id="verification-portfolio" label="Portfolio or website">
          <input
            id="verification-portfolio"
            type="url"
            className="art-field"
            value={data.portfolio}
            onChange={(event) => update("portfolio", event.target.value)}
            placeholder="https://your-portfolio.com"
          />
        </Field>
        <Field id="verification-email" label="Verified account email">
          <input
            id="verification-email"
            className="art-field bg-[var(--ivory)]"
            value={accountEmail}
            readOnly
          />
        </Field>
        {isGallery && (
          <Field id="gallery-registration" label="Gallery registration number">
            <input
              id="gallery-registration"
              className="art-field"
              value={data.galleryRegistrationNumber}
              onChange={(event) => update("galleryRegistrationNumber", event.target.value)}
              placeholder="Registration or licence number"
            />
          </Field>
        )}
      </div>
      <label className="mt-6 flex items-start gap-3 rounded-xl bg-[var(--ivory)] p-4 text-sm leading-relaxed">
        <input
          id="ownership-declaration"
          type="checkbox"
          checked={data.ownershipDeclared}
          onChange={(event) => update("ownershipDeclared", event.target.checked)}
          className="mt-1 accent-[var(--oxblood)]"
        />
        <span>
          I declare that I own, represent or have permission to sell the artworks I list, and that
          my listing information will be accurate.
        </span>
      </label>
      <button
        type="button"
        onClick={() => {
          if (!data.ownershipDeclared)
            return toast.error("Confirm the ownership declaration first.");
          update("verificationSubmitted", true);
          toast.success("Verification request added", {
            description: "It will be saved when onboarding creates your store.",
          });
        }}
        className="btn-ghost mt-5"
      >
        Include verification request
      </button>
      {data.verificationSubmitted && (
        <div className="mt-4 flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <strong>Pending Review</strong>
            <p className="mt-1 text-xs">
              An ArtDera admin must approve this request before a public verified badge appears.
            </p>
          </div>
        </div>
      )}
    </StepLayout>
  );
}

function ArtworkStep({ data, update, chooseFile }: StepProps & { chooseFile: ImageHandler }) {
  if (!data.addArtwork)
    return (
      <StepLayout
        title="Add your first artwork"
        description="This is optional. You can add work from the dashboard later."
      >
        <button type="button" onClick={() => update("addArtwork", true)} className="btn-primary">
          <ImagePlus className="h-4 w-4" /> Add an artwork now
        </button>
        <div className="mt-6 rounded-xl bg-[var(--ivory)] p-5 text-sm text-muted-foreground">
          Your store can be created without artwork. A helpful checklist will remain in your
          dashboard.
        </div>
      </StepLayout>
    );
  return (
    <StepLayout
      title="Add your first artwork"
      description="Save a draft or send the listing to marketplace review. You can add more images and video later."
    >
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => update("addArtwork", false)}
          className="text-xs font-semibold underline"
        >
          Skip and add later
        </button>
      </div>
      <ImagePicker
        label="Main artwork image"
        value={data.artworkImage}
        onChange={(event) => chooseFile("artworkImage", event)}
        onRemove={() => update("artworkImage", IMAGES.art1)}
      />
      <FieldGrid>
        <Field id="artwork-title" label="Artwork title">
          <input
            id="artwork-title"
            className="art-field"
            value={data.artworkTitle}
            onChange={(event) => update("artworkTitle", event.target.value)}
          />
        </Field>
        <Field id="artwork-year" label="Year created">
          <input
            id="artwork-year"
            type="number"
            className="art-field"
            value={data.artworkYear}
            onChange={(event) => update("artworkYear", event.target.value)}
          />
        </Field>
        <Field id="artwork-description" label="Description" wide>
          <textarea
            id="artwork-description"
            rows={4}
            className="art-field !rounded-xl"
            value={data.artworkDescription}
            onChange={(event) => update("artworkDescription", event.target.value)}
          />
        </Field>
        <Field id="artwork-category" label="Category">
          <select
            id="artwork-category"
            className="art-field"
            value={data.artworkCategory}
            onChange={(event) => update("artworkCategory", event.target.value)}
          >
            {CATEGORIES_LIST.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field id="artwork-medium" label="Medium">
          <input
            id="artwork-medium"
            className="art-field"
            value={data.artworkMedium}
            onChange={(event) => update("artworkMedium", event.target.value)}
          />
        </Field>
        <Field id="artwork-style" label="Style">
          <select
            id="artwork-style"
            className="art-field"
            value={data.artworkStyle}
            onChange={(event) => update("artworkStyle", event.target.value)}
          >
            {STYLES_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field id="artwork-subject" label="Subject">
          <select
            id="artwork-subject"
            className="art-field"
            value={data.artworkSubject}
            onChange={(event) => update("artworkSubject", event.target.value)}
          >
            {SUBJECTS_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field id="artwork-kind" label="Original or print">
          <select
            id="artwork-kind"
            className="art-field"
            value={data.artworkKind}
            onChange={(event) =>
              update("artworkKind", event.target.value as OnboardingData["artworkKind"])
            }
          >
            <option>Original</option>
            <option>Print</option>
            <option>Limited Edition</option>
          </select>
        </Field>
        <Field id="artwork-price" label="Price (Rs.)">
          <input
            id="artwork-price"
            inputMode="numeric"
            className="art-field"
            value={data.artworkPrice}
            onChange={(event) => update("artworkPrice", event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field id="artwork-discount" label="Discount price, optional">
          <input
            id="artwork-discount"
            inputMode="numeric"
            className="art-field"
            value={data.artworkDiscount}
            onChange={(event) => update("artworkDiscount", event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field id="width" label="Width">
          <input
            id="width"
            type="number"
            className="art-field"
            value={data.width}
            onChange={(event) => update("width", event.target.value)}
          />
        </Field>
        <Field id="height" label="Height">
          <input
            id="height"
            type="number"
            className="art-field"
            value={data.height}
            onChange={(event) => update("height", event.target.value)}
          />
        </Field>
        <Field id="depth" label="Depth">
          <input
            id="depth"
            type="number"
            className="art-field"
            value={data.depth}
            onChange={(event) => update("depth", event.target.value)}
          />
        </Field>
        <Field id="unit" label="Measurement unit">
          <select
            id="unit"
            className="art-field"
            value={data.unit}
            onChange={(event) => update("unit", event.target.value)}
          >
            <option>in</option>
          </select>
        </Field>
        <Field id="weight" label="Weight (kg)">
          <input
            id="weight"
            type="number"
            step="0.1"
            className="art-field"
            value={data.weight}
            onChange={(event) => update("weight", event.target.value)}
          />
        </Field>
        <Field id="orientation" label="Orientation">
          <select
            id="orientation"
            className="art-field"
            value={data.orientation}
            onChange={(event) =>
              update("orientation", event.target.value as OnboardingData["orientation"])
            }
          >
            <option>Portrait</option>
            <option>Landscape</option>
            <option>Square</option>
          </select>
        </Field>
        <Field id="quantity" label="Quantity">
          <input
            id="quantity"
            type="number"
            min="1"
            className="art-field"
            value={data.quantity}
            onChange={(event) => update("quantity", event.target.value)}
          />
        </Field>
        <Field id="tags" label="Search tags">
          <input
            id="tags"
            className="art-field"
            value={data.tags}
            onChange={(event) => update("tags", event.target.value)}
          />
        </Field>
        <Toggle
          label="Framed"
          checked={data.framed}
          onChange={(value) => update("framed", value)}
        />
        <Toggle
          label="Certificate of authenticity"
          checked={data.certificate}
          onChange={(value) => update("certificate", value)}
        />
        <Toggle
          label="Save as draft"
          checked={data.artworkDraft}
          onChange={(value) => update("artworkDraft", value)}
        />
      </FieldGrid>
      <div className="mt-7 grid gap-4 rounded-xl bg-[var(--ivory)] p-4 sm:grid-cols-[120px_1fr]">
        <img
          src={data.artworkImage}
          alt="Listing preview"
          className="aspect-[4/5] w-full rounded-lg object-cover"
        />
        <div>
          <div className="eyebrow">Listing preview</div>
          <div className="mt-2 font-display text-2xl">
            {data.artworkTitle || "Untitled artwork"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {data.artworkMedium} · {data.width} × {data.height} {data.unit}
          </div>
          <div className="mt-3 font-semibold">
            {data.artworkPrice ? formatPKR(Number(data.artworkPrice)) : "Add a price"}
          </div>
        </div>
      </div>
    </StepLayout>
  );
}

function ReviewStep({
  data,
  planId,
  billing,
}: {
  data: OnboardingData;
  planId: PlanId;
  billing: BillingCycle;
}) {
  const plan = PLANS[planId];
  const price = billing === "annual" && plan.annualPrice ? plan.annualPrice : plan.monthlyPrice;
  return (
    <StepLayout
      title="Review before creating your store"
      description="Review your store details. Payment status, verification decisions and payout setup remain server-controlled and cannot be changed here."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["Selected plan", `${plan.name} · ${billing}`],
          ["Subscription price", formatPKR(price)],
          ["Commission", `${plan.commission}%`],
          ["Listing limit", plan.listingLimit ?? "Fair-use unlimited"],
          ["Seller", `${data.displayName} · ${data.sellerType}`],
          ["Store", data.storeName],
          ["Store URL", `artdera.com/store/${data.slug}`],
          ["Verification", data.verificationSubmitted ? "Pending Review" : "Not submitted"],
          [
            "First artwork",
            data.addArtwork
              ? `${data.artworkTitle} · ${data.artworkDraft ? "Draft" : "Pending Review"}`
              : "Add later",
          ],
          ["Payout time", plan.payoutTime],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-[var(--color-border)] p-4">
            <div className="eyebrow">{label}</div>
            <div className="mt-2 text-sm font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-3 rounded-xl bg-[var(--ivory)] p-4 text-sm leading-relaxed">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--indigo)]" />
        <p>
          By creating the store, you confirm the terms acknowledgement, ownership declaration and
          return-policy acknowledgement completed in this wizard.
        </p>
      </div>
    </StepLayout>
  );
}

type StepProps = {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
};
type ImageHandler = (
  key: "profileImage" | "coverImage" | "artworkImage",
  event: ChangeEvent<HTMLInputElement>,
) => void;
function StepLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}
function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="mt-6 grid gap-5 sm:grid-cols-2">{children}</div>;
}
function Field({
  id,
  label,
  wide = false,
  children,
}: {
  id: string;
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className="eyebrow mb-2 block">
        {label}
      </label>
      {children}
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label
      className={
        "flex min-h-12 items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold " +
        (disabled ? "cursor-not-allowed bg-[var(--ivory)] text-muted-foreground" : "cursor-pointer")
      }
    >
      <span>
        <span className="block">{label}</span>
        {hint && <span className="mt-1 block text-[10px] font-normal leading-snug">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--oxblood)]"
      />
    </label>
  );
}
function ImagePicker({
  label,
  value,
  landscape = false,
  onChange,
  onRemove,
}: {
  label: string;
  value: string;
  landscape?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      <div className="flex items-center gap-4">
        <img
          src={value}
          alt={`${label} preview`}
          className={`${landscape ? "h-24 w-40" : "h-24 w-24"} rounded-xl object-cover`}
        />
        <div className="grid gap-2">
          <label className="btn-ghost cursor-pointer px-3">
            <UploadCloud className="h-4 w-4" /> Replace
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onChange}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">JPG, PNG or WebP · maximum 5 MB</div>
    </div>
  );
}
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 52);
}
function AccessCard({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="container-editorial flex min-h-[60vh] items-center justify-center py-16">
      <div className="max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-8 text-center">
        <LockKeyhole className="mx-auto h-8 w-8 text-[var(--oxblood)]" />
        <h1 className="mt-5 font-display text-4xl">
          {signedIn ? "Start selling with this account." : "Sign in to continue seller setup."}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {signedIn
            ? "Choose a plan to add a seller profile while keeping your orders, wishlist and messages."
            : "Your selected plan is still saved for this browser session."}
        </p>
        <Link
          to={signedIn ? "/sell/plans" : "/auth/login"}
          search={signedIn ? undefined : { redirect: "/artist/onboarding" }}
          className="btn-primary mt-6"
        >
          {signedIn ? "Choose a plan" : "Sign in"}
        </Link>
      </div>
    </div>
  );
}
