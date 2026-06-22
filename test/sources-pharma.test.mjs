import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesAi, fetchPharma } from '../pipeline/sources/pharma.mjs';

test('matchesAi: 키워드가 제목/요약에 있으면 true (대소문자 무시)', () => {
  const kw = ['AI', '인공지능', 'LLM'];
  assert.equal(matchesAi('약국에 AI 도입', kw), true);
  assert.equal(matchesAi('AI부터 통합돌봄까지', kw), true); // 한글이 바로 붙어도 경계 인정
  assert.equal(matchesAi('인공지능 처방 보조', kw), true);
  assert.equal(matchesAi('llm 기반 상담', kw), true);
  assert.equal(matchesAi('일반 약업 뉴스', kw), false);
});

test('matchesAi: ASCII 약어는 단어 내부에 박힌 글자를 오탐하지 않는다', () => {
  const kw = ['AI', 'LLM', 'GPT'];
  assert.equal(matchesAi('아젤라산 Azelaic acid 비교', kw), false); // azelAIc의 ai
  assert.equal(matchesAi('Small molecule', kw), false);            // smaLL → LL
});

const RSS = `<?xml version="1.0"?><rss><channel>
  <item><title>AI부터 통합돌봄까지 약국 교육</title><link>https://k/1</link><pubDate>Sun, 22 Jun 2026 09:00:00 GMT</pubDate><description>인공지능 활용</description></item>
  <item><title>대원제약 건기식 기부</title><link>https://k/2</link><pubDate>Sun, 22 Jun 2026 08:00:00 GMT</pubDate><description>나눔 활동</description></item>
  <item><title>디지털헬스케어법 공청회</title><link>https://k/3</link><pubDate>Sun, 22 Jun 2026 07:00:00 GMT</pubDate><description>긴장감</description></item>
</channel></rss>`;

test('fetchPharma: AI 관련 항목만 sourceType=pharma로 수집한다', async () => {
  const deps = { fetchText: async () => RSS };
  const cfg = { aiKeywords: ['AI', '인공지능', '디지털헬스'], rss: [{ source: '약사공론', url: 'https://k/rss' }] };
  const out = await fetchPharma(cfg, deps, 10);
  assert.equal(out.length, 2); // 1번(AI/인공지능), 3번(디지털헬스) — 2번은 제외
  assert.deepEqual(out.map((i) => i.url), ['https://k/1', 'https://k/3']);
  assert.equal(out[0].sourceType, 'pharma');
  assert.equal(out[0].source, '약사공론');
});

test('fetchPharma: perRunCap으로 개수를 제한한다', async () => {
  const deps = { fetchText: async () => RSS };
  const cfg = { aiKeywords: ['AI', '인공지능', '디지털헬스'], rss: [{ source: '약사공론', url: 'https://k/rss' }] };
  const out = await fetchPharma(cfg, deps, 1);
  assert.equal(out.length, 1);
});

test('fetchPharma: fetch 실패해도 throw하지 않고 빈 배열', async () => {
  const deps = { fetchText: async () => { throw new Error('HTTP 500'); } };
  const cfg = { aiKeywords: ['AI'], rss: [{ source: '약사공론', url: 'https://k/rss' }] };
  const out = await fetchPharma(cfg, deps, 10);
  assert.deepEqual(out, []);
});
