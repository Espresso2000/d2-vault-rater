# Settings

Settings live in `settings.json` in the data folder ([src/config.ts:10](../../src/config.ts#L10)), or in the browser for the web app. They are validated with the schema in [src/rating/settings.ts:89-115](../../src/rating/settings.ts#L89-L115) every time they are loaded or saved ([src/rating/settings.ts:117-125](../../src/rating/settings.ts#L117-L125)); missing fields take their defaults.

## Fields

| Field | Type | Default | Meaning | Source |
| --- | --- | --- | --- | --- |
| `preset` | `lenient`, `balanced`, `strict`, `ruthless` | `balanced` | Strictness preset (table below). | [src/rating/settings.ts:90](../../src/rating/settings.ts#L90) |
| `overrides` | partial strictness | `{}` | Single values that replace the preset's. | [src/rating/settings.ts:91](../../src/rating/settings.ts#L91) |
| `byWeaponType` | type name → `{ preset?, overrides? }` | `{}` | Strictness for one weapon type, e.g. `"Submachine Gun"`. | [src/rating/settings.ts:92-93](../../src/rating/settings.ts#L92-L93) |
| `focus` | `pve`, `pvp`, `both` | `pve` | Shown in the report header; it does not change any score ([src/report/siteData.ts:112](../../src/report/siteData.ts#L112)). | [src/rating/settings.ts:94](../../src/rating/settings.ts#L94) |
| `protect` | string[] | `[]` | Weapon or armor names, or instance ids, never marked for sharding. | [src/rating/settings.ts:95-96](../../src/rating/settings.ts#L95-L96) |
| `buildStats` | class → stat names | `{}` | Stats each class's builds want; inferred from equipped armor when empty. | [src/rating/settings.ts:97-98](../../src/rating/settings.ts#L97-L98) |
| `tone` | `short`, `detailed` | `detailed` | How long the AI's write-up should be ([skill/SKILL.md:55](../../skill/SKILL.md#L55)); not used by the code. | [src/rating/settings.ts:99](../../src/rating/settings.ts#L99) |
| `wishlists` | URL[] | `[]` | DIM wishlist files to import; empty means the voltron list ([src/sources/wishlist.ts:4-6](../../src/sources/wishlist.ts#L4-L6)). | [src/rating/settings.ts:100](../../src/rating/settings.ts#L100) |
| `aegisTabs` | `{ name, gid }[]` | `[]` | Extra Aegis sheet tabs, used if Google's tab list can't be read. | [src/rating/settings.ts:101](../../src/rating/settings.ts#L101) |
| `dim.tags` | boolean | `true` | Read DIM tags and notes into the report. | [src/rating/settings.ts:102-111](../../src/rating/settings.ts#L102-L111) |
| `dim.loadouts` | boolean | `true` | Read DIM loadouts into the report. | same |
| `dim.protectTagged` | boolean | `true` | Never shard items tagged Favorite or Keep in DIM. | same |
| `dimKeep` | string[] | `[]` | Filled in at rating time from DIM tags; not meant to be set by hand. | [src/rating/settings.ts:112-113](../../src/rating/settings.ts#L112-L113) |

## Strictness

Each preset is a full set of these values ([src/rating/settings.ts:12-28](../../src/rating/settings.ts#L12-L28), [src/rating/settings.ts:30-71](../../src/rating/settings.ts#L30-L71)):

| Value | Lenient | Balanced | Strict | Ruthless | Used by |
| --- | --- | --- | --- | --- | --- |
| `minTierKept`: lowest Aegis tier kept without a strong roll | C | B | A | S | weapons |
| `minRollKept`: roll score that saves a weapon below the floor, or a second copy | 50 | 70 | 80 | 90 | weapons |
| `copiesPerArchetype`: copies kept per type + frame + element | 3 | 2 | 1 | 1 | weapons |
| `outscoredGap`: score gap below the archetype's best that shards a backup | 35 | 25 | 15 | 10 | weapons |
| `unrated`: weapons not on Aegis's sheet | `keep` | `keep-flagged` | `wishlist` | `shard-unless-godroll` | weapons |
| `armorCopies`: pieces kept per class + slot + archetype + tertiary | 3 | 2 | 1 | 1 | armor |
| `legacyArmor`: pre-Armor 3.0 pieces | `keep` | `keep-if-better` | `shard-if-outscored` | `shard` | armor |
| `unlock`: shard categories unlocked when a plan is applied | duplicate | duplicate | duplicate, d-tier | all seven | lock plan |

Override ranges: `minRollKept` and `outscoredGap` 0-100; `copiesPerArchetype` and `armorCopies` whole numbers 1-10 ([src/rating/settings.ts:73-87](../../src/rating/settings.ts#L73-L87)). The shard categories are `duplicate`, `d-tier`, `low-tier`, `outscored`, `trash-roll`, `unrated` and `armor` ([src/rating/settings.ts:9](../../src/rating/settings.ts#L9)).

### How the values combine

`strictnessFor` ([src/rating/settings.ts:145-149](../../src/rating/settings.ts#L145-L149)) starts from a preset and layers overrides on top:

- No per-type entry: the global preset, then the global `overrides`.
- A per-type entry with its own `preset`: that preset, then that type's `overrides`. The global overrides are **not** applied.
- A per-type entry with only `overrides`: the global preset, the global overrides, then that type's overrides.

Armor always uses the global strictness ([src/rating/armor.ts:97](../../src/rating/armor.ts#L97)).

## Changing settings

- **AI**: `update_settings` ([src/server.ts:187-243](../../src/server.ts#L187-L243)). Choosing a global `preset` clears the global overrides ([src/server.ts:226-229](../../src/server.ts#L226-L229)); with `weapon_type`, `preset` and `overrides` apply to that type only and `clear_weapon_type` removes its entry ([src/server.ts:222-224](../../src/server.ts#L222-L224)). `protect_add` and `protect_remove` edit the protect list ([src/server.ts:234-235](../../src/server.ts#L234-L235)).
- **Report page Settings panel** (local app and web app): preset, focus, protect list, per-type settings and the three DIM switches ([src/rating/settings.ts:127-142](../../src/rating/settings.ts#L127-L142)).
- **CLI**: `npm run vault -- dim <tags|loadouts|protect|on|off> [on|off]` for the DIM switches ([src/cli.ts:193-204](../../src/cli.ts#L193-L204)).
- **By hand**: edit `settings.json`; invalid values make the next load fail with zod's message.
