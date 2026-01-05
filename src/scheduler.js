import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { getAllItems, savePriceSnapshot, DATA_DIR } from './db.js';
import { fetchAllPrices } from './steam-api.js';

const LOCK_FILE = join(DATA_DIR, '.fetch-lock');
const STALE_LOCK_MS = 90 * 60 * 1000; // 90 minutes (fetches can take 45+ min with rate limiting)

export function acquireLock() {
  try {
    writeFileSync(LOCK_FILE, `${Date.now()}`, { flag: 'wx' });
    return true;
  } catch (e) {
    if (e.code === 'EEXIST') {
      // Check if lock is stale
      try {
        const lockTime = parseInt(readFileSync(LOCK_FILE, 'utf8'), 10);
        if (Date.now() - lockTime > STALE_LOCK_MS) {
          console.log('[Scheduler] Removing stale lock file');
          unlinkSync(LOCK_FILE);
          return acquireLock();
        }
      } catch {
        // If we can't read the lock file, remove it
        unlinkSync(LOCK_FILE);
        return acquireLock();
      }
      return false;
    }
    throw e;
  }
}

export function releaseLock() {
  try {
    unlinkSync(LOCK_FILE);
  } catch {
    // Ignore errors when releasing lock
  }
}

export function isLocked() {
  if (!existsSync(LOCK_FILE)) return false;
  try {
    const lockTime = parseInt(readFileSync(LOCK_FILE, 'utf8'), 10);
    return Date.now() - lockTime < STALE_LOCK_MS;
  } catch {
    return false;
  }
}

export function getLockInfo() {
  if (!existsSync(LOCK_FILE)) return null;
  try {
    const lockTime = parseInt(readFileSync(LOCK_FILE, 'utf8'), 10);
    return {
      lockedAt: new Date(lockTime).toISOString(),
      isStale: Date.now() - lockTime > STALE_LOCK_MS
    };
  } catch {
    return null;
  }
}

export async function runScheduledFetch(silent = false) {
  if (!acquireLock()) {
    if (!silent) console.log('[Scheduler] Fetch already in progress, skipping...');
    return { success: false, reason: 'locked' };
  }

  try {
    const items = getAllItems();
    if (items.length === 0) {
      if (!silent) console.log('[Scheduler] No items to fetch');
      return { success: true, fetched: 0 };
    }

    const startTime = Date.now();
    if (!silent) console.log(`[Scheduler] Starting fetch of ${items.length} items at ${new Date().toISOString()}`);

    let savedCount = 0;
    const saveOnFetch = (item) => {
      if (item.price.success) {
        savePriceSnapshot(
          item.id,
          item.price.lowest_price,
          item.price.median_price,
          item.price.volume
        );
        savedCount++;
      }
    };

    await fetchAllPrices(items, 1, saveOnFetch);

    const duration = Math.round((Date.now() - startTime) / 1000);
    if (!silent) console.log(`[Scheduler] Fetch complete: ${savedCount}/${items.length} items saved in ${duration}s`);

    return {
      success: true,
      fetched: savedCount,
      total: items.length,
      durationSeconds: duration
    };
  } catch (error) {
    console.error('[Scheduler] Fetch failed:', error.message);
    return { success: false, reason: 'error', error: error.message };
  } finally {
    releaseLock();
  }
}
