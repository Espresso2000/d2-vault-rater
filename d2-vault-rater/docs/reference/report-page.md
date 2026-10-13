# The report page

One page, [report-template/site.html](../../report-template/site.html), draws the report for the local app and the web app. Opened from disk it is read-only; served by the local app or running as the web app, its buttons work (moving, tags, locks, settings) ([src/cli.ts:167](../../src/cli.ts#L167), [web/src/main.ts:211](../../web/src/main.ts#L211)).

## Top bar

| Control | Does | Source |
| --- | --- | --- |
| Search box | Typing opens the Vault tab's full list filtered by the text, on armor when only armor matches. `/` focuses it; Escape clears it. | [report-template/site.html:1743-1755](../../report-template/site.html#L1743-L1755) |
| **Re-rate** | Reads the vault from Bungie again and re-rates it (served page only). | [report-template/site.html:1163-1164](../../report-template/site.html#L1163-L1164) |
| Gear | Opens Settings (also reachable at `#settings`). | [report-template/site.html:1165-1166](../../report-template/site.html#L1165-L1166) |

## Tabs

In order ([report-template/site.html:1125-1126](../../report-template/site.html#L1125-L1126)):

| Tab | Shows | Source |
| --- | --- | --- |
| Overview | Keep and shard counts, the Aegis tier bar, best picks per slot, strictness and focus chips that open Settings. | [report-template/site.html:1310](../../report-template/site.html#L1310) |
| Reports → Weapon Report | Weapons by type, with best picks; Large / Compact cards. A menu that opens on hover, click or keyboard holds this and Armor Report ([report-template/site.html:1130-1131](../../report-template/site.html#L1130-L1131)). | [report-template/site.html:1345](../../report-template/site.html#L1345) |
| Reports → Armor Report | Best piece per class and slot, set cards; the class buttons list the most recently played class first. | [report-template/site.html:1417](../../report-template/site.html#L1417) |
| Shard | Everything marked shard or review, grouped by reason; **Preview changes** and **Apply** for the lock plan. | [report-template/site.html:1907](../../report-template/site.html#L1907) |
| Vault | Two modes: **Vault** and **Full list** ([below](#vault-tab)). | [report-template/site.html:1617](../../report-template/site.html#L1617) |
| R&Ds | Raids and dungeons ranked for your vault, with an encounter loadout for each encounter ([explanation](../explanation/raids-dungeons-encounters.md)). | [report-template/site.html:1452](../../report-template/site.html#L1452) |
| Wrapped | Account stats: characters, PvE and PvP totals, kills by weapon type, top weapons, triumph score and titles. | [report-template/site.html:2040](../../report-template/site.html#L2040), [src/vault/wrapped.ts:49](../../src/vault/wrapped.ts#L49) |
| Builds | Web app only: make, rate and equip builds. This tab is being reworked; see [The Builds tab](../explanation/builds-tab.md). | [web/src/main.ts:179-183](../../web/src/main.ts#L179-L183) |
| Settings | Strictness, focus, protect list, per-type settings, DIM switches, display options ([settings reference](settings.md)). | [report-template/site.html:1991](../../report-template/site.html#L1991) |

## Vault tab

The tab has two modes, switched at the top; the choice is remembered ([report-template/site.html:1615-1633](../../report-template/site.html#L1615-L1633)).

### Vault mode

A DIM-style layout of your weapons ([report-template/site.html:1666-1682](../../report-template/site.html#L1666-L1682)):

- One column per character, ordered by when you last played them, then the vault. Rows are the Kinetic, Energy and Power slots.
- Each character cell has the equipped weapon as a big tile (the drop target for equipping) and the rest of that slot in a 3 × 3 grid, as in the game.
- **Split the vault by weapon type** (on by default) gives each weapon type its own labelled box in the vault column; untick it for one box per slot ([report-template/site.html:1624-1632](../../report-template/site.html#L1624-L1632), [report-template/site.html:1700-1706](../../report-template/site.html#L1700-L1706)).
- It uses the full list's weapon search, filters and sort. Weapons that don't match are dimmed rather than hidden when equipped ([report-template/site.html:1633-1634](../../report-template/site.html#L1633-L1634), [report-template/site.html:1670-1671](../../report-template/site.html#L1670-L1671)).
- In a served page, drag a weapon onto a character or the vault to move it, or onto the big slot to equip it; a corner message reports the result ([report-template/site.html:1708-1742](../../report-template/site.html#L1708-L1742)). See [Move and equip items](../how-to/move-and-equip-items.md).
- Below the weapons, an **Armor** section shows every armor piece by slot, then by set (exotics first), ordered by class, gear tier and archetype, with the border coloured by class ([report-template/site.html:1684-1698](../../report-template/site.html#L1684-L1698)).

### Full list mode

Every weapon or armor piece as rows or tiles, with quick views, search, filters, sort, direction, grouping (two levels) and a "Show best N" cap ([report-template/site.html:1758](../../report-template/site.html#L1758)).

### Toolbar

The search, filter and sort toolbar stays pinned under the top bar while you scroll. Its size buttons choose **Full** (labelled bands), **2 lines** (search, then one sideways-scrolling line of filters, sort and the count; the default) or **1 line** ([report-template/site.html:1597-1598](../../report-template/site.html#L1597-L1598), [report-template/site.html:1793](../../report-template/site.html#L1793)). **Reset** clears search, filters, sort and grouping.

### Refresh and New badges (web app)

The web app's Vault tab has a **Refresh** button that reads the vault again in place. It also refreshes by itself about every 3 minutes while the tab is open, and when you come back to the page, but not in the middle of a drag or move ([report-template/site.html:1636-1665](../../report-template/site.html#L1636-L1665)). Items this browser hadn't seen on an earlier read get a **New** badge until you open them ([report-template/site.html:1005-1016](../../report-template/site.html#L1005-L1016)).

## Perks

- **On cards and rows**, the perks equipped on each gun show in the game's column order: barrel, magazine, the two traits, then the origin trait ([report-template/site.html:1261-1266](../../report-template/site.html#L1261-L1266)).
- **As symbols** by default: each perk's icon in a round socket, its name on hover, with a green ring on perks Aegis recommends ([report-template/site.html:290-304](../../report-template/site.html#L290-L304), [report-template/site.html:1247-1253](../../report-template/site.html#L1247-L1253)). Settings → Display switches to names, which show only the two traits because names are wide.
- **In the weapon drawer**, every perk column lists all its options, with the equipped one lit, and shows the selected perk's symbol, name and description ([report-template/site.html:1254-1260](../../report-template/site.html#L1254-L1260)). Icons and descriptions come from the manifest's plug definitions ([src/report/siteData.ts:106-112](../../src/report/siteData.ts#L106-L112)).

## What the page remembers

Display choices are kept in this browser's `localStorage` ([report-template/site.html:1002](../../report-template/site.html#L1002)):

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
