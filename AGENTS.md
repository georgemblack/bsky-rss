# Overview

Cloudflare Worker (Hono) that generates Atom and JSON feeds from Bluesky profiles. Users enter a handle on the landing page, which resolves to a DID client-side, producing feed URLs at `/{did}.xml` and `/{did}.json`.

# Local Development

When testing feed output locally, add `?noCache=true` to the feed URL to bypass the Cache API. This ensures you're seeing fresh responses rather than stale cached ones.

# Bluesky API

To fetch posts for a user, call the unauthenticated public API:

```
https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor={did}&filter=posts_and_author_threads
```

The test account DID is `did:plc:ruzlll5u7u7pfxybmppqyxbx`.
