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
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
}

function pickLink(block) {
  const text = pick(block, 'link');
  if (text.trim()) return decode(text);
  const href = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return href ? href[1] : '';
}

export function parseFeed(xml) {
  if (!xml) return [];
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
