// 單集預覽由自己的資料呈現，避免內嵌播放器只顯示節目共用封面。
export function episodeArtworkSources(episode) {
  const sources = [];
  const local = episode.artworkLocal;
  if (typeof local === 'string' && /^assets\/episode-covers\/[a-f0-9]{20}\.(jpg|png|webp)$/.test(local)) sources.push(local);
  if (typeof episode.artwork === 'string' && episode.artwork.startsWith('https://')) sources.push(episode.artwork);
  sources.push('assets/logo-square.jpg');
  return [...new Set(sources)];
}
export function episodeArtwork(episode) {
  return episodeArtworkSources(episode)[0];
}
export function episodeMeta(episode) {
  const listen = episode.listen || {};
  const seconds = Number(listen.duration);
  const duration = Number.isFinite(seconds) && seconds > 0 ? `${Math.max(1, Math.round(seconds / 60))} 分鐘` : '';
  const date = new Date(listen.pubDate || '');
  const released = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Taipei',
  }).format(date) : '';
  return [released, duration].filter(Boolean).join(' · ');
}
