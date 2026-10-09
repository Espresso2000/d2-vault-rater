# How the pieces fit together

Vault Rater has one rating core and three ways to run it: an MCP tool server for an AI client, a command-line app with a small local web server, and a static web app that runs entirely in the browser. All three call the same functions in `src/`; only how they reach Bungie, where they keep files and how they draw the report differ.

## One core, three front ends

| Front end | Entry point | What it adds |
| --- | --- | --- |
| MCP server | [src/server.ts:32](../../src/server.ts#L32) | Registers the tools an AI calls ([reference](../reference/mcp-tools.md)) and serves `skill/SKILL.md` as the `vault_review` prompt ([src/server.ts:118](../../src/server.ts#L118)). |
| CLI and local server | [src/cli.ts:180](../../src/cli.ts#L180) | Runs the whole pipeline without an AI ([src/pipeline.ts:56](../../src/pipeline.ts#L56)) and serves the report on `127.0.0.1` ([src/cli.ts:173](../../src/cli.ts#L173)). |
| Web app | [web/src/main.ts:119](../../web/src/main.ts#L119) | Signs in with Bungie in the browser, then runs the same steps and renders the same report template. |

The rating steps are the same everywhere: load the manifest, make sure the rating sources are fresh, read the vault, optionally read DIM Sync data, rate weapons and armor, draft a lock plan, rate raids and dungeons, and build the report data. Compare [src/pipeline.ts:56-90](../../src/pipeline.ts#L56-L90) with [web/src/main.ts:119-176](../../web/src/main.ts#L119-L176).

## The shared modules

- **Vault decoding**: [src/vault/decode.ts:71](../../src/vault/decode.ts#L71) turns a Bungie `GetProfile` response into plain `WeaponRecord` and `ArmorRecord` objects ([src/vault/types.ts:23](../../src/vault/types.ts#L23), [src/vault/types.ts:46](../../src/vault/types.ts#L46)). Nothing after this step reads Bungie's raw shapes.
- **Sources**: Aegis's tier list ([src/sources/aegis.ts:138](../../src/sources/aegis.ts#L138)), community wishlists ([src/sources/wishlist.ts:44](../../src/sources/wishlist.ts#L44)), armor set tiers ([src/sources/armorSets.ts:99](../../src/sources/armorSets.ts#L99)) and raid and dungeon loot ([src/sources/activities.ts:96](../../src/sources/activities.ts#L96)).
- **Rating**: weapons ([src/rating/weapons.ts:145](../../src/rating/weapons.ts#L145)), armor ([src/rating/armor.ts:96](../../src/rating/armor.ts#L96)), activities ([src/rating/activities.ts:57](../../src/rating/activities.ts#L57)) and encounter loadouts ([src/rating/encounters.ts:82](../../src/rating/encounters.ts#L82)). These are pure functions of their inputs.
- **Actions**: the dry-run lock plan, apply and undo ([src/dim/actions.ts:46](../../src/dim/actions.ts#L46)), item moves ([src/bungie/transfer.ts:46](../../src/bungie/transfer.ts#L46)) and DIM tags ([src/dim/common.ts:55](../../src/dim/common.ts#L55)).
- **Report data**: [src/report/siteData.ts:12](../../src/report/siteData.ts#L12) shapes everything the report page draws. It does no file or network access, so the local report and the web app share it.

## How the web app reuses Node code

Most of `src/` only needs `fetch`, which browsers have. Five modules touch the file system, environment variables or Node's crypto, and the web build swaps each for a browser version: the list is [web/vite.config.ts:12-20](../../web/vite.config.ts#L12-L20), and the Vite plugin that does the swap is [web/vite.config.ts:22-34](../../web/vite.config.ts#L22-L34). Any `node:*` import resolves to small stand-ins in [web/src/shims/node.ts](../../web/src/shims/node.ts) ([web/vite.config.ts:28](../../web/vite.config.ts#L28)).

| Node module | Browser version | Difference |
| --- | --- | --- |
| [src/config.ts](../../src/config.ts) | [web/src/shims/config.ts](../../web/src/shims/config.ts) | "Files" live in memory and are saved to IndexedDB ([web/src/shims/config.ts:58-61](../../web/src/shims/config.ts#L58-L61)). |
| [src/bungie/client.ts](../../src/bungie/client.ts) | [web/src/shims/client.ts](../../web/src/shims/client.ts) | Tokens in `localStorage`; a 401 or a Bungie auth error throws `LoginRequired` so the page can ask for sign-in again ([web/src/shims/client.ts:93-99](../../web/src/shims/client.ts#L93-L99)). |
| [src/bungie/oauth.ts](../../src/bungie/oauth.ts) | [web/src/shims/oauth.ts](../../web/src/shims/oauth.ts) | Bungie redirects back to the page itself; the OAuth state lives in `sessionStorage` ([web/src/shims/oauth.ts:12](../../web/src/shims/oauth.ts#L12)). |
| [src/bungie/manifest.ts](../../src/bungie/manifest.ts) | [web/src/shims/manifest.ts](../../web/src/shims/manifest.ts) | The page loads a stripped manifest itself and hands it over with `setManifest` ([web/src/manifest.ts:20](../../web/src/manifest.ts#L20)). |
| [src/dim/sync.ts](../../src/dim/sync.ts) | [web/src/shims/sync.ts](../../web/src/shims/sync.ts) | DIM keys are registered for the page's origin ([web/src/shims/sync.ts:36](../../web/src/shims/sync.ts#L36)), and the DIM token lives in `sessionStorage` ([web/src/shims/sync.ts:55](../../web/src/shims/sync.ts#L55)). |

The parts of those modules that are the same in both places live in browser-safe files that both versions re-export, so there is one copy of each:

- [src/bungie/defs.ts](../../src/bungie/defs.ts): manifest types and name helpers.
- [src/bungie/strip.ts](../../src/bungie/strip.ts): cutting manifest tables down to the fields the rater reads (the Node cache and the web app's item database).
- [src/bungie/errors.ts](../../src/bungie/errors.ts): `BungieError`, the throttle retry and `bungieUrl`.
- [src/dim/common.ts](../../src/dim/common.ts): DIM tag names, data shapes, reading a profile and writing a tag.

## One report page

The report is a single HTML file, [report-template/site.html](../../report-template/site.html), with its CSS and JavaScript inline.

- The local app fills in the data, the image map and the title, then writes the page to the reports folder ([src/report/site.ts:58-71](../../src/report/site.ts#L58-L71)). Images are embedded as data URIs so the file works offline ([src/report/site.ts:19](../../src/report/site.ts#L19)).
- The web build injects the sign-in shell and the app script into the same template ([web/vite.config.ts:37-53](../../web/vite.config.ts#L37-L53)). After rating, the app passes the data to `window.VR_START` ([web/src/main.ts:174](../../web/src/main.ts#L174)). There, images load straight from bungie.net ([web/src/main.ts:149-151](../../web/src/main.ts#L149-L151)).
- The page's buttons call `/api/...` routes. The local server answers them over HTTP ([src/cli.ts:92](../../src/cli.ts#L92)); in the web app, `window.VR_API` answers the same routes in the browser ([web/src/main.ts:202](../../web/src/main.ts#L202)). Both read the Settings panel's changes with the same function ([src/rating/settings.ts:131](../../src/rating/settings.ts#L131)).

## The Builds tab

The web app also has a Builds tab (subclass, gear, mods and stat targets, rated and equippable). It lives in [web/src/builds/](../../web/src/builds/) and is loaded as its own chunk after the report draws ([web/src/main.ts:179-183](../../web/src/main.ts#L179-L183)). See [The Builds tab](builds-tab.md).
