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
    ['history.html', 'Tarix'],
  ];
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.innerHTML = items.map(([href, label]) =>
    `<a href="${href}" class="${active === href ? 'active' : ''}">${label}</a>`
  ).join('');
}

// Tahrirlash yoki o'chirish kabi muhim amallar uchun tasodifiy 4 xonali
// tasdiqlash kodi ko'rsatadi va foydalanuvchi shu kodni kiritgandan keyingina
// amalni davom ettiradi. resolve(true) — tasdiqlandi, resolve(false) — bekor qilindi.
function askConfirmCode(title, subtitle) {
  return new Promise((resolve) => {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
      <div class="modal confirm-modal">
        <div class="confirm-icon">🔐</div>
        <h3>${title}</h3>
        <p class="muted" style="margin-top:-4px">${subtitle || 'Amalni tasdiqlash uchun quyidagi kodni kiriting'}</p>
        <div class="confirm-code-display">${code}</div>
        <input id="confirmCodeInput" maxlength="4" inputmode="numeric" placeholder="4 xonali kodni kiriting" class="confirm-code-input" autocomplete="off">
        <div class="confirm-error" id="confirmCodeError"></div>
        <div style="display:flex; gap:10px; margin-top:14px;">
          <button type="button" class="btn danger" id="confirmCodeOk">✔ Tasdiqlash</button>
          <button type="button" class="btn secondary" id="confirmCodeCancel">Bekor qilish</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#confirmCodeInput');
    const err = overlay.querySelector('#confirmCodeError');
    setTimeout(() => input.focus(), 50);

    function finish(result) {
      overlay.remove();
      resolve(result);
    }
    overlay.querySelector('#confirmCodeCancel').onclick = () => finish(false);
    overlay.querySelector('#confirmCodeOk').onclick = () => {
      if (input.value.trim() === code) {
        finish(true);
      } else {
        err.textContent = "Kod noto'g'ri, qaytadan urinib ko'ring";
        input.value = '';
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 400);
        input.focus();
      }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); overlay.querySelector('#confirmCodeOk').click(); }
      if (e.key === 'Escape') finish(false);
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
  });
}

function fmtDate(s) {
  if (!s) return '';
  return s.replace('T', ' ').slice(0, 16);
}
