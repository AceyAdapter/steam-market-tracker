import { addItem, removeItem, getAllItems, close } from './db.js';
import { fetchAllPrices } from './steam-api.js';
import { displayPriceTable, displayItemList } from './display.js';

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`
Steam Market Price Tracker

Usage:
  node src/index.js                           Fetch and display prices for all tracked items
  node src/index.js add <app_id> "<name>"     Add an item to track
  node src/index.js add <app_id> "<name>" "<display_name>"  Add with custom display name
  node src/index.js remove <id>               Remove an item by ID
  node src/index.js list                      List all tracked items

Examples:
  node src/index.js add 730 "AK-47 | Redline (Field-Tested)"
  node src/index.js add 730 "AWP | Asiimov (Battle-Scarred)" "AWP Asiimov BS"
  node src/index.js remove 1

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
        displayItemList(items);
        break;
      }

      case 'help':
      case '--help':
      case '-h': {
        printUsage();
        break;
      }

      case undefined: {
        // Default: fetch and display prices
        const items = getAllItems();
        if (items.length === 0) {
          console.log('\nNo items tracked yet.');
          console.log('Add items with: node src/index.js add <app_id> "<item_name>"');
          console.log('Run: node src/index.js help for more information');
          break;
        }

        console.log(`\nFetching prices for ${items.length} item(s)...`);
        const itemsWithPrices = await fetchAllPrices(items);
        displayPriceTable(itemsWithPrices);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } finally {
    close();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
