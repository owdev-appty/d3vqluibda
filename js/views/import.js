// Import from Notes：iPhoneメモの文章を貼り付けて取り込む
import * as store from '../store.js';
import { esc, parseNotes, parsePersonLine } from '../text.js';
import { toast } from '../ui.js';
import { back, go } from '../nav.js';

const NEXT = { shop: 'region', region: 'person', person: 'shop' };

let draft = ''; // 画面を離れても貼り付けた文章を残す

export default function importView(root) {
  root.innerHTML = `
    <div class="topbar">
      <div class="side"><button type="button" class="link-btn" data-act="cancel">Cancel</button></div>
      <div class="title">Import from Notes</div>
      <div class="side right"></div>
    </div>
    <p class="note-text import-lead">iPhoneメモの文章を貼り付けてください。見出しが県名ならRegion、それ以外はShopとして読み取ります。各行は「名前（特徴）」も「名前 特徴」もOKです。</p>
    <textarea class="textarea import-text" aria-label="Notes text" placeholder="お店の名前&#10;さきさん（めがね）&#10;たろうさん 常連&#10;&#10;福岡&#10;みきさん（帽子）"></textarea>
    <div class="preview-head"><span class="t">Preview</span><span class="count"></span></div>
    <div class="preview-list hidden"></div>
    <p class="hint import-tip">見出しのラベルをタップすると Shop → Region → Person と切り替わります</p>
    <div class="import-pad"></div>
    <div class="bottom-action"><button type="button" class="wide-btn primary" data-act="import" disabled>Import</button></div>`;

  const textarea = root.querySelector('textarea');
  const listEl = root.querySelector('.preview-list');
  const countEl = root.querySelector('.preview-head .count');
  const importBtn = root.querySelector('[data-act="import"]');

  let items = [];
  // 手で直した種類（同じ行の文章が変わらない限り覚えておく）
  const overrides = new Map();
  const keyOf = (i, it) => `${i}\u0000${it.text}`;

  function parse() {
    items = parseNotes(textarea.value).map((it, i) => ({ ...it, kind: overrides.get(keyOf(i, it)) || it.kind }));
  }

  // 見出しごとにまとめる。見出しより前の人は取り込めない（orphans）
  function groups() {
    const out = [];
    let orphans = 0;
    let cur = null;
    for (const it of items) {
      if (it.kind === 'person') {
        const p = parsePersonLine(it.text, { at: true });
        if (!p.name) continue;
        if (cur) cur.people.push(p);
        else orphans++;
      } else {
        cur = { type: it.kind, name: it.text.trim(), people: [] };
        out.push(cur);
      }
    }
    return { groups: out, orphans };
  }

  function draw() {
    const { groups: gs, orphans } = groups();
    const nPeople = gs.reduce((n, g) => n + g.people.length, 0);
    countEl.textContent = items.length
      ? `${gs.length} ${gs.length === 1 ? 'place' : 'places'} • ${nPeople} ${nPeople === 1 ? 'person' : 'people'}` : '';
    importBtn.disabled = !gs.length;
    listEl.classList.toggle('hidden', !items.length);

    let seenHeading = false;
    listEl.innerHTML = items.map((it, i) => {
      if (it.kind !== 'person') {
        seenHeading = true;
        const exists = store.findPlaceByName(it.text);
        return `
          <div class="pv-row heading">
            <button type="button" class="kind-btn" data-i="${i}" aria-label="Change type">
              ${it.kind === 'region' ? '<span class="region-label">Region</span>' : '<span class="shop-label">Shop</span>'}
            </button>
            <span class="pv-name">${esc(it.text)}</span>
            ${exists ? '<span class="hint">登録済みに追加</span>' : ''}
          </div>`;
      }
      const p = parsePersonLine(it.text, { at: true });
      return `
        <div class="pv-row ${seenHeading ? '' : 'orphan'}">
          <span class="who">${esc(p.name)}${p.subShop ? ` <span class="sub-tag">${esc(p.subShop)}</span>` : ''}</span>
          <span class="what">${esc(p.notes)}</span>
          <button type="button" class="kind-btn" data-i="${i}" aria-label="Change type"><span class="person-label">Person</span></button>
        </div>`;
    }).join('') + (orphans ? `<div class="pv-warn">最初の見出しより前の ${orphans} 行は取り込まれません。「Person」のラベルをタップして見出しにできます。</div>` : '');
  }

  // iOSでは keydown ではなく input イベントで読み直す
  textarea.addEventListener('input', () => { draft = textarea.value; parse(); draw(); });

  root.addEventListener('click', (e) => {
    const kb = e.target.closest('.kind-btn');
    if (kb) {
      const i = Number(kb.dataset.i);
      const it = items[i];
      it.kind = NEXT[it.kind];
      overrides.set(keyOf(i, it), it.kind);
      draw();
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'cancel') return back('#/settings');
    if (act === 'import') {
      const { groups: gs } = groups();
      if (!gs.length) return;
      const r = store.importGroups(gs);
      draft = '';
      toast(`取り込みました：${r.placesCreated} places・${r.peopleAdded} people`);
      go('#/', { replace: true });
    }
  });

  textarea.value = draft;
  parse();
  draw();
}
