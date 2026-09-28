// People list（ホーム）
import * as store from '../store.js';
import { esc } from '../text.js';
import { icon, LOGO } from '../ui.js';
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
      <button type="button" class="icon-btn" data-act="settings" aria-label="Settings">${icon('gear')}${store.backupDue() ? '<span class="dot"></span>' : ''}</button>
    </div>
    <button type="button" class="search-bar" data-act="search">${icon('search')}<span>Search</span></button>
    <div class="toolbar">
      <div class="chips" role="group" aria-label="Filter">
        <button type="button" class="chip" data-filter="all">All</button>
        <button type="button" class="chip" data-filter="shops">Shops</button>
        <button type="button" class="chip" data-filter="regions">Regions</button>
      </div>
    </div>
    <div class="place-list"></div>
    <div class="list-foot"></div>
    <div class="home-pad"></div>
    <button type="button" class="fab" data-act="add">${icon('plus')}Add</button>`;

  const list = root.querySelector('.place-list');
  const foot = root.querySelector('.list-foot');

  function draw() {
    root.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('on', b.dataset.filter === filter));
    const places = store.placesInOrder().filter((p) =>
      filter === 'all' || (filter === 'shops' ? p.type === 'shop' : p.type === 'region'));

    if (!places.length) {
      list.innerHTML = store.totals().places
        ? '<p class="empty">この絞り込みには場所がありません</p>'
        : '<p class="empty">まだ場所がありません。<br>右下の「+ Add」から、お店や行った県を登録できます。</p>';
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
        </div>`;
    }).join('');
    foot.innerHTML = '';
  }

  root.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) { filter = f.dataset.filter; draw(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'settings') return go('#/settings');
    if (act === 'search') return go('#/search');
    if (act === 'add') return go('#/new');
    const card = e.target.closest('.place-card');
    if (card) go(placeHash(card.dataset.id));
  });

  draw();
}
