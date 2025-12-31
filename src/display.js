import Table from 'cli-table3';

export function displayPriceTable(itemsWithPrices) {
  const date = new Date().toISOString().split('T')[0];
  console.log(`\nSteam Market Prices (${date})\n`);

  if (itemsWithPrices.length === 0) {
    console.log('No items tracked. Add items with: node src/index.js add <app_id> "<item_name>"');
    return;
  }

  const table = new Table({
    head: ['ID', 'Item', 'Lowest', 'Median', 'Volume'],
    colWidths: [6, 45, 12, 12, 10],
    style: {
      head: ['cyan']
    }
  });

  for (const item of itemsWithPrices) {
    const name = item.display_name || item.market_hash_name;
    const truncatedName = name.length > 42 ? name.slice(0, 39) + '...' : name;

    if (item.price.success) {
      table.push([
        item.id,
        truncatedName,
        item.price.lowest_price,
        item.price.median_price,
        item.price.volume
      ]);
    } else {
      table.push([
        item.id,
        truncatedName,
        'Error',
        item.price.error,
        '-'
      ]);
    }
  }

  console.log(table.toString());
}

export function displayItemList(items) {
  if (items.length === 0) {
    console.log('\nNo items tracked.');
    return;
  }

  const table = new Table({
    head: ['ID', 'App ID', 'Market Hash Name', 'Display Name'],
    colWidths: [6, 10, 45, 25],
    style: {
      head: ['cyan']
    }
  });

  for (const item of items) {
    table.push([
      item.id,
      item.app_id,
      item.market_hash_name,
      item.display_name || '-'
    ]);
  }

  console.log('\nTracked Items:\n');
  console.log(table.toString());
}
