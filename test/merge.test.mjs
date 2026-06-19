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
  assert.ok(!r.state.seen.includes('r1'), 'trending id must not be added to seen');
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

test('trending은 score 내림차순으로 정렬된다', () => {
  const r = mergeFeed({
    summarized: [
      base({ id: 'r1', sourceType: 'repo', url: 'https://g/r1', score: 5, rank: 1 }),
      base({ id: 'r2', sourceType: 'repo', url: 'https://g/r2', score: 10, rank: 1 }),
    ],
    existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: 'now',
  });
  assert.equal(r.trending[0].score, 10);
  assert.equal(r.trending[1].score, 5);
  assert.ok(r.trending[0].score >= r.trending[1].score);
});

test('extra 필드들이 preserved된다', () => {
  const r = mergeFeed({
    summarized: [base({ id: 'n1', cats: ['LLM'], score: 7 })],
    existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: 'now',
  });
  assert.equal(r.feed.length, 1);
  assert.deepEqual(r.feed[0].cats, ['LLM']);
  assert.equal(r.feed[0].score, 7);
});

test('기존 feed 아이템들이 보존된다', () => {
  const existingItem = base({ id: 'existing1', url: 'https://x/existing' });
  const r = mergeFeed({
    summarized: [base({ id: 'new1', url: 'https://x/new' })],
    existingFeed: [existingItem],
    existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: 'now',
  });
  assert.equal(r.feed.length, 2);
  assert.ok(r.feed.some(item => item.id === 'existing1'));
  assert.ok(r.feed.some(item => item.id === 'new1'));
});

test('feed는 200개 cap이 적용된다', () => {
  const existingFeed = [];
  for (let i = 0; i < 200; i++) {
    existingFeed.push(base({ id: `existing${i}`, url: `https://x/existing${i}` }));
  }
  const r = mergeFeed({
    summarized: [base({ id: 'new1', url: 'https://x/new' })],
    existingFeed,
    existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: 'now',
  });
  assert.equal(r.feed.length, 200);
});

// ── 트렌딩 신선도 관련 테스트 (최종 리뷰 #2) ──────────────────────────

const NOW = '2026-06-18T08:00:00Z';

test('trending: 동일 id 재수집 시 최신 score로 교체된다', () => {
  const r = mergeFeed({
    summarized: [base({ id: 'r1', sourceType: 'repo', url: 'https://g/r', score: 50 })],
    existingFeed: [],
    existingTrending: [{ id: 'r1', sourceType: 'repo', url: 'https://g/r', score: 10, fetchedAt: NOW }],
    state: { seen: [], lastRunAt: null }, now: NOW,
  });
  assert.equal(r.trending.length, 1);
  assert.equal(r.trending[0].id, 'r1');
  assert.equal(r.trending[0].score, 50);
});

test('trending: seen에 있는 id도 trending에 포함된다 (seen 비게이팅)', () => {
  const r = mergeFeed({
    summarized: [base({ id: 'r1', sourceType: 'repo', url: 'https://g/r', score: 5 })],
    existingFeed: [],
    existingTrending: [],
    state: { seen: ['r1'], lastRunAt: null }, now: NOW,
  });
  assert.equal(r.trending.length, 1);
  assert.equal(r.trending[0].id, 'r1');
});

test('trending: fetchedAt이 7일 초과된 항목은 만료된다', () => {
  const eightDaysAgo = new Date(Date.parse(NOW) - 8 * 24 * 60 * 60 * 1000).toISOString();
  const r = mergeFeed({
    summarized: [base({ id: 'new', sourceType: 'repo', url: 'https://g/new', score: 5 })],
    existingFeed: [],
    existingTrending: [{ id: 'old', sourceType: 'repo', url: 'https://g/old', score: 999, fetchedAt: eightDaysAgo }],
    state: { seen: [], lastRunAt: null }, now: NOW,
  });
  assert.ok(!r.trending.some(item => item.id === 'old'), 'old item (8d) should be expired');
  assert.ok(r.trending.some(item => item.id === 'new'), 'new item should be present');
});

test('trending: 임시 빈 fetch여도 신선한 기존 항목은 유지된다', () => {
  const oneDayAgo = new Date(Date.parse(NOW) - 1 * 24 * 60 * 60 * 1000).toISOString();
  const r = mergeFeed({
    summarized: [],
    existingFeed: [],
    existingTrending: [{ id: 'keep', sourceType: 'repo', url: 'https://g/keep', score: 7, fetchedAt: oneDayAgo }],
    state: { seen: [], lastRunAt: null }, now: NOW,
  });
  assert.equal(r.trending.length, 1);
  assert.equal(r.trending[0].id, 'keep');
});

test('trending: 정확히 7일 경계는 보존된다 (<=)', () => {
  const sevenDaysAgo = '2026-06-11T08:00:00Z';
  const nowAt = '2026-06-18T08:00:00Z';
  const r = mergeFeed({
    summarized: [],
    existingFeed: [],
    existingTrending: [{
      id: 'edge', sourceType: 'repo', score: 3,
      fetchedAt: sevenDaysAgo, summaryStatus: 'ok',
      title: 'e', url: 'https://g/e', summaryKo: '', tags: [], entities: [],
    }],
    state: { seen: [], lastRunAt: null }, now: nowAt,
  });
  assert.ok(r.trending.some(item => item.id === 'edge'), 'edge item (7d exactly) should be kept');
});

test('trending: rank 기반 정렬 — repo/model 공정 인터리브', () => {
  const r = mergeFeed({
    summarized: [
      base({ id: 'repo-rank1', sourceType: 'repo', url: 'https://g/r1', score: 50000, rank: 1, summaryStatus: 'ok' }),
      base({ id: 'repo-rank2', sourceType: 'repo', url: 'https://g/r2', score: 40000, rank: 2, summaryStatus: 'ok' }),
      base({ id: 'model-rank1', sourceType: 'model', url: 'https://hf/m1', score: 1396, rank: 1, summaryStatus: 'ok' }),
      base({ id: 'model-rank2', sourceType: 'model', url: 'https://hf/m2', score: 1100, rank: 2, summaryStatus: 'ok' }),
    ],
    existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: NOW,
  });
  const ids = r.trending.map(t => t.id);
  assert.equal(ids[0], 'repo-rank1',  'rank1 tier: repo first (score 50000 > 1396)');
  assert.equal(ids[1], 'model-rank1', 'rank1 tier: model second');
  assert.equal(ids[2], 'repo-rank2',  'rank2 tier: repo first (score 40000 > 1100)');
  assert.equal(ids[3], 'model-rank2', 'rank2 tier: model second');
});

test('trending: rank 없는 항목은 ranked 항목 뒤로 밀린다', () => {
  const r = mergeFeed({
    summarized: [
      base({ id: 'no-rank', sourceType: 'repo', url: 'https://g/old', score: 99999, summaryStatus: 'ok' }),
      base({ id: 'has-rank', sourceType: 'repo', url: 'https://g/new', score: 1, rank: 1, summaryStatus: 'ok' }),
    ],
    existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: NOW,
  });
  const ids = r.trending.map(t => t.id);
  assert.equal(ids[0], 'has-rank', 'ranked item comes first despite lower score');
  assert.equal(ids[1], 'no-rank',  'unranked item sorts last via ?? Infinity');
});

test('feed 동작 유지: seen에 있는 news id는 feed에서 제외되며 trending에도 들어가지 않는다', () => {
  const r = mergeFeed({
    summarized: [base({ id: 'n1', sourceType: 'news' })],
    existingFeed: [],
    existingTrending: [],
    state: { seen: ['n1'], lastRunAt: null }, now: NOW,
  });
  assert.equal(r.feed.length, 0);
  assert.equal(r.trending.length, 0);
});

test('mergeFeed: 신규 피드 항목의 analysis를 그대로 보존한다', () => {
  const analysis = { points: ['p'], sections: [{ heading: 'h', body: 'b' }], quotes: [] };
  const r = mergeFeed({
    summarized: [{
      id: 'n1', sourceType: 'youtube', source: 'Jay', title: 'T',
      url: 'https://x/1', publishedAt: '2026-06-18T11:00:00Z',
      summaryKo: 's', analysis,
    }],
    existingFeed: [],
    existingTrending: [],
    state: { seen: [], lastRunAt: null },
    now: '2026-06-19T00:00:00Z',
  });
  assert.deepEqual(r.feed[0].analysis, analysis);
});
