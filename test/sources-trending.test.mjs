import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchGithub, fetchHuggingface } from '../pipeline/sources/trending.mjs';

test('GitHub search 결과를 repo RawItem으로 변환한다', async () => {
  const fakeResp = {
    items: [
      { full_name: 'org/cool-llm', html_url: 'https://github.com/org/cool-llm',
        description: 'A cool LLM', stargazers_count: 1234, language: 'Python' },
    ],
  };
  const deps = { fetchJson: async () => fakeResp };
  const items = await fetchGithub({ queries: ['topic:llm'], perQuery: 5 }, deps);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceType, 'repo');
  assert.equal(items[0].source, 'GitHub');
  assert.equal(items[0].title, 'org/cool-llm');
  assert.equal(items[0].url, 'https://github.com/org/cool-llm');
  assert.equal(items[0].score, 1234);
  assert.equal(items[0].rawText, 'A cool LLM');
});

test('GitHub은 쿼리 간 중복 repo를 제거한다', async () => {
  const fakeResp = {
    items: [{ full_name: 'a/b', html_url: 'https://github.com/a/b', description: '', stargazers_count: 1 }],
  };
  const deps = { fetchJson: async () => fakeResp };
  const items = await fetchGithub({ queries: ['topic:llm', 'topic:ai'], perQuery: 5 }, deps);
  assert.equal(items.length, 1); // 두 쿼리가 같은 repo를 반환해도 1개
});

test('HuggingFace 모델을 model RawItem으로 변환한다', async () => {
  const fakeResp = [
    { id: 'meta/llama', likes: 999, pipeline_tag: 'text-generation' },
  ];
  const deps = { fetchJson: async () => fakeResp };
  const items = await fetchHuggingface({ limit: 10 }, deps);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceType, 'model');
  assert.equal(items[0].source, 'HuggingFace');
  assert.equal(items[0].title, 'meta/llama');
  assert.equal(items[0].url, 'https://huggingface.co/meta/llama');
  assert.equal(items[0].score, 999);
});
