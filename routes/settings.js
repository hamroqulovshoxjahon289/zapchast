const express = require('express');
const router = express.Router();
const { db, logHistory, checkPin } = require('../db');

// DIQQAT: kodlarning o'zi hech qachon ochiq (plaintext) qaytarilmaydi.
// Faqat "to'g'ri/noto'g'ri" javobi orqali tekshiriladi (quyida verify), shuning
// uchun sayt manzilini bilgan har qanday odam kodlarni ko'ra olmaydi.

router.post('/verify', (req, res) => {
  const { type, code } = req.body; // type: create | edit | delete
  res.json({ ok: checkPin(type, code) });
});

// Sozlamalar sahifasiga kirish uchun ham kod talab qilinadi (joriy tahrirlash kodi)
router.post('/check-access', (req, res) => {
  const { code } = req.body;
  res.json({ ok: checkPin('edit', code) });
});

// Kodlarni o'zgartirish uchun joriy "tahrirlash kodi" talab qilinadi
router.put('/', (req, res) => {
  const { create_pin, edit_pin, delete_pin, auth_pin } = req.body;
  if (!checkPin('edit', auth_pin)) return res.status(403).json({ error: 'Tasdiqlash kodi noto\'g\'ri' });
  const upd = db.prepare('UPDATE settings SET value=? WHERE key=?');
  if (create_pin && create_pin.length === 4) upd.run(create_pin, 'create_pin');
  if (edit_pin && edit_pin.length === 4) upd.run(edit_pin, 'edit_pin');
  if (delete_pin && delete_pin.length === 4) upd.run(delete_pin, 'delete_pin');
  logHistory('update', 'settings', 'PIN kodlar yangilandi');
  res.json({ ok: true });
});

module.exports = router;
