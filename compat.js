// 舊瀏覽器補丁：家裡的舊 iPad（iOS 15 以前）也要能用。
// 1) canvas 的 roundRect：Safari 16 才有，3D 版的名牌、ON AIR 招牌會用到。
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r = 0) {
    const rr = Math.max(0, Math.min(Array.isArray(r) ? r[0] : r, w / 2, h / 2));
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
  };
}

// 2) <dialog>：iOS 15.4 才有。沒有的話，頻道卡、實驗、航行日誌都打不開。
export function patchDialogs() {
  if (typeof HTMLDialogElement === 'function' && HTMLDialogElement.prototype.showModal) return;
  document.documentElement.classList.add('no-dialog');
  document.querySelectorAll('dialog').forEach((d) => {
    d.showModal = () => { d.setAttribute('open', ''); };
    d.close = () => {
      if (!d.hasAttribute('open')) return;
      d.removeAttribute('open');
      d.dispatchEvent(new Event('close'));
    };
    Object.defineProperty(d, 'open', { get: () => d.hasAttribute('open'), configurable: true });
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const open = [...document.querySelectorAll('dialog[open]')].pop();
    if (!open) return;
    const cancel = new Event('cancel', { cancelable: true });
    open.dispatchEvent(cancel);
    if (!cancel.defaultPrevented) open.close();
  });
}
