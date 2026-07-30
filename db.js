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
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', '+5 hours'))
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
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', '+5 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+5 hours'))
);

CREATE TABLE IF NOT EXISTS models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', '+5 hours')),
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
  created_at TEXT DEFAULT (datetime('now', '+5 hours'))
);

CREATE TABLE IF NOT EXISTS picking_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  model_id INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now', '+5 hours')),
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
  created_at TEXT DEFAULT (datetime('now', '+5 hours'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// Eski bazalarga (ilgari yaratilgan) "active" ustunini qo'shib qo'yamiz, agar mavjud bo'lmasa
function ensureColumn(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}
ensureColumn('categories', 'active', 'INTEGER DEFAULT 1');
ensureColumn('parts', 'active', 'INTEGER DEFAULT 1');
ensureColumn('models', 'active', 'INTEGER DEFAULT 1');
ensureColumn('model_parts', 'active', 'INTEGER DEFAULT 1');

const defaultPins = { create_pin: '1111', edit_pin: '2222', delete_pin: '3333' };
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)');
Object.entries(defaultPins).forEach(([k, v]) => insertSetting.run(k, v));

function checkPin(type, code) {
  if (!code) return false;
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(type + '_pin');
  return !!row && String(row.value) === String(code).trim();
}

function logHistory(action, entity, details, actor) {
  db.prepare('INSERT INTO history_log (action, entity, details, actor) VALUES (?,?,?,?)')
    .run(action, entity, typeof details === 'string' ? details : JSON.stringify(details), actor || 'admin');
}

module.exports = { db, logHistory, checkPin };
