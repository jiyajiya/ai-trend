import { parseFeed } from '../../lib/rss.mjs';
import { makeId } from '../../lib/id.mjs';

// 약사·약업 뉴스 소스. 일반 약업 뉴스 RSS에서 AI 관련 항목만 골라 담는다.
// (kpanews 등은 키워드 검색 RSS가 없어 전체 피드를 받아 제목/요약으로 필터링한다.)
// ASCII 약어(AI·LLM·GPT)는 단어 경계로 매칭해 'Azelaic'의 'ai' 같은 오탐을 막고,
// 한글 키워드(인공지능·디지털헬스 등)는 부분 문자열로 매칭한다.
export function matchesAi(text, keywords) {
  const t = String(text || '');
  return keywords.some((k) => {
    const key = String(k);
    if (/^[\x00-\x7F]+$/.test(key)) {
      const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${esc}\\b`, 'i').test(t);
    }
    return t.toLowerCase().includes(key.toLowerCase());
  });
}

// 데일리팜 검색/뉴스 목록 HTML에서 기사 제목+링크를 추출한다.
// 구조: 기사 링크(/user/news/{id})가 먼저 나오고 그 뒤에 .lin_title 제목이 온다.
// 제목마다 "가장 가까운 앞쪽 기사 링크"를 짝지어 안정적으로 묶는다.
export function parseDailypharm(html) {
  const links = [...html.matchAll(/href="(https:\/\/www\.dailypharm\.com\/user\/news\/(\d+))"/g)]
    .map((m) => ({ pos: m.index, url: m[1] }));
  const titles = [...html.matchAll(/class="lin_title"[^>]*>\s*([^<]{4,})/g)]
    .map((m) => ({ pos: m.index, title: m[1].trim() }));
  const out = [];
  const seen = new Set();
  for (const t of titles) {
    let best = null;
    for (const l of links) if (l.pos < t.pos && (!best || l.pos > best.pos)) best = l;
    if (best && !seen.has(best.url)) {
      seen.add(best.url);
      out.push({ url: best.url, title: t.title });
    }
  }
  return out;
}

// 대한약사회 boardListList.cm 응답(HTML 조각)에서 게시글 제목+보기링크를 추출한다.
// 각 행: onclick="fnCountUpHistCnt('<boardSeq>', ...)" + <div class='text-clamp'>제목.
// 보기 URL은 /board.cm?menuCd=<menuCd>&boardSeq=<seq> 형태.
export function parseKpanet(html, menuCd) {
  const re = /fnCountUpHistCnt\(\s*.(\d+).[^)]*\)"[\s\S]{0,150}?text-clamp.[^>]*>\s*([^<]{4,})/g;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(html))) {
    const seq = m[1];
    const title = m[2].trim();
    if (seen.has(seq)) continue;
    seen.add(seq);
    out.push({ url: `https://www.kpanet.or.kr/board.cm?menuCd=${menuCd}&boardSeq=${seq}`, title });
  }
  return out;
}

const PARSERS = {
  dailypharm: (html) => parseDailypharm(html),
  kpanet: (html, site) => parseKpanet(html, site.menuCd),
};

export async function fetchPharma(pharma, deps, perRunCap) {
  const keywords = pharma.aiKeywords || [];
  const out = [];

  // 1) RSS 소스(전체 피드 → AI 키워드 필터)
  for (const feed of pharma.rss || []) {
    try {
      const xml = await deps.fetchText(feed.url);
      const entries = parseFeed(xml)
        .filter((e) => e.link && matchesAi(`${e.title} ${e.summary}`, keywords))
        .slice(0, perRunCap);
      for (const e of entries) {
        out.push({
          id: makeId(e.link),
          sourceType: 'pharma',
          source: feed.source,
          title: e.title,
          url: e.link,
          publishedAt: e.published,
          rawText: e.summary,
        });
      }
    } catch (err) {
      console.error(`[pharma] ${feed.source} 실패: ${err.message}`);
    }
  }

  // 2) 스크레이프 소스(서버렌더 목록 HTML → 제목/링크 추출 → AI 키워드 필터)
  for (const site of pharma.scrape || []) {
    const parse = PARSERS[site.parser];
    if (!parse) { console.error(`[pharma] 알 수 없는 parser: ${site.parser}`); continue; }
    try {
      // body가 있으면 POST(JS 목록 로드), 없으면 GET(서버렌더 HTML).
      const html = site.body
        ? await deps.postForm(site.endpoint, site.body, site.referer)
        : await deps.fetchTextBrowser(site.url, site.referer);
      const rows = parse(html, site)
        .filter((r) => matchesAi(r.title, keywords))
        .slice(0, perRunCap);
      for (const r of rows) {
        out.push({
          id: makeId(r.url),
          sourceType: 'pharma',
          source: site.source,
          title: r.title,
          url: r.url,
          publishedAt: '',
          rawText: r.title,
        });
      }
    } catch (err) {
      console.error(`[pharma] ${site.source} 실패: ${err.message}`);
    }
  }

  return out;
}
