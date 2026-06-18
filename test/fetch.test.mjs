import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectRaw } from '../pipeline/fetch.mjs';

const rss = await readFile(new URL('./fixtures/rss-sample.xml', import.meta.url), 'utf8');

test('collectRaw는 모든 소스 타입을 하나의 배열로 합친다', async () => {
  const sources = {
    perRunCap: 10,
    news: [{ source: 'N', url: 'https://n/feed' }],
    arxiv: { categories: ['cs.AI'], maxResults: 5 },
    github: { queries: ['topic:llm'], perQuery: 5 },
    huggingface: { limit: 5 },
    youtube: { channels: [], seedVideos: [] },
  };
  const deps = {
    fetchText: async () => rss,                  // news/arxiv가 사용
    fetchJson: async (url) => {
      if (url.includes('github')) return { items: [{ full_name: 'a/b', html_url: 'https://github.com/a/b', description: '', stargazers_count: 5 }] };
      if (url.includes('huggingface')) return [{ id: 'x/y', likes: 3 }];
      return {};
    },
  };
  const items = await collectRaw(sources, deps);
  const types = new Set(items.map((i) => i.sourceType));
  assert.ok(types.has('news'));
  assert.ok(types.has('repo'));
  assert.ok(types.has('model'));
  assert.ok(items.length >= 3);
});
