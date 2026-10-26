// 四種地圖共用的航行紀錄讀取；舊資料或部分損壞不應阻止孩子進入網站。
export const PROGRESS_KEY = 'kidsci-universe-v1';
export function emptyProgress() { return { ear: [], hand: [], seen: [], missions: [], guess: 0 }; }
export function loadProgress(storage) {
  const result = emptyProgress();
  try {
    const saved = JSON.parse((storage || localStorage).getItem(PROGRESS_KEY));
    if (!saved || typeof saved !== 'object') return result;
    for (const kind of ['ear', 'hand', 'seen', 'missions']) {
      if (Array.isArray(saved[kind])) result[kind] = [...new Set(saved[kind].filter(value => typeof value === 'string' && value.length))];
    }
    if (Number.isSafeInteger(saved.guess) && saved.guess >= 0) result.guess = saved.guess;
  } catch { /* 儲存被停用、舊資料格式或 JSON 損壞時，仍可正常探索。 */ }
  return result;
}
