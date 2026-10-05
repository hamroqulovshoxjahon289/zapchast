const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, logHistory, checkPin } = require('../db');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'part_' + Date.now() + ext);
  }
});
const upload = multer({ storage });

function nextCode() {
  const rows = db.prepare('SELECT code FROM parts').all();
  const used = new Set(rows.map(r => parseInt(r.code, 10)));
  for (let i = 1; i <= 9999; i++) {
    if (!used.has(i)) return String(i).padStart(4, '0');
  }
  return null;
}

// Avtomatik unikal shtrix-kod generatsiya qilish (agar admin o'zi kiritmasa).
// Format: 200 (ichki prefiks) + 4 xonali part kodi + tekshiruv raqami = 8 xonali unikal kod.
function generateBarcode(partCode) {
  const base = '200' + partCode.padStart(4, '0'); // 7 ta raqam
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    const digit = parseInt(base[i], 10);
    sum += (i % 2 === 0) ? digit * 3 : digit;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check; // 8 xonali barcode
}

function uniqueBarcode(partCode) {
  let candidate = generateBarcode(partCode);
  let existing = db.prepare('SELECT id FROM parts WHERE barcode=?').get(candidate);
  let attempt = 0;
  while (existing && attempt < 20) {
    // juda kam uchraydigan holat uchun random tail qo'shamiz
    candidate = generateBarcode(partCode) + String(Math.floor(Math.random() * 9));
    existing = db.prepare('SELECT id FROM parts WHERE barcode=?').get(candidate);
    attempt++;
  }
  return candidate;
}

router.get('/next-code', (req, res) => {
  res.json({ code: nextCode() });
});

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM parts WHERE active=1 ORDER BY name').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM parts WHERE id=?').get(req.params.id);
  res.json(row);
});

router.post('/', upload.single('photo'), (req, res) => {
  const { name, code, barcode, has_length, has_quantity, has_weight, pin } = req.body;
  if (!checkPin('create', pin)) return res.status(403).json({ error: 'Qo\'shish kodi noto\'g\'ri' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nomi kiritilmadi' });
  const finalCode = (code && code.trim()) ? code.trim() : nextCode();
  const finalBarcode = (barcode && barcode.trim()) ? barcode.trim() : uniqueBarcode(finalCode);
  const photo = req.file ? '/uploads/' + req.file.filename : null;
  try {
    const info = db.prepare(`INSERT INTO parts (name, code, barcode, has_length, has_quantity, has_weight, photo)
      VALUES (?,?,?,?,?,?,?)`).run(
      name.trim(), finalCode, finalBarcode,
      has_length === 'true' || has_length === true ? 1 : 0,
      has_quantity === 'true' || has_quantity === true ? 1 : 0,
      has_weight === 'true' || has_weight === true ? 1 : 0,
      photo
    );
    logHistory('create', 'part', { id: info.lastInsertRowid, name, code: finalCode, barcode: finalBarcode });
    res.json({ id: info.lastInsertRowid, code: finalCode, barcode: finalBarcode, photo });
  } catch (e) {
    res.status(400).json({ error: 'Bu kod band: ' + finalCode });
  }
});

router.put('/:id', upload.single('photo'), (req, res) => {
  const { name, code, barcode, has_length, has_quantity, has_weight, pin } = req.body;
  if (!checkPin('edit', pin)) return res.status(403).json({ error: 'Tahrirlash kodi noto\'g\'ri' });
  const existing = db.prepare('SELECT * FROM parts WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Topilmadi' });
  const photo = req.file ? '/uploads/' + req.file.filename : existing.photo;
  const finalBarcode = (barcode && barcode.trim()) ? barcode.trim() : (existing.barcode || uniqueBarcode(code.trim()));
  try {
    db.prepare(`UPDATE parts SET name=?, code=?, barcode=?, has_length=?, has_quantity=?, has_weight=?, photo=?, updated_at=datetime('now', '+5 hours')
      WHERE id=?`).run(
      name.trim(), code.trim(), finalBarcode,
      has_length === 'true' || has_length === true ? 1 : 0,
      has_quantity === 'true' || has_quantity === true ? 1 : 0,
      has_weight === 'true' || has_weight === true ? 1 : 0,
      photo, req.params.id
    );
    logHistory('update', 'part', { id: req.params.id, name, code });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Bu kod band: ' + code });
  }
});

router.delete('/:id', (req, res) => {
  const { pin } = req.body;
  if (!checkPin('delete', pin)) return res.status(403).json({ error: 'O\'chirish kodi noto\'g\'ri' });
  const existing = db.prepare('SELECT * FROM parts WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Zapchast topilmadi' });
  try {
    db.prepare('DELETE FROM parts WHERE id=?').run(req.params.id);
    logHistory('delete', 'part', { id: req.params.id, name: existing.name, code: existing.code });
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('FOREIGN KEY')) {
      db.prepare('UPDATE parts SET active=0 WHERE id=?').run(req.params.id);
      logHistory('archive', 'part', { id: req.params.id, name: existing.name, code: existing.code, reason: 'terish tarixida ishlatilgan' });
      return res.json({ ok: true, archived: true });
    }
    res.status(500).json({ error: 'Kutilmagan xatolik: ' + e.message });
  }
});

module.exports = router;
