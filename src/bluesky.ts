const BSKY_API = "https://public.api.bsky.app/xrpc";
const MAX_FEED_POSTS = 25;

export class BlueskyApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Bluesky API error: ${status}`);
    this.name = "BlueskyApiError";
    this.status = status;
  }
}

export interface Author {
  did: string;
  handle: string;
  displayName: string;
  avatar?: string;
}

export interface EmbedImage {
  url: string;
  alt: string;
}

export interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: Array<
    | { $type: "app.bsky.richtext.facet#link"; uri: string }
    | { $type: "app.bsky.richtext.facet#mention"; did: string }
    | { $type: "app.bsky.richtext.facet#tag"; tag: string }
  >;
}

export interface ExternalLink {
  uri: string;
  title: string;
  description: string;
  thumb?: string;
  thumbAlt: string;
}

export interface EmbedVideo {
  playlist: string;
  thumbnail?: string;
  alt: string;
}

export interface PostPart {
  uri: string;
  text: string;
  facets?: Facet[];
  images: EmbedImage[];
  external?: ExternalLink;
  video?: EmbedVideo;
  quote?: QuotePost;
}

export interface QuotePost {
  uri: string;
  author: Author;
  text: string;
}

export interface ReplyParent {
  uri: string;
  author: Author;
  text: string;
}

export interface Post {
  uri: string;
  parts: PostPart[];
  createdAt: string;
  updatedAt: string;
  replyParent?: ReplyParent;
  author: Author;
}

interface EmbedView {
  $type: string;
  images?: Array<{
    fullsize: string;
    alt: string;
  }>;
  items?: Array<{
    fullsize: string;
    alt: string;
  }>;
  external?: {
    uri: string;
    title: string;
    description: string;
    thumb?: string;
    alt?: string;
  };
  record?: {
    $type: string;
    uri: string;
    author: Author;
    value: {
      text: string;
    };
    record?: {
      $type: string;
      uri: string;
      author: Author;
      value: {
        text: string;
      };
    };
  };
  media?: EmbedView;
  playlist?: string;
  thumbnail?: string;
  alt?: string;
}

interface AuthorFeedResponse {
  feed: Array<{
    post: {
      uri: string;
      author: Author;
      embed?: EmbedView;
      record: {
        text: string;
        createdAt: string;
        facets?: Facet[];
        embed?: {
          $type?: string;
          external?: {
            alt?: string;
            title?: string;
            description?: string;
          };
        };
        reply?: {
          root: { uri: string };
          parent: { uri: string };
        };
      };
    };
    reply?: {
      parent: {
        uri: string;
        author: Author;
        record: { text: string };
      };
    };
    reason?: {
      by: Author;
    };
  }>;
}

export function atUriToPostUrl(atUri: string, handle?: string): string {
  const parts = atUri.split("/");
  const actor = handle ?? parts[2];
  const rkey = parts[4];
  return `https://bsky.app/profile/${actor}/post/${rkey}`;
}

export interface FeedOptions {
  includeReposts?: boolean;
  includeReplies?: boolean;
}

function extractImages(embed?: EmbedView): EmbedImage[] {
  if (!embed) {
    return [];
  }
  if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
    return extractImages(embed.media);
  }
  if (embed.$type === "app.bsky.embed.gallery#view" && embed.items) {
    return embed.items.map((img) => ({ url: img.fullsize, alt: img.alt }));
  }
  if (embed.$type !== "app.bsky.embed.images#view" || !embed.images) {
    return [];
  }
  return embed.images.map((img) => ({ url: img.fullsize, alt: img.alt }));
}

function extractQuote(embed?: EmbedView): QuotePost | undefined {
  if (!embed) {
    return undefined;
  }
  if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
    const nested = embed.record?.record;
    if (
      nested &&
      nested.$type === "app.bsky.embed.record#viewRecord" &&
      nested.value
    ) {
      return {
        uri: nested.uri,
        author: nested.author,
        text: nested.value.text,
      };
    }
    return extractQuote(embed.record);
  }
  if (
    embed.$type !== "app.bsky.embed.record#view" ||
    !embed.record ||
    embed.record.$type !== "app.bsky.embed.record#viewRecord"
  ) {
    return undefined;
  }
  return {
    uri: embed.record.uri,
    author: embed.record.author,
    text: embed.record.value.text,
  };
}

function extractExternal(
  embed?: EmbedView,
  recordEmbed?: {
    external?: {
      alt?: string;
      title?: string;
      description?: string;
    };
  },
): ExternalLink | undefined {
  if (!embed) {
    return undefined;
  }
  if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
    return extractExternal(embed.media, recordEmbed);
  }
  if (embed.$type !== "app.bsky.embed.external#view" || !embed.external) {
    return undefined;
  }
  const thumbAlt =
    embed.external.alt ??
    recordEmbed?.external?.alt ??
    recordEmbed?.external?.description ??
    embed.external.description ??
    recordEmbed?.external?.title ??
    embed.external.title ??
    "";
  return {
    uri: embed.external.uri,
    title: embed.external.title,
    description: embed.external.description,
    thumb: embed.external.thumb,
    thumbAlt,
  };
}

function extractVideo(embed?: EmbedView): EmbedVideo | undefined {
  if (!embed) {
    return undefined;
  }
  if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
    return extractVideo(embed.media);
  }
  if (embed.$type !== "app.bsky.embed.video#view" || !embed.playlist) {
    return undefined;
  }
  return {
    playlist: embed.playlist,
    thumbnail: embed.thumbnail,
    alt: embed.alt ?? "Video thumbnail",
  };
}

/**
 * Groups consecutive self-thread posts into a single entry.
 * Posts in a thread share the same root URI. The resulting entry
 * uses the root's URI and earliest createdAt; each post becomes a
 * part carrying its own text and media, ordered chronologically.
 */
function collapseThreads(
  posts: Array<{
    uri: string;
    rootUri: string;
    replyParent?: ReplyParent;
    record: { text: string; createdAt: string; facets?: Facet[] };
    images: EmbedImage[];
    external?: ExternalLink;
    video?: EmbedVideo;
    quote?: QuotePost;
    author: Author;
  }>,
): Post[] {
  const groups = new Map<
    string,
    {
      uri: string;
      parts: PostPart[];
      replyParent?: ReplyParent;
      createdAt: string;
      updatedAt: string;
      author: Author;
    }
  >();
  const order: string[] = [];

  for (const post of posts) {
    const key = post.rootUri;
    const part: PostPart = {
      uri: post.uri,
      text: post.record.text,
      facets: post.record.facets,
      images: post.images,
      external: post.external,
      video: post.video,
      quote: post.quote,
    };
    const existing = groups.get(key);
    if (existing) {
      existing.parts.push(part);
      if (post.record.createdAt < existing.createdAt) {
        existing.createdAt = post.record.createdAt;
        existing.replyParent = post.replyParent;
      }
      if (post.record.createdAt > existing.updatedAt) {
        existing.updatedAt = post.record.createdAt;
      }
    } else {
      order.push(key);
      groups.set(key, {
        uri: post.rootUri,
        parts: [part],
        replyParent: post.replyParent,
        createdAt: post.record.createdAt,
        updatedAt: post.record.createdAt,
        author: post.author,
      });
    }
  }

  return order.map((key) => {
    const group = groups.get(key)!;
    // Thread posts arrive newest-first; reverse to get chronological order
    group.parts.reverse();
    return {
      uri: group.uri,
      parts: group.parts,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      replyParent: group.replyParent,
      author: group.author,
    };
  });
}

export async function fetchAuthorFeed(
  did: string,
  options: FeedOptions = {},
): Promise<{
  posts: Post[];
  author: Author | null;
}> {
  const { includeReposts = false, includeReplies = false } = options;
  const filter = includeReplies
    ? "posts_with_replies"
    : "posts_and_author_threads";
  const url = `${BSKY_API}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(did)}&filter=${filter}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new BlueskyApiError(res.status);
  }

  const data = (await res.json()) as AuthorFeedResponse;
  const author =
    data.feed.find((item) => item.post.author.did === did)?.post.author ??
    data.feed.find((item) => item.reason?.by.did === did)?.reason?.by ??
    null;

  const mapped = data.feed
    .filter((item) => includeReposts || item.post.author.did === did)
    .map((item) => {
      const reply = item.post.record.reply;
      const replyParent =
        item.reply?.parent?.author && item.reply?.parent?.record
          ? {
              uri: item.reply.parent.uri,
              author: item.reply.parent.author,
              text: item.reply.parent.record.text,
            }
          : undefined;
      return {
        uri: item.post.uri,
        parentUri: reply?.parent.uri,
        threadRootUri: reply?.root.uri ?? item.post.uri,
        record: {
          text: item.post.record.text,
          createdAt: item.post.record.createdAt,
          facets: item.post.record.facets,
        },
        images: extractImages(item.post.embed),
        external: extractExternal(item.post.embed, item.post.record.embed),
        video: extractVideo(item.post.embed),
        quote: extractQuote(item.post.embed),
        author: item.post.author,
        replyParent,
      };
    });

  // Build a set of posts that belong to a continuous self-thread
  // (every post in the chain from root to this post is by the same author).
  // Process oldest-first so parents are resolved before children.
  const sorted = [...mapped].sort((a, b) =>
    a.record.createdAt.localeCompare(b.record.createdAt),
  );
  const selfThreadUris = new Set<string>();
  for (const post of sorted) {
    if (!post.parentUri) {
      // Root post — always starts a self-thread
      selfThreadUris.add(post.uri);
    } else {
      const parentDid = post.parentUri.split("/")[2];
      const rootDid = post.threadRootUri.split("/")[2];
      if (
        parentDid === post.author.did &&
        rootDid === post.author.did &&
        selfThreadUris.has(post.parentUri)
      ) {
        selfThreadUris.add(post.uri);
      }
    }
  }

  const filtered = mapped.map((post) => {
    const isSelfThread = selfThreadUris.has(post.uri);
    return {
      uri: post.uri,
      rootUri: isSelfThread ? post.threadRootUri : post.uri,
      replyParent:
        !isSelfThread && post.replyParent ? post.replyParent : undefined,
      record: post.record,
      images: post.images,
      external: post.external,
      video: post.video,
      quote: post.quote,
      author: post.author,
    };
  });

  const posts = collapseThreads(filtered).slice(0, MAX_FEED_POSTS);

  return { posts, author };
}
