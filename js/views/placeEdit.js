// Shop / Region の登録・編集
import * as store from '../store.js';
import { esc, norm } from '../text.js';
import { confirmModal, sheet } from '../ui.js';
import { go, back, placeHash, redirect } from '../nav.js';
import { PREF_GROUPS, QUICK_PREFS, shortPref } from '../prefectures.js';

export default function placeEdit(root, { params, path }) {
  const isNew = path === '/new';
  const existing = isNew ? null : store.getPlace(params[0]);
  if (!isNew && !existing) { redirect('#/'); return; }

  const v = existing
    ? { ...existing }
    : { type: 'shop', name: '', reading: '', area: '', category: '', notes: '' };

  function draw() {
    const isRegion = v.type === 'region';
    root.className = isRegion ? 'region-form' : '';
    root.innerHTML = `
      <div class="topbar">
        <div class="side"><button type="button" class="link-btn" data-act="cancel">Cancel</button></div>
        <div class="title">${isRegion ? 'Region' : 'Shop'}</div>
        <div class="side right"><button type="button" class="pill-btn ${isRegion ? 'region' : ''}" data-act="save">Save</button></div>
      </div>
      ${isNew ? `
        <div class="segment wide" role="group" aria-label="Type">
          <button type="button" data-type="shop" class="${!isRegion ? 'on' : ''}">Shop</button>
          <button type="button" data-type="region" class="${isRegion ? 'on region' : ''}">Region</button>
        </div>` : ''}
      <div class="field">
        <label for="f-name">Name</label>
        <input id="f-name" class="input big" name="name" value="${esc(v.name)}" autocomplete="off"
          placeholder="${isRegion ? '県名や地名' : 'お店の名前'}">
        ${isRegion ? `
          <div class="chips pref-chips">
            ${QUICK_PREFS.map((p) => `<button type="button" class="chip region" data-pref="${p}">${p}</button>`).join('')}
            <button type="button" class="chip dashed" data-act="prefs">47都道府県</button>
          </div>
          <p class="hint">「台湾」「湯布院」など自由に入力もできます</p>` : ''}
      </div>
      ${!isRegion ? `
        <div class="field">
          <label for="f-reading">Reading<span class="opt">optional・漢字の店名だけ</span></label>
          <input id="f-reading" class="input" name="reading" value="${esc(v.reading)}" autocomplete="off" placeholder="よみがな">
          <p class="hint">Name順で並べるときに使います</p>
        </div>
        <div class="field">
          <label for="f-area">Area</label>
          <input id="f-area" class="input" name="area" value="${esc(v.area)}" autocomplete="off" placeholder="木屋町">
        </div>
        <div class="field">
          <div class="label">Type</div>
          <div class="chips" role="group" aria-label="Type">
            ${store.CATEGORIES.map((c) => `<button type="button" class="chip ${v.category === c ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('')}
          </div>
        </div>` : ''}
      <div class="field">
        <label for="f-notes">Notes</label>
        <textarea id="f-notes" class="textarea" name="notes" placeholder="${isRegion ? '旅行のメモなど' : '行き方など'}">${esc(v.notes)}</textarea>
      </div>
      ${!isNew ? `<button type="button" class="danger-soft" data-act="delete">Delete ${isRegion ? 'region' : 'shop'}</button>` : ''}`;
    sync();
  }

  // 入力のたびに値を取り込む（iOSでは keydown ではなく input を使う）
  function sync() {
    root.querySelector('[data-act="save"]').disabled = !v.name.trim();
    root.querySelectorAll('[data-pref]').forEach((b) => b.classList.toggle('on', b.dataset.pref === v.name.trim()));
  }
  root.addEventListener('input', (e) => {
    if (e.target.name in v) { v[e.target.name] = e.target.value; sync(); }
  });

  function setName(name) {
    v.name = name;
    root.querySelector('#f-name').value = name;
    sync();
  }

  function pickPrefecture() {
    sheet('47都道府県', (body, close) => {
      body.innerHTML = PREF_GROUPS.map(([label, list]) => `
        <div class="pref-group"><p class="hint">${label}</p>
          <div class="pref-grid">${list.map((p) => `<button type="button" class="chip region" data-p="${shortPref(p)}">${shortPref(p)}</button>`).join('')}</div>
        </div>`).join('');
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-p]');
        if (b) { setName(b.dataset.p); close(); }
      });
    });
  }

  async function remove() {
    const n = store.peopleOnlyAt(existing.id).length;
    const ok = await confirmModal({
      title: `Delete "${existing.name}"?`,
      body: [`${n} ${n === 1 ? 'person' : 'people'} will also be deleted.`, "This can't be undone."],
      note: 'People also saved in other places will be kept.',
    });
    if (!ok) return;
    store.deletePlace(existing.id);
    // 編集画面と消した場所の画面を飛ばしてホームへ
    back('#/', 2);
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.type) {
      v.type = t.dataset.type;
      draw();
      return;
    }
    if (t.dataset.cat) {
      v.category = v.category === t.dataset.cat ? '' : t.dataset.cat;
      root.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === v.category));
      return;
    }
    if (t.dataset.pref) return setName(t.dataset.pref);
    switch (t.dataset.act) {
      case 'prefs': return pickPrefecture();
      case 'cancel': return isNew ? back('#/') : back(placeHash(existing.id));
      case 'delete': return remove();
      case 'save': return save();
    }
  });

  // 同じ名前の場所があれば確認（新規登録と、名前を変えて保存したとき）
  async function save() {
    const name = v.name.trim();
    if (!name) return;
    const renamed = !isNew && norm(name) !== norm(existing.name.trim());
    if ((isNew || renamed) && store.findSameNamePlace(name, existing?.id)) {
      const ok = await confirmModal({
        title: `"${name}" already exists.`,
        body: [isNew ? 'Add it anyway?' : 'Save it anyway?'],
        confirmLabel: isNew ? 'Add anyway' : 'Save anyway',
        tone: 'primary',
      });
      if (!ok) return;
    }
    if (isNew) {
      const place = store.addPlace(v);
      // 保存後はその場所の画面へ。すぐ人を追加できるように入力欄にフォーカス
      go(`${placeHash(place.id)}?new=1`, { replace: true });
    } else {
      store.updatePlace(existing.id, v);
      back(placeHash(existing.id));
    }
  }

  draw();
  if (isNew) root.querySelector('#f-name').focus();
}
