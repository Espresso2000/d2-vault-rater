# The Vendors tab: what is worth buying

The web app's Vendors tab answers one question: of what vendors sell right now, what would the rater keep if it joined your vault? It reads each vendor's current stock for one character, scores every weapon and armor piece exactly as the vault is scored, and marks it **Worth buying**, **Maybe** or **Skip** ([web/src/vendors/ui.ts:1-5](../../web/src/vendors/ui.ts#L1-L5)). It only reads; buying happens in the game.

The tab is web-only, built as its own JavaScript chunk that loads after the report draws ([web/src/main.ts:200-204](../../web/src/main.ts#L200-L204)), and it reads vendor stock from Bungie only when you first open it ([web/src/vendors/ui.ts:70-75](../../web/src/vendors/ui.ts#L70-L75)).

## Reading vendor stock

Vendor stock comes from Bungie's [GetVendors](https://bungie-net.github.io/multi/operation_get_Destiny2-GetVendors.html) call for one character, which needs your sign-in. It asks for vendors, their sales, and the sale items' instances, stats, sockets and selectable perks ([src/vendors/vendors.ts:13-14](../../src/vendors/vendors.ts#L13-L14), [src/vendors/vendors.ts:200-205](../../src/vendors/vendors.ts#L200-L205)). Three things make the result usable:

1. **Rolls need a second call.** GetVendors returns no item components, so for every vendor that sells gear the rater also calls [GetVendor](https://bungie-net.github.io/multi/operation_get_Destiny2-GetVendor.html) for that vendor alone, which does include each sale item's rolled perks and stats ([src/vendors/vendors.ts:235-250](../../src/vendors/vendors.ts#L235-L250)). A vendor whose single call fails still shows its items, scored on the weapon alone (see below).
2. **Only this week's stock.** Gear is taken only from vendors you visit (Bungie's vendor groups) and from vendors whose name starts with "Weekly"; exotic archives, season passes and legacy gear lists are collections you re-buy from, so they are left out ([src/vendors/vendors.ts:106-114](../../src/vendors/vendors.ts#L106-L114)).
3. **Names the stripped manifest lacks.** Vendor names and icons, currency names and Eververse cosmetics aren't in the app's cut-down item database, so they are looked up with [GetDestinyEntityDefinition](https://bungie-net.github.io/multi/operation_get_Destiny2-GetDestinyEntityDefinition.html). Each is fetched once per game version and saved, with only the name, icon and type, to `manifest/entities-<version>.json`; later visits ask only for ones not saved yet, and failed lookups are tried again next time ([src/vendors/vendors.ts:180-198](../../src/vendors/vendors.ts#L180-L198), [src/vendors/vendors.ts:206-233](../../src/vendors/vendors.ts#L206-L233)).

Each vendor's sale items are then decoded by the same code that decodes the vault ([src/vendors/vendors.ts:116-143](../../src/vendors/vendors.ts#L116-L143), [src/vault/decode.ts:71](../../src/vault/decode.ts#L71)). They get ids of the form `vendor:<vendor hash>:<index>`, which no vault item can have, so they never clash with copies you own ([src/vendors/vendors.ts:102-104](../../src/vendors/vendors.ts#L102-L104), [src/vendors/vendors.ts:154-163](../../src/vendors/vendors.ts#L154-L163)). Each keeps its price, when the offer leaves, and whether Bungie returned a rolled item at all ([src/vendors/vendors.ts:49-55](../../src/vendors/vendors.ts#L49-L55)). Vendors are listed with the most weapons first ([src/vendors/vendors.ts:177](../../src/vendors/vendors.ts#L177)).

**Eververse** spreads its offers over Tess Everis and many unnamed featured slots, so its offers are found by price instead: anything costing Bright Dust or Silver. The rotating offers (those that leave before the vendor's weekly reset) and everything for Bright Dust are listed with price and time left; the weekly Silver catalog is left out. Cosmetics are never rated ([src/vendors/vendors.ts:57-75](../../src/vendors/vendors.ts#L57-L75), [src/vendors/vendors.ts:145-150](../../src/vendors/vendors.ts#L145-L150)).

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

- **Weapons / Armor / Eververse** at the top, a **Vendor** picker, a **Character** picker (stock differs per class), **Only worth buying**, and **Refresh** to read the stock again ([web/src/vendors/ui.ts:224-234](../../web/src/vendors/ui.ts#L224-L234)).
- One collapsible card per vendor with its stock, how many are worth buying, and when the stock changes ([web/src/vendors/ui.ts:193-202](../../web/src/vendors/ui.ts#L193-L202)). The vendor cards flow side by side, each as wide as its items need, up to four item cards across, so vendors selling one or two items share a row; a collapsed card shrinks to its header ([web/src/vendors/ui.ts:168-170](../../web/src/vendors/ui.ts#L168-L170), [web/src/vendors/ui.ts:213-220](../../web/src/vendors/ui.ts#L213-L220), [web/src/vendors/vendors.css:10-14](../../web/src/vendors/vendors.css#L10-L14)). Item cards inside fill the card's width ([web/src/vendors/vendors.css:28-29](../../web/src/vendors/vendors.css#L28-L29)).
- A weapon card shows the score, Aegis tier, element, rolled perks in the game's column order with Aegis's picks ringed green, the buying call, a god-roll mark, your best copy and the price; opening it lists the reasons, Aegis's note, every perk option per column and the weapon, roll and Aegis scores ([web/src/vendors/ui.ts:132-150](../../web/src/vendors/ui.ts#L132-L150)). Armor cards show the top stats and total, and open to the stats, build-fit and set parts of the score ([web/src/vendors/ui.ts:153-166](../../web/src/vendors/ui.ts#L153-L166)).
- **Eververse** lists *Today only* (the daily featured offers, with time left) and *This week for Bright Dust*, each offer once ([web/src/vendors/ui.ts:175-191](../../web/src/vendors/ui.ts#L175-L191)).
- The tab's count is the number of weapons worth buying, shown once stock is read ([web/src/vendors/ui.ts:87-91](../../web/src/vendors/ui.ts#L87-L91)).

Stock is read once per character per visit and kept in memory; **Refresh** reads it again ([web/src/vendors/ui.ts:37-38](../../web/src/vendors/ui.ts#L37-L38), [web/src/vendors/ui.ts:77-103](../../web/src/vendors/ui.ts#L77-L103)). The chosen view, character, filter and collapsed cards are remembered in the browser ([web/src/vendors/ui.ts:54-62](../../web/src/vendors/ui.ts#L54-L62); keys in [The report page](../reference/report-page.md#what-the-page-remembers)). If your Bungie sign-in has expired, the tab says so instead of showing stock ([web/src/vendors/ui.ts:93-94](../../web/src/vendors/ui.ts#L93-L94)).

