import { parseFeed } from '../../lib/rss.mjs';
import { makeId } from '../../lib/id.mjs';

export async function fetchRssSources(feeds, deps, perRunCap) {
  const out = [];
  for (const feed of feeds) {
    try {
      const xml = await deps.fetchText(feed.url);
      const entries = parseFeed(xml).slice(0, perRunCap);
      for (const e of entries) {
        if (!e.link) continue;
        out.push({
          id: makeId(e.link),
          sourceType: 'news',
          source: feed.source,
          title: e.title,
          url: e.link,
          publishedAt: e.published,
          rawText: e.summary,
        });
      }
    } catch (err) {
      console.error(`[rss] ${feed.source} 실패: ${err.message}`);
    }
  }
  return out;
}
