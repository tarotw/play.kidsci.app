// 已讀取正式簡介的逐集判讀結果。未核對的新內容只用分類圖示，不猜標題關鍵字。
import { REVIEWED_EPISODE_ICONS } from './data/episode-icons.js';

const HOME_ICONS = {
  l01: '⚛️', l02: '🧫', l03: '🐾', l04: '⚙️', l05: '🌍', l06: '🌙', l07: '🪐', l08: '⭐', l09: '🌌', l10: '🌌',
  'era:bigbang': '🌌', 'era:earth': '🌋', 'era:life': '🦕', 'era:human': '🧒', 'era:scientists': '🔬', 'era:now': '🧒',
  'lane:force': '🏋️', 'lane:gravity': '🍎', 'lane:energy': '🔋', 'lane:light': '🌈', 'lane:sound': '🔊', 'lane:em': '⚡',
  'lane:relativity': '⏱️', studio: '🎙️',
};

// 偵測已核對的簡介是否被換掉；這是內容變更標記，不是安全或簽章機制。
export function contentKey(text) {
  const normalized = String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) hash = Math.imul(hash ^ normalized.charCodeAt(i), 16777619);
  return `${normalized.length}:${(hash >>> 0).toString(16)}`;
}

export function iconFor(episode) {
  const reviewed = REVIEWED_EPISODE_ICONS[episode.code];
  if (reviewed?.title === episode.title && reviewed.contentKey === contentKey(episode.intro)) return reviewed.icon;
  return HOME_ICONS[episode.home] || '🎧';
}
