import type { Author, Post } from "../bluesky";
import { buildContentHtml, postUrl } from "./content";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateAtomFeed(
  did: string,
  posts: Post[],
  author: Author,
  feedUrl: string,
): string {
  const profileUrl = `https://bsky.app/profile/${author.handle}`;
  const updated =
    posts.length > 0 ? posts[0].updatedAt : new Date().toISOString();

  const entries = posts
    .map((post) => {
      const url = postUrl(post.author.handle, post.uri);
      const contentHtml = buildContentHtml(post, author, escapeXml);

      return `  <entry>
    <id>${escapeXml(post.uri)}</id>
    <title></title>
    <link href="${escapeXml(url)}" rel="alternate" />
    <published>${post.createdAt}</published>
    <updated>${post.updatedAt}</updated>
    <content type="html">${escapeXml(contentHtml)}</content>
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeXml(feedUrl)}</id>
  <title>${escapeXml(author.displayName)}'s Bluesky Posts</title>
  <link href="${escapeXml(profileUrl)}" rel="alternate" />
  <link href="${escapeXml(feedUrl)}" rel="self" />
  <updated>${updated}</updated>${author.avatar ? `\n  <icon>${escapeXml(author.avatar)}</icon>` : ""}
${entries}
</feed>`;
}
