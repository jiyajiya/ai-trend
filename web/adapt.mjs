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
  if (t > nowMs) return '방금 전';
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

export function toViewItem(item, nowMs) {
  const safeUrl = /^https?:\/\//i.test(item.url || '') ? item.url : '#';
  return {
    id: item.id,
    type: viewType(item),
    title: item.title,
    summary: item.summaryKo || '',
    source: item.source,
    url: safeUrl,
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
