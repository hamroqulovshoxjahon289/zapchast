const express = require('express');
const router = express.Router();
const { db, logHistory } = require('../db');

module.exports = function (io) {
  // Start a new picking session for a worker+model
  router.post('/', (req, res) => {
    const { worker_id, model_id } = req.body;
    if (!worker_id || !model_id) return res.status(400).json({ error: 'Ma\'lumot yetarli emas' });
    const info = db.prepare('INSERT INTO picking_sessions (worker_id, model_id) VALUES (?,?)').run(worker_id, model_id);
    const sessionId = info.lastInsertRowid;
    const modelParts = db.prepare('SELECT id FROM model_parts WHERE model_id=? AND active=1').all(model_id);
    const insertItem = db.prepare('INSERT INTO picking_items (session_id, model_part_id) VALUES (?,?)');
    modelParts.forEach(mp => insertItem.run(sessionId, mp.id));
    logHistory('start', 'session', { id: sessionId, worker_id, model_id });
    res.json({ id: sessionId });
  });

  // Get session details with items
  router.get('/:id', (req, res) => {
    const session = db.prepare(`SELECT s.*, w.name as worker_name, w.phone as worker_phone,
        m.name as model_name, c.name as category_name
      FROM picking_sessions s
      JOIN workers w ON w.id = s.worker_id
      JOIN models m ON m.id = s.model_id
      JOIN categories c ON c.id = m.category_id
      WHERE s.id=?`).get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Topilmadi' });
    const items = db.prepare(`SELECT pi.*, mp.quantity, mp.weight, mp.length,
        p.id as part_id, p.name as part_name, p.code, p.barcode, p.photo,
        p.has_length, p.has_quantity, p.has_weight
      FROM picking_items pi
      JOIN model_parts mp ON mp.id = pi.model_part_id
      JOIN parts p ON p.id = mp.part_id
      WHERE pi.session_id=?`).all(req.params.id);
    res.json({ ...session, items });
  });

  // Mark an item as scanned (by barcode match) or manual
  router.post('/:id/scan', (req, res) => {
    const { barcode, item_id, method } = req.body; // method: 'scanner' | 'manual_x' | 'camera'
    const sessionId = req.params.id;
    let item;
    if (item_id) {
      item = db.prepare(`SELECT pi.*, p.code, p.barcode FROM picking_items pi
        JOIN model_parts mp ON mp.id = pi.model_part_id
        JOIN parts p ON p.id = mp.part_id
        WHERE pi.id=? AND pi.session_id=?`).get(item_id, sessionId);
    } else if (barcode) {
      item = db.prepare(`SELECT pi.*, p.code, p.barcode FROM picking_items pi
        JOIN model_parts mp ON mp.id = pi.model_part_id
        JOIN parts p ON p.id = mp.part_id
        WHERE pi.session_id=? AND (p.barcode=? OR p.code=?) AND pi.status='pending'`).get(sessionId, barcode, barcode);
    }
    if (!item) return res.status(404).json({ error: 'Zapchast topilmadi yoki allaqachon belgilangan' });
    const status = method === 'manual_x' ? 'manual_x' : 'scanned';
    db.prepare(`UPDATE picking_items SET status=?, scanned_at=datetime('now') WHERE id=?`).run(status, item.id);
    const updated = { ...item, status };
    io.to('session_' + sessionId).emit('item_updated', updated);
    res.json({ ok: true, item: updated });
  });

  // Finish session
  router.post('/:id/finish', (req, res) => {
    db.prepare(`UPDATE picking_sessions SET status='finished', finished_at=datetime('now') WHERE id=?`).run(req.params.id);
    logHistory('finish', 'session', { id: req.params.id });
    io.to('session_' + req.params.id).emit('session_finished', { id: req.params.id });
    res.json({ ok: true });
  });

  router.get('/', (req, res) => {
    const rows = db.prepare(`SELECT s.*, w.name as worker_name, m.name as model_name, c.name as category_name
      FROM picking_sessions s
      JOIN workers w ON w.id = s.worker_id
      JOIN models m ON m.id = s.model_id
      JOIN categories c ON c.id = m.category_id
      ORDER BY s.created_at DESC LIMIT 200`).all();
    res.json(rows);
  });

  return router;
};
