# Steam Market Tracker

A command-line tool to track Steam Community Market prices over time. Monitor item prices, build price history, and manage your inventory with cost basis tracking.

## Features

- Track prices for any Steam Market item (CS2 skins, TF2 items, trading cards, etc.)
- Automatic price history snapshots stored in SQLite
- Inventory management with cost basis and return calculations
- Flexible fetching: single items, ID ranges, or all at once
- Graceful interruption with Ctrl+C (progress is saved)

## Installation

```bash
npm install
```

## Usage

### Track Items

```bash
# Add an item to track
npm run add -- 730 "AK-47 | Redline (Field-Tested)"

# Add with a custom display name
npm run add -- 730 "AWP | Asiimov (Battle-Scarred)" "AWP Asiimov BS"

# List all tracked items
npm run list

# Remove an item
npm run remove -- 1
```

### Fetch Prices

```bash
# Fetch prices for all tracked items
npm start

# Fetch a single item by ID
npm start -- 5

# Fetch a range of items
npm start -- 5-10

# Fetch from ID 15 onwards
npm start -- 15-
```

### View History

```bash
# Show recent price history for all items
npm run history

# Show history for a specific item
npm run history -- 1
```

### Inventory Tracking

Track items you own with purchase prices to calculate returns.

```bash
# View inventory summary
npm run inv

# Add 5 of item #1, bought at $12.50 each
npm run inv -- add 1 5 12.50

# Update an inventory entry
npm run inv -- update 1 3 11.00

# Remove an inventory entry
npm run inv -- remove 1
```

## App IDs

| App ID | Game |
|--------|------|
| 730 | Counter-Strike 2 |
| 440 | Team Fortress 2 |
| 753 | Steam (trading cards, backgrounds) |
| 590830 | S&box |

## How It Works

The tracker uses Steam's public Market API to fetch current prices. A 1.5-second delay between requests helps avoid Steam's rate limit (approximately 20 requests before throttling). All data is stored locally in `data/tracker.db` using SQLite.

## License

MIT
