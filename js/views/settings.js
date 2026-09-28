// Settings：バックアップ（書き出し・復元）とデータ
import * as store from '../store.js';
import { icon, confirmModal, alertModal, toast } from '../ui.js';
import { go } from '../nav.js';
import { VERSION } from '../version.js';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function lastBackupText() {
  const days = store.daysSinceBackup();
  if (days === null) return { main: 'Last backup: never', date: '' };
  const d = new Date(store.getSettings().lastBackupAt);
  const ago = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
  return { main: `Last backup: ${ago}`, date: `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` };
}

function download(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function settings(root) {
  root.innerHTML = `
    <div class="topbar">
      <button type="button" class="link-btn" data-act="home">${icon('back')}People list</button>
    </div>
    <h1 class="page-title">Settings</h1>

    <div class="section-label">Backup</div>
    <div class="card">
      <div class="backup-status">
        ${icon('clock')}
        <div><div class="main"></div><div class="date"></div></div>
      </div>
      <button type="button" class="wide-btn primary" data-act="export">${icon('share')}Export backup</button>
      <p class="hint">全データを1つのファイルに保存します。共有メニューから「ファイル」→ iCloud Driveに保存するのがおすすめです。</p>
    </div>
    <div class="card">
      <button type="button" class="wide-btn outline" data-act="restore">${icon('download')}Restore from backup</button>
      <p class="hint">バックアップファイルを選ぶと、今のデータと置き換わります（確認画面が出ます）。</p>
      <input type="file" accept=".json,application/json" class="hidden" aria-hidden="true" tabindex="-1">
    </div>

    <div class="section-label">Data</div>
    <div class="list-card">
      <button type="button" class="row" data-act="import"><span>Import from iPhone Notes</span>${icon('chevron')}</button>
      <div class="row"><span>Total</span><span class="value total"></span></div>
    </div>
    <p class="hint version">People v${VERSION}</p>`;

  const fileInput = root.querySelector('input[type=file]');

  function draw() {
    const t = lastBackupText();
    root.querySelector('.backup-status').classList.toggle('warn', store.backupDue());
    root.querySelector('.backup-status .main').textContent = t.main;
    root.querySelector('.backup-status .date').textContent = t.date;
    const { places, people } = store.totals();
    root.querySelector('.total').textContent =
      `${places} ${places === 1 ? 'place' : 'places'} • ${people} ${people === 1 ? 'person' : 'people'}`;
  }

  function exported(now) {
    store.markBackup(now);
    draw();
    toast('バックアップを書き出しました');
  }

  // iPhoneでは共有メニュー（Web Share API）で「ファイル」に保存。使えなければダウンロード。
  async function exportBackup() {
    const now = new Date();
    const file = new File([store.exportJSON()], `people-backup-${ymd(now)}.json`, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        exported(now);
      } catch (err) {
        if (err.name === 'AbortError') return; // 共有メニューを閉じただけ
        download(file);
        exported(now);
      }
      return;
    }
    download(file);
    exported(now);
  }

  async function restore(file) {
    let data;
    try {
      data = store.sanitize(JSON.parse(await file.text()));
    } catch (err) {
      await alertModal("Can't restore", err.message === 'newer'
        ? 'このバックアップは新しいバージョンのアプリで作られています。'
        : 'Peopleのバックアップファイルとして読み込めませんでした。');
      return;
    }
    const ok = await confirmModal({
      title: 'Replace all data?',
      body: ['Your current data will be replaced with this backup.', "This can't be undone."],
      note: `Backup: ${data.places.length} places • ${data.people.length} people`,
      confirmLabel: 'Replace',
    });
    if (!ok) return;
    store.replaceAll(data);
    draw();
    toast('バックアップから復元しました');
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // 同じファイルをもう一度選べるように
    if (file) restore(file);
  });

  root.addEventListener('click', (e) => {
    switch (e.target.closest('[data-act]')?.dataset.act) {
      case 'home': return go('#/', { restoreScroll: true });
      case 'export': return exportBackup();
      case 'restore': return fileInput.click();
      case 'import': return go('#/import');
    }
  });

  draw();
}
