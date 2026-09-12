import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronLeft, Eye, EyeOff, Info, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { isPlanId, validBillingCycle } from "@/config/subscription-plans";
import { formatPKR, PLANS } from "@/marketplace/config";
import {
  AuthService,
  SignupProgressService,
  SubscriptionService,
  UserService,
} from "@/marketplace/services";
import type { BillingCycle, PlanId, UserRole } from "@/marketplace/types";
import { useAuth } from "@/marketplace/auth";

export const Route = createFileRoute("/artist/signup")({
  head: () => ({
    meta: [
      { title: "Create Your Artist Account — ArtDera" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ArtistSignup,
});

type SellerType = "Individual Artist" | "Professional Artist" | "Gallery" | "Art Business";
type SignupDraft = {
  fullName: string;
  email: string;
  mobile: string;
  sellerType: SellerType;
  city: string;
  province: string;
  terms: boolean;
};

const blank: SignupDraft = {
  fullName: "",
  email: "",
  mobile: "+92 ",
  sellerType: "Individual Artist",
  city: "",
  province: "Punjab",
  terms: false,
};

function ArtistSignup() {
  const { user, ready } = useAuth();
  const [selectionReady, setSelectionReady] = useState(false);
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [account, setAccount] = useState<SignupDraft>(blank);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && user) window.location.replace("/sell/plans");
  }, [ready, user]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const queryPlan = params.get("plan");
    if (!isPlanId(queryPlan)) {
      setSelectionReady(true);
      window.location.replace("/sell/plans");
      return;
    }
    const cycle = validBillingCycle(queryPlan, params.get("billing"));
    void SubscriptionService.selectPlan(queryPlan, cycle).then((result) => {
      if (!active) return;
      if (result.error || !result.data) {
        setError(result.error?.message ?? "That plan is not available.");
        setSelectionReady(true);
        return;
      }
      const selection = result.data;
      const saved = SignupProgressService.read<SignupDraft>(blank);
      setPlanId(selection.planId);
      setBilling(selection.billingCycle);
      setAccount({
        ...saved,
        sellerType:
          selection.planId === "gallery" && !["Gallery", "Art Business"].includes(saved.sellerType)
            ? "Gallery"
            : saved.sellerType,
      });
      setSelectionReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectionReady && planId) SignupProgressService.save(account);
  }, [account, planId, selectionReady]);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      match: Boolean(confirm) && password === confirm,
    }),
    [confirm, password],
  );
  const strength = Object.values(passwordChecks).filter(Boolean).length;
  const fieldErrors = {
    fullName: account.fullName.trim().length < 2 ? "Enter your full name." : "",
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) ? "Enter a valid email address." : "",
    mobile: !/^\+?[\d\s-]{10,18}$/.test(account.mobile.trim())
      ? "Enter a valid mobile number with country code."
      : "",
    city: account.city.trim().length < 2 ? "Enter your city." : "",
    password: !Object.values(passwordChecks).slice(0, 5).every(Boolean)
      ? "Use 8+ characters with uppercase, lowercase, number and symbol."
      : "",
    confirm: !passwordChecks.match ? "Passwords must match." : "",
    terms: !account.terms ? "Accept the Terms and Privacy Policy." : "",
  };
  const valid = Object.values(fieldErrors).every((value) => !value);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (!valid || !planId) return;
    setLoading(true);
    const role: UserRole = ["Gallery", "Art Business"].includes(account.sellerType)
      ? "gallery"
      : "artist";
    const result = await UserService.create({
      ...account,
      fullName: account.fullName,
      role,
      country: "Pakistan",
      password,
      planId,
    });
    setLoading(false);
    if (result.error) return setError(result.error.message);
    if (!result.data) return setError("Your account could not be created. Please try again.");
    AuthService.startSession(result.data);
    SubscriptionService.attachUser(result.data.id);
    SignupProgressService.clear();
    window.location.assign(
      planId === "free" ? "/artist/onboarding?activated=free" : "/artist/checkout",
    );
  }

  if (!ready || user || !selectionReady) return <PageLoading />;
  if (!planId)
    return (
      <div className="container-editorial flex min-h-[65vh] items-center justify-center py-16">
        <div className="max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-8 text-center">
          <Info className="mx-auto h-8 w-8 text-[var(--terracotta)]" />
          <h1 className="mt-4 font-display text-4xl">Choose a plan to continue.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your signup starts with a valid ArtDera subscription choice. Taking you back to plans…
          </p>
          <Link to="/sell/plans" className="btn-primary mt-6">
            View plans
          </Link>
        </div>
      </div>
    );

  const plan = PLANS[planId];
  const price = SubscriptionService.getSelection()?.price ?? plan.monthlyPrice;
  return (
    <div className="container-editorial py-10 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/sell/plans" className="inline-flex items-center gap-2 text-sm font-semibold">
            <ChevronLeft className="h-4 w-4" /> Change Plan
          </Link>
          <div className="text-xs text-muted-foreground">
            Account → Verification → {planId === "free" ? "Store setup" : "Payment"}
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="h-fit rounded-2xl bg-[var(--ink)] p-6 text-[var(--ivory)] lg:sticky lg:top-28">
            <div className="eyebrow !text-white/50">Selected plan</div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-4xl">{plan.name}</h1>
                <p className="mt-1 text-xs text-white/55 capitalize">
                  {billing === "free" ? "No billing" : `${billing} billing`}
                </p>
              </div>
              {plan.recommended && (
                <span className="rounded-full bg-[var(--terracotta)] px-3 py-1 text-xs font-bold text-[var(--ink)]">
                  Popular
                </span>
              )}
            </div>
            <div className="mt-6 font-display text-4xl">
              {formatPKR(price)}
              <span className="ml-1 font-sans text-xs text-white/50">
                {billing === "free" ? "forever" : billing === "annual" ? "/year" : "/month"}
              </span>
            </div>
            <div className="mt-5 grid gap-2 border-y border-white/10 py-4 text-xs text-white/65">
              <div className="flex justify-between">
                <span>Commission</span>
                <strong>{plan.commission}%</strong>
              </div>
              <div className="flex justify-between">
                <span>Listings</span>
                <strong>{plan.listingLimit ?? "Fair-use unlimited"}</strong>
              </div>
            </div>
            <ul className="mt-5 space-y-3">
              {plan.features.slice(0, 5).map((feature) => (
                <li key={feature} className="flex gap-2 text-sm text-white/75">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--terracotta)]" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link to="/sell/plans" className="btn-ghost mt-7 w-full !border-white/20 !text-white">
              Change Plan
            </Link>
            <div className="mt-6 flex gap-2 border-t border-white/10 pt-5 text-xs leading-relaxed text-white/55">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--terracotta)]" />
              Private account and identity details are protected and never shown publicly.
            </div>
          </aside>
          <main className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 sm:p-6 md:p-8">
            <div className="eyebrow">Create artist account</div>
            <h2 className="mt-3 font-display text-4xl">Begin your ArtDera store.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              All fields are validated before your account moves to email verification.
            </p>
            <form onSubmit={submit} noValidate className="mt-8 grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" error={submitted ? fieldErrors.fullName : ""}>
                  <input
                    className="art-field"
                    autoComplete="name"
                    value={account.fullName}
                    onChange={(e) => setAccount({ ...account, fullName: e.target.value })}
                  />
                </Field>
                <Field label="Email address" error={submitted ? fieldErrors.email : ""}>
                  <input
                    className="art-field"
                    type="email"
                    autoComplete="email"
                    value={account.email}
                    onChange={(e) => setAccount({ ...account, email: e.target.value })}
                  />
                </Field>
                <Field label="Mobile number" error={submitted ? fieldErrors.mobile : ""}>
                  <input
                    className="art-field"
                    inputMode="tel"
                    autoComplete="tel"
                    value={account.mobile}
                    onChange={(e) => setAccount({ ...account, mobile: e.target.value })}
                  />
                </Field>
                <Field label="Seller type">
                  <select
                    className="art-field"
                    value={account.sellerType}
                    onChange={(e) =>
                      setAccount({ ...account, sellerType: e.target.value as SellerType })
                    }
                  >
                    {(planId === "gallery"
                      ? ["Gallery", "Art Business"]
                      : ["Individual Artist", "Professional Artist", "Gallery", "Art Business"]
                    ).map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="City" error={submitted ? fieldErrors.city : ""}>
                  <input
                    className="art-field"
                    value={account.city}
                    onChange={(e) => setAccount({ ...account, city: e.target.value })}
                  />
                </Field>
                <Field label="Province">
                  <select
                    className="art-field"
                    value={account.province}
                    onChange={(e) => setAccount({ ...account, province: e.target.value })}
                  >
                    {[
                      "Punjab",
                      "Sindh",
                      "Khyber Pakhtunkhwa",
                      "Balochistan",
                      "Islamabad Capital Territory",
                      "Gilgit-Baltistan",
                      "Azad Jammu & Kashmir",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Password" error={submitted ? fieldErrors.password : ""}>
                  <div className="relative">
                    <input
                      className="art-field pr-12"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full hover:bg-[var(--ivory)]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm password" error={submitted ? fieldErrors.confirm : ""}>
                  <input
                    className="art-field"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </Field>
              </div>
              <div className="rounded-xl bg-[var(--ivory)] p-4">
                <div className="flex justify-between text-sm">
                  <strong>Password strength</strong>
                  <span className="text-xs text-muted-foreground">
                    {strength < 3 ? "Keep going" : strength < 6 ? "Good" : "Strong"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-6 gap-1">
                  {Array.from({ length: 6 }, (_, index) => (
                    <span
                      key={index}
                      className={`h-1.5 rounded-full ${index < strength ? (strength === 6 ? "bg-[var(--success)]" : "bg-[var(--terracotta)]") : "bg-[var(--color-border)]"}`}
                    />
                  ))}
                </div>
                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                  {[
                    [passwordChecks.length, "At least 8 characters"],
                    [passwordChecks.uppercase, "One uppercase letter"],
                    [passwordChecks.lowercase, "One lowercase letter"],
                    [passwordChecks.number, "One number"],
                    [passwordChecks.special, "One special character"],
                    [passwordChecks.match, "Passwords match"],
                  ].map(([met, label]) => (
                    <span
                      key={String(label)}
                      className={`flex items-center gap-2 ${met ? "text-[var(--success)]" : "text-muted-foreground"}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {String(label)}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                  <input
                    type="checkbox"
                    checked={account.terms}
                    onChange={(e) => setAccount({ ...account, terms: e.target.checked })}
                    className="mt-1 accent-[var(--oxblood)]"
                  />
                  <span>
                    I agree to the{" "}
                    <a href="/legal/terms" className="underline">
                      Terms and Conditions
                    </a>{" "}
                    and{" "}
                    <a href="/legal/privacy" className="underline">
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
                {submitted && fieldErrors.terms && (
                  <p className="mt-2 text-xs text-red-700">{fieldErrors.terms}</p>
                )}
              </div>
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  {error}
                </div>
              )}
              <button
                disabled={loading || (submitted && !valid)}
                className="btn-primary min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating your secure account…" : "Create account and verify"}
              </button>
            </form>
            <div className="mt-5 flex gap-3 text-xs leading-relaxed text-muted-foreground">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[var(--indigo)]" />
              <p>
                Your password is one-way hashed by the server. Secure sessions and role-based access
                controls protect your account.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
      {error && <span className="mt-2 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

function PageLoading() {
  return (
    <div className="container-editorial py-16">
      <div className="mx-auto h-64 max-w-6xl animate-pulse rounded-2xl bg-[var(--porcelain)]" />
    </div>
  );
}
