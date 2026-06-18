import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../lib/jsonfile.mjs';

const FEED_MAX = 200;
const TRENDING_MAX_AGE_DAYS = 7;

const byPublishedDesc = (a, b) => {
  const x = String(a.publishedAt), y = String(b.publishedAt);
  return x < y ? 1 : x > y ? -1 : 0; // 내림차순(desc)
};

const TRENDING_TYPES = new Set(['repo', 'model']);

export function mergeFeed({ summarized, existingFeed, existingTrending, state, now }) {
  const seen = new Set(state.seen || []);
  const feed = [...existingFeed];

  // Build a map of existing trending items by id (fresh incoming item replaces by id)
  const trendingMap = new Map(existingTrending.map(item => [item.id, item]));

  for (const item of summarized) {
    if (item.summaryStatus === 'skipped') continue;

    if (TRENDING_TYPES.has(item.sourceType)) {
      // Trending: NOT gated on seen, NOT added to seen — fresh item wins by id
      trendingMap.set(item.id, { ...item, fetchedAt: now });
    } else {
      // Feed: gated on seen, id added to seen
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      feed.push({ ...item, fetchedAt: now });
    }
  }

  // Expire trending items older than TRENDING_MAX_AGE_DAYS relative to now
  const nowMs = Date.parse(now);
  const maxAgeMs = TRENDING_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const trending = [...trendingMap.values()].filter(item => {
    const fetchedMs = Date.parse(item.fetchedAt);
    if (isNaN(fetchedMs)) return true; // unparseable fetchedAt: keep
    return (nowMs - fetchedMs) <= maxAgeMs;
  });

  feed.sort(byPublishedDesc);
  trending.sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    feed: feed.slice(0, FEED_MAX),
    trending: trending.slice(0, FEED_MAX),
    state: { seen: [...seen], lastRunAt: now },
  };
}

// CLI 진입점: `npm run merge`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const summarized = await readJson('data/summarized.json', []);
  const existingFeed = await readJson('data/feed.json', []);
  const existingTrending = await readJson('data/trending.json', []);
  const state = await readJson('data/state.json', { seen: [], lastRunAt: null });
  const now = new Date().toISOString();

  const r = mergeFeed({ summarized, existingFeed, existingTrending, state, now });
  await writeJson('data/feed.json', r.feed);
  await writeJson('data/trending.json', r.trending);
  await writeJson('data/state.json', r.state);
  console.log(`[merge] feed ${r.feed.length} / trending ${r.trending.length} (seen ${r.state.seen.length})`);
}
