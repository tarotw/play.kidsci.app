// 宇宙好好聽：頻道卡（介紹對話＋到 Apple Podcasts、Spotify 收聽）、實驗、航行日誌。萬物旋鈕版（app.js）與放大縮小版（zoom.js）共用。
import { iconFor } from './explorer.js';
import { speakLines, stopSpeaking, pauseSpeaking, resumeSpeaking, canSpeak } from './speech.js';

import { shortIntro } from './episode-intro.js';
import { episodeArtwork, episodeMeta } from './episode-profile.js';

const LAB_ORIGIN = 'https://lab.kidsci.app';
const LAB_STAMP_SECONDS = 60;

const $ = (sel) => document.querySelector(sel);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function stateBadge(e) {
  if (e.state === 'subscriber') return '<span class="badge vip">👑 VIP</span>';
  return '<span class="badge can">▶ 可以聽</span>';
}

/**
 * byCode：代碼 → 集數；lines：dialogue.json；getStamps()：目前的星章；
 * addStamp(kind, code)：蓋章（seen／ear／hand）；onOpen(code)：打開頻道卡時；onClear()：清除航行日誌。
 */
export function createChannels({ byCode, lines, getStamps, addStamp, onOpen = () => {}, onClear = () => {} }) {
  let labTimer = null;

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
    stopTalk();
    $('#channel .embed iframe')?.remove();
    document.dispatchEvent(new CustomEvent('kidsci-story-open'));
    onOpen(code);
    addStamp('seen', code);
    let content = null;
    if (e.content) {
      try { content = await (await fetch(e.content)).json(); } catch { content = null; }
    }
    if (mine !== openSeq) return;
    const listen = e.listen || {};
    // 收聽：Apple Podcasts、Spotify（點一下就在新分頁打開）
    const platform = (url, icon, name, cls) => (url ? `<a class="btn pf ${cls}" href="${esc(url)}" target="_blank" rel="noopener" data-ear="${esc(code)}">${icon} ${esc(name)}</a>` : '');
    const pf = platform(listen.apple, '🍎', 'Apple Podcasts', 'apple') + platform(listen.spotify, '🟢', 'Spotify', 'spotify');
    // 免費的集數：卡片裡直接放 Apple Podcasts 的播放器（音檔從 Firstory 播，算進 Firstory 的下載數）
    const embedUrl = e.state === 'public' ? appleEmbed(listen.apple) : null;
    podcastUrl = embedUrl;
    podcastTitle = e.title;
    podcastArtwork = episodeArtwork(e);
    const embed = embedUrl ? '<div class="embed" data-podcast-host></div>' : '';
    const cap = embedUrl ? '📱 到 App 收聽，按「追蹤」新的一集就會自己出現' : '🎧 收聽這一集';
    const platforms = pf ? `<div class="platforms" aria-label="收聽這一集"><span class="pf-cap">${cap}</span>${pf}</div>` : '';
    const labs = e.labs.map((lab) => `<button class="btn alt" type="button" data-lab="${esc(lab.url)}" data-lab-title="${esc(lab.title)}" data-code="${esc(code)}">🧪 ${esc(lab.title)}</button>`).join('');
    const takeaways = content?.takeaways?.length
      ? `<h3>重點句</h3><ol class="takeaways" id="takeaways">${content.takeaways.map((t) =>
        `<li>${esc(t.emoji)} ${esc(t.text)}</li>`).join('')}</ol>` : '';
    const card = content?.card
      ? `<div class="card"><h3>🃏 ${esc(content.card.name)}</h3><p>${esc(content.card.description)}</p><ul>${content.card.knowledge.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>` : '';
    const question = content?.question
      ? `<div class="question"><strong>科學隊長問你：</strong>${esc(content.question.text)}</div>` : '';
    talk = shortIntro(e, content);
    currentCode = code;
    const captain = lines.cast.captain;
    const avatar = canSpeak() ? `<button type="button" class="captain-play" data-talk aria-label="播放科學隊長介紹" aria-pressed="false">
      <img src="${esc(captain.avatar)}" alt=""><span class="captain-play-icon" aria-hidden="true">▶</span></button>`
      : `<img class="captain-still" src="${esc(captain.avatar)}" alt="科學隊長">`;
    const intro = `<div class="captain-intro">${avatar}<div><p class="captain-intro-label">科學隊長的小介紹</p><p class="captain-intro-text">${esc(talk)}</p>
      <p class="captain-intro-status" data-intro-status role="status">點隊長圖像，聽她說故事</p></div></div>`;

    $('#channel').innerHTML = `<div class="inner">
      <button class="close" type="button" data-close aria-label="關閉">✕</button>
      <header class="episode-profile">
        <img class="episode-cover" src="${esc(episodeArtwork(e))}" alt="${esc(e.title)}的單集封面" width="120" height="120" decoding="async">
        <div class="episode-profile-copy"><p class="episode-show">科學好好聽 · 單集預覽</p>
          <h2 id="ch-title">${esc(e.title)}</h2>
          <p class="episode-meta">${esc(episodeMeta(e))}</p>
          <p class="hint">${iconFor(e)} ${esc(code)} 台 ${stateBadge(e)} ${stampMarks(code)}</p>
        </div>
      </header>
      ${intro}${embed}${platforms}${labs ? `<div class="actions">${labs}</div>` : ''}${takeaways}${card}${question}</div>`;
    $('#channel .episode-cover').addEventListener('error', (event) => {
      event.currentTarget.src = 'assets/logo-square.jpg';
      event.currentTarget.alt = '科學好好聽節目封面';
    }, { once: true });
    if (!$('#channel').open) $('#channel').showModal();
    mountPodcast(); // 故事卡保持安靜；介紹只由孩子點隊長圖像播放。
    const params = new URLSearchParams(location.search);
    params.set('ch', code);
    history.replaceState(null, '', `?${params}`);
  }

  // Apple Podcasts 單集網址 → 內嵌播放器網址（同一條路徑，換成 embed 的主機）
  function appleEmbed(url) {
    try {
      const u = new URL(url);
      if (u.hostname !== 'podcasts.apple.com' || !u.searchParams.get('i')) return null;
      u.hostname = 'embed.podcasts.apple.com';
      u.searchParams.set('theme', 'light');
      return u.toString();
    } catch { return null; }
  }
  // 按了內嵌播放器（焦點跑進 iframe）：停下科學隊長的朗讀、蓋耳朵章
  window.addEventListener('blur', () => {
    setTimeout(() => {
      const f = document.activeElement;
      if (f?.tagName === 'IFRAME' && f.closest('#channel .embed') && $('#channel').open) {
        stopTalk();
        if (currentCode) addStamp('ear', currentCode);
      }
    }, 0);
  });

  // ---------- 隊長圖像播放器：手動播放／暫停／繼續，和 Podcast 互斥 ----------
  let talk = '', currentCode = null, podcastUrl = null, podcastTitle = '', podcastArtwork = '';
  let introState = 'idle', introFinished = false, introRun = 0;
  function renderIntro() {
    const button = $('#channel [data-talk]'), status = $('#channel [data-intro-status]');
    if (!button) return;
    const playing = introState === 'playing';
    button.dataset.state = introState;
    button.disabled = introState === 'loading';
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute('aria-label', playing ? '暫停科學隊長介紹' : introState === 'paused' ? '繼續科學隊長介紹' : '播放科學隊長介紹');
    button.querySelector('.captain-play-icon').textContent = playing ? 'Ⅱ' : introState === 'loading' ? '…' : '▶';
    if (status) status.textContent = playing ? '隊長介紹中・點圖像暫停' : introState === 'paused' ? '已暫停・點圖像繼續'
      : introState === 'loading' ? '準備播放…' : introFinished ? '介紹完了・再點一次重聽' : '點隊長圖像，聽她說故事';
  }
  function mountPodcast() {
    const host = $('#channel [data-podcast-host]');
    if (!host || !podcastUrl || host.querySelector('iframe')) return;
    host.innerHTML = `<iframe title="用 Apple Podcasts 收聽：${esc(podcastTitle)}" src="${esc(podcastUrl)}" height="175" loading="lazy"
      allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
      sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"></iframe>`;
  }
  function unmountPodcast() {
    const host = $('#channel [data-podcast-host]');
    if (!host) return;
    host.innerHTML = `<button type="button" class="podcast-return" data-podcast><img class="podcast-return-cover" src="${esc(podcastArtwork)}" alt="" width="72" height="72"><span aria-hidden="true">▶</span><span>聽完整 Podcast<small>播放完整故事</small></span></button>`;
  }
  function playTalk() {
    unmountPodcast(); // 移除跨網域播放器，確實結束另一個聲音，不猜測它是否在播放。
    const mine = ++introRun;
    introFinished = false;
    speakLines([{ text: talk }], {
      onState: (state) => { if (mine === introRun) { introState = state; renderIntro(); } },
      onDone: (finished) => { if (mine === introRun) { introState = 'idle'; introFinished = finished; renderIntro(); } },
    });
  }
  function stopTalk() {
    introRun++;
    stopSpeaking();
    introState = 'idle'; introFinished = false;
    renderIntro();
  }
  function toggleTalk() {
    if (introState === 'playing') pauseSpeaking();
    else if (introState === 'paused') resumeSpeaking();
    else playTalk();
  }

  // ---------- 實驗 ----------
  function openLab(url, title, code) {
    stopTalk();
    unmountPodcast();
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
      <h3>去聽過的故事</h3><ul>${st.ear.map(line).join('') || '<li class="hint">還沒有，找一個發光的東西聽聽看！</li>'}</ul>
      <h3>做過的實驗</h3><ul>${st.hand.map(line).join('') || '<li class="hint">還沒有</li>'}</ul>
      <button class="btn alt" type="button" id="clear-stamps">清除航行日誌</button></div>`;
    $('#journal').showModal();
  }

  // ---------- 事件 ----------
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    const lab = t.closest('[data-lab]');
    if (lab) { openLab(lab.dataset.lab, lab.dataset.labTitle, lab.dataset.code); return; }
    if (t.closest('[data-close]')) { t.closest('dialog').close(); return; }
    if (t.closest('[data-podcast]')) { stopTalk(); mountPodcast(); return; }
    const talkBtn = t.closest('[data-talk]');
    if (talkBtn) { toggleTalk(); return; }
    const ear = t.closest('[data-ear]'); // 點了 Apple／Spotify 去聽：蓋耳朵章（連結本身照常打開）
    if (ear) { stopTalk(); unmountPodcast(); addStamp('ear', ear.dataset.ear); }
    const again = t.closest('[data-open-ch]'); // 航行日誌：點一台再打開它
    if (again) { $('#journal').close(); openChannel(again.dataset.openCh); return; }
    if (t.id === 'clear-stamps' && confirm('要清除全部的星章和紀錄嗎？清除後就找不回來了。')) { onClear(); $('#journal').close(); }
  });
  $('#channel').addEventListener('close', () => {
    stopTalk();
    $('#channel .embed')?.remove(); // 關掉卡片：播放器一起拿掉，聲音才會停
    const params = new URLSearchParams(location.search);
    params.delete('ch');
    history.replaceState(null, '', params.toString() ? `?${params}` : location.pathname);
  });
  $('#lab-close').addEventListener('click', closeLab);
  $('#lab').addEventListener('cancel', closeLab);
  window.addEventListener('message', (ev) => {
    // lab 頁面加上 kidsci-bridge.js 後，第一次有意義的操作會送 {type: 'kidsci-lab-done'}。
    if (ev.origin === LAB_ORIGIN && ev.data?.type === 'kidsci-lab-done' && $('#lab').open) addStamp('hand', $('#lab').dataset.code);
  });

  return { openChannel, openJournal, stampMarks };
}
