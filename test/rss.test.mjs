import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFeed } from '../lib/rss.mjs';

test('RSS item을 파싱한다', async () => {
  const xml = await readFile(new URL('./fixtures/rss-sample.xml', import.meta.url), 'utf8');
  const items = parseFeed(xml);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'First Post');
  assert.equal(items[0].link, 'https://example.com/first');
  assert.equal(items[0].summary, 'Hello world'); // HTML 태그 제거됨
  assert.equal(items[1].title, 'Second Post');
});

test('Atom entry를 파싱한다(link href + summary)', () => {
  const xml = `<feed><entry>
    <title>Atom Title</title>
    <link href="https://a.com/x" rel="alternate"/>
    <published>2026-06-17T00:00:00Z</published>
    <summary>Atom summary</summary>
  </entry></feed>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Atom Title');
  assert.equal(items[0].link, 'https://a.com/x');
  assert.equal(items[0].published, '2026-06-17T00:00:00Z');
  assert.equal(items[0].summary, 'Atom summary');
});

test('null/empty input을 처리한다', () => {
  assert.deepEqual(parseFeed(null), []);
  assert.deepEqual(parseFeed(undefined), []);
  assert.deepEqual(parseFeed(''), []);
});

test('tag prefix 오버매치를 피한다', () => {
  const xml = `<feed><item>
    <title>Test</title>
    <linkurl>junk</linkurl>
    <link>https://ok/1</link>
  </item></feed>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].link, 'https://ok/1', 'linkurl should not corrupt link extraction');
});
