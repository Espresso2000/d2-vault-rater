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
| [web/src/builds/ui.ts](../../web/src/builds/ui.ts) | The tab's HTML and event handling ([web/src/builds/ui.ts:68](../../web/src/builds/ui.ts#L68)). |

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
