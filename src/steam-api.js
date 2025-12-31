const STEAM_API_BASE = 'https://steamcommunity.com/market/priceoverview/';
const DELAY_MS = 1500; // Delay between requests to avoid rate limiting

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchItemPrice(appId, marketHashName, currency = 1) {
  const params = new URLSearchParams({
    appid: appId.toString(),
    currency: currency.toString(),
    market_hash_name: marketHashName
  });

  const url = `${STEAM_API_BASE}?${params}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`
      };
    }

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: 'Item not found or no listings'
      };
    }

    return {
      success: true,
      lowest_price: data.lowest_price || 'N/A',
      median_price: data.median_price || 'N/A',
      volume: data.volume || '0'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

export async function fetchAllPrices(items, currency = 1, onItemFetched = null) {
  const results = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemName = item.display_name || item.market_hash_name;
    process.stdout.write(`  [${i + 1}/${items.length}] ID:${item.id} ${itemName}... `);

    const price = await fetchItemPrice(item.app_id, item.market_hash_name, currency);

    if (price.success) {
      console.log(`✓ ${price.lowest_price}`);
    } else {
      console.log(`✗ ${price.error}`);
    }

    const itemWithPrice = { ...item, price };
    results.push(itemWithPrice);

    // Save immediately via callback (so Ctrl+C doesn't lose progress)
    if (onItemFetched) {
      onItemFetched(itemWithPrice);
    }

    // Add delay between requests (except for the last one)
    if (i < items.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  return results;
}
