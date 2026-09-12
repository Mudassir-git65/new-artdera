import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Copy, ImageUp, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/marketplace/auth";
import { formatPKR } from "@/marketplace/config";
import {
  ManualPaymentService,
  UploadService,
  type GenericManualPaymentDetails,
} from "@/marketplace/services";

export const Route = createFileRoute("/payment/$paymentId")({
  head: () => ({
    meta: [
      { title: "Submit Payment Proof — ArtDera" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ManualPaymentPage,
});

function ManualPaymentPage() {
  const { paymentId } = Route.useParams();
  const { user, ready } = useAuth();
  const [details, setDetails] = useState<GenericManualPaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void ManualPaymentService.get(paymentId).then((result) => {
      if (result.data) setDetails(result.data);
      else setError(result.error?.message ?? "Payment details could not be loaded.");
      setLoading(false);
    });
  }, [paymentId, ready, user]);

  if (!ready || loading)
    return (
      <div className="container-editorial py-20 text-center text-sm text-muted-foreground">
        Loading secure payment instructions…
      </div>
    );

  if (!user)
    return (
      <div className="container-editorial py-20 text-center">
        <h1 className="font-display text-5xl">Sign in to continue.</h1>
        <a
          href={`/auth/login?redirect=${encodeURIComponent(`/payment/${paymentId}`)}`}
          className="btn-primary mt-6"
        >
          Sign In
        </a>
      </div>
    );

  if (error || !details)
    return (
      <div className="container-editorial py-20 text-center">
        <h1 className="font-display text-5xl">Payment could not be opened.</h1>
        <p role="alert" className="mx-auto mt-4 max-w-xl text-sm text-red-700">
          {error || "The payment does not exist or does not belong to this account."}
        </p>
        <Link to="/" className="btn-ghost mt-6">
          Return Home
        </Link>
      </div>
    );

  if (submitted)
    return (
      <div className="container-editorial flex min-h-[70vh] items-center justify-center py-14">
        <div className="max-w-2xl rounded-3xl bg-[var(--ink)] p-8 text-center text-[var(--ivory)] md:p-12">
          <CheckCircle2 className="mx-auto h-16 w-16 text-[var(--terracotta)]" />
          <div className="eyebrow mt-7 !text-white/45">Pending Verification</div>
          <h1 className="mt-3 font-display text-5xl">Payment proof received.</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/65">
            ArtDera will review the transfer before activating this purchase. It has not been marked
            as paid yet.
          </p>
          <a
            href={details.returnPath}
            className="btn-primary mt-7 bg-[var(--terracotta)] !text-[var(--ink)]"
          >
            View Details
          </a>
        </div>
      </div>
    );

  return (
    <div className="container-editorial py-10 lg:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="eyebrow">Manual payment</div>
        <h1 className="mt-2 font-display text-5xl">Pay the exact amount, then send proof.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your purchase stays pending until an ArtDera administrator verifies the transfer.
        </p>
        <PaymentInstructions details={details} />
        {details.canSubmit ? (
          <ProofForm
            paymentId={paymentId}
            defaultName={user.fullName}
            defaultMobile={user.mobile ?? ""}
            onSubmitted={() => setSubmitted(true)}
          />
        ) : (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <strong>{details.latestProof?.status ?? details.payment.status}</strong>
            <p className="mt-1">
              {details.latestProof?.rejectionReason ??
                "This payment proof is already being reviewed. You cannot submit a duplicate."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentInstructions({ details }: { details: GenericManualPaymentDetails }) {
  const instructions = details.paymentInstructions;
  const [copied, setCopied] = useState<"number" | "amount" | null>(null);

  async function copy(value: string, key: "number" | "amount") {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1_500);
  }

  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)]">
      <div className="bg-[var(--ink)] p-5 text-[var(--ivory)] sm:p-6">
        <div className="eyebrow !text-white/45">{instructions.label}</div>
        <h2 className="mt-2 font-display text-3xl">{instructions.referenceLabel}</h2>
      </div>
      <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2 sm:p-6">
        <div>
          <dt className="text-xs text-muted-foreground">Account title</dt>
          <dd className="mt-1 font-semibold">{instructions.accountTitle}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Account number</dt>
          <dd className="mt-1 flex items-center gap-2 font-semibold">
            {instructions.accountNumber}
            <button
              type="button"
              onClick={() => void copy(instructions.accountNumber, "number")}
              aria-label="Copy account number"
              className="rounded-md p-1 hover:bg-[var(--ivory)]"
            >
              {copied === "number" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Exact amount</dt>
          <dd className="mt-1 flex items-center gap-2 font-display text-3xl">
            {formatPKR(instructions.amount)}
            <button
              type="button"
              onClick={() => void copy(String(instructions.amount), "amount")}
              aria-label="Copy exact amount"
              className="rounded-md p-1 hover:bg-[var(--ivory)]"
            >
              {copied === "amount" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </dd>
        </div>
      </dl>
      <div className="flex gap-3 border-t border-[var(--color-border)] bg-[var(--ivory)] p-5 text-xs leading-relaxed text-muted-foreground sm:p-6">
        <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--oxblood)]" />
        <p>{instructions.instruction} Never share a wallet PIN, OTP, or password.</p>
      </div>
    </section>
  );
}

function ProofForm({
  paymentId,
  defaultName,
  defaultMobile,
  onSubmitted,
}: {
  paymentId: string;
  defaultName: string;
  defaultMobile: string;
  onSubmitted: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const nextPreview = URL.createObjectURL(file);
    setPreview(nextPreview);
    return () => URL.revokeObjectURL(nextPreview);
  }, [file]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const upload = await UploadService.upload(file, "payment_proof");
    if (upload.error) {
      setError(upload.error.message);
      setSubmitting(false);
      return;
    }
    const result = await ManualPaymentService.submitProof(paymentId, {
      fullName: String(form.get("fullName") ?? ""),
      mobileNumber: String(form.get("mobileNumber") ?? ""),
      transactionId: String(form.get("transactionId") ?? ""),
      screenshotId: upload.data!.id,
      note: String(form.get("note") ?? "") || undefined,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    onSubmitted();
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-2xl border border-[var(--color-border)] p-5 sm:p-6"
    >
      <div className="eyebrow">Payment proof</div>
      <h2 className="mt-2 font-display text-3xl">Submit your transfer details.</h2>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Full name
          <input
            name="fullName"
            required
            minLength={2}
            defaultValue={defaultName}
            className="art-field mt-2"
          />
        </label>
        <label className="text-sm font-semibold">
          Sending mobile number
          <input
            name="mobileNumber"
            required
            minLength={7}
            defaultValue={defaultMobile}
            className="art-field mt-2"
          />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Transaction ID
          <input
            name="transactionId"
            required
            minLength={4}
            className="art-field mt-2"
            placeholder="Enter the transfer transaction ID"
          />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Screenshot (JPG, PNG or WebP; maximum 5 MB)
          <span className="mt-2 flex min-h-36 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--ivory)] p-4">
            {preview ? (
              <img
                src={preview}
                alt="Payment proof preview"
                className="max-h-64 rounded-lg object-contain"
              />
            ) : (
              <span className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <ImageUp className="h-8 w-8" /> Choose screenshot
              </span>
            )}
            <input
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                if (selected && selected.size > 5 * 1024 * 1024) {
                  setFile(null);
                  setError("The screenshot must be 5 MB or smaller.");
                  return;
                }
                setError("");
                setFile(selected);
              }}
            />
          </span>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Note (optional)
          <textarea name="note" maxLength={1000} className="art-field mt-2 min-h-24 resize-y" />
        </label>
      </div>
      <button
        disabled={!file || submitting}
        className="btn-primary mt-5 w-full disabled:opacity-45"
      >
        {submitting ? "Uploading and submitting…" : "Submit Payment Proof"}
      </button>
    </form>
  );
}
