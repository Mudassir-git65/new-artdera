import { Link } from "@tanstack/react-router";

export function Logo({
  variant = "dark",
  withWordmark = true,
}: {
  variant?: "dark" | "light";
  withWordmark?: boolean;
}) {
  const fg = variant === "dark" ? "var(--ink)" : "var(--ivory)";
  const bg = variant === "dark" ? "var(--ivory)" : "var(--ink)";
  const accent = "var(--terracotta)";
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 group" aria-label="ArtDera home">
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
        <rect
          width="64"
          height="64"
          rx="10"
          fill={fg === "var(--ink)" ? "var(--ink)" : "var(--ink)"}
        />
        <path
          d="M14 50 V22 Q14 12 24 12 H40 Q50 12 50 22 V50"
          fill="none"
          stroke={bg === "var(--ink)" ? "var(--ivory)" : "var(--ivory)"}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M22 50 L32 26 L42 50"
          fill="none"
          stroke={accent}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="26"
          y1="42"
          x2="38"
          y2="42"
          stroke={accent}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>
      {withWordmark && (
        <span
          className="font-display text-[1.35rem] leading-none tracking-tight"
          style={{ color: fg }}
        >
          ArtDera
        </span>
      )}
    </Link>
  );
}
