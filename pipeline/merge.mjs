import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../lib/jsonfile.mjs';

const FEED_MAX = 200;
const TRENDING_MAX_AGE_DAYS = 7;

// publishedAt는 소스마다 형식이 다르다(뉴스=RFC822 "Fri, ...", youtube=ISO "2026-...").
// 문자열 비교하면 letter-prefixed(뉴스)가 digit-prefixed(ISO)를 항상 이겨 youtube가
// slice(0,200)에서 잘려나간다. 반드시 파싱된 타임스탬프로 비교한다. 파싱 불가는 맨 뒤로.
const byPublishedDesc = (a, b) => {
  const x = Date.parse(a.publishedAt), y = Date.parse(b.publishedAt);
  const xn = Number.isNaN(x), yn = Number.isNaN(y);
  if (xn && yn) return 0;
  if (xn) return 1;   // a 뒤로
  if (yn) return -1;  // b 뒤로
  return y - x;       // 내림차순(desc)
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
  trending.sort((a, b) => {
    const ra = a.rank ?? Infinity, rb = b.rank ?? Infinity;
    if (ra !== rb) return ra - rb;            // lower rank first (rank 1 = top)
    return (b.score || 0) - (a.score || 0);   // tiebreak: higher score first
  });

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
