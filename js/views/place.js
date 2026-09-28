// Shop / Region の画面：人の一覧とクイック追加
import * as store from '../store.js';
import { esc, parsePersonLine } from '../text.js';
import { icon, makeSortable } from '../ui.js';
import { go, placeHash, redirect } from '../nav.js';

const subFilters = new Map(); // Regionの絞り込み（場所ごとに覚えておく）

// メモの中のほかの場所の名前をリンクにする（長い名前を優先）
function linkify(text, selfId) {
  const others = store.getState().places
    .filter((p) => p.id !== selfId && p.name)
    .sort((a, b) => b.name.length - a.name.length);
  if (!others.length || !text) return esc(text);
  const re = new RegExp(others.map((p) => p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const byName = new Map(others.map((p) => [p.name, p.id]));
  let out = '';
  let last = 0;
  for (const m of text.matchAll(re)) {
    out += esc(text.slice(last, m.index));
    out += `<span class="place-link" role="link" data-place="${esc(byName.get(m[0]))}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

export default function placeView(root, { params, query }) {
  const id = params[0];
  const place = store.getPlace(id);
  if (!place) { redirect('#/'); return; }
  const isRegion = place.type === 'region';
  let sub = subFilters.get(id) || 'all';

  root.className = isRegion ? 'region-page' : '';
  const shopSub = [place.area, place.category].filter(Boolean).join('・');
  root.innerHTML = `
    <div class="topbar">
      <button type="button" class="link-btn" data-act="home">${icon('back')}People list</button>
      <button type="button" class="link-btn" data-act="edit">Edit</button>
    </div>
    <div class="place-head">
      ${isRegion ? '<span class="region-label">Region</span>' : ''}
      <h1 class="name">${esc(place.name)}</h1>
      ${!isRegion && shopSub ? `<div class="sub">${esc(shopSub)}</div>` : ''}
      ${place.notes ? `<div class="notes-box">${linkify(place.notes, id)}</div>` : ''}
    </div>
    ${isRegion ? '<div class="filter-chips" role="group" aria-label="Filter by shop"></div>' : ''}
    <div class="section-title">People here<span class="count"></span></div>
    <div class="people-list"></div>
    <div class="quick-pad"></div>
    <div class="quick-add">
      <form autocomplete="off">
        <input type="text" name="q" enterkeyhint="done" aria-label="Add person"
          placeholder="${isRegion ? 'みきさん（帽子）@風来' : 'さきさん（めがね）'}">
        <button type="submit" class="add-btn" aria-label="Add" disabled>${icon('plus')}</button>
      </form>
      <p class="hint">${isRegion ? '＠のあとにお店名を書くとお店で分類されます（省略OK）' : '名前（特徴）の形で入力。カッコ内はメモに入ります'}</p>
    </div>`;

  const chipsEl = root.querySelector('.filter-chips');
  const listEl = root.querySelector('.people-list');
  const countEl = root.querySelector('.section-title .count');
  const bar = root.querySelector('.quick-add');
  const form = bar.querySelector('form');
  const input = form.querySelector('input');
  const addBtn = form.querySelector('.add-btn');

  function drawChips() {
    if (!chipsEl) return;
    const shops = store.subShopsOf(id);
    if (sub !== 'all' && !shops.includes(sub)) sub = 'all';
    subFilters.set(id, sub);
    chipsEl.classList.toggle('hidden', !shops.length);
    chipsEl.innerHTML = ['all', ...shops].map((s) =>
      `<button type="button" class="chip region ${s === sub ? 'on' : ''}" data-sub="${esc(s)}">${s === 'all' ? 'All' : esc(s)}</button>`).join('');
  }

  function drawPeople(flashId) {
    const all = store.peopleAt(id);
    countEl.textContent = all.length;
    const rows = sub === 'all' ? all : all.filter(({ link }) => link.subShop === sub);
    if (!rows.length) {
      listEl.innerHTML = `<p class="empty">${all.length ? 'このお店の人はいません' : 'まだ誰もいません。<br>下の欄から追加できます。'}</p>`;
      return;
    }
    listEl.innerHTML = rows.map(({ person, link }) => `
      <div class="person-row ${person.id === flashId ? 'flash' : ''}" data-id="${esc(person.id)}">
        <div class="body">
          <div class="pname"><span>${esc(person.name)}</span>${isRegion && link.subShop ? `<span class="sub-tag">${esc(link.subShop)}</span>` : ''}</div>
          ${person.notes ? `<div class="pnotes">${linkify(person.notes, id)}</div>` : ''}
        </div>
        <span class="grip" aria-label="並び替え">${icon('grip')}</span>
      </div>`).join('');
    if (flashId) listEl.querySelector('.flash')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'home') return go('#/', { restoreScroll: true });
    if (act === 'edit') return go(`${placeHash(id)}/edit`);
    const link = e.target.closest('.place-link');
    if (link) return go(placeHash(link.dataset.place));
    const chip = e.target.closest('[data-sub]');
    if (chip) { sub = chip.dataset.sub; subFilters.set(id, sub); drawChips(); drawPeople(); return; }
    const row = e.target.closest('.person-row');
    if (row && !e.target.closest('.grip') && !sortable?.justDragged()) go(`#/person/${encodeURIComponent(row.dataset.id)}?from=${encodeURIComponent(id)}`);
  });

  // iOSでは keydown が当てにならないので input イベントで状態を更新する
  input.addEventListener('input', () => { addBtn.disabled = !input.value.trim(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const parsed = parsePersonLine(input.value, { at: isRegion });
    if (!parsed.name) return;
    let subShop = isRegion ? parsed.subShop : '';
    if (isRegion && !subShop && sub !== 'all') subShop = sub; // 絞り込み中のお店に入れる
    if (isRegion && subShop !== sub) sub = 'all';
    const person = store.addPerson({ name: parsed.name, notes: parsed.notes }, id, subShop);
    input.value = '';
    addBtn.disabled = true;
    drawChips();
    drawPeople(person.id);
    input.focus({ preventScroll: true });
  });

  // キーボード表示中も入力欄をキーボードのすぐ上に置く
  const vv = window.visualViewport;
  function placeBar() {
    const off = window.innerHeight - vv.height - vv.offsetTop;
    bar.style.transform = off > 1 ? `translateY(${-off}px)` : '';
  }
  if (vv) { vv.addEventListener('resize', placeBar); vv.addEventListener('scroll', placeBar); }

  // ≡ のつまみでドラッグして並び替え（場所ごとに保存）
  const sortable = makeSortable(listEl, (ids) => store.reorderPeople(id, ids));

  drawChips();
  drawPeople();
  if (query.get('new') === '1') {
    input.focus();
    history.replaceState(history.state, '', placeHash(id)); // 戻ってきたときに再びフォーカスしない
  }

  return () => {
    sortable?.destroy();
    if (vv) { vv.removeEventListener('resize', placeBar); vv.removeEventListener('scroll', placeBar); }
  };
}
