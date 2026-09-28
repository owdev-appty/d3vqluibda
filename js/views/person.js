// Edit person
import * as store from '../store.js';
import { esc } from '../text.js';
import { icon, confirmModal, sheet } from '../ui.js';
import { back, placeHash, redirect } from '../nav.js';

export default function personEdit(root, { params, query }) {
  const person = store.getPerson(params[0]);
  if (!person) { redirect('#/'); return; }
  const from = query.get('from');
  const fallback = from && store.getPlace(from) ? placeHash(from) : '#/';

  const v = { name: person.name, fullName: person.fullName, notes: person.notes };
  let links = person.links.map(({ placeId, subShop }) => ({ placeId, subShop }));

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

  function drawPlaces() {
    const solo = links.length === 1;
    chipsEl.innerHTML = links.map((l, i) => {
      const p = store.getPlace(l.placeId);
      if (!p) return '';
      const isRegion = p.type === 'region';
      return `
        <span class="place-chip ${isRegion ? 'region' : ''} ${solo ? 'solo' : ''}">
          <button type="button" class="label-btn" data-edit="${i}" ${isRegion ? '' : 'tabindex="-1"'}>
            ${esc(p.name)}${isRegion && l.subShop ? `<span class="subshop">・${esc(l.subShop)}</span>` : ''}
          </button>
          ${solo ? '' : `<button type="button" class="x" data-remove="${i}" aria-label="Remove ${esc(p.name)}">${icon('x')}</button>`}
        </span>`;
    }).join('') + `<button type="button" class="add-place-btn" data-act="add-place">${icon('plus')}Add place</button>`;
    root.querySelector('.region-hint').classList.toggle('hidden',
      !links.some((l) => store.getPlace(l.placeId)?.type === 'region'));
  }

  function editSubShop(i) {
    const l = links[i];
    const p = store.getPlace(l.placeId);
    sheet(`Shop in ${p.name}`, (body, close) => {
      const known = store.subShopsOf(p.id);
      body.innerHTML = `
        <input class="input" value="${esc(l.subShop)}" placeholder="お店の名前（空欄でもOK）" autocomplete="off">
        ${known.length ? `<div class="chips">${known.map((s) => `<button type="button" class="chip region" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
        <div class="sheet-actions"><button type="button" data-ok>Save</button></div>`;
      const input = body.querySelector('input');
      body.addEventListener('click', (e) => {
        const s = e.target.closest('[data-s]');
        if (s) input.value = s.dataset.s;
        if (e.target.closest('[data-ok]')) { l.subShop = input.value.trim(); drawPlaces(); close(); }
      });
    });
  }

  function addPlace() {
    const linked = new Set(links.map((l) => l.placeId));
    const candidates = store.placesInOrder().filter((p) => !linked.has(p.id));
    sheet('Add place', (body, close) => {
      if (!candidates.length) {
        body.innerHTML = '<p class="empty">追加できる場所がありません</p>';
        return;
      }
      body.innerHTML = candidates.map((p) => `
        <button type="button" class="pick-row" data-id="${esc(p.id)}">
          <span class="mincho">${esc(p.name)}</span>${p.type === 'region' ? '<span class="region-label">Region</span>' : ''}
        </button>`).join('');
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-id]');
        if (!b) return;
        links.push({ placeId: b.dataset.id, subShop: '' });
        drawPlaces();
        close();
      });
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
      if (store.getPlace(links[i].placeId)?.type === 'region') editSubShop(i);
      return;
    }
    switch (t.dataset.act) {
      case 'cancel': return back(fallback);
      case 'add-place': return addPlace();
      case 'delete': return remove();
      case 'save':
        if (!v.name.trim()) return;
        store.updatePerson(person.id, v, links);
        return back(fallback);
    }
  });

  drawPlaces();
}
