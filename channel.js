// 宇宙好好聽：頻道卡、播放器、實驗、航行日誌。萬物旋鈕版（app.js）與放大縮小版（zoom.js）共用。
import { iconFor } from './explorer.js';

const LAB_ORIGIN = 'https://lab.kidsci.app';
const LAB_STAMP_SECONDS = 60;

const $ = (sel) => document.querySelector(sel);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function stateBadge(e) {
  if (e.state === 'subscriber') return '<span class="badge vip">👑 VIP・請大人幫忙</span>';
  return '<span class="badge can">▶ 可以聽</span>';
}

/**
 * byCode：代碼 → 集數；lines：dialogue.json；getStamps()：目前的星章；
 * addStamp(kind, code)：蓋章（seen／ear／hand）；onOpen(code)：打開頻道卡時；onClear()：清除航行日誌。
 */
export function createChannels({ byCode, lines, getStamps, addStamp, onOpen = () => {}, onClear = () => {} }) {
  let labTimer = null;
  let playing = null;

  const stampMarks = (code) => {
    const st = getStamps();
    return (st.ear.includes(code) ? '👂' : '') + (st.hand.includes(code) ? '✋' : '');
  };

  // 每次打開、關掉都換一個號碼：還在讀資料時被關掉（或又點了別人），就不要再跳出來
  let openSeq = 0;
  $('#channel').addEventListener('close', () => { openSeq++; });
  async function openChannel(code) {
    const e = byCode.get(code);
    if (!e) return;
    const mine = ++openSeq;
    onOpen(code);
    addStamp('seen', code);
    let content = null;
    if (e.content) {
      try { content = await (await fetch(e.content)).json(); } catch { content = null; }
    }
    if (mine !== openSeq) return;
    const listen = e.listen || {};
    let actions = '';
    if (e.state === 'public' && listen.audio) {
      actions += `<button class="btn" type="button" data-play="${esc(code)}">▶ 在這裡聽</button>`;
    } else if (e.state === 'subscriber') {
      if (listen.firstory) actions += holdLink(listen.firstory, '到 Firstory 收聽', 'gold');
      actions += holdLink(listen.join, '加入 VIP', 'alt');
    }
    actions += e.labs.map((lab) => `<button class="btn alt" type="button" data-lab="${esc(lab.url)}" data-lab-title="${esc(lab.title)}" data-code="${esc(code)}">🧪 ${esc(lab.title)}</button>`).join('');

    // Apple Podcasts 和 Spotify：有連結才列出來（按住打開）
    const platform = (url, icon, name) => (url ? holdLink(url, `${icon} ${name}`, 'alt pf') : '');
    const pf = platform(listen.apple, '🍎', 'Apple Podcasts') + platform(listen.spotify, '🟢', 'Spotify');
    const platforms = pf ? `<div class="platforms" aria-label="在其他平台收聽"><span class="pf-cap">在其他平台收聽</span>${pf}</div>` : '';
    const takeaways = content?.takeaways?.length
      ? `<h3>重點句</h3><ol class="takeaways" id="takeaways">${content.takeaways.map((t) =>
        `<li data-t="${t.t ?? ''}">${esc(t.emoji)} ${esc(t.text)}</li>`).join('')}</ol>` : '';
    const card = content?.card
      ? `<div class="card"><h3>🃏 ${esc(content.card.name)}</h3><p>${esc(content.card.description)}</p><ul>${content.card.knowledge.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>` : '';
    const question = content?.question
      ? `<div class="question"><strong>好奇博士問你：</strong>${esc(content.question.text)}</div>` : '';
    const ask = fill(pick(lines.channel[e.state]), { icon: iconFor(e) });
    const reply = e.state === 'subscriber' ? lines.answers.subscriber
      : e.state === 'unreleased' ? (content?.caption || lines.answers.unreleased)
      : content?.takeaways?.[0]?.text || content?.card?.description
        || (e.labs[0] ? `這一集有實驗「${e.labs[0].title}」可以玩：${e.labs[0].question}` : lines.answers.fallback);
    const duo = `<div class="duo">
      <div class="say curious"><img src="${lines.cast.curious.avatar}" alt="${lines.cast.curious.name}"><p>${esc(ask)}</p></div>
      <div class="say captain"><img src="${lines.cast.captain.avatar}" alt="${lines.cast.captain.name}"><p>${esc(reply)}</p></div></div>`;
    const note = e.state === 'subscriber'
      ? '<p class="hint">訂閱者限定頻道。按住按鈕 2 秒（請大人幫忙）才會打開 Firstory。實驗一樣可以玩。</p>'
      : e.state === 'unreleased' ? `<p class="hint">🔒 神秘訊號，即將登場。${esc(content?.caption || '')}</p>` : '';

    $('#channel').innerHTML = `<div class="inner">
      <button class="close" type="button" data-close aria-label="關閉">✕</button>
      <p class="hero" aria-hidden="true">${e.state === 'unreleased' ? '❔' : iconFor(e)}</p>
      <h2 id="ch-title">${esc(e.title)}</h2>
      <p class="hint">${esc(code)} 台 ${stateBadge(e)} ${stampMarks(code)}</p>
      ${duo}${note}${actions ? `<div class="actions">${actions}</div>` : ''}${platforms}${takeaways}${card}${question}</div>`;
    if (!$('#channel').open) $('#channel').showModal();
    const params = new URLSearchParams(location.search);
    params.set('ch', code);
    history.replaceState(null, '', `?${params}`);
  }

  function holdLink(url, label, style) {
    return `<button class="btn ${style} hold" type="button" data-hold="${esc(url)}"><span class="fill"></span><span class="label">${esc(label)}（按住）</span></button>`;
  }

  // 「請大人幫忙」：按住 2 秒，放開的那一下才開外部連結。
  // 放開是使用者的手勢，Safari 才不會把新分頁當成彈出視窗擋掉。
  function bindHold(root) {
    let held = null;
    const label = (btn) => btn.querySelector('.label');
    const stop = () => {
      if (!held) return;
      clearTimeout(held.timer);
      held.btn.classList.remove('holding', 'ready');
      label(held.btn).textContent = held.text;
      held = null;
    };
    const start = (btn) => {
      stop();
      btn.classList.add('holding');
      const h = { btn, ready: false, text: label(btn).textContent };
      h.timer = setTimeout(() => { h.ready = true; btn.classList.add('ready'); label(btn).textContent = '放開就打開 ✓'; }, 2000);
      held = h;
    };
    const finish = () => {
      if (held?.ready) window.open(held.btn.dataset.hold, '_blank', 'noopener');
      stop();
    };
    root.addEventListener('pointerdown', (ev) => { const b = ev.target.closest('[data-hold]'); if (b) start(b); });
    root.addEventListener('pointerup', finish);
    root.addEventListener('pointercancel', stop);
    root.addEventListener('pointerleave', (ev) => { if (held && ev.target === held.btn) stop(); }, true);
    root.addEventListener('contextmenu', (ev) => { if (ev.target.closest('[data-hold]')) ev.preventDefault(); }); // 長按不要跳出選單
    root.addEventListener('keydown', (ev) => { const b = ev.target.closest('[data-hold]'); if (b && (ev.key === 'Enter' || ev.key === ' ') && !ev.repeat) { ev.preventDefault(); start(b); } });
    root.addEventListener('keyup', (ev) => { if (ev.target.closest('[data-hold]') && (ev.key === 'Enter' || ev.key === ' ')) finish(); });
  }

  // ---------- 播放器 ----------
  async function play(code) {
    const e = byCode.get(code);
    const audio = $('#audio');
    const now = { code, takeaways: [] };
    playing = now;
    audio.src = e.listen.audio;
    $('#now-title').textContent = `${code} 台｜${e.title}`;
    $('#now-takeaway').textContent = '';
    $('#player').hidden = false;
    document.body.classList.add('has-player');
    audio.play().catch(() => {}); // 被瀏覽器擋下時，下面的播放鍵還在，按一下就能聽
    if ('mediaSession' in navigator && typeof MediaMetadata === 'function') {
      navigator.mediaSession.metadata = new MediaMetadata({ title: e.title, artist: '科學好好聽', album: '宇宙好好聽' });
    }
    if (e.content) {
      try { const t = (await (await fetch(e.content)).json()).takeaways || []; if (playing === now) now.takeaways = t; } catch { /* 沒有重點句也能聽 */ }
    }
  }
  function onTime() {
    const audio = $('#audio');
    if (!playing) return;
    const now = audio.currentTime;
    const current = [...playing.takeaways].reverse().find((t) => t.t != null && now >= t.t);
    $('#now-takeaway').textContent = current ? `${current.emoji} ${current.text}` : '';
    document.querySelectorAll('#takeaways li').forEach((li) => li.classList.toggle('on', current && Number(li.dataset.t) === current.t));
    if (audio.duration && now / audio.duration >= 0.8) addStamp('ear', playing.code);
  }

  // ---------- 實驗 ----------
  function openLab(url, title, code) {
    $('#lab-title').textContent = title;
    $('#lab-frame').src = url;
    $('#lab').dataset.code = code;
    $('#lab').showModal();
    clearTimeout(labTimer);
    labTimer = setTimeout(() => addStamp('hand', code), LAB_STAMP_SECONDS * 1000);
  }
  function closeLab() {
    clearTimeout(labTimer);
    $('#lab-frame').src = 'about:blank';
    $('#lab').close();
  }

  // ---------- 航行日誌 ----------
  function openJournal() {
    const st = getStamps();
    const line = (code) => { const e = byCode.get(code); return e ? `<li><button type="button" class="jl" data-open-ch="${esc(code)}">${iconFor(e)} ${esc(code)} 台｜${esc(e.title)}</button></li>` : ''; };
    $('#journal').innerHTML = `<div class="inner">
      <button class="close" type="button" data-close aria-label="關閉">✕</button>
      <h2 id="journal-title">📔 航行日誌</h2>
      <p>👂 耳朵章 ${st.ear.length} 枚 · ✋ 小手章 ${st.hand.length} 枚 · 🏅 任務勳章 ${st.missions.length} 枚 · 🧠 猜對 ${st.guess} 題 · 🔭 拜訪過 ${st.seen.length} 台</p>
      <h3>聽過的頻道</h3><ul>${st.ear.map(line).join('') || '<li class="hint">還沒有，找一個發光的東西聽聽看！</li>'}</ul>
      <h3>做過的實驗</h3><ul>${st.hand.map(line).join('') || '<li class="hint">還沒有</li>'}</ul>
      <button class="btn alt" type="button" id="clear-stamps">清除航行日誌</button></div>`;
    $('#journal').showModal();
  }

  // ---------- 事件 ----------
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    const playBtn = t.closest('[data-play]');
    if (playBtn) { play(playBtn.dataset.play); return; }
    const lab = t.closest('[data-lab]');
    if (lab) { openLab(lab.dataset.lab, lab.dataset.labTitle, lab.dataset.code); return; }
    if (t.closest('[data-close]')) { t.closest('dialog').close(); return; }
    const again = t.closest('[data-open-ch]'); // 航行日誌：點一台再打開它
    if (again) { $('#journal').close(); openChannel(again.dataset.openCh); return; }
    if (t.id === 'clear-stamps' && confirm('要清除全部的星章和紀錄嗎？清除後就找不回來了。')) { onClear(); $('#journal').close(); }
  });
  $('#channel').addEventListener('close', () => {
    const params = new URLSearchParams(location.search);
    params.delete('ch');
    history.replaceState(null, '', params.toString() ? `?${params}` : location.pathname);
  });
  $('#lab-close').addEventListener('click', closeLab);
  $('#lab').addEventListener('cancel', closeLab);
  $('#audio').addEventListener('timeupdate', onTime);
  window.addEventListener('message', (ev) => {
    // lab 頁面加上 kidsci-bridge.js 後，第一次有意義的操作會送 {type: 'kidsci-lab-done'}。
    if (ev.origin === LAB_ORIGIN && ev.data?.type === 'kidsci-lab-done' && $('#lab').open) addStamp('hand', $('#lab').dataset.code);
  });
  bindHold(document);

  return { openChannel, openJournal, stampMarks };
}
