const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/workers', (req, res) => {
  const rows = db.prepare(`
    SELECT w.id, w.name, w.phone,
      COUNT(DISTINCT s.id) as sessions_count,
      SUM(CASE WHEN pi.status='scanned' THEN 1 ELSE 0 END) as scanned_items,
      MIN(s.created_at) as first_activity,
      MAX(s.finished_at) as last_activity
    FROM workers w
    LEFT JOIN picking_sessions s ON s.worker_id = w.id AND s.status='finished'
    LEFT JOIN picking_items pi ON pi.session_id = s.id
    GROUP BY w.id
    ORDER BY sessions_count DESC
  `).all();
  res.json(rows);
});

router.get('/models', (req, res) => {
  const rows = db.prepare(`
    SELECT m.name as model_name, c.name as category_name, COUNT(*) as sessions_count
    FROM picking_sessions s
    JOIN models m ON m.id = s.model_id
    JOIN categories c ON c.id = m.category_id
    WHERE s.status='finished'
    GROUP BY s.model_id
    ORDER BY sessions_count DESC
    LIMIT 20
  `).all();
  res.json(rows);
});

router.get('/parts', (req, res) => {
  const rows = db.prepare(`
    SELECT p.name as part_name, p.code, COUNT(*) as used_count
    FROM picking_items pi
    JOIN model_parts mp ON mp.id = pi.model_part_id
    JOIN parts p ON p.id = mp.part_id
    WHERE pi.status='scanned'
    GROUP BY p.id
    ORDER BY used_count DESC
    LIMIT 20
  `).all();
  res.json(rows);
});

router.get('/daily', (req, res) => {
  const rows = db.prepare(`
    SELECT date(finished_at) as day, COUNT(*) as cnt
    FROM picking_sessions
    WHERE status='finished' AND finished_at IS NOT NULL
      AND date(finished_at) >= date('now', '-30 days')
    GROUP BY day
    ORDER BY day
  `).all();
  res.json(rows);
});

router.get('/loading-daily', (req, res) => {
  const rows = db.prepare(`
    SELECT date(finished_at) as day, COUNT(*) as cnt
    FROM loading_sessions
    WHERE status='finished' AND finished_at IS NOT NULL
      AND date(finished_at) >= date('now', '-30 days')
    GROUP BY day
    ORDER BY day
  `).all();
  res.json(rows);
});

module.exports = router;
