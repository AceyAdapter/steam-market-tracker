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

export function displayItemList(items, latestPrices = []) {
  if (items.length === 0) {
    console.log('\nNo items tracked.');
    return;
  }

  // Create a map of item_id to latest price
  const priceMap = new Map();
  for (const p of latestPrices) {
    priceMap.set(p.item_id, p);
  }

  const table = new Table({
    head: ['ID', 'App', 'Item', 'Lowest', 'Last Updated'],
    colWidths: [6, 7, 40, 12, 22],
    style: {
      head: ['cyan']
    }
  });

  for (const item of items) {
    const name = item.display_name || item.market_hash_name;
    const truncatedName = name.length > 37 ? name.slice(0, 34) + '...' : name;
    const price = priceMap.get(item.id);

    table.push([
      item.id,
      item.app_id,
      truncatedName,
      price ? price.lowest_price : '-',
      price ? new Date(price.fetched_at).toLocaleString() : 'Never'
    ]);
  }

  console.log('\nTracked Items:\n');
  console.log(table.toString());
}

export function displayHistory(history) {
  console.log('\nPrice History:\n');

  const table = new Table({
    head: ['Date/Time', 'Item', 'Lowest', 'Median', 'Volume'],
    colWidths: [22, 35, 12, 12, 10],
    style: {
      head: ['cyan']
    }
  });

  for (const record of history) {
    const name = record.display_name || record.market_hash_name;
    const truncatedName = name.length > 32 ? name.slice(0, 29) + '...' : name;
    const date = new Date(record.fetched_at).toLocaleString();

    table.push([
      date,
      truncatedName,
      record.lowest_price || 'N/A',
      record.median_price || 'N/A',
      record.volume || '-'
    ]);
  }

  console.log(table.toString());
}

export function displayPriceChanges(changes) {
  console.log('\nPrice Changes:\n');

  if (changes.length === 0) {
    console.log('No price history yet. Run a price fetch first.');
    return;
  }

  const table = new Table({
    head: ['ID', 'Item', 'Current', '24h', '7d', '30d'],
    colWidths: [5, 32, 11, 11, 11, 11],
    style: {
      head: ['cyan']
    }
  });

  const parsePrice = (priceStr) => {
    if (!priceStr) return null;
    return parseFloat(priceStr.replace(/[^0-9.]/g, ''));
  };

  const calcChange = (current, previous) => {
    if (current === null || previous === null) return '-';
    const percent = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const prefix = percent >= 0 ? '+' : '';
    return `${prefix}${percent.toFixed(1)}%`;
  };

  for (const row of changes) {
    const name = row.display_name || row.market_hash_name;
    const truncatedName = name.length > 29 ? name.slice(0, 26) + '...' : name;

    const current = parsePrice(row.current_price);
    const price24h = parsePrice(row.price_24h);
    const price7d = parsePrice(row.price_7d);
    const price30d = parsePrice(row.price_30d);

    table.push([
      row.item_id,
      truncatedName,
      row.current_price || '-',
      calcChange(current, price24h),
      calcChange(current, price7d),
      calcChange(current, price30d)
    ]);
  }

  console.log(table.toString());
}

export function displayInventory(inventory) {
  console.log('\nInventory:\n');

  if (inventory.length === 0) {
    console.log('No inventory items. Add with: node src/index.js inv add <item_id> <quantity> <buy_price>');
    return;
  }

  const table = new Table({
    head: ['ID', 'Item', 'Qty', 'Buy Price', 'Cost Basis', 'Current', 'Value', 'Return', '%'],
    colWidths: [5, 28, 5, 11, 12, 11, 12, 12, 9],
    style: {
      head: ['cyan']
    }
  });

  let totalCostBasis = 0;
  let totalValue = 0;

  for (const row of inventory) {
    const name = row.display_name || row.market_hash_name;
    const truncatedName = name.length > 25 ? name.slice(0, 22) + '...' : name;

    const costBasis = row.cost_basis;
    const currentValue = row.current_value;
    const returnValue = row.return_value;
    const returnPercent = row.return_percent;

    totalCostBasis += costBasis;
    if (currentValue !== null) totalValue += currentValue;

    const formatReturn = (val) => {
      if (val === null) return '-';
      const prefix = val >= 0 ? '+' : '';
      return `${prefix}$${val.toFixed(2)}`;
    };

    const formatPercent = (val) => {
      if (val === null) return '-';
      const prefix = val >= 0 ? '+' : '';
      return `${prefix}${val.toFixed(1)}%`;
    };

    table.push([
      row.id,
      truncatedName,
      row.quantity,
      `$${row.buy_price.toFixed(2)}`,
      `$${costBasis.toFixed(2)}`,
      row.current_price || '-',
      currentValue !== null ? `$${currentValue.toFixed(2)}` : '-',
      formatReturn(returnValue),
      formatPercent(returnPercent)
    ]);
  }

  console.log(table.toString());

  // Summary
  const totalReturn = totalValue - totalCostBasis;
  const totalPercent = totalCostBasis > 0 ? (totalReturn / totalCostBasis) * 100 : 0;
  const prefix = totalReturn >= 0 ? '+' : '';

  console.log(`\nTotal Cost Basis: $${totalCostBasis.toFixed(2)}`);
  console.log(`Total Value:      $${totalValue.toFixed(2)}`);
  console.log(`Total Return:     ${prefix}$${totalReturn.toFixed(2)} (${prefix}${totalPercent.toFixed(1)}%)`);
}
