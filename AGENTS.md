# Overview

Cloudflare Worker (Hono) that generates Atom and [JSON feeds](https://www.jsonfeed.org) from Bluesky profiles, hosted at `https://bskyrss.com`. Posts are rendered as rich HTML content rather than plain text. Users enter a Bluesky handle on the landing page, which resolves to a DID and produces feed URLs.

## Development

This project uses `pnpm`. After making changes, validate with:

```
pnpm run dryrun
pnpm run typecheck
pnpm run format
```

When testing feed output locally, add `?noCache=true` to bypass the Cache API.

## Pull Requests

When making a pull request:

- Prefix the branch name with "ai/"
- Prefix the title with "AI:"
- Note in the description that it is AI generated
- Properly capitalize the description

## Bluesky API

To fetch posts for a user, call the unauthenticated public API:

```
https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor={did}&filter=posts_and_author_threads
```

The test account DID is `did:plc:ruzlll5u7u7pfxybmppqyxbx`.
