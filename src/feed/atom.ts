import { atUriToPostUrl, type Author, type Post } from "../bluesky";
import { renderTextToHtml } from "../richtext";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function postUrl(handle: string, uri: string): string {
  const rkey = uri.split("/").pop()!;
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

function buildContentHtml(post: Post, feedAuthor: Author): string {
  let html = "";
  if (post.author.did !== feedAuthor.did) {
    html += `<p>\u267B\uFE0F Reposted by ${escapeXml(feedAuthor.displayName)}</p>`;
  }
  if (post.replyParentUri && post.author.did === feedAuthor.did) {
    const parentUrl = atUriToPostUrl(post.replyParentUri);
    html += `<p><a href="${escapeXml(parentUrl)}">\u21AA\uFE0F Replying to post</a></p>`;
  }
  const sections = post.parts.map((part) => renderTextToHtml(part.text, part.facets));
  html += sections.join("<hr>");
  for (const img of post.images) {
    html += `<figure><img src="${escapeXml(img.url)}" alt="${escapeXml(img.alt)}"></figure>`;
  }
  if (post.external) {
    const e = post.external;
    html += "<blockquote>";
    if (e.thumb) html += `<img src="${escapeXml(e.thumb)}">`;
    html += `<a href="${escapeXml(e.uri)}">${escapeXml(e.title)}</a>`;
    if (e.description) html += `<p>${escapeXml(e.description)}</p>`;
    html += "</blockquote>";
  }
  if (post.quote) {
    const q = post.quote;
    const quoteUrl = atUriToPostUrl(q.uri, q.author.handle);
    html += "<blockquote>";
    html += `<a href="${escapeXml(quoteUrl)}">${escapeXml(q.author.displayName)} (@${escapeXml(q.author.handle)})</a>`;
    html += `<p>${escapeXml(q.text)}</p>`;
    html += "</blockquote>";
  }
  return html;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

export function generateAtomFeed(
  did: string,
  posts: Post[],
  author: Author,
  feedUrl: string
): string {
  const profileUrl = `https://bsky.app/profile/${author.handle}`;
  const updated =
    posts.length > 0 ? posts[0].updatedAt : new Date().toISOString();

  const entries = posts
    .map((post) => {
      const url = postUrl(post.author.handle, post.uri);
      const title = escapeXml(truncate(post.parts[0].text, 80));
      const contentHtml = buildContentHtml(post, author);

      return `  <entry>
    <id>${escapeXml(post.uri)}</id>
    <title>${title}</title>
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
