import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Check, CheckCircle2, Eye, EyeOff, KeyRound, ShieldAlert } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Logo } from "@/components/site/Logo";
import { IMAGES } from "@/lib/artdera";
import { AuthService } from "@/marketplace/services";

// ---------------------------------------------------------------------------
// Route definition — reads ?token= from the URL search params
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/auth/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [{ title: "Reset Password — ArtDera" }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPassword,
});

// ---------------------------------------------------------------------------
// Password policy — must mirror server/routes/auth.ts passwordSchema exactly
// ---------------------------------------------------------------------------
function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Add an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Add a lowercase letter.";
  if (!/\d/.test(password)) return "Add a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add a symbol (e.g. ! @ # $).";
  if (password.length > 128) return "Password must be 128 characters or fewer.";
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Stage = "form" | "success" | "invalid";

function ResetPassword() {
  const { token } = useSearch({ from: "/auth/reset-password" });

  const [stage, setStage] = useState<Stage>(token ? "form" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [invalidReason, setInvalidReason] = useState<"expired" | "generic">("generic");

  // Live password strength indicators (same as signup page)
  const checks = useMemo(
    () => [
      [password.length >= 8, "8+ characters"] as const,
      [/[A-Z]/.test(password), "Uppercase letter"] as const,
      [/[a-z]/.test(password), "Lowercase letter"] as const,
      [/\d/.test(password), "Number"] as const,
      [/[^A-Za-z0-9]/.test(password), "Symbol"] as const,
      [Boolean(confirm) && password === confirm, "Passwords match"] as const,
    ],
    [password, confirm],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");

    // Client-side validation (backend validates server-side too)
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setStage("invalid");
      return;
    }

    setLoading(true);
    const result = await AuthService.resetPassword(token, password, confirm);
    setLoading(false);

    if (result.error) {
      if (
        result.error.code === "INVALID_OR_EXPIRED_TOKEN" ||
        result.error.code === "VALIDATION_ERROR"
      ) {
        setInvalidReason("expired");
        setStage("invalid");
      } else {
        setError(result.error.message || "Something went wrong. Please try again.");
      }
      return;
    }

    setStage("success");
  }

  // ── Invalid / expired token screen ────────────────────────────────────────
  if (stage === "invalid") {
    return (
      <div className="grid min-h-[calc(100vh-var(--header-height))] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-md">
            <Logo />
            <div className="mt-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-200 bg-red-50">
                <ShieldAlert className="h-6 w-6 text-red-600" />
              </div>
              <h1 className="mt-6 font-display text-4xl">Link expired.</h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {invalidReason === "expired"
                  ? "This password reset link has expired or has already been used."
                  : "This password reset link is invalid."}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Reset links expire after 30 minutes and can only be used once.
              </p>
              <Link
                to="/auth/forgot-password"
                id="request-new-link"
                className="btn-primary mt-8 inline-flex"
              >
                Request a new link
              </Link>
              <div className="mt-4">
                <Link to="/auth/login" className="text-sm font-semibold text-foreground underline">
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="relative hidden overflow-hidden lg:block">
          <img
            src={IMAGES.heroStudio}
            alt="Art studio interior"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)]/85 via-transparent to-transparent" />
        </div>
      </div>
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (stage === "success") {
    return (
      <div className="grid min-h-[calc(100vh-var(--header-height))] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-md">
            <Logo />
            <div className="mt-12 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-[var(--success)]" />
              <h1 className="mt-6 font-display text-4xl">Password updated.</h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Your ArtDera password has been changed successfully.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                All previous sessions have been signed out for your security. Sign in with your new
                password to continue.
              </p>
              <Link
                to="/auth/login"
                id="reset-password-sign-in"
                className="btn-primary mt-8 inline-flex min-w-[200px]"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
        <div className="relative hidden overflow-hidden lg:block">
          <img
            src={IMAGES.heroStudio}
            alt="Art studio interior"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)]/85 via-transparent to-transparent" />
        </div>
      </div>
    );
  }

  // ── Reset-password form ────────────────────────────────────────────────────
  return (
    <div className="grid min-h-[calc(100vh-var(--header-height))] lg:grid-cols-[1.05fr_0.95fr]">
      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Logo />
          <div className="eyebrow mt-10">Account security</div>
          <h1 className="mt-3 font-display text-5xl">Create a new password.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Choose a strong, unique password for your ArtDera account.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            {/* New password */}
            <label className="block">
              <span className="eyebrow mb-2 block">New password</span>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type={show ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  className="art-field pr-12"
                  aria-describedby={error ? "rp-error" : "rp-hints"}
                  aria-invalid={Boolean(error)}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full hover:bg-[var(--ivory)]"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {/* Confirm password */}
            <label className="block">
              <span className="eyebrow mb-2 block">Confirm new password</span>
              <input
                id="reset-confirm-password"
                type={show ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (error) setError("");
                }}
                className="art-field"
              />
            </label>

            {/* Password strength indicators */}
            <div id="rp-hints" className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              {checks.map(([met, label]) => (
                <span key={label} className={met ? "text-[var(--success)]" : ""}>
                  <Check className="mr-1 inline h-3.5 w-3.5" />
                  {label}
                </span>
              ))}
            </div>

            {/* Error message */}
            {error && (
              <div
                id="rp-error"
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              id="reset-password-submit"
              disabled={loading}
              className="btn-primary min-h-12 w-full disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Resetting Password…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Reset Password
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/auth/login" className="font-semibold text-foreground underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Image panel (lg+) */}
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={IMAGES.heroStudio}
          alt="Art studio interior"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)]/85 via-transparent to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 rounded-2xl border border-white/12 bg-black/28 p-6 text-white backdrop-blur-xl">
          <KeyRound className="h-6 w-6 text-[var(--terracotta)]" />
          <div className="mt-4 font-display text-3xl">A new password. A fresh start.</div>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/62">
            Once reset, all existing sessions will be signed out so only you have access.
          </p>
        </div>
      </div>
    </div>
  );
}
