import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../lib/jsonfile.mjs';

const FEED_MAX = 200;
const byPublishedDesc = (a, b) => {
  const x = String(a.publishedAt), y = String(b.publishedAt);
  return x < y ? 1 : x > y ? -1 : 0; // 내림차순(desc)
};

export function mergeFeed({ summarized, existingFeed, existingTrending, state, now }) {
  const seen = new Set(state.seen || []);
  const feed = [...existingFeed];
  const trending = [...existingTrending];

  for (const item of summarized) {
    if (item.summaryStatus === 'skipped') continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const withMeta = { ...item, fetchedAt: now };
    if (item.sourceType === 'repo' || item.sourceType === 'model') {
      trending.push(withMeta);
    } else {
      feed.push(withMeta);
    }
  }

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
