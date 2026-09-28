// Search：入力のたびに絞り込み、場所ごとにまとめて表示
import * as store from '../store.js';
import { esc, parseQuery, matchesAll, findRanges, highlight } from '../text.js';
import { icon } from '../ui.js';
import { go, back, placeHash } from '../nav.js';

let lastQuery = ''; // 人を開いて戻ってきたときに検索語を残す

export default function search(root) {
  root.innerHTML = `
    <div class="search-head">
      <label class="search-field">
        ${icon('search')}
        <input type="search" size="1" enterkeyhint="search" placeholder="Search" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Search">
        <button type="button" class="clear-btn hidden" aria-label="Clear">${icon('x')}</button>
      </label>
      <button type="button" class="link-btn" data-act="close">Close</button>
    </div>
    <p class="hint">「めがね」「メガネ」「眼鏡」はまとめて検索します</p>
    <div class="results"></div>`;

  const input = root.querySelector('input');
  const clearBtn = root.querySelector('.clear-btn');
  const results = root.querySelector('.results');

  function run() {
    const q = input.value;
    lastQuery = q;
    clearBtn.classList.toggle('hidden', !q);
    const terms = parseQuery(q);
    if (!terms.length) { results.innerHTML = ''; return; }

    const groups = [];
    const hitPeople = new Set();
    for (const place of store.placesInOrder()) {
      const rows = [];
      for (const { person, link } of store.peopleAt(place.id)) {
        const hay = [person.name, person.fullName, person.notes, place.name, link.subShop].join('\n');
        if (!matchesAll(hay, terms)) continue;
        rows.push({ person, link });
        hitPeople.add(person.id);
      }
      if (rows.length) groups.push({ place, rows });
    }

    if (!groups.length) {
      results.innerHTML = '<p class="empty">見つかりませんでした</p>';
      return;
    }
    const n = hitPeople.size;
    results.innerHTML = `<p class="result-count">${n} ${n === 1 ? 'person' : 'people'}</p>` +
      groups.map(({ place, rows }) => `
        <h2 class="group-title" data-place="${esc(place.id)}">
          <span>${highlight(place.name, findRanges(place.name, terms))}</span>
          ${place.type === 'region' ? '<span class="region-label">Region</span>' : ''}
        </h2>
        <div class="people-list">
          ${rows.map(({ person, link }) => {
            const noteHits = findRanges(person.notes, terms);
            const fullHits = findRanges(person.fullName, terms);
            // メモにヒットがあればそこを、なければ本名、どちらもなければメモの先頭を表示
            let detail = '';
            if (noteHits.length || !fullHits.length) detail = highlight(person.notes, noteHits, { around: 8 });
            else detail = highlight(person.fullName, fullHits);
            return `
              <div class="person-row result-row" data-id="${esc(person.id)}" data-from="${esc(place.id)}">
                <div class="body">
                  <div class="pname"><span>${highlight(person.name, findRanges(person.name, terms))}</span>${
                    link.subShop ? `<span class="sub-tag">${highlight(link.subShop, findRanges(link.subShop, terms))}</span>` : ''}</div>
                  ${detail ? `<div class="pnotes">${detail}</div>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>`).join('');
  }

  // iOSでは keydown ではなく input イベントで検索する
  input.addEventListener('input', run);

  root.addEventListener('click', (e) => {
    if (e.target.closest('.clear-btn')) {
      e.preventDefault();
      input.value = '';
      run();
      input.focus();
      return;
    }
    if (e.target.closest('[data-act="close"]')) { lastQuery = ''; return back('#/'); }
    const title = e.target.closest('.group-title');
    if (title) return go(placeHash(title.dataset.place));
    const row = e.target.closest('.result-row');
    if (row) go(`#/person/${encodeURIComponent(row.dataset.id)}?from=${encodeURIComponent(row.dataset.from)}`);
  });

  input.value = lastQuery;
  run();
  if (!lastQuery) input.focus();
}
