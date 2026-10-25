// 全站朗讀只使用科學隊長的女性華語，沒有角色切換或壓低音調。
import { pickCaptainVoice } from './speech-voices.js';
const ok = typeof window !== 'undefined' && 'speechSynthesis' in window;
let voiceTimer = null;

const clean = (text) => String(text).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();

/** 有沒有辦法念（瀏覽器支援語音）。 */
export const canSpeak = () => ok;

// 瀏覽器規定：使用者還沒點過畫面之前，網頁不能自己出聲。
// 這時候要念的先記著，等第一次點畫面（或按鍵）就馬上念。
let interacted = false, pending = null, lastReplay = null;
const touched = () => (navigator.userActivation ? navigator.userActivation.hasBeenActive : interacted);
if (ok) {
  const mark = () => { interacted = true; };
  ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, mark, { capture: true, passive: true }));
  const replay = (ev) => { if (pending) { const p = pending; pending = null; lastReplay = ev; speakLines(p.lines, p.opts); } };
  ['click', 'keydown'].forEach((t) => document.addEventListener(t, replay)); // 不用 touchend：它比 click 早，對話框會以為已經念過、直接跳下一句
}
/** 這一下點擊是不是剛好把「等著要念的」念出來了（按鈕就不要再當成「停」）。 */
export const replayedBy = (ev) => lastReplay === ev;
/** 現在念得出來嗎（使用者點過畫面了）。 */
export const unlocked = () => ok && touched();

let token = 0;
/** 停下正在念的。 */
export function stopSpeaking() {
  token++;
  pending = null; // 關掉對話框、換一句時，等著要念的也一起作廢
  clearTimeout(voiceTimer);
  voiceTimer = null;
  if (ok) speechSynthesis.cancel();
}

/**
 * 依序用同一個科學隊長女聲念台詞 [{ text }]。每一句開始時呼叫 onLine(i)，全部念完（或被停下）時呼叫 onDone(finished)。
 * 長的句子會切成一句一句念（有些瀏覽器一次念太長會中斷）。
 */
export function speakLines(lines, { onLine = () => {}, onDone = () => {} } = {}) {
  stopSpeaking();
  pending = null;
  if (!ok || !lines.length) { onDone(false); return; }
  if (!touched()) { pending = { lines, opts: { onLine, onDone } }; return; } // 等第一次點畫面
  const mine = token;
  const parts = [];
  lines.forEach((l, i) => {
    const text = clean(l.text);
    (text.match(/[^。！？!?；;]+[。！？!?；;」』）)]*/g) || [text]).forEach((s, j) => { if (s.trim()) parts.push({ i, first: j === 0, text: s.trim() }); });
  });
  let n = 0, voice;
  const next = () => {
    if (mine !== token) return;
    if (n >= parts.length) { onDone(true); return; }
    const p = parts[n++];
    if (p.first) onLine(p.i);
    const u = new SpeechSynthesisUtterance(p.text);
    u.lang = 'zh-TW';
    u.voice = voice;
    u.pitch = 1;
    u.rate = 1;
    // 裝置上沒有可用的聲音時，有些瀏覽器不會開始也不會報錯：3 秒還沒開始就當作念不出來
    let started = false;
    const guard = setTimeout(() => {
      if (started || mine !== token) return;
      stopSpeaking();
      if (!interacted) pending = { lines, opts: { onLine, onDone } }; // 還沒點過畫面（不支援 userActivation 的瀏覽器）：等點了再念
      else onDone(false);
    }, 3000);
    u.onstart = () => { started = true; clearTimeout(guard); };
    u.onend = () => { clearTimeout(guard); next(); };
    u.onerror = (ev) => {
      clearTimeout(guard);
      if (mine !== token) return;
      if (ev?.error === 'not-allowed') { pending = { lines, opts: { onLine, onDone } }; return; } // 被擋：等點了再念
      onDone(false);
    };
    speechSynthesis.speak(u);
  };
  // 有些裝置第一次回傳空語音清單；等清單載入再選，避免誤用系統的粵語預設聲音。
  const deadline = Date.now() + 1500;
  const start = () => {
    if (mine !== token) return;
    const available = speechSynthesis.getVoices();
    if (!available.length && Date.now() < deadline) { voiceTimer = setTimeout(start, 100); return; }
    voiceTimer = null;
    voice = pickCaptainVoice(available);
    if (!voice) { onDone(false); return; }
    next();
  };
  start();
}

/** 念一句。 */
export function speak(text, opts) { speakLines([{ text }], opts); }
