import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { shortIntro } from '../episode-intro.js';
const root = new URL('../', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('data/catalog.json', root), 'utf8'));
const texts = catalog.episodes.map((episode) => {
  const path = episode.content && new URL(episode.content, root);
  const content = path && existsSync(fileURLToPath(path)) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  return shortIntro(episode, content);
});
process.stdout.write(JSON.stringify(texts));
