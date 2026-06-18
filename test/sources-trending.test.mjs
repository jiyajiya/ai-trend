import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchGithub, fetchHuggingface } from '../pipeline/sources/trending.mjs';

test('GitHub search 결과를 repo RawItem으로 변환한다', async () => {
  let capturedUrl;
  const fakeResp = {
    items: [
      { full_name: 'org/cool-llm', html_url: 'https://github.com/org/cool-llm',
        description: 'A cool LLM', stargazers_count: 1234, language: 'Python' },
    ],
  };
  const deps = {
    fetchJson: async (url) => { capturedUrl = url; return fakeResp; },
    now: Date.parse('2026-06-18T00:00:00Z'),
  };
  const items = await fetchGithub({ queries: ['topic:llm'], perQuery: 5 }, deps);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceType, 'repo');
  assert.equal(items[0].source, 'GitHub');
  assert.equal(items[0].title, 'org/cool-llm');
  assert.equal(items[0].url, 'https://github.com/org/cool-llm');
  assert.equal(items[0].score, 1234);
  assert.equal(items[0].rawText, 'A cool LLM');
  assert.equal(items[0].rank, 1);
  assert.match(capturedUrl, /created%3A%3E2026-04-19/, 'URL should contain recent-created filter');
  assert.match(capturedUrl, /sort=stars/, 'URL should sort by stars');
});

test('GitHub은 쿼리 간 중복 repo를 제거한다', async () => {
  const fakeResp = {
    items: [{ full_name: 'a/b', html_url: 'https://github.com/a/b', description: '', stargazers_count: 1 }],
  };
  const deps = { fetchJson: async () => fakeResp };
  const items = await fetchGithub({ queries: ['topic:llm', 'topic:ai'], perQuery: 5 }, deps);
  assert.equal(items.length, 1); // 두 쿼리가 같은 repo를 반환해도 1개
  assert.equal(items[0].rank, 1);
});

test('HuggingFace 모델을 model RawItem으로 변환한다', async () => {
  const fakeResp = [
    { id: 'a/b', trendingScore: 1396, likes: 1560, pipeline_tag: 'text-generation', tags: ['transformers'] },
    { id: 'c/d', trendingScore: 900, likes: 50 },
  ];
  const deps = { fetchJson: async (url) => {
    assert.match(url, /full=true/, 'API URL should contain full=true');
    assert.match(url, /sort=trendingScore/, 'API URL should use trendingScore sort');
    return fakeResp;
  } };
  const items = await fetchHuggingface({ limit: 10 }, deps);
  assert.equal(items.length, 2);
  assert.equal(items[0].sourceType, 'model');
  assert.equal(items[0].source, 'HuggingFace');
  assert.equal(items[0].title, 'a/b');
  assert.equal(items[0].url, 'https://huggingface.co/a/b');
  assert.equal(items[0].score, 1396); // trendingScore, not likes
  assert.equal(items[0].rank, 1);
  assert.equal(items[1].rank, 2);
  assert.match(items[0].rawText, /text-generation/, 'rawText should contain pipeline_tag');
  assert.match(items[0].rawText, /transformers/, 'rawText should contain at least one tag');
});

test('GitHub 요청 실패시 빈 배열을 반환한다', async () => {
  const deps = { fetchJson: async () => { throw new Error('rate limit'); } };
  const items = await fetchGithub({ queries: ['topic:llm'], perQuery: 5 }, deps);
  assert.equal(items.length, 0);
});

test('HuggingFace 요청 실패시 빈 배열을 반환한다', async () => {
  const deps = { fetchJson: async () => { throw new Error('500'); } };
  const items = await fetchHuggingface({ limit: 10 }, deps);
  assert.equal(items.length, 0);
});
