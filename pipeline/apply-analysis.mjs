import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../lib/jsonfile.mjs';

export function applyAnalysis(feed, analysisMap) {
  return feed.map((item) =>
    Object.prototype.hasOwnProperty.call(analysisMap, item.id)
      ? { ...item, analysis: analysisMap[item.id] }
      : item);
}

// CLI: node pipeline/apply-analysis.mjs  (data/analysis-backfill.json → data/feed.json)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const feed = await readJson('data/feed.json', []);
  const map = await readJson('data/analysis-backfill.json', {});
  const patched = applyAnalysis(feed, map);
  const n = patched.filter((i) => i.analysis).length;
  await writeJson('data/feed.json', patched);
  console.log(`[apply-analysis] feed ${patched.length} / analysis 보유 ${n} (맵 ${Object.keys(map).length}건)`);
}
