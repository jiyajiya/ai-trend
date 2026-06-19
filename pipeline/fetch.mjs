import { fileURLToPath } from 'node:url';
import { fetchRssSources } from './sources/rss.mjs';
import { fetchGithub, fetchHuggingface } from './sources/trending.mjs';
import { fetchYoutube } from './sources/youtube.mjs';
import { readJson, writeJson } from '../lib/jsonfile.mjs';
import * as net from './net.mjs';

export async function collectRaw(sources, deps) {
  const cap = sources.perRunCap || 10;
  const groups = await Promise.all([
    fetchRssSources(sources.news || [], deps, cap),
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
