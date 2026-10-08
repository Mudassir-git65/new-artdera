const widths = [320, 480, 640, 960, 1280];

export function artworkImageUrl(source: string | undefined, width = 640) {
  if (!source) return undefined;
  const local = source.match(
    /^(?:https:\/\/www\.artdera\.com)?(\/api\/uploads\/[^/?]+\/content)(?:\?.*)?$/,
  );
  if (local) return `${local[1]}?w=${width}&format=webp`;
  try {
    const url = new URL(source);
    if (url.hostname === "images.unsplash.com") {
      url.searchParams.set("w", String(width));
      url.searchParams.set("auto", "format");
      return url.href;
    }
    if (url.hostname === "res.cloudinary.com" && url.pathname.includes("/image/upload/"))
      return source.replace("/image/upload/", `/image/upload/f_auto,q_auto,w_${width}/`);
  } catch {
    /* Unsupported sources keep their original URL. */
  }
  return source;
}

export function artworkImageSrcSet(source: string | undefined) {
  if (artworkImageUrl(source, 320) === source) return undefined;
  return widths.map((width) => `${artworkImageUrl(source, width)} ${width}w`).join(", ");
}
