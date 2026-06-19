import { toViewItem, groupColumns } from './adapt.mjs';

const FEEDS = [
  { key: 'news', label: '뉴스', dot: 'var(--c-news)', sub: '주요 AI 뉴스와 연구를 넓은 화면에서 한 편씩 읽어보세요' },
  { key: 'video', label: '영상', dot: 'var(--c-video)', sub: 'AI 채널 영상을 한국어 요약으로 한 편씩 훑어보세요' },
  { key: 'snsblog', label: '소셜 · 블로그', dot: 'var(--c-sns)', sub: '커뮤니티·블로그의 실사용 반응과 새로운 도구' },
  { key: 'trending', label: '트렌딩', dot: 'var(--accent)', sub: '지금 뜨는 GitHub 레포와 HuggingFace 모델' },
];
const CATS = ['전체', 'LLM·모델', '에이전트', '코딩·개발', '멀티모달', '기업·정책'];
const BAR = { news: 'var(--c-news)', blog: 'var(--c-blog)', video: 'var(--c-video)',
  sns: 'var(--c-sns)', repo: 'var(--accent)', model: 'var(--c-paper)' };

const state = { feed: 'news', cat: '전체', q: '', dark: localStorage.getItem('dark') === '1',
  bm: JSON.parse(localStorage.getItem('bm') || '{}'), data: { news: [], video: [], snsblog: [], trending: [] } };

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
const visible = (key) => state.data[key].filter(matches);

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
  return `<article class="rcard" style="--bar:${BAR[i.type] || 'var(--accent)'}">
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

function renderMain() {
  const feed = FEEDS.find((f) => f.key === state.feed);
  const items = visible(state.feed);
  document.getElementById('feedTitle').textContent = feed.label;
  document.getElementById('feedCount').textContent = items.length;
  document.getElementById('feedSub').textContent = feed.sub;
  document.getElementById('reader').innerHTML = items.map(rcard).join('') || '<div class="empty">표시할 항목이 없습니다.</div>';
}

function renderDark() {
  document.getElementById('app').dataset.theme = state.dark ? 'dark' : 'light';
  document.getElementById('darktoggle').textContent = state.dark ? '☀ 라이트 모드' : '☾ 다크 모드';
}

function renderAll() { renderFeeds(); renderCats(); renderMain(); }

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
  const id = e.target.dataset.bm; if (!id) return;
  state.bm[id] = !state.bm[id]; localStorage.setItem('bm', JSON.stringify(state.bm)); renderMain();
});

const now = Date.now();
const rawFeed = (await getJson('../data/feed.json', null)) ?? (await getJson('../data/feed.sample.json', []));
const rawTrend = await getJson('../data/trending.json', []);
const cols = groupColumns(rawFeed.map((i) => toViewItem(i, now)));
state.data.news = cols.news ?? [];
state.data.video = cols.video ?? [];
state.data.snsblog = cols.snsblog ?? [];
state.data.trending = rawTrend.map((i) => toViewItem(i, now))
  .sort((a, b) => ((a.rank ?? Infinity) - (b.rank ?? Infinity)) || ((b.score ?? 0) - (a.score ?? 0)));
renderDark();
renderAll();
