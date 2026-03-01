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
  const feedAuthorName = author.displayName || author.handle;
  const updated =
    posts.length > 0 ? posts[0].updatedAt : new Date().toISOString();

  const entries = posts
    .map((post) => {
      const url = postUrl(post.author.handle, post.uri);
      const contentHtml = buildContentHtml(post, author, escapeXml);
      const entryAuthorName = post.author.displayName || post.author.handle;
      const entryAuthorProfileUrl = `https://bsky.app/profile/${post.author.handle}`;

      return `  <entry>
    <id>${escapeXml(post.uri)}</id>
    <title></title>
    <link href="${escapeXml(url)}" rel="alternate" />
    <author>
      <name>${escapeXml(entryAuthorName)}</name>
      <uri>${escapeXml(entryAuthorProfileUrl)}</uri>
    </author>
    <published>${post.createdAt}</published>
    <updated>${post.updatedAt}</updated>
    <content type="html">${escapeXml(contentHtml)}</content>
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeXml(feedUrl)}</id>
  <title>${escapeXml(feedAuthorName)}'s Bluesky Posts</title>
  <author>
    <name>${escapeXml(feedAuthorName)}</name>
    <uri>${escapeXml(profileUrl)}</uri>
  </author>
  <link href="${escapeXml(profileUrl)}" rel="alternate" />
  <link href="${escapeXml(feedUrl)}" rel="self" />
  <updated>${updated}</updated>${author.avatar ? `\n  <icon>${escapeXml(author.avatar)}</icon>` : ""}
${entries}
</feed>`;
}
