import { atUriToPostUrl, type Author, type Post } from "../bluesky";
import { renderTextToHtml } from "../richtext";

interface JsonFeedItem {
  id: string;
  url: string;
  content_html: string;
  date_published: string;
  date_modified: string;
}

interface JsonFeed {
  version: string;
  title: string;
  home_page_url: string;
  feed_url: string;
  icon?: string;
  items: JsonFeedItem[];
}

function postUrl(handle: string, uri: string): string {
  const rkey = uri.split("/").pop()!;
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildContentHtml(post: Post, feedAuthor: Author): string {
  let html = "";
  if (post.author.did !== feedAuthor.did) {
    html += `<p>\u267B\uFE0F Reposted by ${escapeHtml(feedAuthor.displayName)}</p>`;
  }
  if (post.replyParent && post.author.did === feedAuthor.did) {
    const parentUrl = atUriToPostUrl(
      post.replyParent.uri,
      post.replyParent.author.handle,
    );
    html += `<p><a href="${escapeHtml(parentUrl)}">↩️ Replying to @${escapeHtml(post.replyParent.author.handle)}:</a></p>`;
    html += `<blockquote><p>${escapeHtml(post.replyParent.text)}</p></blockquote>`;
  }
  const sections = post.parts.map((part) =>
    renderTextToHtml(part.text, part.facets),
  );
  html += sections.join("<hr>");
  for (const img of post.images) {
    html += `<figure><img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}"></figure>`;
  }
  if (post.external) {
    const e = post.external;
    const thumbAlt = e.alt || e.title || "";
    html += "<blockquote>";
    if (e.thumb) {
      html += `<figure><img src="${escapeHtml(e.thumb)}" alt="${escapeHtml(thumbAlt)}"></figure>`;
    }
    html += `<a href="${escapeHtml(e.uri)}">${escapeHtml(e.title)}</a>`;
    if (e.description) html += `<p>${escapeHtml(e.description)}</p>`;
    html += "</blockquote>";
  }
  if (post.quote) {
    const q = post.quote;
    const quoteUrl = atUriToPostUrl(q.uri, q.author.handle);
    html += "<blockquote>";
    html += `<a href="${escapeHtml(quoteUrl)}">${escapeHtml(q.author.displayName)} (@${escapeHtml(q.author.handle)})</a>`;
    html += `<p>${escapeHtml(q.text)}</p>`;
    html += "</blockquote>";
  }
  return html;
}

export function generateJsonFeed(
  did: string,
  posts: Post[],
  author: Author,
  feedUrl: string,
): JsonFeed {
  const profileUrl = `https://bsky.app/profile/${author.handle}`;

  return {
    version: "https://jsonfeed.org/version/1.1",
    title: `${author.displayName}'s Bluesky Posts`,
    home_page_url: profileUrl,
    feed_url: feedUrl,
    ...(author.avatar ? { icon: author.avatar } : {}),
    items: posts.map((post) => ({
      id: post.uri,
      url: postUrl(post.author.handle, post.uri),
      content_html: buildContentHtml(post, author),
      date_published: post.createdAt,
      date_modified: post.updatedAt,
    })),
  };
}
