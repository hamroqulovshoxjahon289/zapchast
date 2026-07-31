const express = require('express');
const router = express.Router();
const { db, logHistory, checkPin } = require('../db');

function generateBarcode(seed) {
  const base = '300' + String(seed).padStart(4, '0'); // 7 digits
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    const digit = parseInt(base[i], 10);
    sum += (i % 2 === 0) ? digit * 3 : digit;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

function uniqueBarcode() {
  const row = db.prepare('SELECT COUNT(*) as c FROM cargo_items').get();
  let seed = row.c + 1;
  let candidate = generateBarcode(seed);
  let existing = db.prepare('SELECT id FROM cargo_items WHERE barcode=?').get(candidate);
  while (existing) {
    seed++;
    candidate = generateBarcode(seed);
    existing = db.prepare('SELECT id FROM cargo_items WHERE barcode=?').get(candidate);
  }
  return candidate;
}

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM cargo_items WHERE active=1 ORDER BY name').all());
});

router.post('/', (req, res) => {
  const { name, pin } = req.body;
  if (!checkPin('create', pin)) return res.status(403).json({ error: 'Qo\'shish kodi noto\'g\'ri' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nomi kiritilmadi' });
  const barcode = uniqueBarcode();
  const info = db.prepare('INSERT INTO cargo_items (name, barcode) VALUES (?,?)').run(name.trim(), barcode);
  logHistory('create', 'cargo_item', { id: info.lastInsertRowid, name, barcode });
  res.json({ id: info.lastInsertRowid, name, barcode });
});

router.put('/:id', (req, res) => {
  const { name, pin } = req.body;
  if (!checkPin('edit', pin)) return res.status(403).json({ error: 'Tahrirlash kodi noto\'g\'ri' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nomi kiritilmadi' });
  db.prepare('UPDATE cargo_items SET name=? WHERE id=?').run(name.trim(), req.params.id);
  logHistory('update', 'cargo_item', { id: req.params.id, name });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const { pin } = req.body;
  if (!checkPin('delete', pin)) return res.status(403).json({ error: 'O\'chirish kodi noto\'g\'ri' });
  const existing = db.prepare('SELECT * FROM cargo_items WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Topilmadi' });
  try {
    db.prepare('DELETE FROM cargo_items WHERE id=?').run(req.params.id);
    logHistory('delete', 'cargo_item', { id: req.params.id, name: existing.name });
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('FOREIGN KEY')) {
      db.prepare('UPDATE cargo_items SET active=0 WHERE id=?').run(req.params.id);
      logHistory('archive', 'cargo_item', { id: req.params.id, name: existing.name, reason: 'yuklash tarixida ishlatilgan' });
      return res.json({ ok: true, archived: true });
    }
    res.status(500).json({ error: 'Kutilmagan xatolik: ' + e.message });
  }
});

module.exports = router;
