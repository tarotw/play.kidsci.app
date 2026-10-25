import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const root = new URL('../assets/speech/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));

test('bundled narration uses one Taiwan Mandarin female voice', () => {
  assert.equal(manifest.voice, 'zh-TW-HsiaoChenNeural');
  assert.equal(manifest.lang, 'zh-TW');
  assert.ok(Object.keys(manifest.clips).length >= 190);
});

test('every narration entry resolves to a nonempty MP3 file', () => {
  for (const [text, file] of Object.entries(manifest.clips)) {
    assert.ok(text.trim());
    assert.match(file, /^[a-f0-9]{20}\.mp3$/);
    assert.ok(statSync(new URL(file, root)).size > 1000, file);
  }
});
