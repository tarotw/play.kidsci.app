// 放進 lab.kidsci.app 的每個實驗頁：<script src="/kidsci-bridge.js" defer></script>
// 實驗被 play.kidsci.app（舊網址 universe.kidsci.app 也認得）用 iframe 打開時，孩子第一次真的動手（拖、點、輸入），就通知地圖蓋「小手章」。
(() => {
  const HOSTS = ['https://play.kidsci.app', 'https://universe.kidsci.app'];
  if (window.parent === window) return;
  // 是被哪一個網址打開的就回給誰（postMessage 要指定對象）
  const UNIVERSE = HOSTS.find((h) => (location.ancestorOrigins?.[0] || (document.referrer && new URL(document.referrer).origin)) === h) || HOSTS[0];
  let sent = false;
  const done = () => {
    if (sent) return;
    sent = true;
    window.parent.postMessage({ type: 'kidsci-lab-done', path: location.pathname }, UNIVERSE);
  };
  ['input', 'change', 'pointerup', 'keydown'].forEach((type) => window.addEventListener(type, done, { once: true, passive: true }));
})();
