import { getAllInventory, close } from './db.js';

const inventory = getAllInventory();

const headers = ['id', 'itemId', 'marketHashName', 'displayName', 'quantity', 'buyPrice', 'createdAt', 'updatedAt'];
console.log(headers.join(','));

for (const row of inventory) {
  const values = [
    row.id,
    row.item_id,
    `"${row.market_hash_name.replace(/"/g, '""')}"`,
    `"${(row.display_name || '').replace(/"/g, '""')}"`,
    row.quantity,
    row.buy_price,
    row.created_at,
    row.updated_at
  ];
  console.log(values.join(','));
}

close();
