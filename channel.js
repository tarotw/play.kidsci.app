// 宇宙好好聽：頻道卡（介紹對話＋到 Apple Podcasts、Spotify 收聽）、實驗、航行日誌。萬物旋鈕版（app.js）與放大縮小版（zoom.js）共用。
import { iconFor } from './explorer.js';
import { speakLines, stopSpeaking, canSpeak } from './speech.js';

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
export function createChannels({ byCode, lines, getStamps, addStamp, onOpen = () => {}, onClear = () => {}, autoVoice = () => false }) {
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
    const platforms = pf ? `<div class="platforms" aria-label="收聽這一集"><span class="pf-cap">🎧 收聽這一集</span>${pf}</div>` : '';
    const labs = e.labs.map((lab) => `<button class="btn alt" type="button" data-lab="${esc(lab.url)}" data-lab-title="${esc(lab.title)}" data-code="${esc(code)}">🧪 ${esc(lab.title)}</button>`).join('');
    const takeaways = content?.takeaways?.length
      ? `<h3>重點句</h3><ol class="takeaways" id="takeaways">${content.takeaways.map((t) =>
        `<li>${esc(t.emoji)} ${esc(t.text)}</li>`).join('')}</ol>` : '';
    const card = content?.card
      ? `<div class="card"><h3>🃏 ${esc(content.card.name)}</h3><p>${esc(content.card.description)}</p><ul>${content.card.knowledge.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>` : '';
    const question = content?.question
      ? `<div class="question"><strong>好奇博士問你：</strong>${esc(content.question.text)}</div>` : '';
    talk = introTalk(e, content);
    // 每一句都可以點來聽（隊長是女生的聲音、博士是男生的聲音），上面的按鈕從頭念到尾
    const say = ([who, text], i) => `<div class="say ${who}" data-say="${i}"${canSpeak() ? ' role="button" tabindex="0" aria-label="念這一句"' : ''}><img src="${lines.cast[who].avatar}" alt="${lines.cast[who].name}"><p>${esc(text)}</p></div>`;
    const playAll = canSpeak() ? '<button type="button" class="talk-play" data-talk aria-pressed="false">🔊 聽他們說</button>' : '';
    const duo = `<div class="duo">${playAll}${talk.map(say).join('')}</div>`;

    $('#channel').innerHTML = `<div class="inner">
      <button class="close" type="button" data-close aria-label="關閉">✕</button>
      <p class="hero" aria-hidden="true">${iconFor(e)}</p>
      <h2 id="ch-title">${esc(e.title)}</h2>
      <p class="hint">${esc(code)} 台 ${stateBadge(e)} ${stampMarks(code)}</p>
      ${duo}${platforms}${labs ? `<div class="actions">${labs}</div>` : ''}${takeaways}${card}${question}</div>`;
    if (!$('#channel').open) $('#channel').showModal();
    if (autoVoice()) playTalk(0); // 打開了「念給我聽」：卡片的對話也直接念
    const params = new URLSearchParams(location.search);
    params.set('ch', code);
    history.replaceState(null, '', `?${params}`);
  }

  // ---------- 念卡片上的對話 ----------
  let talk = [];
  function playTalk(from = 0) {
    const bubbles = [...document.querySelectorAll('#channel .say')];
    const btn = document.querySelector('#channel [data-talk]');
    const mark = (i) => bubbles.forEach((b, j) => b.classList.toggle('speaking', j === i));
    btn?.setAttribute('aria-pressed', 'true');
    if (btn) btn.textContent = '⏹ 停';
    speakLines(talk.slice(from).map(([who, text]) => ({ who, text })), {
      onLine: (i) => mark(from + i),
      onDone: () => { mark(-1); if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.textContent = '🔊 聽他們說'; } },
    });
  }
  function stopTalk() {
    stopSpeaking();
    document.querySelectorAll('#channel .say.speaking').forEach((b) => b.classList.remove('speaking'));
    const btn = document.querySelector('#channel [data-talk]');
    if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.textContent = '🔊 聽他們說'; }
  }

  // 介紹變成兩個人的對話：介紹開頭是問句就給好奇博士問，其餘由科學隊長回答（太長就分兩段）
  function introTalk(e, content) {
    const intro = (e.intro || '').replace(/^小朋友[，,]\s*/, '');
    const sents = intro.match(/[^。！？!?]+[。！？!?]*[」』）)]*/g)?.map((x) => x.trim()).filter(Boolean) || [];
    if (!sents.length) {
      const reply = content?.takeaways?.[0]?.text || content?.card?.description
        || (e.labs[0] ? `這一集有實驗「${e.labs[0].title}」可以玩：${e.labs[0].question}` : lines.answers.fallback);
      return [['curious', fill(pick(lines.channel.public), { icon: iconFor(e) })], ['captain', reply]];
    }
    const out = [];
    // 開頭連續的問句（最多兩句）都給好奇博士問
    const isQ = (x) => /[？?][」』）)]*$/.test(x);
    const qs = [];
    while (sents.length > 1 && qs.length < 2 && isQ(sents[0])) qs.push(sents.shift());
    out.push(['curious', qs.length ? qs.join('') : fill(pick(lines.channel.public), { icon: iconFor(e) })]);
    const rest = sents.join('');
    if (rest.length > 90 && sents.length > 2) {
      const half = Math.ceil(sents.length / 2);
      out.push(['captain', sents.slice(0, half).join('')], ['captain', sents.slice(half).join('')]);
    } else out.push(['captain', rest]);
    return out;
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
    const talkBtn = t.closest('[data-talk]');
    if (talkBtn) { if (talkBtn.getAttribute('aria-pressed') === 'true') stopTalk(); else playTalk(0); return; }
    const bubble = t.closest('#channel [data-say]');
    if (bubble && canSpeak()) { playTalk(Number(bubble.dataset.say)); return; }
    const ear = t.closest('[data-ear]'); // 點了 Apple／Spotify 去聽：蓋耳朵章（連結本身照常打開）
    if (ear) addStamp('ear', ear.dataset.ear);
    const again = t.closest('[data-open-ch]'); // 航行日誌：點一台再打開它
    if (again) { $('#journal').close(); openChannel(again.dataset.openCh); return; }
    if (t.id === 'clear-stamps' && confirm('要清除全部的星章和紀錄嗎？清除後就找不回來了。')) { onClear(); $('#journal').close(); }
  });
  $('#channel').addEventListener('keydown', (ev) => { const b = ev.target.closest?.('[data-say]'); if (b && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); playTalk(Number(b.dataset.say)); } });
  $('#channel').addEventListener('close', () => {
    stopTalk();
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
