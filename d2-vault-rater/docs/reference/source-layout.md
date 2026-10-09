# Source layout

## `src/`: the rater (Node, and shared with the web app)

| Path | What is in it |
| --- | --- |
| [src/server.ts:32](../../src/server.ts#L32) | MCP server: the tools and the `vault_review` prompt. |
| [src/cli.ts:180](../../src/cli.ts#L180) | CLI commands and the local report server. |
| [src/pipeline.ts:56](../../src/pipeline.ts#L56) | `refreshSources` and `buildReport`, the CLI's end-to-end steps. |
| [src/config.ts:7](../../src/config.ts#L7) | Data folder paths, Bungie keys from the environment, JSON file helpers. *Shimmed in the web app.* |
| [src/util.ts:2](../../src/util.ts#L2) | `groupBy`. |
| [src/bungie/client.ts:66](../../src/bungie/client.ts#L66) | Tokens, OAuth token requests, `bungie()` for Platform calls. *Shimmed.* |
| [src/bungie/errors.ts:16](../../src/bungie/errors.ts#L16) | `BungieError`, `retryThrottled`, `bungieUrl`. Browser-safe. |
| [src/bungie/oauth.ts:9](../../src/bungie/oauth.ts#L9) | Login start and finish, the primary Destiny membership. *Shimmed.* |
| [src/bungie/manifest.ts:21](../../src/bungie/manifest.ts#L21) | Loads the manifest tables the rater needs, per game version. *Shimmed.* |
| [src/bungie/tables.ts:11](../../src/bungie/tables.ts#L11) | `liteTable`: downloads one table, strips it and caches it as `<table>.lite.json`. |
| [src/bungie/strip.ts:18](../../src/bungie/strip.ts#L18) | Cuts manifest tables down to the fields the rater reads. Browser-safe; the web app uses it too. |
| [src/bungie/defs.ts:8](../../src/bungie/defs.ts#L8) | Manifest types and name helpers. Browser-safe. |
| [src/bungie/transfer.ts:46](../../src/bungie/transfer.ts#L46) | Moving and equipping items. |
| [src/vault/fetch.ts:9](../../src/vault/fetch.ts#L9) | Reads the profile and keeps the last vault. |
| [src/vault/decode.ts:71](../../src/vault/decode.ts#L71) | Profile response → `Vault`. |
| [src/vault/types.ts:67](../../src/vault/types.ts#L67) | `Vault`, `WeaponRecord`, `ArmorRecord`, `PerkColumn`. |
| [src/vault/wrapped.ts:49](../../src/vault/wrapped.ts#L49) | Account stats for the Wrapped tab. |
| [src/sources/aegis.ts:138](../../src/sources/aegis.ts#L138) | Aegis's weapon tier tabs: tab list, CSV parsing, hash matching. |
| [src/sources/armorSets.ts:99](../../src/sources/armorSets.ts#L99) | Aegis's armor set tab and the community bonus sheet. |
| [src/sources/wishlist.ts:24](../../src/sources/wishlist.ts#L24) | DIM wishlist parsing and import. |
| [src/sources/activities.ts:96](../../src/sources/activities.ts#L96) | Raid and dungeon loot; where each weapon comes from. |
| [src/sources/csv.ts:5](../../src/sources/csv.ts#L5) | RFC 4180 CSV parser and the Google Sheets CSV URL. |
| [src/data/encounters.ts:55](../../src/data/encounters.ts#L55) | Every raid and dungeon encounter, roles and meta picks. |
| [src/rating/settings.ts:89](../../src/rating/settings.ts#L89) | Settings schema, presets, `strictnessFor`. |
| [src/rating/weapons.ts:145](../../src/rating/weapons.ts#L145) | Weapon scores and verdicts. |
| [src/rating/armor.ts:96](../../src/rating/armor.ts#L96) | Armor scores and verdicts. |
| [src/rating/activities.ts:57](../../src/rating/activities.ts#L57) | Raid and dungeon ranking. |
| [src/rating/encounters.ts:45](../../src/rating/encounters.ts#L45) | Encounter loadouts. |
| [src/dim/actions.ts:46](../../src/dim/actions.ts#L46) | Lock plan, apply, undo, DIM CSV. |
| [src/dim/common.ts:30](../../src/dim/common.ts#L30) | DIM Sync shapes, profile read and tag write. Browser-safe. |
| [src/dim/sync.ts:44](../../src/dim/sync.ts#L44) | DIM Sync auth for Node. *Shimmed.* |
| [src/report/report.ts:47](../../src/report/report.ts#L47) | Markdown report and report options. |
| [src/report/siteData.ts:12](../../src/report/siteData.ts#L12) | The data the report page draws. Pure. |
| [src/report/site.ts:58](../../src/report/site.ts#L58) | Writes the HTML report with embedded images. |

## `web/`: the browser app

| Path | What is in it |
| --- | --- |
| [web/vite.config.ts:22](../../web/vite.config.ts#L22) | The shim plugin, the page plugin, local mode. |
| [web/local-server.ts:35](../../web/local-server.ts#L35) | Local mode only: serves `app-config.json` from `.env` and relays token requests with the client secret. |
| [web/src/main.ts:246](../../web/src/main.ts#L246) | Boot, sign-in screens, the rating run, the page's `/api` handlers. |
| [web/src/shell.html:1](../../web/src/shell.html#L1) | Sign-in and progress markup injected into the report template. |
| [web/src/appConfig.ts:28](../../web/src/appConfig.ts#L28) | Which Bungie app the site uses. |
| [web/src/shims/](../../web/src/shims/) | Browser versions of the five Node-only modules, plus `node:*` stand-ins. |
| [web/src/versioned.ts:36](../../web/src/versioned.ts#L36) | IndexedDB → snapshot → worker loading for per-version data. |
| [web/src/manifest.ts:8](../../web/src/manifest.ts#L8), [web/src/manifest.worker.ts:5](../../web/src/manifest.worker.ts#L5), [web/src/strip.ts:8](../../web/src/strip.ts#L8) | The stripped item database (the tables and strip functions it uses, from `src/bungie/strip.ts`). |
| [web/src/sources.ts:26](../../web/src/sources.ts#L26) | Daily source refresh with snapshot fallback. |
| [web/src/idb.ts:6](../../web/src/idb.ts#L6) | A small promise wrapper around one IndexedDB store. |
| [web/src/html.ts:2](../../web/src/html.ts#L2) | `esc()` for HTML. |
| [web/src/builds/](../../web/src/builds/) | The Builds tab ([explanation](../explanation/builds-tab.md)). |
| [web/scripts/snapshot.ts:26](../../web/scripts/snapshot.ts#L26) | Writes the snapshots shipped in `public/data`. |

## Elsewhere

| Path | What is in it |
| --- | --- |
| [report-template/site.html:848](../../report-template/site.html#L848) | The report page, shared by the local report and the web app. |
| [skill/SKILL.md:1](../../skill/SKILL.md#L1) | Instructions for an AI running a vault review. |
| [test/](../../test/) | Unit tests and fixtures. |
| [scripts/check-doc-refs.mjs:1](../../scripts/check-doc-refs.mjs#L1) | Checks the code links in these docs. |
