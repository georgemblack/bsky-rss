import type { Facet } from "./bluesky";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders post text with facets (links, mentions, tags) as HTML.
 * Facet indices are byte offsets into UTF-8 encoded text.
 * Facets are sorted by byteStart; overlapping facets are discarded.
 */
export function renderTextToHtml(text: string, facets?: Facet[]): string {
  if (!facets || facets.length === 0) {
    return `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const sorted = [...facets].sort(
    (a, b) => a.index.byteStart - b.index.byteStart,
  );

  const decoder = new TextDecoder();
  let html = "";
  let lastByte = 0;

  for (const facet of sorted) {
    const { byteStart, byteEnd } = facet.index;
    if (byteStart < lastByte || byteEnd > bytes.length) continue;

    // Text before this facet
    html += escapeHtml(decoder.decode(bytes.slice(lastByte, byteStart)));

    const facetText = escapeHtml(
      decoder.decode(bytes.slice(byteStart, byteEnd)),
    );
    const feature = facet.features[0];

    if (feature.$type === "app.bsky.richtext.facet#link") {
      html += `<a href="${escapeHtml(feature.uri)}">${facetText}</a>`;
    } else if (feature.$type === "app.bsky.richtext.facet#mention") {
      html += `<a href="https://bsky.app/profile/${escapeHtml(feature.did)}">${facetText}</a>`;
    } else if (feature.$type === "app.bsky.richtext.facet#tag") {
      html += `<a href="https://bsky.app/hashtag/${encodeURIComponent(feature.tag)}">${facetText}</a>`;
    } else {
      html += facetText;
    }

    lastByte = byteEnd;
  }

  // Remaining text after last facet
  html += escapeHtml(decoder.decode(bytes.slice(lastByte)));

  return `<p>${html.replace(/\n/g, "<br>")}</p>`;
}
