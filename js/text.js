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

// ---------- 検索 ----------
// 同義語リスト：同じグループの言葉はまとめて検索します。ここに1行足せば反映されます。
// （カタカナ・全角・大文字の違いは自動で揃うので、ひらがなと漢字を並べれば十分）
export const SYNONYMS = [
  ['めがね', '眼鏡'],
  ['ひげ', '髭', '鬚'],
  ['ぼうし', '帽子'],
  ['しらが', '白髪'],
  ['きもの', '着物'],
  ['たばこ', '煙草'],
  ['ねこ', '猫'],
  ['いぬ', '犬'],
  ['だんな', '旦那'],
  ['おくさん', '奥さん'],
  ['ふうふ', '夫婦'],
  ['すし', '寿司', '鮨'],
  ['にほんしゅ', '日本酒'],
  ['おーなー', '店主'],
  ['たいしょう', '大将'],
  ['じょうれん', '常連'],
];
const SYN = SYNONYMS.map((g) => [...new Set(g.map(norm))]);

// 検索語をそろえ、同義語に置き換えたパターンも作る
export function expandTerm(term) {
  const n = norm(term).trim();
  const out = new Set(n ? [n] : []);
  if (!n) return [];
  for (const group of SYN) {
    for (const m of group) {
      if (!n.includes(m)) continue;
      for (const o of group) if (o !== m) out.add(n.split(m).join(o));
    }
  }
  return [...out];
}

// 入力を空白で区切った語ごとのパターン（すべての語に当てはまるものを探す）
export const parseQuery = (q) => (q || '').split(/\s+/).filter(Boolean).map(expandTerm).filter((v) => v.length);

// 揃えた文字列と、元の文字の位置の対応表
function normWithMap(s) {
  let out = '';
  const start = [];
  const end = [];
  let i = 0;
  for (const ch of s) {
    const n = norm(ch);
    for (let k = 0; k < n.length; k++) { start.push(i); end.push(i + ch.length); }
    out += n;
    i += ch.length;
  }
  return { out, start, end };
}

// text の中で、パターンに当たる範囲（元の文字列の位置）
export function findRanges(text, termsList) {
  if (!text) return [];
  const { out, start, end } = normWithMap(text);
  const ranges = [];
  for (const variants of termsList) {
    for (const v of variants) {
      let from = 0;
      let idx;
      while (v && (idx = out.indexOf(v, from)) >= 0) {
        ranges.push([start[idx], end[idx + v.length - 1]]);
        from = idx + 1;
      }
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

export const matchesAll = (text, termsList) => {
  const n = norm(text);
  return termsList.every((variants) => variants.some((v) => n.includes(v)));
};

// ヒット部分を <mark> で囲んだHTML。around を指定すると最初のヒットの少し前から切り出す。
export function highlight(text, ranges, { around = 0 } = {}) {
  let from = 0;
  let prefix = '';
  if (around && ranges.length && ranges[0][0] > around) {
    from = ranges[0][0] - around;
    prefix = '…';
  }
  let out = prefix;
  let pos = from;
  for (const [a, b] of ranges) {
    if (b <= from) continue;
    const s = Math.max(a, from);
    out += esc(text.slice(pos, s)) + `<mark>${esc(text.slice(s, b))}</mark>`;
    pos = b;
  }
  return out + esc(text.slice(pos));
}
