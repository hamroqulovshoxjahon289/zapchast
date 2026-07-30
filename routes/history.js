const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM history_log ORDER BY id DESC LIMIT 500').all();
  res.json(rows);
});

module.exports = router;
