# The Builds tab

The web app's Builds tab lets you put together a subclass, three weapons, five armor pieces, their mods and stat targets; see how the community rates it; then equip it on a character or send it to DIM. Builds are saved in the browser ([web/src/builds/store.ts:5-8](../../web/src/builds/store.ts#L5-L8)). It is web-only and is loaded as a separate chunk ([web/src/main.ts:179-183](../../web/src/main.ts#L179-L183)).

## The parts

| Module | Role |
| --- | --- |
| [web/src/builds/defs.strip.ts](../../web/src/builds/defs.strip.ts) | Cuts the manifest down to subclasses, their socket plugs (supers, abilities, aspects, fragments) and armor mods ([web/src/builds/defs.strip.ts:79](../../web/src/builds/defs.strip.ts#L79)). |
| [web/src/builds/defs.ts](../../web/src/builds/defs.ts) | Loads those definitions like the item database: IndexedDB, then a shipped snapshot, then a worker ([web/src/builds/defs.ts:10-23](../../web/src/builds/defs.ts#L10-L23)). |
| [web/src/builds/sheets.ts](../../web/src/builds/sheets.ts) | Parses Aegis's Aspects, Fragments and Subclasses tabs and the Data Compendium's descriptions ([web/src/builds/sheets.ts:61](../../web/src/builds/sheets.ts#L61), [web/src/builds/sheets.ts:105](../../web/src/builds/sheets.ts#L105), [web/src/builds/sheets.ts:149](../../web/src/builds/sheets.ts#L149)). |
| [web/src/builds/ratings.ts](../../web/src/builds/ratings.ts) | Downloads those sheets once a day and keeps yesterday's copy if a refresh fails ([web/src/builds/ratings.ts:15-38](../../web/src/builds/ratings.ts#L15-L38)). |
| [web/src/builds/model.ts](../../web/src/builds/model.ts) | The build itself and everything computed from it; no network or DOM. |
| [web/src/builds/profile.ts](../../web/src/builds/profile.ts) | Reads what equipping needs beyond the vault: subclasses, unlocked plugs, socket contents and in-game loadout slots ([web/src/builds/profile.ts:45](../../web/src/builds/profile.ts#L45)). |
| [web/src/builds/equip.ts](../../web/src/builds/equip.ts) | Turns a build into a step-by-step plan and runs it ([web/src/builds/equip.ts:41](../../web/src/builds/equip.ts#L41), [web/src/builds/equip.ts:162](../../web/src/builds/equip.ts#L162)). |
| [web/src/builds/dim.ts](../../web/src/builds/dim.ts) | Reads DIM loadouts, saves a build as one, and makes share and import links. |
| [web/src/builds/ui.ts](../../web/src/builds/ui.ts) | The tab's HTML and event handling ([web/src/builds/ui.ts:104](../../web/src/builds/ui.ts#L104)). |

## The editor

> The Builds tab's layout is being redesigned, so this section only describes what the editor does, not where things sit on screen. The rating, stats, equipping and DIM sections below describe the logic, which the redesign keeps.

- **Saved builds** are listed per class; you start a new build, import one from a character or a DIM loadout (with a preview before it is added), or delete one. Deleting removes it from Vault Rater only; DIM loadouts and the game are not touched ([web/src/builds/ui.ts:1364](../../web/src/builds/ui.ts#L1364), [web/src/builds/ui.ts:1574](../../web/src/builds/ui.ts#L1574)).
- **Editing works on a draft**: nothing is kept until you save, and leaving with unsaved changes asks first ([web/src/builds/model.ts:327](../../web/src/builds/model.ts#L327), [web/src/builds/ui.ts:193](../../web/src/builds/ui.ts#L193)).
- **Subclass**: pick the element, abilities, aspects and fragments. Options are sorted by Aegis tier and show their description, stat changes and Destiny Clarity's notes ([web/src/builds/ui.ts:641](../../web/src/builds/ui.ts#L641), [web/src/builds/ui.ts:753-779](../../web/src/builds/ui.ts#L753-L779)).
- **Gear and mods**: weapons, armor and armor mods for every slot come from one filterable, sortable list ([D2ArmorPicker](https://d2armorpicker.com/) style stat columns), with a stat preview against the saved build; nothing changes until you apply ([web/src/builds/ui.ts:922](../../web/src/builds/ui.ts#L922), [web/src/builds/ui.ts:1190](../../web/src/builds/ui.ts#L1190)).
- **Summary**: the rating and its parts, the six stats with your aims, the armor set bonuses your pieces turn on, and the equip and DIM actions ([web/src/builds/ui.ts:362](../../web/src/builds/ui.ts#L362)).
- Each weapon links to its [light.gg](https://www.light.gg/) and [D2 Foundry](https://d2foundry.gg/) pages for rolls and perk numbers ([web/src/builds/ui.ts:98](../../web/src/builds/ui.ts#L98)).

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

Armor stats from the API already include whatever mods are in the armor now. The build's stat lines take those out and add the build's own mods and fragments instead, capped at 200 but not floored at 0, so a -10 fragment on an empty stat reads -10 as in the game and DIM ([web/src/builds/model.ts:154-175](../../web/src/builds/model.ts#L154-L175), [web/src/builds/model.ts:170](../../web/src/builds/model.ts#L170), [web/src/builds/model.ts:25](../../web/src/builds/model.ts#L25)). Font mods count the way DIM counts them: +20, +40 or +50 to their stat with one, two or three of them, a bonus you have while you hold Armor Charge (Destiny Clarity's numbers; [web/src/builds/model.ts:147](../../web/src/builds/model.ts#L147)). On the bars, armor is blue, mods cyan, Fonts violet and fragments green. Stats always read Health, Melee, Grenade, Super, Class, Weapons ([web/src/builds/defs.strip.ts:11](../../web/src/builds/defs.strip.ts#L11)). Your aim for a stat is a gold marker you drag along its bar ([web/src/builds/ui.ts:401](../../web/src/builds/ui.ts#L401)). The subclass scores are Aegis's Super, Enhancement, Offense and Defense, shown as Boss super, Damage buffs (buffs and debuffs such as Radiant or Weaken), Roam offense and Roam defense, each explained on hover or focus ([web/src/builds/ui.ts:54](../../web/src/builds/ui.ts#L54)). Each armor piece has 10 mod energy ([web/src/builds/model.ts:24](../../web/src/builds/model.ts#L24)).

## The rating

A build scores out of 100 from five parts ([web/src/builds/model.ts:195-221](../../web/src/builds/model.ts#L195-L221)):

| Part | Weight | From |
| --- | --- | --- |
| Subclass | 25 | Aegis's tier for the class and element |
| Aspects | 30 | Aegis's tier for each aspect; empty slots count 0 |
| Fragments | 20 | Aegis's tier for each fragment; empty slots count 0 |
| Weapons | 15 | The rater's vault score |
| Armor | 10 | The rater's vault score |

Parts with nothing to rate don't count, and the rest are re-weighted ([web/src/builds/model.ts:219-221](../../web/src/builds/model.ts#L219-L221)). Tier letters become points with the same S 100 to D 30 scale as weapons, extended to E and F ([web/src/builds/sheets.ts:18](../../web/src/builds/sheets.ts#L18)).

## Equipping

`planEquip` ([web/src/builds/equip.ts:41](../../web/src/builds/equip.ts#L41)) builds the whole plan before anything runs:

1. **Gear**: pull items that aren't on the character and equip them, exotics last so the old exotic is replaced first. When a wanted item is equipped on another character, a substitute is equipped there so it can move ([web/src/builds/equip.ts:47-93](../../web/src/builds/equip.ts#L47-L93)).
2. **Subclass**: switch to it, then change only the sockets that differ, clearing a socket first when its plug is wanted elsewhere ([web/src/builds/equip.ts:95-118](../../web/src/builds/equip.ts#L95-L118)).
3. **Armor mods**: remove the mods that change, then insert, so energy never runs over mid-way ([web/src/builds/equip.ts:120-137](../../web/src/builds/equip.ts#L120-L137)).
4. Optionally **save to an in-game loadout slot** ([web/src/builds/equip.ts:140-157](../../web/src/builds/equip.ts#L140-L157)).

Item moves that fail are reported at the end; any other failure stops the run ([web/src/builds/equip.ts:161-178](../../web/src/builds/equip.ts#L161-L178)).

## DIM

A build converts to DIM's loadout format with subclass socket overrides, armor mods and stat targets ([web/src/builds/model.ts:242](../../web/src/builds/model.ts#L242)), and back again ([web/src/builds/model.ts:276](../../web/src/builds/model.ts#L276)); mods from DIM go into the first free socket that takes them ([web/src/builds/model.ts:305](../../web/src/builds/model.ts#L305)). You can save to DIM Sync, make a dim.gg share link, or open DIM with the loadout ready to import, which works without DIM Sync ([web/src/builds/dim.ts:12-32](../../web/src/builds/dim.ts#L12-L32)).
