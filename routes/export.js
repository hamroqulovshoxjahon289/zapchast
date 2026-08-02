const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { db } = require('../db');

function sendXlsx(res, rows, sheetName, filename) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

router.get('/history.xlsx', (req, res) => {
  const rows = db.prepare('SELECT created_at as Sana, action as Amal, entity as Boim, details as Tafsilot, actor as Kim FROM history_log ORDER BY id DESC').all();
  sendXlsx(res, rows, 'Tarix', 'tarix.xlsx');
});

router.get('/warehouse.xlsx', (req, res) => {
  const rows = db.prepare('SELECT name as Nomi, code as Kod, barcode as "Shtrix-kod", stock as Qoldiq, min_threshold as "Min chegara" FROM warehouse_items WHERE active=1 ORDER BY name').all();
  sendXlsx(res, rows, 'Ombor', 'ombor.xlsx');
});

router.get('/workers-stats.xlsx', (req, res) => {
  const rows = db.prepare(`
    SELECT w.name as Ismi, w.phone as Telefon,
      COUNT(DISTINCT s.id) as "Sessiyalar soni",
      SUM(CASE WHEN pi.status='scanned' THEN 1 ELSE 0 END) as "Terilgan zapchastlar"
    FROM workers w
    LEFT JOIN picking_sessions s ON s.worker_id = w.id AND s.status='finished'
    LEFT JOIN picking_items pi ON pi.session_id = s.id
    GROUP BY w.id ORDER BY "Sessiyalar soni" DESC
  `).all();
  sendXlsx(res, rows, 'Ishchilar', 'ishchilar-statistika.xlsx');
});

router.get('/sessions.xlsx', (req, res) => {
  const rows = db.prepare(`
    SELECT s.id as ID, c.name as Kategoriya, m.name as Model, w.name as Ishchi,
      s.status as Holat, s.created_at as Boshlangan, s.finished_at as Tugallangan
    FROM picking_sessions s
    JOIN models m ON m.id = s.model_id
    JOIN categories c ON c.id = m.category_id
    JOIN workers w ON w.id = s.worker_id
    ORDER BY s.id DESC
  `).all();
  sendXlsx(res, rows, 'Sessiyalar', 'terish-sessiyalari.xlsx');
});

router.get('/models-stats.xlsx', (req, res) => {
  const rows = db.prepare(`
    SELECT c.name as Kategoriya, m.name as Model, COUNT(*) as "Ishlab chiqarilgan soni"
    FROM picking_sessions s
    JOIN models m ON m.id = s.model_id
    JOIN categories c ON c.id = m.category_id
    WHERE s.status='finished'
    GROUP BY s.model_id ORDER BY "Ishlab chiqarilgan soni" DESC
  `).all();
  sendXlsx(res, rows, 'Modellar', 'modellar-statistika.xlsx');
});

router.get('/parts-stats.xlsx', (req, res) => {
  const rows = db.prepare(`
    SELECT p.name as Nomi, p.code as Kod, COUNT(*) as "Ishlatilgan soni"
    FROM picking_items pi
    JOIN model_parts mp ON mp.id = pi.model_part_id
    JOIN parts p ON p.id = mp.part_id
    WHERE pi.status='scanned'
    GROUP BY p.id ORDER BY "Ishlatilgan soni" DESC
  `).all();
  sendXlsx(res, rows, 'Zapchastlar', 'zapchastlar-statistika.xlsx');
});

module.exports = router;
