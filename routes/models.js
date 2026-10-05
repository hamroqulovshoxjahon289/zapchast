const express = require('express');
const router = express.Router();
const { db, logHistory, checkPin } = require('../db');

router.get('/', (req, res) => {
  const { category_id } = req.query;
  let rows;
  if (category_id) {
    rows = db.prepare('SELECT * FROM models WHERE category_id=? AND active=1 ORDER BY name').all(category_id);
  } else {
    rows = db.prepare(`SELECT m.*, c.name as category_name FROM models m
      JOIN categories c ON c.id = m.category_id WHERE m.active=1 ORDER BY c.name, m.name`).all();
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const model = db.prepare(`SELECT m.*, c.name as category_name FROM models m
    JOIN categories c ON c.id = m.category_id WHERE m.id=?`).get(req.params.id);
  if (!model) return res.status(404).json({ error: 'Topilmadi' });
  const parts = db.prepare(`SELECT mp.*, p.name as part_name, p.code, p.barcode, p.photo,
      p.has_length, p.has_quantity, p.has_weight
    FROM model_parts mp JOIN parts p ON p.id = mp.part_id
    WHERE mp.model_id = ? AND mp.active = 1 ORDER BY mp.sort_order, mp.id`).all(req.params.id);
  const cargoItems = db.prepare(`SELECT mc.*, ci.name as cargo_name, ci.barcode
    FROM model_cargo_items mc JOIN cargo_items ci ON ci.id = mc.cargo_item_id
    WHERE mc.model_id = ? AND mc.active = 1 ORDER BY mc.sort_order, mc.id`).all(req.params.id);
  res.json({ ...model, parts, cargo_items: cargoItems, has_zapchast: parts.length > 0 });
});

router.post('/', (req, res) => {
  const { category_id, name, parts, cargo_item_ids, pin } = req.body; // parts: [{part_id, quantity, weight, length}]
  if (!checkPin('create', pin)) return res.status(403).json({ error: 'Qo\'shish kodi noto\'g\'ri' });
  if (!category_id || !name) return res.status(400).json({ error: 'Ma\'lumot yetarli emas' });
  const info = db.prepare('INSERT INTO models (category_id, name) VALUES (?,?)').run(category_id, name.trim());
  const modelId = info.lastInsertRowid;
  const insertPart = db.prepare('INSERT INTO model_parts (model_id, part_id, quantity, weight, length, sort_order) VALUES (?,?,?,?,?,?)');
  (parts || []).forEach((p, i) => {
    insertPart.run(modelId, p.part_id, p.quantity ?? null, p.weight ?? null, p.length ?? null, i);
  });
  const insertCargo = db.prepare('INSERT INTO model_cargo_items (model_id, cargo_item_id, sort_order) VALUES (?,?,?)');
  (cargo_item_ids || []).forEach((cid, i) => insertCargo.run(modelId, cid, i));
  logHistory('create', 'model', { id: modelId, name, category_id, partsCount: (parts || []).length, cargoCount: (cargo_item_ids || []).length });
  res.json({ id: modelId });
});

router.put('/:id', (req, res) => {
  const { category_id, name, parts, cargo_item_ids, pin } = req.body;
  if (!checkPin('edit', pin)) return res.status(403).json({ error: 'Tahrirlash kodi noto\'g\'ri' });
  const modelId = req.params.id;
  db.prepare('UPDATE models SET category_id=?, name=? WHERE id=?').run(category_id, name.trim(), modelId);

  // --- model_parts: diff asosida yangilash (tarixiy skan yozuvlari buzilmasligi uchun) ---
  const existingActiveParts = db.prepare('SELECT * FROM model_parts WHERE model_id=? AND active=1').all(modelId);
  const existingInactiveParts = db.prepare('SELECT * FROM model_parts WHERE model_id=? AND active=0').all(modelId);
  const incomingPartIds = new Set((parts || []).map(p => String(p.part_id)));
  const updatePart = db.prepare('UPDATE model_parts SET quantity=?, weight=?, length=?, sort_order=? WHERE id=?');
  const reactivatePart = db.prepare('UPDATE model_parts SET quantity=?, weight=?, length=?, sort_order=?, active=1 WHERE id=?');
  const insertPart = db.prepare('INSERT INTO model_parts (model_id, part_id, quantity, weight, length, sort_order) VALUES (?,?,?,?,?,?)');
  const deactivatePart = db.prepare('UPDATE model_parts SET active=0 WHERE id=?');
  const deletePart = db.prepare('DELETE FROM model_parts WHERE id=?');

  existingActiveParts.forEach(ep => {
    if (!incomingPartIds.has(String(ep.part_id))) {
      try { deletePart.run(ep.id); }
      catch (e) { deactivatePart.run(ep.id); } // tarixda ishlatilgan bo'lsa, arxivlaymiz
    }
  });
  (parts || []).forEach((p, i) => {
    const existing = existingActiveParts.find(ep => String(ep.part_id) === String(p.part_id));
    const archived = !existing && existingInactiveParts.find(ep => String(ep.part_id) === String(p.part_id));
    if (existing) {
      updatePart.run(p.quantity ?? null, p.weight ?? null, p.length ?? null, i, existing.id);
    } else if (archived) {
      // oldin arxivlangan (tarixi bo'lgani uchun) qator bo'lsa, dublikat yaratmasdan o'shani qayta jonlantiramiz
      reactivatePart.run(p.quantity ?? null, p.weight ?? null, p.length ?? null, i, archived.id);
    } else {
      insertPart.run(modelId, p.part_id, p.quantity ?? null, p.weight ?? null, p.length ?? null, i);
    }
  });

  // --- model_cargo_items: bularga tarixiy FK bog'liqligi yo'q, shuning uchun to'g'ridan-to'g'ri yangilash mumkin ---
  db.prepare('DELETE FROM model_cargo_items WHERE model_id=?').run(modelId);
  const insertCargo = db.prepare('INSERT INTO model_cargo_items (model_id, cargo_item_id, sort_order) VALUES (?,?,?)');
  (cargo_item_ids || []).forEach((cid, i) => insertCargo.run(modelId, cid, i));

  logHistory('update', 'model', { id: modelId, name, category_id });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const { pin } = req.body;
  if (!checkPin('delete', pin)) return res.status(403).json({ error: 'O\'chirish kodi noto\'g\'ri' });
  const existing = db.prepare('SELECT * FROM models WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Topilmadi' });
  try {
    db.prepare('DELETE FROM models WHERE id=?').run(req.params.id);
    logHistory('delete', 'model', { id: req.params.id, name: existing.name });
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('FOREIGN KEY')) {
      db.prepare('UPDATE models SET active=0 WHERE id=?').run(req.params.id);
      logHistory('archive', 'model', { id: req.params.id, name: existing.name, reason: 'terish/yuklash tarixida ishlatilgan' });
      return res.json({ ok: true, archived: true });
    }
    res.status(500).json({ error: 'Kutilmagan xatolik: ' + e.message });
  }
});

module.exports = router;
