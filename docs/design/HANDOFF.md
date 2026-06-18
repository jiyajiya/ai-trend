# Handoff: AI 트렌드 대시보드 (Source Board)

## Overview
AI · 테크 분야의 최신 트렌드 콘텐츠(뉴스 · 영상 · SNS · 블로그 · 논문)를 **소스별 보드** 형태로 한곳에 모아 보는 개인 대시보드. 상단에 실시간 트렌딩 랭킹(Top 5)을 띄우고, 그 아래를 소스 종류별 4개 컬럼으로 나누어 보여준다. 카테고리 탭 · 검색 · 북마크 · 다크모드가 핵심 기능이다.

## About the Design Files
이 번들의 파일은 **HTML로 만든 디자인 레퍼런스(프로토타입)** 이다 — 의도한 외형과 동작을 보여주는 목업이며, 그대로 복사해 배포할 프로덕션 코드가 아니다.
작업의 목표는 이 HTML 디자인을 **대상 코드베이스의 기존 환경(React / Vue / Next.js 등)과 그 패턴 · 라이브러리로 재구현**하는 것이다. 아직 환경이 없다면 프로젝트에 가장 적합한 프레임워크를 선택해 구현한다.
원본은 단일 파일 컴포넌트 형식(`.dc.html`)으로 작성되어 있으나, 이는 우리 디자인 도구의 포맷일 뿐이다. 마크업과 인라인 스타일, 상태 로직을 읽고 대상 프레임워크의 컴포넌트로 옮기면 된다.

## Fidelity
**High-fidelity (hifi).** 최종 색상 · 타이포그래피 · 간격 · 인터랙션이 확정된 픽셀 단위 목업이다. 아래 디자인 토큰과 컴포넌트 명세를 그대로 사용해 UI를 픽셀 단위로 재현한다.

---

## Screens / Views

### 1. 데스크탑 — Source Board (기본 폭 1320px, 반응형)

**Purpose**: 사용자가 카테고리/검색으로 관심 트렌드를 좁히고, 소스별 컬럼에서 콘텐츠를 훑고, 마음에 드는 항목을 북마크한다.

**Layout (위 → 아래)**
1. **Top bar** — `display:flex; align-items:center; gap:18px; padding:16px 28px`, 하단 `1px` 보더.
   - 좌: 로고 블록 (`gap:11px`) — 27×27 아이콘 + 워드마크 + `BOARD` 라벨
   - 로고 우측: 카테고리 nav (`display:flex; gap:4px; margin-left:6px`)
   - `margin-left:auto`로 우측 정렬되는 검색 입력 (고정 폭 260px)
   - 다크모드 토글 버튼
2. **Trending strip** — `padding:20px 28px`, 하단 `1px` 보더. 섹션 라벨 + `grid-template-columns:repeat(5,1fr); gap:14px` 카드 5개.
3. **Source columns** — `display:grid; grid-template-columns:repeat(4,1fr); align-items:start`. 각 컬럼 `padding:20px 18px`, 마지막 컬럼 제외 우측 `1px` 보더.

**페이지 컨테이너**: `background:#fbfbf9; border-radius:3px; box-shadow:0 1px 3px rgba(0,0,0,.09); overflow:hidden`.

#### 컴포넌트

**카테고리 탭 (chip)**
- `padding:8px 14px; border-radius:999px; font-size:13px; white-space:nowrap`
- 비활성: `background:#f4f4f2; color:상속(#16161a); font-weight:500`
- 활성: `background:oklch(0.55 0.2 285)`(ACCENT); `color:#fff; font-weight:700`
- 목록: `전체 · LLM · 에이전트 · 멀티모달 · 하드웨어 · 정책/규제 · 오픈소스`

**검색 입력**
- 래퍼: `width:260px; display:flex; align-items:center; gap:9px; padding:9px 14px; background:#f4f4f2; border:1px solid #ececea; border-radius:9px`
- 좌측 `⌕` 글리프 (`color:#a8a69e`), placeholder `검색…`
- `input`: 테두리/배경 없음, `font-size:14px`

**다크모드 토글**
- `display:flex; gap:7px; padding:8px 13px; background:#f4f4f2; border:1px solid #ececea; border-radius:999px; font-size:13px; font-weight:600`
- 내부: 13×13 원형 점 + 라벨. 라이트일 때 점 `#16161a`/라벨 `Dark`, 다크일 때 점 `#f3f3f5`/라벨 `Light`

**트렌딩 카드 (×5)**
- `background:#fff; border:1px solid #ececea; border-radius:11px; padding:15px 16px`
- 상단 행: 순위 번호 `JetBrains Mono 700 20px` (색 = 소스 컬러) + 우측 타입 배지
- 제목 `font-size:13.5px; line-height:1.4; font-weight:700; color:#22222a; text-wrap:pretty`
- 하단: metric `JetBrains Mono 500 11px; color:#b0aea6`
- 정렬: `score` 내림차순 상위 5개. 순위는 `01`, `02`… (2자리 zero-pad)

**타입 배지 (pill)**
- `padding:3px 8px; border-radius:999px; font:600 10px/1 'JetBrains Mono'`
- `color` = 소스 컬러, `background` = 소스 틴트 (아래 토큰)

**컬럼 헤더**
- `display:flex; align-items:center; gap:9px; margin-bottom:14px`
- 10×10 원형 점(소스 컬러) + 라벨 `font-size:14px; font-weight:800` + 우측 카운트 `JetBrains Mono 500 11px; color:#b0aea6`
- 컬럼 4개: `뉴스`(news) · `영상`(video) · `소셜 · 블로그`(sns+blog) · `논문`(paper)

**콘텐츠 카드 (컬럼 내부)**
- `background:#fff; border:1px solid #ececea; border-radius:9px; padding:13px 14px; display:flex; gap:11px`
- 좌측 3px 폭 컬러 바 (`border-radius:3px`, 소스 컬러)
- 본문: 제목 행(제목 `14px/1.4 700 #22222a` + 우측 북마크 버튼), 요약 `Pretendard 400 12px/1.5 #7a786f`, 메타 행(source · time · metric, `JetBrains Mono 500 11px`)
- 호버: `transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,.07)` (transition `.14s ease`)

**북마크 버튼**
- 글리프 토글 `☆`(미저장) ↔ `★`(저장), `font-size:16px`
- 색: 저장 시 ACCENT, 미저장 시 `oklch(0.72 0 0)` (연회색)

**썸네일 플레이스홀더** (영상/카드 이미지 자리)
- `repeating-linear-gradient(135deg,#f0f0ed 0 11px,#f7f7f4 11px 22px)`, 중앙에 `[<타입> thumbnail]` 모노 텍스트(`color:#bdbcb4`)
- 실제 구현 시 실제 썸네일 이미지로 대체

**빈 상태**: 필터 결과 0건이면 `padding:60px 28px; text-align:center; font-size:15px; color:#a8a69e` 의 “검색 결과가 없습니다.”

### 2. 모바일 (폭 390px)
- 데스크탑과 동일 데이터/기능. 4개 컬럼을 **세로 섹션으로 스택**한다 (항목 있는 섹션만 노출).
- Top bar: 로고 + 다크 토글(우측) → 그 아래 전체폭 검색 입력
- 카테고리 탭은 `overflow-x:auto` 가로 스크롤
- 콘텐츠 카드: `border-radius:11px; padding:14px 15px`, 제목 `15px`, 요약 `13px/1.55`, 메타 `source · time`
- 디자인 목업은 8px `#15151a` 보더의 기기 프레임으로 감싸 보여줄 뿐, 실제 앱에서는 프레임 불필요

---

## Interactions & Behavior
- **카테고리 탭 클릭** → `cat` 상태 변경 → 모든 컬럼/트렌딩이 해당 카테고리로 필터. `전체`는 전체 표시.
- **검색 입력** → `q` 상태(소문자, trim) → `title+summary+source+tagText`에 부분일치하는 항목만. 카테고리와 AND 조건.
- **북마크 버튼** → 해당 item id의 저장 상태 토글. 글리프/색 즉시 반영.
- **다크모드 토글** → `dark` 불리언 토글 → 페이지/카드/텍스트/보더 색 일괄 전환 (아래 다크 토큰).
- **호버**: 컬럼 콘텐츠 카드만 살짝 떠오름(translateY -2px + 그림자).
- **반응형**: 데스크탑 4열 → 좁아지면 세로 스택(모바일 명세 참조). 권장 분기점: ~960px 이하 1열, 960–1280px 2열.
- 트렌딩 랭킹은 카테고리/검색과 무관하게 항상 전체 기준 Top 5 표시(현 명세). 필요 시 필터 연동으로 바꿀 수 있음.

## State Management
- `dark: boolean` — 다크모드. 기본 `false`. localStorage 영속 권장.
- `q: string` — 검색어. 기본 `''`.
- `cat: string` — 활성 카테고리. 기본 `'전체'`.
- `bm: Record<string, boolean>` — item id → 북마크 여부. 영속 권장.
- 파생값: `filtered`(cat+q 적용), `columns`(소스 타입별 그룹), `trending`(score 상위 5), `noResults`.
- 데이터 페칭: 현재는 정적 샘플 배열. 실제 구현 시 소스별 RSS/API/유튜브 데이터를 정규화해 동일 item 스키마로 매핑.

### Item 스키마
```ts
type Item = {
  id: string;
  type: 'news' | 'blog' | 'video' | 'sns' | 'paper';
  title: string;
  summary: string;
  source: string;     // 예: "유튜브 · OpenAI", "arXiv"
  time: string;       // 상대 시간 표시 문자열 (예: "2시간 전")
  tagText: string;    // 예: "#GPT5  #음성AI" (검색 대상에 포함)
  metric: string;     // 예: "42만 회", "1.8k", "인용 34"
  cats: string[];     // 카테고리 태그 (필터 기준)
  score: number;      // 트렌딩 정렬 점수
};
```

## Design Tokens

### Color — Base (Light)
| 역할 | 값 |
|---|---|
| 캔버스(프레임 배경) | `#e7e5df` |
| 페이지 배경 | `#fbfbf9` |
| 카드/바 표면 | `#ffffff` |
| 칩/입력 배경 | `#f4f4f2` |
| 보더 | `#ececea` |
| 본문 텍스트 | `#16161a` / 제목 `#22222a` |
| 보조 텍스트(muted) | `#7a786f` |
| 메타/약한 텍스트 | `#a8a69e` · `#b0aea6` · `#c0beb6` |

### Color — Accent & Sources (oklch)
| 이름 | color | tint(배경) |
|---|---|---|
| ACCENT (브랜드/활성) | `oklch(0.55 0.2 285)` | `oklch(0.95 0.045 285)` |
| 뉴스 news | `oklch(0.55 0.16 250)` | `oklch(0.96 0.03 250)` |
| 블로그 blog | `oklch(0.52 0.13 155)` | `oklch(0.96 0.035 155)` |
| 영상 video | `oklch(0.57 0.19 28)` | `oklch(0.96 0.04 28)` |
| SNS sns | `oklch(0.55 0.17 330)` | `oklch(0.96 0.035 330)` |
| 논문 paper | `oklch(0.54 0.11 95)` | `oklch(0.96 0.04 95)` |

### Color — Dark Mode (override)
| 역할 | 값 |
|---|---|
| 페이지 배경 | `#101014` |
| 바 배경 | `#16161b` |
| 표면(카드) | `#1a1a20` / 보더 `#2a2a31` |
| 본문 텍스트 | `#f3f3f5` |
| muted | `#9a9aa3` |
| 칩 배경 | `#26262d` / 텍스트 `#cfcfd6` |
| 입력 | `#22222a` / 보더 `#2f2f37` |
| 소스/ACCENT 컬러는 그대로 유지(라이트와 동일) |

### Typography
- 본문/제목: **Pretendard** (한국어 가독성). CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`
- 라벨/메타/숫자: **JetBrains Mono** (400/500/600). Google Fonts.
- 스케일: 워드마크 18 / 섹션 제목 14·800 / 카드 제목 13.5–15·700 / 본문·요약 12–14 / 메타 11 mono
- 제목에는 `letter-spacing:-.01em` 및 `text-wrap:pretty` 적용

### Radius / Shadow / Spacing
- Radius: 입력·칩(작은) `9px`, 카드 `9–11px`, 페이지 `3px`, pill `999px`, 로고 아이콘 `6–7px`
- Shadow: 페이지 `0 1px 3px rgba(0,0,0,.09)`, 카드 호버 `0 6px 16px rgba(0,0,0,.07)`
- Spacing: 섹션 패딩 `20px 28px`, 카드 패딩 `13–15px`, gap 주로 `9–18px`
- 보더: `1px solid #ececea` (라이트), 다크 `#2a2a31`

## Assets
- 이미지/아이콘 에셋 없음. 썸네일은 모두 줄무늬 플레이스홀더로 표현 — 실제 구현 시 각 소스의 실제 썸네일 이미지로 대체.
- 아이콘 글리프: `▲`(로고/트렌딩), `⌕`(검색), `★`/`☆`(북마크). 코드베이스의 아이콘 라이브러리로 교체 권장.
- 폰트: Pretendard, JetBrains Mono (위 링크). 사내 폰트 시스템이 있으면 그것을 사용.

## Files
- `AI 트렌드 대시보드 v2.dc.html` — **확정본(시안 B)**. 이 핸드오프의 기준 디자인. 데스크탑 + 모바일 프레임을 나란히 포함하며, 검색/필터/북마크/다크모드 로직이 들어 있다. 인라인 스타일과 하단 `class Component` 로직을 참고할 것.
- `AI 트렌드 대시보드.dc.html` — 초기 3개 시안 비교본(시안 A·B·모바일). 참고용. 채택되지 않은 A안의 에디토리얼 레이아웃이 궁금할 때만 참조.

> `.dc.html`을 읽는 법: 파일 상단 `<x-dc>…</x-dc>` 사이가 마크업(인라인 스타일), 하단 `<script data-dc-script>`의 `class Component extends DCLogic`의 `renderVals()`가 상태/파생 데이터/핸들러다. 템플릿의 `{{ x }}`는 `renderVals()`가 반환한 값이고 `sc-for`는 반복, `sc-if`는 조건 렌더다.
