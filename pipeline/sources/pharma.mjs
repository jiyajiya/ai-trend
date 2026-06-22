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

export async function fetchPharma(pharma, deps, perRunCap) {
  const keywords = pharma.aiKeywords || [];
  const out = [];
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
  return out;
}
