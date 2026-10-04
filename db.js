const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  barcode TEXT,
  has_length INTEGER DEFAULT 0,
  has_quantity INTEGER DEFAULT 0,
  has_weight INTEGER DEFAULT 0,
  photo TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS model_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id INTEGER NOT NULL,
  part_id INTEGER NOT NULL,
  quantity REAL,
  weight REAL,
  length REAL,
  active INTEGER DEFAULT 1,
  FOREIGN KEY(model_id) REFERENCES models(id) ON DELETE CASCADE,
  FOREIGN KEY(part_id) REFERENCES parts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS picking_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  model_id INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  FOREIGN KEY(worker_id) REFERENCES workers(id),
  FOREIGN KEY(model_id) REFERENCES models(id)
);

CREATE TABLE IF NOT EXISTS picking_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  model_part_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending | scanned | manual_x
  scanned_at TEXT,
  FOREIGN KEY(session_id) REFERENCES picking_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(model_part_id) REFERENCES model_parts(id)
);

CREATE TABLE IF NOT EXISTS history_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  details TEXT,
  actor TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Eski bazalarda 'models' jadvalida 'code' ustuni bo'lmasligi mumkin — qo'shib qo'yamiz.
try { db.exec(`ALTER TABLE models ADD COLUMN code TEXT`); } catch (e) { /* ustun allaqachon bor */ }

// Eski bazalarda 'model_parts' jadvalida 'active' ustuni bo'lmasligi mumkin.
// Bu ustun modeldan zapchast "olib tashlanganda" uni butunlay o'chirmay,
// faqat nofaol qilib qo'yish uchun kerak — shunda yakunlangan terish
// jarayonlarining tarixi (FOREIGN KEY) buzilmaydi.
try { db.exec(`ALTER TABLE model_parts ADD COLUMN active INTEGER DEFAULT 1`); } catch (e) { /* ustun allaqachon bor */ }

// Kod berilmagan (eski) modellarga avtomatik 4 xonali unikal kod tayinlaymiz.
(function backfillModelCodes() {
  const missing = db.prepare(`SELECT id FROM models WHERE code IS NULL OR TRIM(code) = ''`).all();
  if (!missing.length) return;
  const used = new Set(
    db.prepare(`SELECT code FROM models WHERE code IS NOT NULL AND TRIM(code) != ''`).all()
      .map(r => parseInt(r.code, 10)).filter(n => !isNaN(n))
  );
  const assign = db.prepare('UPDATE models SET code=? WHERE id=?');
  let next = 1;
  missing.forEach(row => {
    while (used.has(next) && next <= 9999) next++;
    const code = String(next).padStart(4, '0');
    assign.run(code, row.id);
    used.add(next);
  });
})();

function logHistory(action, entity, details, actor) {
  db.prepare('INSERT INTO history_log (action, entity, details, actor) VALUES (?,?,?,?)')
    .run(action, entity, typeof details === 'string' ? details : JSON.stringify(details), actor || 'admin');
}

module.exports = { db, logHistory };
