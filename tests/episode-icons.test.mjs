import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { iconFor, contentKey } from '../episode-icons.js';
import { REVIEWED_EPISODE_ICONS } from '../data/episode-icons.js';
import { TOPIC_ART, iconMarkup } from '../topic-art.js';

const episodes = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url))).episodes;
const review = JSON.parse(readFileSync(new URL('../data/episode-icon-review.json', import.meta.url)));
const byCode = new Map(episodes.map(e => [e.code, e]));

test('every published episode has an evidence-backed content review for its actual introduction', () => {
  const graphemes = new Intl.Segmenter('zh-TW', { granularity: 'grapheme' });
  assert.equal(Object.keys(REVIEWED_EPISODE_ICONS).length, episodes.length);
  for (const episode of episodes) {
    const compiled = REVIEWED_EPISODE_ICONS[episode.code], choice = review.episodes[episode.code];
    assert.equal(compiled.title, episode.title, episode.code);
    assert.equal(compiled.contentKey, contentKey(episode.intro), episode.code);
    assert.equal(contentKey(choice.siteIntro), contentKey(episode.intro), episode.code);
    assert.ok(choice.meaning.length >= 15, episode.code);
    assert.ok(choice.reason.length >= 10, episode.code);
    assert.ok(choice.evidence.length >= 25, episode.code);
    assert.match(choice.source, /^https:\/\/podcasts\.apple\.com\/tw\/podcast\/id1812447277\?i=\d+$/);
    assert.equal(iconFor(episode), choice.icon);
    if (!TOPIC_ART[choice.icon]) assert.equal([...graphemes.segment(choice.icon)].length, 1, episode.code);
  }
});

test('selections reflect the full descriptions rather than author names or headline metaphors', () => {
  const expected = {
    c12: '🪼', c26: '⚙️', c27: '🔭', c30: '🛰️', s27: '📱', s28: '♟️', s29: '🎨',
    s45: 'animal:caecilian', '182': '🐟', '114': '🧑‍🚀', '247': 'habitat:termite-mound',
    '206': 'animal:capybara', '212': 'animal:okapi', '196': 'animal:platypus', '197': 'animal:pangolin',
    '224': 'animal:hornbill', '225': 'animal:toucan', '216': '🦅', s42: '🕷️', s46: '🕷️',
    s50: 'vehicle:drone', s51: 'vehicle:tank', '68': 'vehicle:submarine',
  };
  for (const [code, icon] of Object.entries(expected)) assert.equal(iconFor(byCode.get(code)), icon, code);
  assert.ok(review.episodes.c12.sourceIssue);
  assert.ok(review.episodes['90'].sourceIssue);
  assert.equal(iconFor(byCode.get('s32')), '🐴');
  assert.equal(iconFor(byCode.get('s33')), '🐴');
});

test('new titles or changed content never get a guessed keyword or stale reviewed icon', () => {
  assert.equal(iconFor({ ...byCode.get('216'), intro: '改成介紹馬的演化。' }), '🐾');
  assert.equal(iconFor({ ...byCode.get('s32'), title: '亞馬遜的鳥類' }), '🐾');
  assert.equal(iconFor({ title: '亞馬遜轟炸機與馬達', home: 'l03' }), '🐾');
  assert.equal(iconFor({ title: '牛頓公車裡的鐵製星星', home: 'l04' }), '⚙️');
});

test('species illustrations have labelled identifying features and share safe SVG markup', () => {
  for (const [key, art] of Object.entries(TOPIC_ART)) {
    assert.ok(art.label && art.features, key);
    assert.ok(art.shapes.length >= 3, key);
    const markup = iconMarkup(key);
    assert.ok(markup.startsWith('<svg'), key);
    assert.ok(markup.includes(`aria-label="${art.label}"`), key);
    assert.ok(!markup.includes('<script') && !markup.includes('<image'), key);
  }
  assert.ok(!iconMarkup('<script>x</script>').includes('<script>'));
});
