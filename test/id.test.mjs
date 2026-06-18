import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeId } from '../lib/id.mjs';

test('makeId는 16자 hex를 반환한다', () => {
  const id = makeId('https://example.com/a');
  assert.match(id, /^[0-9a-f]{16}$/);
});

test('makeId는 같은 url에 같은 id를 반환한다(결정적)', () => {
  assert.equal(makeId('https://x.com/1'), makeId('https://x.com/1'));
});

test('makeId는 다른 url에 다른 id를 반환한다', () => {
  assert.notEqual(makeId('https://x.com/1'), makeId('https://x.com/2'));
});
