import { parseFeed } from '../../lib/rss.mjs';
import { makeId } from '../../lib/id.mjs';

export async function fetchArxiv(config, deps) {
  const cats = config.categories.map((c) => `cat:${c}`).join('+OR+');
  const url =
    `http://export.arxiv.org/api/query?search_query=${cats}` +
    `&sortBy=submittedDate&sortOrder=descending&max_results=${config.maxResults}`;
  try {
    const xml = await deps.fetchText(url);
    return parseFeed(xml)
      .filter((e) => e.link)
      .map((e) => ({
        id: makeId(e.link),
        sourceType: 'paper',
        source: 'arXiv',
        title: e.title,
        url: e.link,
        publishedAt: e.published,
        rawText: e.summary,
      }));
  } catch (err) {
    console.error(`[arxiv] 실패: ${err.message}`);
    return [];
  }
}
