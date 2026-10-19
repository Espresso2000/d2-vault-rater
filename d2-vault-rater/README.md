# D2 Vault Rater

Vault Rater rates every weapon and armor piece in a Destiny 2 vault and says what to keep and what to shard. Weapons are scored against [Aegis's Endgame Analysis tier list](https://docs.google.com/spreadsheets/d/1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY/htmlview) and community wishlists, armor by Armor 3.0 stats, tier, archetype and set bonus. After you approve, it can lock keepers and unlock junk in game, move and equip items, switch weapon perks and mods, and tag items in [DIM](https://destinyitemmanager.com/) or with tags kept in your browser. It reads and changes your gear through the [Bungie.net API](https://github.com/Bungie-net/api).

It runs three ways, all on the same rating code:

- **Local app**: rate from the command line and use the report page at <http://localhost:7780>.
- **Web app**: the same rater and report in your browser, plus a Vendors tab (what's worth buying this week) and a Builds tab, on your PC or on a static host.
- **MCP server**: tools an AI client such as Claude calls to review your vault with you.

## Quick start (local app)

1. Create a Confidential app at <https://www.bungie.net/en/Application> with redirect URL `https://localhost:7777/callback`.
2. Copy `.env.example` to `.env` and fill in the API key, client id and client secret.
3. Run `npm install && npm run build && npm run vault:serve` (on Windows, double-click `Vault Rater.cmd` in the folder above).

The full walk-through is [Your first vault report](docs/tutorials/first-vault-report.md).

## Documentation

Everything else is in [docs/](docs/index.md), in four kinds of page:

- [Tutorials](docs/index.md#tutorials): your first vault report; the web app on your PC.
- [How-to guides](docs/index.md#how-to-guides): connect an AI client, tune strictness, protect items, move and equip items, switch weapon perks and mods, apply and undo locks, fix imports, host the web app.
- [Reference](docs/index.md#reference): MCP tools, CLI and local server, settings, the report page, data files, source layout, and the [external sources](docs/reference/references.md) the rater relies on.
- [Explanation](docs/index.md#explanation): how weapons and armor are rated, vendors, raids and dungeons, caching, safety, architecture.

## Development

```
npm test           # unit tests (fixtures, no network)
npm run typecheck
npm run docs:check # every relative link in docs/ points at a real file and line
```

See [Run the checks before you commit](docs/how-to/develop-and-check.md).
