// 科學隊長（女生）和好奇博士（男生）的聲音：用瀏覽器內建的語音念台詞。
// 隊長挑女聲、博士挑男聲；裝置上沒有中文男聲時，博士用同一個聲音、把音調壓低。
const ok = typeof window !== 'undefined' && 'speechSynthesis' in window;

// 常見的中文語音名字（Windows／Edge、macOS／iOS、Android／Chrome）
const MALE = /yunjhe|zhiwei|yunxi|yunyang|yunjian|yunze|kangkang|li-mu|limu|yu-shu|yushu|(?<!fe)male|男/i;
const FEMALE = /hsiaochen|hsiaoyu|yating|hanhan|meijia|mei-jia|tingting|sin-ji|xiaoxiao|xiaoyi|huihui|female|女|google/i;

let voices = [];
function loadVoices() {
  if (!ok) return;
  const zh = speechSynthesis.getVoices().filter((v) => /^zh|^cmn/i.test(v.lang));
  // 台灣的優先，再來香港、中國
  const rank = (v) => (/TW|Hant/i.test(v.lang) ? 0 : /HK/i.test(v.lang) ? 2 : 1);
  voices = zh.sort((a, b) => rank(a) - rank(b));
}
if (ok) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

function pickVoice(who) {
  if (!voices.length) loadVoices();
  const female = voices.find((v) => FEMALE.test(v.name) && !MALE.test(v.name)) || voices.find((v) => !MALE.test(v.name)) || voices[0];
  if (who === 'curious') {
    const male = voices.find((v) => MALE.test(v.name));
    if (male) return { voice: male, pitch: 1.05, rate: 1.05 };
    return { voice: female, pitch: 0.65, rate: 0.98 }; // 沒有男聲：同一個聲音、音調壓低
  }
  return { voice: female, pitch: 1.12, rate: 1.0 };
}

const clean = (text) => String(text).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();

/** 有沒有辦法念（瀏覽器支援語音）。 */
export const canSpeak = () => ok;

// 瀏覽器規定：使用者還沒點過畫面之前，網頁不能自己出聲。
// 這時候要念的先記著，等第一次點畫面（或按鍵）就馬上念。
let interacted = false, pending = null;
const touched = () => (navigator.userActivation ? navigator.userActivation.hasBeenActive : interacted);
if (ok) {
  const mark = () => { interacted = true; };
  ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, mark, { capture: true, passive: true }));
  const replay = () => { if (pending) { const p = pending; pending = null; speakLines(p.lines, p.opts); } };
  ['click', 'keydown'].forEach((t) => document.addEventListener(t, replay)); // 不用 touchend：它比 click 早，對話框會以為已經念過、直接跳下一句
}
/** 現在念得出來嗎（使用者點過畫面了）。 */
export const unlocked = () => ok && touched();

let token = 0;
/** 停下正在念的。 */
export function stopSpeaking() {
  token++;
  if (ok) speechSynthesis.cancel();
}

/**
 * 依序念一串台詞 [{ who, text }]。每一句開始時呼叫 onLine(i)，全部念完（或被停下）時呼叫 onDone(finished)。
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
    (text.match(/[^。！？!?；;]+[。！？!?；;」』）)]*/g) || [text]).forEach((s, j) => { if (s.trim()) parts.push({ i, first: j === 0, who: l.who, text: s.trim() }); });
  });
  let n = 0;
  const next = () => {
    if (mine !== token) return;
    if (n >= parts.length) { onDone(true); return; }
    const p = parts[n++];
    if (p.first) onLine(p.i);
    const u = new SpeechSynthesisUtterance(p.text);
    const { voice, pitch, rate } = pickVoice(p.who);
    u.lang = voice?.lang || 'zh-TW';
    if (voice) u.voice = voice;
    u.pitch = pitch;
    u.rate = rate;
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
  next();
}

/** 念一句。 */
export function speak(text, who, opts) { speakLines([{ who, text }], opts); }
