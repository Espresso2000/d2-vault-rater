# What is cached, where, and when it is thrown away

Rating a vault needs a lot of data that rarely changes: Bungie's manifest (hundreds of MB raw), Aegis's tier list, a wishlist with about 275,000 rolls, armor set tiers and raid loot. Vault Rater keeps each of these until something makes it stale, and keys everything that depends on the game version by that version.

## The manifest: one copy per game version

The manifest is Bungie's database of every item, perk, stat and activity definition, published as one JSON file per table and replaced with each game version ([Bungie's manifest guide](https://github.com/Bungie-net/api/wiki/Obtaining-Destiny-Definitions-%22The-Manifest%22)).

- **Node.** The rater asks Bungie for the live manifest version on every load and keeps one folder per version under the manifest directory ([src/bungie/manifest.ts:21-34](../../src/bungie/manifest.ts#L21-L34)). The folder name is the version made file-safe ([src/bungie/defs.ts:51](../../src/bungie/defs.ts#L51)). Each table is cut down to the fields the rater reads ([src/bungie/strip.ts:35](../../src/bungie/strip.ts#L35)) and cached as `<table>.lite.json`, so later runs parse a few MB instead of the 200 MB item table; it is downloaded again only when that file is missing or a refresh is forced ([src/bungie/tables.ts:11-25](../../src/bungie/tables.ts#L11-L25), [src/bungie/manifest.ts:31](../../src/bungie/manifest.ts#L31)). A full `<table>.json` left by an older version of the rater is stripped instead of downloaded again ([src/bungie/tables.ts:16](../../src/bungie/tables.ts#L16)). Within a process, the parsed manifest is reused while the version matches ([src/bungie/manifest.ts:26](../../src/bungie/manifest.ts#L26)).
- **Browser.** The web app cannot hold 200 MB, so it keeps a stripped manifest built with the same strip functions, minus cosmetic plugs ([web/src/strip.ts:8-14](../../web/src/strip.ts#L8-L14)). `loadVersioned` ([web/src/versioned.ts:36](../../web/src/versioned.ts#L36)) tries three places in order:
  1. IndexedDB, if the stored copy's version matches the live one ([web/src/versioned.ts:38-39](../../web/src/versioned.ts#L38-L39));
  2. a snapshot shipped with the site, `data/<name>-<version>.json` ([web/src/versioned.ts:42](../../web/src/versioned.ts#L42)), made by `npm run snapshot` ([web/scripts/snapshot.ts:30-43](../../web/scripts/snapshot.ts#L30-L43));
  3. a Web Worker that downloads and strips the tables from bungie.net ([web/src/versioned.ts:52](../../web/src/versioned.ts#L52), [web/src/manifest.worker.ts](../../web/src/manifest.worker.ts)).

  Whatever it got is saved back to IndexedDB under the same key ([web/src/versioned.ts:62](../../web/src/versioned.ts#L62)), replacing the old version. The item database uses the key `manifest-v3` ([web/src/manifest.ts:11-12](../../web/src/manifest.ts#L11-L12)); the number is the strip format ([src/bungie/strip.ts:7-8](../../src/bungie/strip.ts#L7-L8)), raised when the stripped tables gain a field (2 added perk icons, 3 perk descriptions), so a copy in an older format is rebuilt once. The Node cache names the item table's file the same way, `DestinyInventoryItemDefinition.lite.v3.json` ([src/bungie/manifest.ts:31-32](../../src/bungie/manifest.ts#L31-L32)). The Builds tab's definitions use `build-defs-v2` (2 added subclass text) ([web/src/builds/defs.ts:13-14](../../web/src/builds/defs.ts#L13-L14)). The shipped snapshot's name carries the strip format too, `data/manifest-v3-<version>.json`, so a snapshot made before a format change is never taken for the new format ([web/src/strip.ts:18-22](../../web/src/strip.ts#L18-L22), [web/scripts/snapshot.ts:30](../../web/scripts/snapshot.ts#L30)). The manifest index itself is requested once per visit and shared by both ([web/src/versioned.ts:16-22](../../web/src/versioned.ts#L16-L22)).

## Rating sources: refreshed after 24 hours

- The local app re-imports every source when the oldest is more than a day old ([src/pipeline.ts:27-31](../../src/pipeline.ts#L27-L31), [src/pipeline.ts:58](../../src/pipeline.ts#L58)). The MCP server only re-imports when the AI calls `refresh_sources`.
- The web app checks each source on its own and re-imports it after 24 hours ([web/src/sources.ts:28](../../web/src/sources.ts#L28)). If a sheet can't be read and nothing is cached, it falls back to `public/data/sources.json` shipped with the site ([web/src/sources.ts:42-44](../../web/src/sources.ts#L42-L44)). Like the local app ([src/sources/wishlist.ts:50-51](../../src/sources/wishlist.ts#L50-L51)), it drops wishlist notes, which would make the cache about ten times bigger ([web/src/sources.ts:58](../../web/src/sources.ts#L58)). Raid loot is also rebuilt when the game version changes ([web/src/sources.ts:82](../../web/src/sources.ts#L82)).
- The Builds tab's rating sheets refresh daily the same way ([web/src/builds/ratings.ts:17](../../web/src/builds/ratings.ts#L17)), and so do its Destiny Clarity notes; a failed Clarity refresh keeps the old copy ([web/src/builds/ratings.ts:52-63](../../web/src/builds/ratings.ts#L52-L63)).

## Parsed files in a long-running process

The MCP server lives for a whole chat, and every rating call used to parse the source files again. `readJsonCached` ([src/config.ts:46-55](../../src/config.ts#L46-L55)) keeps the parsed Aegis list, wishlists, armor sets and raid loot, keyed by the file's modification time and size, and any write through the rater drops the cached copy ([src/config.ts:60](../../src/config.ts#L60)). Because an unchanged file gives back the *same object*, the server can tell cheaply whether anything changed.

The wishlist cache is written without notes (the rater only reads perks) and without indentation, since it is read on every rating ([src/sources/wishlist.ts:51-55](../../src/sources/wishlist.ts#L51-L55)): about 28 MB for voltron's list instead of 267 MB.

In the browser, the saved files are restored with one IndexedDB read at startup ([web/src/shims/config.ts:26-36](../../web/src/shims/config.ts#L26-L36), [web/src/idb.ts:30-44](../../web/src/idb.ts#L30-L44)). Every rating saves a lock plan; plans that were never applied are deleted there instead of being loaded on every later visit ([web/src/shims/config.ts:33](../../web/src/shims/config.ts#L33)).

## Ratings in the MCP server

`rateAll` ([src/server.ts:68-81](../../src/server.ts#L68-L81)) reuses the last weapon and armor ratings while the vault object, the settings and the source objects are the same ([src/server.ts:77-79](../../src/server.ts#L77-L79)). Fetching the vault again (`get_vault`) or saving settings changes one of those, so the next call rates afresh. DIM Sync data is re-read at most every five minutes ([src/server.ts:51-63](../../src/server.ts#L51-L63)).

## Images in the local report

The local report embeds every icon as a data URI so it works offline; each image is downloaded once into the images folder and reused after that ([src/report/site.ts:24](../../src/report/site.ts#L24), [src/report/site.ts:45-49](../../src/report/site.ts#L45-L49)). Only the top pick per slot gets its full-size screenshot, since each is about 170 KB ([src/report/siteData.ts:16-17](../../src/report/siteData.ts#L16-L17)). The web app loads images from bungie.net as they scroll into view, so there every weapon gets its screenshot ([web/src/main.ts:171-172](../../web/src/main.ts#L171-L172)).

## In the page

- Fonts load without holding up the page: it draws with fallback fonts and swaps the web fonts in, and keeps the fallbacks offline ([report-template/site.html:10-11](../../report-template/site.html#L10-L11)).
- An embedded image is turned from a data URI into a short blob URL the first time it is shown, so images on tabs you never open are never decoded ([report-template/site.html:1291-1303](../../report-template/site.html#L1291-L1303)).
- Both search boxes redraw once typing pauses for 120 ms, not on every key ([report-template/site.html:2296-2298](../../report-template/site.html#L2296-L2298)).
- The list of item ids seen (for New badges) is written to storage only when the vault's items changed ([report-template/site.html:1329-1333](../../report-template/site.html#L1329-L1333)), and copies per weapon name are counted once per vault read ([report-template/site.html:1674-1676](../../report-template/site.html#L1674-L1676)).
- Images load lazily and decode off the main thread; a remote image that fails is retried twice before the placeholder shows ([report-template/site.html:1308-1318](../../report-template/site.html#L1308-L1318)).
- Rows and tiles in long lists skip layout and paint while off screen ([report-template/site.html:501-503](../../report-template/site.html#L501-L503)), so the full list and Shard tab stay smooth with hundreds of icons.
- The Builds tab is a separate JavaScript chunk, fetched in the background once the report is on screen ([web/src/main.ts:194-198](../../web/src/main.ts#L194-L198)).
- Its score map, stat names and weapon tiers are worked out once per rating run, not on every redraw ([web/src/builds/ui.ts:82-92](../../web/src/builds/ui.ts#L82-L92)), and items are looked up through a per-vault index ([web/src/builds/model.ts:108-115](../../web/src/builds/model.ts#L108-L115)).
- Your Destiny membership is asked for once per visit ([web/src/shims/oauth.ts:44-59](../../web/src/shims/oauth.ts#L44-L59)).

## Fewer waits on Bungie

- The Destiny membership lookup is shared: the Node rater asks once per Bungie account and process ([src/bungie/oauth.ts:44-63](../../src/bungie/oauth.ts#L44-L63)), the web app once per visit (above). Reading the vault checks the manifest version and the membership at the same time ([src/vault/fetch.ts:10](../../src/vault/fetch.ts#L10)).
- Wrapped's account stats are fetched while the vault is read and rated, not after ([src/pipeline.ts:63-64](../../src/pipeline.ts#L63-L64), [web/src/main.ts:131-132](../../web/src/main.ts#L131-L132)). Its own requests go out together in two rounds: profile and stats first, then titles and per-weapon kills, which need the character list ([src/vault/wrapped.ts:57-80](../../src/vault/wrapped.ts#L57-L80)).

## Vendor stock

The Vendors tab reads stock from Bungie only when it is opened, keeps each character's rated stock in memory for the visit, and reads it again on **Refresh** ([web/src/vendors/ui.ts:40-41](../../web/src/vendors/ui.ts#L40-L41), [web/src/vendors/ui.ts:109-113](../../web/src/vendors/ui.ts#L109-L113)). Vendor, currency and cosmetic names are saved per game version in `manifest/entities-<version>.json`, so only names not seen before are fetched ([src/vendors/vendors.ts:180-198](../../src/vendors/vendors.ts#L180-L198)). The stock itself is never stored. See [The Vendors tab](vendors.md).

## Work done once, not on every rating

- **Wishlist rolls by item.** The ~275,000 wishlist rolls are grouped by item once per loaded wishlist and kept for as long as that wishlist object lives; each rating, and each vendor item, then reads only the rolls for its own weapons ([src/rating/weapons.ts:95-110](../../src/rating/weapons.ts#L95-L110)).
- **Where each weapon comes from.** The web app builds the source lookup and loads raid loot once per visit, so the Vault tab's Refresh reuses them ([web/src/main.ts:133-135](../../web/src/main.ts#L133-L135)).

## The local report's size

Raid and dungeon banner art is about 130 KB per image, so the local report embeds only the best raid's and the best dungeon's; the others stay bungie.net URLs that load when online and leave a placeholder offline ([src/report/siteData.ts:123-124](../../src/report/siteData.ts#L123-L124), [src/report/siteData.ts:172-176](../../src/report/siteData.ts#L172-L176), [src/report/site.ts:15-31](../../src/report/site.ts#L15-L31)).

## Hosting

The built site's scripts and styles have content hashes in their names, and the manifest snapshots have the game version in theirs, so a host can cache them for a long time. See [Host the web app](../how-to/host-the-web-app.md).
