// People list（ホーム）
import * as store from '../store.js';
import { esc } from '../text.js';
import { icon, LOGO, makeSortable } from '../ui.js';
import { go, placeHash } from '../nav.js';

let filter = 'all'; // 画面を離れても覚えておく

function placeSub(p) {
  if (p.type === 'shop') return [p.area, p.category].filter(Boolean).join('・');
  return store.subShopsOf(p.id).join('、');
}

export default function home(root) {
  root.innerHTML = `
    <div class="home-head">
      <h1>${LOGO}People list</h1>
      <button type="button" class="icon-btn" data-act="settings" aria-label="Settings">${icon('gear')}</button>
    </div>
    <button type="button" class="search-bar" data-act="search">${icon('search')}<span>Search</span></button>
    <div class="toolbar">
      <div class="chips" role="group" aria-label="Filter">
        <button type="button" class="chip" data-filter="all">All</button>
        <button type="button" class="chip" data-filter="shops">Shops</button>
        <button type="button" class="chip" data-filter="regions">Regions</button>
      </div>
      <div class="segment" role="group" aria-label="Sort">
        <button type="button" data-sort="custom">Custom</button>
        <button type="button" data-sort="name">Name</button>
      </div>
    </div>
    <div class="place-list"></div>
    <div class="list-foot"></div>
    <div class="home-pad"></div>
    <button type="button" class="fab" data-act="add">${icon('plus')}Add</button>`;

  const list = root.querySelector('.place-list');
  const foot = root.querySelector('.list-foot');
  let sortable = null;

  function draw() {
    const custom = store.getSettings().sortMode === 'custom';
    root.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('on', b.dataset.filter === filter));
    root.querySelectorAll('[data-sort]').forEach((b) => b.classList.toggle('on', b.dataset.sort === store.getSettings().sortMode));
    const places = store.placesInOrder().filter((p) =>
      filter === 'all' || (filter === 'shops' ? p.type === 'shop' : p.type === 'region'));

    if (!places.length) {
      list.innerHTML = store.totals().places
        ? '<p class="empty">この絞り込みには場所がありません</p>'
        : '<p class="empty">まだ場所がありません。<br>右下の「+ Add」から、お店や行ったエリアを登録できます。</p>';
      foot.innerHTML = '';
      return;
    }

    list.innerHTML = places.map((p) => {
      const sub = placeSub(p);
      return `
        <div class="place-card ${p.type === 'region' ? 'region' : ''}" data-id="${esc(p.id)}">
          <div class="body">
            <div class="line1">
              <span class="name">${esc(p.name)}</span>
              ${p.type === 'region' ? '<span class="region-label">Region</span>' : ''}
              <span class="count">${store.countAt(p.id)}</span>
            </div>
            ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
          </div>
          ${custom ? `<span class="grip" aria-label="並び替え">${icon('grip')}</span>` : ''}
        </div>`;
    }).join('');
    foot.innerHTML = custom && places.length > 1 ? '<p class="hint">≡ を押さえたまま動かすと並び替え</p>' : '';
    sortable?.option('disabled', !custom);
  }

  root.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) { filter = f.dataset.filter; draw(); return; }
    const so = e.target.closest('[data-sort]');
    if (so) { store.setSortMode(so.dataset.sort); draw(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'settings') return go('#/settings');
    if (act === 'search') return go('#/search');
    if (act === 'add') return go('#/new');
    const card = e.target.closest('.place-card');
    if (card && !e.target.closest('.grip') && !sortable?.justDragged()) go(placeHash(card.dataset.id));
  });

  // Custom のときだけ、≡ のつまみでドラッグして並び替え（順番は保存）
  sortable = makeSortable(list, (ids) => store.reorderPlaces(ids));
  draw();
  return () => sortable?.destroy();
}
