import * as store from './store.js';
import { toast } from './ui.js';
import { setRoutes, start } from './nav.js';
import home from './views/home.js';
import place from './views/place.js';
import placeEdit from './views/placeEdit.js';
import person from './views/person.js';
import search from './views/search.js';

setRoutes([
  [/^\/$/, home],
  [/^\/place\/([^/?]+)$/, place],
  [/^\/place\/([^/?]+)\/edit$/, placeEdit],
  [/^\/new$/, placeEdit],
  [/^\/person\/([^/?]+)$/, person],
  [/^\/search$/, search],
]);

store.onError(() => toast('保存できませんでした（端末の空き容量を確認してください）'));
store.load();
start();

// ローカル確認時（localhost）は、?sw を付けたときだけ Service Worker を使う（古いキャッシュで混乱しないように）
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!isLocal || location.search.includes('sw'))) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // ホーム画面から戻ってきたときに更新を確認
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});
  // 新しいバージョンが有効になったら1回だけ再読み込み
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}
