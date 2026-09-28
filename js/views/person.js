// Edit person
import * as store from '../store.js';
import { esc, norm } from '../text.js';
import { icon, confirmModal, sheet } from '../ui.js';
import { back, placeHash, redirect } from '../nav.js';

let pickerTab = 'shops'; // Add place の Shops / Regions（次に開いたときも同じ側）

export default function personEdit(root, { params, query }) {
  const person = store.getPerson(params[0]);
  if (!person) { redirect('#/'); return; }
  const from = query.get('from');
  const fallback = from && store.getPlace(from) ? placeHash(from) : '#/';

  const v = { name: person.name, fullName: person.fullName, notes: person.notes };
  // 編集中のつながり。Save を押すまで保存しない（Cancel なら何も変わらない）
  // 1人が同じ場所に登録されるのは1つだけ（Region のお店名も1つ）
  const links = person.links.map(({ placeId, subShop }) => ({ placeId, subShop }));

  root.innerHTML = `
    <div class="topbar">
      <div class="side"><button type="button" class="link-btn" data-act="cancel">Cancel</button></div>
      <div class="title">Edit person</div>
      <div class="side right"><button type="button" class="pill-btn" data-act="save">Save</button></div>
    </div>
    <div class="field">
      <label for="p-name">Name</label>
      <input id="p-name" class="input big" name="name" value="${esc(v.name)}" autocomplete="off">
    </div>
    <div class="field">
      <label for="p-full">Full name<span class="opt">optional</span></label>
      <input id="p-full" class="input" name="fullName" value="${esc(v.fullName)}" autocomplete="off" placeholder="山田 花子（やまだ はなこ）">
    </div>
    <div class="field">
      <label for="p-notes">Notes</label>
      <textarea id="p-notes" class="textarea" name="notes" placeholder="特徴や話したこと">${esc(v.notes)}</textarea>
    </div>
    <div class="field">
      <div class="label">Places</div>
      <div class="chips places"></div>
      <p class="hint region-hint hidden">Regionのチップをタップすると、中のお店名を変えられます</p>
    </div>
    <button type="button" class="danger-soft" data-act="delete">Delete person</button>`;

  const chipsEl = root.querySelector('.places');
  const saveBtn = root.querySelector('[data-act="save"]');
  const linkOf = (placeId) => links.find((l) => l.placeId === placeId);

  function drawPlaces() {
    const solo = links.length === 1;
    chipsEl.innerHTML = links.map((l, i) => {
      const p = store.getPlace(l.placeId);
      if (!p) return '';
      const isRegion = p.type === 'region';
      const label = !isRegion ? esc(p.name)
        : l.subShop ? `${esc(p.name)}<span class="subshop">・${esc(l.subShop)}</span>`
          : `${esc(p.name)}<span class="subshop-add">＋お店名</span>`;
      return `
        <span class="place-chip ${isRegion ? 'region' : ''} ${solo ? 'solo' : ''}">
          <button type="button" class="label-btn" data-edit="${i}" ${isRegion ? '' : 'tabindex="-1"'}>${label}</button>
          ${solo ? '' : `<button type="button" class="x" data-remove="${i}" aria-label="Remove ${esc(p.name)}">${icon('x')}</button>`}
        </span>`;
    }).join('') + `<button type="button" class="add-place-btn" data-act="add-place">${icon('plus')}Add place</button>`;
    root.querySelector('.region-hint').classList.toggle('hidden',
      !links.some((l) => store.getPlace(l.placeId)?.type === 'region'));
  }

  // お店名（subShop）のシート：None / 既存のお店名 / + Add new → Done で決定
  function pickSubShop(region, current, onDone) {
    const known = store.subShopsOf(region.id);
    if (current && !known.includes(current)) known.push(current);
    let selected = current || '';
    sheet(region.name, (body, close) => {
      body.innerHTML = `
        <div class="chips sub-choices">
          <button type="button" class="chip region" data-s="">None</button>
          ${known.map((s) => `<button type="button" class="chip region" data-s="${esc(s)}">${esc(s)}</button>`).join('')}
          <button type="button" class="chip dashed" data-new>${icon('plus', 'chip-icon')}Add new</button>
        </div>
        <div class="new-sub hidden">
          <input class="input" placeholder="お店の名前" autocomplete="off" aria-label="New shop name">
        </div>
        <div class="sheet-actions"><button type="button" data-done>Done</button></div>`;
      const box = body.querySelector('.new-sub');
      const input = box.querySelector('input');
      const markChips = () => body.querySelectorAll('[data-s]').forEach((b) =>
        b.classList.toggle('on', box.classList.contains('hidden') && b.dataset.s === selected));
      markChips();

      // iOSでは keydown ではなく input イベントで値を受け取る
      input.addEventListener('input', () => { selected = input.value; });
      body.addEventListener('click', (e) => {
        const s = e.target.closest('[data-s]');
        if (s) {
          selected = s.dataset.s;
          box.classList.add('hidden');
          input.value = '';
          markChips();
          return;
        }
        if (e.target.closest('[data-new]')) {
          box.classList.remove('hidden');
          selected = input.value;
          markChips();
          input.focus();
          return;
        }
        if (e.target.closest('[data-done]')) {
          // 前後の空白を除いて既存のお店名と同じなら、そのお店として扱う
          const value = selected.trim();
          close();
          onDone(known.find((k) => k.trim() === value) || value);
        }
      });
    });
  }

  function editRegionChip(i) {
    const l = links[i];
    pickSubShop(store.getPlace(l.placeId), l.subShop, (value) => { l.subShop = value; drawPlaces(); });
  }

  // 登録済みの場所から選ぶ（新しい場所はここでは作らない）
  function addPlace() {
    sheet('Add place', (body, close) => {
      body.innerHTML = `
        <div class="segment wide" role="group" aria-label="Type">
          <button type="button" data-tab="shops">Shops</button>
          <button type="button" data-tab="regions">Regions</button>
        </div>
        <input type="search" size="1" class="input picker-search" placeholder="Search" autocomplete="off" aria-label="Filter places">
        <div class="picker-list"></div>`;
      const listEl = body.querySelector('.picker-list');
      const filterEl = body.querySelector('.picker-search');

      function drawList() {
        body.querySelectorAll('[data-tab]').forEach((b) => {
          b.classList.toggle('on', b.dataset.tab === pickerTab);
          b.classList.toggle('region', b.dataset.tab === 'regions' && pickerTab === 'regions');
        });
        const type = pickerTab === 'regions' ? 'region' : 'shop';
        const q = norm(filterEl.value).trim();
        const places = store.placesInOrder('custom')
          .filter((p) => p.type === type && (!q || norm(p.name).includes(q)));
        if (!places.length) {
          listEl.innerHTML = `<p class="hint list-empty">${q ? '見つかりませんでした' : type === 'region' ? 'Regionはまだありません' : 'お店はまだありません'}</p>`;
          return;
        }
        listEl.innerHTML = places.map((p) => {
          const l = linkOf(p.id);
          // Shop は登録済みなら選べない。Region は登録済みでも選べる（お店名を変える）
          const disabled = l && type === 'shop';
          return `
            <button type="button" class="pick-row ${l ? 'is-added' : ''}" data-id="${esc(p.id)}" ${disabled ? 'disabled' : ''}>
              <span class="display-name">${esc(p.name)}</span>
              ${l && type === 'region' && l.subShop ? `<span class="pick-sub">${esc(l.subShop)}</span>` : ''}
              ${l ? '<span class="added-tag">Added</span>' : ''}
            </button>`;
        }).join('');
      }

      // iOSでは keydown ではなく input イベントで絞り込む
      filterEl.addEventListener('input', drawList);
      body.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-tab]');
        if (tab) { pickerTab = tab.dataset.tab; drawList(); return; }
        const row = e.target.closest('.pick-row');
        if (!row || row.disabled) return;
        const p = store.getPlace(row.dataset.id);
        close();
        if (p.type === 'shop') {
          links.push({ placeId: p.id, subShop: '' });
          drawPlaces();
          return;
        }
        // Region：登録済みならそのお店名を変える。まだなら Done で追加する
        const existing = linkOf(p.id);
        pickSubShop(p, existing?.subShop || '', (value) => {
          if (existing) existing.subShop = value;
          else links.push({ placeId: p.id, subShop: value });
          drawPlaces();
        });
      });

      drawList();
    });
  }

  async function remove() {
    const ok = await confirmModal({ title: `Delete "${person.name}"?`, body: ["This can't be undone."] });
    if (!ok) return;
    store.deletePerson(person.id);
    back(fallback);
  }

  root.addEventListener('input', (e) => {
    if (e.target.name in v) { v[e.target.name] = e.target.value; saveBtn.disabled = !v.name.trim(); }
  });

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.remove !== undefined) {
      if (links.length > 1) { links.splice(Number(t.dataset.remove), 1); drawPlaces(); }
      return;
    }
    if (t.dataset.edit !== undefined) {
      const i = Number(t.dataset.edit);
      if (store.getPlace(links[i].placeId)?.type === 'region') editRegionChip(i);
      return;
    }
    switch (t.dataset.act) {
      case 'cancel': return back(fallback);
      case 'add-place': return addPlace();
      case 'delete': return remove();
      case 'save':
        if (!v.name.trim()) return;
        // 既存のつながりは addedAt をそのまま、新しいつながりだけ今の日時を記録（store.updatePerson）
        store.updatePerson(person.id, v, links);
        return back(fallback);
    }
  });

  drawPlaces();
}
