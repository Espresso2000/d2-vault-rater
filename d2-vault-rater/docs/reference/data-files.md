# Data files and browser storage

## On disk (local app and MCP server)

Everything lives in one folder, `~/.d2-vault-rater` unless `VAULT_RATER_HOME` says otherwise ([src/config.ts:5](../../src/config.ts#L5)). The CLI and MCP server create its subfolders on start ([src/config.ts:18-22](../../src/config.ts#L18-L22)).

| Path | Contents | Written by |
| --- | --- | --- |
| `tokens.json` | Bungie access and refresh tokens with expiry times | [src/bungie/client.ts:21-38](../../src/bungie/client.ts#L21-L38) |
| `oauth-state.json` | The state value of a login in progress | [src/bungie/oauth.ts:6](../../src/bungie/oauth.ts#L6) |
| `settings.json` | [Settings](settings.md) | [src/rating/settings.ts:121-125](../../src/rating/settings.ts#L121-L125) |
| `dim-app.json` | The DIM API key registered for the rater | [src/dim/sync.ts:14](../../src/dim/sync.ts#L14) |
| `dim-token.json` | DIM Sync access token and expiry | [src/dim/sync.ts:15](../../src/dim/sync.ts#L15) |
| `manifest/<version>/<table>.json` | Raw manifest tables, one folder per game version | [src/bungie/manifest.ts:24-33](../../src/bungie/manifest.ts#L24-L33), [src/sources/activities.ts:81-92](../../src/sources/activities.ts#L81-L92) |
| `sources/aegis.json` | Imported tier list with matched item hashes | [src/sources/aegis.ts:35](../../src/sources/aegis.ts#L35) |
| `sources/aliases.json` | Your own `{"Aegis name": "Manifest name"}` fixes, read on import | [src/sources/aegis.ts:36](../../src/sources/aegis.ts#L36), [src/sources/aegis.ts:124-128](../../src/sources/aegis.ts#L124-L128) |
| `sources/wishlists.json` | Parsed wishlist rolls | [src/sources/wishlist.ts:21](../../src/sources/wishlist.ts#L21) |
| `sources/armor-sets.json` | Armor set bonuses with Aegis's tiers | [src/sources/armorSets.ts:41](../../src/sources/armorSets.ts#L41) |
| `sources/activities.json` | Raid and dungeon loot | [src/sources/activities.ts:75](../../src/sources/activities.ts#L75) |
| `plans/<id>.json` | A dry-run lock plan | [src/dim/actions.ts:39](../../src/dim/actions.ts#L39) |
| `plans/<id>-dim-tags.csv` | DIM tags CSV for that plan | [src/dim/actions.ts:117](../../src/dim/actions.ts#L117) |
| `snapshots/<id>.json` | Lock states before a plan was applied, for undo | [src/dim/actions.ts:40](../../src/dim/actions.ts#L40) |
| `reports/vault-report-<date>.html` | The interactive report | [src/report/site.ts:68](../../src/report/site.ts#L68) |
| `images/` | Downloaded icons and screenshots, reused by later reports | [src/report/site.ts:22](../../src/report/site.ts#L22) |

Plan ids are a timestamp plus six random hex characters ([src/dim/actions.ts:70](../../src/dim/actions.ts#L70)).

## In the browser (web app)

The web app keeps the rater's "files" in memory and saves them to IndexedDB under `file:<path>` keys, restoring them on the next visit ([web/src/shims/config.ts:22-28](../../web/src/shims/config.ts#L22-L28), [web/src/shims/config.ts:45-53](../../web/src/shims/config.ts#L45-L53)). Report files and CSVs stay in memory only ([web/src/shims/config.ts:24](../../web/src/shims/config.ts#L24)). Paths start at `/vr` ([web/src/shims/config.ts:9-20](../../web/src/shims/config.ts#L9-L20)).

| Where | Key | Contents | Source |
| --- | --- | --- | --- |
| IndexedDB `vault-rater`, store `kv` | `file:/vr/...` | Settings, sources, plans, undo snapshots, saved builds | [web/src/idb.ts:2-3](../../web/src/idb.ts#L2-L3) |
| same | `manifest` | Stripped item database for one game version | [web/src/manifest.ts:10](../../web/src/manifest.ts#L10) |
| same | `build-defs` | Builds tab definitions for one game version | [web/src/builds/defs.ts:13](../../web/src/builds/defs.ts#L13) |
| `localStorage` | `vr-tokens` | Bungie tokens | [web/src/shims/client.ts:12](../../web/src/shims/client.ts#L12) |
| `localStorage` | `vr-app-config` | API key and client id typed into the setup screen | [web/src/appConfig.ts:17](../../web/src/appConfig.ts#L17) |
| `sessionStorage` | `vr-oauth-state`, `vr-return-hash` | Login in progress; the tab to return to | [web/src/shims/oauth.ts:5](../../web/src/shims/oauth.ts#L5), [web/src/shims/oauth.ts:14](../../web/src/shims/oauth.ts#L14) |
| `sessionStorage` | `vr-dim-token` | DIM Sync token | [web/src/shims/sync.ts:15](../../web/src/shims/sync.ts#L15) |

Saved builds are the file `/vr/builds.json` ([web/src/builds/store.ts:5](../../web/src/builds/store.ts#L5)), and the Builds tab's sheet ratings are `/vr/sources/build-ratings.json` ([web/src/builds/ratings.ts:6](../../web/src/builds/ratings.ts#L6)).

## Shipped with the web app

| File | Contents | Made by |
| --- | --- | --- |
| `public/data/manifest-<version>.json` | Stripped item database | [web/scripts/snapshot.ts:30-43](../../web/scripts/snapshot.ts#L30-L43) |
| `public/data/builds-<version>.json` | Builds tab definitions | [web/scripts/snapshot.ts:45-54](../../web/scripts/snapshot.ts#L45-L54) |
| `public/data/sources.json` | Aegis's tier list and armor set tiers, used when the sheets can't be read | [web/scripts/snapshot.ts:56-61](../../web/scripts/snapshot.ts#L56-L61) |
| `app.config.json` | Bungie API key, client id and optional DIM key baked into the build | [web/src/appConfig.ts:1](../../web/src/appConfig.ts#L1) |

The manifest snapshots are git-ignored ([.gitignore](../../.gitignore)); `sources.json` is checked in.
