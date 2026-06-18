# AI 트렌드 개인 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 트렌드를 한국어 요약으로 빠르게 스캔하는 개인용 정적 대시보드를, 별도 LLM API 비용 없이(요약은 Claude Code 구독 세션이 수행) 구축한다.

**Architecture:** 파이프라인을 `fetch`(순수 Node 스크립트, LLM 없음)와 `summarize`(에이전트=구독 세션) 두 단계로 분리한다. fetch가 소스에서 raw 아이템을 긁어 `data/raw.json`에 쓰면, 에이전트가 한국어 요약을 채워 `data/summarized.json`을 만들고, `merge` 스크립트가 중복 제거·캡·상태관리를 거쳐 `data/feed.json`/`data/trending.json`을 만든다. 정적 HTML/JS 대시보드가 그 파일들만 읽어 렌더링한다.

**Tech Stack:** Node.js 22 (ESM, 의존성 0, `node --test` 내장 러너), vanilla HTML/JS/CSS, 로컬 JSON 파일, `watch` 스킬(YouTube 자막), `geeknews-search` 스킬(GeekNews).

## Global Constraints

- **런타임 의존성 0**: npm 패키지를 설치하지 않는다. Node 22 내장 기능(`fetch`, `node:crypto`, `node:fs`, `node:test`)만 사용한다.
- **ESM**: 모든 스크립트는 `.mjs` 확장자, `import`/`export` 사용.
- **LLM 호출 금지(fetch/merge 단계)**: fetch와 merge 스크립트는 결정적이어야 하며 어떤 LLM API도 호출하지 않는다. 요약은 오직 summarize 단계(에이전트)에서만.
- **네트워크 주입**: 모든 소스 어댑터는 `deps = { fetchText, fetchJson }`를 인자로 받아 테스트에서 fixture를 주입할 수 있어야 한다. 어댑터 내부에서 전역 `fetch`를 직접 호출하지 않는다.
- **데이터 디렉터리**: 런타임 산출물은 모두 `data/`에 둔다. `data/*.json`은 git에서 무시한다(샘플 제외).
- **아이템 식별자**: `id`는 항상 `makeId(url)`로 생성한 16자 hex.
- **소스 타입 enum**: `sourceType`은 `youtube | news | paper | repo | model` 중 하나.
- **UI 디자인 출처(확정)**: 뷰어는 `docs/design/HANDOFF.md` + `docs/design/dashboard-v2.dc.html`(확정본)의 hifi 디자인을 픽셀 단위로 따른다. 색/타이포/간격/인터랙션 토큰은 그 문서가 기준이며, 임의로 바꾸지 않는다.
- **view 타입 매핑**: 파이프라인 `sourceType`을 뷰어 표시 타입(`news | blog | video | sns | paper`)으로 매핑한다(`web/adapt.mjs`). 4개 컬럼(뉴스/영상/소셜·블로그/논문)은 `data/feed.json`에서, 트렌딩 strip(Top 5)은 `data/trending.json`(repo/model, score 내림차순)에서 온다.
- **카테고리(cats)**: summarize 단계가 각 아이템에 `cats`(다음 중 0개 이상: `LLM`, `에이전트`, `멀티모달`, `하드웨어`, `정책/규제`, `오픈소스`)를 부여한다. 카테고리 탭의 `전체`는 필터 미적용을 의미한다.

---

## File Structure

```
ai-trend/
  package.json                  # type:module, test 스크립트
  .gitignore                    # data/*.json (sample 제외)
  sources.json                  # 소스 정의(추가/삭제 자유)
  lib/
    id.mjs                      # makeId(url)
    jsonfile.mjs                # readJson/writeJson
    rss.mjs                     # parseFeed(xml) — RSS/Atom 공용 파서
  pipeline/
    net.mjs                     # fetchText/fetchJson (실 네트워크 구현)
    sources/
      rss.mjs                   # 뉴스/블로그/GeekNews 어댑터
      arxiv.mjs                 # arXiv 어댑터
      trending.mjs              # GitHub + HuggingFace 어댑터
      youtube.mjs               # YouTube 채널/시드 영상 어댑터
    fetch.mjs                   # 모든 어댑터 실행 → data/raw.json
    merge.mjs                   # dedupe/cap/state → feed.json/trending.json
    RUNBOOK.md                  # summarize 단계(에이전트) 절차 + 프롬프트 + 계약
  web/
    index.html
    app.js                      # 렌더링/필터/북마크/다크모드 (디자인 포팅)
    adapt.mjs                   # 파이프라인 아이템 → 뷰어 Item 매핑 (테스트 대상)
    style.css                   # docs/design 토큰 기반 스타일
  docs/design/                  # 확정 디자인 핸드오프 (레퍼런스)
    HANDOFF.md
    dashboard-v2.dc.html
  data/
    feed.sample.json            # 뷰어 개발용 샘플 (git 포함)
  test/
    id.test.mjs
    rss.test.mjs
    sources-rss.test.mjs
    sources-arxiv.test.mjs
    sources-trending.test.mjs
    sources-youtube.test.mjs
    fetch.test.mjs
    merge.test.mjs
    adapt.test.mjs
    fixtures/
      rss-sample.xml
      atom-arxiv.xml
      youtube-feed.xml
```

---

### Task 1: 프로젝트 스캐폴드 + 핵심 유틸 (id, jsonfile)

**Files:**
- Create: `package.json`, `.gitignore`, `sources.json`
- Create: `lib/id.mjs`, `lib/jsonfile.mjs`
- Test: `test/id.test.mjs`

**Interfaces:**
- Consumes: (없음)
- Produces:
  - `makeId(url: string): string` — 16자 소문자 hex
  - `readJson(path: string, fallback?: any): Promise<any>` — 파일 없으면 fallback 반환
  - `writeJson(path: string, data: any): Promise<void>` — 디렉터리 자동 생성, 2-space pretty

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "ai-trend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "fetch": "node pipeline/fetch.mjs",
    "merge": "node pipeline/merge.mjs"
  }
}
```

- [ ] **Step 2: .gitignore 작성**

```gitignore
node_modules/
data/*.json
!data/feed.sample.json
```

- [ ] **Step 3: sources.json 작성 (초기 소스 정의)**

```json
{
  "perRunCap": 10,
  "news": [
    { "source": "The Verge AI", "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
    { "source": "Ars Technica AI", "url": "https://arstechnica.com/ai/feed/" },
    { "source": "Hacker News", "url": "https://hnrss.org/newest?q=AI+OR+LLM&count=20" },
    { "source": "AWS ML Blog", "url": "https://aws.amazon.com/blogs/machine-learning/feed/" },
    { "source": "GeekNews", "url": "https://news.hada.io/rss/news" }
  ],
  "arxiv": {
    "categories": ["cs.AI", "cs.LG", "cs.CL"],
    "maxResults": 10
  },
  "github": {
    "queries": ["topic:llm", "topic:generative-ai"],
    "perQuery": 5
  },
  "huggingface": {
    "limit": 10
  },
  "youtube": {
    "channels": [],
    "seedVideos": [
      "https://youtu.be/mMgCEJEAm54",
      "https://youtu.be/5q5ZUpwgj4E"
    ]
  }
}
```

> 참고: `youtube.channels`는 채널 RSS URL(`https://www.youtube.com/feeds/videos.xml?channel_id=...`) 문자열을 채워 넣는 설정 데이터다. 비워두면 시드 영상만 처리한다.

- [ ] **Step 4: 실패하는 테스트 작성 — `test/id.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeId } from '../lib/id.mjs';

test('makeId는 16자 hex를 반환한다', () => {
  const id = makeId('https://example.com/a');
  assert.match(id, /^[0-9a-f]{16}$/);
});

test('makeId는 같은 url에 같은 id를 반환한다(결정적)', () => {
  assert.equal(makeId('https://x.com/1'), makeId('https://x.com/1'));
});

test('makeId는 다른 url에 다른 id를 반환한다', () => {
  assert.notEqual(makeId('https://x.com/1'), makeId('https://x.com/2'));
});
```

- [ ] **Step 5: 테스트 실행 → 실패 확인**

Run: `node --test test/id.test.mjs`
Expected: FAIL — `Cannot find module '../lib/id.mjs'`

- [ ] **Step 6: `lib/id.mjs` 구현**

```js
import { createHash } from 'node:crypto';

export function makeId(url) {
  return createHash('sha256').update(String(url)).digest('hex').slice(0, 16);
}
```

- [ ] **Step 7: `lib/jsonfile.mjs` 구현**

```js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
```

- [ ] **Step 8: 테스트 재실행 → 통과 확인**

Run: `node --test test/id.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 9: 커밋**

```bash
git add package.json .gitignore sources.json lib/id.mjs lib/jsonfile.mjs test/id.test.mjs
git commit -m "feat: 프로젝트 스캐폴드 + id/jsonfile 유틸"
```

---

### Task 2: RSS/Atom 공용 파서

**Files:**
- Create: `lib/rss.mjs`
- Test: `test/rss.test.mjs`, `test/fixtures/rss-sample.xml`

**Interfaces:**
- Consumes: (없음)
- Produces:
  - `parseFeed(xml: string): Array<{ title: string, link: string, published: string, summary: string }>` — RSS `<item>`과 Atom `<entry>` 모두 처리. 텍스트는 CDATA/HTML 태그 제거.

- [ ] **Step 1: fixture 작성 — `test/fixtures/rss-sample.xml`**

```xml
<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Sample</title>
  <item>
    <title><![CDATA[First Post]]></title>
    <link>https://example.com/first</link>
    <pubDate>Wed, 17 Jun 2026 10:00:00 GMT</pubDate>
    <description><![CDATA[<p>Hello <b>world</b></p>]]></description>
  </item>
  <item>
    <title>Second Post</title>
    <link>https://example.com/second</link>
    <pubDate>Tue, 16 Jun 2026 09:00:00 GMT</pubDate>
    <description>Plain text summary</description>
  </item>
</channel></rss>
```

- [ ] **Step 2: 실패하는 테스트 작성 — `test/rss.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFeed } from '../lib/rss.mjs';

test('RSS item을 파싱한다', async () => {
  const xml = await readFile(new URL('./fixtures/rss-sample.xml', import.meta.url), 'utf8');
  const items = parseFeed(xml);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'First Post');
  assert.equal(items[0].link, 'https://example.com/first');
  assert.equal(items[0].summary, 'Hello world'); // HTML 태그 제거됨
  assert.equal(items[1].title, 'Second Post');
});

test('Atom entry를 파싱한다(link href + summary)', () => {
  const xml = `<feed><entry>
    <title>Atom Title</title>
    <link href="https://a.com/x" rel="alternate"/>
    <published>2026-06-17T00:00:00Z</published>
    <summary>Atom summary</summary>
  </entry></feed>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Atom Title');
  assert.equal(items[0].link, 'https://a.com/x');
  assert.equal(items[0].published, '2026-06-17T00:00:00Z');
  assert.equal(items[0].summary, 'Atom summary');
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `node --test test/rss.test.mjs`
Expected: FAIL — `Cannot find module '../lib/rss.mjs'`

- [ ] **Step 4: `lib/rss.mjs` 구현**

```js
function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')          // HTML 태그 제거
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
}

function pickLink(block) {
  const text = pick(block, 'link');
  if (text.trim()) return decode(text);
  const href = block.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i);
  return href ? href[1] : '';
}

export function parseFeed(xml) {
  const blocks =
    xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ||
    xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ||
    [];
  return blocks.map((b) => ({
    title: decode(pick(b, 'title')),
    link: pickLink(b),
    published: decode(pick(b, 'pubDate') || pick(b, 'published') || pick(b, 'updated')),
    summary: decode(pick(b, 'description') || pick(b, 'summary') || pick(b, 'content')),
  }));
}
```

- [ ] **Step 5: 테스트 재실행 → 통과 확인**

Run: `node --test test/rss.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 6: 커밋**

```bash
git add lib/rss.mjs test/rss.test.mjs test/fixtures/rss-sample.xml
git commit -m "feat: RSS/Atom 공용 파서"
```

---

### Task 3: 뉴스/블로그/GeekNews RSS 어댑터

**Files:**
- Create: `pipeline/sources/rss.mjs`
- Test: `test/sources-rss.test.mjs`

**Interfaces:**
- Consumes: `parseFeed` (Task 2), `makeId` (Task 1)
- Produces:
  - `fetchRssSources(feeds: Array<{source,url}>, deps: { fetchText }, perRunCap: number): Promise<RawItem[]>`
  - `RawItem = { id, sourceType, source, title, url, publishedAt, rawText }`
  - 소스별 격리: 한 피드 실패 시 그 피드만 건너뛰고 나머지는 계속.

- [ ] **Step 1: 실패하는 테스트 작성 — `test/sources-rss.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchRssSources } from '../pipeline/sources/rss.mjs';

const sampleXml = await readFile(new URL('./fixtures/rss-sample.xml', import.meta.url), 'utf8');

test('피드를 RawItem으로 변환한다', async () => {
  const deps = { fetchText: async () => sampleXml };
  const items = await fetchRssSources([{ source: 'Test', url: 'https://t/feed' }], deps, 10);
  assert.equal(items.length, 2);
  assert.equal(items[0].sourceType, 'news');
  assert.equal(items[0].source, 'Test');
  assert.equal(items[0].url, 'https://example.com/first');
  assert.equal(items[0].rawText, 'Hello world');
  assert.match(items[0].id, /^[0-9a-f]{16}$/);
});

test('perRunCap만큼만 피드당 가져온다', async () => {
  const deps = { fetchText: async () => sampleXml };
  const items = await fetchRssSources([{ source: 'Test', url: 'https://t/feed' }], deps, 1);
  assert.equal(items.length, 1);
});

test('한 피드가 실패해도 나머지는 계속된다', async () => {
  const deps = {
    fetchText: async (url) => {
      if (url.includes('bad')) throw new Error('network');
      return sampleXml;
    },
  };
  const items = await fetchRssSources(
    [{ source: 'Bad', url: 'https://bad/feed' }, { source: 'Good', url: 'https://good/feed' }],
    deps, 10,
  );
  assert.equal(items.length, 2);
  assert.equal(items[0].source, 'Good');
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test test/sources-rss.test.mjs`
Expected: FAIL — `Cannot find module '../pipeline/sources/rss.mjs'`

- [ ] **Step 3: `pipeline/sources/rss.mjs` 구현**

```js
import { parseFeed } from '../../lib/rss.mjs';
import { makeId } from '../../lib/id.mjs';

export async function fetchRssSources(feeds, deps, perRunCap) {
  const out = [];
  for (const feed of feeds) {
    try {
      const xml = await deps.fetchText(feed.url);
      const entries = parseFeed(xml).slice(0, perRunCap);
      for (const e of entries) {
        if (!e.link) continue;
        out.push({
          id: makeId(e.link),
          sourceType: 'news',
          source: feed.source,
          title: e.title,
          url: e.link,
          publishedAt: e.published,
          rawText: e.summary,
        });
      }
    } catch (err) {
      console.error(`[rss] ${feed.source} 실패: ${err.message}`);
    }
  }
  return out;
}
```

- [ ] **Step 4: 테스트 재실행 → 통과 확인**

Run: `node --test test/sources-rss.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add pipeline/sources/rss.mjs test/sources-rss.test.mjs
git commit -m "feat: 뉴스/블로그 RSS 어댑터"
```

---

### Task 4: arXiv 어댑터

**Files:**
- Create: `pipeline/sources/arxiv.mjs`
- Test: `test/sources-arxiv.test.mjs`, `test/fixtures/atom-arxiv.xml`

**Interfaces:**
- Consumes: `parseFeed` (Task 2), `makeId` (Task 1)
- Produces:
  - `fetchArxiv(config: { categories: string[], maxResults: number }, deps: { fetchText }): Promise<RawItem[]>`
  - `RawItem.sourceType === 'paper'`, `rawText`에 초록(abstract) 담김.

- [ ] **Step 1: fixture 작성 — `test/fixtures/atom-arxiv.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>A Great Paper on LLMs</title>
    <link href="http://arxiv.org/abs/2606.00001v1" rel="alternate"/>
    <published>2026-06-17T00:00:00Z</published>
    <summary>This paper studies large language models and proposes a new method.</summary>
  </entry>
</feed>
```

- [ ] **Step 2: 실패하는 테스트 작성 — `test/sources-arxiv.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchArxiv } from '../pipeline/sources/arxiv.mjs';

const atom = await readFile(new URL('./fixtures/atom-arxiv.xml', import.meta.url), 'utf8');

test('arXiv Atom을 paper RawItem으로 변환한다', async () => {
  let calledUrl = '';
  const deps = { fetchText: async (url) => { calledUrl = url; return atom; } };
  const items = await fetchArxiv({ categories: ['cs.AI', 'cs.LG'], maxResults: 5 }, deps);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceType, 'paper');
  assert.equal(items[0].source, 'arXiv');
  assert.equal(items[0].title, 'A Great Paper on LLMs');
  assert.equal(items[0].url, 'http://arxiv.org/abs/2606.00001v1');
  assert.match(items[0].rawText, /large language models/);
  // 쿼리에 카테고리/정렬/개수가 포함되는지
  assert.match(calledUrl, /cat:cs\.AI/);
  assert.match(calledUrl, /max_results=5/);
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `node --test test/sources-arxiv.test.mjs`
Expected: FAIL — `Cannot find module '../pipeline/sources/arxiv.mjs'`

- [ ] **Step 4: `pipeline/sources/arxiv.mjs` 구현**

```js
import { parseFeed } from '../../lib/rss.mjs';
import { makeId } from '../../lib/id.mjs';

export async function fetchArxiv(config, deps) {
  const cats = config.categories.map((c) => `cat:${c}`).join('+OR+');
  const url =
    `http://export.arxiv.org/api/query?search_query=${cats}` +
    `&sortBy=submittedDate&sortOrder=descending&max_results=${config.maxResults}`;
  try {
    const xml = await deps.fetchText(url);
    return parseFeed(xml)
      .filter((e) => e.link)
      .map((e) => ({
        id: makeId(e.link),
        sourceType: 'paper',
        source: 'arXiv',
        title: e.title,
        url: e.link,
        publishedAt: e.published,
        rawText: e.summary,
      }));
  } catch (err) {
    console.error(`[arxiv] 실패: ${err.message}`);
    return [];
  }
}
```

- [ ] **Step 5: 테스트 재실행 → 통과 확인**

Run: `node --test test/sources-arxiv.test.mjs`
Expected: PASS (1 test)

- [ ] **Step 6: 커밋**

```bash
git add pipeline/sources/arxiv.mjs test/sources-arxiv.test.mjs test/fixtures/atom-arxiv.xml
git commit -m "feat: arXiv 어댑터"
```

---

### Task 5: GitHub + HuggingFace 트렌딩 어댑터

**Files:**
- Create: `pipeline/sources/trending.mjs`
- Test: `test/sources-trending.test.mjs`

**Interfaces:**
- Consumes: `makeId` (Task 1)
- Produces:
  - `fetchGithub(config: { queries: string[], perQuery: number }, deps: { fetchJson }): Promise<RawItem[]>` — `sourceType: 'repo'`, `score`=stars, `rawText`=repo description
  - `fetchHuggingface(config: { limit: number }, deps: { fetchJson }): Promise<RawItem[]>` — `sourceType: 'model'`, `score`=likes
  - 두 함수 모두 트렌딩 아이템(`score` 포함) 반환. 실패 시 빈 배열.

- [ ] **Step 1: 실패하는 테스트 작성 — `test/sources-trending.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchGithub, fetchHuggingface } from '../pipeline/sources/trending.mjs';

test('GitHub search 결과를 repo RawItem으로 변환한다', async () => {
  const fakeResp = {
    items: [
      { full_name: 'org/cool-llm', html_url: 'https://github.com/org/cool-llm',
        description: 'A cool LLM', stargazers_count: 1234, language: 'Python' },
    ],
  };
  const deps = { fetchJson: async () => fakeResp };
  const items = await fetchGithub({ queries: ['topic:llm'], perQuery: 5 }, deps);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceType, 'repo');
  assert.equal(items[0].source, 'GitHub');
  assert.equal(items[0].title, 'org/cool-llm');
  assert.equal(items[0].url, 'https://github.com/org/cool-llm');
  assert.equal(items[0].score, 1234);
  assert.equal(items[0].rawText, 'A cool LLM');
});

test('GitHub은 쿼리 간 중복 repo를 제거한다', async () => {
  const fakeResp = {
    items: [{ full_name: 'a/b', html_url: 'https://github.com/a/b', description: '', stargazers_count: 1 }],
  };
  const deps = { fetchJson: async () => fakeResp };
  const items = await fetchGithub({ queries: ['topic:llm', 'topic:ai'], perQuery: 5 }, deps);
  assert.equal(items.length, 1); // 두 쿼리가 같은 repo를 반환해도 1개
});

test('HuggingFace 모델을 model RawItem으로 변환한다', async () => {
  const fakeResp = [
    { id: 'meta/llama', likes: 999, pipeline_tag: 'text-generation' },
  ];
  const deps = { fetchJson: async () => fakeResp };
  const items = await fetchHuggingface({ limit: 10 }, deps);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceType, 'model');
  assert.equal(items[0].source, 'HuggingFace');
  assert.equal(items[0].title, 'meta/llama');
  assert.equal(items[0].url, 'https://huggingface.co/meta/llama');
  assert.equal(items[0].score, 999);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test test/sources-trending.test.mjs`
Expected: FAIL — `Cannot find module '../pipeline/sources/trending.mjs'`

- [ ] **Step 3: `pipeline/sources/trending.mjs` 구현**

```js
import { makeId } from '../../lib/id.mjs';

export async function fetchGithub(config, deps) {
  const seen = new Set();
  const out = [];
  for (const q of config.queries) {
    const url =
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}` +
      `&sort=stars&order=desc&per_page=${config.perQuery}`;
    try {
      const json = await deps.fetchJson(url);
      for (const r of json.items || []) {
        if (seen.has(r.html_url)) continue;
        seen.add(r.html_url);
        out.push({
          id: makeId(r.html_url),
          sourceType: 'repo',
          source: 'GitHub',
          title: r.full_name,
          url: r.html_url,
          publishedAt: r.created_at || '',
          rawText: r.description || '',
          score: r.stargazers_count || 0,
          lang: r.language || '',
        });
      }
    } catch (err) {
      console.error(`[github] "${q}" 실패: ${err.message}`);
    }
  }
  return out;
}

export async function fetchHuggingface(config, deps) {
  const url = `https://huggingface.co/api/models?sort=likes&direction=-1&limit=${config.limit}`;
  try {
    const json = await deps.fetchJson(url);
    return (json || []).map((m) => ({
      id: makeId(`https://huggingface.co/${m.id}`),
      sourceType: 'model',
      source: 'HuggingFace',
      title: m.id,
      url: `https://huggingface.co/${m.id}`,
      publishedAt: m.createdAt || '',
      rawText: m.pipeline_tag || '',
      score: m.likes || 0,
    }));
  } catch (err) {
    console.error(`[huggingface] 실패: ${err.message}`);
    return [];
  }
}
```

- [ ] **Step 4: 테스트 재실행 → 통과 확인**

Run: `node --test test/sources-trending.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add pipeline/sources/trending.mjs test/sources-trending.test.mjs
git commit -m "feat: GitHub/HuggingFace 트렌딩 어댑터"
```

---

### Task 6: YouTube 어댑터 (채널 RSS + 시드 영상 oEmbed)

**Files:**
- Create: `pipeline/sources/youtube.mjs`
- Test: `test/sources-youtube.test.mjs`, `test/fixtures/youtube-feed.xml`

**Interfaces:**
- Consumes: `parseFeed` (Task 2), `makeId` (Task 1)
- Produces:
  - `fetchYoutube(config: { channels: string[], seedVideos: string[] }, deps: { fetchText, fetchJson }, perRunCap: number): Promise<RawItem[]>`
  - `RawItem.sourceType === 'youtube'`, `videoId` 포함(summarize 단계의 watch 스킬이 사용). `rawText`는 채널 피드 요약 또는 oEmbed 제목.

- [ ] **Step 1: fixture 작성 — `test/fixtures/youtube-feed.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <yt:videoId>abc123XYZ</yt:videoId>
    <title>How AI Agents Work</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc123XYZ"/>
    <published>2026-06-17T12:00:00Z</published>
  </entry>
</feed>
```

- [ ] **Step 2: 실패하는 테스트 작성 — `test/sources-youtube.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchYoutube } from '../pipeline/sources/youtube.mjs';

const feedXml = await readFile(new URL('./fixtures/youtube-feed.xml', import.meta.url), 'utf8');

test('채널 피드를 youtube RawItem으로 변환한다(videoId 포함)', async () => {
  const deps = {
    fetchText: async () => feedXml,
    fetchJson: async () => { throw new Error('not used'); },
  };
  const items = await fetchYoutube(
    { channels: ['https://www.youtube.com/feeds/videos.xml?channel_id=UC1'], seedVideos: [] },
    deps, 10,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceType, 'youtube');
  assert.equal(items[0].videoId, 'abc123XYZ');
  assert.equal(items[0].url, 'https://www.youtube.com/watch?v=abc123XYZ');
  assert.equal(items[0].title, 'How AI Agents Work');
});

test('시드 영상은 oEmbed로 메타데이터를 채운다', async () => {
  const deps = {
    fetchText: async () => { throw new Error('not used'); },
    fetchJson: async () => ({ title: 'Seed Video', thumbnail_url: 'https://img/t.jpg', author_name: 'Some Channel' }),
  };
  const items = await fetchYoutube(
    { channels: [], seedVideos: ['https://youtu.be/mMgCEJEAm54'] },
    deps, 10,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceType, 'youtube');
  assert.equal(items[0].videoId, 'mMgCEJEAm54');
  assert.equal(items[0].title, 'Seed Video');
  assert.equal(items[0].thumbnail, 'https://img/t.jpg');
  assert.equal(items[0].source, 'Some Channel');
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `node --test test/sources-youtube.test.mjs`
Expected: FAIL — `Cannot find module '../pipeline/sources/youtube.mjs'`

- [ ] **Step 4: `pipeline/sources/youtube.mjs` 구현**

```js
import { parseFeed } from '../../lib/rss.mjs';
import { makeId } from '../../lib/id.mjs';

// https://youtu.be/ID, https://www.youtube.com/watch?v=ID 모두에서 videoId 추출
export function extractVideoId(url) {
  const short = url.match(/youtu\.be\/([\w-]+)/);
  if (short) return short[1];
  const watch = url.match(/[?&]v=([\w-]+)/);
  if (watch) return watch[1];
  return '';
}

async function fetchChannel(channelUrl, deps, perRunCap) {
  const out = [];
  const xml = await deps.fetchText(channelUrl);
  const videoIds = [...xml.matchAll(/<yt:videoId>([\w-]+)<\/yt:videoId>/g)].map((m) => m[1]);
  const entries = parseFeed(xml).slice(0, perRunCap);
  entries.forEach((e, i) => {
    if (!e.link) return;
    out.push({
      id: makeId(e.link),
      sourceType: 'youtube',
      source: 'YouTube',
      title: e.title,
      url: e.link,
      publishedAt: e.published,
      rawText: e.summary,
      videoId: videoIds[i] || extractVideoId(e.link),
    });
  });
  return out;
}

async function fetchSeed(videoUrl, deps) {
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
  const meta = await deps.fetchJson(oembed);
  return {
    id: makeId(videoUrl),
    sourceType: 'youtube',
    source: meta.author_name || 'YouTube',
    title: meta.title || videoUrl,
    url: videoUrl,
    publishedAt: '',
    rawText: meta.title || '',
    thumbnail: meta.thumbnail_url || '',
    videoId: extractVideoId(videoUrl),
  };
}

export async function fetchYoutube(config, deps, perRunCap) {
  const out = [];
  for (const ch of config.channels || []) {
    try {
      out.push(...(await fetchChannel(ch, deps, perRunCap)));
    } catch (err) {
      console.error(`[youtube] 채널 ${ch} 실패: ${err.message}`);
    }
  }
  for (const v of config.seedVideos || []) {
    try {
      out.push(await fetchSeed(v, deps));
    } catch (err) {
      console.error(`[youtube] 시드 ${v} 실패: ${err.message}`);
    }
  }
  return out;
}
```

- [ ] **Step 5: 테스트 재실행 → 통과 확인**

Run: `node --test test/sources-youtube.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 6: 커밋**

```bash
git add pipeline/sources/youtube.mjs test/sources-youtube.test.mjs test/fixtures/youtube-feed.xml
git commit -m "feat: YouTube 채널/시드 어댑터"
```

---

### Task 7: fetch 오케스트레이터 (`net.mjs` + `fetch.mjs`)

**Files:**
- Create: `pipeline/net.mjs`, `pipeline/fetch.mjs`
- Test: `test/fetch.test.mjs`

**Interfaces:**
- Consumes: 모든 어댑터(Task 3–6), `readJson`/`writeJson` (Task 1)
- Produces:
  - `pipeline/net.mjs`: `fetchText(url): Promise<string>`, `fetchJson(url): Promise<any>` — 실 네트워크(User-Agent 헤더 포함). 테스트에서는 사용 안 함.
  - `pipeline/fetch.mjs`: `collectRaw(sources, deps): Promise<RawItem[]>` (export) + `data/raw.json`에 쓰는 CLI 진입점.
  - `collectRaw`는 모든 소스 타입을 합쳐 하나의 배열로 반환.

- [ ] **Step 1: `pipeline/net.mjs` 구현 (네트워크 구현, 테스트에서 미사용)**

```js
const UA = 'ai-trend/0.1 (personal dashboard)';

export async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

export async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}
```

- [ ] **Step 2: 실패하는 테스트 작성 — `test/fetch.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectRaw } from '../pipeline/fetch.mjs';

const rss = await readFile(new URL('./fixtures/rss-sample.xml', import.meta.url), 'utf8');

test('collectRaw는 모든 소스 타입을 하나의 배열로 합친다', async () => {
  const sources = {
    perRunCap: 10,
    news: [{ source: 'N', url: 'https://n/feed' }],
    arxiv: { categories: ['cs.AI'], maxResults: 5 },
    github: { queries: ['topic:llm'], perQuery: 5 },
    huggingface: { limit: 5 },
    youtube: { channels: [], seedVideos: [] },
  };
  const deps = {
    fetchText: async () => rss,                  // news/arxiv가 사용
    fetchJson: async (url) => {
      if (url.includes('github')) return { items: [{ full_name: 'a/b', html_url: 'https://github.com/a/b', description: '', stargazers_count: 5 }] };
      if (url.includes('huggingface')) return [{ id: 'x/y', likes: 3 }];
      return {};
    },
  };
  const items = await collectRaw(sources, deps);
  const types = new Set(items.map((i) => i.sourceType));
  assert.ok(types.has('news'));
  assert.ok(types.has('repo'));
  assert.ok(types.has('model'));
  assert.ok(items.length >= 3);
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `node --test test/fetch.test.mjs`
Expected: FAIL — `Cannot find module '../pipeline/fetch.mjs'`

- [ ] **Step 4: `pipeline/fetch.mjs` 구현**

```js
import { fileURLToPath } from 'node:url';
import { fetchRssSources } from './sources/rss.mjs';
import { fetchArxiv } from './sources/arxiv.mjs';
import { fetchGithub, fetchHuggingface } from './sources/trending.mjs';
import { fetchYoutube } from './sources/youtube.mjs';
import { readJson, writeJson } from '../lib/jsonfile.mjs';
import * as net from './net.mjs';

export async function collectRaw(sources, deps) {
  const cap = sources.perRunCap || 10;
  const groups = await Promise.all([
    fetchRssSources(sources.news || [], deps, cap),
    fetchArxiv(sources.arxiv || { categories: [], maxResults: 0 }, deps),
    fetchGithub(sources.github || { queries: [], perQuery: 0 }, deps),
    fetchHuggingface(sources.huggingface || { limit: 0 }, deps),
    fetchYoutube(sources.youtube || { channels: [], seedVideos: [] }, deps, cap),
  ]);
  return groups.flat();
}

// CLI 진입점: `npm run fetch`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sources = await readJson('sources.json');
  const items = await collectRaw(sources, net);
  await writeJson('data/raw.json', items);
  console.log(`[fetch] ${items.length}개 raw 아이템 → data/raw.json`);
}
```

- [ ] **Step 5: 테스트 재실행 → 통과 확인**

Run: `node --test test/fetch.test.mjs`
Expected: PASS (1 test)

- [ ] **Step 6: 커밋**

```bash
git add pipeline/net.mjs pipeline/fetch.mjs test/fetch.test.mjs
git commit -m "feat: fetch 오케스트레이터 + 네트워크 구현"
```

---

### Task 8: merge (dedupe / cap / state → feed.json·trending.json)

**Files:**
- Create: `pipeline/merge.mjs`
- Test: `test/merge.test.mjs`

**Interfaces:**
- Consumes: `readJson`/`writeJson` (Task 1)
- Produces:
  - `mergeFeed({ summarized, existingFeed, existingTrending, state, now }): { feed, trending, state }`
  - 규칙:
    - `summaryStatus`가 `skipped`가 아닌 아이템만 반영.
    - `state.seen`에 이미 있는 `id`는 제외(재요약 방지).
    - `sourceType`이 `repo`/`model`이면 trending으로, 그 외는 feed로 분류.
    - feed/trending은 `publishedAt` 내림차순, feed는 최대 200개 유지.
    - 각 반영 아이템에 `fetchedAt = now` 부여, `state.seen`에 id 추가, `state.lastRunAt = now`.
  - CLI 진입점: `data/summarized.json` + 기존 데이터 → `data/feed.json`/`data/trending.json`/`data/state.json` 갱신.

- [ ] **Step 1: 실패하는 테스트 작성 — `test/merge.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFeed } from '../pipeline/merge.mjs';

const base = (over = {}) => ({
  id: 'id1', sourceType: 'news', source: 'N', title: 'T',
  url: 'https://x/1', publishedAt: '2026-06-17', summaryKo: '요약',
  tags: [], entities: [], summaryStatus: 'ok', ...over,
});

test('새 news 아이템을 feed에 넣고 fetchedAt/seen/lastRunAt을 기록한다', () => {
  const r = mergeFeed({
    summarized: [base()], existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: '2026-06-18T08:00:00Z',
  });
  assert.equal(r.feed.length, 1);
  assert.equal(r.feed[0].fetchedAt, '2026-06-18T08:00:00Z');
  assert.deepEqual(r.state.seen, ['id1']);
  assert.equal(r.state.lastRunAt, '2026-06-18T08:00:00Z');
});

test('이미 seen된 id는 제외한다', () => {
  const r = mergeFeed({
    summarized: [base()], existingFeed: [], existingTrending: [],
    state: { seen: ['id1'], lastRunAt: null }, now: '2026-06-18T08:00:00Z',
  });
  assert.equal(r.feed.length, 0);
});

test('skipped 아이템은 반영하지 않는다', () => {
  const r = mergeFeed({
    summarized: [base({ summaryStatus: 'skipped' })], existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: 'now',
  });
  assert.equal(r.feed.length, 0);
  assert.deepEqual(r.state.seen, []);
});

test('repo/model은 trending으로 분류한다', () => {
  const r = mergeFeed({
    summarized: [base({ id: 'r1', sourceType: 'repo', url: 'https://g/r', score: 9 })],
    existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: 'now',
  });
  assert.equal(r.feed.length, 0);
  assert.equal(r.trending.length, 1);
  assert.equal(r.trending[0].sourceType, 'repo');
});

test('feed는 publishedAt 내림차순으로 정렬된다', () => {
  const r = mergeFeed({
    summarized: [
      base({ id: 'a', url: 'https://x/a', publishedAt: '2026-06-10' }),
      base({ id: 'b', url: 'https://x/b', publishedAt: '2026-06-17' }),
    ],
    existingFeed: [], existingTrending: [],
    state: { seen: [], lastRunAt: null }, now: 'now',
  });
  assert.equal(r.feed[0].id, 'b');
  assert.equal(r.feed[1].id, 'a');
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test test/merge.test.mjs`
Expected: FAIL — `Cannot find module '../pipeline/merge.mjs'`

- [ ] **Step 3: `pipeline/merge.mjs` 구현**

```js
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../lib/jsonfile.mjs';

const FEED_MAX = 200;
const byPublishedDesc = (a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt));

export function mergeFeed({ summarized, existingFeed, existingTrending, state, now }) {
  const seen = new Set(state.seen || []);
  const feed = [...existingFeed];
  const trending = [...existingTrending];

  for (const item of summarized) {
    if (item.summaryStatus === 'skipped') continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const withMeta = { ...item, fetchedAt: now };
    if (item.sourceType === 'repo' || item.sourceType === 'model') {
      trending.push(withMeta);
    } else {
      feed.push(withMeta);
    }
  }

  feed.sort(byPublishedDesc);
  trending.sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    feed: feed.slice(0, FEED_MAX),
    trending: trending.slice(0, FEED_MAX),
    state: { seen: [...seen], lastRunAt: now },
  };
}

// CLI 진입점: `npm run merge`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const summarized = await readJson('data/summarized.json', []);
  const existingFeed = await readJson('data/feed.json', []);
  const existingTrending = await readJson('data/trending.json', []);
  const state = await readJson('data/state.json', { seen: [], lastRunAt: null });
  const now = new Date().toISOString();

  const r = mergeFeed({ summarized, existingFeed, existingTrending, state, now });
  await writeJson('data/feed.json', r.feed);
  await writeJson('data/trending.json', r.trending);
  await writeJson('data/state.json', r.state);
  console.log(`[merge] feed ${r.feed.length} / trending ${r.trending.length} (seen ${r.state.seen.length})`);
}
```

- [ ] **Step 4: 테스트 재실행 → 통과 확인**

Run: `node --test test/merge.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: 전체 테스트 실행 → 통과 확인**

Run: `node --test`
Expected: PASS (모든 test 파일)

- [ ] **Step 6: 커밋**

```bash
git add pipeline/merge.mjs test/merge.test.mjs
git commit -m "feat: merge(dedupe/cap/state)"
```

---

### Task 9: summarize 런북 (에이전트 단계 + 프롬프트 + JSON 계약)

**Files:**
- Create: `pipeline/RUNBOOK.md`
- Create: `data/feed.sample.json` (뷰어 개발용 샘플 — Task 11에서 사용)

**Interfaces:**
- Consumes: `data/raw.json` (Task 7 산출), `watch` 스킬, `geeknews-search` 스킬
- Produces: `data/summarized.json` — RawItem에 `summaryKo`/`tags`/`entities`/`cats`/`summaryStatus` 추가한 배열. merge(Task 8)가 소비.

> 이 태스크는 에이전트가 구독 세션에서 수행하는 단계라 단위 테스트 대신 **수동 스모크 검증**으로 확인한다.

- [ ] **Step 1: `pipeline/RUNBOOK.md` 작성**

````markdown
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
````

- [ ] **Step 2: `data/feed.sample.json` 작성 (뷰어 개발용 고정 샘플)**

```json
[
  {
    "id": "sample0001",
    "sourceType": "news",
    "source": "The Verge AI",
    "title": "예시: 새 멀티모달 모델 공개",
    "url": "https://example.com/a",
    "publishedAt": "2026-06-18",
    "fetchedAt": "2026-06-18T08:00:00Z",
    "summaryKo": "한 회사가 텍스트·이미지·오디오를 함께 처리하는 새 모델을 공개했다. 추론 속도와 비용이 크게 개선되어 실서비스 적용이 쉬워졌다.",
    "tags": ["Multimodal", "LLM"],
    "entities": ["ExampleAI"],
    "cats": ["멀티모달", "LLM"],
    "summaryStatus": "ok"
  },
  {
    "id": "sample0002",
    "sourceType": "youtube",
    "source": "Matt Wolfe",
    "title": "예시: 이번 주 AI 도구 총정리",
    "url": "https://youtu.be/mMgCEJEAm54",
    "publishedAt": "2026-06-17",
    "fetchedAt": "2026-06-18T08:00:00Z",
    "summaryKo": "이번 주 출시된 주요 AI 도구들을 정리한 영상이다. 코딩 보조와 영상 생성 도구의 업데이트가 핵심으로 다뤄진다.",
    "tags": ["AI Tools", "Video"],
    "entities": [],
    "cats": [],
    "summaryStatus": "fallback"
  }
]
```

- [ ] **Step 3: 수동 스모크 검증**

세션에서 `data/raw.json`을 1~2개 아이템으로 직접 만들어 두고, RUNBOOK의 summarize 규칙대로 `data/summarized.json`을 생성한 뒤 형식이 계약과 맞는지 눈으로 확인한다(추가 필드 6종 `summaryKo`/`tags`/`entities`/`cats`/`summaryStatus` 존재, `cats`는 고정 목록에서만, `summaryStatus` enum).

- [ ] **Step 4: 커밋**

```bash
git add pipeline/RUNBOOK.md data/feed.sample.json
git commit -m "docs: summarize 런북 + 뷰어 샘플 데이터"
```

---

### Task 10: 뷰어 데이터 어댑터 (`web/adapt.mjs`)

**Files:**
- Create: `web/adapt.mjs`
- Test: `test/adapt.test.mjs`

**Interfaces:**
- Consumes: 파이프라인 아이템(feed/trending.json 요소)
- Produces (Task 11이 사용):
  - `viewType(item): 'news'|'blog'|'video'|'sns'|'paper'|'repo'|'model'`
  - `relativeTime(iso: string, nowMs: number): string` — "n분 전/n시간 전/n일 전", 파싱 불가 시 `''`
  - `toViewItem(item, nowMs): ViewItem` — `{ id, type, title, summary, source, time, tagText, metric, cats, score, status, url }`
  - `groupColumns(viewItems): { news, video, snsblog, paper }` — 4개 컬럼용 그룹(`sns`+`blog`→`snsblog`, `repo`/`model`은 컬럼에서 제외 → 트렌딩 strip 전용)

- [ ] **Step 1: 실패하는 테스트 작성 — `test/adapt.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewType, relativeTime, toViewItem, groupColumns } from '../web/adapt.mjs';

test('viewType: sourceType과 source로 표시 타입을 정한다', () => {
  assert.equal(viewType({ sourceType: 'youtube' }), 'video');
  assert.equal(viewType({ sourceType: 'paper' }), 'paper');
  assert.equal(viewType({ sourceType: 'repo' }), 'repo');
  assert.equal(viewType({ sourceType: 'model' }), 'model');
  assert.equal(viewType({ sourceType: 'news', source: 'GeekNews' }), 'sns');
  assert.equal(viewType({ sourceType: 'news', source: 'AWS ML Blog' }), 'blog');
  assert.equal(viewType({ sourceType: 'news', source: 'The Verge AI' }), 'news');
});

test('relativeTime: 경과 시간을 한국어로 만든다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  assert.equal(relativeTime('2026-06-18T11:30:00Z', now), '30분 전');
  assert.equal(relativeTime('2026-06-18T09:00:00Z', now), '3시간 전');
  assert.equal(relativeTime('2026-06-16T12:00:00Z', now), '2일 전');
  assert.equal(relativeTime('not-a-date', now), '');
});

test('toViewItem: 파이프라인 아이템을 ViewItem으로 매핑한다', () => {
  const now = Date.parse('2026-06-18T12:00:00Z');
  const v = toViewItem({
    id: 'x1', sourceType: 'news', source: 'The Verge AI', title: 'T',
    url: 'https://x/1', summaryKo: '요약', tags: ['LLM', 'RAG'],
    cats: ['LLM'], score: 5, publishedAt: '2026-06-18T11:00:00Z',
    fetchedAt: '2026-06-18T11:00:00Z', summaryStatus: 'ok',
  }, now);
  assert.equal(v.type, 'news');
  assert.equal(v.summary, '요약');
  assert.equal(v.tagText, '#LLM  #RAG');
  assert.equal(v.time, '1시간 전');
  assert.deepEqual(v.cats, ['LLM']);
  assert.equal(v.url, 'https://x/1');
});

test('groupColumns: sns/blog는 한 컬럼, repo/model은 제외', () => {
  const items = [
    { type: 'news' }, { type: 'video' }, { type: 'paper' },
    { type: 'sns' }, { type: 'blog' }, { type: 'repo' }, { type: 'model' },
  ];
  const c = groupColumns(items);
  assert.equal(c.news.length, 1);
  assert.equal(c.video.length, 1);
  assert.equal(c.paper.length, 1);
  assert.equal(c.snsblog.length, 2);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test test/adapt.test.mjs`
Expected: FAIL — `Cannot find module '../web/adapt.mjs'`

- [ ] **Step 3: `web/adapt.mjs` 구현**

```js
const BLOG = new Set(['AWS ML Blog', 'Databricks', 'Roboflow', 'NAVER D2', 'Comet ML', 'Salesforce']);
const SNS = new Set(['GeekNews', 'Hacker News']);

export function viewType(item) {
  switch (item.sourceType) {
    case 'youtube': return 'video';
    case 'paper': return 'paper';
    case 'repo': return 'repo';
    case 'model': return 'model';
    default:
      if (SNS.has(item.source)) return 'sns';
      if (BLOG.has(item.source)) return 'blog';
      return 'news';
  }
}

export function relativeTime(iso, nowMs) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

export function toViewItem(item, nowMs) {
  return {
    id: item.id,
    type: viewType(item),
    title: item.title,
    summary: item.summaryKo || '',
    source: item.source,
    url: item.url,
    time: relativeTime(item.fetchedAt || item.publishedAt, nowMs),
    tagText: (item.tags || []).map((t) => `#${t}`).join('  '),
    metric: item.metric || (item.score != null ? String(item.score) : ''),
    cats: item.cats || [],
    score: item.score || 0,
    status: item.summaryStatus || 'ok',
  };
}

export function groupColumns(viewItems) {
  const col = { news: [], video: [], snsblog: [], paper: [] };
  for (const i of viewItems) {
    if (i.type === 'video') col.video.push(i);
    else if (i.type === 'paper') col.paper.push(i);
    else if (i.type === 'sns' || i.type === 'blog') col.snsblog.push(i);
    else if (i.type === 'repo' || i.type === 'model') continue; // 트렌딩 strip 전용
    else col.news.push(i);
  }
  return col;
}
```

- [ ] **Step 4: 테스트 재실행 → 통과 확인**

Run: `node --test test/adapt.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add web/adapt.mjs test/adapt.test.mjs
git commit -m "feat: 뷰어 데이터 어댑터(adapt.mjs)"
```

---

### Task 11: 확정 디자인 포팅 — Source Board 뷰어

**Files:**
- Create: `web/index.html`, `web/app.js`, `web/style.css`

**Interfaces:**
- Consumes: `data/feed.json`(컬럼) + `data/trending.json`(strip), 없으면 `data/feed.sample.json` 폴백. `web/adapt.mjs`(Task 10).
- Produces: `docs/design/dashboard-v2.dc.html` + `docs/design/HANDOFF.md`의 hifi 디자인을 그대로 재현한 정적 대시보드.

> **디자인 출처(확정)**: 픽셀/토큰은 `docs/design/HANDOFF.md`와 `docs/design/dashboard-v2.dc.html`이 기준이다. 아래 코드는 데이터 바인딩·상태 로직의 골격이며, 색/간격/폰트 토큰은 HANDOFF 표를 그대로 적용한다. 단위 테스트 대신 브라우저 수동 검증(체크리스트).
>
> **repo/model 트렌딩 배지**: HANDOFF는 5개 타입 색만 정의한다. 트렌딩 strip에 오는 `repo`/`model`은 순위 번호/배지를 ACCENT(`oklch(0.55 0.2 285)`)로 표시한다(핸드오프 확장, 최소 처리).

- [ ] **Step 1: `web/index.html` 작성 (폰트 + 마운트 지점)**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>에이트렌드 · AI Trend Board</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <div class="dash" id="dash" data-theme="light">
    <header class="bar">
      <div class="brand">
        <div class="logo">▲</div>
        <div class="wordmark">에이트렌드</div>
        <div class="badge-board">BOARD</div>
      </div>
      <nav class="cats" id="cats"></nav>
      <div class="search">
        <span class="search-ic">⌕</span>
        <input id="q" placeholder="검색…" />
      </div>
      <button class="darktoggle" id="darktoggle"></button>
    </header>
    <section class="trending">
      <div class="section-label">실시간 트렌딩</div>
      <div class="trending-grid" id="trending"></div>
    </section>
    <main class="columns" id="columns"></main>
  </div>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

- [ ] **Step 2: `web/style.css` 작성 (HANDOFF 토큰 적용)**

> HANDOFF "Design Tokens" 표를 그대로 옮긴다. 핵심 토큰을 변수로 정의하고, top bar·칩·트렌딩 그리드(`repeat(5,1fr)`)·컬럼 그리드(`repeat(4,1fr)`)·카드·다크 오버라이드를 작성한다. 픽셀 값은 HANDOFF "Layout"/"컴포넌트" 절을 따른다.

```css
:root {
  --accent: oklch(0.55 0.2 285);
  --accent-tint: oklch(0.95 0.045 285);
  --c-news: oklch(0.55 0.16 250); --t-news: oklch(0.96 0.03 250);
  --c-blog: oklch(0.52 0.13 155); --t-blog: oklch(0.96 0.035 155);
  --c-video: oklch(0.57 0.19 28); --t-video: oklch(0.96 0.04 28);
  --c-sns: oklch(0.55 0.17 330); --t-sns: oklch(0.96 0.035 330);
  --c-paper: oklch(0.54 0.11 95); --t-paper: oklch(0.96 0.04 95);
  --page: #fbfbf9; --surface: #fff; --chip: #f4f4f2; --border: #ececea;
  --text: #16161a; --title: #22222a; --muted: #7a786f; --meta: #b0aea6;
  --mono: 'JetBrains Mono', monospace;
}
* { box-sizing: border-box; }
body { margin: 0; background: #e7e5df; font-family: 'Pretendard', -apple-system, sans-serif; }
.dash { max-width: 1320px; margin: 0 auto; }
[data-page], .dash { background: var(--page); }
.dash { border-radius: 3px; box-shadow: 0 1px 3px rgba(0,0,0,.09); overflow: hidden; }

.bar { display: flex; align-items: center; gap: 18px; padding: 16px 28px; background: var(--surface); border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: 11px; }
.logo { width: 27px; height: 27px; border-radius: 7px; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font: 700 14px/1 var(--mono); }
.wordmark { font-size: 18px; font-weight: 800; color: var(--text); letter-spacing: -.01em; }
.badge-board { font: 500 10px/1 var(--mono); color: #b6b4ac; letter-spacing: .1em; }
.cats { display: flex; gap: 4px; margin-left: 6px; flex-wrap: wrap; }
.chip { padding: 8px 14px; border: none; border-radius: 999px; cursor: pointer; font-family: inherit; font-size: 13px; white-space: nowrap; background: var(--chip); color: var(--text); font-weight: 500; }
.chip.active { background: var(--accent); color: #fff; font-weight: 700; }
.search { margin-left: auto; width: 260px; display: flex; align-items: center; gap: 9px; padding: 9px 14px; background: var(--chip); border: 1px solid var(--border); border-radius: 9px; }
.search-ic { color: #a8a69e; font-size: 14px; }
.search input { border: none; background: transparent; outline: none; width: 100%; font-family: inherit; font-size: 14px; color: inherit; }
.darktoggle { display: flex; align-items: center; gap: 7px; padding: 8px 13px; background: var(--chip); border: 1px solid var(--border); border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; color: inherit; }

.trending { padding: 20px 28px; border-bottom: 1px solid var(--border); }
.section-label { font: 600 12px/1 var(--mono); color: #8a887f; letter-spacing: .04em; margin-bottom: 14px; }
.trending-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.trend-card { background: var(--surface); border: 1px solid var(--border); border-radius: 11px; padding: 15px 16px; }
.trend-rank { font: 700 20px/1 var(--mono); color: var(--accent); }
.trend-title { font-size: 13.5px; line-height: 1.4; font-weight: 700; color: var(--title); margin: 8px 0; text-wrap: pretty; }
.trend-metric { font: 500 11px/1 var(--mono); color: var(--meta); }

.columns { display: grid; grid-template-columns: repeat(4, 1fr); align-items: start; }
.col { padding: 20px 18px; }
.col:not(:last-child) { border-right: 1px solid var(--border); }
.col-head { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
.col-dot { width: 10px; height: 10px; border-radius: 50%; }
.col-name { font-size: 14px; font-weight: 800; color: var(--title); }
.col-count { margin-left: auto; font: 500 11px/1 var(--mono); color: var(--meta); }
.col-card { background: var(--surface); border: 1px solid var(--border); border-radius: 9px; padding: 13px 14px; display: flex; gap: 11px; margin-bottom: 12px; transition: transform .14s ease, box-shadow .14s ease; }
.col-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,.07); }
.col-bar { width: 3px; border-radius: 3px; flex: none; }
.cc-body { flex: 1; min-width: 0; }
.cc-titlerow { display: flex; gap: 8px; align-items: start; }
.cc-title { font-size: 14px; line-height: 1.4; font-weight: 700; color: var(--title); text-decoration: none; flex: 1; }
.cc-bookmark { border: none; background: none; cursor: pointer; font-size: 16px; color: oklch(0.72 0 0); }
.cc-bookmark.on { color: var(--accent); }
.cc-summary { font-size: 12px; line-height: 1.5; color: var(--muted); margin: 6px 0; }
.cc-meta { font: 500 11px/1 var(--mono); color: var(--meta); }
.cc-flag { color: #b50; }
.empty { padding: 60px 28px; text-align: center; font-size: 15px; color: #a8a69e; }

.dash[data-theme="dark"] { background: #101014; }
.dash[data-theme="dark"] .bar { background: #16161b; border-color: #27272e; }
.dash[data-theme="dark"] .trend-card,
.dash[data-theme="dark"] .col-card { background: #1a1a20; border-color: #2a2a31; }
.dash[data-theme="dark"] .wordmark,
.dash[data-theme="dark"] .col-name,
.dash[data-theme="dark"] .cc-title,
.dash[data-theme="dark"] .trend-title { color: #f3f3f5; }
.dash[data-theme="dark"] .cc-summary { color: #9a9aa3; }
.dash[data-theme="dark"] .chip { background: #26262d; color: #cfcfd6; }
.dash[data-theme="dark"] .chip.active { background: var(--accent); color: #fff; }
.dash[data-theme="dark"] .search { background: #22222a; border-color: #2f2f37; }
.dash[data-theme="dark"] .col:not(:last-child) { border-color: #2a2a31; }

@media (max-width: 960px) {
  .trending-grid { grid-template-columns: 1fr; }
  .columns { grid-template-columns: 1fr; }
  .col:not(:last-child) { border-right: none; border-bottom: 1px solid var(--border); }
  .search { width: 100%; }
}
```

- [ ] **Step 3: `web/app.js` 작성 (상태/필터/북마크/다크 + 렌더)**

```js
import { toViewItem, groupColumns } from './adapt.mjs';

const CATS = ['전체', 'LLM', '에이전트', '멀티모달', '하드웨어', '정책/규제', '오픈소스'];
const COLORS = { news: 'var(--c-news)', blog: 'var(--c-blog)', video: 'var(--c-video)',
  sns: 'var(--c-sns)', paper: 'var(--c-paper)', repo: 'var(--accent)', model: 'var(--accent)' };
const COLDEFS = [
  ['뉴스', 'news', 'var(--c-news)'],
  ['영상', 'video', 'var(--c-video)'],
  ['소셜 · 블로그', 'snsblog', 'var(--c-sns)'],
  ['논문', 'paper', 'var(--c-paper)'],
];

const state = { cat: '전체', q: '', dark: load('dark') === '1',
  bm: JSON.parse(localStorage.getItem('bm') || '{}'), feed: [], trending: [] };

function load(k) { return localStorage.getItem(k); }
async function getJson(path, fallback) {
  try { const r = await fetch(path, { cache: 'no-store' }); if (!r.ok) throw 0; return await r.json(); }
  catch { return fallback; }
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

function matches(i) {
  const okCat = state.cat === '전체' || (i.cats || []).includes(state.cat);
  const q = state.q.trim().toLowerCase();
  const okQ = !q || `${i.title} ${i.summary} ${i.source} ${i.tagText}`.toLowerCase().includes(q);
  return okCat && okQ;
}

function renderCats() {
  document.getElementById('cats').innerHTML = CATS.map((c) =>
    `<button class="chip${c === state.cat ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
}

function renderTrending() {
  const items = state.trending.filter(matches).sort((a, b) => b.score - a.score).slice(0, 5);
  document.getElementById('trending').innerHTML = items.map((i, n) => `
    <div class="trend-card">
      <div class="trend-rank" style="color:${COLORS[i.type] || 'var(--accent)'}">${String(n + 1).padStart(2, '0')}</div>
      <div class="trend-title">${esc(i.title)}</div>
      <div class="trend-metric">${esc(i.source)} · ${esc(i.metric)}</div>
    </div>`).join('') || '<div class="empty">트렌딩 항목이 없습니다.</div>';
}

function colCard(i) {
  const on = state.bm[i.id] ? ' on' : '';
  const star = state.bm[i.id] ? '★' : '☆';
  const flag = i.status !== 'ok' ? `<span class="cc-flag">${esc(i.status)}</span> ` : '';
  return `<div class="col-card">
    <div class="col-bar" style="background:${COLORS[i.type]}"></div>
    <div class="cc-body">
      <div class="cc-titlerow">
        <a class="cc-title" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a>
        <button class="cc-bookmark${on}" data-bm="${esc(i.id)}">${star}</button>
      </div>
      <div class="cc-summary">${esc(i.summary)}</div>
      <div class="cc-meta">${flag}${esc(i.source)} · ${esc(i.time)} · ${esc(i.tagText)}</div>
    </div>
  </div>`;
}

function renderColumns() {
  const cols = groupColumns(state.feed.filter(matches));
  const html = COLDEFS.map(([label, key, color]) => {
    const items = cols[key] || [];
    const cards = items.map(colCard).join('') || '<div class="empty">검색 결과가 없습니다.</div>';
    return `<section class="col">
      <div class="col-head"><span class="col-dot" style="background:${color}"></span>
        <span class="col-name">${label}</span><span class="col-count">${items.length}</span></div>
      ${cards}
    </section>`;
  }).join('');
  document.getElementById('columns').innerHTML = html;
}

function renderDark() {
  document.getElementById('dash').dataset.theme = state.dark ? 'dark' : 'light';
  document.getElementById('darktoggle').innerHTML =
    `<span style="width:13px;height:13px;border-radius:50%;background:${state.dark ? '#f3f3f5' : '#16161a'}"></span>${state.dark ? 'Light' : 'Dark'}`;
}

function renderAll() { renderCats(); renderTrending(); renderColumns(); }

document.getElementById('cats').addEventListener('click', (e) => {
  const c = e.target.dataset.cat; if (!c) return; state.cat = c; renderAll();
});
document.getElementById('q').addEventListener('input', (e) => { state.q = e.target.value; renderTrending(); renderColumns(); });
document.getElementById('darktoggle').addEventListener('click', () => {
  state.dark = !state.dark; localStorage.setItem('dark', state.dark ? '1' : '0'); renderDark();
});
document.getElementById('columns').addEventListener('click', (e) => {
  const id = e.target.dataset.bm; if (!id) return;
  state.bm[id] = !state.bm[id]; localStorage.setItem('bm', JSON.stringify(state.bm)); renderColumns();
});

const now = Date.now();
const rawFeed = await getJson('../data/feed.json', await getJson('../data/feed.sample.json', []));
const rawTrend = await getJson('../data/trending.json', []);
state.feed = rawFeed.map((i) => toViewItem(i, now));
state.trending = rawTrend.map((i) => toViewItem(i, now));
renderDark();
renderAll();
```

- [ ] **Step 4: 브라우저 수동 검증 (체크리스트)**

Run: `python3 -m http.server 8080` → `http://localhost:8080/web/` 열기. (`data/feed.json` 없으면 샘플 폴백)

`docs/design/dashboard-v2.dc.html`을 나란히 띄워 비교하며 확인:
- [ ] top bar: 로고(▲)+워드마크+BOARD, 카테고리 칩 7개, 우측 검색(260px), 다크 토글
- [ ] 트렌딩 strip: 5열 그리드, 순위 `01`~`05`, 소스 컬러 순위 번호
- [ ] 컬럼: 뉴스/영상/소셜·블로그/논문 4열, 헤더 점·카운트, 카드 좌측 컬러 바
- [ ] 카테고리 칩 클릭 → 컬럼/트렌딩 필터(전체는 미적용)
- [ ] 검색 입력 → title+summary+source+tagText 부분일치 필터
- [ ] 북마크 ☆↔★ 토글, 새로고침 후 유지(localStorage)
- [ ] 다크 토글 → 색 일괄 전환, 새로고침 후 유지
- [ ] 카드 호버 시 살짝 떠오름(translateY -2px)
- [ ] 빈 결과 시 "검색 결과가 없습니다."
- [ ] 폭 960px 이하에서 컬럼/트렌딩 1열 스택

- [ ] **Step 5: 커밋**

```bash
git add web/index.html web/app.js web/style.css
git commit -m "feat: 확정 디자인 포팅 — Source Board 뷰어"
```

---

### Task 12: 엔드투엔드 실행 + 로컬 스케줄 배선

**Files:**
- Create: `pipeline/run.sh` (수동/cron 공용 실행 래퍼)
- Modify: `pipeline/RUNBOOK.md` (스케줄 절 추가)

**Interfaces:**
- Consumes: Task 7(fetch), Task 9(summarize 런북), Task 8(merge)
- Produces: 한 번의 명령으로 fetch→(에이전트 summarize)→merge가 도는 실행 경로 + 로컬 cron 등록 안내.

> summarize는 에이전트 단계라 완전 무인 자동화는 헤드리스 세션(`claude -p`)에 의존한다. 이 태스크는 실행 경로를 만들고 수동 E2E로 검증한다.

- [ ] **Step 1: `pipeline/run.sh` 작성**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[1/3] fetch"
npm run --silent fetch

echo "[2/3] summarize (에이전트 세션)"
# 헤드리스 세션이 RUNBOOK의 summarize 단계를 수행해 data/summarized.json을 만든다.
# 대화형 세션에서 수동 실행 시 이 단계는 사람이 '요약 실행'으로 트리거한다.
claude -p "pipeline/RUNBOOK.md의 summarize 단계를 수행해 data/raw.json을 읽고 data/summarized.json을 작성해줘. 작업이 끝나면 파일만 남기고 종료." || {
  echo "summarize 자동 단계 실패/건너뜀 — data/summarized.json을 수동으로 생성하세요."; }

echo "[3/3] merge"
npm run --silent merge
echo "완료. web/ 에서 결과 확인."
```

- [ ] **Step 2: 실행 권한 부여 + 수동 E2E**

```bash
chmod +x pipeline/run.sh
npm run fetch          # data/raw.json 생성 확인
```
이후 세션에서 RUNBOOK대로 `data/summarized.json`을 만들고:
```bash
npm run merge          # data/feed.json/trending.json/state.json 생성 확인
python3 -m http.server 8080   # web/ 에서 실제 데이터 렌더링 확인
```
확인: 실제 소스에서 받은 아이템이 한국어 요약과 함께 대시보드에 보인다.

- [ ] **Step 3: `pipeline/RUNBOOK.md`에 스케줄 절 추가**

````markdown
## 4. 로컬 스케줄 (매일 아침)

watch 스킬이 로컬 yt-dlp를 쓰므로 클라우드 cron이 아닌 **로컬 cron**을 사용한다.
매일 08:00 실행 예시(crontab):

```cron
0 8 * * * /bin/bash /Users/minjijung/projects/ai-project/ai-trend/pipeline/run.sh >> /tmp/ai-trend.log 2>&1
```

등록: `crontab -e` 후 위 줄 추가. 로그는 `/tmp/ai-trend.log`에서 확인.
주의: `claude -p` 헤드리스 세션이 로그인된 상태여야 summarize 단계가 동작한다.
````

- [ ] **Step 4: 커밋**

```bash
git add pipeline/run.sh pipeline/RUNBOOK.md
git commit -m "feat: E2E 실행 래퍼 + 로컬 스케줄 안내"
```

---

## Self-Review

**Spec coverage (설계 문서 + 확정 디자인 대비):**
- 목적/개인용/API비용0/로컬스케줄 → Task 9 런북·Task 12 ✅
- fetch+summarize 분리 → Task 7(fetch)·Task 9(summarize)·Task 8(merge) ✅
- 소스 4종(YouTube/뉴스·블로그·GeekNews/GitHub·HF/arXiv) → Task 3·4·5·6 ✅
- GeekNews 추가 → sources.json(Task 1) + 런북 geeknews-search 언급(Task 9) ✅
- 데이터 스키마(feed/trending/state) → Task 8 + 샘플(Task 9) ✅
- 중복 재요약 방지(state.seen) → Task 8 ✅
- rate limit 캡(perRunCap) → Task 1 설정 + Task 3·6 적용 ✅
- 소스별 격리 → Task 3·4·5·6 try/catch ✅
- YouTube 폴백(summaryStatus) → Task 9 런북 + Task 8 처리 ✅
- 시드 영상 2개 → sources.json(Task 1) + Task 6 ✅
- **확정 디자인(Source Board)**: 데이터 어댑터 → Task 10, 트렌딩 strip + 4컬럼 + 카테고리·검색·북마크·다크모드 포팅 → Task 11 ✅
- **카테고리(cats) 분류**: summarize 계약(Task 9) → merge 통과(Task 8, spread) → 카테고리 탭 필터(Task 11) ✅
- **view 타입 매핑(news|blog|video|sns|paper)**: Task 10 `viewType` ✅

**Placeholder scan:** "TBD/TODO/적절히 처리" 없음. 모든 코드 단계에 실제 코드 포함. 디자인 포팅(Task 11)의 픽셀 토큰은 커밋된 `docs/design/`를 기준으로 하며 vague하지 않음. ✅

**Type consistency:**
- RawItem 필드(id/sourceType/source/title/url/publishedAt/rawText[/videoId/score/thumbnail/lang])가 어댑터→fetch→merge에서 일관. ✅
- summarize 추가 필드(summaryKo/tags/entities/cats/summaryStatus)가 런북(Task 9)·merge spread(Task 8)·adapt(Task 10) 간 일관. ✅
- `summaryStatus` enum(`ok|fallback|skipped`)이 런북·merge·adapt(`status`)에서 일관. ✅
- ViewItem 필드(id/type/title/summary/source/url/time/tagText/metric/cats/score/status)가 `toViewItem`(Task 10) 정의와 `app.js`(Task 11) 사용처 일치. ✅
- `makeId`/`readJson`/`writeJson`/`parseFeed`/`collectRaw`/`mergeFeed`/`fetchRssSources`/`fetchArxiv`/`fetchGithub`/`fetchHuggingface`/`fetchYoutube`/`viewType`/`relativeTime`/`toViewItem`/`groupColumns` 시그니처가 정의처와 호출처 일치. ✅
