# What is cached, where, and when it is thrown away

Rating a vault needs a lot of data that rarely changes: Bungie's manifest (hundreds of MB raw), Aegis's tier list, a wishlist with about 275,000 rolls, armor set tiers and raid loot. Vault Rater keeps each of these until something makes it stale, and keys everything that depends on the game version by that version.

## The manifest: one copy per game version

- **Node.** The rater asks Bungie for the live manifest version on every load and keeps one folder per version under the manifest directory ([src/bungie/manifest.ts:21-34](../../src/bungie/manifest.ts#L21-L34)). The folder name is the version made file-safe ([src/bungie/defs.ts:48](../../src/bungie/defs.ts#L48)). Each table is cut down to the fields the rater reads ([src/bungie/strip.ts:18](../../src/bungie/strip.ts#L18)) and cached as `<table>.lite.json`, so later runs parse a few MB instead of the 200 MB item table; it is downloaded again only when that file is missing or a refresh is forced ([src/bungie/tables.ts:11-25](../../src/bungie/tables.ts#L11-L25), [src/bungie/manifest.ts:31](../../src/bungie/manifest.ts#L31)). A full `<table>.json` left by an older version of the rater is stripped instead of downloaded again ([src/bungie/tables.ts:16](../../src/bungie/tables.ts#L16)). Within a process, the parsed manifest is reused while the version matches ([src/bungie/manifest.ts:26](../../src/bungie/manifest.ts#L26)).
- **Browser.** The web app cannot hold 200 MB, so it keeps a stripped manifest built with the same strip functions, minus cosmetic plugs ([web/src/strip.ts:8-14](../../web/src/strip.ts#L8-L14)). `loadVersioned` ([web/src/versioned.ts:36](../../web/src/versioned.ts#L36)) tries three places in order:
  1. IndexedDB, if the stored copy's version matches the live one ([web/src/versioned.ts:38-39](../../web/src/versioned.ts#L38-L39));
  2. a snapshot shipped with the site, `data/<name>-<version>.json` ([web/src/versioned.ts:42](../../web/src/versioned.ts#L42)), made by `npm run snapshot` ([web/scripts/snapshot.ts:30-43](../../web/scripts/snapshot.ts#L30-L43));
  3. a Web Worker that downloads and strips the tables from bungie.net ([web/src/versioned.ts:52](../../web/src/versioned.ts#L52), [web/src/manifest.worker.ts](../../web/src/manifest.worker.ts)).

  Whatever it got is saved back to IndexedDB under the same key ([web/src/versioned.ts:62](../../web/src/versioned.ts#L62)), replacing the old version. The item database uses the key `manifest` ([web/src/manifest.ts:10](../../web/src/manifest.ts#L10)) and the Builds tab's definitions use `build-defs` ([web/src/builds/defs.ts:13](../../web/src/builds/defs.ts#L13)). The manifest index itself is requested once per visit and shared by both ([web/src/versioned.ts:16-22](../../web/src/versioned.ts#L16-L22)).

## Rating sources: refreshed after 24 hours

- The local app re-imports every source when the oldest is more than a day old ([src/pipeline.ts:27-31](../../src/pipeline.ts#L27-L31), [src/pipeline.ts:58](../../src/pipeline.ts#L58)). The MCP server only re-imports when the AI calls `refresh_sources`.
- The web app checks each source on its own and re-imports it after 24 hours ([web/src/sources.ts:28](../../web/src/sources.ts#L28)). If a sheet can't be read and nothing is cached, it falls back to `public/data/sources.json` shipped with the site ([web/src/sources.ts:41-43](../../web/src/sources.ts#L41-L43)). Like the local app ([src/sources/wishlist.ts:50-51](../../src/sources/wishlist.ts#L50-L51)), it drops wishlist notes, which would make the cache about ten times bigger ([web/src/sources.ts:57](../../web/src/sources.ts#L57)). Raid loot is also rebuilt when the game version changes ([web/src/sources.ts:81](../../web/src/sources.ts#L81)).
- The Builds tab's rating sheets refresh daily the same way ([web/src/builds/ratings.ts:17](../../web/src/builds/ratings.ts#L17)).

## Parsed files in a long-running process

The MCP server lives for a whole chat, and every rating call used to parse the source files again. `readJsonCached` ([src/config.ts:46-55](../../src/config.ts#L46-L55)) keeps the parsed Aegis list, wishlists, armor sets and raid loot, keyed by the file's modification time and size, and any write through the rater drops the cached copy ([src/config.ts:60](../../src/config.ts#L60)). Because an unchanged file gives back the *same object*, the server can tell cheaply whether anything changed.

The wishlist cache is written without notes (the rater only reads perks) and without indentation, since it is read on every rating ([src/sources/wishlist.ts:51-55](../../src/sources/wishlist.ts#L51-L55)): about 28 MB for voltron's list instead of 267 MB.

In the browser, the saved files are restored with one IndexedDB read at startup ([web/src/shims/config.ts:26-36](../../web/src/shims/config.ts#L26-L36), [web/src/idb.ts:30-44](../../web/src/idb.ts#L30-L44)). Every rating saves a lock plan; plans that were never applied are deleted there instead of being loaded on every later visit ([web/src/shims/config.ts:33](../../web/src/shims/config.ts#L33)).

## Ratings in the MCP server

`rateAll` ([src/server.ts:68-81](../../src/server.ts#L68-L81)) reuses the last weapon and armor ratings while the vault object, the settings and the source objects are the same ([src/server.ts:77-79](../../src/server.ts#L77-L79)). Fetching the vault again (`get_vault`) or saving settings changes one of those, so the next call rates afresh. DIM Sync data is re-read at most every five minutes ([src/server.ts:51-63](../../src/server.ts#L51-L63)).

## Images in the local report

The local report embeds every icon as a data URI so it works offline; each image is downloaded once into the images folder and reused after that ([src/report/site.ts:22](../../src/report/site.ts#L22), [src/report/site.ts:41-45](../../src/report/site.ts#L41-L45)). Only the top pick per slot gets its full-size screenshot, since each is about 170 KB ([src/report/siteData.ts:14-15](../../src/report/siteData.ts#L14-L15)). The web app loads images from bungie.net as they scroll into view, so there every weapon gets its screenshot ([web/src/main.ts:164-165](../../web/src/main.ts#L164-L165)).

## In the page

- Images load lazily and decode off the main thread; a remote image that fails is retried twice before the placeholder shows ([report-template/site.html:870-881](../../report-template/site.html#L870-L881)).
- Rows and tiles in long lists skip layout and paint while off screen ([report-template/site.html:426-428](../../report-template/site.html#L426-L428)), so the full list and Shard tab stay smooth with hundreds of icons.
- The Builds tab is a separate JavaScript chunk, fetched in the background once the report is on screen ([web/src/main.ts:179-183](../../web/src/main.ts#L179-L183)).
- Its score map, stat names and weapon tiers are worked out once per rating run, not on every redraw ([web/src/builds/ui.ts:49-59](../../web/src/builds/ui.ts#L49-L59)), and items are looked up through a per-vault index ([web/src/builds/model.ts:106-113](../../web/src/builds/model.ts#L106-L113)).
- Your Destiny membership is asked for once per visit ([web/src/shims/oauth.ts:44-59](../../web/src/shims/oauth.ts#L44-L59)).

## Fewer waits on Bungie

- The Destiny membership lookup is shared: the Node rater asks once per Bungie account and process ([src/bungie/oauth.ts:44-63](../../src/bungie/oauth.ts#L44-L63)), the web app once per visit (above). Reading the vault checks the manifest version and the membership at the same time ([src/vault/fetch.ts:10](../../src/vault/fetch.ts#L10)).
- Wrapped's account stats are fetched while the vault is read and rated, not after ([src/pipeline.ts:63-64](../../src/pipeline.ts#L63-L64), [web/src/main.ts:128-129](../../web/src/main.ts#L128-L129)). Its own requests go out together in two rounds: profile and stats first, then titles and per-weapon kills, which need the character list ([src/vault/wrapped.ts:57-80](../../src/vault/wrapped.ts#L57-L80)).

## Hosting

The built site's scripts and styles have content hashes in their names, and the manifest snapshots have the game version in theirs, so a host can cache them for a long time. See [Host the web app](../how-to/host-the-web-app.md).
