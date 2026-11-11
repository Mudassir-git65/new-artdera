import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";

/** Preserve href-based UI and query strings while enabling client navigation. */
export function SiteLink({ href = "", ...props }: ComponentProps<"a">) {
  if (!href.startsWith("/") || href.startsWith("//")) return <a href={href} {...props} />;
  const url = new URL(href, "https://www.artdera.com");
  return (
    <Link
      {...props}
      to={url.pathname}
      search={Object.fromEntries(url.searchParams) as never}
      hash={url.hash.slice(1)}
    />
  );
}
