import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldAlert,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  Mail,
  Info,
  ArrowRight,
  User,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/marketplace/auth";
import { AccountDeletionService } from "@/marketplace/services";

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete Account — ArtDera" },
      {
        name: "description",
        content:
          "Submit an account deletion request for your ArtDera account in compliance with Google Play Store requirements.",
      },
    ],
  }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reasonCategory, setReasonCategory] = useState("no_longer_needed");
  const [customReason, setCustomReason] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    requestId: string;
    email: string;
    alreadySubmitted?: boolean;
  } | null>(null);

  useEffect(() => {
    if (user) {
      if (user.fullName) setName(user.fullName);
      if (user.email) setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return toast.error("Please enter your full name.");
    }
    if (!email.trim() || !email.includes("@")) {
      return toast.error("Please enter your registered email address.");
    }
    if (!confirmation) {
      return toast.error("Please confirm that you are the owner of this account.");
    }

    setIsSubmitting(true);
    try {
      const fullReasonText =
        reasonCategory === "other"
          ? customReason.trim()
          : `${reasonCategory.replaceAll("_", " ")}${customReason.trim() ? `: ${customReason.trim()}` : ""}`;

      const res = await AccountDeletionService.submitRequest({
        name: name.trim(),
        email: email.trim(),
        reason: fullReasonText,
        confirmation,
      });

      if (res.error) {
        toast.error(res.error.message);
      } else if (res.data) {
        setSubmittedResult({
          requestId: res.data.requestId,
          email: res.data.email || email.trim(),
        });
        toast.success("Account deletion request submitted.");
      }
    } catch {
      toast.error("An unexpected error occurred while submitting your request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-[#f6f2eb] py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-10">
        {/* Header Banner */}
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--ink)] p-8 text-[var(--ivory)] md:p-12 shadow-xl">
          <div className="eyebrow !text-white/45">Data Privacy & Account Control</div>
          <div className="mt-3 flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-[var(--terracotta)] shrink-0" />
            <h1 className="font-display text-4xl sm:text-5xl">Delete Your ArtDera Account</h1>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">
            In compliance with Google Play Store guidelines and international data privacy regulations, ArtDera provides a transparent, secure process for requesting permanent account and data deletion.
          </p>
          {user && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90">
              <User className="h-3.5 w-3.5 text-[var(--terracotta)]" />
              Signed in as: <span className="text-white">{user.email}</span>
            </div>
          )}
        </div>

        {/* Informational Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Data to be Deleted */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 shadow-sm">
            <div className="flex items-center gap-2 text-[var(--oxblood)] font-semibold text-sm">
              <Trash2 className="h-4 w-4" />
              <span>What Data Will Be Deleted</span>
            </div>
            <h3 className="mt-2 font-display text-2xl">Permanent Erasure</h3>
            <ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--oxblood)] shrink-0 mt-0.5" />
                <span><strong>Profile & Credentials:</strong> Your full name, email address, phone number, login credentials, and avatar.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--oxblood)] shrink-0 mt-0.5" />
                <span><strong>Store Listings & Drafts:</strong> Artist/gallery store profiles, artwork listings, draft creations, and uploaded images.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--oxblood)] shrink-0 mt-0.5" />
                <span><strong>Preferences & Activity:</strong> Wishlists, followed artists, saved addresses, in-app notifications, and custom parameters.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--oxblood)] shrink-0 mt-0.5" />
                <span><strong>Direct Messages:</strong> Private buyer-seller message histories and video consultation requests.</span>
              </li>
            </ul>
          </div>

          {/* Data to be Retained */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 shadow-sm">
            <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
              <FileText className="h-4 w-4" />
              <span>What Data May Be Retained</span>
            </div>
            <h3 className="mt-2 font-display text-2xl">Legal & Financial Retention</h3>
            <ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <span><strong>Financial Transaction Records:</strong> Invoices, payment transaction receipts, and order histories are retained for up to <strong>7 years</strong> as required by applicable tax laws and financial regulations.</span>
              </li>
              <li className="flex gap-2">
                <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <span><strong>Legal Compliance:</strong> Security audit log references without personal identifiers are kept to satisfy consumer protection and anti-fraud regulations.</span>
              </li>
              <li className="flex gap-2">
                <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <span><strong>Completed Sales:</strong> Completed order line-item history will be anonymized to protect tax reporting for both buyers and sellers.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Process Explanation */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--ivory)] p-6 md:p-8">
          <div className="eyebrow">Verification & Processing</div>
          <h2 className="mt-2 font-display text-3xl">How Deletion Works</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3 text-xs">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ink)] text-white text-xs font-bold">1</div>
              <div className="mt-3 font-semibold text-sm">Submit Request</div>
              <div className="mt-1 text-muted-foreground leading-relaxed">Fill out the request form below with your registered ArtDera email.</div>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ink)] text-white text-xs font-bold">2</div>
              <div className="mt-3 font-semibold text-sm">Verification & Audit</div>
              <div className="mt-1 text-muted-foreground leading-relaxed">We will verify account ownership and check for active pending orders.</div>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ink)] text-white text-xs font-bold">3</div>
              <div className="mt-3 font-semibold text-sm">Admin Execution</div>
              <div className="mt-1 text-muted-foreground leading-relaxed">Within 3 to 5 business days, an authorized admin approves and executes deletion.</div>
            </div>
          </div>
        </div>

        {/* Form Container or Success Result */}
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6 sm:p-10 shadow-md">
          {submittedResult ? (
            <div className="text-center py-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="mt-4 font-display text-3xl sm:text-4xl text-[var(--ink)]">
                Deletion Request Submitted
              </h2>
              <p className="mt-3 max-w-lg mx-auto text-sm leading-relaxed text-muted-foreground">
                Your request to delete the account associated with <strong>{submittedResult.email}</strong> has been logged in our secure system.
              </p>

              <div className="mt-6 inline-block rounded-xl border border-[var(--color-border)] bg-[var(--ivory)] p-4 text-left">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Reference Request ID
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-[var(--oxblood)]">
                  {submittedResult.requestId}
                </div>
              </div>

              <div className="mt-8 space-y-3 max-w-md mx-auto text-xs leading-relaxed text-muted-foreground">
                <p>
                  A confirmation email has been sent to <strong>{submittedResult.email}</strong>. Our administration team will process your request after verifying ownership within 3–5 business days.
                </p>
              </div>

              <div className="mt-8 flex justify-center gap-3">
                <Link to="/" className="btn-primary">
                  Return to Homepage
                </Link>
                <Link to="/help" className="btn-ghost">
                  Contact Support
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="eyebrow">Account Deletion Request Form</div>
              <h2 className="mt-2 font-display text-3xl text-[var(--ink)]">Submit Your Deletion Request</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Please provide your registered account details below. An authorized administrator will verify ownership and process your deletion request.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                {/* Full Name */}
                <div>
                  <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Mudassir Khan"
                      className="art-field w-full pl-10"
                    />
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Registered Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="art-field w-full pl-10"
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Must match the email address associated with your ArtDera account.
                  </p>
                </div>

                {/* Reason for Deletion */}
                <div>
                  <label htmlFor="reasonCategory" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Reason for Deletion <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <select
                    id="reasonCategory"
                    value={reasonCategory}
                    onChange={(e) => setReasonCategory(e.target.value)}
                    className="art-field w-full bg-[var(--porcelain)]"
                  >
                    <option value="no_longer_needed">I no longer need this account</option>
                    <option value="privacy_concerns">Privacy or data concerns</option>
                    <option value="created_duplicate">Created a duplicate account</option>
                    <option value="too_many_emails">Receiving too many notifications</option>
                    <option value="other">Other reason</option>
                  </select>
                </div>

                {/* Additional Details */}
                <div>
                  <label htmlFor="customReason" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Additional Comments or Feedback <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <textarea
                    id="customReason"
                    rows={3}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Tell us how we could improve ArtDera..."
                    className="art-field w-full"
                  />
                </div>

                {/* Confirmation Checkbox */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--ivory)] p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmation}
                      onChange={(e) => setConfirmation(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[var(--oxblood)] rounded"
                    />
                    <span className="text-xs leading-relaxed text-[var(--ink)] font-medium">
                      I confirm that I am the legal owner of this ArtDera account or an authorized representative, and I understand that submitting this request initiates permanent deletion of my account profile and associated data upon admin verification.
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !confirmation}
                    className="btn-primary w-full sm:w-auto min-w-[220px] justify-center gap-2 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Deletion Request
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  <Link to="/help" className="text-xs text-muted-foreground hover:text-[var(--ink)] underline">
                    Need help or have a question first?
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
