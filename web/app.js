import { toViewItem, groupColumns } from './adapt.mjs';

const FEEDS = [
  { key: 'video', label: '영상', dot: 'var(--c-video)', sub: 'AI 채널 영상을 한국어 요약으로 한 편씩 훑어보세요' },
  { key: 'snsblog', label: '소셜 · 블로그', dot: 'var(--c-sns)', sub: '커뮤니티·블로그의 실사용 반응과 새로운 도구' },
  { key: 'news', label: '뉴스', dot: 'var(--c-news)', sub: '주요 AI 뉴스와 연구를 넓은 화면에서 한 편씩 읽어보세요' },
  { key: 'repo', label: 'GitHub', dot: 'var(--accent)', sub: '지금 뜨는 GitHub 레포 (최근 생성·스타순)' },
  { key: 'model', label: 'HuggingFace', dot: 'var(--c-paper)', sub: '지금 뜨는 HuggingFace 모델 (trendingScore순)' },
  { key: 'bookmark', label: '⭐ 북마크', dot: 'var(--accent)', sub: '★ 저장한 항목만 모아보기' },
];
const CATS = ['전체', 'LLM·모델', '에이전트', '코딩·개발', '멀티모달', '기업·정책'];
const BAR = { news: 'var(--c-news)', blog: 'var(--c-blog)', video: 'var(--c-video)',
  sns: 'var(--c-sns)', repo: 'var(--accent)', model: 'var(--c-paper)' };

const state = { feed: 'video', cat: '전체', q: '', dark: localStorage.getItem('dark') === '1',
  bm: JSON.parse(localStorage.getItem('bm') || '{}'), selectedId: null,
  data: { video: [], snsblog: [], news: [], repo: [], model: [] } };

async function getJson(path, fallback) {
  try { const r = await fetch(path, { cache: 'no-store' }); if (!r.ok) throw 0; return await r.json(); }
  catch { return fallback; }
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function matches(i) {
  const okCat = state.cat === '전체' || (i.cats || []).includes(state.cat);
  const q = state.q.trim().toLowerCase();
  const okQ = !q || `${i.title} ${i.summary} ${i.source} ${i.tagText}`.toLowerCase().includes(q);
  return okCat && okQ;
}
function allItems() {
  return [...state.data.video, ...state.data.snsblog, ...state.data.news, ...state.data.repo, ...state.data.model];
}
function visible(key) {
  const arr = key === 'bookmark' ? allItems().filter((i) => state.bm[i.id]) : (state.data[key] ?? []);
  return arr.filter(matches);
}

function renderFeeds() {
  document.getElementById('feeds').innerHTML = FEEDS.map((f) => {
    const n = visible(f.key).length;
    const active = f.key === state.feed ? ' active' : '';
    return `<button class="feed-item${active}" data-feed="${esc(f.key)}">
      <span class="feed-dot" style="background:${f.dot}"></span>
      <span class="feed-name">${esc(f.label)}</span>
      <span class="feed-count">${n}</span>
    </button>`;
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

function renderMain() {
  const feed = FEEDS.find((f) => f.key === state.feed);
  const items = visible(state.feed);
  if (state.selectedId && !items.some((i) => i.id === state.selectedId)) state.selectedId = null;
  document.getElementById('feedTitle').textContent = feed.label;
  document.getElementById('feedCount').textContent = items.length;
  document.getElementById('feedSub').textContent = feed.sub;
  document.getElementById('reader').innerHTML = items.map(rcard).join('') || '<div class="empty">표시할 항목이 없습니다.</div>';
}

function renderDark() {
  document.getElementById('app').dataset.theme = state.dark ? 'dark' : 'light';
  document.getElementById('darktoggle').textContent = state.dark ? '☀ 라이트 모드' : '☾ 다크 모드';
}

function renderAll() { renderFeeds(); renderCats(); renderMain(); renderPanel(); }

document.getElementById('feeds').addEventListener('click', (e) => {
  const f = e.target.closest('[data-feed]'); if (!f) return;
  state.feed = f.dataset.feed; renderAll();
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
  const card = e.target.closest('[data-card]'); if (!card) return;
  const id = card.dataset.card;
  state.selectedId = state.selectedId === id ? null : id;  // 재클릭 시 닫기
  renderAll();
});
document.getElementById('panelClose').addEventListener('click', () => {
  state.selectedId = null; renderPanel();
  document.querySelectorAll('.rcard.selected').forEach((el) => el.classList.remove('selected'));
});

const now = Date.now();
const rawFeed = (await getJson('../data/feed.json', null)) ?? (await getJson('../data/feed.sample.json', []));
const rawTrend = await getJson('../data/trending.json', []);
const cols = groupColumns(rawFeed.map((i) => toViewItem(i, now)));
state.data.news = cols.news ?? [];
state.data.video = cols.video ?? [];
state.data.snsblog = cols.snsblog ?? [];
const trending = rawTrend.map((i) => toViewItem(i, now))
  .sort((a, b) => ((a.rank ?? Infinity) - (b.rank ?? Infinity)) || ((b.score ?? 0) - (a.score ?? 0)));
state.data.repo = trending.filter((i) => i.type === 'repo');
state.data.model = trending.filter((i) => i.type === 'model');
renderDark();
renderAll();
