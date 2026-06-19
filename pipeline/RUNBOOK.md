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
- `cats`: 카테고리 0개 이상. 다음 고정 목록에서만 고른다 — `LLM·모델`, `에이전트`, `코딩·개발`, `멀티모달`, `기업·정책`. (카테고리 탭 필터의 기준값)
  - `LLM·모델`: 파운데이션 모델·추론·MoE·벤치마크·모델 공개
  - `에이전트`: 에이전트·멀티에이전트·자율 워크플로
  - `코딩·개발`: 코딩·개발도구·바이브코딩·Claude Code·IDE
  - `멀티모달`: 이미지/영상/음성 생성·비전·디퓨전
  - `기업·정책`: 기업 도입·자동화·파트너십·정책·규제·AI 안전
- `summaryStatus`: `ok` | `fallback` | `skipped`.

소스 타입별 요약 입력:
- `news` / `paper`: `rawText`(요약/초록)를 읽고 요약. 부족하면 `url`을 WebFetch로 보강.
- `repo` / `model`: `rawText`(description) + `title`로 한 줄 요약. `tags`에 주제 반영.
- `youtube`:
  1) `watch` 스킬로 `url`(또는 `videoId`) 영상의 자막 트랜스크립트를 받아 요약 → `summaryStatus: ok`.
  2) 자막이 없거나 watch 실패 시 `rawText`(제목/설명)만으로 요약 → `summaryStatus: fallback`.
- `source`가 `GeekNews`인 경우 `geeknews-search` 스킬로 본문을 보강할 수 있다(이미 한국어).

요약이 불가능한 아이템은 `summaryStatus: skipped`로 두면 merge가 제외한다.

### 2a. 소스별 보강 가이드 (추가)

**Hacker News**
- `rawText`가 URL + 메타데이터만 담긴 경우(본문 없음) → `url`을 WebFetch로 원문 일부(첫 1,000자 내외)를 받아 요약 입력에 추가한다.
- 회당 처리 상한: `perRunCap`건(현재 8건). 나머지는 `summaryStatus: fallback`으로 제목만 요약.
- 원문이 영상(YouTube 링크) 또는 PDF인 경우: WebFetch 시도 없이 fallback 허용.

**YouTube**
- 영문 자막 fetch 실패(HTTP 429 등) 시 → 한국어 자동자막(auto-generated)으로 재시도.
- 한국어 자막도 실패 시 → 제목 + 설명 텍스트 기반 요약(`summaryStatus: fallback`).
- 회당 채널별 신규 영상 처리 상한: `perChannel`(현재 3)건. 채널 수 × perChannel이 실질 상한.

## 3. merge (스크립트)
```bash
npm run merge     # data/summarized.json + 기존 데이터 → feed/trending/state
```

## 한 줄 실행(수동)
세션에서: "ai-trend 수집 실행" → 위 1→2→3을 순서대로 수행.

## 4. 로컬 스케줄 (매일 아침)

watch 스킬이 로컬 yt-dlp를 쓰므로 클라우드 cron이 아닌 **로컬 cron**을 사용한다.
매일 08:00 실행 예시(crontab):

```cron
0 8 * * * /bin/bash /Users/minjijung/projects/ai-project/ai-trend/pipeline/run.sh >> /tmp/ai-trend.log 2>&1
```

등록: `crontab -e` 후 위 줄 추가. 로그는 `/tmp/ai-trend.log`에서 확인.
주의: `claude -p` 헤드리스 세션이 로그인된 상태여야 summarize 단계가 동작한다.
