import { fileURLToPath } from 'node:url';
import { fetchRssSources } from './sources/rss.mjs';
import { fetchGithub, fetchHuggingface } from './sources/trending.mjs';
import { fetchYoutube } from './sources/youtube.mjs';
import { readJson, writeJson } from '../lib/jsonfile.mjs';
import * as net from './net.mjs';

// publishedAt 기준 maxAgeDays 이내 항목만 남긴다. 날짜가 없거나 파싱 불가하면 유지(보수적).
export function freshOnly(items, maxAgeDays, nowMs) {
  if (!maxAgeDays) return items;
  const cutoff = nowMs - maxAgeDays * 86400000;
  return items.filter((i) => {
    const t = Date.parse(i.publishedAt);
    return Number.isNaN(t) || t >= cutoff;
  });
}

export async function collectRaw(sources, deps) {
  const cap = sources.perRunCap || 10;
  const nowMs = deps.now ?? Date.now();
  const groups = await Promise.all([
    fetchRssSources(sources.news || [], deps, cap)
      .then((news) => freshOnly(news, sources.maxAgeDays, nowMs)),
    fetchGithub(sources.github || { queries: [], perQuery: 0 }, deps),
    fetchHuggingface(sources.huggingface || { limit: 0 }, deps),
    fetchYoutube(sources.youtube || { channels: [], seedVideos: [] }, deps, cap),
  ]);
  return groups.flat();
}

// CLI 진입점: `npm run fetch`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sources = await readJson('sources.json');
  const items = await collectRaw(sources, net);
  await writeJson('data/raw.json', items);
  console.log(`[fetch] ${items.length}개 raw 아이템 → data/raw.json`);
}
