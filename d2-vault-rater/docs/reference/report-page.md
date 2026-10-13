# The report page

One page, [report-template/site.html](../../report-template/site.html), draws the report for the local app and the web app. Opened from disk it is read-only; served by the local app or running as the web app, its buttons work (moving, tags, locks, settings) ([src/cli.ts:178](../../src/cli.ts#L178), [web/src/main.ts:219](../../web/src/main.ts#L219)).

## Top bar

| Control | Does | Source |
| --- | --- | --- |
| Search box | Typing opens the Vault tab's full list filtered by the text, on armor when only armor matches. `/` focuses it; Escape clears it. | [report-template/site.html:1764-1776](../../report-template/site.html#L1764-L1776) |
| **Re-rate** | Reads the vault from Bungie again and re-rates it (served page only). | [report-template/site.html:1177-1178](../../report-template/site.html#L1177-L1178) |
| Gear | Opens Settings (also reachable at `#settings`). | [report-template/site.html:1179-1180](../../report-template/site.html#L1179-L1180) |

## Tabs

In order ([report-template/site.html:1138-1139](../../report-template/site.html#L1138-L1139)):

| Tab | Shows | Source |
| --- | --- | --- |
| Overview | Keep and shard counts, the Aegis tier bar, best picks per slot, strictness and focus chips that open Settings. | [report-template/site.html:1331](../../report-template/site.html#L1331) |
| Reports → Weapon Report | Weapons by type, with best picks; Large / Compact cards. A menu that opens on hover, click or keyboard holds this and Armor Report ([report-template/site.html:1144-1145](../../report-template/site.html#L1144-L1145)). | [report-template/site.html:1366](../../report-template/site.html#L1366) |
| Reports → Armor Report | Best piece per class and slot, set cards; the class buttons list the most recently played class first. | [report-template/site.html:1438](../../report-template/site.html#L1438) |
| Shard | Everything marked shard or review, grouped by reason; **Preview changes** and **Apply** for the lock plan. | [report-template/site.html:1928](../../report-template/site.html#L1928) |
| Vault | Two modes: **Vault** and **Full list** ([below](#vault-tab)). | [report-template/site.html:1638](../../report-template/site.html#L1638) |
| R&Ds | Raids and dungeons ranked for your vault, with an encounter loadout for each encounter ([explanation](../explanation/raids-dungeons-encounters.md)). | [report-template/site.html:1473](../../report-template/site.html#L1473) |
| Wrapped | Account stats: characters, PvE and PvP totals, kills by weapon type, top weapons, triumph score and titles. | [report-template/site.html:2061](../../report-template/site.html#L2061), [src/vault/wrapped.ts:49](../../src/vault/wrapped.ts#L49) |
| Builds | Web app only: make, rate and equip builds. This tab is being reworked; see [The Builds tab](../explanation/builds-tab.md). | [web/src/main.ts:192-196](../../web/src/main.ts#L192-L196) |
| Settings | Strictness, focus, protect list, per-type settings, DIM switches, display options ([settings reference](settings.md)). | [report-template/site.html:2012](../../report-template/site.html#L2012) |

## Vault tab

The tab has two modes, switched at the top; the choice is remembered ([report-template/site.html:1636-1654](../../report-template/site.html#L1636-L1654)).

### Vault mode

A DIM-style layout of your weapons ([report-template/site.html:1687-1703](../../report-template/site.html#L1687-L1703)):

- One column per character, ordered by when you last played them, then the vault. Rows are the Kinetic, Energy and Power slots.
- Each character cell has the equipped weapon as a big tile (the drop target for equipping) and the rest of that slot in a 3 × 3 grid, as in the game.
- **Split the vault by weapon type** (on by default) gives each weapon type its own labelled box in the vault column; untick it for one box per slot ([report-template/site.html:1645-1653](../../report-template/site.html#L1645-L1653), [report-template/site.html:1721-1727](../../report-template/site.html#L1721-L1727)).
- It uses the full list's weapon search, filters and sort. Weapons that don't match are dimmed rather than hidden when equipped ([report-template/site.html:1654-1655](../../report-template/site.html#L1654-L1655), [report-template/site.html:1691-1692](../../report-template/site.html#L1691-L1692)).
- In a served page, drag a weapon onto a character or the vault to move it, or onto the big slot to equip it; a corner message reports the result ([report-template/site.html:1729-1763](../../report-template/site.html#L1729-L1763)). See [Move and equip items](../how-to/move-and-equip-items.md).
- Below the weapons, an **Armor** section shows every armor piece by slot, then by set (exotics first), ordered by class, gear tier and archetype, with the border coloured by class ([report-template/site.html:1705-1719](../../report-template/site.html#L1705-L1719)).

### Full list mode

Every weapon or armor piece as rows or tiles, with quick views, search, filters, sort, direction, grouping (two levels) and a "Show best N" cap ([report-template/site.html:1779](../../report-template/site.html#L1779)).

### Toolbar

The search, filter and sort toolbar stays pinned under the top bar while you scroll. Its size buttons choose **Full** (labelled bands), **2 lines** (search, then one sideways-scrolling line of filters, sort and the count; the default) or **1 line** ([report-template/site.html:1618-1619](../../report-template/site.html#L1618-L1619), [report-template/site.html:1814](../../report-template/site.html#L1814)). **Reset** clears search, filters, sort and grouping.

### Refresh and New badges (web app)

The web app's Vault tab has a **Refresh** button that reads the vault again in place. It also refreshes by itself about every 3 minutes while the tab is open, and when you come back to the page, but not in the middle of a drag or move ([report-template/site.html:1657-1686](../../report-template/site.html#L1657-L1686)). Items this browser hadn't seen on an earlier read get a **New** badge until you open them ([report-template/site.html:1017-1028](../../report-template/site.html#L1017-L1028)).

## Perks

- **On cards and rows**, the perks equipped on each gun show in the game's column order: barrel, magazine, the two traits, then the origin trait ([report-template/site.html:1275-1280](../../report-template/site.html#L1275-L1280)).
- **As symbols** by default: each perk's icon in a round socket, its name on hover, with a green ring on perks Aegis recommends ([report-template/site.html:290-304](../../report-template/site.html#L290-L304), [report-template/site.html:1261-1267](../../report-template/site.html#L1261-L1267)). Settings → Display switches to names, which show only the two traits because names are wide.
- **In the weapon drawer**, every perk column lists all its options, with the equipped one lit, and shows the selected perk's symbol, name and description ([report-template/site.html:1269-1274](../../report-template/site.html#L1269-L1274)). Icons and descriptions come from the manifest's plug definitions ([src/report/siteData.ts:106-112](../../src/report/siteData.ts#L106-L112)).

## What the page remembers

Display choices are kept in this browser's `localStorage` ([report-template/site.html:1014](../../report-template/site.html#L1014)):

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
