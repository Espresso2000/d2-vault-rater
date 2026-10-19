# The report page

One page, [report-template/site.html](../../report-template/site.html), draws the report for the local app and the web app. Opened from disk it is read-only; served by the local app or running as the web app, its buttons work (moving, tags, locks, settings) ([src/cli.ts:189](../../src/cli.ts#L189), [web/src/main.ts:236](../../web/src/main.ts#L236)).

## Top bar

| Control | Does | Source |
| --- | --- | --- |
| Search box | Typing opens the Vault tab's full list filtered by the text, on armor when only armor matches. `/` focuses it; Escape clears it. It redraws once typing pauses for 120 ms, like the full list's own search ([report-template/site.html:2296-2298](../../report-template/site.html#L2296-L2298)). | [report-template/site.html:2299-2311](../../report-template/site.html#L2299-L2311) |
| **Re-rate** | Reads the vault from Bungie again and re-rates it (served page only). | [report-template/site.html:1506-1507](../../report-template/site.html#L1506-L1507) |
| Gear | Opens Settings (also reachable at `#settings`). | [report-template/site.html:1508-1509](../../report-template/site.html#L1508-L1509) |

## Tabs

In order ([report-template/site.html:1147-1148](../../report-template/site.html#L1147-L1148)):

| Tab | Shows | Source |
| --- | --- | --- |
| Overview | Keep and shard counts, the Aegis tier bar, best picks per slot, strictness and focus chips that open Settings. | [report-template/site.html:1689](../../report-template/site.html#L1689) |
| Reports → Weapon Report | Weapons by type, with best picks. **Card size** switches between large cards, which show each equipped perk as its symbol with its name (recommended ones green, the description on hover) and a line with ammo, masterwork, Crafted / Adept and God roll ([report-template/site.html:1611-1617](../../report-template/site.html#L1611-L1617)), and compact ones. A menu that opens on hover, click or keyboard holds this and Armor Report ([report-template/site.html:1456-1457](../../report-template/site.html#L1456-L1457)). | [report-template/site.html:1724](../../report-template/site.html#L1724) |
| Reports → Armor Report | Best piece per class and slot, set cards; the class buttons list the most recently played class first. | [report-template/site.html:1796](../../report-template/site.html#L1796) |
| Shard | Everything marked shard or review, grouped by reason; **Preview changes** and **Apply** for the lock plan. | [report-template/site.html:2465](../../report-template/site.html#L2465) |
| Vault | Two modes: **Vault** and **Full list** ([below](#vault-tab)). | [report-template/site.html:2089](../../report-template/site.html#L2089) |
| Vendors | Web app only: what vendors sell right now, rated against your vault and marked Worth buying, Maybe or Skip; Eververse offers with price and time left. One collapsible card per vendor, laid out side by side, up to four items wide ([explanation](../explanation/vendors.md#what-the-tab-shows)). Its count is the number of weapons worth buying. | [report-template/site.html:1148](../../report-template/site.html#L1148), [web/src/main.ts:200-204](../../web/src/main.ts#L200-L204) |
| R&Ds | Raids and dungeons ranked for your vault, with an encounter loadout for each encounter ([explanation](../explanation/raids-dungeons-encounters.md)). | [report-template/site.html:1830](../../report-template/site.html#L1830) |
| Wrapped | Account stats: characters, PvE and PvP totals, kills by weapon type, top weapons, triumph score and titles. | [report-template/site.html:2617](../../report-template/site.html#L2617), [src/vault/wrapped.ts:49](../../src/vault/wrapped.ts#L49) |
| Builds | Web app only: saved builds per class, a subclass and abilities editor with slot popovers, one picker for gear and mods, stats with aims, a build rating, equip with a dry run and undo, and DIM export; see [The Builds tab](../explanation/builds-tab.md). | [web/src/main.ts:194-198](../../web/src/main.ts#L194-L198) |
| Settings | Strictness, focus, protect list, per-type settings, DIM switches, display options ([settings reference](settings.md)). | [report-template/site.html:2549](../../report-template/site.html#L2549) |

## Vault tab

The tab has two modes, switched at the top; the choice is remembered ([report-template/site.html:1651-1669](../../report-template/site.html#L1651-L1669)).

### Vault mode

A DIM-style layout of your weapons ([report-template/site.html:1703-1719](../../report-template/site.html#L1703-L1719)):

- One column per character, ordered by when you last played them, then the vault. Rows are the Kinetic, Energy and Power slots.
- Each character cell has the equipped weapon as a big tile (the drop target for equipping) and the rest of that slot in a 3 × 3 grid, as in the game.
- **Split the vault by weapon type** (on by default) gives each weapon type its own labelled box in the vault column; untick it for one box per slot ([report-template/site.html:1660-1668](../../report-template/site.html#L1660-L1668), [report-template/site.html:2205-2210](../../report-template/site.html#L2205-L2210)).
- It uses the full list's weapon search, filters and sort. Weapons that don't match are dimmed rather than hidden when equipped ([report-template/site.html:2114-2115](../../report-template/site.html#L2114-L2115), [report-template/site.html:2160-2161](../../report-template/site.html#L2160-L2161)).
- In a served page, drag a weapon onto a character or the vault to move it, or onto the big slot to equip it; a corner message reports the result ([report-template/site.html:1748-1782](../../report-template/site.html#L1748-L1782)). See [Move and equip items](../how-to/move-and-equip-items.md).
- Below the weapons, an **Armor** section starts with an **Equipped** row: one column per character with its five equipped armor pieces as big tiles, and **Empty** for an unequipped slot. Below that it shows every armor piece by slot, then by set (exotics first), ordered by class, gear tier and archetype, with the border coloured by class. Armor can't be dragged; move it from its drawer ([report-template/site.html:1718](../../report-template/site.html#L1718), [report-template/site.html:1722-1740](../../report-template/site.html#L1722-L1740)).

### Full list mode

Every weapon or armor piece as rows or tiles, with quick views, search, filters, sort, direction, grouping (two levels) and a "Show best N" cap ([report-template/site.html:2314](../../report-template/site.html#L2314)).

### Toolbar

The search, filter and sort toolbar stays pinned under the top bar while you scroll. Its size buttons choose **Full** (labelled bands), **2 lines** (search, then one sideways-scrolling line of filters, sort and the count; the default) or **1 line** ([report-template/site.html:2069-2070](../../report-template/site.html#L2069-L2070), [report-template/site.html:2349](../../report-template/site.html#L2349)). **Reset** clears search, filters, sort and grouping.

### Refresh and New badges (web app)

The web app's Vault tab has a **Refresh** button that reads the vault again in place. It also refreshes by itself about every 3 minutes while the tab is open, and when you come back to the page, but not in the middle of a drag or move ([report-template/site.html:2117-2147](../../report-template/site.html#L2117-L2147)). Items this browser hadn't seen on an earlier read get a **New** badge until you open them ([report-template/site.html:1324-1337](../../report-template/site.html#L1324-L1337)).

## Perks

- **On cards and rows**, the perks equipped on each gun show in the game's column order: barrel, magazine, the two traits, then the origin trait ([report-template/site.html:1604-1609](../../report-template/site.html#L1604-L1609)).
- **As symbols** by default: each perk's icon in a round socket, its name on hover, with a green ring on perks Aegis recommends ([report-template/site.html:291-305](../../report-template/site.html#L291-L305), [report-template/site.html:1595-1601](../../report-template/site.html#L1595-L1601)). Settings → Display switches to names, which show only the two traits because names are wide.
- **In the weapon drawer**, every perk column lists all its options, with the equipped one lit, and shows the selected perk's symbol, name and description. Clicking another option previews it (dashed gold ring), and in a served page **Apply** switches the weapon to it in game: see [Preview and switch a weapon's perks](../how-to/switch-weapon-perks.md) ([report-template/site.html:1283-1288](../../report-template/site.html#L1283-L1288)). Icons and descriptions come from the manifest's plug definitions ([src/report/siteData.ts:108-116](../../src/report/siteData.ts#L108-L116)).

## Settings panel

Opened with the gear or `#settings`, in a served page only ([report-template/site.html:2549](../../report-template/site.html#L2549)). Its sections, in order:

| Section | Holds | Source |
| --- | --- | --- |
| Your vault | When the vault was rated. In the web app also the Bungie sign-in status (renewed by itself with a Confidential app, or minutes left with a Public one) and **Sign out**. | [report-template/site.html:2556-2558](../../report-template/site.html#L2556-L2558), [web/src/main.ts:221-233](../../web/src/main.ts#L221-L233) |
| Display | Perks as symbols or names; applies at once, nothing is re-rated. | [report-template/site.html:2043-2045](../../report-template/site.html#L2043-L2045) |
| Strictness | The preset and its main values. | [report-template/site.html:2570](../../report-template/site.html#L2570) |
| Per weapon type | A preset per weapon type. | [report-template/site.html:2575](../../report-template/site.html#L2575) |
| Focus and protection | Focus (PvE, PvP, both) and the protect list, one name per line. | [report-template/site.html:2577](../../report-template/site.html#L2577) |
| DIM | Read DIM tags, read DIM loadouts, protect Favorite/Keep. | [report-template/site.html:2580](../../report-template/site.html#L2580) |

**Save and re-rate** saves everything but Display and rates the vault again ([report-template/site.html:2585](../../report-template/site.html#L2585)). What each value does: [Settings](settings.md). In the web app, once Bungie access really runs out, a banner asks you to sign in again ([web/src/main.ts:228-231](../../web/src/main.ts#L228-L231)).

## What the page remembers

Display choices are kept in this browser's `localStorage` ([report-template/site.html:1321](../../report-template/site.html#L1321)):

| Key | Remembers |
| --- | --- |
| `vr-tab`, `vr-last-tab` | The open tab, and the last tab before Settings |
| `vr-listmode` | Vault tab mode: `vault` or `list` |
| `vr-vsplit` | Split the vault by weapon type (`on` / `off`) |
| `vr-dense` | Toolbar size: `full`, `l2` or `l1` |
| `vr-layout` | Full list as `rows` or `tiles` |
| `vr-perks` | Perks as `symbols` or `names` |
| `vr-cards` | Weapon Report cards `big` or `small` |
| `vr-class` | Armor Report class |
| `vr-fold` | Folded sections |
| `vr-seen`, `vr-new` | Item ids already seen, and the ones still marked New |
| `vr-bd-popmode` | Builds tab: whether slot popovers open on `hover` (the default) or only on `click` ([web/src/builds/ui.ts:688-695](../../web/src/builds/ui.ts#L688-L695), [web/src/builds/ui.ts:1446-1453](../../web/src/builds/ui.ts#L1446-L1453)) |
| `vr-vendors-kind`, `vr-vendors-char`, `vr-vendors-buy`, `vr-vendors-closed` | Vendors tab: Weapons / Armor / Eververse, the character, Only worth buying, and collapsed vendor cards ([web/src/vendors/ui.ts:59-67](../../web/src/vendors/ui.ts#L59-L67)) |

## Background (web app)

The web app draws a slow animated nebula behind the report: sparse green clouds, star dust and soft glows on the report's navy, animating only transform and opacity so the GPU does the work. It stops for people who ask their system for reduced motion ([web/src/background.html:1-4](../../web/src/background.html#L1-L4), [web/src/background.html:58](../../web/src/background.html#L58)). The web build injects it before the sign-in shell ([web/vite.config.ts:45-49](../../web/vite.config.ts#L45-L49)); the local report doesn't have it.
