// 科學隊長與好奇博士的對話框：打字機效果、點一下繼續、可以帶按鈕，也可以用瀏覽器的語音念出來。
import { speak as say, stopSpeaking, canSpeak, unlocked } from './speech.js';

const STORE_KEY = 'kidsci-universe-guide';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 預設會念出來（小朋友可能還不認得字）；按 🔊 關掉之後才記住「不要念」
function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    if (!saved.voiceChosen) delete saved.voice; // 以前存的「不念」是舊的預設值，不是小朋友自己選的
    return { on: true, voice: true, ...saved };
  } catch { return { on: true, voice: true }; }
}

export function createGuide({ root, cast }) {
  const prefs = loadPrefs();
  let queue = [];
  let line = null;
  let typed = 0;
  let timer = null;
  let onEmpty = null;

  root.innerHTML = `
    <img class="guide-avatar" alt="">
    <div class="guide-body">
      <p class="guide-name"></p>
      <p class="guide-text"></p>
      <div class="guide-actions"></div>
    </div>
    <div class="guide-tools">
      <button type="button" class="guide-voice" aria-pressed="false" aria-label="念給我聽">🔈</button>
      <button type="button" class="guide-close" aria-label="先不要說話">✕</button>
    </div>
    <span class="guide-next" aria-hidden="true">點一下繼續 ▸</span>`;
  const $ = (sel) => root.querySelector(sel);
  const voiceBtn = $('.guide-voice');

  function savePrefs() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(prefs)); } catch { /* 停用儲存時照樣能用 */ }
    voiceBtn.setAttribute('aria-pressed', String(prefs.voice));
    voiceBtn.textContent = prefs.voice ? '🔊' : '🔈';
  }

  // 念完一句（沒有按鈕要選）就自己往下一句，不用認字、不用一直點
  let heard = false;
  function speak(text, who) {
    heard = false;
    if (!prefs.voice) return;
    const current = line;
    // 還不能出聲（還沒點過畫面）：喇叭一閃一閃，提示點一下就會念
    root.classList.toggle('waiting', canSpeak() && !unlocked());
    say(text, who, {
      onLine: () => { heard = true; root.classList.remove('waiting'); },
      onDone: (finished) => {
        root.classList.remove('waiting');
        if (!finished) heard = true; // 念不出來（裝置沒有語音）：點一下照常往下一句
        if (!finished || line !== current || root.hidden || current.actions?.length) return;
        setTimeout(() => { if (line === current && !root.hidden) { if (!root.classList.contains('typed')) finishTyping(); nextLine(); } }, 900);
      },
    });
  }

  function show(next) {
    line = next;
    typed = 0;
    const who = cast[line.who] || cast.captain;
    root.hidden = false;
    root.dataset.who = line.who;
    $('.guide-avatar').src = who.avatar;
    $('.guide-avatar').alt = who.name;
    $('.guide-name').textContent = who.name;
    $('.guide-actions').innerHTML = '';
    root.classList.remove('typed');
    root.classList.add('bounce');
    setTimeout(() => root.classList.remove('bounce'), 400);
    speak(line.text, line.who);
    clearInterval(timer);
    if (reduceMotion) { finishTyping(); return; }
    timer = setInterval(() => {
      typed += 1;
      $('.guide-text').textContent = [...line.text].slice(0, typed).join('');
      if (typed >= [...line.text].length) finishTyping();
    }, 32);
  }

  function finishTyping() {
    clearInterval(timer);
    $('.guide-text').textContent = line.text;
    root.classList.add('typed');
    if (line.actions?.length) {
      $('.guide-actions').innerHTML = line.actions.map((a, i) => `<button type="button" class="guide-action" data-i="${i}">${a.label}</button>`).join('');
    }
  }

  function advance() {
    if (!line) return;
    if (!root.classList.contains('typed')) { finishTyping(); return; }
    if (line.actions?.length) return; // 有按鈕的台詞要選一個才會繼續
    nextLine();
  }

  // 頻道卡、實驗、航行日誌開著時，背後的畫面按不到：台詞先排隊，等它關掉再說
  let waiting = false;
  function openDialog() { return document.querySelector('dialog[open]'); }
  function waitForDialog() {
    if (waiting) return;
    waiting = true;
    const check = () => {
      if (openDialog()) { setTimeout(check, 250); return; }
      waiting = false;
      if (!line && queue.length) nextLine();
    };
    setTimeout(check, 250);
  }

  function nextLine() {
    if (queue.length && openDialog()) { hide(); waitForDialog(); return; }
    if (queue.length) { show(queue.shift()); return; }
    hide();
    const done = onEmpty;
    onEmpty = null;
    done?.();
  }

  function hide() {
    clearInterval(timer);
    line = null;
    root.hidden = true;
    stopSpeaking();
  }

  root.addEventListener('click', (ev) => {
    const action = ev.target.closest('.guide-action');
    if (action) {
      const a = line.actions[Number(action.dataset.i)];
      line = { ...line, actions: [] };
      nextLine();
      a.run?.();
      return;
    }
    if (ev.target.closest('.guide-close')) { queue = []; onEmpty = null; hide(); return; }
    if (ev.target.closest('.guide-voice')) {
      prefs.voice = !prefs.voice;
      prefs.voiceChosen = true;
      savePrefs();
      if (prefs.voice && line) speak(line.text, line.who);
      else stopSpeaking();
      return;
    }
    // 還沒聽到這一句（網頁剛打開、還不能出聲）：第一次點是「念給我聽」，不是跳到下一句
    if (prefs.voice && canSpeak() && line && !heard) { speak(line.text, line.who); return; }
    advance();
  });
  root.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === root) { ev.preventDefault(); advance(); }
  });
  if (!canSpeak()) voiceBtn.hidden = true;
  savePrefs();

  return {
    get voice() { return prefs.voice; },
    /** 排進一串台詞；urgent=true 會先清掉還沒說的台詞；同一個 topic 的新台詞會換掉舊的。 */
    say(lines, { urgent = false, then, topic } = {}) {
      if (!prefs.on || !lines?.length) { then?.(); return; }
      if (urgent) queue = [];
      if (topic) {
        queue = queue.filter((l) => l.topic !== topic);
        lines = lines.map((l) => ({ ...l, topic }));
      }
      queue.push(...lines);
      if (then) onEmpty = then;
      if (!line || urgent || (topic && line.topic === topic)) nextLine();
    },
    busy: () => Boolean(line),
    get on() { return prefs.on; },
    set on(value) { prefs.on = value; savePrefs(); if (!value) { queue = []; hide(); } },
  };
}
