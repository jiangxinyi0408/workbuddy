// ============================================================
// utils.js - \u5de5\u5177\u51fd\u6570
// ============================================================

/** \u751f\u6210\u552f\u4e00 ID */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** \u683c\u5f0f\u5316\u65e5\u671f YYYY-MM-DD */
export function fmtDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** \u683c\u5f0f\u5316\u65f6\u95f4 HH:mm */
export function fmtTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** \u683c\u5f0f\u5316\u65e5\u671f\u65f6\u95f4 */
export function fmtDateTime(date) {
  return `${fmtDate(date)} ${fmtTime(date)}`;
}

/** \u83b7\u53d6\u4eca\u5929\u7684\u65e5\u671f\u5b57\u7b26\u4e32 */
export function today() {
  return fmtDate(new Date());
}

/** \u83b7\u53d6\u660e\u5929\u7684\u65e5\u671f\u5b57\u7b26\u4e32 */
export function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return fmtDate(d);
}

/** \u83b7\u53d6\u672c\u5468\u4e00\u65e5\u671f */
export function weekStart(date) {
  const d = date instanceof Date ? new Date(date) : new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** \u83b7\u53d6\u672c\u5468\u65e5\u65e5\u671f */
export function weekEnd(date) {
  const d = weekStart(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** \u83b7\u53d6\u672c\u5468\u65e5\u671f\u8303\u56f4 [\u5468\u4e00, \u5468\u65e5] */
export function weekRange(date) {
  return [fmtDate(weekStart(date)), fmtDate(weekEnd(date))];
}

/** \u83b7\u53d6\u65e5\u671f\u7684\u661f\u671f\u51e0\u4e2d\u6587\u540d */
export function weekdayName(date) {
  const names = ['\u5468\u65e5', '\u5468\u4e00', '\u5468\u4e8c', '\u5468\u4e09', '\u5468\u56db', '\u5468\u4e94', '\u5468\u516d'];
  const d = date instanceof Date ? date : new Date(date);
  return names[d.getDay()];
}

/** \u8ba1\u7b97\u4e24\u4e2a\u65f6\u95f4\u5b57\u7b26\u4e32\u4e4b\u95f4\u7684\u5c0f\u65f6\u6570 */
export function hoursBetween(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10;
}

/** \u53cb\u597d\u7684\u76f8\u5bf9\u65f6\u95f4 */
export function timeAgo(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '\u521a\u521a';
  if (diff < 3600) return `${Math.floor(diff / 60)}\u5206\u949f\u524d`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}\u5c0f\u65f6\u524d`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}\u5929\u524d`;
  return fmtDate(d);
}

/** \u6570\u5b57\u4fdd\u7559\u5c0f\u6570 */
export function round(num, decimals = 1) {
  const f = Math.pow(10, decimals);
  return Math.round(num * f) / f;
}

/** HTML \u8f6c\u4e49 */
export function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/** Toast \u63d0\u793a */
let toastTimer = null;
export function toast(msg, duration = 2000) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

/** \u786e\u8ba4\u5bf9\u8bdd\u6846 - \u8fd4\u56de Promise<boolean> */
export function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <p class="modal-msg">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button class="btn-cancel">\u53d6\u6d88</button>
          <button class="btn-ok">\u786e\u5b9a</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.btn-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('.btn-ok').onclick = () => { overlay.remove(); resolve(true); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

/** \u5f39\u51fa\u8f93\u5165\u5bf9\u8bdd\u6846 */
export function promptDialog(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <p class="modal-msg">${escapeHtml(message)}</p>
        <input class="modal-input" value="${escapeHtml(defaultValue)}">
        <div class="modal-actions">
          <button class="btn-cancel">\u53d6\u6d88</button>
          <button class="btn-ok">\u786e\u5b9a</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('.modal-input');
    input.focus();
    input.select();
    const ok = () => { overlay.remove(); resolve(input.value); };
    overlay.querySelector('.btn-cancel').onclick = () => { overlay.remove(); resolve(null); };
    overlay.querySelector('.btn-ok').onclick = ok;
    input.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  });
}

/** \u5e95\u90e8\u5f39\u51fa\u8868\u5355\u9762\u677f */
export function openBottomSheet(title, contentHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.innerHTML = `
    <div class="bottom-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="sheet-close">✕</button>
      </div>
      <div class="sheet-body">${contentHtml}</div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 300);
  };
  overlay.querySelector('.sheet-close').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  return { overlay, close };
}

/** \u6587\u4ef6\u8f6c base64 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** \u538b\u7f29\u56fe\u7247\u5230\u6307\u5b9a\u6700\u5927\u5bbd\u5ea6 */
export function compressImage(file, maxWidth = 800) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height / width) * maxWidth;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** \u83b7\u53d6 URL \u67e5\u8be2\u53c2\u6570 */
export function queryParam(name) {
  const params = new URLSearchParams(location.search);
  return params.get(name);
}

/** \u9632\u6296 */
export function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/** \u83b7\u53d6\u6708\u4efd\u5b57\u7b26\u4e32 YYYY-MM */
export function monthStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** \u4e0a\u4e2a\u6708 */
export function lastMonth(date) {
  const d = date instanceof Date ? new Date(date) : new Date();
  d.setMonth(d.getMonth() - 1);
  return monthStr(d);
}
