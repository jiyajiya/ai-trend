import { makeId } from '../../lib/id.mjs';

export async function fetchGithub(config, deps) {
  const seen = new Set();
  const out = [];
  const nowMs = deps.now ?? Date.now();
  const cutoff = new Date(nowMs - (config.createdWithinDays ?? 60) * 86400000)
    .toISOString()
    .slice(0, 10);
  for (const q of (config.queries || [])) {
    const url =
      `https://api.github.com/search/repositories?q=${encodeURIComponent(`${q} created:>${cutoff}`)}` +
      `&sort=stars&order=desc&per_page=${config.perQuery}`;
    try {
      const json = await deps.fetchJson(url);
      for (const r of json.items || []) {
        if (seen.has(r.html_url)) continue;
        seen.add(r.html_url);
        out.push({
          id: makeId(r.html_url),
          sourceType: 'repo',
          source: 'GitHub',
          title: r.full_name,
          url: r.html_url,
          publishedAt: r.created_at || '',
          rawText: r.description || '',
          score: r.stargazers_count || 0,
          lang: r.language || '',
        });
      }
    } catch (err) {
      console.error(`[github] "${q}" 실패: ${err.message}`);
    }
  }
  return out.map((item, i) => ({ ...item, rank: i + 1 }));
}

export async function fetchHuggingface(config, deps) {
  const url = `https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=${config.limit}&full=true`;
  try {
    const json = await deps.fetchJson(url);
    return (json || []).map((m, i) => ({
      id: makeId(`https://huggingface.co/${m.id}`),
      sourceType: 'model',
      source: 'HuggingFace',
      title: m.id,
      url: `https://huggingface.co/${m.id}`,
      publishedAt: m.createdAt || '',
      rawText: [m.pipeline_tag, (m.tags || []).slice(0, 8).join(', ')].filter(Boolean).join(' | '),
      score: m.trendingScore ?? m.likes ?? 0,
      rank: i + 1,
    }));
  } catch (err) {
    console.error(`[huggingface] 실패: ${err.message}`);
    return [];
  }
}
