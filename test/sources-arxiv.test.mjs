import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchArxiv } from '../pipeline/sources/arxiv.mjs';

const atom = await readFile(new URL('./fixtures/atom-arxiv.xml', import.meta.url), 'utf8');

test('arXiv Atom을 paper RawItem으로 변환한다', async () => {
  let calledUrl = '';
  const deps = { fetchText: async (url) => { calledUrl = url; return atom; } };
  const items = await fetchArxiv({ categories: ['cs.AI', 'cs.LG'], maxResults: 5 }, deps);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceType, 'paper');
  assert.equal(items[0].source, 'arXiv');
  assert.equal(items[0].title, 'A Great Paper on LLMs');
  assert.equal(items[0].url, 'http://arxiv.org/abs/2606.00001v1');
  assert.match(items[0].rawText, /large language models/);
  // 쿼리에 카테고리/정렬/개수가 포함되는지
  assert.match(calledUrl, /cat:cs\.AI/);
  assert.match(calledUrl, /cat:cs\.LG/);
  assert.match(calledUrl, /max_results=5/);
});

test('network 오류 시 빈 배열을 반환한다', async () => {
  const deps = { fetchText: async () => { throw new Error('network'); } };
  const items = await fetchArxiv({ categories: ['cs.AI'], maxResults: 5 }, deps);
  assert.equal(items.length, 0);
});
