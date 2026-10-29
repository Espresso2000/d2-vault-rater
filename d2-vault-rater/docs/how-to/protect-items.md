# Keep an item from ever being marked for sharding

There are three ways; any one is enough. Protected items are kept with the label `protected`, and a lock plan never unlocks them ([src/dim/actions.ts:148](../../src/dim/actions.ts#L148)).

## Add it to the protect list

The protect list takes weapon or armor names, or instance ids. Names are compared after normalising case, accents and punctuation ([src/rating/weapons.ts:158](../../src/rating/weapons.ts#L158), [src/rating/weapons.ts:211](../../src/rating/weapons.ts#L211), [src/bungie/defs.ts:53-66](../../src/bungie/defs.ts#L53-L66)), so `fatebringer` matches `Fatebringer`. A name protects every copy of that weapon.

- AI: `update_settings` with `protect_add: ["Fatebringer"]`; remove with `protect_remove` ([src/server.ts:234-235](../../src/server.ts#L234-L235)).
- Report page: Settings → Protect list ([src/rating/settings.ts:139](../../src/rating/settings.ts#L139)).
- `settings.json`: `"protect": ["Fatebringer", "6917529..."]`.

Armor checks the protect list the same way ([src/rating/armor.ts:189](../../src/rating/armor.ts#L189)).

## Tag it Favorite or Keep in DIM

With DIM tags on and `dim.protectTagged` on (both are on by default, [src/rating/settings.ts:103-110](../../src/rating/settings.ts#L103-L110)), every item tagged Favorite or Keep in DIM is protected on the next rating ([src/dim/common.ts:48-52](../../src/dim/common.ts#L48-L52), [src/rating/weapons.ts:212](../../src/rating/weapons.ts#L212)).

To turn it off: `npm run vault -- dim protect off` ([src/cli.ts:200](../../src/cli.ts#L200)), `update_settings` with `dim_protect_tagged: false`, or the switch in the report's Settings panel.

If DIM can't be reached, the rating goes ahead without DIM data, and nothing is protected by tags that run ([src/pipeline.ts:70-75](../../src/pipeline.ts#L70-L75)).

## Equip it

Equipped weapons and armor are always protected ([src/rating/weapons.ts:209](../../src/rating/weapons.ts#L209), [src/rating/armor.ts:189](../../src/rating/armor.ts#L189)).

## Already protected without asking

- Adept, Timelost and Harrowed copies ([src/rating/weapons.ts:210](../../src/rating/weapons.ts#L210), detected from the name at [src/vault/decode.ts:152](../../src/vault/decode.ts#L152)).
- Your only weapon for a slot and element, e.g. your only Strand power weapon ([src/rating/weapons.ts:205-206](../../src/rating/weapons.ts#L205-L206), [src/rating/weapons.ts:213](../../src/rating/weapons.ts#L213)).
- Extra exotic copies aren't protected, but they are only ever marked *review*, never shard ([src/rating/weapons.ts:267-273](../../src/rating/weapons.ts#L267-L273), [src/rating/armor.ts:194-202](../../src/rating/armor.ts#L194-L202)).
