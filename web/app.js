import { toViewItem, groupColumns } from './adapt.mjs';

const CATS = ['전체', 'LLM', '에이전트', '멀티모달', '하드웨어', '정책/규제', '오픈소스'];
const COLORS = { news: 'var(--c-news)', blog: 'var(--c-blog)', video: 'var(--c-video)',
  sns: 'var(--c-sns)', paper: 'var(--c-paper)', repo: 'var(--accent)', model: 'var(--accent)' };
const TINTS = { news: 'var(--t-news)', blog: 'var(--t-blog)', video: 'var(--t-video)',
  sns: 'var(--t-sns)', paper: 'var(--t-paper)', repo: 'var(--accent-tint)', model: 'var(--accent-tint)' };
const TYPE_LABELS = { news: '뉴스', blog: '블로그', video: '영상', sns: '소셜', paper: '논문', repo: 'Repo', model: 'Model' };
const COLDEFS = [
  ['뉴스', 'news', 'var(--c-news)'],
  ['영상', 'video', 'var(--c-video)'],
  ['소셜 · 블로그', 'snsblog', 'var(--c-sns)'],
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
  const items = state.trending.filter(matches).sort((a, b) => ((a.rank ?? Infinity) - (b.rank ?? Infinity)) || (b.score - a.score)).slice(0, 5);
  document.getElementById('trending').innerHTML = items.map((i, n) => `
    <div class="trend-card">
      <div class="trend-top">
        <div class="trend-rank" style="color:${COLORS[i.type] || 'var(--accent)'}">${String(n + 1).padStart(2, '0')}</div>
        <span class="type-badge" style="color:${esc(COLORS[i.type] || 'var(--accent)')};background:${esc(TINTS[i.type] || 'var(--accent-tint)')}">${esc(TYPE_LABELS[i.type] || i.type)}</span>
      </div>
      <div class="trend-title">${esc(i.title)}</div>
      <div class="trend-metric">${esc(i.source)} · ${esc(i.metric)}</div>
    </div>`).join('') || '<div class="empty">트렌딩 항목이 없습니다.</div>';
}

function colCard(i) {
  const on = state.bm[i.id] ? ' on' : '';
  const star = state.bm[i.id] ? '★' : '☆';
  const flag = i.status !== 'ok' ? `<span class="cc-flag">${esc(i.status)}</span> ` : '';
  return `<div class="col-card">
    <div class="col-bar" style="background:${COLORS[i.type] || 'var(--accent)'}"></div>
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
const rawFeed = (await getJson('../data/feed.json', null)) ?? (await getJson('../data/feed.sample.json', []));
const rawTrend = await getJson('../data/trending.json', []);
state.feed = rawFeed.map((i) => toViewItem(i, now));
state.trending = rawTrend.map((i) => toViewItem(i, now));
renderDark();
renderAll();
