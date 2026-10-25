// 網站自帶同一位台灣華語女聲，避免裝置沒有匹配的系統語音時完全無聲。
const root = new URL('./assets/speech/', import.meta.url);
export const narrationReady = fetch(new URL('manifest.json', root))
  .then((response) => { if (!response.ok) throw new Error('Narration manifest unavailable'); return response.json(); })
  .then((manifest) => new Map(Object.entries(manifest.clips).map(([text, file]) => [text, new URL(file, root).href])))
  .catch(() => new Map());
