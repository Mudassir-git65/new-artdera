import { Sparkles } from "lucide-react";

export function ProBadge({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-[0_2px_8px_rgba(217,119,6,0.35)] border border-amber-300/40 shrink-0 ${className}`}
        title="ArtDera Professional Seller"
      >
        <Sparkles className="h-2.5 w-2.5 fill-amber-200 text-amber-100" /> PRO
      </span>
    );
  }

  if (size === "lg") {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white px-3.5 py-1.5 text-xs font-black uppercase tracking-widest shadow-[0_4px_16px_rgba(217,119,6,0.4)] border border-amber-300/50 hover:brightness-110 transition ${className}`}
        title="ArtDera Professional Seller"
      >
        <Sparkles className="h-4 w-4 fill-amber-200 text-amber-100 animate-pulse" /> PRO ARTIST
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white px-3 py-1 text-xs font-black uppercase tracking-wider shadow-[0_3px_12px_rgba(217,119,6,0.38)] border border-amber-300/40 ${className}`}
      title="ArtDera Professional Seller"
    >
      <Sparkles className="h-3.5 w-3.5 fill-amber-200 text-amber-100" /> PRO
    </span>
  );
}
