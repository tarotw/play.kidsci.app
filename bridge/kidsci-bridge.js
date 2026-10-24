// 放進 lab.kidsci.app 的每個實驗頁：<script src="/kidsci-bridge.js" defer></script>
// 實驗被 play.kidsci.app 用 iframe 打開時，孩子第一次真的動手（拖、點、輸入），就通知地圖蓋「小手章」。
(() => {
  const UNIVERSE = 'https://play.kidsci.app';
  if (window.parent === window) return;
  let sent = false;
  const done = () => {
    if (sent) return;
    sent = true;
    window.parent.postMessage({ type: 'kidsci-lab-done', path: location.pathname }, UNIVERSE);
  };
  ['input', 'change', 'pointerup', 'keydown'].forEach((type) => window.addEventListener(type, done, { once: true, passive: true }));
})();
