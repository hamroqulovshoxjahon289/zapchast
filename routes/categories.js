const express = require('express');
const router = express.Router();
const { db, logHistory, checkPin } = require('../db');

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, pin } = req.body;
  if (!checkPin('create', pin)) return res.status(403).json({ error: 'Qo\'shish kodi noto\'g\'ri' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nomi kiritilmadi' });
  const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name.trim());
  logHistory('create', 'category', { id: info.lastInsertRowid, name });
  res.json({ id: info.lastInsertRowid, name });
});

router.put('/:id', (req, res) => {
  const { name, pin } = req.body;
  if (!checkPin('edit', pin)) return res.status(403).json({ error: 'Tahrirlash kodi noto\'g\'ri' });
  db.prepare('UPDATE categories SET name=? WHERE id=?').run(name, req.params.id);
  logHistory('update', 'category', { id: req.params.id, name });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const { pin } = req.body;
  if (!checkPin('delete', pin)) return res.status(403).json({ error: 'O\'chirish kodi noto\'g\'ri' });
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  logHistory('delete', 'category', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
