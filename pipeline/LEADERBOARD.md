# 리더보드 영역별 추천 모델 — 일일 갱신 런북 (에이전트 실행)

`data/leaderboard.json`을 매일 1회 갱신한다. fetch/merge와 무관한 **독립 스텝**으로,
`pipeline/run.sh`가 `claude -p`(헤드리스, `--dangerously-skip-permissions`)로 실행한다.
실패해도 이전 `data/leaderboard.json`이 그대로 게시되도록 부분 실패를 허용한다.

## 목표
공신력 있는 주요 리더보드를 종합해 **영역별 추천 모델**(약사·전문 + 개발자 타깃)을
한국어로 이해하기 쉽게 정리한다.

## 조회 출처 (WebSearch / WebFetch)
- LMSYS Chatbot Arena — https://lmarena.ai
- Artificial Analysis — https://artificialanalysis.ai/leaderboards/models
- Text-to-Image Arena — https://artificialanalysis.ai/image/leaderboard/text-to-image
- LLM Stats — https://llm-stats.com
- Vellum LLM Leaderboard — https://www.vellum.ai/llm-leaderboard
- Hugging Face Open LLM / 오픈웨이트 순위 (보조)

## 스키마 (`data/leaderboard.json`)
```jsonc
{
  "asOf": "YYYY-MM-DD",            // 오늘 날짜로 갱신
  "windowLabel": "2026년 6월 17~21일 기준",  // 참조한 리더보드의 데이터 구간
  "updatedAt": "ISO8601",         // 실행 시각으로 갱신
  "intro": "한 문단 안내",
  "categories": [                 // 8종 · 아래 고정 순서 유지
    {
      "key": "general|reasoning|coding|math|vision|image|openweight|price",
      "title": "한국어 영역명",
      "subtitle": "English label",
      "audience": "pharma|dev|all",
      "metric": "기준 지표명",
      "note": "한 줄 설명(왜 중요한지)",
      "ranks": [
        { "rank": 1, "model": "모델명", "score": "표기 점수", "basis": "근거 문장", "source": "출처 슬러그" }
      ]
    }
  ],
  "useCases": [ { "use": "용도", "models": "추천 모델", "audience": "pharma|dev|all" } ],
  "metrics": [ { "name": "지표", "meaning": "뜻", "area": "중요 영역", "detail": "상세 설명" } ],
  "sources": [ { "name": "리더보드", "url": "https://…", "updated": "최근 업데이트" } ]
}
```

## 카테고리 8종 (고정 순서 — 약사+개발자 유용성 우선)
1. `general` 종합지능 — Artificial Analysis Intelligence Index (audience: all)
2. `reasoning` 추론·전문지식 — GPQA Diamond (audience: pharma)
3. `coding` 코딩 — SWE-bench (audience: dev)
4. `math` 수학 — AIME (audience: dev)
5. `vision` 멀티모달·시각 — LMSYS Vision Arena (audience: all)
6. `image` 텍스트-이미지 생성 — Text-to-Image Elo (audience: pharma)
7. `openweight` 오픈웨이트 — Intelligence Index / 오픈웨이트 순위 (audience: dev)
8. `price` 가성비 — 1M 토큰당 가격 (audience: all)

## 갱신 규칙 (공신력 보존)
- 점수는 **출처 리더보드의 공개 수치만** 사용한다. 직접 추정·창작 금지.
- 어떤 영역의 수치를 출처에서 확인하지 못하면 **이전 `leaderboard.json` 값을 그대로 유지**한다(임의 변경 금지).
- 각 `ranks` 항목은 점수 높은 순으로 정렬, `rank`는 1부터. 동점이면 출처 세부 순위를 따른다.
- `basis`는 사람이 읽고 납득할 한 문장(예: "SWE-bench 95.5% 1위").
- `source`는 짧은 슬러그(`artificialanalysis` · `vellum` · `llm-stats` · `localaimaster` 등).
- `asOf`·`updatedAt`은 항상 오늘로 갱신. `windowLabel`은 참조 구간으로 맞춘다.
- `metrics`·`sources`는 구조가 안정적이므로 URL·설명이 바뀐 경우에만 갱신.
- 결과는 **유효한 JSON** 한 파일(`data/leaderboard.json`)만 남기고 종료.

## 수동 실행
세션에서: "ai-trend 리더보드 갱신" → 위 규칙대로 `data/leaderboard.json`을 다시 쓴다.
