# AI 트렌드 개인 대시보드 — 설계 문서

- **작성일**: 2026-06-18
- **코드네임**: `ai-trend`
- **상태**: 설계 확정 (구현 계획 작성 전)

## 1. 목적

AI 관련 트렌드를 **빠르게 확인하고 이해**하기 위한 **개인용 대시보드**.
[aitrends.kr](https://aitrends.kr/)의 "글을 직접 안 봐도 한국어 요약으로 스캔" 경험을 개인 환경에서 재현한다.

핵심 제약:

- **개인 사용** — 인증/커뮤니티/SEO 등 공개 서비스 기능 없음.
- **API 비용 0** — 요약은 별도 LLM API 호출이 아니라, **Claude Code 세션(구독 사용량)** 안에서 에이전트가 직접 수행한다.
- **자동 스케줄(로컬)** — 매일 아침 자동으로 수집·요약이 채워진다.

## 2. 비목표 (YAGNI)

- 로그인 / 사용자 계정 / 멀티 유저
- 커뮤니티 / 댓글 / upvote
- 서버 DB (Postgres 등) — 파일 기반으로 충분
- 공개 배포 / SEO — 나중에 확장 여지만 남김
- 별도 LLM API 키 — 구독 세션으로 대체

## 3. 전체 구조

서로 분리된 두 부분 + 그 사이의 데이터 계약(파일).

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│  수집·요약 파이프라인          │  write  │  data/                   │
│  (Claude Code 세션 = 구독)    │ ──────▶ │   feed.json              │
│                             │         │   trending.json          │
│  ① fetch (순수 스크립트)      │         │   state.json             │
│  ② summarize (에이전트)       │         └──────────┬───────────────┘
└─────────────────────────────┘                    │ read
                                                    ▼
                                         ┌──────────────────────────┐
                                         │  대시보드 (정적 HTML/JS)   │
                                         │  index.html / app.js      │
                                         └──────────────────────────┘
```

- **collector**와 **viewer**는 `data/*.json`으로만 통신한다. 스키마만 지키면 UI는 자유롭게 교체 가능(디자인은 사용자가 추후 제공).

## 4. 파이프라인: fetch + summarize 분리

API 비용 0의 핵심 설계.

### 4.1 fetch (순수 스크립트, LLM 없음)

- RSS, arXiv API, GitHub/HuggingFace 트렌딩, YouTube 메타데이터를 긁어 **raw 아이템 목록**을 만든다.
- 키 불필요, 결정적(deterministic). LLM 미사용.
- 출력: `raw` 아이템 배열 (요약 전 메타데이터 + YouTube의 경우 영상 식별자).

### 4.2 summarize (에이전트 = 구독 세션)

- raw 아이템을 읽고 **한국어 2~3문장 요약 + 태그 + 핵심 키워드(entities)** 를 생성한다.
- 텍스트 소스(뉴스/블로그/논문): 에이전트가 원문/초록을 읽고 요약.
- YouTube: `watch` 스킬로 자막 트랜스크립트를 받아 요약. (세션 시작 시 native captions 사용 가능 확인됨)
- 결과를 스키마에 맞춰 `feed.json`에 병합(append + dedupe)한다.

## 5. 소스 (Source)

소스 정의는 `sources.json`(또는 yaml)에 두고 자유롭게 추가/삭제한다.

| 종류 | 소스 | 비고 |
|---|---|---|
| **YouTube** | /source/youtube 채널(NAVER D2, 임커밋, Modal, The AI Grid, Matt Wolfe, AI LABS, Vizuara, AI Engineer) + 시드 영상 2개 | `watch` 스킬로 자막 요약 |
| **News/Blog** | The Verge(AI), Wired(AI), Ars Technica(AI), AWS ML Blog, Databricks, Roboflow, Hacker News, NAVER D2, **GeekNews(news.hada.io)** | RSS 기반. GeekNews는 `geeknews-search` 스킬 재사용 가능, 이미 한국어 |
| **트렌딩** | GitHub trending repos, HuggingFace 인기 모델 | 메타데이터 위주, 1줄 요약 |
| **논문** | arXiv cs.AI / cs.LG / cs.CL | 초록 → 한국어 요약 |

### 시드 리서치 URL

- https://youtu.be/mMgCEJEAm54
- https://youtu.be/5q5ZUpwgj4E

## 6. 데이터 스키마

### 6.1 feed 아이템 (`data/feed.json` — 배열)

```json
{
  "id": "url 해시 등 고유키",
  "sourceType": "youtube | news | paper | repo | model",
  "source": "The Verge AI",
  "title": "원문 제목",
  "url": "https://...",
  "thumbnail": "https://...(선택)",
  "publishedAt": "2026-06-18",
  "fetchedAt": "2026-06-18T08:00:00Z",
  "summaryKo": "한국어 2~3문장 요약",
  "tags": ["LLM", "Diffusion"],
  "entities": ["OpenAI", "GPT-5"],
  "score": 123,
  "summaryStatus": "ok | fallback | skipped"
}
```

### 6.2 trending (`data/trending.json`)

- GitHub/HF 순위 아이템. feed 스키마 재사용 + `score`(stars/likes), 언어/날짜 필드.

### 6.3 state (`data/state.json`)

- `lastRunAt`, 이미 처리한 `id` 집합(seen) → **중복 재요약 방지**(구독 사용량 절약).

## 7. 대시보드 (viewer)

- `index.html` + `app.js` + 최소 CSS. 빌드 없음(vanilla). **디자인/스타일은 사용자가 추후 제공** → 지금은 기능 골격만.
- `data/*.json`을 fetch해서 렌더링. 로컬에서 정적 서버(`python -m http.server` 등) 또는 file:// 상대경로.
- 기능:
  - 탭: **피드 / 트렌딩**
  - 필터: `sourceType`별, `tag`별
  - 정렬: 최신순(기본), score순(트렌딩)
  - 카드: source · 태그 · 제목 · `summaryKo` · 원문 링크 · 날짜 · `summaryStatus` 표시

## 8. 갱신 / 스케줄

- 파이프라인은 **수동 실행**과 **로컬 스케줄** 둘 다 지원하도록 구현.
- **로컬 스케줄 필수**: `watch` 스킬이 로컬 `yt-dlp`를 사용하므로 클라우드 cron은 사용 불가.
- 매일 아침 로컬 cron이 헤드리스 세션(`claude -p "ai-trend 수집 실행"` 형태)을 띄워 파이프라인 수행.
- 1차 구현은 수동 실행으로 검증 → 동일 파이프라인을 로컬 cron에 연결.

## 9. 에러 처리 / 안전장치

- **소스별 격리**: 한 소스 실패가 전체 파이프라인을 막지 않는다.
- **YouTube 폴백**: 자막 없음 / Whisper 키 없음 → 영상 설명·메타데이터로 폴백 요약, `summaryStatus: "fallback"` 표시.
- **중복 방지**: `state.json`의 seen id로 이미 요약한 항목 재요약 안 함.
- **rate limit 보호**: 실행당 소스별 최신 N개로 캡(예: N=10).
- **부분 실패 가시화**: 요약 실패 항목은 `summaryStatus: "skipped"`로 남겨 추후 재시도.

## 10. 기술 스택

- **fetch 스크립트**: Node.js(권장 — viewer와 동일 언어로 단일 스택) 또는 Python. RSS/arXiv/GitHub/HF는 표준 라이브러리 + fetch 수준으로 충분.
- **summarize**: Claude Code 에이전트(구독) + `watch` 스킬(YouTube) + `geeknews-search` 스킬(GeekNews).
- **viewer**: vanilla HTML/JS/CSS, 빌드 없음.
- **데이터**: 로컬 JSON 파일(`data/`).

## 11. 디렉터리(안)

```
ai-trend/
  sources.json            # 소스 정의(추가/삭제 자유)
  data/
    feed.json
    trending.json
    state.json
  pipeline/               # fetch 스크립트
  web/
    index.html
    app.js
    style.css             # 최소 골격 (디자인 추후 교체)
  docs/superpowers/specs/ # 본 문서
```

## 12. 확장 여지 (지금은 안 함)

- 공개 서비스(Next.js) 전환 — 데이터 계약 동일하므로 viewer만 교체.
- Obsidian용 Markdown 다이제스트 추가 출력(같은 데이터 재사용).
- Whisper 키 추가 시 자막 없는 영상도 요약 가능.
