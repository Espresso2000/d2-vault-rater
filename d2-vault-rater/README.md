# D2 Vault Rater

An MCP tool server that lets an AI assistant rate a Destiny 2 vault. It scores every weapon against [Aegis's Endgame Analysis tier list](https://docs.google.com/spreadsheets/d/1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY/htmlview) and its roll, scores armor by Armor 3.0 stats, tier, archetype and set, writes a keep/shard report with weapon images, and locks keepers and unlocks junk in game (DIM picks the locks up on its next refresh). DIM tags and notes go in through DIM's CSV import.

Full documentation (tutorials, how-to guides, reference and explanation): [docs/](docs/README.md).

## Run it without an AI

The rater also runs on its own. Put your Bungie app keys in `.env` (copy `.env.example`), then either double-click `Vault Rater.cmd` (Windows) or run:

```
npm install && npm run build
npm run vault:serve
```

In the local app you can also **move items**: open any weapon or armor piece to pull it to a character (optionally equipping it) or send it to the vault, pull a whole encounter loadout from the RADS guides and equip it, or pull every item in a DIM loadout to its character. Moves go character → vault → character through Bungie's item actions; equipped items have to be swapped out in game first.

The first run opens the Bungie login; paste back the address your browser lands on. It then reads your vault, rates it, and opens the report at <http://localhost:7780>. The page has a **Re-rate my vault** button that re-reads your vault and refreshes the page; keep the terminal window open while you use it. Other commands:

| Command | What it does |
| --- | --- |
| `npm run vault` | Rate once and open the report file (no server) |
| `npm run vault -- login` | Log in to Bungie again |
| `npm run vault -- refresh` | Re-download Aegis's sheet, wishlists and armor set tiers (done automatically when older than a day) |
| `npm run vault -- apply <plan-id>` | Lock keepers and unlock junk from the dry-run plan printed after rating. Asks you to type "yes" first |
| `npm run vault -- undo <plan-id>` | Put back every lock that plan changed |

## Web app (no install)

`web/` is the same rater as a static site that runs entirely in your browser: Bungie sign-in, your vault, every report tab (Overview, Weapons, Armor, RADS with encounter loadouts, Full list, Shard list, Wrapped, Settings), DIM tags and loadouts, item moves, and a lock plan you preview before anything changes. It reuses the rating code in `src/`; `web/vite.config.ts` swaps the few Node-only modules (`config`, `bungie/client`, `bungie/oauth`, `bungie/manifest`, `dim/sync`) for browser versions in `web/src/shims`.

**On your own PC:** double-click `Vault Rater Web.cmd` (next to `Vault Rater.cmd`), or run `npm run local` in `web/`. It serves the site at https://localhost:7777 (the redirect URL the local app already registers) with a self-signed certificate, so your browser warns once: choose Advanced, then continue. It uses the keys in `.env`; a tiny relay in `web/local-server.ts` adds the client secret to Bungie token requests, so the secret never reaches the page, and you stay signed in (Confidential apps get refresh tokens).

**Hosted on a static server**, it needs its own Bungie app (keep the Confidential one for the local app):

- OAuth client type: **Public** (no secret ships with the site; Bungie gives public clients no refresh token, so you sign in again after about an hour)
- Redirect URL: the site's address, e.g. `https://espresso-6.github.io/vault-rater/`
- Origin header: the site's origin, e.g. `https://espresso-6.github.io`
- Scopes: **Read your Destiny 2 information** and **Move or equip your gear**

Put its API key and client id in `web/app.config.json` before building (or paste them into the setup screen the site shows when they're missing). The DIM API key registers itself for the site's origin on first use, or set `dimApiKey` there.

```
cd web
npm install
npm run snapshot   # optional: ships a stripped manifest and a tier list snapshot in public/data
npm run build      # static files in web/dist
```

The manifest is cut down to the fields the rater reads (about 4 MB) and cached in IndexedDB per game version. Aegis's sheet, the armor set sheets and the voltron wishlist are read live once a day; if a sheet can't be read, the snapshot in `public/data/sources.json` is used.

## Setup

1. Create an app at <https://www.bungie.net/en/Application>:
   - OAuth client type: **Confidential**
   - Redirect URL: `https://localhost:7777/callback` (the page never has to load)
   - Scopes: **Read your Destiny 2 information** and **Move or equip your gear**
   - Origin header: `*` is fine for a local tool
2. `npm install && npm run build`
3. Add the server to your MCP client. Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "d2-vault-rater": {
      "command": "node",
      "args": ["/path/to/d2-vault-rater/dist/server.js"],
      "env": {
        "BUNGIE_API_KEY": "...",
        "BUNGIE_CLIENT_ID": "...",
        "BUNGIE_CLIENT_SECRET": "..."
      }
    }
  }
}
```

Claude Code: `claude mcp add d2-vault-rater -e BUNGIE_API_KEY=... -e BUNGIE_CLIENT_ID=... -e BUNGIE_CLIENT_SECRET=... -- node /path/to/dist/server.js`

4. Give the AI the instructions in [`skill/SKILL.md`](skill/SKILL.md). The server also serves them as the `vault_review` prompt, and in Claude Code you can copy the folder to `~/.claude/skills/d2-vault-review/`.
5. Ask: "Review my Destiny vault."

Tokens, caches, settings, plans and reports live in `~/.d2-vault-rater` (override with `VAULT_RATER_HOME`).

## Tools

The main tools are below; [docs/reference/mcp-tools.md](docs/reference/mcp-tools.md) lists all of them, including `rate_activities`, `plan_encounters`, `move_items` and `set_dim_tag`.

| Tool | What it does | Changes anything in game? |
| --- | --- | --- |
| `login` | Bungie OAuth: returns the approval URL, then takes the URL you land on | No |
| `refresh_sources` | Downloads the manifest, imports every weapon tab of Aegis's sheet and the voltron wishlist | No |
| `get_vault` | Reads your vault and characters | No |
| `get_settings` / `update_settings` | Strictness preset, per-setting and per-weapon-type overrides, protect list, build stats, tone | No |
| `rate_weapons` | Scores, best per slot / element / archetype, duplicates, shard list, S-tier gaps | No |
| `rate_armor` | Best piece per class and slot, set counts, shard list | No |
| `build_report` | Markdown report with images, plus an HTML copy | No |
| `plan_dim_actions` | Dry run of locks, unlocks and tags | No |
| `apply_dim_actions` | Applies an approved plan (needs `confirm: true`), saves an undo snapshot, writes the DIM CSV | Yes, locks |
| `export_dim_csv` | Writes the DIM tags CSV only | No |
| `undo_dim_actions` | Restores the locks a plan changed | Yes, locks |

## How scoring works

**Weapons:** 60% Aegis tier (S 100, A 85, B 70, C 50, D 30, plus up to 5 for rank) and 40% roll: perk columns 35% each, barrel and magazine 10% each, origin and masterwork 5% each. A column counts if any selectable perk is on Aegis's list; enhanced perks get 10% more, and both trait columns matching adds 10. Weapons missing from the sheet fall back to the voltron wishlist (god roll = B tier, otherwise C).

**Armor:** 40% stats (top three stats against a 30/25/20 Tier 5 roll), 25% fit to the stats your builds want (set in settings or read from equipped armor), 25% set bonus (Aegis's set tiers, weighted by how many pieces you own), 10% Tier 5 / exotic.

**Strictness presets**

| Setting | Lenient | Balanced (default) | Strict | Ruthless |
| --- | --- | --- | --- | --- |
| Lowest tier kept without a great roll | C | B | A | S |
| Roll score to keep a non-best copy | 50 | 70 | 80 | 90 |
| Copies per type + frame + element | 3 | 2 | 1 | 1 |
| Score gap that marks a weapon outscored | 35 | 25 | 15 | 10 |
| Unrated weapons | keep | keep, flagged | wishlist decides | shard unless god roll |
| Armor copies per class + slot + archetype | 3 | 2 | 1 | 1 |
| Legacy armor | keep | keep if close | shard if outscored | shard |
| Unlocked on apply | duplicates | duplicates | + D tier | every shard category |

Never unlocked at any preset: equipped items, Adept/Timelost copies, items on the protect list, and your only weapon for a slot + element. Extra exotic copies are flagged for review, not unlocked.

## Development

```
npm test         # unit tests (fixtures, no network)
npm run typecheck
npm run docs:check # every code link in docs/ points at a real file and line
npm run dev      # run the server from source
```

If Google changes the sheet's page so tabs can't be listed, add them to `settings.json` as `"aegisTabs": [{"name": "SMGs", "gid": "1405969509"}]`. Weapon names that don't match the manifest are reported by `refresh_sources`; map them in `~/.d2-vault-rater/sources/aliases.json` as `{"Aegis name": "Manifest name"}`.
