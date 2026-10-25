import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCaptainVoice } from '../speech-voices.js';

const voice = (name, lang, voiceURI = name) => ({ name, lang, voiceURI });

test('selects the Taiwan female instead of a Cantonese female or Taiwan male', () => {
  const captain = voice('Microsoft HsiaoChen', 'zh-TW');
  const available = [voice('Sin-ji', 'zh-Hant-HK'), voice('Microsoft YunJhe', 'zh-TW'),
    voice('Google 普通话', 'zh-CN'), captain];
  assert.equal(pickCaptainVoice(available), captain);
});

test('rejects Cantonese tags, names and URI labels, even with an ambiguous Chinese tag', () => {
  const available = [voice('Sin-ji', 'zh-Hant'), voice('Google Chinese', 'zh-Hant-HK'),
    voice('Google Chinese', 'zh_HK'), voice('Google Chinese', 'zh-MO'), voice('Google Chinese', 'zh-yue'),
    voice('Google Chinese', 'yue-Hant-HK'), voice('Google Chinese', 'zh', 'com.apple.voice.cantonese'),
    voice('善怡（粵語）', 'zh'), voice('Microsoft HiuMaan female', 'zh')];
  assert.equal(pickCaptainVoice(available), undefined);
});

test('recognizes female Taiwan voices across Apple, Windows, Edge and Google', () => {
  for (const captain of [voice('Mei-Jia', 'zh-Hant'), voice('美嘉', 'zh-TW'),
    voice('Microsoft Hanhan Desktop', 'zh_TW'), voice('Microsoft HsiaoYu', 'zh-TW'),
    voice('Google 國語（臺灣）', 'cmn-Hant-TW')]) {
    assert.equal(pickCaptainVoice([voice('Google 普通话', 'zh-CN'), captain]), captain);
  }
});

test('uses another Mandarin female when only a Taiwan male is installed locally', () => {
  const captain = voice('Ting-Ting', 'zh-CN');
  assert.equal(pickCaptainVoice([voice('Microsoft Zhiwei', 'zh-TW'), captain]), captain);
});

test('never falls back to male, unknown, non-Chinese or empty voice lists', () => {
  for (const available of [[], [voice('Microsoft YunJhe', 'zh-TW')], [voice('Li-mu', 'zh-TW')],
    [voice('Siri male', 'zh-TW')], [voice('Unknown', 'zh-TW')], [voice('Google English', 'en-US')]]) {
    assert.equal(pickCaptainVoice(available), undefined);
  }
});
