// データの読み書きはすべてこのモジュールを通す。
// 画面側は state を直接書き換えず、ここの関数を使うこと（将来のAI機能もここに足す）。
import { compareByName, norm } from './text.js';

const KEY = 'people.v1';
export const CATEGORIES = ['居酒屋', 'バー', '立ち飲み', 'その他'];

let state = null;
const errorHandlers = new Set();

function emptyState() {
  return { version: 1, places: [], people: [], settings: { sortMode: 'custom', peopleSortMode: 'custom', lastBackupAt: null } };
}

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const str = (v) => (typeof v === 'string' ? v : '');
const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
const isDate = (v) => typeof v === 'string' && !isNaN(Date.parse(v));
const nowISO = () => new Date().toISOString();

// addedAt がない古いデータ用：データ上の登録順（people配列・linksの順）で、実際の日時より古い日時を割り当てる
const LEGACY_BASE = Date.UTC(2000, 0, 1);

// 読み込んだ／復元するデータを検査して整える。形が違えば例外。
export function sanitize(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.places) || !Array.isArray(raw.people)) {
    throw new Error('invalid');
  }
  if (Number.isFinite(raw.version) && raw.version > 1) throw new Error('newer');

  const seenPlaces = new Set();
  const places = [];
  raw.places.forEach((p, i) => {
    if (!p || typeof p.id !== 'string' || seenPlaces.has(p.id) || !str(p.name).trim()) return;
    seenPlaces.add(p.id);
    const type = p.type === 'region' ? 'region' : 'shop';
    places.push({
      id: p.id,
      type,
      name: str(p.name).trim(),
      reading: str(p.reading).trim(),
      area: type === 'shop' ? str(p.area).trim() : '',
      category: type === 'shop' && CATEGORIES.includes(p.category) ? p.category : '',
      notes: str(p.notes),
      order: num(p.order, i),
    });
  });

  const seenPeople = new Set();
  const people = [];
  let legacy = 0;
  raw.people.forEach((p) => {
    if (!p || typeof p.id !== 'string' || seenPeople.has(p.id) || !str(p.name).trim()) return;
    const linked = new Set();
    const links = [];
    (Array.isArray(p.links) ? p.links : []).forEach((l, i) => {
      if (!l || !seenPlaces.has(l.placeId) || linked.has(l.placeId)) return;
      linked.add(l.placeId);
      links.push({
        placeId: l.placeId,
        order: num(l.order, i),
        subShop: str(l.subShop).trim(),
        // 日時として読めるものは ISO 形式にそろえる（値は変えない）。読めなければ古い扱いの日時を割り当てる
        addedAt: isDate(l.addedAt) ? new Date(l.addedAt).toISOString() : new Date(LEGACY_BASE + legacy * 1000).toISOString(),
      });
      legacy++;
    });
    if (!links.length) return;
    seenPeople.add(p.id);
    people.push({ id: p.id, name: str(p.name).trim(), fullName: str(p.fullName).trim(), notes: str(p.notes), links });
  });

  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  return {
    version: 1,
    places,
    people,
    settings: {
      sortMode: s.sortMode === 'name' ? 'name' : 'custom',
      peopleSortMode: s.peopleSortMode === 'newest' ? 'newest' : 'custom',
      lastBackupAt: isDate(s.lastBackupAt) ? s.lastBackupAt : null,
    },
  };
}

// 読み込めなかった元のデータ／整える前の元のデータの退避先（people.v1 とは別のキー）
const UNREADABLE_KEY = `${KEY}.unreadable`;
const BEFORE_CLEANUP_KEY = `${KEY}.before-cleanup`;

// 保存データを読み込めなかったとき true。元のデータを上書きしないよう保存を止める（Restore で解除）
let readOnly = false;
export const isReadOnly = () => readOnly;

// 整えたときに取り除かれた項目があるか（addedAt の補完など、足すだけの変更は含めない）
function droppedSomething(raw, clean) {
  const linkCount = (people) => people.reduce((n, p) => n + (Array.isArray(p?.links) ? p.links.length : 0), 0);
  return raw.places.length !== clean.places.length
    || raw.people.length !== clean.people.length
    || linkCount(raw.people) !== linkCount(clean.people);
}

export function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    console.error(e);
  }
  if (!raw) {
    state = emptyState();
    return state;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
    state = sanitize(parsed);
  } catch (e) {
    // 壊れている・新しい形式など：空で起動するが、元のデータは消さずに退避し、保存を止める
    console.error(e);
    try { localStorage.setItem(UNREADABLE_KEY, raw); } catch (e2) { console.error(e2); }
    readOnly = true;
    state = emptyState();
    return state;
  }
  if (JSON.stringify(state) !== raw) {
    // 補完した値（addedAt など）を保存しておく。取り除いた項目があれば、先に元のデータを退避する
    if (droppedSomething(parsed, state)) {
      try {
        localStorage.setItem(BEFORE_CLEANUP_KEY, raw);
      } catch (e) {
        console.error(e);
        return state; // 退避できないときは上書きしない（画面には整えたデータを表示）
      }
    }
    commit();
  }
  return state;
}

// 保存に失敗したとき（容量不足など）に画面へ知らせる
export function onError(fn) { errorHandlers.add(fn); }

function commit() {
  if (readOnly) {
    const e = new Error('readonly');
    errorHandlers.forEach((fn) => fn(e));
    return false;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error(e);
    errorHandlers.forEach((fn) => fn(e));
    return false;
  }
}

// ---------- 読み取り ----------

export const getState = () => state;
export const getSettings = () => state.settings;
export const getPlace = (id) => state.places.find((p) => p.id === id) || null;
export const getPerson = (id) => state.people.find((p) => p.id === id) || null;

export function placesInOrder(mode = state.settings.sortMode) {
  const arr = [...state.places];
  if (mode === 'name') arr.sort(compareByName);
  else arr.sort((a, b) => a.order - b.order);
  return arr;
}

// その場所にいる人。[{ person, link }]
// mode 'custom'：手動の並び順 / 'newest'：その場所に登録した日時が新しい順（同じ日時ならデータ上あとの人が上）
export function peopleAt(placeId, mode = 'custom') {
  const out = [];
  state.people.forEach((person, index) => {
    const link = person.links.find((l) => l.placeId === placeId);
    if (link) out.push({ person, link, index });
  });
  if (mode === 'newest') {
    out.sort((a, b) => Date.parse(b.link.addedAt) - Date.parse(a.link.addedAt) || b.index - a.index);
  } else {
    out.sort((a, b) => a.link.order - b.link.order);
  }
  return out;
}

export const countAt = (placeId) => state.people.filter((p) => p.links.some((l) => l.placeId === placeId)).length;

// Region 内のお店名（登場順・重複なし）
export function subShopsOf(placeId) {
  const seen = new Set();
  for (const { link } of peopleAt(placeId)) {
    if (link.subShop && !seen.has(link.subShop)) seen.add(link.subShop);
  }
  return [...seen];
}

// その場所にしか登録されていない人（場所を消すと一緒に消える人）
export const peopleOnlyAt = (placeId) =>
  state.people.filter((p) => p.links.length === 1 && p.links[0].placeId === placeId);

export const totals = () => ({ places: state.places.length, people: state.people.length });

export function findPlaceByName(name) {
  const n = name.trim();
  return state.places.find((p) => p.name === n) || null;
}

// 同じ名前の場所（検索と同じ揃え方：かな・全角半角・大小文字・前後の空白を無視）。excludeId は自分自身。
export function findSameNamePlace(name, excludeId = null) {
  const n = norm(name).trim();
  if (!n) return null;
  return state.places.find((p) => p.id !== excludeId && norm(p.name).trim() === n) || null;
}

// ---------- 場所 ----------

function cleanPlace(data, type) {
  return {
    name: str(data.name).trim(),
    reading: type === 'shop' ? str(data.reading).trim() : '',
    area: type === 'shop' ? str(data.area).trim() : '',
    category: type === 'shop' && CATEGORIES.includes(data.category) ? data.category : '',
    notes: str(data.notes).trim(),
  };
}

export function addPlace(data) {
  const type = data.type === 'region' ? 'region' : 'shop';
  const order = state.places.reduce((m, p) => Math.max(m, p.order), -1) + 1;
  const place = { id: uid(), type, ...cleanPlace(data, type), order };
  state.places.push(place);
  commit();
  return place;
}

export function updatePlace(id, data) {
  const place = getPlace(id);
  if (!place) return null;
  Object.assign(place, cleanPlace(data, place.type));
  commit();
  return place;
}

export function deletePlace(id) {
  state.places = state.places.filter((p) => p.id !== id);
  state.people = state.people
    .filter((p) => !(p.links.length === 1 && p.links[0].placeId === id))
    .map((p) => ({ ...p, links: p.links.filter((l) => l.placeId !== id) }));
  commit();
}

// 表示中の一部（絞り込み中など）を並べ替えたとき、ほかの項目の位置はそのままにする
function mergeOrder(allInOrder, visibleIds) {
  const visible = new Set(visibleIds);
  const queue = [...visibleIds];
  return allInOrder.map((id) => (visible.has(id) ? queue.shift() : id));
}

export function reorderPlaces(visibleIds) {
  const merged = mergeOrder(placesInOrder('custom').map((p) => p.id), visibleIds);
  merged.forEach((id, i) => { getPlace(id).order = i; });
  commit();
}

export function reorderPeople(placeId, visibleIds) {
  const merged = mergeOrder(peopleAt(placeId).map(({ person }) => person.id), visibleIds);
  merged.forEach((id, i) => { getPerson(id).links.find((l) => l.placeId === placeId).order = i; });
  commit();
}

// ---------- 人 ----------

function nextOrderAt(placeId) {
  return peopleAt(placeId).reduce((m, { link }) => Math.max(m, link.order), -1) + 1;
}

export function addPerson(data, placeId, subShop = '') {
  const person = {
    id: uid(),
    name: str(data.name).trim(),
    fullName: str(data.fullName).trim(),
    notes: str(data.notes).trim(),
    links: [{ placeId, order: nextOrderAt(placeId), subShop: str(subShop).trim(), addedAt: nowISO() }],
  };
  state.people.push(person);
  commit();
  return person;
}

// links: [{ placeId, subShop }]（順番と登録日時は既存のものを引き継ぎ、新しい場所では末尾・今の日時）
export function updatePerson(id, data, links) {
  const person = getPerson(id);
  if (!person) return null;
  person.name = str(data.name).trim();
  person.fullName = str(data.fullName).trim();
  person.notes = str(data.notes).trim();
  if (links && links.length) {
    person.links = links.map(({ placeId, subShop }) => {
      const old = person.links.find((l) => l.placeId === placeId);
      return old
        ? { placeId, order: old.order, subShop: str(subShop).trim(), addedAt: old.addedAt }
        : { placeId, order: nextOrderAt(placeId), subShop: str(subShop).trim(), addedAt: nowISO() };
    });
  }
  commit();
  return person;
}

export function deletePerson(id) {
  state.people = state.people.filter((p) => p.id !== id);
  commit();
}

// ---------- 設定・バックアップ ----------

export function setSortMode(mode) {
  state.settings.sortMode = mode === 'name' ? 'name' : 'custom';
  commit();
}

// People here の並び順（全場所共通）
export function setPeopleSortMode(mode) {
  state.settings.peopleSortMode = mode === 'newest' ? 'newest' : 'custom';
  commit();
}

export const exportJSON = () => JSON.stringify(state, null, 2);

export function markBackup(date = new Date()) {
  state.settings.lastBackupAt = date.toISOString();
  commit();
}

// 復元：検査済みのデータで全部置き換える。バックアップ日時は今の端末の値を残す。
// 読み込めなかったデータ（退避済み）があるときも、復元すれば保存を再開する。
export function replaceAll(data) {
  const clean = sanitize(data);
  clean.settings.lastBackupAt = state.settings.lastBackupAt || clean.settings.lastBackupAt;
  state = clean;
  readOnly = false;
  commit();
}

// メモからの取り込み。groups: [{ type, name, people: [{ name, notes, subShop }] }]
// 同じ名前の場所があればそこに追加。同じ場所に同じ名前・メモの人がいれば飛ばす。
export function importGroups(groups) {
  let placesCreated = 0;
  let peopleAdded = 0;
  for (const g of groups) {
    const name = g.name.trim();
    if (!name) continue;
    let place = findPlaceByName(name);
    if (!place) {
      const type = g.type === 'region' ? 'region' : 'shop';
      const order = state.places.reduce((m, p) => Math.max(m, p.order), -1) + 1;
      place = { id: uid(), type, ...cleanPlace({ name }, type), order };
      state.places.push(place);
      placesCreated++;
    }
    const existing = peopleAt(place.id);
    for (const p of g.people) {
      const pname = p.name.trim();
      if (!pname) continue;
      const notes = (p.notes || '').trim();
      if (existing.some(({ person }) => person.name === pname && person.notes === notes)) continue;
      const person = {
        id: uid(), name: pname, fullName: '', notes,
        links: [{
          placeId: place.id,
          order: nextOrderAt(place.id),
          subShop: place.type === 'region' ? (p.subShop || '').trim() : '',
          addedAt: nowISO(),
        }],
      };
      state.people.push(person);
      existing.push({ person, link: person.links[0] });
      peopleAdded++;
    }
  }
  commit();
  return { placesCreated, peopleAdded };
}

// 最後のバックアップから何日たったか（日付の差）。一度もなければ null。
export function daysSinceBackup(now = new Date()) {
  const t = state.settings.lastBackupAt;
  if (!t) return null;
  const d = new Date(t);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / 864e5));
}

// データがあって、14日以上（または一度も）バックアップしていない
export function backupDue() {
  if (!state.people.length && !state.places.length) return false;
  const days = daysSinceBackup();
  return days === null || days >= 14;
}
