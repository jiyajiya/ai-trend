import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewType, relativeTime, toViewItem, groupColumns, normalizeAnalysis } from '../web/adapt.mjs';

test('viewType: sourceType과 source로 표시 타입을 정한다', () => {
  assert.equal(viewType({ sourceType: 'youtube' }), 'video');
  assert.equal(viewType({ sourceType: 'repo' }), 'repo');
  assert.equal(viewType({ sourceType: 'model' }), 'model');
  assert.equal(viewType({ sourceType: 'news', source: 'GeekNews' }), 'sns');
  assert.equal(viewType({ sourceType: 'news', source: 'r/LocalLLaMA' }), 'sns');
  assert.equal(viewType({ sourceType: 'news', source: 'Towards Data Science' }), 'blog');
  assert.equal(viewType({ sourceType: 'news', source: '요즘IT' }), 'blog');
  assert.equal(viewType({ sourceType: 'news', source: 'OpenAI' }), 'news');
});

test('relativeTime: 경과 시간을 한국어로 만든다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  assert.equal(relativeTime('2026-06-18T11:30:00Z', now), '30분 전');
  assert.equal(relativeTime('2026-06-18T09:00:00Z', now), '3시간 전');
  assert.equal(relativeTime('2026-06-16T12:00:00Z', now), '2일 전');
  assert.equal(relativeTime('not-a-date', now), '');
});

test('relativeTime: 미래 타임스탐프는 방금 전으로 표시한다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  assert.equal(relativeTime('2026-06-18T12:00:30Z', now), '방금 전');
});

test('relativeTime: 1분 미만 과거는 1분 전으로 표시한다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  assert.equal(relativeTime('2026-06-18T11:59:45Z', now), '1분 전');
});

test('toViewItem: 파이프라인 아이템을 ViewItem으로 매핑한다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  const v = toViewItem({
    id: 'x1', sourceType: 'news', source: 'The Verge AI', title: 'T',
    url: 'https://x/1', summaryKo: '요약', tags: ['LLM', 'RAG'],
    cats: ['LLM'], score: 5, publishedAt: '2026-06-18T11:00:00Z',
    fetchedAt: '2026-06-18T11:00:00Z', summaryStatus: 'ok',
  }, now);
  assert.equal(v.type, 'news');
  assert.equal(v.summary, '요약');
  assert.equal(v.tagText, '#LLM  #RAG');
  assert.equal(v.time, '1시간 전');
  assert.deepEqual(v.cats, ['LLM']);
  assert.equal(v.url, 'https://x/1');
});

test('toViewItem: 선택적 필드 기본값을 올바르게 설정한다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  const v = toViewItem({
    id: 'd1', sourceType: 'news', source: 'X', title: 't', url: 'u',
  }, now);
  assert.equal(v.tagText, '');
  assert.deepEqual(v.cats, []);
  assert.equal(v.status, 'ok');
  assert.equal(v.score, 0);
});

test('toViewItem: javascript: URL은 #으로 교체한다 (XSS 방어)', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  const v = toViewItem({ id: 'x', sourceType: 'news', source: 'X', title: 't', url: 'javascript:alert(1)' }, now);
  assert.equal(v.url, '#');
});

test('toViewItem: https: URL은 그대로 통과한다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  const v = toViewItem({ id: 'x', sourceType: 'news', source: 'X', title: 't', url: 'https://ok/1' }, now);
  assert.equal(v.url, 'https://ok/1');
});

test('toViewItem: data: URL은 #으로 교체한다 (XSS 방어)', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  const v = toViewItem({ id: 'x', sourceType: 'news', source: 'X', title: 't', url: 'data:text/html,<script>alert(1)</script>' }, now);
  assert.equal(v.url, '#');
});

test('toViewItem: rank가 있으면 ViewItem에 rank를 포함한다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  const v = toViewItem({
    id: 'r1', sourceType: 'repo', source: 'GitHub', title: 't',
    url: 'https://g/r', rank: 2, score: 5,
  }, now);
  assert.equal(v.rank, 2);
});

test('toViewItem: rank가 없으면 Infinity를 기본값으로 설정한다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  const v = toViewItem({
    id: 'r2', sourceType: 'model', source: 'HuggingFace', title: 't',
    url: 'https://hf/m', score: 10,
  }, now);
  assert.ok(!Number.isFinite(v.rank));
});

test('groupColumns: sns/blog는 한 컬럼, repo/model/paper는 컬럼 제외', () => {
  const items = [
    { type: 'news' }, { type: 'video' },
    { type: 'sns' }, { type: 'blog' }, { type: 'repo' }, { type: 'model' },
  ];
  const c = groupColumns(items);
  assert.equal(c.news.length, 1);
  assert.equal(c.video.length, 1);
  assert.equal(c.snsblog.length, 2);
  assert.ok(!('paper' in c));
});

test('normalizeAnalysis: 정상 객체를 그대로 정규화한다', () => {
  const out = normalizeAnalysis({
    points: ['p1', 'p2'],
    sections: [{ heading: 'h', body: 'b' }],
    quotes: ['q1'],
  });
  assert.deepEqual(out, {
    points: ['p1', 'p2'],
    sections: [{ heading: 'h', body: 'b' }],
    quotes: ['q1'],
  });
});

test('normalizeAnalysis: 누락 필드는 빈 배열로 보정한다', () => {
  const out = normalizeAnalysis({ points: ['only'] });
  assert.deepEqual(out, { points: ['only'], sections: [], quotes: [] });
});

test('normalizeAnalysis: sections 항목의 heading/body 누락을 빈 문자열로 보정한다', () => {
  const out = normalizeAnalysis({ points: ['p'], sections: [{ heading: 'h' }, {}] });
  assert.deepEqual(out.sections, [{ heading: 'h', body: '' }, { heading: '', body: '' }]);
});

test('normalizeAnalysis: 비배열/누락/빈 points는 null', () => {
  assert.equal(normalizeAnalysis(undefined), null);
  assert.equal(normalizeAnalysis(null), null);
  assert.equal(normalizeAnalysis({ points: 'x' }), null);
  assert.equal(normalizeAnalysis({ points: [] }), null);
  assert.equal(normalizeAnalysis({ sections: [{ heading: 'h', body: 'b' }] }), null);
});

test('toViewItem: analysis를 정규화해 전달한다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  const withA = toViewItem({
    id: 'a1', sourceType: 'youtube', source: 'Jay', title: 'T', url: 'https://x/1',
    summaryKo: 's', analysis: { points: ['p'], sections: [{ heading: 'h', body: 'b' }] },
    publishedAt: '2026-06-18T11:00:00Z', fetchedAt: '2026-06-18T11:00:00Z',
  }, now);
  assert.deepEqual(withA.analysis, { points: ['p'], sections: [{ heading: 'h', body: 'b' }], quotes: [] });

  const without = toViewItem({
    id: 'a2', sourceType: 'news', source: 'OpenAI', title: 'T', url: 'https://x/2',
    summaryKo: 's', publishedAt: '2026-06-18T11:00:00Z', fetchedAt: '2026-06-18T11:00:00Z',
  }, now);
  assert.equal(without.analysis, null);
});
