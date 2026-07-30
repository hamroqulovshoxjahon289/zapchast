const express = require('express');
const router = express.Router();
const { db, logHistory } = require('../db');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM workers ORDER BY name').all());
});

router.post('/', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Ism kiritilmadi' });
  const info = db.prepare('INSERT INTO workers (name, phone) VALUES (?,?)').run(name.trim(), phone || null);
  logHistory('create', 'worker', { id: info.lastInsertRowid, name });
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { name, phone } = req.body;
  db.prepare('UPDATE workers SET name=?, phone=? WHERE id=?').run(name.trim(), phone || null, req.params.id);
  logHistory('update', 'worker', { id: req.params.id, name });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM workers WHERE id=?').run(req.params.id);
  logHistory('delete', 'worker', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
