# The report page

One page, [report-template/site.html](../../report-template/site.html), draws the report for the local app and the web app. Opened from disk it is read-only. Served by the local app or running as the web app, its buttons work: moving, tags, locks, perks, mods and settings ([src/cli.ts:189](../../src/cli.ts#L189), [web/src/main.ts:236](../../web/src/main.ts#L236)).

## Top bar

| Control | Does | Source |
| --- | --- | --- |
| Search box | Opens the Vault tab's full list filtered by what you type, on armor when only armor matches. It takes DIM-style queries ([below](#search)). `/` focuses it and Escape clears it. It redraws once typing pauses for 120 ms. | [report-template/site.html:2296-2311](../../report-template/site.html#L2296-L2311) |
| Tabs | When they don't fit, they scroll sideways with a fade and arrow buttons at the edges; the mouse wheel scrolls them too. | [report-template/site.html:1488-1501](../../report-template/site.html#L1488-L1501) |
| **Re-rate** | Reads the vault from Bungie again and re-rates it (served page only). | [report-template/site.html:1506-1507](../../report-template/site.html#L1506-L1507) |
| Gear | Opens Settings (also reachable at `#settings`). | [report-template/site.html:1508-1509](../../report-template/site.html#L1508-L1509) |

## Tabs

In order ([report-template/site.html:1450-1451](../../report-template/site.html#L1450-L1451)):

| Tab | Shows | Source |
| --- | --- | --- |
| Overview | Top pick per slot with runners-up, "Jump in" shortcuts into the full list, best per element, strictness and focus chips that open Settings. | [report-template/site.html:1689-1719](../../report-template/site.html#L1689-L1719) |
| Reports → Weapon Report | One card per weapon type (split by ammo when at least five legendaries use the less common one) with the top three and frame and element chips; exotics per slot; S-tier weapons you don't own. **Card size**: large cards show each equipped perk with its name and a line with ammo, masterwork, Crafted / Adept and God roll; compact cards don't. The Reports menu opens on hover, click or keyboard. | [report-template/site.html:1724-1788](../../report-template/site.html#L1724-L1788), [report-template/site.html:1612-1617](../../report-template/site.html#L1612-L1617), [report-template/site.html:1456-1457](../../report-template/site.html#L1456-L1457) |
| Reports → Armor Report | Best piece per class and slot, runners-up, exotics and set cards; the class buttons list the most recently played class first. | [report-template/site.html:1789-1827](../../report-template/site.html#L1789-L1827) |
| Vault | Two modes: **Vault** and **Full list** ([below](#vault-tab)). | [report-template/site.html:2089](../../report-template/site.html#L2089) |
| Shard | Everything marked shard or review, grouped by reason, with the lock plan's **Preview changes** and **Apply**. | [report-template/site.html:2465](../../report-template/site.html#L2465), [report-template/site.html:2492](../../report-template/site.html#L2492) |
| Vendors | Web app only: what vendors sell right now, rated against your vault and marked Worth buying, Maybe or Skip, plus Eververse offers ([explanation](../explanation/vendors.md)). Its count is the number of weapons worth buying. | [report-template/site.html:1451](../../report-template/site.html#L1451), [web/src/main.ts:208-219](../../web/src/main.ts#L208-L219) |
| R&Ds | Raids and dungeons ranked for your vault, with an encounter loadout per encounter; showing one card's encounter guide opens every card on its row ([explanation](../explanation/raids-dungeons-encounters.md)). | [report-template/site.html:1830](../../report-template/site.html#L1830), [report-template/site.html:1870](../../report-template/site.html#L1870) |
| Wrapped | Account stats: characters, PvE and PvP totals, kills by weapon type, top weapons, triumph score and titles. | [report-template/site.html:2617](../../report-template/site.html#L2617), [src/vault/wrapped.ts:49](../../src/vault/wrapped.ts#L49) |
| Builds | Web app only: saved and in-game loadouts, the build editor, equip with a dry run and undo, DIM export ([explanation](../explanation/builds-tab.md)). | [web/src/main.ts:194-206](../../web/src/main.ts#L194-L206) |
| Settings | Your vault, display, custom tags, strictness, per-type presets, focus and protection, DIM ([below](#settings-panel)). | [report-template/site.html:2549](../../report-template/site.html#L2549) |

Sections on every tab fold away, and the page remembers which; tabs with three or more sections get a "Jump to" bar with **Collapse all** ([report-template/site.html:1543-1580](../../report-template/site.html#L1543-L1580)).

## Hover cards

Resting the mouse on any weapon or armor piece (not on Overview or Wrapped) shows a small card after 400 ms, or 100 ms when moving from one item to the next ([report-template/site.html:2241-2266](../../report-template/site.html#L2241-L2266)):

- **Weapons**: name, Light, element and type, verdict, Overall score with its parts, Aegis tier, and one row per perk column: options the rater wants in green, the rest in blue, the rolled one ticked; then Aegis's recommended masterwork. Exotic weapons add their trait.
- **Armor**: stats, total, highest stat, where it is, the set's 2- and 4-piece bonuses with their Aegis tiers, and an exotic's trait.
- **A set group** in the Vault's armor shows that set's 2- and 4-piece bonuses, tiers and in-game text.

The card opens under the item, above it when there's no room, and beside it when neither fits ([report-template/site.html:2271-2286](../../report-template/site.html#L2271-L2286)). It closes when you click, drag or scroll.

## Item details panel

Clicking an item opens its details ([report-template/site.html:2732-2790](../../report-template/site.html#L2732-L2790)). Three buttons in its top bar, or Settings → Display, choose where it shows; the choice is remembered:

| Mode | Behaviour |
| --- | --- |
| Sidebar (default) | Docked at the side; the page makes room so you can keep browsing, and the item you clicked is scrolled back into view. |
| Pop-up | In the middle, over a blurred page. |
| Bottom | A strip along the bottom. |

On a phone-width screen it is always a pop-up. The open item is outlined wherever it shows, and Escape closes the panel ([report-template/site.html:2746-2766](../../report-template/site.html#L2746-L2766), [report-template/site.html:2797](../../report-template/site.html#L2797)).

**A weapon** ([report-template/site.html:3145-3163](../../report-template/site.html#L3145-L3163)):

- Header: the weapon's art, name, slot and rarity, Aegis tier, type, element, Light, lock, god-roll and DIM loadout chips, and the **DIM tag** and **EVR tag** pickers ([below](#tags)).
- **Overall score** (tap or hover for its parts: the Aegis tier or wishlist rating at 60% and the roll score at 40%), Aegis tier and rank ([report-template/site.html:3033-3036](../../report-template/site.html#L3033-L3036)).
- **Verdict** and its reasons, and where to get the weapon (raid or dungeon, Bungie's source, Aegis's source) with a jump to it on the R&Ds tab ([report-template/site.html:2807-2826](../../report-template/site.html#L2807-L2826)).
- **Perks**, laid out like the game: the frame, then one column of round sockets per perk slot (equipped ringed, Aegis picks green, enhanced marked), then the masterwork and mod sockets and a key. Hover or focus a socket for its card; click one to compare it with the equipped perk and, in a served page, **Apply** it ([report-template/site.html:3002-3020](../../report-template/site.html#L3002-L3020), [report-template/site.html:3061-3093](../../report-template/site.html#L3061-L3093); [how-to](../how-to/switch-weapon-perks.md)).
- **Mods**: tapping a weapon mod socket lists every mod you own that fits it, plus the empty socket; pick one to read it and, in a served page, **Apply** it in game ([report-template/site.html:3094-3143](../../report-template/site.html#L3094-L3143); [how-to](../how-to/switch-weapon-perks.md#switch-a-weapon-mod)).
- **Stats** in the game's order: bars for 0-100 stats, numbers for rate of fire, times and sizes, and a recoil dial drawn as DIM draws it. The masterworked stat is marked. Stats Bungie doesn't send for your copy show the weapon's base value, faded ([report-template/site.html:2975-3000](../../report-template/site.html#L2975-L3000)).
- **Actions**: move it ([how-to](../how-to/move-and-equip-items.md)), DIM notes and the DIM loadouts it is in ([report-template/site.html:2869-2909](../../report-template/site.html#L2869-L2909)).
- Details, your other copies, and an **Explanation** of the score at the bottom.

**An armor piece** ([report-template/site.html:3164-3182](../../report-template/site.html#L3164-L3182)): armor score, stat total and gear tier; verdict; stats with the four score parts; an exotic's trait under the stats; the set's bonuses (the in-game text first, Aegis's notes in a dropdown); actions; other pieces of the same class, slot and archetype.

## Tags

An item shows its **EVR tag** if it has one, otherwise its **DIM tag** ([report-template/site.html:1634-1684](../../report-template/site.html#L1634-L1684)).

- **DIM tags** (Favorite, Keep, Infuse, Junk, Archive) come from DIM Sync. In a served page, the DIM tag picker in the details header saves straight to DIM ([report-template/site.html:2910-2915](../../report-template/site.html#L2910-L2915), [report-template/site.html:2940-2958](../../report-template/site.html#L2940-L2958)).
- **EVR tags** are kept in this browser only, so they work on the hosted site too and never touch DIM. The picker offers DIM's five plus four **custom tags** whose names and colours you set in Settings ([report-template/site.html:1647-1651](../../report-template/site.html#L1647-L1651), [report-template/site.html:2916-2928](../../report-template/site.html#L2916-L2928)).
- **Shortcuts**: Alt+1 to Alt+9 set an EVR tag on the item under the mouse, or the one open in the details panel (1-5 are DIM's tags, 6-9 the custom ones); pressing the same number again or Alt+0 clears it ([report-template/site.html:2929-2939](../../report-template/site.html#L2929-L2939)).

## Search

The top bar and the full list take DIM-style queries ([report-template/site.html:1996-2066](../../report-template/site.html#L1996-L2066)):

| Query | Matches |
| --- | --- |
| `fatebringer`, `"hand cannon"` | Any of the item's text (name, type, perks and so on); quotes keep spaces |
| `name:`, `exactname:` | The name contains, or is exactly, the text |
| `perk:`, `exactperk:` | Any perk option contains, or is exactly, the text |
| `tag:favorite`, `tag:none` | The DIM or EVR tag (custom tags by name); `none` or `untagged` for no tag |
| `is:<word>` | The item's type, element, slot, ammo, rarity or class, or `weapon`, `armor`, `locked`, `unlocked`, `crafted`, `adept`, `god`, `trash`, `dupe`, `maxpower`, `equipped`, `inloadout`, `masterwork`, `legacy` |
| `-term` | Not this |
| `a b`, `a and b`, `a or b`, `( )` | Both (juxtaposition is "and"), either, grouping; "and" binds tighter than "or" |

Common short forms work: `smg`, `hc`, `gauntlets`, `godroll`, `favourite` ([report-template/site.html:2001](../../report-template/site.html#L2001)). A query without any of these reads as plain text, like the old search.

## Vault tab

The tab has two modes, switched at the top; the choice is remembered ([report-template/site.html:2087-2096](../../report-template/site.html#L2087-L2096)).

### Vault mode

A DIM-style layout in three collapsible sections, each with a full-width heading ([report-template/site.html:2156-2179](../../report-template/site.html#L2156-L2179)):

- **Postmaster** (closed by default): each character's Lost Items, rated like other gear. Drag one out to pull it from the postmaster and move it in one go ([report-template/site.html:2164-2168](../../report-template/site.html#L2164-L2168), [src/bungie/transfer.ts:70-78](../../src/bungie/transfer.ts#L70-L78)).
- **Weapons**: one column per character, most recently played first, then the vault; rows are Kinetic, Energy and Power. Each character cell has the equipped weapon as a big tile (the drop target for equipping) and the rest in a 3 × 3 grid. **Split the vault by type** in the heading (on by default) gives each weapon type its own box ([report-template/site.html:2206-2211](../../report-template/site.html#L2206-L2211)).
- **Armor**: laid out like the weapons, slot by slot, with each character's worn piece big; the vault is grouped by set (exotics first, then sets by name, then no set), each group led by its piece count and its 2- and 4-piece Aegis grades, and ordered by class, gear tier and archetype. **Split armor by character** shows one collapsible block per character with only its class's vault armor ([report-template/site.html:2180-2205](../../report-template/site.html#L2180-L2205)).

Tiles show the element as a glow along the top edge, the gear tier as small diamonds down the left (icy at Tier 5), the Aegis grade or, on armor, the highest stat's symbol as a corner badge, and the class as the armor's border colour ([report-template/site.html:2149-2155](../../report-template/site.html#L2149-L2155)).

The weapons use the full list's search, filters and sort. Weapons that don't match are hidden, or kept in place and dimmed with **Dim filtered** on; equipped weapons always show ([report-template/site.html:2101](../../report-template/site.html#L2101), [report-template/site.html:2160-2162](../../report-template/site.html#L2160-L2162)).

In a served page, drag a weapon or armor piece onto a character or the vault to move it, or onto the big slot to equip it. Armor only drops on a character of its class. A corner message reports the result ([report-template/site.html:2212-2240](../../report-template/site.html#L2212-L2240); [how-to](../how-to/move-and-equip-items.md)).

### Full list mode

Every weapon or armor piece as rows or tiles, with quick views, search, filters, sort, direction, grouping (two levels) and a "Show best N" cap ([report-template/site.html:2314](../../report-template/site.html#L2314)).

### Toolbar

The search, filter and sort toolbar stays pinned under the top bar. Its size buttons choose **Full** (labelled bands), **2 lines** (the default) or **1 line** ([report-template/site.html:2069-2070](../../report-template/site.html#L2069-L2070)). **Reset** clears search, filters, sort and grouping.

### Refresh and New badges (web app)

The web app's Vault tab has a **Refresh** button that reads the vault again in place. It also refreshes by itself about every 3 minutes while the tab is open, and when you come back to the page, but not in the middle of a drag or move ([report-template/site.html:2117-2146](../../report-template/site.html#L2117-L2146)). Items this browser hadn't seen on an earlier read get a **New** badge until you open them ([report-template/site.html:1324-1337](../../report-template/site.html#L1324-L1337)).

## Perks on cards and lists

- Equipped perks show in the game's column order: barrel, magazine, the two traits, then the origin trait ([report-template/site.html:1604-1609](../../report-template/site.html#L1604-L1609)).
- As symbols by default, each in a round socket with its name on hover, Aegis's picks ringed green. Settings → Display switches to names, which show only the two traits ([report-template/site.html:1595-1602](../../report-template/site.html#L1595-L1602)).

Icons and descriptions come from the manifest's plug definitions ([src/report/siteData.ts:121-135](../../src/report/siteData.ts#L121-L135)).

## Settings panel

Opened with the gear or `#settings`, in a served page only ([report-template/site.html:2549](../../report-template/site.html#L2549)):

| Section | Holds | Source |
| --- | --- | --- |
| Your vault | When the vault was rated. In the web app also the sign-in status and **Sign out**. | [report-template/site.html:2556-2558](../../report-template/site.html#L2556-L2558), [web/src/main.ts:221-233](../../web/src/main.ts#L221-L233) |
| Display | Perks as symbols or names; the **colour theme** (Blue & Green, Purple & Orange, Blue & Purple, Pink & Purple, each with a gradient swatch); where item details open. Applies at once; nothing is re-rated. | [report-template/site.html:2559-2567](../../report-template/site.html#L2559-L2567), [report-template/site.html:61-64](../../report-template/site.html#L61-L64) |
| Custom tags | Names and colours of the four custom EVR tags. | [report-template/site.html:2568-2569](../../report-template/site.html#L2568-L2569) |
| Strictness | The preset and its main values. | [report-template/site.html:2570-2574](../../report-template/site.html#L2570-L2574) |
| Per weapon type | A preset per weapon type. | [report-template/site.html:2575-2576](../../report-template/site.html#L2575-L2576) |
| Focus and protection | Focus (PvE, PvP, both) and the protect list, one name per line. | [report-template/site.html:2577-2579](../../report-template/site.html#L2577-L2579) |
| DIM | Read DIM tags, read DIM loadouts, protect Favorite/Keep. | [report-template/site.html:2580-2584](../../report-template/site.html#L2580-L2584) |

**Save and re-rate** saves strictness, per-type presets, focus, protection and DIM, then rates the vault again ([report-template/site.html:2601-2613](../../report-template/site.html#L2601-L2613)). What each value does: [Settings](settings.md). In the web app, once Bungie access really runs out, a banner asks you to sign in again ([web/src/main.ts:228-231](../../web/src/main.ts#L228-L231)).

The theme also colours the web app's background clouds and star dust and the Builds tab, and is applied before the page draws so it never flashes ([report-template/site.html:12](../../report-template/site.html#L12), [web/src/background.html](../../web/src/background.html)).

## What the page remembers

All in this browser's `localStorage` ([report-template/site.html:1321](../../report-template/site.html#L1321)):

| Key | Remembers |
| --- | --- |
| `vr-tab`, `vr-last-tab` | The open tab, and the last tab before Settings |
| `vr-listmode` | Vault tab mode: `vault` or `list` |
| `vr-vsplit`, `vr-asplit`, `vr-vdim` | Vault mode: split the vault by weapon type, split armor by character, dim filtered weapons (`on` / `off`) |
| `vr-dense` | Toolbar size: `full`, `l2` or `l1` |
| `vr-layout` | Full list as `rows` or `tiles` |
| `vr-perks` | Perks as `symbols` or `names` |
| `vr-cards` | Weapon Report cards `big` or `small` |
| `vr-class` | Armor Report class |
| `vr-fold` | Folded sections |
| `vr-seen`, `vr-new` | Item ids already seen, and the ones still marked New |
| `vr-dmode` | Where item details open: `dock`, `modal` or `bottom` (an older `vr-place` of `bottom` is read once) ([report-template/site.html:2742-2743](../../report-template/site.html#L2742-L2743)) |
| `vr-theme` | Colour theme |
| `vr-evrtags`, `vr-customtags` | EVR tags by item id; custom tag names and colours |
| `vr-bd-popmode` | Builds tab: slot popovers open on `hover` (the default) or `click` ([web/src/builds/ui.ts:688-695](../../web/src/builds/ui.ts#L688-L695)) |
| `vr-vendors-kind`, `vr-vendors-char`, `vr-vendors-buy`, `vr-vendors-closed` | Vendors tab: Weapons / Armor / Eververse, the character, Only worth buying, collapsed vendor cards ([web/src/vendors/ui.ts:59-67](../../web/src/vendors/ui.ts#L59-L67)) |

EVR tags exist only in the browser that set them; clearing site data removes them.

## Background (web app)

The web app draws a slow animated nebula behind the report, animating only transform and opacity so the GPU does the work, in the colours of the chosen theme. It stops for people who ask their system for reduced motion ([web/src/background.html:1-4](../../web/src/background.html#L1-L4), [web/src/background.html:58](../../web/src/background.html#L58)). The web build injects it before the sign-in shell ([web/vite.config.ts:45-49](../../web/vite.config.ts#L45-L49)); the local report doesn't have it.

## Loading (web app)

While the item database, sources and vault load, the sign-in shell shows a progress block; the Builds and Vendors tabs show one as soon as they are opened, while their code and data load, and the Vendors block offers a retry if reading stock fails ([web/src/loading.ts:1-7](../../web/src/loading.ts#L1-L7), [web/src/main.ts:194-219](../../web/src/main.ts#L194-L219)).
