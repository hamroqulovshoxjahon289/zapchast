const express = require('express');
const router = express.Router();
const { db, logHistory, checkPin } = require('../db');

router.get('/', (req, res) => {
  const { category_id } = req.query;
  let rows;
  if (category_id) {
    rows = db.prepare('SELECT * FROM models WHERE category_id=? ORDER BY name').all(category_id);
  } else {
    rows = db.prepare(`SELECT m.*, c.name as category_name FROM models m
      JOIN categories c ON c.id = m.category_id ORDER BY c.name, m.name`).all();
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const model = db.prepare('SELECT * FROM models WHERE id=?').get(req.params.id);
  if (!model) return res.status(404).json({ error: 'Topilmadi' });
  const parts = db.prepare(`SELECT mp.*, p.name as part_name, p.code, p.barcode, p.photo,
      p.has_length, p.has_quantity, p.has_weight
    FROM model_parts mp JOIN parts p ON p.id = mp.part_id
    WHERE mp.model_id = ?`).all(req.params.id);
  res.json({ ...model, parts });
});

router.post('/', (req, res) => {
  const { category_id, name, parts, pin } = req.body; // parts: [{part_id, quantity, weight, length}]
  if (!checkPin('create', pin)) return res.status(403).json({ error: 'Qo\'shish kodi noto\'g\'ri' });
  if (!category_id || !name) return res.status(400).json({ error: 'Ma\'lumot yetarli emas' });
  const info = db.prepare('INSERT INTO models (category_id, name) VALUES (?,?)').run(category_id, name.trim());
  const modelId = info.lastInsertRowid;
  const insertPart = db.prepare('INSERT INTO model_parts (model_id, part_id, quantity, weight, length) VALUES (?,?,?,?,?)');
  (parts || []).forEach(p => {
    insertPart.run(modelId, p.part_id, p.quantity ?? null, p.weight ?? null, p.length ?? null);
  });
  logHistory('create', 'model', { id: modelId, name, category_id, partsCount: (parts || []).length });
  res.json({ id: modelId });
});

router.put('/:id', (req, res) => {
  const { category_id, name, parts, pin } = req.body;
  if (!checkPin('edit', pin)) return res.status(403).json({ error: 'Tahrirlash kodi noto\'g\'ri' });
  db.prepare('UPDATE models SET category_id=?, name=? WHERE id=?').run(category_id, name.trim(), req.params.id);
  db.prepare('DELETE FROM model_parts WHERE model_id=?').run(req.params.id);
  const insertPart = db.prepare('INSERT INTO model_parts (model_id, part_id, quantity, weight, length) VALUES (?,?,?,?,?)');
  (parts || []).forEach(p => {
    insertPart.run(req.params.id, p.part_id, p.quantity ?? null, p.weight ?? null, p.length ?? null);
  });
  logHistory('update', 'model', { id: req.params.id, name, category_id });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const { pin } = req.body;
  if (!checkPin('delete', pin)) return res.status(403).json({ error: 'O\'chirish kodi noto\'g\'ri' });
  db.prepare('DELETE FROM models WHERE id=?').run(req.params.id);
  logHistory('delete', 'model', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
