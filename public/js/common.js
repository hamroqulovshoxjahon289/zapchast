async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Xatolik yuz berdi' }));
    throw new Error(err.error || 'Xatolik yuz berdi');
  }
  return res.json();
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function renderNav(active) {
  const items = [
    ['index.html', 'Bosh sahifa'],
    ['categories.html', 'Kategoriyalar'],
    ['parts.html', 'Zapchastlar'],
    ['models.html', 'Modellar'],
    ['workers.html', 'Ishchilar'],
    ['pick.html', 'Terish jarayoni'],
    ['cargo-items.html', 'Yuk narsalari'],
    ['loading.html', 'Yuklash jarayoni'],
    ['warehouse.html', 'Ombor'],
    ['stats.html', 'Statistika'],
    ['history.html', 'Tarix'],
    ['settings.html', 'Sozlamalar'],
  ];
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.innerHTML = items.map(([href, label]) =>
    `<a href="${href}" class="${active === href ? 'active' : ''}">${label}</a>`
  ).join('');
}

function fmtDate(s) {
  if (!s) return '';
  // Baza vaqtni +5 soat (Toshkent) bilan saqlaydi, shuning uchun to'g'ridan-to'g'ri ko'rsatamiz
  const [datePart, timePart] = s.split(' ');
  if (!datePart || !timePart) return s;
  const [y, m, d] = datePart.split('-');
  return `${d}.${m}.${y} ${timePart.slice(0, 5)}`;
}

// ---- Tungi/kunduzgi rejim (dark/light theme) ----
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = saved === 'light' ? '🌙' : '☀️';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'light' ? '🌙' : '☀️';
}

initTheme();

// ---- Termal printer / A4 chop etish rejimi (yorliqlar uchun umumiy) ----
function initThermalControls(controlsContainerId, gridId) {
  const container = document.getElementById(controlsContainerId);
  container.insertAdjacentHTML('beforeend', `
    <div style="margin-top:12px; display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
      <label style="display:flex; align-items:center; gap:6px; text-transform:none; font-weight:400; font-size:14px; margin:0;">
        <input type="radio" name="printMode" value="a4" checked onchange="applyPrintMode('${gridId}')" style="width:auto; margin:0;"> A4 varaqda (bir necha ustun)
      </label>
      <label style="display:flex; align-items:center; gap:6px; text-transform:none; font-weight:400; font-size:14px; margin:0;">
        <input type="radio" name="printMode" value="thermal" onchange="applyPrintMode('${gridId}')" style="width:auto; margin:0;"> Termal printer (bitta-bitta)
      </label>
      <span id="thermalSizeInputs" style="display:none; gap:6px; align-items:center;">
        <input type="number" id="thermalW" value="40" style="width:64px; margin:0" onchange="applyPrintMode('${gridId}')"> x
        <input type="number" id="thermalH" value="30" style="width:64px; margin:0" onchange="applyPrintMode('${gridId}')"> mm
      </span>
    </div>
  `);
}

function applyPrintMode(gridId) {
  const mode = document.querySelector('input[name="printMode"]:checked').value;
  const sizeInputs = document.getElementById('thermalSizeInputs');
  if (sizeInputs) sizeInputs.style.display = mode === 'thermal' ? 'inline-flex' : 'none';
  let styleTag = document.getElementById('dynamicPrintStyle');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dynamicPrintStyle';
    document.head.appendChild(styleTag);
  }
  if (mode === 'thermal') {
    const w = document.getElementById('thermalW').value || 40;
    const h = document.getElementById('thermalH').value || 30;
    styleTag.textContent = `
      @page { size: ${w}mm ${h}mm; margin: 0; }
      #${gridId} { display: block !important; }
      #${gridId} .label-card {
        width: ${w}mm; height: ${h}mm;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        page-break-after: always; border: none !important;
        box-sizing: border-box; margin: 0 auto;
      }
    `;
  } else {
    styleTag.textContent = '';
  }
}

// ---- PIN kod tizimi (qo'shish/tahrirlash/o'chirish uchun) ----
const pinLabels = { create: 'Qo\'shish', edit: 'Tahrirlash', delete: 'O\'chirish' };

function ensurePinModal() {
  let overlay = document.getElementById('pinOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'pinOverlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal pin-modal">
      <h3 id="pinTitle">Kodni kiriting</h3>
      <p class="muted" id="pinSub"></p>
      <input id="pinInput" type="password" maxlength="4" inputmode="numeric" autocomplete="off" placeholder="••••">
      <p id="pinError" class="pin-error" style="display:none">Kod noto'g'ri, qayta urinib ko'ring</p>
      <div style="display:flex; gap:10px; margin-top:16px; justify-content:center;">
        <button class="btn" id="pinOk">Tasdiqlash</button>
        <button class="btn secondary" id="pinCancel">Bekor qilish</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function askPin(type) {
  const overlay = ensurePinModal();
  document.getElementById('pinTitle').textContent = `${pinLabels[type] || ''} uchun kod`;
  document.getElementById('pinSub').textContent = '4 xonali tasdiqlash kodini kiriting';
  const input = document.getElementById('pinInput');
  const errorEl = document.getElementById('pinError');
  input.value = '';
  errorEl.style.display = 'none';
  overlay.classList.add('show');
  setTimeout(() => input.focus(), 60);

  return new Promise((resolve) => {
    const okBtn = document.getElementById('pinOk');
    const cancelBtn = document.getElementById('pinCancel');
    function cleanup(val) {
      overlay.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      resolve(val);
    }
    function onOk() {
      const val = input.value.trim();
      if (val.length !== 4) { errorEl.textContent = '4 xonali kod kiriting'; errorEl.style.display = 'block'; return; }
      cleanup(val);
    }
    function onCancel() { cleanup(null); }
    function onKey(e) { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
  });
}

// Foydalanuvchidan kod so'raydi, serverda tekshiradi, to'g'ri bo'lsa amalni bajaradi.
// type: 'create' | 'edit' | 'delete'
async function withPin(type, action) {
  const pin = await askPin(type);
  if (pin === null) return false;
  try {
    const r = await fetch('/api/settings/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, code: pin })
    });
    const data = await r.json();
    if (!data.ok) { toast('Kod noto\'g\'ri'); return false; }
  } catch (e) {
    toast('Tekshirishda xatolik'); return false;
  }
  await action(pin);
  return true;
}
