import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { shortIntro } from '../episode-intro.js';
const root = new URL('../', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('data/catalog.json', root), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('assets/speech/manifest.json', root), 'utf8'));

test('every published story has one short paragraph and matching bundled narration', () => {
  for (const episode of catalog.episodes) {
    const path = episode.content && new URL(episode.content, root);
    const content = path && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
    const summary = shortIntro(episode, content);
    assert.ok(summary.length > 0, episode.code);
    assert.ok(Array.from(summary).length <= 90, episode.code);
    assert.doesNotMatch(summary, /[\r\n]/, episode.code);
    const clean = summary.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
    assert.ok(manifest.clips[clean], episode.code);
  }
});

test('short questions and explanations stay together as one paragraph', () => {
  assert.equal(shortIntro({ title: '月亮', intro: '月亮有多遠？\n大約三十八萬公里。\n一起來探索更多祕密吧！' }), '月亮有多遠？大約三十八萬公里。');
});

test('an oversized sentence falls back to a complete topic introduction', () => {
  const text = shortIntro({ title: '太陽探測器', intro: '如果' + '非常靠近太陽的太空船，'.repeat(15) + '會怎樣？' });
  assert.match(text, /太陽探測器/);
  assert.ok(text.endsWith('！'));
  assert.ok(Array.from(text).length <= 90);
});
