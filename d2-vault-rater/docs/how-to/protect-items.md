# Keep an item from ever being marked for sharding

There are three ways; any one is enough. Protected items are kept with the label `protected`, and a lock plan never unlocks them ([src/dim/actions.ts:148](../../src/dim/actions.ts#L148)).

## Add it to the protect list

The protect list takes weapon or armor names, or instance ids. Names are compared after normalising case, accents and punctuation ([src/rating/weapons.ts:144](../../src/rating/weapons.ts#L144), [src/rating/weapons.ts:197](../../src/rating/weapons.ts#L197), [src/bungie/defs.ts:50-56](../../src/bungie/defs.ts#L50-L56)), so `fatebringer` matches `Fatebringer`. A name protects every copy of that weapon.

- AI: `update_settings` with `protect_add: ["Fatebringer"]`; remove with `protect_remove` ([src/server.ts:234-235](../../src/server.ts#L234-L235)).
- Report page: Settings → Protect list ([src/rating/settings.ts:139](../../src/rating/settings.ts#L139)).
- `settings.json`: `"protect": ["Fatebringer", "6917529..."]`.

Armor checks the protect list the same way ([src/rating/armor.ts:189](../../src/rating/armor.ts#L189)).

## Tag it Favorite or Keep in DIM

With DIM tags on and `dim.protectTagged` on (both are on by default, [src/rating/settings.ts:103-110](../../src/rating/settings.ts#L103-L110)), every item tagged Favorite or Keep in DIM is protected on the next rating ([src/dim/common.ts:48-52](../../src/dim/common.ts#L48-L52), [src/rating/weapons.ts:198](../../src/rating/weapons.ts#L198)).

To turn it off: `npm run vault -- dim protect off` ([src/cli.ts:200](../../src/cli.ts#L200)), `update_settings` with `dim_protect_tagged: false`, or the switch in the report's Settings panel.

If DIM can't be reached, the rating goes ahead without DIM data, and nothing is protected by tags that run ([src/pipeline.ts:66-71](../../src/pipeline.ts#L66-L71)).

## Equip it

Equipped weapons and armor are always protected ([src/rating/weapons.ts:195](../../src/rating/weapons.ts#L195), [src/rating/armor.ts:189](../../src/rating/armor.ts#L189)).

## Already protected without asking

- Adept, Timelost and Harrowed copies ([src/rating/weapons.ts:196](../../src/rating/weapons.ts#L196), detected from the name at [src/vault/decode.ts:150](../../src/vault/decode.ts#L150)).
- Your only weapon for a slot and element, e.g. your only Strand power weapon ([src/rating/weapons.ts:191-192](../../src/rating/weapons.ts#L191-L192), [src/rating/weapons.ts:199](../../src/rating/weapons.ts#L199)).
- Extra exotic copies aren't protected, but they are only ever marked *review*, never shard ([src/rating/weapons.ts:253-259](../../src/rating/weapons.ts#L253-L259), [src/rating/armor.ts:194-202](../../src/rating/armor.ts#L194-L202)).
