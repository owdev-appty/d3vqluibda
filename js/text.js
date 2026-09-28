// 文字の揃え方・名前順・入力の解析

// カタカナ → ひらがな
export const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

// 比較用に揃える：全角→半角（NFKC）、大文字→小文字、カタカナ→ひらがな
export const norm = (s) => toHira((s || '').normalize('NFKC').toLowerCase());

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Name 順 ----------
// 先頭の文字で グループ分け：かな → 読みのない漢字 → A〜Z → その他（数字・記号）
const collator = new Intl.Collator('ja');

function groupOf(ch) {
  if (/[ぁ-ゖゝゞ]/.test(ch)) return 0;
  if (/[㐀-䶿一-鿿豈-﫿々]/.test(ch)) return 1;
  if (/[a-z]/.test(ch)) return 2;
  return 3;
}

export function nameKey(place) {
  return norm(place.reading || place.name).trim();
}

export function compareByName(a, b) {
  const ka = nameKey(a);
  const kb = nameKey(b);
  const ga = groupOf(ka.charAt(0));
  const gb = groupOf(kb.charAt(0));
  if (ga !== gb) return ga - gb;
  return collator.compare(ka, kb) || a.order - b.order;
}

// ---------- 「名前（メモ）＠お店」の解析 ----------
// - 全角・半角のカッコどちらも可。カッコ内がメモ（閉じカッコの後ろに文字があればメモに続ける）
// - カッコがなければ最初の空白（全角・半角）で 名前 / メモ に分ける
// - at: true のとき、最後の ＠/@ 以降をお店名（subShop）にする
export function parsePersonLine(input, { at = false } = {}) {
  let s = (input || '').trim();
  let subShop = '';
  if (at) {
    const i = Math.max(s.lastIndexOf('@'), s.lastIndexOf('＠'));
    if (i >= 0) {
      subShop = s.slice(i + 1).trim();
      s = s.slice(0, i).trim();
    }
  }
  let name = s;
  let notes = '';
  const open = s.search(/[（(]/);
  if (open > 0) {
    name = s.slice(0, open).trim();
    let rest = s.slice(open + 1);
    const close = Math.max(rest.lastIndexOf('）'), rest.lastIndexOf(')'));
    if (close >= 0) {
      const after = rest.slice(close + 1).trim();
      rest = rest.slice(0, close).trim();
      notes = [rest, after].filter(Boolean).join(' ');
    } else {
      notes = rest.trim();
    }
  } else if (open < 0) {
    const m = s.match(/^(\S+)\s+([\s\S]+)$/); // \s は全角スペースも含む
    if (m) {
      name = m[1];
      notes = m[2].trim();
    }
  }
  return { name, notes, subShop };
}
