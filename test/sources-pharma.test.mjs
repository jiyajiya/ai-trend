import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesAi, fetchPharma, parseDailypharm, parseKpanet } from '../pipeline/sources/pharma.mjs';

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

// 데일리팜 목록 구조: 링크가 먼저, 그 뒤(이미지 박스 등 사이)에 .lin_title 제목
const DP_HTML = `<ul class="act_list_sty2">
  <li><a href="https://www.dailypharm.com/user/news/100"><div class="img_box"><img src="x.jpg"></div><div class="lin_title">바텍, AI 역량평가 신설</div></a></li>
  <li><a href="https://www.dailypharm.com/user/news/101"><div class="img_box"><img src="y.jpg"></div><div class="lin_title">경동제약 ESG 플리마켓</div></a></li>
  <li><a href="https://www.dailypharm.com/user/news/102"><div class="lin_title">디지털헬스 솔루션 도입</div></a></li>
</ul>`;

test('parseDailypharm: 제목을 가장 가까운 앞쪽 기사 링크와 짝짓는다', () => {
  const rows = parseDailypharm(DP_HTML);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { url: 'https://www.dailypharm.com/user/news/100', title: '바텍, AI 역량평가 신설' });
  assert.equal(rows[2].title, '디지털헬스 솔루션 도입');
});

test('fetchPharma: scrape 소스에서 AI 항목만 pharma로 수집한다', async () => {
  const deps = { fetchText: async () => '', fetchTextBrowser: async () => DP_HTML };
  const cfg = {
    aiKeywords: ['AI', '디지털헬스'],
    scrape: [{ source: '데일리팜', parser: 'dailypharm', url: 'https://d/search' }],
  };
  const out = await fetchPharma(cfg, deps, 10);
  assert.equal(out.length, 2); // 바텍(AI), 디지털헬스 — 경동제약 제외
  assert.deepEqual(out.map((i) => i.title), ['바텍, AI 역량평가 신설', '디지털헬스 솔루션 도입']);
  assert.equal(out[0].sourceType, 'pharma');
  assert.equal(out[0].source, '데일리팜');
});

// 대한약사회 boardListList.cm 조각: onclick에 boardSeq, text-clamp에 제목
const KPANET_HTML = `<table><tbody>
  <tr><td class='only-desk'>229</td>
    <td class='left' onclick="fnCountUpHistCnt('225155','kpakgw', 'N', '229' )">
      <a href="javascript:void(0)"><div class='text-clamp'> 대한약사회, '미래약사 AI 역량 강화 교육' 개최 </div></a></td>
    <td class='regDate'>2026-06-16</td></tr>
  <tr><td class='only-desk'>228</td>
    <td class='left' onclick="fnCountUpHistCnt('224880','kpakgw', 'N', '228' )">
      <a href="javascript:void(0)"><div class='text-clamp'> 근무약사 대상 실무 특강 개최 </div></a></td>
    <td class='regDate'>2026-05-27</td></tr>
</tbody></table>`;

test('parseKpanet: boardSeq+제목을 뽑고 보기 URL을 만든다', () => {
  const rows = parseKpanet(KPANET_HTML, '1002020000');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, "대한약사회, '미래약사 AI 역량 강화 교육' 개최");
  assert.equal(rows[0].url, 'https://www.kpanet.or.kr/board.cm?menuCd=1002020000&boardSeq=225155');
});

test('fetchPharma: kpanet POST 소스에서 AI 항목만 수집한다', async () => {
  const deps = { fetchText: async () => '', postForm: async () => KPANET_HTML };
  const cfg = {
    aiKeywords: ['AI'],
    scrape: [{ source: '대한약사회', parser: 'kpanet', menuCd: '1002020000', endpoint: 'https://k/list', body: 'x=1' }],
  };
  const out = await fetchPharma(cfg, deps, 10);
  assert.equal(out.length, 1); // 'AI 역량 강화 교육'만, '근무약사 실무 특강'은 제외
  assert.equal(out[0].source, '대한약사회');
  assert.equal(out[0].sourceType, 'pharma');
  assert.match(out[0].url, /boardSeq=225155/);
});

test('fetchPharma: scrape 실패해도 RSS 결과는 보존한다', async () => {
  const deps = {
    fetchText: async () => `<rss><item><title>AI 약국 도입</title><link>https://k/1</link></item></rss>`,
    fetchTextBrowser: async () => { throw new Error('HTTP 403'); },
  };
  const cfg = {
    aiKeywords: ['AI'],
    rss: [{ source: '약사공론', url: 'https://k/rss' }],
    scrape: [{ source: '데일리팜', parser: 'dailypharm', url: 'https://d/search' }],
  };
  const out = await fetchPharma(cfg, deps, 10);
  assert.equal(out.length, 1);
  assert.equal(out[0].source, '약사공론');
});
