import { addItem, removeItem, getAllItems, getItemById, savePriceSnapshot, getItemHistory, getAllHistory, getLatestPrices, addInventory, updateInventory, removeInventory, getInventorySummary, close } from './db.js';
import { fetchAllPrices } from './steam-api.js';
import { displayPriceTable, displayItemList, displayHistory, displayInventory } from './display.js';

const args = process.argv.slice(2);
const command = args[0];

// Track saved count for graceful shutdown message
let savedCount = 0;

// Save snapshot immediately when fetched
function saveOnFetch(item) {
  if (item.price.success) {
    savePriceSnapshot(
      item.id,
      item.price.lowest_price,
      item.price.median_price,
      item.price.volume
    );
    savedCount++;
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n\nInterrupted. Saved ${savedCount} snapshot(s) before exit.`);
  close();
  process.exit(0);
});

function parseIdRange(rangeStr, allItems) {
  const itemIds = allItems.map(i => i.id);
  const maxId = Math.max(...itemIds);
  const minId = Math.min(...itemIds);

  // Single ID: "5"
  if (/^\d+$/.test(rangeStr)) {
    const id = parseInt(rangeStr, 10);
    return itemIds.includes(id) ? [id] : [];
  }

  // Range: "5-10" or "5-" or "-10"
  const rangeMatch = rangeStr.match(/^(\d*)-(\d*)$/);
  if (rangeMatch) {
    const start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : minId;
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : maxId;
    return itemIds.filter(id => id >= start && id <= end).sort((a, b) => a - b);
  }

  return null; // Invalid format
}

function printUsage() {
  console.log(`
Steam Market Price Tracker

Usage:
  node src/index.js                           Fetch and display prices for all tracked items
  node src/index.js <id>                      Fetch and display price for a single item
  node src/index.js <start>-<end>             Fetch prices for ID range (e.g., 5-10)
  node src/index.js <start>-                  Fetch from ID onwards (e.g., 5-)
  node src/index.js add <app_id> "<name>"     Add an item to track
  node src/index.js add <app_id> "<name>" "<display_name>"  Add with custom display name
  node src/index.js remove <id>               Remove an item by ID
  node src/index.js list                      List all tracked items
  node src/index.js history                   Show price history for all items
  node src/index.js history <id>              Show price history for a specific item

Inventory:
  node src/index.js inv                       Show inventory with cost basis and returns
  node src/index.js inv add <item_id> <qty> <buy_price>   Add item to inventory
  node src/index.js inv update <inv_id> <qty> <buy_price> Update inventory entry
  node src/index.js inv remove <inv_id>       Remove inventory entry

Examples:
  node src/index.js add 730 "AK-47 | Redline (Field-Tested)"
  node src/index.js add 730 "AWP | Asiimov (Battle-Scarred)" "AWP Asiimov BS"
  node src/index.js remove 1
  node src/index.js history 1
  node src/index.js 5-10                      Fetch prices for items 5 through 10
  node src/index.js 15-                       Resume fetching from item 15 onwards
  node src/index.js inv add 1 5 12.50         Add 5 of item #1, bought at $12.50 each

Common App IDs:
  730  - Counter-Strike 2
  440  - Team Fortress 2
  570  - Dota 2
  753  - Steam (trading cards, backgrounds, etc.)
`);
}

async function main() {
  try {
    switch (command) {
      case 'add': {
        const appId = parseInt(args[1], 10);
        const marketHashName = args[2];
        const displayName = args[3] || null;

        if (!appId || !marketHashName) {
          console.error('Error: app_id and item name are required');
          console.log('Usage: node src/index.js add <app_id> "<item_name>"');
          process.exit(1);
        }

        const result = addItem(appId, marketHashName, displayName);
        if (result.success) {
          console.log(`Added item "${marketHashName}" with ID ${result.id}`);
        } else {
          console.error(`Failed to add item: ${result.error}`);
        }
        break;
      }

      case 'remove': {
        const id = parseInt(args[1], 10);
        if (!id) {
          console.error('Error: item ID is required');
          console.log('Usage: node src/index.js remove <id>');
          process.exit(1);
        }

        const removed = removeItem(id);
        if (removed) {
          console.log(`Removed item with ID ${id}`);
        } else {
          console.error(`No item found with ID ${id}`);
        }
        break;
      }

      case 'list': {
        const items = getAllItems();
        const latestPrices = getLatestPrices();
        displayItemList(items, latestPrices);
        break;
      }

      case 'help':
      case '--help':
      case '-h': {
        printUsage();
        break;
      }

      case 'history': {
        const itemId = args[1] ? parseInt(args[1], 10) : null;
        if (itemId) {
          const history = getItemHistory(itemId, 20);
          if (history.length === 0) {
            console.log(`\nNo price history found for item ID ${itemId}`);
          } else {
            displayHistory(history);
          }
        } else {
          const history = getAllHistory(50);
          if (history.length === 0) {
            console.log('\nNo price history yet. Run a price fetch first.');
          } else {
            displayHistory(history);
          }
        }
        break;
      }

      case 'inv': {
        const subCommand = args[1];

        switch (subCommand) {
          case 'add': {
            const itemId = parseInt(args[2], 10);
            const quantity = parseInt(args[3], 10);
            const buyPrice = parseFloat(args[4]);

            if (!itemId || !quantity || isNaN(buyPrice)) {
              console.error('Error: item_id, quantity, and buy_price are required');
              console.log('Usage: node src/index.js inv add <item_id> <quantity> <buy_price>');
              process.exit(1);
            }

            const item = getItemById(itemId);
            if (!item) {
              console.error(`No tracked item found with ID ${itemId}`);
              console.log('Use "node src/index.js list" to see tracked items');
              process.exit(1);
            }

            const result = addInventory(itemId, quantity, buyPrice);
            console.log(`Added ${quantity}x "${item.display_name || item.market_hash_name}" to inventory (ID: ${result.id})`);
            console.log(`Buy price: $${buyPrice.toFixed(2)} each, Cost basis: $${(quantity * buyPrice).toFixed(2)}`);
            break;
          }

          case 'update': {
            const invId = parseInt(args[2], 10);
            const quantity = parseInt(args[3], 10);
            const buyPrice = parseFloat(args[4]);

            if (!invId || !quantity || isNaN(buyPrice)) {
              console.error('Error: inv_id, quantity, and buy_price are required');
              console.log('Usage: node src/index.js inv update <inv_id> <quantity> <buy_price>');
              process.exit(1);
            }

            const updated = updateInventory(invId, quantity, buyPrice);
            if (updated) {
              console.log(`Updated inventory entry ${invId}`);
            } else {
              console.error(`No inventory entry found with ID ${invId}`);
            }
            break;
          }

          case 'remove': {
            const invId = parseInt(args[2], 10);
            if (!invId) {
              console.error('Error: inventory ID is required');
              console.log('Usage: node src/index.js inv remove <inv_id>');
              process.exit(1);
            }

            const removed = removeInventory(invId);
            if (removed) {
              console.log(`Removed inventory entry ${invId}`);
            } else {
              console.error(`No inventory entry found with ID ${invId}`);
            }
            break;
          }

          default: {
            // Show inventory
            const inventory = getInventorySummary();
            displayInventory(inventory);
            break;
          }
        }
        break;
      }

      case undefined: {
        // Default: fetch and display prices for all items
        const items = getAllItems();
        if (items.length === 0) {
          console.log('\nNo items tracked yet.');
          console.log('Add items with: node src/index.js add <app_id> "<item_name>"');
          console.log('Run: node src/index.js help for more information');
          break;
        }

        savedCount = 0;
        console.log(`\nFetching prices for ${items.length} item(s)... (Ctrl+C to stop, progress is saved)`);
        const itemsWithPrices = await fetchAllPrices(items, 1, saveOnFetch);

        displayPriceTable(itemsWithPrices);
        console.log(`\n${savedCount} price snapshot(s) saved to database.`);
        break;
      }

      default: {
        // Check if command is an ID or ID range (e.g., "5", "5-10", "5-")
        const allItems = getAllItems();
        if (allItems.length === 0) {
          console.log('\nNo items tracked yet.');
          console.log('Add items with: node src/index.js add <app_id> "<item_name>"');
          break;
        }

        const selectedIds = parseIdRange(command, allItems);

        if (selectedIds === null) {
          console.error(`Unknown command: ${command}`);
          printUsage();
          process.exit(1);
        }

        if (selectedIds.length === 0) {
          console.error(`No items found matching range: ${command}`);
          console.log('Use "node src/index.js list" to see tracked items');
          process.exit(1);
        }

        const itemsToFetch = allItems.filter(item => selectedIds.includes(item.id));
        savedCount = 0;
        console.log(`\nFetching prices for ${itemsToFetch.length} item(s) (IDs: ${selectedIds.join(', ')})... (Ctrl+C to stop, progress is saved)`);

        const itemsWithPrices = await fetchAllPrices(itemsToFetch, 1, saveOnFetch);

        displayPriceTable(itemsWithPrices);
        console.log(`\n${savedCount} price snapshot(s) saved to database.`);
        break;
      }
    }
  } finally {
    close();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
