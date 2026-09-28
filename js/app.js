import { VERSION } from './version.js';

const app = document.getElementById('app');
app.innerHTML = `
  <div class="home-head">
    <h1><svg viewBox="0 0 64 48" aria-hidden="true"><circle cx="14" cy="17" r="7.5"/><circle cx="50" cy="17" r="7.5"/><circle cx="32" cy="12" r="9"/><path d="M3 46C3 36 7 29 15 28C18 28 19 30 18 32C15 37 14 41 14 46Z"/><path d="M61 46C61 36 57 29 49 28C46 28 45 30 46 32C49 37 50 41 50 46Z"/><path d="M17 46C17 34 23 25 32 25C41 25 47 34 47 46Z"/></svg>People list</h1>
  </div>
  <p class="empty">準備中です（v${VERSION}）</p>`;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
