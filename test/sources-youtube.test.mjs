import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchYoutube } from '../pipeline/sources/youtube.mjs';

const feedXml = await readFile(new URL('./fixtures/youtube-feed.xml', import.meta.url), 'utf8');
const feedTwoEntriesXml = await readFile(new URL('./fixtures/youtube-feed-two-entries.xml', import.meta.url), 'utf8');

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

test('2개 엔트리 채널 피드: 각 엔트리의 videoId가 자신의 link에서 올바르게 추출된다', async () => {
  const deps = {
    fetchText: async () => feedTwoEntriesXml,
    fetchJson: async () => { throw new Error('not used'); },
  };
  const items = await fetchYoutube(
    { channels: ['https://www.youtube.com/feeds/videos.xml?channel_id=UC1'], seedVideos: [] },
    deps, 10,
  );
  assert.equal(items.length, 2);
  // 첫 번째 엔트리: 자신의 link에서 추출한 videoId
  assert.equal(items[0].videoId, 'entry1VideoId123');
  assert.equal(items[0].url, 'https://www.youtube.com/watch?v=entry1VideoId123');
  assert.equal(items[0].title, 'First Entry Title');
  assert.equal(items[0].rawText, 'First entry summary');
  // 두 번째 엔트리: 자신의 link에서 추출한 videoId
  assert.equal(items[1].videoId, 'entry2VideoId456');
  assert.equal(items[1].url, 'https://www.youtube.com/watch?v=entry2VideoId456');
  assert.equal(items[1].title, 'Second Entry Title');
  assert.equal(items[1].rawText, 'Second entry summary');
});
