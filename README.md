# AX 개발팀 · AI 트렌드 대시보드

AI 관련 트렌드(뉴스·영상·소셜/블로그·GitHub·HuggingFace)를 매일 자동으로 모아 **한국어로 요약**해 한 화면에서 빠르게 훑어보는 개인용 대시보드.

**🔗 라이브:** https://jiyajiya.github.io/ai-trend/

---

## 무엇인가

- **수집 → 요약 → 게시**가 매일 자동으로 도는 정적 대시보드입니다.
- 요약은 별도 LLM API 비용 없이 **Claude 구독 세션**(`claude -p` 헤드리스)이 수행합니다.
- 결과(`data/*.json`)를 GitHub에 push하면 **GitHub Pages가 자동 갱신**됩니다.

### 화면 구성 (사이드바 + 리더)
- **좌측 사이드바**: 브랜드 · FEED 네비(영상 / 소셜·블로그 / 뉴스 / GitHub / HuggingFace) · CATEGORY 필터 · 다크모드
- **우측 리더**: 선택한 피드를 넓은 카드로 한 편씩 — 제목·한국어 요약·출처·시간·태그·북마크

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
              ─▶ [merge]  pipeline/merge.mjs         ──▶ data/feed.json · trending.json
                  (중복 제거·90일 만료·트렌딩 rank)
web/ (index.html · app.js · adapt.mjs · style.css) ─▶ data/*.json 을 읽어 렌더
```

- 소스 정의: `sources.json` (뉴스/블로그 RSS, GitHub 토픽, HuggingFace, YouTube 채널)
- 요약 규칙: `pipeline/RUNBOOK.md`
- 90일 초과 글은 수집 단계에서 제외(`maxAgeDays`)

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
- **YouTube**: `youtube.channels[]`에 `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>` 추가. `perChannel`로 채널당 개수 조절.
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
