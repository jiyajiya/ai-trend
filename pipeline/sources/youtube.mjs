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

// 피드 XML에서 채널명(feed-level <title>) 추출 — <entry> 이전의 첫 <title>
function channelName(xml) {
  const beforeEntry = xml.split(/<entry[\s>]/i)[0];
  const m = beforeEntry.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : 'YouTube';
}

// 각 <entry> 블록에서 <author><name> 값을 순서대로 반환
function entryAuthorNames(xml) {
  const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return entries.map((block) => {
    const authorBlock = block.match(/<author[\s>][\s\S]*?<\/author>/i);
    if (!authorBlock) return null;
    const name = authorBlock[0].match(/<name[^>]*>([^<]+)<\/name>/i);
    return name ? name[1].trim() : null;
  });
}

async function fetchChannel(channelUrl, deps, cap) {
  const out = [];
  const xml = await deps.fetchText(channelUrl);
  const feedTitle = channelName(xml);
  const authorNames = entryAuthorNames(xml);
  const entries = parseFeed(xml).slice(0, cap);
  entries.forEach((e, i) => {
    if (!e.link) return;
    out.push({
      id: makeId(e.link),
      sourceType: 'youtube',
      source: authorNames[i] || feedTitle,
      title: e.title,
      url: e.link,
      publishedAt: e.published,
      rawText: e.summary || e.title || '',
      videoId: extractVideoId(e.link) || '',
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
  const channelCap = config.perChannel ?? perRunCap;
  for (const ch of config.channels || []) {
    try {
      out.push(...(await fetchChannel(ch, deps, channelCap)));
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
