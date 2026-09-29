// ハッシュルーティング：#/  #/place/:id  #/place/:id/edit  #/new  #/person/:id?from=placeId ...
import { closeAllModals } from './ui.js';

const app = document.getElementById('app');
const scrollPos = new Map();
let routes = [];
let current = { hash: null, cleanup: null };

export function setRoutes(list) { routes = list; }

// 新しいバージョンが有効になったら、入力中の画面を消さないよう、次に画面を移るときに再読み込みする
let reloadPending = false;
export function requestReload() { reloadPending = true; }

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const i = raw.indexOf('?');
  const path = i >= 0 ? raw.slice(0, i) : raw;
  return { path, query: new URLSearchParams(i >= 0 ? raw.slice(i + 1) : '') };
}

export function render({ restoreScroll = false } = {}) {
  if (reloadPending) { location.reload(); return; } // URL はもう移動先になっている
  if (current.hash !== null) scrollPos.set(current.hash, window.scrollY);
  if (current.cleanup) current.cleanup();
  current.cleanup = null;
  closeAllModals();

  const { path, query } = parseHash();
  let view = null;
  let params = [];
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      try {
        params = m.slice(1).map(decodeURIComponent);
        view = fn;
      } catch {
        view = null; // URL の % の並びが壊れているときはホームへ
      }
      break;
    }
  }
  if (!view) { history.replaceState(null, '', '#/'); render(); return; }

  current.hash = location.hash || '#/';
  // 画面ごとに新しい要素を渡す（前の画面のイベントリスナーが残らないように）
  const root = document.createElement('div');
  app.replaceChildren(root);
  current.cleanup = view(root, { params, query, path }) || null;
  window.scrollTo(0, restoreScroll ? scrollPos.get(current.hash) || 0 : 0);
}

// 画面の移動。タップの処理の中で同期的に描画するので、移動先で入力欄にフォーカスできる（iOSのキーボード表示）。
export function go(hash, { replace = false, restoreScroll = false } = {}) {
  const d = history.state?.d || 0;
  if (replace) history.replaceState({ d }, '', hash);
  else history.pushState({ d: d + 1 }, '', hash);
  render({ restoreScroll });
}

export const placeHash = (id) => `#/place/${encodeURIComponent(id)}`;

export function start() {
  window.addEventListener('popstate', () => render({ restoreScroll: true }));
  window.addEventListener('hashchange', () => { if (location.hash !== current.hash) render({ restoreScroll: true }); });
  render();
}

// 戻る：アプリ内で n 回以上進んでいれば履歴を戻る。そうでなければ fallback に置き換えて移動。
export function back(fallback = '#/', n = 1) {
  if ((history.state?.d || 0) >= n) history.go(-n);
  else go(fallback, { replace: true });
}

// 描画中に別の画面へ移るとき（場所が見つからないなど）
export const redirect = (hash) => queueMicrotask(() => go(hash, { replace: true }));
