# Analytics

Queries for the `bsky_rss_feed_requests` Analytics Engine dataset. Run via the
[SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/).

### Top profiles over the last 7 days

```sql
SELECT
    blob4 AS handle,
    SUM(_sample_interval) AS requests
FROM bsky_rss_feed_requests
WHERE timestamp > NOW() - INTERVAL '7' DAY
    AND blob4 != ''
GROUP BY handle
ORDER BY requests DESC
LIMIT 25
```

### Top profiles, split by feed format

```sql
SELECT
    blob4 AS handle,
    blob3 AS format,
    SUM(_sample_interval) AS requests
FROM bsky_rss_feed_requests
WHERE timestamp > NOW() - INTERVAL '7' DAY
    AND blob4 != ''
GROUP BY handle, format
ORDER BY requests DESC
LIMIT 50
```

### Top profiles in the last 24 hours

```sql
SELECT
    blob4 AS handle,
    SUM(_sample_interval) AS requests
FROM bsky_rss_feed_requests
WHERE timestamp > NOW() - INTERVAL '1' DAY
    AND blob4 != ''
GROUP BY handle
ORDER BY requests DESC
LIMIT 25
```
