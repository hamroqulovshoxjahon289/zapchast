const express = require('express');
const router = express.Router();
const { db, logHistory, checkPin } = require('../db');

function nextCode() {
  const rows = db.prepare('SELECT code FROM warehouse_items').all();
  const used = new Set(rows.map(r => parseInt(r.code, 10)));
  for (let i = 1; i <= 9999; i++) {
    if (!used.has(i)) return String(i).padStart(4, '0');
  }
  return null;
}

function generateBarcode(partCode) {
  const base = '400' + partCode.padStart(4, '0');
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    const digit = parseInt(base[i], 10);
    sum += (i % 2 === 0) ? digit * 3 : digit;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

function uniqueBarcode(code) {
  let candidate = generateBarcode(code);
  let existing = db.prepare('SELECT id FROM warehouse_items WHERE barcode=?').get(candidate);
  let attempt = 0;
  while (existing && attempt < 20) {
    candidate = generateBarcode(code) + String(Math.floor(Math.random() * 9));
    existing = db.prepare('SELECT id FROM warehouse_items WHERE barcode=?').get(candidate);
    attempt++;
  }
  return candidate;
}

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM warehouse_items WHERE active=1 ORDER BY name').all());
});

router.get('/next-code', (req, res) => {
  res.json({ code: nextCode() });
});

router.post('/', (req, res) => {
  const { name, code, barcode, stock, min_threshold, pin } = req.body;
  if (!checkPin('create', pin)) return res.status(403).json({ error: 'Qo\'shish kodi noto\'g\'ri' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nomi kiritilmadi' });
  const finalCode = (code && code.trim()) ? code.trim() : nextCode();
  const finalBarcode = (barcode && barcode.trim()) ? barcode.trim() : uniqueBarcode(finalCode);
  try {
    const info = db.prepare(`INSERT INTO warehouse_items (name, code, barcode, stock, min_threshold) VALUES (?,?,?,?,?)`)
      .run(name.trim(), finalCode, finalBarcode, parseFloat(stock) || 0, parseFloat(min_threshold) || 0);
    logHistory('create', 'warehouse_item', { id: info.lastInsertRowid, name, code: finalCode });
    res.json({ id: info.lastInsertRowid, code: finalCode, barcode: finalBarcode });
  } catch (e) {
    res.status(400).json({ error: 'Bu kod band: ' + finalCode });
  }
});

router.put('/:id', (req, res) => {
  const { name, code, barcode, min_threshold, pin } = req.body;
  if (!checkPin('edit', pin)) return res.status(403).json({ error: 'Tahrirlash kodi noto\'g\'ri' });
  const existing = db.prepare('SELECT * FROM warehouse_items WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Topilmadi' });
  try {
    db.prepare('UPDATE warehouse_items SET name=?, code=?, barcode=?, min_threshold=? WHERE id=?')
      .run(name.trim(), code.trim(), barcode || existing.barcode, parseFloat(min_threshold) || 0, req.params.id);
    logHistory('update', 'warehouse_item', { id: req.params.id, name });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Bu kod band: ' + code });
  }
});

// Kirim: omborga zapchast qo'shish (masalan yangi partiya keldi)
router.post('/:id/stock-in', (req, res) => {
  const { amount, note, pin } = req.body;
  if (!checkPin('edit', pin)) return res.status(403).json({ error: 'Tahrirlash kodi noto\'g\'ri' });
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Miqdorni to\'g\'ri kiriting' });
  const existing = db.prepare('SELECT * FROM warehouse_items WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Topilmadi' });
  db.prepare('UPDATE warehouse_items SET stock = stock + ? WHERE id=?').run(amt, req.params.id);
  db.prepare('INSERT INTO warehouse_log (warehouse_item_id, change_amount, type, note) VALUES (?,?,?,?)')
    .run(req.params.id, amt, 'kirim', note || null);
  logHistory('stock_in', 'warehouse_item', { id: req.params.id, name: existing.name, amount: amt });
  res.json({ ok: true });
});

// Chiqim: har kim QR-kodni skan qilib olib ketishi (PIN talab qilinmaydi — tez va oson bo'lishi uchun)
router.post('/take', (req, res) => {
  const { barcode, qty } = req.body;
  const amt = parseFloat(qty) || 1;
  const item = db.prepare('SELECT * FROM warehouse_items WHERE (barcode=? OR code=?) AND active=1').get(barcode, barcode);
  if (!item) return res.status(404).json({ error: 'Bunday zapchast omborda topilmadi' });
  if (item.stock < amt) return res.status(409).json({ error: `Omborda yetarli qoldiq yo'q (qoldi: ${item.stock})` });
  db.prepare('UPDATE warehouse_items SET stock = stock - ? WHERE id=?').run(amt, item.id);
  db.prepare('INSERT INTO warehouse_log (warehouse_item_id, change_amount, type) VALUES (?,?,?)')
    .run(item.id, -amt, 'chiqim');
  const newStock = item.stock - amt;
  logHistory('stock_out', 'warehouse_item', { id: item.id, name: item.name, amount: amt, remaining: newStock });
  res.json({ ok: true, name: item.name, remaining: newStock, low: newStock <= item.min_threshold });
});

router.delete('/:id', (req, res) => {
  const { pin } = req.body;
  if (!checkPin('delete', pin)) return res.status(403).json({ error: 'O\'chirish kodi noto\'g\'ri' });
  const existing = db.prepare('SELECT * FROM warehouse_items WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Topilmadi' });
  try {
    db.prepare('DELETE FROM warehouse_items WHERE id=?').run(req.params.id);
    logHistory('delete', 'warehouse_item', { id: req.params.id, name: existing.name });
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('FOREIGN KEY')) {
      db.prepare('UPDATE warehouse_items SET active=0 WHERE id=?').run(req.params.id);
      logHistory('archive', 'warehouse_item', { id: req.params.id, name: existing.name });
      return res.json({ ok: true, archived: true });
    }
    res.status(500).json({ error: 'Kutilmagan xatolik: ' + e.message });
  }
});

router.get('/:id/log', (req, res) => {
  res.json(db.prepare('SELECT * FROM warehouse_log WHERE warehouse_item_id=? ORDER BY id DESC LIMIT 100').all(req.params.id));
});

module.exports = router;
