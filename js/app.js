import * as store from './store.js';
import { toast, alertModal } from './ui.js';
import { setRoutes, start, requestReload } from './nav.js';
import home from './views/home.js';
import place from './views/place.js';
import placeEdit from './views/placeEdit.js';
import person from './views/person.js';
import search from './views/search.js';
import settings from './views/settings.js';
import importView from './views/import.js';

setRoutes([
  [/^\/$/, home],
  [/^\/place\/([^/?]+)$/, place],
  [/^\/place\/([^/?]+)\/edit$/, placeEdit],
  [/^\/new$/, placeEdit],
  [/^\/person\/([^/?]+)$/, person],
  [/^\/search$/, search],
  [/^\/settings$/, settings],
  [/^\/import$/, importView],
]);

store.onError((e) => toast(e.message === 'readonly'
  ? '保存データを読み込めなかったため、保存を止めています'
  : '保存できませんでした（端末の空き容量を確認してください）'));
store.load();
start();
if (store.isReadOnly()) {
  // 元のデータは消さずに残してある（アプリの更新で読めるようになる場合もある）
  alertModal("Can't load data", '保存データを読み込めませんでした。元のデータは消さずに残してあります。アプリを開き直すか、Settings の「Restore from backup」から復元してください。');
}

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
  // 新しいバージョンが有効になったら、次に画面を移るときに1回だけ再読み込み。
  // すぐに再読み込みすると、編集中の入力が消えてしまうため。
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) requestReload();
  });
}
