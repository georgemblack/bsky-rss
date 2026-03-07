# bsky-rss

Generate Atom and JSON feeds from Bluesky profiles.

## Workers Analytics

List unique DIDs and the number of events associated with each:

```sql
SELECT index1 AS did, COUNT() AS events
FROM bsky_rss_feed_requests
GROUP BY index1
ORDER BY events DESC
```

List unique handles and the number of events associated with each:

```sql
SELECT blob4 AS handle, COUNT() AS events
FROM bsky_rss_feed_requests
GROUP BY blob4
ORDER BY events DESC
```
