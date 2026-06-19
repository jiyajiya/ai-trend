# 상세 분석 패널 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영상·뉴스·블로그 카드를 클릭하면 우측 3번째 컬럼 패널에 구조화된 상세 분석(`analysis`)을 표시한다.

**Architecture:** 요약 단계에서 카드용 짧은 `summaryKo`와 별도로 구조화 객체 `analysis`(`points`/`sections`/`quotes`)를 생성·저장한다. 웹은 `adapt.mjs`에서 `analysis`를 정규화하고, `app.js`가 카드 선택 상태에 따라 우측 패널을 렌더한다. 기존 영상 24건은 전용 패치 스크립트로 백필한다.

**Tech Stack:** Node.js 22 (ESM, 런타임 의존성 0), vanilla HTML/CSS/JS, `node --test`, GitHub Pages, Claude `watch` 스킬.

## Global Constraints

- 런타임 의존성 0 (외부 npm 패키지 추가 금지). 표준 라이브러리만.
- ESM(`.mjs`), Node 22.
- 모든 사용자 표시 텍스트는 웹에서 `esc()`로 이스케이프.
- 기존 필드(`summaryKo`, `tags`, `entities`, `cats`, `summaryStatus`)는 보존. `analysis`는 추가 필드이며 카드 요약을 대체하지 않는다.
- 적용 범위: `viewType` 기준 **video · news · blog**. SNS·repo·model은 `analysis` 대상이 아니다.
- 테스트는 `npm test`(`node --test`)로 전부 green이어야 한다.

---

## File Structure

- `web/adapt.mjs` (수정) — `normalizeAnalysis()` 추가, `toViewItem`이 `analysis` 정규화해 전달.
- `web/app.js` (수정) — `state.selectedId`, 카드 클릭 핸들러, 패널 렌더(`renderPanel`).
- `web/index.html` (수정) — `<main>` 옆에 `<aside class="panel" id="panel">` 추가.
- `web/style.css` (수정) — 3컬럼 그리드 + 좁은 폭 오버레이.
- `pipeline/apply-analysis.mjs` (신규) — `{id: analysis}` 맵을 `feed.json`에 in-place 병합하는 순수 함수 + CLI.
- `pipeline/RUNBOOK.md` (수정) — summarize 단계 `analysis` 생성 규칙.
- `test/adapt.test.mjs` (수정) — `normalizeAnalysis`/`toViewItem` 케이스.
- `test/apply-analysis.test.mjs` (신규) — 패치 병합 케이스.
- `test/merge.test.mjs` (수정) — 신규 항목 `analysis` 통과 회귀 가드.
- `data/feed.json` (백필로 갱신) — 영상 24건에 `analysis` 추가.

---

## Task 1: adapt.mjs — analysis 정규화

**Files:**
- Modify: `web/adapt.mjs`
- Test: `test/adapt.test.mjs`

**Interfaces:**
- Produces: `normalizeAnalysis(raw)` → `{ points: string[], sections: {heading:string, body:string}[], quotes: string[] } | null`. 유효 내용(`points` 1개 이상)이 없으면 `null`.
- Produces: `toViewItem(item, nowMs)` 반환 객체에 `analysis` 키 추가(정규화 결과 또는 `null`).
- Consumes: 없음(이전 태스크 없음).

- [ ] **Step 1: 실패하는 테스트 작성** (`test/adapt.test.mjs` 맨 아래에 추가)

```js
import { normalizeAnalysis } from '../web/adapt.mjs';

test('normalizeAnalysis: 정상 객체를 그대로 정규화한다', () => {
  const out = normalizeAnalysis({
    points: ['p1', 'p2'],
    sections: [{ heading: 'h', body: 'b' }],
    quotes: ['q1'],
  });
  assert.deepEqual(out, {
    points: ['p1', 'p2'],
    sections: [{ heading: 'h', body: 'b' }],
    quotes: ['q1'],
  });
});

test('normalizeAnalysis: 누락 필드는 빈 배열로 보정한다', () => {
  const out = normalizeAnalysis({ points: ['only'] });
  assert.deepEqual(out, { points: ['only'], sections: [], quotes: [] });
});

test('normalizeAnalysis: sections 항목의 heading/body 누락을 빈 문자열로 보정한다', () => {
  const out = normalizeAnalysis({ points: ['p'], sections: [{ heading: 'h' }, {}] });
  assert.deepEqual(out.sections, [{ heading: 'h', body: '' }, { heading: '', body: '' }]);
});

test('normalizeAnalysis: 비배열/누락/빈 points는 null', () => {
  assert.equal(normalizeAnalysis(undefined), null);
  assert.equal(normalizeAnalysis(null), null);
  assert.equal(normalizeAnalysis({ points: 'x' }), null);
  assert.equal(normalizeAnalysis({ points: [] }), null);
  assert.equal(normalizeAnalysis({ sections: [{ heading: 'h', body: 'b' }] }), null);
});

test('toViewItem: analysis를 정규화해 전달한다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  const withA = toViewItem({
    id: 'a1', sourceType: 'youtube', source: 'Jay', title: 'T', url: 'https://x/1',
    summaryKo: 's', analysis: { points: ['p'], sections: [{ heading: 'h', body: 'b' }] },
    publishedAt: '2026-06-18T11:00:00Z', fetchedAt: '2026-06-18T11:00:00Z',
  }, now);
  assert.deepEqual(withA.analysis, { points: ['p'], sections: [{ heading: 'h', body: 'b' }], quotes: [] });

  const without = toViewItem({
    id: 'a2', sourceType: 'news', source: 'OpenAI', title: 'T', url: 'https://x/2',
    summaryKo: 's', publishedAt: '2026-06-18T11:00:00Z', fetchedAt: '2026-06-18T11:00:00Z',
  }, now);
  assert.equal(without.analysis, null);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/adapt.test.mjs`
Expected: FAIL — `normalizeAnalysis` is not exported / `analysis` undefined.

- [ ] **Step 3: 최소 구현** (`web/adapt.mjs`)

`viewType` 위(파일 상단 import 직후)에 추가:

```js
export function normalizeAnalysis(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const points = Array.isArray(raw.points) ? raw.points.filter((p) => typeof p === 'string' && p.trim()) : [];
  if (points.length === 0) return null;
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .filter((s) => s && typeof s === 'object')
    .map((s) => ({ heading: typeof s.heading === 'string' ? s.heading : '', body: typeof s.body === 'string' ? s.body : '' }));
  const quotes = (Array.isArray(raw.quotes) ? raw.quotes : []).filter((q) => typeof q === 'string' && q.trim());
  return { points, sections, quotes };
}
```

`toViewItem`의 `return { ... }` 객체에 한 줄 추가:

```js
    analysis: normalizeAnalysis(item.analysis),
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/adapt.test.mjs`
Expected: PASS (기존 테스트 포함 전부).

- [ ] **Step 5: 커밋**

```bash
git add web/adapt.mjs test/adapt.test.mjs
git commit -m "feat(web): adapt에 analysis 정규화 추가"
```

---

## Task 2: apply-analysis.mjs — 백필 패치 스크립트

**Files:**
- Create: `pipeline/apply-analysis.mjs`
- Test: `test/apply-analysis.test.mjs`

**Interfaces:**
- Produces: `applyAnalysis(feed, analysisMap)` → 새 배열. `feed`의 각 항목 id가 `analysisMap`에 있으면 `{ ...item, analysis: analysisMap[id] }`로 교체, 없으면 원본 유지. `feed`는 변형하지 않는다(순수). `analysisMap`에만 있고 `feed`에 없는 id는 무시.
- Consumes: 없음.

- [ ] **Step 1: 실패하는 테스트 작성** (`test/apply-analysis.test.mjs` 신규)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAnalysis } from '../pipeline/apply-analysis.mjs';

test('applyAnalysis: 매칭 id에 analysis를 붙인다', () => {
  const feed = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
  const map = { a: { points: ['p'], sections: [], quotes: [] } };
  const out = applyAnalysis(feed, map);
  assert.deepEqual(out[0], { id: 'a', title: 'A', analysis: { points: ['p'], sections: [], quotes: [] } });
  assert.deepEqual(out[1], { id: 'b', title: 'B' });
});

test('applyAnalysis: feed에 없는 id는 무시한다', () => {
  const feed = [{ id: 'a', title: 'A' }];
  const out = applyAnalysis(feed, { z: { points: ['x'] } });
  assert.deepEqual(out, [{ id: 'a', title: 'A' }]);
});

test('applyAnalysis: 원본 feed를 변형하지 않는다', () => {
  const feed = [{ id: 'a', title: 'A' }];
  applyAnalysis(feed, { a: { points: ['p'] } });
  assert.deepEqual(feed, [{ id: 'a', title: 'A' }]);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/apply-analysis.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: 최소 구현** (`pipeline/apply-analysis.mjs` 신규)

```js
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../lib/jsonfile.mjs';

export function applyAnalysis(feed, analysisMap) {
  return feed.map((item) =>
    Object.prototype.hasOwnProperty.call(analysisMap, item.id)
      ? { ...item, analysis: analysisMap[item.id] }
      : item);
}

// CLI: node pipeline/apply-analysis.mjs  (data/analysis-backfill.json → data/feed.json)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const feed = await readJson('data/feed.json', []);
  const map = await readJson('data/analysis-backfill.json', {});
  const patched = applyAnalysis(feed, map);
  const n = patched.filter((i) => i.analysis).length;
  await writeJson('data/feed.json', patched);
  console.log(`[apply-analysis] feed ${patched.length} / analysis 보유 ${n} (맵 ${Object.keys(map).length}건)`);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/apply-analysis.test.mjs`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add pipeline/apply-analysis.mjs test/apply-analysis.test.mjs
git commit -m "feat(pipeline): analysis 백필 패치 스크립트"
```

---

## Task 3: merge — 신규 항목 analysis 통과 회귀 가드

**Files:**
- Modify: `test/merge.test.mjs` (테스트만 추가, `merge.mjs` 코드 변경 없음)

**Interfaces:**
- Consumes: `mergeFeed({ summarized, existingFeed, existingTrending, state, now })` (기존 시그니처).

- [ ] **Step 1: 실패하지 않을 수도 있는 회귀 테스트 작성** (`test/merge.test.mjs` 맨 아래 추가)

```js
test('mergeFeed: 신규 피드 항목의 analysis를 그대로 보존한다', () => {
  const analysis = { points: ['p'], sections: [{ heading: 'h', body: 'b' }], quotes: [] };
  const r = mergeFeed({
    summarized: [{
      id: 'n1', sourceType: 'youtube', source: 'Jay', title: 'T',
      url: 'https://x/1', publishedAt: '2026-06-18T11:00:00Z',
      summaryKo: 's', analysis,
    }],
    existingFeed: [],
    existingTrending: [],
    state: { seen: [], lastRunAt: null },
    now: '2026-06-19T00:00:00Z',
  });
  assert.deepEqual(r.feed[0].analysis, analysis);
});
```

> 참고: `test/merge.test.mjs` 상단에 `mergeFeed`가 이미 import되어 있는지 확인하고, 없으면 `import { mergeFeed } from '../pipeline/merge.mjs';`를 추가한다.

- [ ] **Step 2: 테스트 실행**

Run: `node --test test/merge.test.mjs`
Expected: PASS (merge가 `{ ...item }` 스프레드로 이미 통과시키므로). 만약 FAIL이면 merge 동작이 가정과 다른 것이므로 멈추고 재검토.

- [ ] **Step 3: 커밋**

```bash
git add test/merge.test.mjs
git commit -m "test(merge): 신규 항목 analysis 통과 회귀 가드"
```

---

## Task 4: 상세 분석 패널 UI

**Files:**
- Modify: `web/index.html:32-44` (`<main>` 옆 패널 컬럼 추가)
- Modify: `web/app.js` (선택 상태 + 패널 렌더 + 클릭 핸들러)
- Modify: `web/style.css` (3컬럼 그리드 + 오버레이)

**Interfaces:**
- Consumes: `toViewItem` 결과의 `i.analysis`(Task 1), `i.id`, `i.title`, `i.summary`, `i.source`, `i.url`, `i.time`.

이 태스크는 vanilla DOM 글루라 단위 테스트가 없다(기존 `app.js`도 동일). 검증은 로컬 서버 + 브라우저 육안 확인으로 한다. 실제 `analysis` 데이터는 Task 5 백필 전이므로, 검증용으로 임시 항목을 콘솔에서 주입하거나 Task 5 완료 후 재확인한다. **권장 순서: Task 5(백필) 먼저 → 본 Task 4를 실데이터로 검증.** 단 코드 작성 자체는 데이터 없이 가능하므로, 백필을 못 돌리는 환경이면 아래 "임시 검증" 절차를 사용한다.

- [ ] **Step 1: index.html에 패널 컬럼 추가**

`web/index.html`에서 `</main>` 닫는 태그 **바로 다음**, `</div>`(`.app`) 앞에 추가:

```html
    <aside class="panel" id="panel" data-open="false">
      <button class="panel-close" id="panelClose" aria-label="닫기">×</button>
      <div class="panel-body" id="panelBody"></div>
    </aside>
```

- [ ] **Step 2: style.css — 3컬럼 + 오버레이**

`.app`은 **flexbox**(`display: flex`, style.css:17)이고 `.sidebar`(264px, flex:none)·`.main`(flex:1)이 형제다. 패널은 `.main` 뒤 세 번째 flex 자식으로 추가한다. 변수는 기존 것 사용: `--border` `--muted` `--accent` `--surface` `--text`. `web/style.css` 맨 아래에 추가:

```css
.panel { flex: 0 0 400px; min-width: 0; border-left: 1px solid var(--border); overflow-y: auto; background: var(--surface); }
.panel[data-open="false"] { display: none; }
.panel-close { position: sticky; top: 8px; float: right; margin: 8px; border: 0; background: transparent; font-size: 22px; line-height: 1; cursor: pointer; color: var(--muted); }
.panel-body { padding: 24px 28px; }
.panel-title { font-size: 18px; font-weight: 700; margin: 0 0 6px; color: var(--title); }
.panel-meta { font-size: 13px; color: var(--muted); margin-bottom: 18px; }
.panel-meta a { color: var(--accent); text-decoration: none; }
.panel-h { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 20px 0 8px; }
.panel-points { margin: 0; padding-left: 18px; }
.panel-points li { margin: 6px 0; line-height: 1.5; color: var(--text); }
.panel-sec { margin: 14px 0; }
.panel-sec-h { font-weight: 600; margin: 0 0 4px; color: var(--title); }
.panel-sec-b { margin: 0; line-height: 1.6; color: var(--text); }
.panel-quote { border-left: 3px solid var(--accent); padding: 4px 12px; margin: 8px 0; color: var(--muted); font-style: italic; }
.panel-empty { color: var(--muted); line-height: 1.6; }
.rcard { cursor: pointer; }
.rcard.selected { outline: 2px solid var(--accent); }
```

좁은 폭에서는 패널을 전체 오버레이로. 기존 `@media (max-width: 900px) { ... }` 블록 **안**에 다음 규칙을 추가한다(블록 자체는 style.css:92에 이미 존재):

```css
  .panel[data-open="true"] { position: fixed; inset: 0; z-index: 50; flex: none; }
```

> 참고: 기존 `@media (max-width:900px)`는 `.app { flex-direction: column }`으로 바꾼다(style.css:93). 그 컬럼 레이아웃에서도 위 `position: fixed` 오버레이 규칙이 패널을 화면 전체로 띄운다.

- [ ] **Step 3: app.js — 선택 상태 추가**

`state` 객체에 `selectedId: null` 추가:

```js
const state = { feed: 'video', cat: '전체', q: '', dark: localStorage.getItem('dark') === '1',
  bm: JSON.parse(localStorage.getItem('bm') || '{}'), selectedId: null,
  data: { video: [], snsblog: [], news: [], repo: [], model: [] } };
```

- [ ] **Step 4: app.js — 패널 렌더 함수 추가**

`renderMain` 함수 위에 추가:

```js
function analysisHtml(a) {
  const points = a.points.length
    ? `<div class="panel-h">핵심 포인트</div><ul class="panel-points">${a.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
    : '';
  const sections = a.sections.length
    ? `<div class="panel-h">상세 정리</div>${a.sections.map((s) =>
        `<div class="panel-sec"><p class="panel-sec-h">${esc(s.heading)}</p><p class="panel-sec-b">${esc(s.body)}</p></div>`).join('')}`
    : '';
  const quotes = a.quotes.length
    ? `<div class="panel-h">인용·수치</div>${a.quotes.map((q) => `<p class="panel-quote">${esc(q)}</p>`).join('')}`
    : '';
  return points + sections + quotes;
}

function renderPanel() {
  const panel = document.getElementById('panel');
  const body = document.getElementById('panelBody');
  const item = state.selectedId ? allItems().find((i) => i.id === state.selectedId) : null;
  if (!item) { panel.dataset.open = 'false'; body.innerHTML = ''; return; }
  panel.dataset.open = 'true';
  const meta = `<div class="panel-meta">${esc(item.source)}${item.time ? ` · ${esc(item.time)}` : ''}`
    + ` · <a href="${esc(item.url)}" target="_blank" rel="noopener">원문 보기 ↗</a></div>`;
  const content = item.analysis
    ? analysisHtml(item.analysis)
    : `<div class="panel-empty">상세 분석이 아직 없습니다.<br><br>${esc(item.summary)}</div>`;
  body.innerHTML = `<h2 class="panel-title">${esc(item.title)}</h2>${meta}${content}`;
}
```

- [ ] **Step 5: app.js — rcard에 선택 표시 + renderMain/renderAll 연동**

`rcard(i)`의 `<article ...>` 여는 태그에 선택 클래스와 data 속성 추가:

```js
  const sel = state.selectedId === i.id ? ' selected' : '';
  return `<article class="rcard${sel}" data-card="${esc(i.id)}" style="--bar:${BAR[i.type] || 'var(--accent)'}">
```

`renderAll`을 패널 포함하도록 수정:

```js
function renderAll() { renderFeeds(); renderCats(); renderMain(); renderPanel(); }
```

- [ ] **Step 6: app.js — 카드 클릭 핸들러(북마크와 분리)**

기존 `reader` 클릭 핸들러(현재 북마크만 처리)를 아래로 교체:

```js
document.getElementById('reader').addEventListener('click', (e) => {
  const bm = e.target.dataset.bm;
  if (bm) {  // ⭐ 북마크: 패널 열지 않음
    state.bm[bm] = !state.bm[bm]; localStorage.setItem('bm', JSON.stringify(state.bm));
    renderAll(); return;
  }
  const card = e.target.closest('[data-card]'); if (!card) return;
  const id = card.dataset.card;
  state.selectedId = state.selectedId === id ? null : id;  // 재클릭 시 닫기
  renderAll();
});
document.getElementById('panelClose').addEventListener('click', () => {
  state.selectedId = null; renderPanel();
  document.querySelectorAll('.rcard.selected').forEach((el) => el.classList.remove('selected'));
});
```

- [ ] **Step 7: app.js — 피드/필터 전환 시 사라진 선택 해제**

`renderMain` 첫 줄에서 현재 보이는 항목에 선택이 없으면 해제:

```js
function renderMain() {
  const feed = FEEDS.find((f) => f.key === state.feed);
  const items = visible(state.feed);
  if (state.selectedId && !items.some((i) => i.id === state.selectedId)) state.selectedId = null;
  // ...기존 본문 유지...
}
```

- [ ] **Step 8: 임시 검증 (백필 전) 또는 실데이터 검증 (백필 후)**

로컬 서버 실행:

```bash
python3 -m http.server 8080
```

브라우저에서 `http://localhost:8080/web/` 접속 후 확인(육안):
1. 영상 카드 클릭 → 우측 패널이 열리고 제목·출처·원문 링크 표시.
2. `analysis` 있는 항목: 핵심 포인트·상세 정리·인용 렌더(이스케이프 정상).
3. `analysis` 없는 항목: "상세 분석이 아직 없습니다" + 요약 표시.
4. ★ 북마크 클릭은 패널을 열지 않고 북마크만 토글.
5. 같은 카드 재클릭 또는 × 버튼 → 패널 닫힘.
6. 피드/카테고리 전환으로 선택 항목이 목록에서 사라지면 패널 자동 닫힘.
7. 브라우저 폭을 900px 이하로 줄였을 때 패널이 전체 오버레이로 뜨고 × 로 닫힘.

> 백필(Task 5) 전이라 `analysis` 데이터가 없으면 2번은 콘솔에서 임시 주입해 확인:
> `state.data.video[0].analysis = { points:['테스트'], sections:[{heading:'h',body:'b'}], quotes:[] }; state.selectedId = state.data.video[0].id;`
> 후 `renderAll()` 호출(전역 노출돼 있지 않으면 카드 클릭으로 트리거). 확인 후 새로고침.

- [ ] **Step 9: 커밋**

```bash
git add web/index.html web/app.js web/style.css
git commit -m "feat(web): 상세 분석 우측 패널"
```

---

## Task 5: RUNBOOK 규칙 + 영상 24건 백필

**Files:**
- Modify: `pipeline/RUNBOOK.md`
- Create (임시 데이터): `data/analysis-backfill.json`
- Update (데이터): `data/feed.json`

**Interfaces:**
- Consumes: `pipeline/apply-analysis.mjs`(Task 2)의 CLI.

- [ ] **Step 1: RUNBOOK에 analysis 생성 규칙 추가**

`pipeline/RUNBOOK.md`의 "각 아이템에 추가할 필드" 목록(현재 `summaryStatus` 항목 아래)에 추가:

```markdown
- `analysis`: 상세 분석(구조화 객체). 대상은 **영상·뉴스·블로그**만(SNS·repo·model 제외).
  - `points`: 핵심 포인트 3~6개(한국어, 각 한 문장).
  - `sections`: 챕터/주제별 정리 2~5개. 각 `{ "heading": "...", "body": "2~4문장" }`.
  - `quotes`: 주목할 인용·수치 0~3개(없으면 빈 배열 또는 생략).
  - 생성 불가/대상 아님이면 `analysis` 필드를 생략한다.
```

그리고 "소스 타입별 요약 입력" 절의 `youtube` 항목에 한 줄 추가:

```markdown
  3) `summaryKo`를 만든 같은 트랜스크립트로 `analysis`(points/sections/quotes)도 생성해 채운다(fallback이면 생략).
```

`news`/`paper` 항목에도 한 줄 추가:

```markdown
  - 본문이 충분하면 `analysis`도 생성(블로그 포함). 빈약하면 `analysis` 생략.
```

- [ ] **Step 2: RUNBOOK 변경 커밋**

```bash
git add pipeline/RUNBOOK.md
git commit -m "docs(runbook): summarize 단계 analysis 생성 규칙"
```

- [ ] **Step 3: 백필 데이터 생성 (에이전트 작업)**

`data/feed.json`에서 영상(`sourceType: "youtube"`) 24건의 `id`·`url`·`videoId`를 추출한다:

```bash
node -e "const f=require('./data/feed.json');console.log(JSON.stringify(f.filter(i=>i.sourceType==='youtube').map(i=>({id:i.id,url:i.url,videoId:i.videoId,title:i.title})),null,2))"
```

각 영상에 대해 `watch` 스킬로 자막을 받아 RUNBOOK 규칙대로 `analysis`(points/sections/quotes)를 생성하고, `data/analysis-backfill.json`을 `{ "<id>": { points, sections, quotes }, ... }` 형태로 작성한다. 자막 실패 영상은 맵에서 제외한다.

> 비용·시간 소모 작업(영상당 yt-dlp 다운로드 + 분석). 사용량 한도에 걸리면 여러 회차로 나눠 맵을 누적 작성해도 된다(`apply-analysis`는 부분 맵도 안전하게 처리).

- [ ] **Step 4: 백필 적용**

```bash
node pipeline/apply-analysis.mjs
```
Expected: `[apply-analysis] feed N / analysis 보유 M (맵 M건)` (M = 작성한 맵 건수).

- [ ] **Step 5: 전체 테스트 + 육안 확인**

```bash
npm test
```
Expected: 전부 PASS.

이어서 Task 4 Step 8의 로컬 서버 검증을 **실데이터로** 재확인(영상 카드 클릭 시 실제 `analysis` 렌더).

- [ ] **Step 6: 데이터 커밋**

```bash
git add data/feed.json
git rm --cached data/analysis-backfill.json 2>/dev/null || true   # 임시 파일은 커밋하지 않음
git commit -m "data: 영상 24건 analysis 백필"
```

> `data/analysis-backfill.json`은 임시 산출물이므로 커밋하지 않는다(필요 시 `.gitignore`에 추가).

---

## Self-Review (작성자 확인 완료)

**Spec coverage:**
- 데이터 모델 `analysis`(객체) → Task 1(정규화), Task 5(생성 규칙·백필). ✅
- 파이프라인 생성 규칙 → Task 5 Step 1. ✅
- merge 신규 통과/백필 우회 → Task 3(가드), Task 2(패치 스크립트). ✅
- 3컬럼 패널 + 모바일 오버레이 → Task 4. ✅
- 범위 video·news·blog, SNS 제외 → RUNBOOK 규칙(Task 5) + 대상은 데이터가 결정(UI는 analysis 유무로 표시). ✅
- 백필(영상 24) → Task 5. ✅
- 테스트(adapt/merge/apply) → Task 1·2·3. ✅
- 북마크 분리, 재클릭 닫기, 선택 해제 → Task 4 Step 6·7. ✅

**Placeholder scan:** 코드 단계는 모두 실제 코드 포함. CSS 변수명은 기존 파일 확인 후 조정하라는 명시적 지침 + 폴백값 제공(플레이스홀더 아님). ✅

**Type consistency:** `normalizeAnalysis` 반환 형태 `{points, sections:{heading,body}[], quotes}`가 Task 1·4(`analysisHtml`)·5(RUNBOOK)에서 일치. `applyAnalysis(feed, analysisMap)` 시그니처 Task 2·5 일치. ✅
