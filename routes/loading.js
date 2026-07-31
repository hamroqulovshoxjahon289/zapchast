const express = require('express');
const router = express.Router();
const { db, logHistory } = require('../db');

function zapchastBarcode(modelId) {
  return 'ZP' + String(modelId).padStart(6, '0');
}

module.exports = function (io) {
  // Yangi yuklash sessiyasini boshlash: modelga tegishli yuk narsalari + (bo'lsa) zapchast psevdo-elementi
  router.post('/sessions', (req, res) => {
    const { model_id } = req.body;
    if (!model_id) return res.status(400).json({ error: 'Model tanlanmadi' });
    const model = db.prepare('SELECT * FROM models WHERE id=?').get(model_id);
    if (!model) return res.status(404).json({ error: 'Model topilmadi' });

    const info = db.prepare('INSERT INTO loading_sessions (model_id) VALUES (?)').run(model_id);
    const sessionId = info.lastInsertRowid;

    const cargoItems = db.prepare(`SELECT ci.name, ci.barcode FROM model_cargo_items mc
      JOIN cargo_items ci ON ci.id = mc.cargo_item_id
      WHERE mc.model_id=? AND mc.active=1`).all(model_id);
    const insertItem = db.prepare('INSERT INTO loading_items (loading_session_id, item_type, name, barcode) VALUES (?,?,?,?)');
    cargoItems.forEach(ci => insertItem.run(sessionId, 'cargo', ci.name, ci.barcode));

    const hasZapchast = db.prepare('SELECT COUNT(*) as c FROM model_parts WHERE model_id=? AND active=1').get(model_id).c > 0;
    if (hasZapchast) {
      insertItem.run(sessionId, 'zapchast', 'Zapchast', zapchastBarcode(model_id));
    }

    logHistory('start', 'loading_session', { id: sessionId, model_id });
    res.json({ id: sessionId });
  });

  router.get('/sessions/:id', (req, res) => {
    const session = db.prepare(`SELECT ls.*, m.name as model_name, c.name as category_name
      FROM loading_sessions ls
      JOIN models m ON m.id = ls.model_id
      JOIN categories c ON c.id = m.category_id
      WHERE ls.id=?`).get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Topilmadi' });
    const items = db.prepare('SELECT * FROM loading_items WHERE loading_session_id=?').all(req.params.id);
    res.json({ ...session, items });
  });

  router.post('/sessions/:id/scan', (req, res) => {
    const { barcode } = req.body;
    const sessionId = req.params.id;
    const item = db.prepare(`SELECT * FROM loading_items WHERE loading_session_id=? AND barcode=? AND status='pending'`).get(sessionId, barcode);
    if (!item) return res.status(404).json({ error: 'Bu QR/shtrix-kod ushbu yuklashda topilmadi yoki allaqachon belgilangan' });
    db.prepare(`UPDATE loading_items SET status='scanned', scanned_at=datetime('now','+5 hours') WHERE id=?`).run(item.id);
    const updated = { ...item, status: 'scanned' };
    io.to('loading_' + sessionId).emit('loading_item_updated', updated);
    res.json({ ok: true, item: updated });
  });

  router.post('/sessions/:id/finish', (req, res) => {
    db.prepare(`UPDATE loading_sessions SET status='finished', finished_at=datetime('now','+5 hours') WHERE id=?`).run(req.params.id);
    const items = db.prepare('SELECT * FROM loading_items WHERE loading_session_id=?').all(req.params.id);
    const missing = items.filter(i => i.status === 'pending').map(i => i.name);
    logHistory('finish', 'loading_session', { id: req.params.id, missing });
    io.to('loading_' + req.params.id).emit('loading_session_finished', { id: req.params.id });
    res.json({ ok: true, missing });
  });

  router.get('/sessions', (req, res) => {
    const rows = db.prepare(`SELECT ls.*, m.name as model_name, c.name as category_name
      FROM loading_sessions ls
      JOIN models m ON m.id = ls.model_id
      JOIN categories c ON c.id = m.category_id
      ORDER BY ls.created_at DESC LIMIT 200`).all();
    res.json(rows);
  });

  return router;
};
