// 共通の見た目の部品：線のアイコン、確認モーダル、シート、トースト
import { esc } from './text.js';
import { PREF_GROUPS, shortPref } from './prefectures.js';

const PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  grip: '<path d="M5 8h14M5 12h14M5 16h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  download: '<path d="M12 3v12M8 11l4 4 4-4"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
};

export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]}</svg>`;

// アプリアイコンと同じ3人のシルエット（塗り）
export const LOGO = '<svg viewBox="0 0 64 48" aria-hidden="true"><circle cx="14" cy="17" r="7.5"/><circle cx="50" cy="17" r="7.5"/><circle cx="32" cy="12" r="9"/><path d="M3 46C3 36 7 29 15 28C18 28 19 30 18 32C15 37 14 41 14 46Z"/><path d="M61 46C61 36 57 29 49 28C46 28 45 30 46 32C49 37 50 41 50 46Z"/><path d="M17 46C17 34 23 25 32 25C41 25 47 34 47 46Z"/></svg>';

const modalRoot = () => document.getElementById('modal-root');

function openOverlay(inner, { onBackdrop } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = inner;
  overlay.addEventListener('click', (e) => { if (e.target === overlay && onBackdrop) onBackdrop(); });
  modalRoot().appendChild(overlay);
  const close = () => overlay.remove();
  return { overlay, close };
}

export function closeAllModals() { modalRoot().innerHTML = ''; }

// 確認モーダル。resolve(true) で実行。
export function confirmModal({ title, body = [], note = '', confirmLabel = 'Delete', tone = 'danger', cancelLabel = 'Cancel' }) {
  return new Promise((resolve) => {
    const lines = (Array.isArray(body) ? body : [body]).map(esc).join('<br>');
    const { overlay, close } = openOverlay(`
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="m-title">
        <h2 id="m-title">${esc(title)}</h2>
        ${lines ? `<p>${lines}</p>` : ''}
        ${note ? `<p class="small">${esc(note)}</p>` : ''}
        <div class="btns">
          ${cancelLabel ? `<button type="button" data-r="0">${esc(cancelLabel)}</button>` : ''}
          <button type="button" class="${tone}" data-r="1">${esc(confirmLabel)}</button>
        </div>
      </div>`, { onBackdrop: () => done(false) });
    function done(v) { close(); resolve(v); }
    overlay.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => done(b.dataset.r === '1')));
    // 最初のフォーカスは Cancel（ないときは OK）に。削除ボタンを誤って押さないように
    (overlay.querySelector('[data-r="0"]') || overlay.querySelector('[data-r="1"]')).focus({ preventScroll: true });
  });
}

export const alertModal = (title, body) => confirmModal({ title, body, confirmLabel: 'OK', tone: 'primary', cancelLabel: '' });

// 選択用のシート。build(body, close) で中身を作る。
export function sheet(title, build) {
  const { overlay, close } = openOverlay(`
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="link-btn" data-close>Cancel</button></div>
      <div class="sheet-body"></div>
    </div>`, { onBackdrop: () => close() });
  overlay.querySelector('[data-close]').addEventListener('click', close);
  build(overlay.querySelector('.sheet-body'), close);
  return close;
}

// 47都道府県から選ぶシート。選んだ名前（「福岡」など）を onPick に渡す。
export function pickPrefecture(onPick) {
  sheet('47都道府県', (body, close) => {
    body.innerHTML = PREF_GROUPS.map(([label, list]) => `
      <div class="pref-group"><p class="hint">${label}</p>
        <div class="pref-grid">${list.map((p) => `<button type="button" class="chip region" data-p="${shortPref(p)}">${shortPref(p)}</button>`).join('')}</div>
      </div>`).join('');
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-p]');
      if (b) { close(); onPick(b.dataset.p); }
    });
  });
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// SortableJS（vendor/ に同梱）。≡ のつまみを押さえたときだけドラッグできる。
export function makeSortable(list, onEnd) {
  if (!window.Sortable) return null;
  let lastDrag = 0;
  const s = window.Sortable.create(list, {
    handle: '.grip',
    draggable: '[data-id]',
    animation: 160,
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 2,
    scroll: true,
    bubbleScroll: true,
    onStart: () => document.body.classList.add('dragging'),
    onEnd: (evt) => {
      document.body.classList.remove('dragging');
      lastDrag = Date.now();
      if (evt.oldIndex !== evt.newIndex) onEnd([...list.querySelectorAll('[data-id]')].map((el) => el.dataset.id));
    },
  });
  // ドロップ直後のクリック（行を開く）を無視するため
  s.justDragged = () => Date.now() - lastDrag < 350;
  return s;
}
