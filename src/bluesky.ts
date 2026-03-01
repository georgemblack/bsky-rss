const BSKY_API = "https://public.api.bsky.app/xrpc";

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
  alt?: string;
}

export interface PostPart {
  text: string;
  facets?: Facet[];
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
  images: EmbedImage[];
  external?: ExternalLink;
  quote?: QuotePost;
  author: Author;
}

interface EmbedView {
  $type: string;
  images?: Array<{
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
  };
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

/**
 * Groups consecutive thread posts into single entries.
 * Posts in a thread share the same root URI. The resulting post
 * uses the root's URI and earliest createdAt, with text concatenated.
 */
function extractImages(embed?: EmbedView): EmbedImage[] {
  if (!embed || embed.$type !== "app.bsky.embed.images#view" || !embed.images) {
    return [];
  }
  return embed.images.map((img) => ({ url: img.fullsize, alt: img.alt }));
}

function extractQuote(embed?: EmbedView): QuotePost | undefined {
  if (
    !embed ||
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

function extractExternal(embed?: EmbedView): ExternalLink | undefined {
  if (
    !embed ||
    embed.$type !== "app.bsky.embed.external#view" ||
    !embed.external
  ) {
    return undefined;
  }
  return {
    uri: embed.external.uri,
    title: embed.external.title,
    description: embed.external.description,
    thumb: embed.external.thumb,
    alt: embed.external.alt,
  };
}

function collapseThreads(
  posts: Array<{
    uri: string;
    rootUri: string;
    replyParent?: ReplyParent;
    record: { text: string; createdAt: string; facets?: Facet[] };
    images: EmbedImage[];
    external?: ExternalLink;
    quote?: QuotePost;
    author: Author;
  }>,
): Post[] {
  const groups = new Map<
    string,
    {
      uri: string;
      parts: PostPart[];
      images: EmbedImage[];
      externals: ExternalLink[];
      quotes: QuotePost[];
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
      text: post.record.text,
      facets: post.record.facets,
    };
    const existing = groups.get(key);
    if (existing) {
      existing.parts.push(part);
      existing.images.push(...post.images);
      if (post.external) existing.externals.push(post.external);
      if (post.quote) existing.quotes.push(post.quote);
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
        images: [...post.images],
        externals: post.external ? [post.external] : [],
        quotes: post.quote ? [post.quote] : [],
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
      images: group.images,
      external: group.externals[0],
      quote: group.quotes[0],
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

  const mapped = data.feed
    .filter((item) => includeReposts || item.post.author.did === did)
    .map((item) => {
      const reply = item.post.record.reply;
      const replyParent = item.reply?.parent
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
        external: extractExternal(item.post.embed),
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
      quote: post.quote,
      author: post.author,
    };
  });

  const posts = collapseThreads(filtered);
  const author = posts.length > 0 ? posts[0].author : null;

  return { posts, author };
}
