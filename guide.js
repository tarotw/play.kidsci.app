// 科學隊長的導覽對話框：打字機效果、點一下繼續、可以帶按鈕，也可以用瀏覽器的語音念出來。
import { speak as say, stopSpeaking, pauseSpeaking, resumeSpeaking, canSpeak } from './speech.js';

const STORE_KEY = 'kidsci-universe-guide';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 介紹一律由孩子點圖像播放；只保留是否顯示導覽的偏好。
function loadPrefs() {
  try { return { on: true, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}'), voice: false }; }
  catch { return { on: true, voice: false }; }
}

export function createGuide({ root, cast }) {
  const prefs = loadPrefs();
  let queue = [];
  let line = null;
  let typed = 0;
  let timer = null;
  let onEmpty = null;
  let pages = null, pageIndex = 0, pageDone = null;

  root.innerHTML = `
    <button type="button" class="captain-play guide-avatar-play" aria-label="播放科學隊長介紹" aria-pressed="false">
      <img class="guide-avatar" alt=""><span class="captain-play-icon" aria-hidden="true">▶</span>
    </button>
    <div class="guide-body">
      <p class="guide-name"></p>
      <h2 class="guide-page-title" hidden></h2>
      <p class="guide-text"></p>
      <div class="guide-actions"></div>
    </div>
    <div class="guide-tools">
      <button type="button" class="guide-close" aria-label="關閉科學隊長介紹">✕</button>
    </div>
    <nav class="guide-pagination" aria-label="玩法說明分頁" hidden>
      <button type="button" data-guide-prev aria-label="上一頁玩法說明">← 上一頁</button>
      <span data-guide-page aria-live="polite"></span>
      <button type="button" data-guide-next>下一頁 ➜</button>
    </nav>
    <span class="guide-next" aria-hidden="true">點一下繼續 ▸</span>`;
  const $ = (sel) => root.querySelector(sel);
  const voiceBtn = $('.guide-avatar-play');
  root.setAttribute('aria-label', '科學隊長');
  let voiceState = 'idle';
  function renderVoice(state) {
    voiceState = state;
    const playing = state === 'playing';
    voiceBtn.disabled = state === 'loading';
    voiceBtn.setAttribute('aria-pressed', String(playing));
    voiceBtn.setAttribute('aria-label', playing ? '暫停科學隊長介紹' : state === 'paused' ? '繼續科學隊長介紹' : '播放科學隊長介紹');
    voiceBtn.querySelector('.captain-play-icon').textContent = playing ? 'Ⅱ' : state === 'loading' ? '…' : '▶';
  }
  function savePrefs() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ on: prefs.on, voice: false })); } catch { /* 停用儲存時照樣能用 */ }
  }
  function speak(text) {
    const current = line;
    say(text, {
      onState: (state) => { if (line === current && !root.hidden) renderVoice(state); },
      onDone: () => { if (line === current && !root.hidden) { renderVoice('idle'); finishTyping(); } },
    });
  }

  function show(next) {
    stopSpeaking();
    renderVoice('idle');
    line = { ...next, who: 'captain' };
    typed = 0;
    const who = cast[line.who] || cast.captain;
    root.hidden = false;
    root.dataset.who = line.who;
    $('.guide-avatar').src = who.avatar;
    $('.guide-avatar').alt = '';
    $('.guide-name').textContent = who.name;
    $('.guide-page-title').hidden = !line.title;
    $('.guide-page-title').textContent = line.title || '';
    $('.guide-close').setAttribute('aria-label', pages ? '關閉玩法說明' : '關閉科學隊長介紹');
    root.classList.toggle('paged', Boolean(pages));
    $('.guide-pagination').hidden = !pages;
    if (pages) {
      root.dataset.page = pageIndex + 1;
      $('[data-guide-prev]').disabled = pageIndex === 0;
      $('[data-guide-page]').textContent = `${pageIndex + 1} / ${pages.length}`;
      $('[data-guide-page]').setAttribute('aria-label', `第 ${pageIndex + 1} 頁，共 ${pages.length} 頁`);
      $('[data-guide-next]').textContent = pageIndex === pages.length - 1 ? '🚀 出發探險' : '下一頁 ➜';
      $('[data-guide-next]').setAttribute('aria-label', pageIndex === pages.length - 1 ? '看完玩法，選一座島出發' : '下一頁玩法說明');
    }
    $('.guide-actions').innerHTML = '';
    root.classList.remove('typed');
    root.classList.add('bounce');
    setTimeout(() => root.classList.remove('bounce'), 400);
    clearInterval(timer);
    if (reduceMotion || pages) { finishTyping(); return; }
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
    if (pages) return; // 分頁只由明確的上一頁／下一頁按鈕切換，點文字不會跳頁。
    if (!root.classList.contains('typed')) { finishTyping(); return; }
    if (line.actions?.length) return; // 有按鈕的台詞要選一個才會繼續
    nextLine();
  }

  // 打開播放器／視窗就清掉導覽，不在背景排隊，也不在關閉後突然續播。
  function openDialog() { return document.querySelector('dialog[open]'); }
  function dismiss() { queue = []; onEmpty = null; if (line || !root.hidden) hide(); }
  document.addEventListener('kidsci-story-open', dismiss);
  new MutationObserver(() => { if (openDialog()) dismiss(); })
    .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });

  function nextLine() {
    if (openDialog()) { dismiss(); return; }
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
    pages = null; pageDone = null;
    root.classList.remove('paged');
    delete root.dataset.page;
    $('.guide-pagination').hidden = true;
    stopSpeaking();
  }

  function turnPage(delta) {
    if (!pages) return;
    const next = pageIndex + delta;
    if (next < 0) return;
    if (next >= pages.length) {
      const done = pageDone;
      dismiss();
      done?.();
      return;
    }
    pageIndex = next;
    show(pages[pageIndex]); // 換頁結束上一頁語音；新頁仍由孩子點隊長播放。
  }

  root.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-guide-prev]')) { turnPage(-1); return; }
    if (ev.target.closest('[data-guide-next]')) { turnPage(1); return; }
    const action = ev.target.closest('.guide-action');
    if (action) {
      const a = line.actions[Number(action.dataset.i)];
      line = { ...line, actions: [] };
      nextLine();
      a.run?.();
      return;
    }
    if (ev.target.closest('.guide-close')) { queue = []; onEmpty = null; hide(); return; }
    if (ev.target.closest('.guide-avatar-play')) {
      if (!line) return;
      if (voiceState === 'playing') pauseSpeaking();
      else if (voiceState === 'paused') resumeSpeaking();
      else speak(line.text);
      return;
    }
    advance();
  });
  root.addEventListener('keydown', (ev) => {
    if (pages && ev.target === root && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
      ev.preventDefault(); turnPage(ev.key === 'ArrowLeft' ? -1 : 1); return;
    }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === root) { ev.preventDefault(); advance(); }
  });
  if (!canSpeak()) voiceBtn.hidden = true;
  savePrefs();

  return {
    dismiss,
    showPages(items, { onDone } = {}) {
      if (openDialog() || !prefs.on || !items?.length) return;
      dismiss();
      pages = items; pageIndex = 0; pageDone = onDone;
      show(pages[pageIndex]);
    },
    /** 排進一串台詞；urgent=true 會先清掉還沒說的台詞；同一個 topic 的新台詞會換掉舊的。 */
    say(lines, { urgent = false, then, topic } = {}) {
      if (openDialog()) return;
      if (!prefs.on || !lines?.length) { then?.(); return; }
      if (pages) dismiss();
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
