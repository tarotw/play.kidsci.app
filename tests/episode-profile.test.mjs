import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { episodeArtwork, episodeArtworkSources, episodeMeta } from '../episode-profile.js';
const root = new URL('../', import.meta.url);
const episodes = JSON.parse(readFileSync(new URL('data/catalog.json', root), 'utf8')).episodes;

test('all public and VIP episodes have their own cached artwork and metadata', () => {
  assert.ok(episodes.some(e => e.state === 'subscriber'));
  for (const episode of episodes) {
    const file = episodeArtwork(episode);
    assert.match(file, /^assets\/episode-covers\//, episode.code);
    assert.ok(statSync(new URL(file, root)).size > 1000, episode.code);
    assert.ok(episodeMeta(episode), episode.code);
    if (episode.listen.duration) assert.ok(episodeMeta(episode).includes('分鐘'), episode.code);
  }
});

test('selects a local cover first, with remote and show-art fallbacks', () => {
  const local = 'assets/episode-covers/12345678901234567890.jpg';
  assert.equal(episodeArtwork({ artworkLocal: local, artwork: 'https://example.com/episode.jpg' }), local);
  assert.equal(episodeArtwork({ artwork: 'https://example.com/episode.jpg' }), 'https://example.com/episode.jpg');
  assert.equal(episodeArtwork({ artwork: 'javascript:alert(1)' }), 'assets/logo-square.jpg');
  assert.deepEqual(episodeArtworkSources({ artworkLocal: local, artwork: 'https://example.com/episode.jpg' }),
    [local, 'https://example.com/episode.jpg', 'assets/logo-square.jpg']);
  assert.deepEqual(episodeArtworkSources({ artworkLocal: '../secret.jpg', artwork: 'javascript:alert(1)' }),
    ['assets/logo-square.jpg']);
});

test('formats duration and publication date without displaying missing values', () => {
  assert.equal(episodeMeta({ listen: { duration: 718, pubDate: '2026-03-30T22:02:10Z' } }), '2026/3/31 · 12 分鐘');
  assert.equal(episodeMeta({ listen: { pubDate: 'bad-date', duration: -1 } }), '');
});
