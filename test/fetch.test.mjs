import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectRaw, freshOnly } from '../pipeline/fetch.mjs';

const rss = await readFile(new URL('./fixtures/rss-sample.xml', import.meta.url), 'utf8');

test('collectRaw는 모든 소스 타입을 하나의 배열로 합친다', async () => {
  const sources = {
    perRunCap: 10,
    news: [{ source: 'N', url: 'https://n/feed' }],
    github: { queries: ['topic:llm'], perQuery: 5 },
    huggingface: { limit: 5 },
    youtube: { channels: [], seedVideos: [] },
  };
  const deps = {
    now: Date.parse('2026-06-18T00:00:00Z'),     // rss-sample 날짜(2026-06-16/17) 기준 최신
    fetchText: async () => rss,                  // news가 사용
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

test('collectRaw는 maxAgeDays 초과 뉴스 항목을 제외한다', async () => {
  const oldRss = `<rss><channel>
    <item><title>Old</title><link>https://x/old</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><description>old</description></item>
    <item><title>New</title><link>https://x/new</link><pubDate>Wed, 17 Jun 2026 00:00:00 GMT</pubDate><description>new</description></item>
  </channel></rss>`;
  const sources = { perRunCap: 10, maxAgeDays: 90, news: [{ source: 'N', url: 'https://n/feed' }],
    github: { queries: [], perQuery: 0 }, huggingface: { limit: 0 }, youtube: { channels: [], seedVideos: [] } };
  const deps = { now: Date.parse('2026-06-18T00:00:00Z'), fetchText: async () => oldRss, fetchJson: async () => ({}) };
  const items = await collectRaw(sources, deps);
  const urls = items.map((i) => i.url);
  assert.ok(urls.includes('https://x/new'));
  assert.ok(!urls.includes('https://x/old'));   // 2024-01-01 → 90일 초과로 제외
});

test('freshOnly: 날짜 없거나 파싱불가 항목은 유지(보수적)', () => {
  const now = Date.parse('2026-06-18T00:00:00Z');
  const items = [
    { url: 'a', publishedAt: '2026-06-10' },         // 최신 → 유지
    { url: 'b', publishedAt: '2024-01-01' },         // 오래됨 → 제외
    { url: 'c', publishedAt: '' },                   // 빈 값 → 유지
    { url: 'd', publishedAt: 'not-a-date' },         // 파싱불가 → 유지
  ];
  const kept = freshOnly(items, 90, now).map((i) => i.url);
  assert.deepEqual(kept, ['a', 'c', 'd']);
});

test('freshOnly: maxAgeDays 없으면 전부 유지', () => {
  const items = [{ url: 'a', publishedAt: '2000-01-01' }];
  assert.equal(freshOnly(items, undefined, Date.parse('2026-06-18T00:00:00Z')).length, 1);
});
