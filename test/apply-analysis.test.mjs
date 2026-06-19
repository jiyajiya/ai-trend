import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAnalysis } from '../pipeline/apply-analysis.mjs';

test('applyAnalysis: 매칭 id에 analysis를 붙인다', () => {
  const feed = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
  const map = { a: { points: ['p'], sections: [], quotes: [] } };
  const out = applyAnalysis(feed, map);
  assert.deepEqual(out[0], { id: 'a', title: 'A', analysis: { points: ['p'], sections: [], quotes: [] } });
  assert.deepEqual(out[1], { id: 'b', title: 'B' });
});

test('applyAnalysis: feed에 없는 id는 무시한다', () => {
  const feed = [{ id: 'a', title: 'A' }];
  const out = applyAnalysis(feed, { z: { points: ['x'] } });
  assert.deepEqual(out, [{ id: 'a', title: 'A' }]);
});

test('applyAnalysis: 원본 feed를 변형하지 않는다', () => {
  const feed = [{ id: 'a', title: 'A' }];
  applyAnalysis(feed, { a: { points: ['p'] } });
  assert.deepEqual(feed, [{ id: 'a', title: 'A' }]);
});
