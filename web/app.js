import { toViewItem, groupColumns } from './adapt.mjs';

// group: 'media'(매체) | 'domain'(분야) | 'view'(보기) — 분류 축이 다른 메뉴를 섹션으로 분리
const FEEDS = [
  { key: 'video', label: '영상', group: 'media', dot: 'var(--c-video)', sub: 'AI 채널 영상을 한국어 요약으로 한 편씩 훑어보세요' },
  { key: 'snsblog', label: '소셜 · 블로그', group: 'media', dot: 'var(--c-sns)', sub: '커뮤니티·블로그의 실사용 반응과 새로운 도구' },
  { key: 'news', label: '뉴스', group: 'media', dot: 'var(--c-news)', sub: '주요 AI 뉴스와 연구를 넓은 화면에서 한 편씩 읽어보세요' },
  { key: 'repo', label: 'GitHub', group: 'media', dot: 'var(--accent)', sub: '지금 뜨는 GitHub 레포 (최근 생성·스타순)' },
  { key: 'model', label: 'HuggingFace', group: 'media', dot: 'var(--c-paper)', sub: '지금 뜨는 HuggingFace 모델 (trendingScore순)' },
  { key: 'pharma', label: '약사', group: 'domain', dot: 'var(--c-blog)', sub: '약업·약사 분야의 AI 관련 소식' },
  { key: 'leaderboard', label: '🏆 추천 모델', group: 'domain', dot: 'var(--accent)', sub: '주요 리더보드 종합 — 영역별 추천 모델 (매일 갱신)' },
  { key: 'skills', label: '🧰 추천 스킬', group: 'view', dot: 'var(--accent)', sub: 'AX 개발팀이 쓰는 Claude Code 스킬 — 설치법과 사용법' },
  { key: 'bookmark', label: '⭐ 북마크', group: 'view', dot: 'var(--accent)', sub: '★ 저장한 항목만 모아보기' },
];
const FEED_GROUPS = [
  { key: 'media', label: 'FEED' },
  { key: 'domain', label: '분야' },
  { key: 'view', label: '보기' },
];
const CATS = ['전체', 'LLM·모델', '에이전트', '코딩·개발', '멀티모달', '기업·정책'];
const BAR = { news: 'var(--c-news)', blog: 'var(--c-blog)', video: 'var(--c-video)',
  sns: 'var(--c-sns)', pharma: 'var(--c-blog)', repo: 'var(--accent)', model: 'var(--c-paper)' };

// 활성 메뉴를 URL(?feed=)로 유지 — 새로고침·뒤로가기에도 같은 피드를 보여준다.
const FEED_KEYS = new Set(FEEDS.map((f) => f.key));
function feedFromUrl() {
  const f = new URLSearchParams(location.search).get('feed');
  return FEED_KEYS.has(f) ? f : 'video';
}

const state = { feed: feedFromUrl(), cat: '전체', q: '', dark: localStorage.getItem('dark') === '1',
  bm: JSON.parse(localStorage.getItem('bm') || '{}'), selectedId: null, lb: null, sk: null,
  data: { video: [], snsblog: [], news: [], repo: [], model: [], pharma: [] } };

async function getJson(path, fallback) {
  try { const r = await fetch(path, { cache: 'no-store' }); if (!r.ok) throw 0; return await r.json(); }
  catch { return fallback; }
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 본문 산문(intro·summary·팁 등)에서 작성자가 넣은 줄바꿈(\n)을 <br>로 렌더 — 긴 문장·여러 문장을 보기 좋게 끊을 때
const escLines = (s) => esc(s).replace(/\n/g, '<br>');

function matches(i) {
  const okCat = state.cat === '전체' || (i.cats || []).includes(state.cat);
  const q = state.q.trim().toLowerCase();
  const okQ = !q || `${i.title} ${i.summary} ${i.source} ${i.tagText}`.toLowerCase().includes(q);
  return okCat && okQ;
}
function allItems() {
  return [...state.data.video, ...state.data.snsblog, ...state.data.pharma, ...state.data.news, ...state.data.repo, ...state.data.model];
}
function visible(key) {
  const arr = key === 'bookmark' ? allItems().filter((i) => state.bm[i.id]) : (state.data[key] ?? []);
  return arr.filter(matches);
}

function renderFeeds() {
  const itemHtml = (f) => {
    const n = f.key === 'leaderboard' ? (state.lb?.categories?.length ?? 0)
      : f.key === 'skills' ? (state.sk?.skills?.length ?? 0)
      : visible(f.key).length;
    const active = f.key === state.feed ? ' active' : '';
    return `<button class="feed-item${active}" data-feed="${esc(f.key)}">
      <span class="feed-dot" style="background:${f.dot}"></span>
      <span class="feed-name">${esc(f.label)}</span>
      <span class="feed-count">${n}</span>
    </button>`;
  };
  document.getElementById('feeds').innerHTML = FEED_GROUPS.map((g) => {
    const items = FEEDS.filter((f) => f.group === g.key);
    if (!items.length) return '';
    return `<div class="nav-label feed-group-label">${esc(g.label)}</div>${items.map(itemHtml).join('')}`;
  }).join('');
}

function renderCats() {
  document.getElementById('cats').innerHTML = CATS.map((c) =>
    `<button class="chip${c === state.cat ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
}

function tagChips(tagText) {
  return (tagText || '').split(/\s+/).filter(Boolean)
    .map((t) => `<span class="rc-tag">${esc(t)}</span>`).join('');
}

function rcard(i) {
  const on = state.bm[i.id] ? ' on' : '';
  const star = state.bm[i.id] ? '★' : '☆';
  const flag = i.status !== 'ok' ? `<span class="rc-flag">${esc(i.status)}</span>` : '';
  const metric = i.metric ? `<span class="rc-sep">·</span><span class="rc-time">${esc(i.metric)}</span>` : '';
  const sel = state.selectedId === i.id ? ' selected' : '';
  return `<article class="rcard${sel}" data-card="${esc(i.id)}" style="--bar:${BAR[i.type] || 'var(--accent)'}">
    <div class="rc-titlerow">
      <a class="rc-title" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a>
      <button class="rc-bookmark${on}" data-bm="${esc(i.id)}">${star}</button>
    </div>
    <p class="rc-summary">${esc(i.summary)}</p>
    <div class="rc-meta">
      <span class="rc-source">${esc(i.source)}</span>
      ${i.time ? `<span class="rc-sep">·</span><span class="rc-time">${esc(i.time)}</span>` : ''}
      ${metric}
      ${flag}
      <span class="rc-tags">${tagChips(i.tagText)}</span>
    </div>
  </article>`;
}

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

// ── Leaderboard (영역별 추천 모델) ──────────────────────────────────────
// 카드 피드와 데이터 성격이 달라(랭킹 테이블) 별도 렌더 경로를 쓴다.
const safeHttpUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
const AUD = {
  pharma: { label: '💊 약사·전문', cls: 'lb-aud-pharma' },
  dev: { label: '⚙️ 개발자', cls: 'lb-aud-dev' },
  all: { label: '공통', cls: 'lb-aud-all' },
};
const audBadge = (a) => {
  const m = AUD[a] || AUD.all;
  return `<span class="lb-aud ${m.cls}">${esc(m.label)}</span>`;
};

function renderLeaderboard(lb) {
  if (!lb || !Array.isArray(lb.categories) || !lb.categories.length) {
    return '<div class="empty">리더보드 데이터가 아직 없습니다.</div>';
  }
  const head = `<div class="lb-intro">
    ${lb.windowLabel ? `<div class="lb-window">${esc(lb.windowLabel)}</div>` : ''}
    ${lb.intro ? `<p class="lb-introtext">${escLines(lb.intro)}</p>` : ''}
  </div>`;

  const useCases = Array.isArray(lb.useCases) && lb.useCases.length ? `
    <section class="lb-section">
      <h2 class="lb-h2">📌 실무 추천 조합</h2>
      <div class="lb-table-wrap"><table class="lb-table">
        <thead><tr><th>용도</th><th>추천 모델</th><th>대상</th></tr></thead>
        <tbody>${lb.useCases.map((u) => `<tr>
          <td class="lb-use">${esc(u.use)}</td>
          <td>${esc(u.models)}</td>
          <td>${audBadge(u.audience)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>` : '';

  const cats = `
    <section class="lb-section">
      <h2 class="lb-h2">영역별 추천 모델</h2>
      ${lb.categories.map((c) => `
        <div class="lb-cat">
          <div class="lb-cat-head">
            <div class="lb-cat-titles">
              <span class="lb-cat-title">${esc(c.title)}</span>
              ${c.subtitle ? `<span class="lb-cat-sub">${esc(c.subtitle)}</span>` : ''}
            </div>
            ${audBadge(c.audience)}
          </div>
          ${c.metric ? `<div class="lb-cat-metric">기준: ${esc(c.metric)}</div>` : ''}
          ${c.note ? `<p class="lb-cat-note">${esc(c.note)}</p>` : ''}
          <div class="lb-table-wrap"><table class="lb-table lb-rank">
            <thead><tr><th>순위</th><th>모델</th><th>근거</th></tr></thead>
            <tbody>${(c.ranks || []).map((r) => `<tr class="${r.rank === 1 ? 'lb-top' : ''}">
              <td class="lb-rank-n">${esc(r.rank)}</td>
              <td class="lb-model">${esc(r.model)}${r.score ? `<span class="lb-score">${esc(r.score)}</span>` : ''}</td>
              <td class="lb-basis">${esc(r.basis)}${r.source ? `<span class="lb-src">${esc(r.source)}</span>` : ''}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>`).join('')}
    </section>`;

  const metrics = Array.isArray(lb.metrics) && lb.metrics.length ? `
    <section class="lb-section">
      <h2 class="lb-h2">📊 지표 이해하기</h2>
      <div class="lb-table-wrap"><table class="lb-table">
        <thead><tr><th>지표</th><th>뜻</th><th>중요 영역</th></tr></thead>
        <tbody>${lb.metrics.map((m) => `<tr>
          <td class="lb-metric-name">${esc(m.name)}${m.detail ? `<span class="lb-metric-detail">${esc(m.detail)}</span>` : ''}</td>
          <td>${esc(m.meaning)}</td>
          <td class="lb-metric-area">${esc(m.area)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>` : '';

  const sources = Array.isArray(lb.sources) && lb.sources.length ? `
    <section class="lb-section">
      <h2 class="lb-h2">🔗 출처 · 순위 판별 근거</h2>
      <p class="lb-note">각 영역은 표기된 출처 리더보드의 <strong>공개 점수</strong>(벤치마크 정답률 · Arena Elo · 가격)를 그대로 인용해 높은 순으로 정렬했습니다.<br>점수가 같으면 출처의 세부 순위를 따릅니다.<br>수치는 리더보드 업데이트 주기에 따라 달라질 수 있으니, 아래 <strong>기준일</strong>을 함께 확인하세요.</p>
      <div class="lb-table-wrap"><table class="lb-table">
        <thead><tr><th>리더보드</th><th>링크</th><th>최근 업데이트</th></tr></thead>
        <tbody>${lb.sources.map((s) => `<tr>
          <td>${esc(s.name)}</td>
          <td><a href="${esc(safeHttpUrl(s.url))}" target="_blank" rel="noopener">${esc((s.url || '').replace(/^https?:\/\//, ''))} ↗</a></td>
          <td class="lb-updated">${esc(s.updated || '')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>` : '';

  const foot = lb.asOf ? `<div class="lb-foot">기준일: ${esc(lb.asOf)}</div>` : '';

  return head + useCases + cats + metrics + sources + foot;
}

// ── Skills (🧰 추천 스킬) ────────────────────────────────────────────────
// 리더보드와 같은 전용 렌더 경로 — 데이터(JSON) 주도로 스킬 가이드를 펼친다.
function renderSkills(sk) {
  if (!sk || !Array.isArray(sk.skills) || !sk.skills.length) {
    return '<div class="empty">추천 스킬 데이터가 아직 없습니다.</div>';
  }
  const steps = (list) => (Array.isArray(list) ? list : []).map((s) => `
    <li class="sk-step">
      ${s.desc ? `<p class="sk-step-desc">${esc(s.desc)}</p>` : ''}
      ${s.code ? `<pre class="sk-code"><code>${esc(s.code)}</code></pre>` : ''}
    </li>`).join('');

  const head = sk.intro ? `<div class="sk-intro"><p class="sk-introtext">${esc(sk.intro)}</p></div>` : '';

  const cards = sk.skills.map((s) => {
    const home = safeHttpUrl(s.homepage);
    const homeLink = home !== '#'
      ? `<a class="sk-home" href="${esc(home)}" target="_blank" rel="noopener">${esc((s.homepage || '').replace(/^https?:\/\//, ''))} ↗</a>`
      : '';
    const install = Array.isArray(s.install) && s.install.length ? `
      <div class="sk-block">
        <h3 class="sk-h3">플러그인 추가 방법</h3>
        <ol class="sk-steps">${steps(s.install)}</ol>
      </div>` : '';
    const usage = Array.isArray(s.usage) && s.usage.length ? `
      <div class="sk-block">
        <h3 class="sk-h3">사용법</h3>
        <ol class="sk-steps">${steps(s.usage)}</ol>
      </div>` : '';
    const tips = Array.isArray(s.tips) && s.tips.length ? `
      <div class="sk-block">
        <h3 class="sk-h3">팁</h3>
        <ul class="sk-tips">${s.tips.map((t) => `<li>${escLines(t)}</li>`).join('')}</ul>
      </div>` : '';
    return `
      <article class="sk-card">
        <div class="sk-card-head">
          <div class="sk-card-titles">
            <span class="sk-name">${esc(s.name)}</span>
            ${s.tagline ? `<span class="sk-tagline">${esc(s.tagline)}</span>` : ''}
          </div>
          ${audBadge(s.audience)}
        </div>
        ${s.summary ? `<p class="sk-summary">${escLines(s.summary)}</p>` : ''}
        ${homeLink}
        ${install}
        ${usage}
        ${tips}
      </article>`;
  }).join('');

  return head + `<section class="sk-section">${cards}</section>`;
}

function renderMain() {
  const feed = FEEDS.find((f) => f.key === state.feed);
  document.getElementById('feedTitle').textContent = feed.label;
  document.getElementById('feedSub').textContent = feed.sub;
  // 검색·CATEGORY 필터는 카드 피드 전용 — 와이드 뷰(추천 모델·추천 스킬)에선 동작하지 않으므로 숨긴다
  const isWide = state.feed === 'leaderboard' || state.feed === 'skills';
  document.querySelector('.search').style.display = isWide ? 'none' : '';
  document.getElementById('cats').style.display = isWide ? 'none' : '';
  document.getElementById('catsLabel').style.display = isWide ? 'none' : '';
  // 와이드 뷰는 우측 상세 패널이 없으므로 본문을 넓게 펼친다(좁은 컬럼+빈 거터 방지)
  // dataset.view 값은 'leaderboard'로 통일해 기존 와이드 CSS 규칙을 그대로 재사용한다
  document.getElementById('app').dataset.view = isWide ? 'leaderboard' : 'feed';
  if (isWide) state.selectedId = null;  // 와이드 뷰는 우측 분석 패널을 쓰지 않는다
  if (state.feed === 'leaderboard') {
    document.getElementById('feedCount').textContent = state.lb?.categories?.length ?? 0;
    document.getElementById('reader').innerHTML = renderLeaderboard(state.lb);
    return;
  }
  if (state.feed === 'skills') {
    document.getElementById('feedCount').textContent = state.sk?.skills?.length ?? 0;
    document.getElementById('reader').innerHTML = renderSkills(state.sk);
    return;
  }
  const items = visible(state.feed);
  if (state.selectedId && !items.some((i) => i.id === state.selectedId)) state.selectedId = null;
  document.getElementById('feedCount').textContent = items.length;
  document.getElementById('reader').innerHTML = items.map(rcard).join('') || '<div class="empty">표시할 항목이 없습니다.</div>';
}

function renderDark() {
  document.getElementById('app').dataset.theme = state.dark ? 'dark' : 'light';
  document.getElementById('darktoggle').textContent = state.dark ? '☀ 라이트 모드' : '☾ 다크 모드';
}

function renderAll() { renderFeeds(); renderCats(); renderMain(); renderPanel(); }

document.getElementById('feeds').addEventListener('click', (e) => {
  const f = e.target.closest('[data-feed]'); if (!f) return;
  state.feed = f.dataset.feed;
  state.selectedId = null;  // 메뉴 바뀌면 상세 패널 닫기
  history.pushState(null, '', `${location.pathname}?feed=${encodeURIComponent(state.feed)}`);
  renderAll();
});
// 뒤로/앞으로: URL의 feed로 동기화
window.addEventListener('popstate', () => {
  state.feed = feedFromUrl();
  state.selectedId = null;
  renderAll();
});
document.getElementById('cats').addEventListener('click', (e) => {
  const c = e.target.dataset.cat; if (!c) return; state.cat = c; renderAll();
});
document.getElementById('q').addEventListener('input', (e) => { state.q = e.target.value; renderAll(); });
document.getElementById('darktoggle').addEventListener('click', () => {
  state.dark = !state.dark; localStorage.setItem('dark', state.dark ? '1' : '0'); renderDark();
});
document.getElementById('reader').addEventListener('click', (e) => {
  const bm = e.target.dataset.bm;
  if (bm) {  // ⭐ 북마크: 패널 열지 않음
    state.bm[bm] = !state.bm[bm]; localStorage.setItem('bm', JSON.stringify(state.bm));
    renderAll(); return;
  }
  if (e.target.closest('a')) return;  // 제목 링크 클릭은 원문으로(패널 토글 안 함)
  const card = e.target.closest('[data-card]'); if (!card) return;
  const id = card.dataset.card;
  state.selectedId = state.selectedId === id ? null : id;  // 재클릭 시 닫기
  renderAll();
});
document.getElementById('panelClose').addEventListener('click', () => {
  state.selectedId = null; renderAll();
});

const now = Date.now();
const rawFeed = (await getJson('../data/feed.json', null)) ?? (await getJson('../data/feed.sample.json', []));
const rawTrend = await getJson('../data/trending.json', []);
const cols = groupColumns(rawFeed.map((i) => toViewItem(i, now)));
state.data.news = cols.news ?? [];
state.data.video = cols.video ?? [];
state.data.snsblog = cols.snsblog ?? [];
state.data.pharma = cols.pharma ?? [];
const trending = rawTrend.map((i) => toViewItem(i, now))
  .sort((a, b) => ((a.rank ?? Infinity) - (b.rank ?? Infinity)) || ((b.score ?? 0) - (a.score ?? 0)));
state.data.repo = trending.filter((i) => i.type === 'repo');
state.data.model = trending.filter((i) => i.type === 'model');
state.lb = await getJson('../data/leaderboard.json', null);
state.sk = await getJson('../data/skills.json', null);
renderDark();
renderAll();
