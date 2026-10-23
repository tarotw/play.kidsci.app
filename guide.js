// 科學隊長與好奇博士的對話框：打字機效果、點一下繼續、可以帶按鈕，也可以用瀏覽器的語音念出來。
const STORE_KEY = 'kidsci-universe-guide';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadPrefs() {
  try { return { on: true, voice: false, ...(JSON.parse(localStorage.getItem(STORE_KEY)) || {}) }; }
  catch { return { on: true, voice: false }; }
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

  function speak(text, who) {
    if (!prefs.voice || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
    u.lang = 'zh-TW';
    u.pitch = cast[who]?.pitch ?? 1;
    u.rate = cast[who]?.rate ?? 1;
    const voice = speechSynthesis.getVoices().find((v) => v.lang === 'zh-TW') || speechSynthesis.getVoices().find((v) => v.lang.startsWith('zh'));
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
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

  function nextLine() {
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
    if ('speechSynthesis' in window) speechSynthesis.cancel();
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
      savePrefs();
      if (prefs.voice && line) speak(line.text, line.who);
      else if ('speechSynthesis' in window) speechSynthesis.cancel();
      return;
    }
    advance();
  });
  root.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === root) { ev.preventDefault(); advance(); }
  });
  savePrefs();

  return {
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
