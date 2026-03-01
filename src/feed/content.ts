import { atUriToPostUrl, type Author, type Post } from "../bluesky";
import { renderTextToHtml } from "../richtext";

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
    html += `<p><a href="${escape(parentUrl)}">↩️ Replying to @${escape(post.replyParent.author.handle)}:</a></p>`;
    html += `<blockquote><p>${escape(post.replyParent.text)}</p></blockquote>`;
  }
  const sections = post.parts.map((part) =>
    renderTextToHtml(part.text, part.facets),
  );
  html += sections.join("<hr>");
  for (const img of post.images) {
    html += `<figure><img src="${escape(img.url)}" alt="${escape(img.alt)}"></figure>`;
  }
  if (post.external) {
    const e = post.external;
    html += "<blockquote>";
    if (e.thumb) {
      html += `<figure><img src="${escape(e.thumb)}" alt="${escape(e.thumbAlt)}"></figure>`;
    }
    html += `<a href="${escape(e.uri)}">${escape(e.title)}</a>`;
    if (e.description) html += `<p>${escape(e.description)}</p>`;
    html += "</blockquote>";
  }
  if (post.video) {
    const url = atUriToPostUrl(post.uri, post.author.handle);
    if (post.video.thumbnail) {
      html += "<figure>";
      html += `<a href="${escape(url)}"><img src="${escape(post.video.thumbnail)}" alt="${escape(post.video.alt)}"></a>`;
      html += "</figure>";
    } else {
      html += `<p><a href="${escape(url)}">Watch video on Bluesky</a></p>`;
    }
  }
  if (post.quote) {
    const q = post.quote;
    const quoteUrl = atUriToPostUrl(q.uri, q.author.handle);
    html += "<blockquote>";
    html += `<a href="${escape(quoteUrl)}">${escape(q.author.displayName)} (@${escape(q.author.handle)})</a>`;
    html += `<p>${escape(q.text)}</p>`;
    html += "</blockquote>";
  }
  return html;
}
