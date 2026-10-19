# The Builds tab

The web app's Builds tab lets you put together a subclass, three weapons, five armor pieces, their mods and stat targets; see how the community rates it; then equip it on a character or send it to DIM. Builds are saved in the browser ([web/src/builds/store.ts:5-8](../../web/src/builds/store.ts#L5-L8)). It is web-only and is loaded as a separate chunk ([web/src/main.ts:194-198](../../web/src/main.ts#L194-L198)).

## The parts

| Module | Role |
| --- | --- |
| [web/src/builds/defs.strip.ts](../../web/src/builds/defs.strip.ts) | Cuts the manifest down to subclasses, their socket plugs (supers, abilities, aspects, fragments) and armor mods ([web/src/builds/defs.strip.ts:78](../../web/src/builds/defs.strip.ts#L78)). |
| [web/src/builds/defs.ts](../../web/src/builds/defs.ts) | Loads those definitions like the item database: IndexedDB, then a shipped snapshot, then a worker ([web/src/builds/defs.ts:10-23](../../web/src/builds/defs.ts#L10-L23)). |
| [web/src/builds/sheets.ts](../../web/src/builds/sheets.ts) | Parses Aegis's Aspects, Fragments and Subclasses tabs and the Data Compendium's descriptions ([web/src/builds/sheets.ts:61](../../web/src/builds/sheets.ts#L61), [web/src/builds/sheets.ts:105](../../web/src/builds/sheets.ts#L105), [web/src/builds/sheets.ts:149](../../web/src/builds/sheets.ts#L149)). |
| [web/src/builds/ratings.ts](../../web/src/builds/ratings.ts) | Downloads those sheets once a day and keeps yesterday's copy if a refresh fails ([web/src/builds/ratings.ts:15-38](../../web/src/builds/ratings.ts#L15-L38)). |
| [web/src/builds/model.ts](../../web/src/builds/model.ts) | The build itself and everything computed from it; no network or DOM. |
| [web/src/builds/profile.ts](../../web/src/builds/profile.ts) | Reads what equipping needs beyond the vault: subclasses, unlocked plugs, socket contents and in-game loadout slots ([web/src/builds/profile.ts:45](../../web/src/builds/profile.ts#L45)). |
| [web/src/builds/equip.ts](../../web/src/builds/equip.ts) | Turns a build into a step-by-step plan and runs it ([web/src/builds/equip.ts:41](../../web/src/builds/equip.ts#L41), [web/src/builds/equip.ts:162](../../web/src/builds/equip.ts#L162)). |
| [web/src/builds/dim.ts](../../web/src/builds/dim.ts) | Reads DIM loadouts, saves a build as one, and makes share and import links. |
| [web/src/builds/ui.ts](../../web/src/builds/ui.ts) | The tab's HTML and event handling ([web/src/builds/ui.ts:106](../../web/src/builds/ui.ts#L106)). |

## The editor

The tab has two parts side by side: the saved builds, and the build you have open ([web/src/builds/ui.ts:223-234](../../web/src/builds/ui.ts#L223-L234)).

### Saved builds

- **One class at a time.** A Hunter / Titan / Warlock switcher, with the class you played most recently first, shows that class's builds and how many each class has ([web/src/builds/ui.ts:244-260](../../web/src/builds/ui.ts#L244-L260), [web/src/builds/ui.ts:420-426](../../web/src/builds/ui.ts#L420-L426)). With more than four builds a search box filters them by name, tags and class ([web/src/builds/ui.ts:271](../../web/src/builds/ui.ts#L271)).
- **Cards.** Each card shows the subclass, the build rating, all eight gear icons (exotics outlined), the exotics and aspects by name, the fragment count and the three highest stats ([web/src/builds/ui.ts:270-289](../../web/src/builds/ui.ts#L270-L289)).
- **New and import.** The first card starts a new build for that class or imports one from DIM ([web/src/builds/ui.ts:370-376](../../web/src/builds/ui.ts#L370-L376)). With no build open, the editor offers the same, plus importing what a character is wearing ([web/src/builds/ui.ts:412-418](../../web/src/builds/ui.ts#L412-L418)).
- **Delete.** The bin button asks in the card first; confirming removes the build from Vault Rater only, and DIM loadouts and the game are not touched ([web/src/builds/ui.ts:398-409](../../web/src/builds/ui.ts#L398-L409)).

**Importing** from a character or a DIM loadout shows a preview first (subclass, abilities, aspects, fragments, all eight items, mod count and stats); the build is added and saved only when you confirm ([web/src/builds/ui.ts:1724-1736](../../web/src/builds/ui.ts#L1724-L1736), [web/src/builds/ui.ts:1764-1765](../../web/src/builds/ui.ts#L1764-L1765)). A build's class is set when it is made or imported.

### Saving

The editor works on a draft. The title card holds the name, tags (type and press Enter) and a save bar: **Saved** or **Unsaved changes**, **Discard changes** and **Save** ([web/src/builds/ui.ts:320-341](../../web/src/builds/ui.ts#L320-L341), [web/src/builds/model.ts:405](../../web/src/builds/model.ts#L405)). Opening another build, switching class, starting or importing a build, leaving the tab or closing the page with unsaved changes asks first: Save, Discard or keep editing ([web/src/builds/ui.ts:205-206](../../web/src/builds/ui.ts#L205-L206)). A Notes box at the end holds free text ([web/src/builds/ui.ts:457-458](../../web/src/builds/ui.ts#L457-L458)).

### The build's sections

A summary column sits beside the sections and stays in view; on narrow screens it moves above them ([web/src/builds/ui.ts:453-461](../../web/src/builds/ui.ts#L453-L461), [web/src/builds/builds.css:84-85](../../web/src/builds/builds.css#L84-L85), [web/src/builds/builds.css:513-515](../../web/src/builds/builds.css#L513-L515)).

- **Subclass.** Element buttons switch the subclass in one click, each with a hover card describing it; the card also shows Aegis's four scores ([web/src/builds/ui.ts:545-568](../../web/src/builds/ui.ts#L545-L568), [web/src/builds/ui.ts:638-657](../../web/src/builds/ui.ts#L638-L657)).
- **Abilities.** Laid out like the game ([web/src/builds/ui.ts:570-601](../../web/src/builds/ui.ts#L570-L601)):
  - left: the Super as a big square, the two aspects (with how many fragment slots they open), and below them the fragments, three per row ([web/src/builds/builds.css:620](../../web/src/builds/builds.css#L620)), with how many slots are used and a **Modify fragments** button;
  - right: grenade, melee and class ability stacked as wide slots, then small squares for jump and any extras such as Prismatic's Transcendence;
  - each slot shows its icon with the first line of its description beside it ([web/src/builds/ui.ts:606-607](../../web/src/builds/ui.ts#L606-L607)).
- **Weapons** sit side by side with their perks in the game's column order, names on hover, plus frame, ammo, masterwork, tier and power, and links to the weapon's [light.gg](https://www.light.gg/) and [D2 Foundry](https://d2foundry.gg/) pages ([web/src/builds/ui.ts:906-911](../../web/src/builds/ui.ts#L906-L911), [web/src/builds/ui.ts:922-940](../../web/src/builds/ui.ts#L922-L940), [web/src/builds/ui.ts:98-102](../../web/src/builds/ui.ts#L98-L102)).
- **Armor and mods**: one row per piece with its six stats, its four mods as labelled tiles (pointing at one shows what it does, with Clarity's numbers) and its energy, 10 per piece ([web/src/builds/ui.ts:913-920](../../web/src/builds/ui.ts#L913-L920), [web/src/builds/ui.ts:942-967](../../web/src/builds/ui.ts#L942-L967)).
- **Summary**: the rating ring and its parts, the six stats with your aims, the armor set bonuses your pieces turn on, and **Equip on …** and **Export to DIM** ([web/src/builds/ui.ts:471-486](../../web/src/builds/ui.ts#L471-L486), [web/src/builds/ui.ts:521-541](../../web/src/builds/ui.ts#L521-L541)).

### Slot popovers

Every ability, aspect and fragment slot opens a popover in place with the options for that slot, sorted by Aegis tier, with stat changes and fragment slots; pointing at or focusing an option shows its description, Clarity's notes and Aegis's verdict beside the list ([web/src/builds/ui.ts:797-861](../../web/src/builds/ui.ts#L797-L861)). Abilities replace on click. Aspects and fragments toggle, so one popover fills every slot: a pick goes into a free slot, or replaces the slot you opened when all are full ([web/src/builds/ui.ts:876-903](../../web/src/builds/ui.ts#L876-L903)).

How a popover opens depends on the **Hover / Click** switch in the Abilities card header ([web/src/builds/ui.ts:580-582](../../web/src/builds/ui.ts#L580-L582)):

| | Hover (default) | Click |
| --- | --- | --- |
| Mouse | Opens after the pointer rests on a slot for 350 ms, or 300 ms to switch from an open popover, so sweeping across slots opens nothing ([web/src/builds/ui.ts:696-698](../../web/src/builds/ui.ts#L696-L698), [web/src/builds/ui.ts:1372-1380](../../web/src/builds/ui.ts#L1372-L1380)). It closes shortly after the pointer leaves both the slot and the popover ([web/src/builds/ui.ts:749-753](../../web/src/builds/ui.ts#L749-L753), [web/src/builds/ui.ts:1381-1387](../../web/src/builds/ui.ts#L1381-L1387)). | Opens only on click. |
| Click or tap | Pins it open; clicking the slot again closes it ([web/src/builds/ui.ts:1350-1353](../../web/src/builds/ui.ts#L1350-L1353)). | Same. |
| Keyboard | Focusing a slot opens it at once ([web/src/builds/ui.ts:1389-1393](../../web/src/builds/ui.ts#L1389-L1393)). | Enter opens and pins it, like a click. |

In both modes, arrow down on a slot moves into its popover, the arrow keys, Home and End move between options, and Escape closes it ([web/src/builds/ui.ts:1397-1400](../../web/src/builds/ui.ts#L1397-L1400), [web/src/builds/ui.ts:727-739](../../web/src/builds/ui.ts#L727-L739)). On a phone-width screen it opens as a bottom sheet ([web/src/builds/ui.ts:862-866](../../web/src/builds/ui.ts#L862-L866)). The choice is remembered in this browser as `vr-bd-popmode` ([web/src/builds/ui.ts:688-695](../../web/src/builds/ui.ts#L688-L695), [web/src/builds/ui.ts:1446-1453](../../web/src/builds/ui.ts#L1446-L1453)).

### Gear and mods

**Choose gear and mods** (or any weapon, armor or mod slot) opens one drawer for every slot ([web/src/builds/ui.ts:1023-1066](../../web/src/builds/ui.ts#L1023-L1066)):

- **Weapons**: filter by slot, exotic or element; sort by vault score, Aegis tier or name ([web/src/builds/ui.ts:1067-1081](../../web/src/builds/ui.ts#L1067-L1081)).
- **Armor**: your class's armor; filter by slot, exotic, legendary or Tier 5; sort by vault score, stat total, any single stat or name, with every stat in columns ([D2ArmorPicker](https://d2armorpicker.com/) style) ([web/src/builds/ui.ts:1067-1081](../../web/src/builds/ui.ts#L1067-L1081), [web/src/builds/ui.ts:1093-1119](../../web/src/builds/ui.ts#L1093-L1119)).
- **Mods**: pick the armor piece to add to; filter to stat, general or that slot's mods; sort by name or energy cost. A mod goes into the first socket that takes it and has the energy ([web/src/builds/model.ts:307](../../web/src/builds/model.ts#L307), [web/src/builds/ui.ts:1121-1131](../../web/src/builds/ui.ts#L1121-L1131), [web/src/builds/ui.ts:1132-1144](../../web/src/builds/ui.ts#L1132-L1144)).

Clicking a row puts it in its slot and clicking again takes it out; picking a second exotic weapon (or armor piece) takes the first one out ([web/src/builds/ui.ts:1266-1283](../../web/src/builds/ui.ts#L1266-L1283)). A tray shows every slot, every mod socket and the stats with your picks against the saved build. Clicking a mod in the tray takes it out. Nothing changes until **Apply**, which puts the picks into the open build (still to be saved); **Reset** goes back to the build's gear as it was when the drawer opened ([web/src/builds/ui.ts:1182-1191](../../web/src/builds/ui.ts#L1182-L1191), [web/src/builds/ui.ts:1266-1321](../../web/src/builds/ui.ts#L1266-L1321)).

## Sources

| Source | What the tab uses | How |
| --- | --- | --- |
| [Bungie manifest](https://github.com/Bungie-net/api/wiki/Obtaining-Destiny-Definitions-%22The-Manifest%22) | Subclasses, abilities, aspects, fragments, armor mods, energy costs, stat bonuses | Stripped and cached per game version, see above |
| [Aegis's Endgame Analysis](https://docs.google.com/spreadsheets/d/1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY/htmlview) | Tiers for subclasses, aspects and fragments; the build rating | Google Sheet, daily |
| [Destiny Data Compendium](https://docs.google.com/spreadsheets/d/1WaxvbLx7UoSZaBqdFr1u32F2uWVLo-CJunJB4nlGUE4/htmlview) | Descriptions for abilities, aspects, fragments, mods | Google Sheet, daily |
| [Destiny Clarity](https://github.com/Database-Clarity) | Community-tested numbers for abilities, aspects, fragments and mods, by plug hash (the file DIM reads) | Open JSON, daily, kept only for the tab's plugs ([web/src/builds/sheets.ts:176](../../web/src/builds/sheets.ts#L176), [web/src/builds/ratings.ts:52](../../web/src/builds/ratings.ts#L52)) |
| The rater | Vault scores and Aegis weapon tiers per item, armor set bonuses | The report's data |
| [light.gg](https://www.light.gg/), [D2 Foundry](https://d2foundry.gg/) | Weapon roll and perk pages | Links only |

Full list with links: [References](../reference/references.md). Nothing here needs a key or a sign-in beyond the Bungie sign-in the app already has.

## Stats

Armor stats from the API already include whatever mods are in the armor now. The build's stat lines take those out and add the build's own mods and fragments instead, capped at 200 but not floored at 0, so a -10 fragment on an empty stat reads -10 as in the game and DIM ([web/src/builds/model.ts:156-177](../../web/src/builds/model.ts#L156-L177), [web/src/builds/model.ts:172](../../web/src/builds/model.ts#L172), [web/src/builds/model.ts:25](../../web/src/builds/model.ts#L25)). Font mods count the way DIM counts them: +20, +40 or +50 to their stat with one, two or three of them, a bonus you have while you hold Armor Charge (Destiny Clarity's numbers; [web/src/builds/model.ts:149](../../web/src/builds/model.ts#L149)). On the bars, armor is blue, mods cyan, Fonts violet and fragments green. Stats always read Health, Melee, Grenade, Super, Class, Weapons ([web/src/builds/defs.strip.ts:11](../../web/src/builds/defs.strip.ts#L11)). Your aim for a stat is a gold marker you drag along its bar ([web/src/builds/ui.ts:512](../../web/src/builds/ui.ts#L512)). The subclass scores are Aegis's Super, Enhancement, Offense and Defense, shown as Boss super, Damage buffs (buffs and debuffs such as Radiant or Weaken), Roam offense and Roam defense, each explained on hover or focus ([web/src/builds/ui.ts:55](../../web/src/builds/ui.ts#L55)). Each armor piece has 10 mod energy ([web/src/builds/model.ts:24](../../web/src/builds/model.ts#L24)).

## The rating

A build scores out of 100 from five parts ([web/src/builds/model.ts:197-223](../../web/src/builds/model.ts#L197-L223)):

| Part | Weight | From |
| --- | --- | --- |
| Subclass | 25 | Aegis's tier for the class and element |
| Aspects | 30 | Aegis's tier for each aspect; empty slots count 0 |
| Fragments | 20 | Aegis's tier for each fragment; empty slots count 0 |
| Weapons | 15 | The rater's vault score |
| Armor | 10 | The rater's vault score |

Parts with nothing to rate don't count, and the rest are re-weighted ([web/src/builds/model.ts:221-223](../../web/src/builds/model.ts#L221-L223)). Tier letters become points with the same S 100 to D 30 scale as weapons, extended to E and F ([web/src/builds/sheets.ts:18](../../web/src/builds/sheets.ts#L18)).

## Equipping

`planEquip` ([web/src/builds/equip.ts:41](../../web/src/builds/equip.ts#L41)) builds the whole plan before anything runs:

1. **Gear**: pull items that aren't on the character and equip them, exotics last so the old exotic is replaced first. When a wanted item is equipped on another character, a substitute is equipped there so it can move ([web/src/builds/equip.ts:47-93](../../web/src/builds/equip.ts#L47-L93)).
2. **Subclass**: switch to it, then change only the sockets that differ, clearing a socket first when its plug is wanted elsewhere ([web/src/builds/equip.ts:95-118](../../web/src/builds/equip.ts#L95-L118)).
3. **Armor mods**: remove the mods that change, then insert, so energy never runs over mid-way ([web/src/builds/equip.ts:120-137](../../web/src/builds/equip.ts#L120-L137)).
4. Optionally **save to an in-game loadout slot** ([web/src/builds/equip.ts:140-157](../../web/src/builds/equip.ts#L140-L157)).

Item moves that fail are reported at the end; any other failure stops the run ([web/src/builds/equip.ts:161-178](../../web/src/builds/equip.ts#L161-L178)).

**Equip on …** shows that plan as a dry run ("Dry run · nothing has changed yet"), with an option to also save it to one of the character's in-game loadout slots, and runs it only on **Equip now** ([web/src/builds/ui.ts:1616-1638](../../web/src/builds/ui.ts#L1616-L1638)). Before running, it records what the character was wearing; when the run ends, **Undo: put the previous gear back** equips that again through the same dry run ([web/src/builds/ui.ts:1645](../../web/src/builds/ui.ts#L1645), [web/src/builds/ui.ts:1662-1667](../../web/src/builds/ui.ts#L1662-L1667), [web/src/builds/profile.ts:93](../../web/src/builds/profile.ts#L93)).

## DIM

A build converts to DIM's loadout format with subclass socket overrides, armor mods and stat targets ([web/src/builds/model.ts:244](../../web/src/builds/model.ts#L244)), and back again ([web/src/builds/model.ts:278](../../web/src/builds/model.ts#L278)); mods from DIM go into the first free socket that takes them ([web/src/builds/model.ts:307](../../web/src/builds/model.ts#L307)). You can save to DIM Sync, make a dim.gg share link, or open DIM with the loadout ready to import, which works without DIM Sync ([web/src/builds/dim.ts:12-32](../../web/src/builds/dim.ts#L12-L32)). **Export to DIM** offers all of these, plus copying the loadout JSON ([web/src/builds/ui.ts:1673-1684](../../web/src/builds/ui.ts#L1673-L1684)).
