const STEAM_API_BASE = 'https://steamcommunity.com/market/priceoverview/';
const BATCH_SIZE = 20; // Steam allows ~20 requests per batch
const BATCH_COOLDOWN_MS = 60000; // Wait 60s after batch completes
const RETRY_DELAY_MS = 60000; // Wait 60s on 429 error
const MIN_DELAY_MS = 100; // Small delay between requests

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTime(ms) {
  const seconds = Math.ceil(ms / 1000);
  return `${seconds}s`;
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
        error: `HTTP ${response.status}`,
        rateLimited: response.status === 429
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
  let batchCount = 0;
  const totalBatches = Math.ceil(items.length / BATCH_SIZE);

  for (let i = 0; i < items.length; i++) {
    // Show batch header at start of new batch
    if (batchCount === 0 && totalBatches > 1) {
      const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`\n  --- Batch ${currentBatch}/${totalBatches} ---`);
    }

    const item = items[i];
    const itemName = item.display_name || item.market_hash_name;
    process.stdout.write(`  [${i + 1}/${items.length}] ID:${item.id} ${itemName}... `);

    let price = await fetchItemPrice(item.app_id, item.market_hash_name, currency);

    // Retry on rate limit
    while (price.rateLimited) {
      console.log(`⏳ Rate limited, waiting ${formatTime(RETRY_DELAY_MS)}...`);
      await sleep(RETRY_DELAY_MS);
      process.stdout.write(`  [${i + 1}/${items.length}] ID:${item.id} ${itemName}... `);
      price = await fetchItemPrice(item.app_id, item.market_hash_name, currency);
    }

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

    batchCount++;

    // After completing a batch, wait before next batch
    if (batchCount >= BATCH_SIZE && i < items.length - 1) {
      console.log(`\n  Batch complete. Waiting ${formatTime(BATCH_COOLDOWN_MS)} before next batch...`);
      await sleep(BATCH_COOLDOWN_MS);
      batchCount = 0;
    } else if (i < items.length - 1) {
      await sleep(MIN_DELAY_MS);
    }
  }

  return results;
}
