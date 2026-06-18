import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchRssSources } from '../pipeline/sources/rss.mjs';

const sampleXml = await readFile(new URL('./fixtures/rss-sample.xml', import.meta.url), 'utf8');

test('피드를 RawItem으로 변환한다', async () => {
  const deps = { fetchText: async () => sampleXml };
  const items = await fetchRssSources([{ source: 'Test', url: 'https://t/feed' }], deps, 10);
  assert.equal(items.length, 2);
  assert.equal(items[0].sourceType, 'news');
  assert.equal(items[0].source, 'Test');
  assert.equal(items[0].url, 'https://example.com/first');
  assert.equal(items[0].rawText, 'Hello world');
  assert.match(items[0].id, /^[0-9a-f]{16}$/);
});

test('perRunCap만큼만 피드당 가져온다', async () => {
  const deps = { fetchText: async () => sampleXml };
  const items = await fetchRssSources([{ source: 'Test', url: 'https://t/feed' }], deps, 1);
  assert.equal(items.length, 1);
});

test('한 피드가 실패해도 나머지는 계속된다', async () => {
  const deps = {
    fetchText: async (url) => {
      if (url.includes('bad')) throw new Error('network');
      return sampleXml;
    },
  };
  const items = await fetchRssSources(
    [{ source: 'Bad', url: 'https://bad/feed' }, { source: 'Good', url: 'https://good/feed' }],
    deps, 10,
  );
  assert.equal(items.length, 2);
  assert.equal(items[0].source, 'Good');
});
