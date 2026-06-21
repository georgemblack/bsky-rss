import {
  atUriToPostUrl,
  type Author,
  type Post,
  type PostPart,
} from "../bluesky";
import { renderTextToHtml } from "../richtext";

/**
 * Renders a single post (one part of a thread): its text followed by
 * any media attached to that post, so media stays with the post it
 * belongs to rather than collecting at the end of the entry.
 */
function buildPartHtml(
  part: PostPart,
  author: Author,
  escape: (str: string) => string,
): string {
  let html = renderTextToHtml(part.text, part.facets);

  for (const img of part.images) {
    html += `<figure><img src="${escape(img.url)}" alt="${escape(img.alt)}"></figure>`;
  }

  if (part.external) {
    const e = part.external;
    html += "<blockquote>";
    if (e.thumb) {
      html += `<figure><img src="${escape(e.thumb)}" alt="${escape(e.thumbAlt)}"></figure>`;
    }
    html += `<a href="${escape(e.uri)}">${escape(e.title)}</a>`;
    if (e.description) html += `<p>${escape(e.description)}</p>`;
    html += "</blockquote>";
  }

  if (part.video) {
    const url = atUriToPostUrl(part.uri, author.handle);
    if (part.video.thumbnail) {
      html += "<figure>";
      html += `<a href="${escape(url)}"><img src="${escape(part.video.thumbnail)}" alt="${escape(part.video.alt)}"></a>`;
      html += "</figure>";
    } else {
      html += `<p><a href="${escape(url)}">Watch video on Bluesky</a></p>`;
    }
  }

  if (part.quote) {
    const q = part.quote;
    const quoteUrl = atUriToPostUrl(q.uri, q.author.handle);
    html += "<blockquote>";
    html += `<a href="${escape(quoteUrl)}">${escape(q.author.displayName)} (@${escape(q.author.handle)})</a>`;
    html += `<p>${escape(q.text)}</p>`;
    html += "</blockquote>";
  }

  return html;
}

export function buildContentHtml(
  post: Post,
  feedAuthor: Author,
  escape: (str: string) => string,
): string {
  let html = "";
  if (post.author.did !== feedAuthor.did) {
    html += `<p>\u267B\uFE0F Reposted by ${escape(feedAuthor.displayName)}</p>`;
  }
  if (post.replyParent && post.author.did === feedAuthor.did) {
    const parentUrl = atUriToPostUrl(
      post.replyParent.uri,
      post.replyParent.author.handle,
    );
    html += `<p><a href="${escape(parentUrl)}">↪️ Replying to @${escape(post.replyParent.author.handle)}:</a></p>`;
    html += `<blockquote><p>${escape(post.replyParent.text)}</p></blockquote>`;
  }

  const sections = post.parts.map((part) =>
    buildPartHtml(part, post.author, escape),
  );
  html += sections.join("<p>⬇️</p>");

  return html;
}
