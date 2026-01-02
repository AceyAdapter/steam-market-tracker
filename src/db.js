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

db.exec(`
  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    lowest_price TEXT,
    median_price TEXT,
    volume TEXT,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_price_history_item_id ON price_history(item_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_price_history_fetched_at ON price_history(fetched_at)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    buy_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_inventory_item_id ON inventory(item_id)`);

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

export function savePriceSnapshot(itemId, lowestPrice, medianPrice, volume) {
  const stmt = db.prepare(`
    INSERT INTO price_history (item_id, lowest_price, median_price, volume)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(itemId, lowestPrice, medianPrice, volume);
}

export function getItemHistory(itemId, limit = 10) {
  const stmt = db.prepare(`
    SELECT ph.*, i.market_hash_name, i.display_name
    FROM price_history ph
    JOIN items i ON ph.item_id = i.id
    WHERE ph.item_id = ?
    ORDER BY ph.fetched_at DESC
    LIMIT ?
  `);
  return stmt.all(itemId, limit);
}

export function getAllHistory(limit = 50) {
  const stmt = db.prepare(`
    SELECT ph.*, i.market_hash_name, i.display_name
    FROM price_history ph
    JOIN items i ON ph.item_id = i.id
    ORDER BY ph.fetched_at DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

export function getLatestPrices() {
  const stmt = db.prepare(`
    SELECT ph.*, i.market_hash_name, i.display_name, i.app_id
    FROM price_history ph
    JOIN items i ON ph.item_id = i.id
    WHERE ph.id IN (
      SELECT MAX(id) FROM price_history GROUP BY item_id
    )
    ORDER BY i.id
  `);
  return stmt.all();
}

export function getPriceChanges() {
  // Get the latest price for each item, plus prices closest to 24h, 7d, and 30d ago
  const stmt = db.prepare(`
    WITH latest AS (
      SELECT
        ph.*,
        i.market_hash_name,
        i.display_name
      FROM price_history ph
      JOIN items i ON ph.item_id = i.id
      WHERE ph.id IN (SELECT MAX(id) FROM price_history GROUP BY item_id)
    ),
    prices_24h AS (
      SELECT ph.item_id, ph.lowest_price, ph.fetched_at,
        ROW_NUMBER() OVER (PARTITION BY ph.item_id ORDER BY ABS(strftime('%s', ph.fetched_at) - strftime('%s', 'now', '-1 day'))) as rn
      FROM price_history ph
      WHERE ph.fetched_at <= datetime('now', '-1 day', '+1 hour')
    ),
    prices_7d AS (
      SELECT ph.item_id, ph.lowest_price, ph.fetched_at,
        ROW_NUMBER() OVER (PARTITION BY ph.item_id ORDER BY ABS(strftime('%s', ph.fetched_at) - strftime('%s', 'now', '-7 days'))) as rn
      FROM price_history ph
      WHERE ph.fetched_at <= datetime('now', '-7 days', '+1 day')
    ),
    prices_30d AS (
      SELECT ph.item_id, ph.lowest_price, ph.fetched_at,
        ROW_NUMBER() OVER (PARTITION BY ph.item_id ORDER BY ABS(strftime('%s', ph.fetched_at) - strftime('%s', 'now', '-30 days'))) as rn
      FROM price_history ph
      WHERE ph.fetched_at <= datetime('now', '-30 days', '+2 days')
    )
    SELECT
      l.item_id,
      l.market_hash_name,
      l.display_name,
      l.lowest_price as current_price,
      l.fetched_at as current_time,
      p24.lowest_price as price_24h,
      p7.lowest_price as price_7d,
      p30.lowest_price as price_30d
    FROM latest l
    LEFT JOIN prices_24h p24 ON l.item_id = p24.item_id AND p24.rn = 1
    LEFT JOIN prices_7d p7 ON l.item_id = p7.item_id AND p7.rn = 1
    LEFT JOIN prices_30d p30 ON l.item_id = p30.item_id AND p30.rn = 1
    ORDER BY l.item_id
  `);
  return stmt.all();
}

export function addInventory(itemId, quantity, buyPrice) {
  const stmt = db.prepare(`
    INSERT INTO inventory (item_id, quantity, buy_price)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(itemId, quantity, buyPrice);
  return { success: true, id: result.lastInsertRowid };
}

export function updateInventory(id, quantity, buyPrice) {
  const stmt = db.prepare(`
    UPDATE inventory
    SET quantity = ?, buy_price = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(quantity, buyPrice, id);
  return result.changes > 0;
}

export function removeInventory(id) {
  const stmt = db.prepare('DELETE FROM inventory WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getInventoryById(id) {
  const stmt = db.prepare(`
    SELECT inv.*, i.market_hash_name, i.display_name, i.app_id
    FROM inventory inv
    JOIN items i ON inv.item_id = i.id
    WHERE inv.id = ?
  `);
  return stmt.get(id);
}

export function getAllInventory() {
  const stmt = db.prepare(`
    SELECT
      inv.id,
      inv.item_id,
      inv.quantity,
      inv.buy_price,
      inv.created_at,
      inv.updated_at,
      i.market_hash_name,
      i.display_name,
      i.app_id,
      (inv.quantity * inv.buy_price) as cost_basis,
      ph.lowest_price as current_price
    FROM inventory inv
    JOIN items i ON inv.item_id = i.id
    LEFT JOIN price_history ph ON ph.item_id = inv.item_id
      AND ph.id = (SELECT MAX(id) FROM price_history WHERE item_id = inv.item_id)
    ORDER BY inv.id
  `);
  return stmt.all();
}

export function getInventorySummary() {
  const inventory = getAllInventory();
  return inventory.map(row => {
    const currentPrice = row.current_price ? parseFloat(row.current_price.replace(/[^0-9.]/g, '')) : null;
    const currentValue = currentPrice ? row.quantity * currentPrice : null;
    const returnValue = currentValue !== null ? currentValue - row.cost_basis : null;
    const returnPercent = returnValue !== null && row.cost_basis > 0
      ? (returnValue / row.cost_basis) * 100
      : null;

    return {
      ...row,
      current_value: currentValue,
      return_value: returnValue,
      return_percent: returnPercent
    };
  });
}

export function close() {
  db.close();
}

export default db;
