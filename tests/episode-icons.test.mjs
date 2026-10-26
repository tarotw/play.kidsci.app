import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { iconFor } from '../episode-icons.js';
import { REVIEWED_EPISODE_ICONS } from '../data/episode-icons.js';

const episodes = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url))).episodes;
const byCode = new Map(episodes.map(e => [e.code, e]));

test('every published episode has a topic review for its current title and one visible icon', () => {
  const graphemes = new Intl.Segmenter('zh-TW', { granularity: 'grapheme' });
  assert.equal(Object.keys(REVIEWED_EPISODE_ICONS).length, episodes.length);
  for (const episode of episodes) {
    const review = REVIEWED_EPISODE_ICONS[episode.code];
    assert.ok(review, episode.code);
    assert.equal(review.title, episode.title, `${episode.code}: title needs a new review`);
    assert.ok(review.subject.trim(), episode.code);
    assert.equal([...graphemes.segment(review.icon)].length, 1, episode.code);
    assert.match(review.icon, /\p{Extended_Pictographic}/u, episode.code);
    assert.equal(iconFor(episode), review.icon);
  }
});

test('actual subjects take precedence over metaphors, similar names and incidental words', () => {
  const expected = {
    '216': '🦅', '237': '🌴', '238': '🌳', '213': '🐦', '224': '🐦',
    's43': '🐸', 's42': '🕷️', 's46': '🕷️', 's62': '🐟', '208': '🦘',
    '246': '🪲', '171': '🐋', '172': '🦎', '64': '🧲', 'c8': '🚢',
    'c33': '🏎️', 's49': '💣', 'c26': '🍎', '227': '🐿️',
  };
  for (const [code, icon] of Object.entries(expected)) assert.equal(iconFor(byCode.get(code)), icon, code);
  const rainforest = episodes.filter(e => e.home === 'l03' && e.zone === '雨林');
  assert.ok(rainforest.length);
  for (const episode of rainforest) assert.ok(!['🐴', '🐄', '✈️', '🏎️'].includes(iconFor(episode)), episode.code);
  assert.equal(iconFor(byCode.get('s32')), '🐴');
  assert.equal(iconFor(byCode.get('s33')), '🐴');
});

test('future or renamed episodes cannot reintroduce substring and metaphor mistakes', () => {
  const examples = [
    ['亞馬遜危險又迷人的角鵰', 'l03', '🦅'],
    ['亞馬遜水陸雨林生態', 'l03', '🌴'],
    ['雨林裡的重裝轟炸機：大犀鳥', 'l03', '🐦'],
    ['披著乳牛外衣的麝雉', 'l03', '🐦'],
    ['裝甲車般的鱷雀鱔', 'l03', '🐟'],
    ['狼蛛媽媽與大蟻蛛的育兒', 'l03', '🕷️'],
    ['白蟻丘的摩天樓', 'l03', '🏗️'],
    ['海上鋼鐵巨獸：福特號航母', 'l04', '🚢'],
    ['黑鳥 SR-71 與海鷹直升機', 'l04', '✈️'],
    ['馬達、馬赫環與高速引擎', 'l04', '⚙️'],
    ['維生素 B2 與細胞的作用', 'l02', '🧫'],
    ['公車急煞時的牛頓定律', 'era:scientists', '🍎'],
    ['草原上的馬兒與馬蹄', 'l03', '🐴'],
  ];
  for (const [title, home, expected] of examples) assert.equal(iconFor({ title, home }), expected, title);
  assert.equal(iconFor({ code: 's32', title: '亞馬遜雨林的生態', home: 'l03' }), '🌴');
  assert.equal(iconFor({ title: '還沒核對的新題目', home: 'l03' }), '🐾');
});
