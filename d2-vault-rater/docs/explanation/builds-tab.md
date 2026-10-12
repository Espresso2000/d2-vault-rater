# The Builds tab

The web app's Builds tab lets you put together a subclass, three weapons, five armor pieces, their mods and stat targets; see how the community rates it; then equip it on a character or send it to DIM. Builds are saved in the browser ([web/src/builds/store.ts:5-8](../../web/src/builds/store.ts#L5-L8)). It is web-only and is loaded as a separate chunk ([web/src/main.ts:179-183](../../web/src/main.ts#L179-L183)).

## The parts

| Module | Role |
| --- | --- |
| [web/src/builds/defs.strip.ts](../../web/src/builds/defs.strip.ts) | Cuts the manifest down to subclasses, their socket plugs (supers, abilities, aspects, fragments) and armor mods ([web/src/builds/defs.strip.ts:76](../../web/src/builds/defs.strip.ts#L76)). |
| [web/src/builds/defs.ts](../../web/src/builds/defs.ts) | Loads those definitions like the item database: IndexedDB, then a shipped snapshot, then a worker ([web/src/builds/defs.ts:10-22](../../web/src/builds/defs.ts#L10-L22)). |
| [web/src/builds/sheets.ts](../../web/src/builds/sheets.ts) | Parses Aegis's Aspects, Fragments and Subclasses tabs and the Data Compendium's descriptions ([web/src/builds/sheets.ts:61](../../web/src/builds/sheets.ts#L61), [web/src/builds/sheets.ts:105](../../web/src/builds/sheets.ts#L105), [web/src/builds/sheets.ts:149](../../web/src/builds/sheets.ts#L149)). |
| [web/src/builds/ratings.ts](../../web/src/builds/ratings.ts) | Downloads those sheets once a day and keeps yesterday's copy if a refresh fails ([web/src/builds/ratings.ts:15-38](../../web/src/builds/ratings.ts#L15-L38)). |
| [web/src/builds/model.ts](../../web/src/builds/model.ts) | The build itself and everything computed from it; no network or DOM. |
| [web/src/builds/profile.ts](../../web/src/builds/profile.ts) | Reads what equipping needs beyond the vault: subclasses, unlocked plugs, socket contents and in-game loadout slots ([web/src/builds/profile.ts:45](../../web/src/builds/profile.ts#L45)). |
| [web/src/builds/equip.ts](../../web/src/builds/equip.ts) | Turns a build into a step-by-step plan and runs it ([web/src/builds/equip.ts:41](../../web/src/builds/equip.ts#L41), [web/src/builds/equip.ts:162](../../web/src/builds/equip.ts#L162)). |
| [web/src/builds/dim.ts](../../web/src/builds/dim.ts) | Reads DIM loadouts, saves a build as one, and makes share and import links. |
| [web/src/builds/ui.ts](../../web/src/builds/ui.ts) | The tab's HTML and event handling ([web/src/builds/ui.ts:90](../../web/src/builds/ui.ts#L90)). |

## The editor

Three areas: the saved builds on the left, the build's sections in the middle, and a summary column on the right that stays in view (it moves above the sections on narrower screens).

- **Subclass.** Elements switch with one click. Every ability, aspect and fragment slot opens a popover in place: on hover with a mouse, on keyboard focus (arrow down moves into it, arrows move between options, Escape closes) and on tap, where it opens as a bottom sheet ([web/src/builds/ui.ts:421](../../web/src/builds/ui.ts#L421), [web/src/builds/ui.ts:980](../../web/src/builds/ui.ts#L980)). Options are sorted by Aegis tier and show stat changes and fragment slots; pointing at one shows its description, Clarity's notes and Aegis's verdict. Abilities replace on click. Aspects and fragments toggle, so one popover fills every slot: a pick goes into a free slot, or replaces the slot you opened when all are full ([web/src/builds/ui.ts:534-560](../../web/src/builds/ui.ts#L534-L560)).
- **Gear and mods.** One drawer picks weapons, armor and mods for every slot ([web/src/builds/ui.ts:680](../../web/src/builds/ui.ts#L680)). Weapons and armor come from one filterable list (slot, element, exotic, Tier 5; sorted by vault score, Aegis tier, stat total or a single stat, d2armorpicker style) with every armor stat in columns ([web/src/builds/ui.ts:728](../../web/src/builds/ui.ts#L728)). Clicking a row puts it in its slot, clicking again takes it out, and a second exotic of the same kind replaces the first. The mods tab adds to the armor piece you choose, into the first socket that takes the mod and has the energy. A tray shows every slot, every mod socket and the stats with your picks against the saved build; nothing changes until **Apply** ([web/src/builds/ui.ts:817](../../web/src/builds/ui.ts#L817), [web/src/builds/ui.ts:948](../../web/src/builds/ui.ts#L948)).
- **Summary.** The rating ring and its parts, the six stats with your aims, the armor set bonuses your pieces turn on (from the report's set data), and the equip and DIM buttons ([web/src/builds/ui.ts:243](../../web/src/builds/ui.ts#L243), [web/src/builds/ui.ts:282](../../web/src/builds/ui.ts#L282)).
- Each weapon links to its light.gg and D2 Foundry pages for rolls and perk numbers.

## Sources

| Source | What the tab uses | How |
| --- | --- | --- |
| Bungie manifest | Subclasses, abilities, aspects, fragments, armor mods, energy costs, stat bonuses | Stripped and cached per game version, see above |
| Aegis's Endgame Analysis | Tiers for subclasses, aspects and fragments; the build rating | Google Sheet, daily |
| Destiny Data Compendium | Descriptions for abilities, aspects, fragments, mods | Google Sheet, daily |
| [Destiny Clarity](https://github.com/Database-Clarity) | Community-tested numbers for abilities, aspects, fragments and mods, by plug hash (the file DIM reads) | Open JSON, daily, kept only for the tab's plugs ([web/src/builds/sheets.ts:176](../../web/src/builds/sheets.ts#L176), [web/src/builds/ratings.ts:52](../../web/src/builds/ratings.ts#L52)) |
| The rater | Vault scores and Aegis weapon tiers per item, armor set bonuses | The report's data |
| light.gg, D2 Foundry | Weapon roll and perk pages | Links only |

Nothing here needs a key or a sign-in beyond the Bungie sign-in the app already has.

## Stats

Armor stats from the API already include whatever mods are in the armor now. The build's stat lines take those out and add the build's own mods and fragments instead, capped at 200 ([web/src/builds/model.ts:147-166](../../web/src/builds/model.ts#L147-L166), [web/src/builds/model.ts:25](../../web/src/builds/model.ts#L25)). Each armor piece has 10 mod energy ([web/src/builds/model.ts:24](../../web/src/builds/model.ts#L24)).

## The rating

A build scores out of 100 from five parts ([web/src/builds/model.ts:186-212](../../web/src/builds/model.ts#L186-L212)):

| Part | Weight | From |
| --- | --- | --- |
| Subclass | 25 | Aegis's tier for the class and element |
| Aspects | 30 | Aegis's tier for each aspect; empty slots count 0 |
| Fragments | 20 | Aegis's tier for each fragment; empty slots count 0 |
| Weapons | 15 | The rater's vault score |
| Armor | 10 | The rater's vault score |

Parts with nothing to rate don't count, and the rest are re-weighted ([web/src/builds/model.ts:210-212](../../web/src/builds/model.ts#L210-L212)). Tier letters become points with the same S 100 to D 30 scale as weapons, extended to E and F ([web/src/builds/sheets.ts:18](../../web/src/builds/sheets.ts#L18)).

## Equipping

`planEquip` ([web/src/builds/equip.ts:41](../../web/src/builds/equip.ts#L41)) builds the whole plan before anything runs:

1. **Gear**: pull items that aren't on the character and equip them, exotics last so the old exotic is replaced first. When a wanted item is equipped on another character, a substitute is equipped there so it can move ([web/src/builds/equip.ts:47-93](../../web/src/builds/equip.ts#L47-L93)).
2. **Subclass**: switch to it, then change only the sockets that differ, clearing a socket first when its plug is wanted elsewhere ([web/src/builds/equip.ts:95-118](../../web/src/builds/equip.ts#L95-L118)).
3. **Armor mods**: remove the mods that change, then insert, so energy never runs over mid-way ([web/src/builds/equip.ts:120-137](../../web/src/builds/equip.ts#L120-L137)).
4. Optionally **save to an in-game loadout slot** ([web/src/builds/equip.ts:140-157](../../web/src/builds/equip.ts#L140-L157)).

Item moves that fail are reported at the end; any other failure stops the run ([web/src/builds/equip.ts:161-178](../../web/src/builds/equip.ts#L161-L178)).

## DIM

A build converts to DIM's loadout format with subclass socket overrides, armor mods and stat targets ([web/src/builds/model.ts:233](../../web/src/builds/model.ts#L233)), and back again ([web/src/builds/model.ts:267](../../web/src/builds/model.ts#L267)); mods from DIM go into the first free socket that takes them ([web/src/builds/model.ts:296](../../web/src/builds/model.ts#L296)). You can save to DIM Sync, make a dim.gg share link, or open DIM with the loadout ready to import, which works without DIM Sync ([web/src/builds/dim.ts:12-32](../../web/src/builds/dim.ts#L12-L32)).
