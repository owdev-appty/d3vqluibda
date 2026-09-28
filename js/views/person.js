// Edit person
import * as store from '../store.js';
import { esc, norm } from '../text.js';
import { icon, confirmModal, sheet, toast, pickPrefecture } from '../ui.js';
import { QUICK_PREFS } from '../prefectures.js';
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

  // 場所の表示用。まだ作っていない新しい場所（Save で確定）は pending に入っている
  const placeOf = (l) => (l.pending ? { ...l.pending, id: null } : store.getPlace(l.placeId));
  const isLinked = (placeId) => links.some((l) => l.placeId === placeId);
  const pendingSameName = (name) => links.find((l) => l.pending && norm(l.pending.name).trim() === norm(name).trim());

  function drawPlaces() {
    const solo = links.length === 1;
    chipsEl.innerHTML = links.map((l, i) => {
      const p = placeOf(l);
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
    root.querySelector('.region-hint').classList.toggle('hidden', !links.some((l) => placeOf(l)?.type === 'region'));
  }

  // Region の中のお店名を選ぶ：なし / 既存のお店名 / + Add new
  function editSubShop(i) {
    const l = links[i];
    const p = placeOf(l);
    const known = l.pending ? [] : store.subShopsOf(p.id);
    if (l.subShop && !known.includes(l.subShop)) known.push(l.subShop);
    sheet(`Shop in ${p.name}`, (body, close) => {
      body.innerHTML = `
        <div class="chips sub-choices">
          <button type="button" class="chip region ${!l.subShop ? 'on' : ''}" data-s="">なし</button>
          ${known.map((s) => `<button type="button" class="chip region ${s === l.subShop ? 'on' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}
          <button type="button" class="chip dashed" data-new>${icon('plus', 'chip-icon')}Add new</button>
        </div>
        <div class="new-sub hidden">
          <input class="input" placeholder="お店の名前" autocomplete="off" aria-label="Shop name">
          <div class="sheet-actions"><button type="button" data-ok disabled>Add</button></div>
        </div>`;
      const box = body.querySelector('.new-sub');
      const input = box.querySelector('input');
      const ok = box.querySelector('[data-ok]');
      const pick = (value) => { l.subShop = value.trim(); drawPlaces(); close(); };
      // iOSでは keydown ではなく input イベントで状態を更新する
      input.addEventListener('input', () => { ok.disabled = !input.value.trim(); });
      body.addEventListener('click', (e) => {
        const s = e.target.closest('[data-s]');
        if (s) return pick(s.dataset.s);
        if (e.target.closest('[data-new]')) { box.classList.remove('hidden'); input.focus(); return; }
        if (e.target.closest('[data-ok]') && input.value.trim()) {
          // 前後の空白を除いて既存のお店名と同じなら、そのお店として扱う
          const v = input.value.trim();
          pick(known.find((k) => k.trim() === v) || v);
        }
      });
    });
  }

  // 場所をつなげる。Region ならそのままお店名を選ぶシートを開く
  function link(placeOrPending, subShop = '') {
    const entry = placeOrPending.pending
      ? { placeId: null, pending: placeOrPending.pending, subShop }
      : { placeId: placeOrPending.id, subShop: placeOrPending.type === 'region' ? subShop : '' };
    links.push(entry);
    drawPlaces();
    const type = placeOrPending.pending ? placeOrPending.pending.type : placeOrPending.type;
    if (type === 'region' && !subShop) editSubShop(links.length - 1);
  }

  function addPlace() {
    const candidates = store.placesInOrder().filter((p) => !isLinked(p.id));
    sheet('Add place', (body, close) => {
      let type = 'shop';
      body.innerHTML = `
        <button type="button" class="pick-row add-new-row" data-new>${icon('plus')}Add new</button>
        <div class="new-place hidden"></div>
        ${candidates.map((p) => `
          <button type="button" class="pick-row" data-id="${esc(p.id)}">
            <span class="display-name">${esc(p.name)}</span>${p.type === 'region' ? '<span class="region-label">Region</span>' : ''}
          </button>`).join('')}
        ${candidates.length ? '' : '<p class="hint list-empty">登録済みの場所はすべて追加されています</p>'}`;
      const form = body.querySelector('.new-place');
      const val = { name: '', subShop: '' };

      function drawForm() {
        const isRegion = type === 'region';
        form.className = `new-place ${isRegion ? 'region-form' : ''}`;
        form.innerHTML = `
          <div class="segment wide" role="group" aria-label="Type">
            <button type="button" data-type="shop" class="${!isRegion ? 'on' : ''}">Shop</button>
            <button type="button" data-type="region" class="${isRegion ? 'on region' : ''}">Region</button>
          </div>
          <input class="input big" name="name" value="${esc(val.name)}" placeholder="${isRegion ? '県名や地名' : 'お店の名前'}" autocomplete="off" aria-label="Name">
          ${isRegion ? `
            <div class="chips pref-chips">
              ${QUICK_PREFS.map((p) => `<button type="button" class="chip region ${p === val.name.trim() ? 'on' : ''}" data-pref="${p}">${p}</button>`).join('')}
              <button type="button" class="chip dashed" data-prefs>47都道府県</button>
            </div>
            <input class="input" name="subShop" value="${esc(val.subShop)}" placeholder="中のお店名（省略OK）" autocomplete="off" aria-label="Shop in region">` : ''}
          <div class="sheet-actions"><button type="button" class="${isRegion ? '' : 'shop'}" data-add ${val.name.trim() ? '' : 'disabled'}>Add</button></div>`;
      }

      function syncForm() {
        form.querySelector('[data-add]').disabled = !val.name.trim();
        form.querySelectorAll('[data-pref]').forEach((b) => b.classList.toggle('on', b.dataset.pref === val.name.trim()));
      }

      function setName(name) {
        val.name = name;
        form.querySelector('[name="name"]').value = name;
        syncForm();
      }

      function submit() {
        const name = val.name.trim();
        if (!name) return;
        const subShop = type === 'region' ? val.subShop.trim() : '';
        close();
        // 同じ名前の場所があれば、新しく作らずにその場所を選ぶ
        const existing = store.findSameNamePlace(name);
        if (existing) {
          if (isLinked(existing.id)) return toast(`${existing.name} はすでに追加されています`);
          return link(existing, subShop);
        }
        if (pendingSameName(name)) return toast(`${name} はすでに追加されています`);
        link({ pending: { type, name } }, subShop);
      }

      form.addEventListener('input', (e) => {
        if (e.target.name in val) { val[e.target.name] = e.target.value; syncForm(); }
      });

      body.addEventListener('click', (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        if (t.dataset.new !== undefined) {
          t.classList.add('hidden');
          form.classList.remove('hidden');
          drawForm();
          form.querySelector('[name="name"]').focus();
          return;
        }
        if (t.dataset.type) { type = t.dataset.type; drawForm(); return; }
        if (t.dataset.pref) return setName(t.dataset.pref);
        if (t.dataset.prefs !== undefined) return pickPrefecture(setName);
        if (t.dataset.add !== undefined) return submit();
        if (t.dataset.id) {
          close();
          link(store.getPlace(t.dataset.id));
        }
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
      if (placeOf(links[i])?.type === 'region') editSubShop(i);
      return;
    }
    switch (t.dataset.act) {
      case 'cancel': return back(fallback);
      case 'add-place': return addPlace();
      case 'delete': return remove();
      case 'save': {
        if (!v.name.trim()) return;
        // 新しい場所はここで初めて作る（Cancel したときは何も作らない）
        const resolved = [];
        for (const l of links) {
          const placeId = l.pending
            ? (store.findSameNamePlace(l.pending.name) || store.addPlace(l.pending)).id
            : l.placeId;
          if (!resolved.some((r) => r.placeId === placeId)) resolved.push({ placeId, subShop: l.subShop });
        }
        store.updatePerson(person.id, v, resolved);
        return back(fallback);
      }
    }
  });

  drawPlaces();
}
