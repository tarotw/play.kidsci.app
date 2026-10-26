// 從可核對的內容判讀記錄產生精簡的瀏覽器資料，不在執行時做關鍵字分類。
import { readFileSync, writeFileSync } from 'node:fs';
import { contentKey } from '../episode-icons.js';
const root = new URL('../', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('data/catalog.json', root)));
const review = JSON.parse(readFileSync(new URL('data/episode-icon-review.json', root)));
const icons = {};
for (const episode of catalog.episodes) {
  const choice = review.episodes[episode.code];
  if (!choice || choice.title !== episode.title || contentKey(choice.siteIntro) !== contentKey(episode.intro)) {
    throw new Error(`${episode.code}: new or changed content needs a semantic review`);
  }
  icons[episode.code] = { title: choice.title, contentKey: contentKey(choice.siteIntro), icon: choice.icon, subject: choice.subject };
}
writeFileSync(new URL('data/episode-icons.js', root), '// 由 tools/build_episode_icons.mjs 產生；判讀依據與理由在 episode-icon-review.json。\nexport const REVIEWED_EPISODE_ICONS = '+JSON.stringify(icons,null,2)+';\n');
console.log(`Built ${Object.keys(icons).length} content-reviewed icons`);
