import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, emptyProgress } from '../progress-store.js';
const read = value => loadProgress({ getItem: () => value });
test('old, blocked or malformed saved progress cannot prevent the site loading', () => {
  for (const value of [null, 'null', '{bad', '12', '"old"', JSON.stringify({ ear:null,hand:'bad',seen:12,missions:{},guess:'x' })]) assert.deepEqual(read(value), emptyProgress());
  assert.deepEqual(loadProgress({ getItem() { throw new Error('Storage blocked'); } }), emptyProgress());
});
test('valid progress survives a damaged field without duplicate stamps or counts', () => {
  const actual = read(JSON.stringify({ ear:['217','217',null,22,''],hand:['c18'],seen:null,missions:['l03:visit'],guess:2 }));
  assert.deepEqual(actual, {ear:['217'],hand:['c18'],seen:[],missions:['l03:visit'],guess:2});
});
