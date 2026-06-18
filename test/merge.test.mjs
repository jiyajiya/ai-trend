import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFeed } from '../pipeline/merge.mjs';

const base = (over = {}) => ({
  id: 'id1', sourceType: 'news', source: 'N', title: 'T',
  url: 'https://x/1', publishedAt: '2026-06-17', summaryKo: '요약',
  tags: [], entities: [], summaryStatus: 'ok', ...over,
});

test('새 news 아이템을 feed에 넣고 fetchedAt/seen/lastRunAt을 기록한다', () => {
  const r = mergeFeed({
    summarized: [base()], existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: '2026-06-18T08:00:00Z',
  });
  assert.equal(r.feed.length, 1);
  assert.equal(r.feed[0].fetchedAt, '2026-06-18T08:00:00Z');
  assert.deepEqual(r.state.seen, ['id1']);
  assert.equal(r.state.lastRunAt, '2026-06-18T08:00:00Z');
});

test('이미 seen된 id는 제외한다', () => {
  const r = mergeFeed({
    summarized: [base()], existingFeed: [], existingTrending: [],
    state: { seen: ['id1'], lastRunAt: null }, now: '2026-06-18T08:00:00Z',
  });
  assert.equal(r.feed.length, 0);
});

test('skipped 아이템은 반영하지 않는다', () => {
  const r = mergeFeed({
    summarized: [base({ summaryStatus: 'skipped' })], existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: 'now',
  });
  assert.equal(r.feed.length, 0);
  assert.deepEqual(r.state.seen, []);
});

test('repo/model은 trending으로 분류한다', () => {
  const r = mergeFeed({
    summarized: [base({ id: 'r1', sourceType: 'repo', url: 'https://g/r', score: 9 })],
    existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: 'now',
  });
  assert.equal(r.feed.length, 0);
  assert.equal(r.trending.length, 1);
  assert.equal(r.trending[0].sourceType, 'repo');
});

test('feed는 publishedAt 내림차순으로 정렬된다', () => {
  const r = mergeFeed({
    summarized: [
      base({ id: 'a', url: 'https://x/a', publishedAt: '2026-06-10' }),
      base({ id: 'b', url: 'https://x/b', publishedAt: '2026-06-17' }),
    ],
    existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: 'now',
  });
  assert.equal(r.feed[0].id, 'b');
  assert.equal(r.feed[1].id, 'a');
});
