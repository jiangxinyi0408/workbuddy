// ============================================================
// utils.js - 工具函数
// ============================================================

/** 生成唯一 ID */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 格式化日期 YYYY-MM-DD */
export function fmtDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 格式化时间 HH:mm */
export function fmtTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 格式化日期时间 */
export function fmtDateTime(date) {
  return `${fmtDate(date)} ${fmtTime(date)}`;
}

/** 获取今天的日期字符串 */
export function today() {
  return fmtDate(new Date());
}

/** 获取明天的日期字符串 */
export function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return fmtDate(d);
}

/** 获取本周一日期 */
export function weekStart(date) {
  const d = date instanceof Date ? new Date(date) : new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 获取本周日日期 */
export function weekEnd(date) {
  const d = weekStart(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** 获取本周日期范围 [周一, 周日] */
export function weekRange(date) {
  return [fmtDate(weekStart(date)), fmtDate(weekEnd(date))];
}

/** 获取日期的星期几中文名 */
export function weekdayName(date) {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const d = date instanceof Date ? date : new Date(date);
  return names[d.getDay()];
}

/** 计算两个时间字符串之间的小时数 */
export function hoursBetween(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10;
}

/** 友好的相对时间 */
export function timeAgo(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
  return fmtDate(d);
}

/** 数字保留小数 */
export function round(num, decimals = 1) {
  const f = Math.pow(10, decimals);
  return Math.round(num * f) / f;
}

/** HTML 转义 */
export function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/** Toast 提示 */
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

/** 确认对话框 - 返回 Promise<boolean> */
export function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <p class="modal-msg">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button class="btn-cancel">取消</button>
          <button class="btn-ok">确定</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.btn-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('.btn-ok').onclick = () => { overlay.remove(); resolve(true); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

/** 弹出输入对话框 */
export function promptDialog(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <p class="modal-msg">${escapeHtml(message)}</p>
        <input class="modal-input" value="${escapeHtml(defaultValue)}">
        <div class="modal-actions">
          <button class="btn-cancel">取消</button>
          <button class="btn-ok">确定</button>
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

/** 底部弹出表单面板 */
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

/** 文件转 base64 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 压缩图片到指定最大宽度 */
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

/** 获取 URL 查询参数 */
export function queryParam(name) {
  const params = new URLSearchParams(location.search);
  return params.get(name);
}

/** 防抖 */
export function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/** 获取月份字符串 YYYY-MM */
export function monthStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 上个月 */
export function lastMonth(date) {
  const d = date instanceof Date ? new Date(date) : new Date();
  d.setMonth(d.getMonth() - 1);
  return monthStr(d);
}
