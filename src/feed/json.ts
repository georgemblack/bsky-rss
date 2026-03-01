import type { Author, Post } from "../bluesky";
import { buildContentHtml, postUrl } from "./content";

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
      content_html: buildContentHtml(post, author, escapeHtml),
      date_published: post.createdAt,
      date_modified: post.updatedAt,
    })),
  };
}
