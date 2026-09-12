import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff, Info, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/site/Logo";
import { IMAGES } from "@/lib/artdera";
import { AuthService } from "@/marketplace/services";
import { useAuth } from "@/marketplace/auth";

type LoginSearch = {
  redirect?: string;
  returnTo?: string;
};

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    returnTo: typeof search.return === "string" ? search.return : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — ArtDera" }, { name: "robots", content: "noindex" }] }),
  component: Login,
});

function safeInternalPath(value?: string) {
  if (
    !value ||
    value.length > 2_048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(value)
  )
    return undefined;
  try {
    const parsed = new URL(value, "https://redirect.artdera.invalid");
    if (parsed.origin !== "https://redirect.artdera.invalid") return undefined;
    if (parsed.pathname === "/auth/login") return undefined;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return undefined;
  }
}

function Login() {
  const { user, ready, refresh } = useAuth();
  const search = Route.useSearch();
  const requestedDestination =
    safeInternalPath(search.redirect) ?? safeInternalPath(search.returnTo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && user) window.location.replace(requestedDestination ?? AuthService.destination());
  }, [ready, requestedDestination, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const result = await AuthService.login(email, password);
    if (result.error) {
      setLoading(false);
      return setError(result.error.message);
    }
    if (!result.data) {
      setLoading(false);
      return setError("Your account could not be opened. Please try again.");
    }
    await refresh();
    window.location.assign(requestedDestination ?? AuthService.destination());
  }
  return (
    <div className="grid min-h-[calc(100vh-var(--header-height))] lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Logo />
          <div className="eyebrow mt-10">Your ArtDera account</div>
          <h1 className="mt-3 font-display text-5xl">Welcome back.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Sign in to collecting, your store or the ArtDera operations workspace.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block">
              <span className="eyebrow mb-2 block">Email address</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="art-field"
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-2 block">Password</span>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="art-field pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShow((value) => !value)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full hover:bg-[var(--ivory)]"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-[var(--oxblood)]" /> Remember this browser
              </label>
              <Link
                to="/auth/forgot-password"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {error}
              </div>
            )}
            <button disabled={loading} className="btn-primary min-h-12 w-full disabled:opacity-60">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            New buyer?{" "}
            <Link to="/auth/signup" className="font-semibold text-foreground underline">
              Create an account
            </Link>
            <span className="mx-2">·</span>Seller signup?{" "}
            <Link to="/sell/plans" className="font-semibold text-foreground underline">
              Choose a plan
            </Link>
          </div>
          <div className="mt-5 flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <LockKeyhole className="h-4 w-4 shrink-0" />
            Your session uses a secure, HTTP-only cookie and every protected action is authorized by
            the server.
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={IMAGES.heroStudio}
          alt="Art-filled studio interior"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)]/85 via-transparent to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 rounded-2xl border border-white/12 bg-black/28 p-6 text-white backdrop-blur-xl">
          <ShieldCheck className="h-6 w-6 text-[var(--terracotta)]" />
          <div className="mt-4 font-display text-3xl">One account. The right workspace.</div>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/62">
            Artists, galleries and buyers are routed to the tools meant for their role.
          </p>
        </div>
      </div>
    </div>
  );
}
