import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Logo } from "@/components/site/Logo";
import { IMAGES } from "@/lib/artdera";
import { UserService } from "@/marketplace/services";
import { useAuth } from "@/marketplace/auth";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({
    meta: [{ title: "Create Buyer Account — ArtDera" }, { name: "robots", content: "noindex" }],
  }),
  component: Signup,
});
function Signup() {
  const { refresh } = useAuth();
  const [stage, setStage] = useState<"account" | "done">("account");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    city: "Islamabad",
    terms: false,
  });
  const valid = useMemo(
    () =>
      form.password.length >= 8 &&
      /[A-Z]/.test(form.password) &&
      /[a-z]/.test(form.password) &&
      /\d/.test(form.password) &&
      form.password === form.confirm,
    [form],
  );
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (!valid)
      return setError(
        "Use at least 8 characters with uppercase, lowercase and a number, then confirm the same password.",
      );
    if (!form.terms) return setError("Please agree to the Terms and Privacy Policy.");
    setLoading(true);
    try {
      const result = await UserService.create({
        fullName: form.name,
        email: form.email,
        password: form.password,
        city: form.city,
        country: "Pakistan",
        role: "buyer",
        termsAccepted: form.terms,
        privacyAccepted: form.terms,
      });
      if (result.error) return setError(result.error.message);
      if (!result.data) return setError("Your account could not be created.");
      await refresh();
      setStage("done");
      window.setTimeout(() => (window.location.href = "/account"), 700);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="grid min-h-[calc(100vh-var(--header-height))] lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img
          src={IMAGES.heroInterior}
          alt="Art in a contemporary interior"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <div className="font-display text-4xl">
            Save work. Follow artists. Collect with context.
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Logo />
          {stage === "done" ? (
            <div className="mt-12 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-[var(--success)]" />
              <h1 className="mt-5 font-display text-4xl">Your buyer account is ready.</h1>
              <p className="mt-3 text-sm text-muted-foreground">Opening your collector account…</p>
            </div>
          ) : (
            <>
              <div className="eyebrow mt-10">Buyer account</div>
              <h1 className="mt-3 font-display text-5xl">Start collecting.</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Save work, follow studios, manage offers and track orders.
              </p>
              <form onSubmit={submit} className="mt-8 grid gap-5">
                <label>
                  <span className="eyebrow mb-2 block">Full name</span>
                  <input
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    className="art-field"
                  />
                </label>
                <label>
                  <span className="eyebrow mb-2 block">Email</span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className="art-field"
                  />
                </label>
                <label>
                  <span className="eyebrow mb-2 block">City</span>
                  <input
                    required
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                    className="art-field"
                  />
                </label>
                <label>
                  <span className="eyebrow mb-2 block">Password</span>
                  <div className="relative">
                    <input
                      required
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(event) => setForm({ ...form, password: event.target.value })}
                      className="art-field pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((value) => !value)}
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center"
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                <label>
                  <span className="eyebrow mb-2 block">Confirm password</span>
                  <input
                    required
                    type={show ? "text" : "password"}
                    value={form.confirm}
                    onChange={(event) => setForm({ ...form, confirm: event.target.value })}
                    className="art-field"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {[
                    [form.password.length >= 8, "8+ characters"],
                    [/[A-Z]/.test(form.password), "Uppercase"],
                    [/[a-z]/.test(form.password), "Lowercase"],
                    [/\d/.test(form.password), "Number"],
                    [Boolean(form.confirm) && form.password === form.confirm, "Passwords match"],
                  ].map(([met, label]) => (
                    <span key={label as string} className={met ? "text-[var(--success)]" : ""}>
                      <Check className="mr-1 inline h-3.5 w-3.5" />
                      {label as string}
                    </span>
                  ))}
                </div>
                <label className="flex items-start gap-3 text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    checked={form.terms}
                    onChange={(event) => setForm({ ...form, terms: event.target.checked })}
                    className="mt-1 accent-[var(--oxblood)]"
                  />
                  I agree to the{" "}
                  <a href="/legal/terms" className="underline">
                    Terms
                  </a>{" "}
                  and{" "}
                  <a href="/legal/privacy" className="underline">
                    Privacy Policy
                  </a>
                  .
                </label>
                {error && (
                  <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account…
                    </span>
                  ) : (
                    "Create buyer account"
                  )}
                </button>
              </form>
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/auth/login" className="font-semibold text-foreground underline">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
