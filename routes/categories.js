const express = require('express');
const router = express.Router();
const { db, logHistory } = require('../db');

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nomi kiritilmadi' });
  const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name.trim());
  logHistory('create', 'category', { id: info.lastInsertRowid, name });
  res.json({ id: info.lastInsertRowid, name });
});

router.put('/:id', (req, res) => {
  const { name } = req.body;
  db.prepare('UPDATE categories SET name=? WHERE id=?').run(name, req.params.id);
  logHistory('update', 'category', { id: req.params.id, name });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  logHistory('delete', 'category', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
