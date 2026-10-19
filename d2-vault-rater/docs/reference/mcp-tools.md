# MCP tools

The MCP server ([src/server.ts](../../src/server.ts)) talks over stdio ([src/server.ts:428](../../src/server.ts#L428)) and registers one prompt and sixteen tools. Every tool returns its result as JSON text, or `Error: <message>` with `isError` set when it throws ([src/server.ts:34-44](../../src/server.ts#L34-L44)).

## Prompt

| Name | Returns |
| --- | --- |
| `vault_review` | The contents of `skill/SKILL.md`, the instructions for running a vault review ([src/server.ts:30](../../src/server.ts#L30), [src/server.ts:118-122](../../src/server.ts#L118-L122)). |

## Tools

"Game" means the tool changes something in Destiny 2 or DIM.

| Tool | Inputs | What it does | Game | Source |
| --- | --- | --- | --- | --- |
| `login` | `redirected_url?` | Without input, returns the bungie.net approval URL; with the URL the browser landed on, finishes the login. | No | [src/server.ts:124-136](../../src/server.ts#L124-L136) |
| `refresh_sources` | `force_manifest?` | Downloads the manifest and re-imports Aegis's sheet, wishlists, armor set tiers and raid loot; reports unmatched names. | No | [src/server.ts:138-158](../../src/server.ts#L138-L158) |
| `get_vault` | none | Reads the vault and characters fresh and summarises counts by slot, type and class. | No | [src/server.ts:160-176](../../src/server.ts#L160-L176) |
| `get_settings` | none | Settings, the resolved strictness and the preset names. | No | [src/server.ts:178-185](../../src/server.ts#L178-L185) |
| `update_settings` | `preset?`, `overrides?`, `weapon_type?`, `clear_weapon_type?`, `focus?`, `tone?`, `protect_add?`, `protect_remove?`, `build_stats?`, `dim_tags?`, `dim_loadouts?`, `dim_protect_tagged?` | Changes and saves settings ([details](settings.md#changing-settings)). | No | [src/server.ts:187-247](../../src/server.ts#L187-L247) |
| `rate_weapons` | `detail?`: `summary` or `full` | Best per slot, element and archetype, duplicates, shard list, S-tier gaps; `full` adds every weapon. | No | [src/server.ts:249-273](../../src/server.ts#L249-L273) |
| `rate_armor` | `detail?` | Best per class and slot, set counts, shard list. | No | [src/server.ts:275-293](../../src/server.ts#L275-L293) |
| `rate_activities` | none | Raids and dungeons ranked for farming. Needs `refresh_sources` first. | No | [src/server.ts:295-316](../../src/server.ts#L295-L316) |
| `plan_encounters` | `activity?` | Per encounter: what it demands, the best three-weapon loadout from the vault, and meta picks you lack. | No | [src/server.ts:318-333](../../src/server.ts#L318-L333) |
| `move_items` | `ids` (1-20), `to`, `equip?` | Moves items to a character (class name or id) or the vault, optionally equipping them. | Yes | [src/server.ts:335-350](../../src/server.ts#L335-L350) |
| `set_dim_tag` | `id`, `tag` (or null), `notes?` | Sets or clears one item's DIM tag through DIM Sync. | Yes (DIM) | [src/server.ts:352-363](../../src/server.ts#L352-L363) |
| `build_report` | `plan_id?` | Markdown report with images, plus the interactive HTML report written to disk. | No | [src/server.ts:365-381](../../src/server.ts#L365-L381) |
| `plan_dim_actions` | none | Dry run: what would be locked, unlocked and tagged, with reasons. Saves the plan and returns its id. | No | [src/server.ts:383-400](../../src/server.ts#L383-L400) |
| `apply_dim_actions` | `plan_id`, `confirm: true` | Applies the plan's locks, saves an undo snapshot and writes the DIM tags CSV. | Yes | [src/server.ts:402-414](../../src/server.ts#L402-L414) |
| `export_dim_csv` | `plan_id` | Writes the DIM tags CSV only. | No | [src/server.ts:416-420](../../src/server.ts#L416-L420) |
| `undo_dim_actions` | `plan_id` | Restores every lock that plan changed. | Yes | [src/server.ts:422-426](../../src/server.ts#L422-L426) |

`move_items` takes at most 20 ids per call ([src/server.ts:339](../../src/server.ts#L339)). `tag` is one of `favorite`, `keep`, `infuse`, `junk`, `archive` ([src/dim/common.ts:9](../../src/dim/common.ts#L9)).

## Shapes

`rate_weapons` and `rate_armor` return shortened items to keep the reply small: [src/server.ts:83-101](../../src/server.ts#L83-L101) for weapons (id, name, type, element, slot, tier, score, roll, verdict, label, category, perks, matched perks, reasons, Aegis notes, icon, screenshot) and [src/server.ts:102-116](../../src/server.ts#L102-L116) for armor (id, name, class, slot, archetype, gear tier, top stats, set, score, verdict, label, reasons, icon). The `verdict` is `keep`, `shard` or `review`; `label` says why it is kept: `best`, `backup`, `protected`, `unrated` (weapons) or `set` (armor), and is `shard` for everything marked shard or review ([src/rating/weapons.ts:49-50](../../src/rating/weapons.ts#L49-L50), [src/rating/armor.ts:31-32](../../src/rating/armor.ts#L31-L32)).

## Server state

The server reads the vault once and reuses it until `get_vault` runs again ([src/vault/fetch.ts:18-21](../../src/vault/fetch.ts#L18-L21)), reuses ratings while nothing changed ([src/server.ts:65-81](../../src/server.ts#L65-L81)), rates afresh after `move_items`, since a move changes what is equipped and so what is protected ([src/server.ts:343-348](../../src/server.ts#L343-L348)), and re-reads DIM data at most every five minutes ([src/server.ts:51-63](../../src/server.ts#L51-L63)); `set_dim_tag` clears that cache ([src/server.ts:360](../../src/server.ts#L360)).
