// 全站朗讀使用科學隊長女聲：優先播放網站音檔，未錄製的動態文字才使用華語女聲。
import { pickCaptainVoice } from './speech-voices.js';
import { narrationReady } from './narration-audio.js';
const nativeOK = typeof window !== 'undefined' && 'speechSynthesis' in window;
const audio = typeof Audio !== 'undefined' ? new Audio() : null;
if (audio) { audio.preload = 'auto'; audio.volume = 1; }
const ok = Boolean(audio || nativeOK);
let voiceTimer = null;
let activeSession = null;
let activeUtterance = null; // 某些行動瀏覽器必須保留 utterance 參照，才能持續發聲。
const clean = (text) => String(text).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();

export const canSpeak = () => ok;
let interacted = false, pending = null, lastReplay = null;
const touched = () => (navigator.userActivation ? navigator.userActivation.hasBeenActive : interacted);
if (ok) {
  const mark = () => { interacted = true; };
  ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, mark, { capture: true, passive: true }));
  const replay = (ev) => { if (pending) { const p = pending; pending = null; lastReplay = ev; speakLines(p.lines, p.opts); } };
  ['click', 'keydown'].forEach((t) => document.addEventListener(t, replay));
}
export const replayedBy = (ev) => lastReplay === ev;
export const unlocked = () => ok && touched();
let token = 0;

export function stopSpeaking() {
  const previous = activeSession;
  activeSession = null;
  token++;
  pending = null;
  clearTimeout(voiceTimer);
  voiceTimer = null;
  if (audio) {
    audio.onplaying = audio.onended = audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  if (nativeOK) speechSynthesis.cancel();
  activeUtterance = null;
  previous?.onState('idle');
}

/** 暫停與繼續保留目前的介紹位置，不會從頭重播。 */
export function pauseSpeaking() {
  if (!activeSession || activeSession.paused) return false;
  activeSession.paused = true;
  if (activeSession.kind === 'audio') audio.pause();
  else if (nativeOK) speechSynthesis.pause();
  activeSession.onState('paused');
  return true;
}
export function resumeSpeaking() {
  if (!activeSession?.paused) return false;
  const session = activeSession;
  session.paused = false;
  if (session.resume) { const next = session.resume; session.resume = null; next(); }
  else if (session.kind === 'audio') audio.play().catch(() => session.fail());
  else if (nativeOK) { speechSynthesis.resume(); session.onState('playing'); }
  return true;
}

/** 用同一位科學隊長女聲朗讀；只有實際開始發聲才呼叫 onLine。 */
export function speakLines(lines, { onLine = () => {}, onDone = () => {}, onState = () => {} } = {}) {
  stopSpeaking();
  if (!ok || !lines.length) { onDone(false); return; }
  if (!touched()) { pending = { lines, opts: { onLine, onDone, onState } }; return; }
  const mine = token;
  const session = activeSession = { paused: false, kind: null, resume: null, onState, fail: null };
  const emit = (state) => { if (mine === token) onState(state); };
  emit('loading');
  const retry = () => {
    if (mine !== token) return;
    stopSpeaking();
    pending = { lines, opts: { onLine, onDone, onState } };
    onDone(false);
  };
  const fail = () => {
    if (mine !== token) return;
    stopSpeaking();
    onDone(false);
    document.dispatchEvent(new CustomEvent('kidsci-speech-unavailable'));
  };

  session.fail = fail;
  narrationReady.then((clips) => {
    if (mine !== token) return;
    const parts = [];
    lines.forEach((line, i) => {
      const text = clean(line.text);
      if (!text) return;
      if (audio && clips.has(text)) parts.push({ i, first: true, text, clip: clips.get(text) });
      else (text.match(/[^。！？!?；;]+[。！？!?；;」』）)]*/g) || [text]).forEach((s, j) => {
        if (s.trim()) parts.push({ i, first: j === 0, text: s.trim() });
      });
    });
    let n = 0;
    const next = () => {
      if (mine !== token) return;
      if (session.paused) { session.resume = next; return; }
      if (n >= parts.length) { activeSession = null; activeUtterance = null; emit('idle'); onDone(true); return; }
      const part = parts[n++];
      emit('loading');
      if (part.clip) {
        session.kind = 'audio';
        let started = false, failed = false;
        const fallback = () => {
          if (failed || mine !== token) return;
          failed = true;
          audio.onplaying = audio.onended = audio.onerror = null;
          audio.pause();
          native(part);
        };
        audio.onplaying = () => {
          if (mine !== token) return;
          emit('playing');
          if (!started && part.first) onLine(part.i);
          started = true;
        };
        audio.onended = next;
        audio.onerror = fallback;
        audio.src = part.clip;
        audio.muted = false;
        audio.play().catch((error) => {
          if (mine !== token) return;
          if (error.name === 'NotAllowedError') retry();
          else fallback();
        });
      } else native(part);
    };
    const native = (part) => {
      if (mine !== token) return;
      session.kind = 'native';
      if (!nativeOK) { fail(); return; }
      const deadline = Date.now() + 4000;
      const start = () => {
        if (mine !== token) return;
        const available = speechSynthesis.getVoices();
        if (!available.length && Date.now() < deadline) { voiceTimer = setTimeout(start, 100); return; }
        voiceTimer = null;
        const voice = pickCaptainVoice(available);
        if (!voice) { fail(); return; }
        const u = activeUtterance = new SpeechSynthesisUtterance(part.text);
        u.lang = 'zh-TW'; u.voice = voice; u.pitch = 1; u.rate = 1;
        const guard = setTimeout(fail, 5000);
        u.onstart = () => { clearTimeout(guard); emit('playing'); if (mine === token && part.first) onLine(part.i); };
        u.onend = () => { clearTimeout(guard); next(); };
        u.onerror = (event) => {
          clearTimeout(guard);
          if (mine !== token) return;
          if (event?.error === 'not-allowed') retry(); else fail();
        };
        if (speechSynthesis.paused) speechSynthesis.resume();
        speechSynthesis.speak(u);
      };
      start();
    };
    next();
  });
}
export function speak(text, opts) { speakLines([{ text }], opts); }
