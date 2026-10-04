const express = require('express');
const router = express.Router();
const { db, logHistory } = require('../db');

// Zapchastlardagi kabi: bo'sh 4 xonali kodlardan birinchisini topib beradi.
function nextModelCode() {
  const rows = db.prepare(`SELECT code FROM models WHERE code IS NOT NULL AND TRIM(code) != ''`).all();
  const used = new Set(rows.map(r => parseInt(r.code, 10)).filter(n => !isNaN(n)));
  for (let i = 1; i <= 9999; i++) {
    if (!used.has(i)) return String(i).padStart(4, '0');
  }
  return null;
}

router.get('/next-code', (req, res) => {
  res.json({ code: nextModelCode() });
});

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
    WHERE mp.model_id = ? AND mp.active = 1`).all(req.params.id);
  res.json({ ...model, parts });
});

router.post('/', (req, res) => {
  const { category_id, name, code, parts } = req.body; // parts: [{part_id, quantity, weight, length}]
  if (!category_id || !name) return res.status(400).json({ error: 'Ma\'lumot yetarli emas' });
  const finalCode = (code && String(code).trim()) ? String(code).trim() : nextModelCode();
  let info;
  try {
    info = db.prepare('INSERT INTO models (category_id, name, code) VALUES (?,?,?)').run(category_id, name.trim(), finalCode);
  } catch (e) {
    return res.status(400).json({ error: 'Bu kod band: ' + finalCode });
  }
  const modelId = info.lastInsertRowid;
  const insertPart = db.prepare('INSERT INTO model_parts (model_id, part_id, quantity, weight, length) VALUES (?,?,?,?,?)');
  (parts || []).forEach(p => {
    insertPart.run(modelId, p.part_id, p.quantity ?? null, p.weight ?? null, p.length ?? null);
  });
  logHistory('create', 'model', { id: modelId, name, code: finalCode, category_id, partsCount: (parts || []).length });
  res.json({ id: modelId, code: finalCode });
});

router.put('/:id', (req, res) => {
  const { category_id, name, code, parts } = req.body;
  const modelId = req.params.id;
  const existing = db.prepare('SELECT * FROM models WHERE id=?').get(modelId);
  if (!existing) return res.status(404).json({ error: 'Topilmadi' });
  const finalCode = (code && String(code).trim()) ? String(code).trim() : (existing.code || nextModelCode());
  db.prepare('UPDATE models SET category_id=?, name=?, code=? WHERE id=?').run(category_id, name.trim(), finalCode, modelId);

  // Model tahrirlanganda zapchastlar ro'yxatini "farqini topib" yangilaymiz:
  // saqlanib qolgan zapchastning model_parts qatori (id) o'zgarmaydi — shu sabab
  // faol (hali tugamagan) terish jarayonlari miqdor o'zgarishini avtomatik ko'radi.
  // O'chirilgan zapchastlar esa faol terish jarayonlaridan ham tozalanadi,
  // qo'shilgan zapchastlar esa faol terish jarayonlariga ham qo'shiladi.
  //
  // MUHIM: olib tashlangan zapchastning model_parts qatori butunlay o'chirilmaydi,
  // faqat "active=0" qilib nofaol qilinadi. Sababi — yakunlangan terish
  // jarayonlarining tarixi shu qatorga bog'liq (FOREIGN KEY), qatorni o'chirsak
  // o'sha tarix buziladi. Nofaol qator model ro'yxatida va yangi jarayonlarda
  // umuman ko'rinmaydi, lekin eski tarixda saqlanib qoladi.
  const incoming = parts || []; // [{part_id, quantity, weight, length}]
  const incomingByPartId = new Map(incoming.map(p => [String(p.part_id), p]));
  const currentRows = db.prepare('SELECT * FROM model_parts WHERE model_id=? AND active=1').all(modelId);
  const currentByPartId = new Map(currentRows.map(r => [String(r.part_id), r]));
  const inactiveRows = db.prepare('SELECT * FROM model_parts WHERE model_id=? AND active=0').all(modelId);
  const inactiveByPartId = new Map(inactiveRows.map(r => [String(r.part_id), r]));

  const updateMp = db.prepare('UPDATE model_parts SET quantity=?, weight=?, length=? WHERE id=?');
  const insertMp = db.prepare('INSERT INTO model_parts (model_id, part_id, quantity, weight, length, active) VALUES (?,?,?,?,?,1)');
  const deactivateMp = db.prepare('UPDATE model_parts SET active=0 WHERE id=?');
  const reactivateMp = db.prepare('UPDATE model_parts SET active=1, quantity=?, weight=?, length=? WHERE id=?');
  // Faqat FAOL (tugallanmagan) terish jarayonlaridagi tegishli elementni tozalaymiz —
  // yakunlangan jarayonlar tarixi o'zgarmay qoladi.
  const purgeFromActiveSessions = db.prepare(`
    DELETE FROM picking_items
    WHERE model_part_id = ?
      AND session_id IN (SELECT id FROM picking_sessions WHERE model_id = ? AND status = 'active')`);
  const addToActiveSessions = db.prepare(`
    INSERT INTO picking_items (session_id, model_part_id)
    SELECT id, ? FROM picking_sessions WHERE model_id = ? AND status = 'active'`);

  // 1) Modeldan olib tashlangan zapchastlar — faol terish jarayonlaridan tozalanadi
  //    va o'zi nofaol qilinadi (tarix buzilmasligi uchun o'chirilmaydi).
  currentRows.forEach(row => {
    if (!incomingByPartId.has(String(row.part_id))) {
      purgeFromActiveSessions.run(row.id, modelId);
      deactivateMp.run(row.id);
    }
  });

  // 2) Saqlanib qolgan zapchastlarning miqdorini yangilaymiz (id o'zgarmaydi).
  currentRows.forEach(row => {
    const inc = incomingByPartId.get(String(row.part_id));
    if (inc) {
      updateMp.run(inc.quantity ?? null, inc.weight ?? null, inc.length ?? null, row.id);
    }
  });

  // 3) Yangi qo'shilgan zapchastlar — avval nofaol qilingan qator bo'lsa qayta
  //    faollashtiramiz, bo'lmasa yangi qator qo'shamiz; faol terish
  //    jarayonlariga ham qo'shiladi.
  incoming.forEach(inc => {
    if (!currentByPartId.has(String(inc.part_id))) {
      const inactive = inactiveByPartId.get(String(inc.part_id));
      let mpId;
      if (inactive) {
        reactivateMp.run(inc.quantity ?? null, inc.weight ?? null, inc.length ?? null, inactive.id);
        mpId = inactive.id;
      } else {
        const info = insertMp.run(modelId, inc.part_id, inc.quantity ?? null, inc.weight ?? null, inc.length ?? null);
        mpId = info.lastInsertRowid;
      }
      addToActiveSessions.run(mpId, modelId);
    }
  });

  logHistory('update', 'model', { id: modelId, name, code: finalCode, category_id });
  res.json({ ok: true, code: finalCode });
});

router.delete('/:id', (req, res) => {
  const modelId = req.params.id;
  const existing = db.prepare('SELECT * FROM models WHERE id=?').get(modelId);
  if (!existing) return res.status(404).json({ error: 'Topilmadi' });
  // Model o'chirilganda unga tegishli terish jarayonlari (sessiyalar) ham
  // o'chiriladi — aks holda FOREIGN KEY xatoligi chiqadi, chunki
  // picking_sessions -> models bog'lanishida avtomatik kaskad o'chirish yo'q.
  const purge = db.transaction(() => {
    const sessions = db.prepare('SELECT id FROM picking_sessions WHERE model_id=?').all(modelId);
    const delItems = db.prepare('DELETE FROM picking_items WHERE session_id=?');
    sessions.forEach(s => delItems.run(s.id));
    db.prepare('DELETE FROM picking_sessions WHERE model_id=?').run(modelId);
    db.prepare('DELETE FROM models WHERE id=?').run(modelId);
  });
  try {
    purge();
  } catch (e) {
    return res.status(400).json({ error: "Modelni o'chirib bo'lmadi: " + e.message });
  }
  logHistory('delete', 'model', { id: modelId, name: existing.name, code: existing.code });
  res.json({ ok: true });
});

module.exports = router;
