# Make the rating stricter or more lenient

Pick a preset first, then adjust single values or single weapon types. What each value does is in [Settings](../reference/settings.md#strictness).

## With an AI client

Ask in plain words; the skill maps requests to `update_settings` ([skill/SKILL.md:24-31](../../skill/SKILL.md#L24-L31)). The calls behind them:

```json
{ "preset": "strict" }
{ "overrides": { "copiesPerArchetype": 3 } }
{ "weapon_type": "Submachine Gun", "preset": "ruthless" }
{ "weapon_type": "Submachine Gun", "clear_weapon_type": true }
```

- A global `preset` resets the global overrides, so set the preset before the overrides ([src/server.ts:226-230](../../src/server.ts#L226-L230)).
- With `weapon_type`, `preset` and `overrides` apply to that type only ([src/server.ts:222-224](../../src/server.ts#L222-L224)). A type with its own preset ignores the global overrides ([src/rating/settings.ts:145-149](../../src/rating/settings.ts#L145-L149)).
- The reply includes the resolved values for that type, so you can check the result ([src/server.ts:241](../../src/server.ts#L241)).

Then run `rate_weapons` or `rate_armor` again; the new settings make the server rate afresh ([src/server.ts:77-79](../../src/server.ts#L77-L79)).

## In the report page

Open **Settings** (the gear button). Preset, focus, per-type presets and the protect list are saved by the page's `/api/settings` call ([src/rating/settings.ts:127-142](../../src/rating/settings.ts#L127-L142)). **Save and re-rate** saves them and rates your vault again; the web app re-rates when the page reloads ([web/src/main.ts:205-207](../../web/src/main.ts#L205-L207)).

## By editing settings.json

Edit `~/.d2-vault-rater/settings.json` ([src/config.ts:10](../../src/config.ts#L10)) and run `npm run vault` again:

```json
{
  "preset": "balanced",
  "overrides": { "minRollKept": 75, "unlock": ["duplicate", "d-tier"] },
  "byWeaponType": { "Rocket Launcher": { "overrides": { "copiesPerArchetype": 3 } } }
}
```

Values are checked when settings load ([src/rating/settings.ts:117-119](../../src/rating/settings.ts#L117-L119)): ranges are in [the reference](../reference/settings.md#strictness).

## Armor

Armor reads the global preset and overrides only (`armorCopies`, `legacyArmor`, and whether `armor` is in `unlock`) ([src/rating/armor.ts:97](../../src/rating/armor.ts#L97), [src/dim/actions.ts:60-65](../../src/dim/actions.ts#L60-L65)). To change which stats armor is judged against, set `buildStats`, e.g. `{ "Hunter": ["Grenade", "Weapons"] }` ([src/rating/armor.ts:76-78](../../src/rating/armor.ts#L76-L78)).
