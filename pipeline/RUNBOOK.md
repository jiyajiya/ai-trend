# 수집·요약 파이프라인 런북 (에이전트 실행)

이 절차는 Claude Code 세션(구독 사용량)에서 실행한다. fetch/merge는 스크립트가,
summarize는 에이전트가 수행한다.

## 1. fetch (스크립트)
```bash
npm run fetch     # sources.json 읽어 data/raw.json 생성
```

## 2. summarize (에이전트)
`data/raw.json`의 각 아이템에 대해 아래 규칙으로 요약을 채워 `data/summarized.json`(배열)을 쓴다.

각 아이템에 추가할 필드:
- `summaryKo`: 한국어 2~3문장 요약. 무엇이 새로운지/왜 중요한지 중심.
- `tags`: 기술 키워드 1~4개 (예: "LLM", "Diffusion", "RAG").
- `entities`: 등장한 회사/제품/모델명 0~5개 (예: "OpenAI", "GPT-5").
- `cats`: 카테고리 0개 이상. 다음 고정 목록에서만 고른다 — `LLM`, `에이전트`, `멀티모달`, `하드웨어`, `정책/규제`, `오픈소스`. (카테고리 탭 필터의 기준값)
- `summaryStatus`: `ok` | `fallback` | `skipped`.

소스 타입별 요약 입력:
- `news` / `paper`: `rawText`(요약/초록)를 읽고 요약. 부족하면 `url`을 WebFetch로 보강.
- `repo` / `model`: `rawText`(description) + `title`로 한 줄 요약. `tags`에 주제 반영.
- `youtube`:
  1) `watch` 스킬로 `url`(또는 `videoId`) 영상의 자막 트랜스크립트를 받아 요약 → `summaryStatus: ok`.
  2) 자막이 없거나 watch 실패 시 `rawText`(제목/설명)만으로 요약 → `summaryStatus: fallback`.
- `source`가 `GeekNews`인 경우 `geeknews-search` 스킬로 본문을 보강할 수 있다(이미 한국어).

요약이 불가능한 아이템은 `summaryStatus: skipped`로 두면 merge가 제외한다.

## 3. merge (스크립트)
```bash
npm run merge     # data/summarized.json + 기존 데이터 → feed/trending/state
```

## 한 줄 실행(수동)
세션에서: "ai-trend 수집 실행" → 위 1→2→3을 순서대로 수행.
