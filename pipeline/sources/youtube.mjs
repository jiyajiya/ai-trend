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
