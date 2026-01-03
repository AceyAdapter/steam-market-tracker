import express from 'express';
import cron from 'node-cron';
import {
  getAllItems,
  getItemById,
  getItemHistory,
  getLatestPrices,
  getInventorySummary,
  getPortfolioStats,
  getItemCount,
  getLatestFetchTime,
  addItem,
  removeItem,
  close
} from './db.js';
import { runScheduledFetch, isLocked, getLockInfo } from './scheduler.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const FETCH_INTERVAL = process.env.FETCH_INTERVAL_MINUTES || 15;

// Health check
app.get('/health', (req, res) => {
  const lockInfo = getLockInfo();
  res.json({
    status: 'ok',
    trackedItems: getItemCount(),
    lastFetch: getLatestFetchTime(),
    fetchInProgress: isLocked(),
    lockInfo,
    uptime: process.uptime()
  });
});

// List all items with latest prices
app.get('/api/items', (req, res) => {
  try {
    const items = getAllItems();
    const latestPrices = getLatestPrices();

    // Create a map for quick lookup
    const priceMap = new Map();
    for (const p of latestPrices) {
      priceMap.set(p.item_id, p);
    }

    const result = items.map(item => {
      const price = priceMap.get(item.id);
      return {
        id: item.id,
        appId: item.app_id,
        marketHashName: item.market_hash_name,
        displayName: item.display_name,
        createdAt: item.created_at,
        latestPrice: price ? {
          lowestPrice: price.lowest_price,
          medianPrice: price.median_price,
          volume: price.volume,
          fetchedAt: price.fetched_at
        } : null
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single item
app.get('/api/items/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const item = getItemById(id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const latestPrices = getLatestPrices();
    const price = latestPrices.find(p => p.item_id === id);

    res.json({
      id: item.id,
      appId: item.app_id,
      marketHashName: item.market_hash_name,
      displayName: item.display_name,
      createdAt: item.created_at,
      latestPrice: price ? {
        lowestPrice: price.lowest_price,
        medianPrice: price.median_price,
        volume: price.volume,
        fetchedAt: price.fetched_at
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get item price history
app.get('/api/items/:id/history', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const limit = parseInt(req.query.limit, 10) || 50;

    const item = getItemById(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const history = getItemHistory(id, limit);

    res.json({
      item: {
        id: item.id,
        marketHashName: item.market_hash_name,
        displayName: item.display_name
      },
      history: history.map(h => ({
        lowestPrice: h.lowest_price,
        medianPrice: h.median_price,
        volume: h.volume,
        fetchedAt: h.fetched_at
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get inventory with cost basis and returns
app.get('/api/inventory', (req, res) => {
  try {
    const inventory = getInventorySummary();

    const result = inventory.map(row => ({
      id: row.id,
      itemId: row.item_id,
      marketHashName: row.market_hash_name,
      displayName: row.display_name,
      quantity: row.quantity,
      buyPrice: row.buy_price,
      costBasis: row.cost_basis,
      currentPrice: row.current_price,
      currentValue: row.current_value,
      returnValue: row.return_value,
      returnPercent: row.return_percent,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get portfolio stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = getPortfolioStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new item to track
app.post('/api/items', (req, res) => {
  try {
    const { appId, marketHashName, displayName } = req.body;

    if (!appId || !marketHashName) {
      return res.status(400).json({ error: 'appId and marketHashName are required' });
    }

    const result = addItem(parseInt(appId, 10), marketHashName, displayName || null);

    if (result.success) {
      res.status(201).json({ id: result.id, message: 'Item added successfully' });
    } else {
      res.status(409).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove item
app.delete('/api/items/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const removed = removeItem(id);

    if (removed) {
      res.json({ message: 'Item removed successfully' });
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual fetch trigger (optional endpoint)
app.post('/api/fetch', async (req, res) => {
  try {
    if (isLocked()) {
      return res.status(409).json({ error: 'Fetch already in progress' });
    }

    // Run fetch in background and return immediately
    res.json({ message: 'Fetch started', status: 'running' });

    // Don't await - let it run in background
    runScheduledFetch().catch(err => {
      console.error('[API] Background fetch error:', err);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scheduled price fetcher
const cronSchedule = `*/${FETCH_INTERVAL} * * * *`;
console.log(`[Server] Scheduling price fetches every ${FETCH_INTERVAL} minutes (cron: ${cronSchedule})`);

cron.schedule(cronSchedule, async () => {
  console.log(`[Cron] Triggered at ${new Date().toISOString()}`);
  await runScheduledFetch();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Received SIGTERM, shutting down...');
  close();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Steam Market Tracker API running on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[Server] Tracked items: ${getItemCount()}`);
  console.log(`[Server] Last fetch: ${getLatestFetchTime() || 'Never'}`);
});
