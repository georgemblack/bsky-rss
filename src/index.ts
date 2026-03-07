import { Hono } from "hono";
import { BlueskyApiError, fetchAuthorFeed, type FeedOptions } from "./bluesky";
import { generateAtomFeed } from "./feed/atom";
import { generateJsonFeed } from "./feed/json";

const CACHE_TTL = 600; // 10 minutes

const app = new Hono<{ Bindings: CloudflareBindings }>();

function parseFeedOptions(c: {
  req: { query: (key: string) => string | undefined };
}): FeedOptions {
  return {
    includeReposts: c.req.query("includeReposts") === "true",
    includeReplies: c.req.query("includeReplies") === "true",
  };
}

interface CacheMissContext {
  handle?: string;
}

async function cachedResponse(
  request: Request,
  generate: () => Promise<{ response: Response; context?: CacheMissContext }>,
  onCacheMiss?: (context: CacheMissContext) => void,
): Promise<Response> {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const { response, context } = await generate();
  onCacheMiss?.(context ?? {});
  response.headers.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
  await cache.put(request, response.clone());
  return response;
}

function mapAuthorFeedError(error: unknown): Response | null {
  if (
    error instanceof BlueskyApiError &&
    (error.status === 400 || error.status === 404)
  ) {
    return new Response("No posts found", { status: 404 });
  }
  return null;
}

app.get("/:path{.+\\.xml$}", async (c) => {
  const did = c.req.param("path").replace(/\.xml$/, "");
  if (!did.startsWith("did:")) {
    return c.text("Invalid DID", 400);
  }

  return cachedResponse(
    c.req.raw,
    async () => {
      const options = parseFeedOptions(c);
      try {
        const { posts, author } = await fetchAuthorFeed(did, options);
        if (!author) {
          return { response: c.text("No posts found", 404) };
        }

        const feedUrl = new URL(c.req.url).toString();
        const xml = generateAtomFeed(did, posts, author, feedUrl);
        return {
          response: c.body(xml, 200, {
            "Content-Type": "application/atom+xml",
          }),
          context: { handle: author.handle },
        };
      } catch (error) {
        const mapped = mapAuthorFeedError(error);
        if (mapped) {
          return { response: mapped };
        }
        throw error;
      }
    },
    ({ handle }) => {
      const colo = (c.req.raw.cf?.colo as string) ?? "unknown";
      c.env.ANALYTICS.writeDataPoint({
        blobs: [colo, did, "xml", handle ?? ""],
        indexes: [did],
      });
    },
  );
});

app.get("/:path{.+\\.json$}", async (c) => {
  const did = c.req.param("path").replace(/\.json$/, "");
  if (!did.startsWith("did:")) {
    return c.text("Invalid DID", 400);
  }

  return cachedResponse(
    c.req.raw,
    async () => {
      const options = parseFeedOptions(c);
      try {
        const { posts, author } = await fetchAuthorFeed(did, options);
        if (!author) {
          return { response: c.text("No posts found", 404) };
        }

        const feedUrl = new URL(c.req.url).toString();
        const feed = generateJsonFeed(did, posts, author, feedUrl);
        return {
          response: c.json(feed, 200, {
            "Content-Type": "application/feed+json",
          }),
          context: { handle: author.handle },
        };
      } catch (error) {
        const mapped = mapAuthorFeedError(error);
        if (mapped) {
          return { response: mapped };
        }
        throw error;
      }
    },
    ({ handle }) => {
      const colo = (c.req.raw.cf?.colo as string) ?? "unknown";
      c.env.ANALYTICS.writeDataPoint({
        blobs: [colo, did, "json", handle ?? ""],
        indexes: [did],
      });
    },
  );
});

export default app;
