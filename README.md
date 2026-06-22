# AX 개발팀 · AI 트렌드 대시보드

AI 관련 트렌드(영상·소셜/블로그·뉴스·약사·GitHub·HuggingFace)를 매일 자동으로 모아 **한국어로 요약**해 한 화면에서 빠르게 훑어보는 개인용 대시보드.

**🔗 라이브:** https://jiyajiya.github.io/ai-trend/

---

## 무엇인가

- **수집 → 요약 → 게시**가 매일 자동으로 도는 정적 대시보드입니다.
- 요약은 별도 LLM API 비용 없이 **Claude 구독 세션**(`claude -p` 헤드리스)이 수행합니다.
- 결과(`data/*.json`)를 GitHub에 push하면 **GitHub Pages가 자동 갱신**됩니다.

### 화면 구성 (3단 레이아웃)
- **① 좌측 사이드바**: 브랜드 · 메뉴(FEED 매체별 / 분야 / 보기) · CATEGORY 주제 필터 · 검색 · 다크모드
- **② 중앙 리더**: 선택한 피드를 넓은 카드로 한 편씩 — 제목·한국어 요약·출처·시간·태그·북마크(★)
- **③ 우측 상세 분석 패널**: 카드를 클릭하면 핵심 포인트·상세 정리·인용을 표시(영상은 자막 기반 분석)
- **🏆 추천 모델(분야 메뉴)**: LMSYS Arena · Artificial Analysis · LLM Stats · Vellum 등 주요 리더보드를 종합한 **영역별 추천 모델**(종합지능·추론·코딩·수학·시각·이미지생성·오픈웨이트·가성비). 약사·전문(💊)/개발자(⚙️) 타깃 배지, 지표 설명·출처·기준일을 하단에 명시. **매일 웹검색으로 자동 갱신**(`data/leaderboard.json`).

### 카테고리
`전체` · `LLM·모델` · `에이전트` · `코딩·개발` · `멀티모달` · `기업·정책`

---

## 아키텍처

파이프라인은 **fetch(스크립트) → summarize(에이전트) → merge(스크립트)** 3단계로 분리됩니다.

```
sources.json ──▶ [fetch]  pipeline/fetch.mjs        ──▶ data/raw.json
                  (RSS·GitHub·HuggingFace·YouTube, 순수 Node, LLM 없음)
data/raw.json ─▶ [summarize]  claude -p (RUNBOOK)   ──▶ data/summarized.json
                  (한국어 요약·태그·카테고리, YouTube는 watch 스킬 자막 요약)
              ─▶ [leaderboard]  claude -p (LEADERBOARD) ─▶ data/leaderboard.json
                  (주요 리더보드 웹검색 종합, 영역별 추천 모델, 매일 갱신)
              ─▶ [merge]  pipeline/merge.mjs         ──▶ data/feed.json · trending.json
                  (중복 제거·트렌딩 7일 만료·rank)
web/ (index.html · app.js · adapt.mjs · style.css) ─▶ data/*.json 을 읽어 렌더
```

- 소스 정의: `sources.json` (뉴스/소셜·블로그 RSS, 약사 RSS·스크레이프, GitHub 토픽, HuggingFace, YouTube 채널)
- 요약 규칙: `pipeline/RUNBOOK.md`
- 수집 기간 제한은 메뉴마다 다름(영상 30일 · 뉴스/소셜·블로그/약사 90일 · GitHub 60일). → 「[데이터 소스 · 수집 기준](#데이터-소스--수집-기준--키워드)」 참고

### 디렉터리
```
sources.json              # 소스 정의
lib/                      # id·jsonfile·rss 파서
pipeline/                 # fetch.mjs · merge.mjs · sources/* · run.sh · RUNBOOK.md · plist
web/                      # 대시보드(정적): index.html · app.js · adapt.mjs · style.css
data/                     # feed.json · trending.json (게시) / raw·summarized·state(로컬 전용)
index.html                # 루트 → /web/ 리다이렉트
docs/                     # 설계·계획·디자인 핸드오프
```

---

## 데이터 소스 · 수집 기준 · 키워드

### 공통 규칙 (모든 메뉴)
- **수집 주기**: 매일 오전 9시 자동 1회 (수집 → AI 한국어 요약·분석 → 게시)
- **요약·분석**: 수집한 글·영상을 AI가 한국어 요약(2~3문장) + 태그 + 카테고리 + 상세 분석(핵심 포인트·정리·인용)까지 생성. **영상은 자막을 직접 분석**.
- **중복·보관**: 한 번 들어온 글은 중복 제거(`seen`) 후 보관, 피드 최대 200건.

### 메뉴별 소스 · 조회 기준 · 키워드

| 메뉴 | 소스 | 조회 기준일 | 키워드/필터 | 회당 수집량 |
|---|---|---|---|---|
| **영상** | 선별된 AI 유튜브 채널 8개 (`youtube.com/feeds/videos.xml?channel_id=…`) | **발행일 30일 이내** | 채널 큐레이션 (키워드 X) | 채널당 5편 |
| **소셜·블로그** | Hacker News · GeekNews · 요즘IT · r/MachineLearning · r/LocalLLaMA · Threads | **발행일 90일 이내** | Hacker News만 `AI OR LLM` / 나머지는 커뮤니티 피드 | 소스당 8건 |
| **뉴스** | OpenAI · Google AI · Anthropic News · Anthropic Eng · NVIDIA AI Blog · MIT Tech Review AI · AI Trends | **발행일 90일 이내** | AI 전문 매체라 키워드 필터 없이 최신 수집 | 소스당 8건 |
| **약사** | 약사공론(RSS) · 데일리팜(스크레이프) · 대한약사회(게시판 POST) | **발행일 90일 이내** | **AI 키워드 9종 필터**(아래) | 소스당 8건 |
| **GitHub** | GitHub 검색 — 토픽 `llm` · `generative-ai` · `ai-agents` | **최근 60일 생성** 레포 | 토픽 + 스타순 | 토픽당 5개 |
| **HuggingFace** | HuggingFace 트렌딩 모델 | 기간 대신 **트렌딩 점수** 상위 | 트렌딩 순위 | 상위 10개 |

> **약사 메뉴 AI 키워드(9종)**: `AI` · `인공지능` · `LLM` · `GPT` · `챗봇` · `생성형` · `머신러닝` · `딥러닝` · `디지털헬스`
> 제목·본문에 하나라도 있으면 수집. 영문 약어(AI·LLM·GPT)는 단어 단위로만 매칭해 오탐 방지(예: "Azelaic"의 ai 제외).

### "조회 기준일"이 메뉴마다 다른 이유
- **영상** → 발행일 **30일 이내** (채널 최신 5편 중)
- **뉴스 · 소셜·블로그 · 약사** → 발행일 **90일 이내** (`maxAgeDays`)
- **GitHub** → 최근 **60일 내 생성**된 신규 레포 (`createdWithinDays`)
- **HuggingFace** → 기간이 아닌 **트렌딩 점수** 상위 10
- GitHub·HuggingFace는 "지금 뜨는" 성격이라 **7일이 지나면 목록에서 자동 만료**(`TRENDING_MAX_AGE_DAYS`).

### FEED ≠ CATEGORY
- **FEED(좌측 메뉴)** = 출처를 **매체/분야**로 나눈 것 (영상·뉴스·약사 등).
- **CATEGORY**(`전체`·`LLM·모델`·`에이전트`·`코딩·개발`·`멀티모달`·`기업·정책`) = AI가 각 글에 붙인 **주제 태그**로, 매체와 **무관하게 교차 필터**된다. (예: 뉴스 메뉴 + 에이전트 카테고리)

---

## 실행 방법

### A. 자동 (권장) — 매일 오전 9시 launchd
노트북이 9시에 켜져 있으면 즉시, 잠들어 있었으면 깨어날 때 1회 실행됩니다.

```bash
# 설치 (1회)
cp pipeline/com.ax.ai-trend.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ax.ai-trend.plist

# 등록 확인
launchctl print gui/$(id -u)/com.ax.ai-trend | grep state

# 지금 즉시 1회 실행(테스트)
launchctl kickstart -k gui/$(id -u)/com.ax.ai-trend

# 로그
tail -f /tmp/ai-trend.log
```

`run.sh`가 **fetch → summarize(`claude -p`) → merge → git push** 까지 수행하고, push되면 GitHub Pages가 자동 갱신됩니다.

전제:
- `claude` CLI가 로그인된 상태 (헤드리스 요약용)
- 원격이 HTTPS + `gh auth setup-git` (비대화형 push용)

### B. 수동 1회
```bash
bash pipeline/run.sh
```
또는 단계별:
```bash
npm run fetch                       # data/raw.json
# 이어서 Claude 세션에서 "ai-trend 수집 실행" (RUNBOOK summarize) → data/summarized.json
npm run merge                       # data/feed.json · trending.json
```

### C. 로컬에서 화면만 보기
```bash
python3 -m http.server 8080
# http://localhost:8080/web/   (data/feed.json 없으면 feed.sample.json 으로 폴백)
```

---

## 종료 / 일시중지

```bash
# 스케줄 해제(자동 실행 중지)
launchctl bootout gui/$(id -u)/com.ax.ai-trend

# 완전 제거(파일까지)
launchctl bootout gui/$(id -u)/com.ax.ai-trend
rm ~/Library/LaunchAgents/com.ax.ai-trend.plist
```

해제 후에도 수동 실행(B)과 라이브 사이트는 그대로 동작합니다(데이터만 갱신 안 됨).

---

## 소스 추가·변경

`sources.json`을 편집합니다.
- **뉴스/소셜·블로그**: `news[]`에 `{ "source": "이름", "url": "RSS주소" }` 추가. 분류(뉴스 vs 소셜·블로그 컬럼)는 `web/adapt.mjs`의 `BLOG`/`SNS` 세트로 결정.
- **약사(분야)**: `pharma.rss[]`(RSS) 또는 `pharma.scrape[]`(HTML/POST 스크레이프) 추가. `pharma.aiKeywords`로 AI 필터 키워드 조절. 스크레이프 파서는 `pipeline/sources/pharma.mjs`의 `PARSERS`에 추가.
- **YouTube**: `youtube.channels[]`에 `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>` 추가. `perChannel`로 채널당 개수, `youtube.maxAgeDays`로 기간(현재 30일) 조절.
- **GitHub 트렌딩**: `github.queries`(토픽)·`createdWithinDays`(최근 N일)·`perQuery`.
- **HuggingFace**: `huggingface.limit`.

추가한 RSS는 실제로 항목을 반환하는지 먼저 확인하세요(일부 사이트는 RSS가 없거나 봇 차단).

---

## 테스트
```bash
npm test     # node --test (파서·어댑터·merge·뷰어 어댑터)
```

## 기술 스택
Node.js 22 (ESM, 런타임 의존성 0) · vanilla HTML/CSS/JS · GitHub Pages · launchd · Claude(`claude -p` + `watch` 스킬)
