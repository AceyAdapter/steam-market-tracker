# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the tracker (fetch current prices for all tracked items)
npm start

# Fetch prices for specific items
npm start -- <id>              # Single item
npm start -- <start>-<end>     # ID range (e.g., 5-10)
npm start -- <start>-          # From ID onwards (e.g., 15-)

# Add an item to track
npm run add -- <app_id> "<market_hash_name>" ["<display_name>"]

# List all tracked items
npm run list

# Remove an item
npm run remove -- <id>

# View price history
npm run history          # All items
npm run history -- <id>  # Specific item

# Inventory management (track owned items with cost basis)
npm run inv                                        # Show inventory summary
npm run inv -- add <item_id> <qty> <buy_price>    # Add to inventory
npm run inv -- update <inv_id> <qty> <buy_price>  # Update entry
npm run inv -- remove <inv_id>                    # Remove entry
```

## Architecture

This is a Node.js CLI application (ES modules) that tracks Steam Community Market prices using SQLite for persistence.

**Core modules:**

- `src/index.js` - CLI entry point, command routing
- `src/steam-api.js` - Steam Market API client with 1.5s delay between requests (Steam rate limits after ~20 requests)
- `src/db.js` - SQLite database layer using better-sqlite3
- `src/display.js` - CLI table output formatting using cli-table3

**Data flow:** Items are stored in `items` table. Running without arguments fetches prices from Steam API and saves snapshots to `price_history` table. Ctrl+C during fetches saves progress.

**Database:** Located at `data/tracker.db`. Three tables: `items` (tracked items), `price_history` (price snapshots with timestamps), and `inventory` (owned items with cost basis).

**Steam API:** Uses the public `/market/priceoverview/` endpoint. Currency defaults to USD (currency=1).

## Important App IDs

- 730: Counter-Strike 2
- 440: Team Fortress 2
- 753: Steam (trading cards, backgrounds)
- 590830: S&box
