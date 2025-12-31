import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'data', 'tracker.db');

const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    market_hash_name TEXT NOT NULL,
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id, market_hash_name)
  )
`);

export function addItem(appId, marketHashName, displayName = null) {
  const stmt = db.prepare(`
    INSERT INTO items (app_id, market_hash_name, display_name)
    VALUES (?, ?, ?)
  `);
  try {
    const result = stmt.run(appId, marketHashName, displayName);
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: 'Item already exists' };
    }
    throw err;
  }
}

export function removeItem(id) {
  const stmt = db.prepare('DELETE FROM items WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getAllItems() {
  const stmt = db.prepare('SELECT * FROM items ORDER BY id');
  return stmt.all();
}

export function getItemById(id) {
  const stmt = db.prepare('SELECT * FROM items WHERE id = ?');
  return stmt.get(id);
}

export function close() {
  db.close();
}

export default db;
