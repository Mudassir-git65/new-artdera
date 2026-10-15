/** Plain, readable excerpts from artist-supplied Markdown; React still escapes the text. */
export function editorialCopy(value: string, maximum?: number) {
  const copy = value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(?:^|\n)\s*#{1,6}\s*/g, "")
    .replace(/[*_`]/g, "")
    .replace(/^About the Artist\s*/i, "")
    .replace(/^[^.\n]{0,80}(?:—|–|-)\s*Artist Story\s*/i, "")
    .trim();
  if (!maximum || copy.length <= maximum) return copy;
  return `${copy
    .slice(0, maximum)
    .replace(/\s+\S*$/, "")
    .trim()}…`;
}
