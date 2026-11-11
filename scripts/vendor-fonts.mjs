import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

// Preserve the exact families, weights, unicode coverage and display policy
// while removing two render-blocking cross-origin round trips.
const directory = new URL("../public/fonts/", import.meta.url);
await mkdir(directory, { recursive: true });
const response = await fetch(
  "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Manrope:wght@400;600;700&display=swap",
  {
    headers: {
      "User-Agent":
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    },
  },
);
if (!response.ok) throw new Error(`Font stylesheet: ${response.status}`);
let css = await response.text();
for (const url of new Set(
  [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((match) => match[1]),
)) {
  const font = await fetch(url);
  if (!font.ok) throw new Error(`Font download: ${font.status}`);
  const bytes = Buffer.from(await font.arrayBuffer());
  const filename = `${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.woff2`;
  await writeFile(new URL(filename, directory), bytes);
  css = css.replaceAll(url, `/fonts/${filename}`);
}
for (const family of ["manrope", "dmserifdisplay"]) {
  const license = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`,
  );
  if (!license.ok) throw new Error(`Font license: ${license.status}`);
  await writeFile(new URL(`${family}-OFL.txt`, directory), await license.text());
}
await writeFile(
  new URL("../src/fonts.css", import.meta.url),
  `/* Vendored Google Fonts; licenses in public/fonts. */\n${css}`,
);
console.log("Vendored DM Serif Display and Manrope with their licenses.");
