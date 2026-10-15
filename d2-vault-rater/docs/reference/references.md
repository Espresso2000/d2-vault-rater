# References

The outside sources Vault Rater relies on: the APIs it calls, the data it imports, and the community projects whose ideas or formats it follows. Pages in these docs link here, or straight to the source, where they depend on one.

## Bungie.net API

| Source | Used for |
| --- | --- |
| [Bungie.net API repository and wiki](https://github.com/Bungie-net/api) | The official API home: issues, changelog and the OpenAPI spec. |
| [API endpoint documentation](https://bungie-net.github.io/multi/index.html) | Every endpoint and schema. |
| [OAuth documentation](https://github.com/Bungie-net/api/wiki/OAuth-Documentation) | Confidential vs Public clients, the authorize and token URLs, refresh tokens (Public clients get none). Behind [the tutorial's app setup](../tutorials/first-vault-report.md#1-create-a-bungie-app) and [hosting the web app](../how-to/host-the-web-app.md). |
| [Application portal](https://www.bungie.net/en/Application) | Where you create the app, set its redirect URL, origin header and scopes. |
| [GetProfile](https://bungie-net.github.io/multi/operation_get_Destiny2-GetProfile.html) and [component types](https://bungie-net.github.io/multi/schema_Destiny-DestinyComponentType.html) | Reading the vault, characters, sockets and perks ([src/vault/fetch.ts:12](../../src/vault/fetch.ts#L12)). |
| [SetItemLockState](https://bungie-net.github.io/multi/operation_post_Destiny2-SetItemLockState.html) | Applying and undoing lock plans ([src/dim/actions.ts:125](../../src/dim/actions.ts#L125)). |
| [TransferItem](https://bungie-net.github.io/multi/operation_post_Destiny2-TransferItem.html), [EquipItems](https://bungie-net.github.io/multi/operation_post_Destiny2-EquipItems.html) | Moving and equipping items ([src/bungie/transfer.ts:66-97](../../src/bungie/transfer.ts#L66-L97)). |
| [InsertSocketPlugFree](https://bungie-net.github.io/multi/operation_post_Destiny2-InsertSocketPlugFree.html) | Switching a weapon's perk from the drawer ([src/bungie/transfer.ts:139](../../src/bungie/transfer.ts#L139)), and the Builds tab changing subclass and mod sockets ([web/src/builds/equip.ts:29](../../web/src/builds/equip.ts#L29)). |

| [GetVendors](https://bungie-net.github.io/multi/operation_get_Destiny2-GetVendors.html), [GetVendor](https://bungie-net.github.io/multi/operation_get_Destiny2-GetVendor.html) | The Vendors tab: every vendor's stock for one character, then each gear vendor alone for its items' rolled perks and stats ([src/vendors/vendors.ts:203-205](../../src/vendors/vendors.ts#L203-L205), [src/vendors/vendors.ts:239-245](../../src/vendors/vendors.ts#L239-L245)). |
| [GetDestinyEntityDefinition](https://bungie-net.github.io/multi/operation_get_Destiny2-GetDestinyEntityDefinition.html) | One definition at a time for what the stripped manifest leaves out: vendor names, currencies, Eververse cosmetics; saved per game version ([src/vendors/vendors.ts:186-198](../../src/vendors/vendors.ts#L186-L198)). |

## The Destiny manifest

| Source | Used for |
| --- | --- |
| [Obtaining Destiny Definitions ("The Manifest")](https://github.com/Bungie-net/api/wiki/Obtaining-Destiny-Definitions-%22The-Manifest%22) | What the manifest is and how its per-version JSON tables are downloaded. |
| [GetDestinyManifest](https://bungie-net.github.io/multi/operation_get_Destiny2-GetDestinyManifest.html) | The live version and table paths, checked on every load ([src/bungie/manifest.ts:21-34](../../src/bungie/manifest.ts#L21-L34), [web/scripts/snapshot.ts:26](../../web/scripts/snapshot.ts#L26)). |

Item, plug, stat, socket, collectible and activity definitions all come from these tables; see [caching](../explanation/caching.md#the-manifest-one-copy-per-game-version) for how they are cut down and stored.

## Rating sources

| Source | Used for |
| --- | --- |
| [Aegis's Destiny 2 Endgame Analysis sheet](https://docs.google.com/spreadsheets/d/1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY/htmlview) | Weapon tiers, ranks and recommended perks ([src/sources/aegis.ts:6](../../src/sources/aegis.ts#L6)); armor set bonus tiers ([src/sources/armorSets.ts:7](../../src/sources/armorSets.ts#L7)); the Builds tab's subclass, aspect and fragment tiers. |
| [Destiny Data Compendium](https://docs.google.com/spreadsheets/d/1WaxvbLx7UoSZaBqdFr1u32F2uWVLo-CJunJB4nlGUE4/htmlview) | Armor set bonus descriptions ([src/sources/armorSets.ts:8](../../src/sources/armorSets.ts#L8)) and the Builds tab's ability, aspect, fragment and mod descriptions ([web/src/builds/sheets.ts:12-16](../../web/src/builds/sheets.ts#L12-L16)). |
| [DIM wish list sources (voltron)](https://github.com/48klocs/dim-wish-list-sources) | The default wishlist: god rolls and trash rolls for weapons not on Aegis's sheet ([src/sources/wishlist.ts:5](../../src/sources/wishlist.ts#L5)). |
| [DIM: Creating Wish Lists](https://github.com/DestinyItemManager/DIM/wiki/Creating-Wish-Lists) | The `dimwishlist:item=…&perks=…` line format the wishlist parser reads ([src/sources/wishlist.ts:23-42](../../src/sources/wishlist.ts#L23-L42)). |
| [Destiny Clarity](https://github.com/Database-Clarity) ([live database](https://github.com/Database-Clarity/Live-Clarity-Database)) | Community-tested numbers for abilities, aspects, fragments and mods in the Builds tab ([web/src/builds/sheets.ts:169](../../web/src/builds/sheets.ts#L169)). |

## DIM (Destiny Item Manager)

| Source | Used for |
| --- | --- |
| [DIM](https://destinyitemmanager.com/) ([source](https://github.com/DestinyItemManager/DIM), [wiki](https://github.com/DestinyItemManager/DIM/wiki)) | The tags CSV format (`Id`, `Hash`, `Tag`, `Notes`) for **Import tags/notes from CSV** ([src/dim/actions.ts:108-113](../../src/dim/actions.ts#L108-L113)); the loadout format builds convert to and from; the vault layout the Vault tab copies; how Font mods add to stats. |
| [DIM API](https://github.com/DestinyItemManager/dim-api) | DIM Sync: reading tags and loadouts, writing a tag, registering an API key ([src/dim/common.ts:7](../../src/dim/common.ts#L7)). |
| [dim.gg](https://dim.gg/) | Loadout share links from the Builds tab ([web/src/builds/dim.ts:23-28](../../web/src/builds/dim.ts#L23-L28)). |

## Other community tools

| Source | Used for |
| --- | --- |
| [light.gg](https://www.light.gg/) | Per-weapon links for rolls and community ratings ([web/src/builds/ui.ts:98](../../web/src/builds/ui.ts#L98)). |
| [D2 Foundry](https://d2foundry.gg/) | Per-weapon links for perk numbers ([web/src/builds/ui.ts:98](../../web/src/builds/ui.ts#L98)). |
| [D2ArmorPicker](https://d2armorpicker.com/) | The idea behind the Builds gear list's stat columns and sorting. |

## Standards and tooling

| Source | Used for |
| --- | --- |
| [Model Context Protocol](https://modelcontextprotocol.io/) | The tool server protocol ([src/server.ts:32](../../src/server.ts#L32)). |
| [RFC 6749: OAuth 2.0](https://www.rfc-editor.org/rfc/rfc6749) | The authorization code flow Bungie's OAuth follows. |
| [RFC 4180: CSV](https://www.rfc-editor.org/rfc/rfc4180) | The CSV parser for Google Sheets exports ([src/sources/csv.ts:5](../../src/sources/csv.ts#L5)). |
| [IndexedDB (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) | Where the web app keeps its files and manifest ([web/src/idb.ts:6](../../web/src/idb.ts#L6)). |
| [Vite](https://vitejs.dev/) | Builds the web app and swaps Node-only modules for browser shims ([web/vite.config.ts:22-34](../../web/vite.config.ts#L22-L34)). |
| [Diátaxis](https://diataxis.fr/) | How these docs are organised. |
