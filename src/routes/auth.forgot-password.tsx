import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, SendHorizonal } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/site/Logo";
import { IMAGES } from "@/lib/artdera";
import { AuthService } from "@/marketplace/services";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [{ title: "Forgot Password — ArtDera" }, { name: "robots", content: "noindex" }],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    // Basic client-side email validation for instant UX feedback
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    const result = await AuthService.forgotPassword(trimmed);
    setLoading(false);

    if (result.error) {
      // Only surface a real error if it's not the generic anti-enumeration response
      if (result.error.code === "RATE_LIMITED") {
        setError(result.error.message);
      } else if (result.error.code === "EMAIL_SEND_FAILED") {
        setError(result.error.message);
      } else {
        // Treat any other API error the same as success (anti-enumeration)
        setSent(true);
      }
      return;
    }

    setSent(true);
  }

  return (
    <div className="grid min-h-[calc(100vh-var(--header-height))] lg:grid-cols-[1.05fr_0.95fr]">
      {/* ── Form panel ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Logo />

          {sent ? (
            /* ── Success state ── */
            <div className="mt-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ivory)] border border-[var(--border)]">
                <Mail className="h-6 w-6 text-[var(--oxblood)]" />
              </div>
              <h1 className="mt-6 font-display text-4xl">Check your email.</h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                If an ArtDera account exists for{" "}
                <strong className="text-foreground">{email.trim()}</strong>, we've sent a password
                reset link.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The link will expire in <strong className="text-foreground">30 minutes</strong>.
              </p>
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--ivory)] p-4 text-xs leading-relaxed text-muted-foreground">
                Didn't receive it? Check your spam folder, or{" "}
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                  }}
                  className="font-semibold text-foreground underline"
                >
                  try a different email address
                </button>
                .
              </div>
              <Link
                to="/auth/login"
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-foreground underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="eyebrow mt-10">Account recovery</div>
              <h1 className="mt-3 font-display text-5xl">Forgot your password?</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Enter the email address associated with your ArtDera account and we'll send you a
                secure link to reset your password.
              </p>

              <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
                <label className="block">
                  <span className="eyebrow mb-2 block">Email address</span>
                  <input
                    id="forgot-password-email"
                    type="email"
                    required
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    className="art-field"
                    placeholder="you@example.com"
                    aria-describedby={error ? "fp-error" : undefined}
                    aria-invalid={Boolean(error)}
                  />
                </label>

                {error && (
                  <div
                    id="fp-error"
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  id="forgot-password-submit"
                  className="btn-primary min-h-12 w-full disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Sending…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <SendHorizonal className="h-4 w-4" />
                      Send Reset Link
                    </span>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                <Link
                  to="/auth/login"
                  className="inline-flex items-center gap-1.5 font-semibold text-foreground underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Image panel (lg+) ──────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={IMAGES.heroStudio}
          alt="Art studio interior"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)]/85 via-transparent to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 rounded-2xl border border-white/12 bg-black/28 p-6 text-white backdrop-blur-xl">
          <Mail className="h-6 w-6 text-[var(--terracotta)]" />
          <div className="mt-4 font-display text-3xl">Secure account recovery.</div>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/62">
            We'll send a single-use link to your email address. The link expires in 30 minutes and
            works only once.
          </p>
        </div>
      </div>
    </div>
  );
}
