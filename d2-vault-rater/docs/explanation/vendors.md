# The Vendors tab: what is worth buying

The web app's Vendors tab answers one question: of what vendors sell right now, what would the rater keep if it joined your vault? It reads each vendor's current stock for one character, scores every weapon and armor piece exactly as the vault is scored, and marks it **Worth buying**, **Maybe** or **Skip** ([web/src/vendors/ui.ts:1-5](../../web/src/vendors/ui.ts#L1-L5)). It only reads; buying happens in the game.

The tab is web-only, built as its own JavaScript chunk that loads after the report draws ([web/src/main.ts:198-202](../../web/src/main.ts#L198-L202)), and it reads vendor stock from Bungie only when you first open it ([web/src/vendors/ui.ts:71-76](../../web/src/vendors/ui.ts#L71-L76)).

## Reading vendor stock

Vendor stock comes from Bungie's [GetVendors](https://bungie-net.github.io/multi/operation_get_Destiny2-GetVendors.html) call for one character, which needs your sign-in. It asks for vendors, their sales, and the sale items' instances, stats, sockets and selectable perks ([src/vendors/vendors.ts:12-13](../../src/vendors/vendors.ts#L12-L13), [src/vendors/vendors.ts:192-197](../../src/vendors/vendors.ts#L192-L197)). Three things make the result usable:

1. **Rolls need a second call.** GetVendors returns no item components, so for every vendor that sells gear the rater also calls [GetVendor](https://bungie-net.github.io/multi/operation_get_Destiny2-GetVendor.html) for that vendor alone, which does include each sale item's rolled perks and stats ([src/vendors/vendors.ts:230-245](../../src/vendors/vendors.ts#L230-L245)). A vendor whose single call fails still shows its items, scored on the weapon alone (see below).
2. **Only this week's stock.** Gear is taken only from vendors you visit (Bungie's vendor groups) and from vendors whose name starts with "Weekly"; exotic archives, season passes and legacy gear lists are collections you re-buy from, so they are left out ([src/vendors/vendors.ts:105-113](../../src/vendors/vendors.ts#L105-L113)).
3. **Names the stripped manifest lacks.** Vendor names and icons, currency names and Eververse cosmetics aren't in the app's cut-down item database, so they are looked up one at a time with [GetDestinyEntityDefinition](https://bungie-net.github.io/multi/operation_get_Destiny2-GetDestinyEntityDefinition.html) and kept for the visit ([src/vendors/vendors.ts:179-190](../../src/vendors/vendors.ts#L179-L190), [src/vendors/vendors.ts:198-229](../../src/vendors/vendors.ts#L198-L229)).

Each vendor's sale items are then decoded by the same code that decodes the vault ([src/vendors/vendors.ts:115-142](../../src/vendors/vendors.ts#L115-L142), [src/vault/decode.ts:71](../../src/vault/decode.ts#L71)). They get ids of the form `vendor:<vendor hash>:<index>`, which no vault item can have, so they never clash with copies you own ([src/vendors/vendors.ts:101-103](../../src/vendors/vendors.ts#L101-L103), [src/vendors/vendors.ts:153-162](../../src/vendors/vendors.ts#L153-L162)). Each keeps its price, when the offer leaves, and whether Bungie returned a rolled item at all ([src/vendors/vendors.ts:48-54](../../src/vendors/vendors.ts#L48-L54)). Vendors are listed with the most weapons first ([src/vendors/vendors.ts:176](../../src/vendors/vendors.ts#L176)).

**Eververse** spreads its offers over Tess Everis and many unnamed featured slots, so its offers are found by price instead: anything costing Bright Dust or Silver. The rotating offers (those that leave before the vendor's weekly reset) and everything for Bright Dust are listed with price and time left; the weekly Silver catalog is left out. Cosmetics are never rated ([src/vendors/vendors.ts:56-74](../../src/vendors/vendors.ts#L56-L74), [src/vendors/vendors.ts:144-149](../../src/vendors/vendors.ts#L144-L149)).

## Rating a sale item

`rateVendors` ([src/vendors/rate.ts:41](../../src/vendors/rate.ts#L41)) rates each sale item **together with your vault, one at a time**: the weapon is added to your weapons and the whole list is rated ([src/vendors/rate.ts:59-61](../../src/vendors/rate.ts#L59-L61)), and the same for armor ([src/vendors/rate.ts:71-73](../../src/vendors/rate.ts#L71-L73)). Its verdict therefore means "kept if it joined your vault": it competes with your own copies and archetype, never with other sale items ([src/vendors/rate.ts:1-5](../../src/vendors/rate.ts#L1-L5)). Your current settings and strictness apply, as do the rules in [How weapons are rated](weapon-rating.md) and [How armor is rated](armor-rating.md).

The verdict becomes a buying call ([src/vendors/rate.ts:37-39](../../src/vendors/rate.ts#L37-L39)):

| Rater verdict | Call |
| --- | --- |
| Keep as best, protected or set piece | **Worth buying** |
| Keep as a backup, or kept while unrated | **Maybe** |
| Shard or review | **Skip** |

Two adjustments:

- **Previews.** When Bungie returns no rolled perks for a sale item (a preview whose roll is decided when you buy it), the weapon is scored on the weapon alone, a reason says so, and a legendary that would be Worth buying is lowered to Maybe ([src/vendors/rate.ts:65-68](../../src/vendors/rate.ts#L65-L68)). Exotics keep their call, since their perks are fixed.
- **Your best copy.** For each weapon the tab shows your best owned copy's score and how many you own, and adds "beats your best copy" to the reasons when the sale copy scores higher ([src/vendors/rate.ts:47-52](../../src/vendors/rate.ts#L47-L52), [src/vendors/rate.ts:62-64](../../src/vendors/rate.ts#L62-L64)).

## What the tab shows

- **Weapons / Armor / Eververse** at the top, a **Vendor** picker, a **Character** picker (stock differs per class), **Only worth buying**, and **Refresh** to read the stock again ([web/src/vendors/ui.ts:225-235](../../web/src/vendors/ui.ts#L225-L235)).
- One collapsible card per vendor with its stock, how many are worth buying, and when the stock changes ([web/src/vendors/ui.ts:195-204](../../web/src/vendors/ui.ts#L195-L204)).
- A weapon card shows the score, Aegis tier, element, rolled perks in the game's column order with Aegis's picks ringed green, the buying call, a god-roll mark, your best copy and the price; opening it lists the reasons, Aegis's note, every perk option per column and the weapon, roll and Aegis scores ([web/src/vendors/ui.ts:134-152](../../web/src/vendors/ui.ts#L134-L152)). Armor cards show the top stats and total, and open to the stats, build-fit and set parts of the score ([web/src/vendors/ui.ts:155-168](../../web/src/vendors/ui.ts#L155-L168)).
- **Eververse** lists *Today only* (the daily featured offers, with time left) and *This week for Bright Dust*, each offer once ([web/src/vendors/ui.ts:177-193](../../web/src/vendors/ui.ts#L177-L193)).
- The tab's count is the number of weapons worth buying, shown once stock is read ([web/src/vendors/ui.ts:89-93](../../web/src/vendors/ui.ts#L89-L93)).

Stock is read once per character per visit and kept in memory; **Refresh** reads it again ([web/src/vendors/ui.ts:38-39](../../web/src/vendors/ui.ts#L38-L39), [web/src/vendors/ui.ts:78-105](../../web/src/vendors/ui.ts#L78-L105)). The chosen view, character, filter and collapsed cards are remembered in the browser ([web/src/vendors/ui.ts:55-63](../../web/src/vendors/ui.ts#L55-L63); keys in [The report page](../reference/report-page.md#what-the-page-remembers)). If your Bungie sign-in has expired, the tab says so instead of showing stock ([web/src/vendors/ui.ts:95-96](../../web/src/vendors/ui.ts#L95-L96)).

## Vendor data capture (local mode)

When the web app runs on your PC (`npm run local`), opening the tab also saves Bungie's raw vendor responses, with names, to `web/debug/vendors-<character>.json` through the local server, once per character per visit, so vendor support can be checked against real data ([web/src/vendors/capture.ts:1-5](../../web/src/vendors/capture.ts#L1-L5), [web/src/vendors/capture.ts:15-17](../../web/src/vendors/capture.ts#L15-L17), [web/local-server.ts:45-54](../../web/local-server.ts#L45-L54)). A hosted copy has no local server and skips it. The folder is git-ignored ([web/.gitignore](../../web/.gitignore)).
