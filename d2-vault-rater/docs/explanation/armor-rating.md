# How armor is rated

Armor 3.0 pieces have an archetype (which fixes the primary and secondary stat), a tertiary stat, a gear tier and often a set bonus. `rateArmor` ([src/rating/armor.ts:96](../../src/rating/armor.ts#L96)) scores each piece out of 100 and then decides what to keep.

## The score

Four parts, weighted 40 / 25 / 25 / 10 ([src/rating/armor.ts:44-45](../../src/rating/armor.ts#L44-L45)), computed at [src/rating/armor.ts:126-161](../../src/rating/armor.ts#L126-L161):

- **Stats (40).** The piece's three highest stats against the best possible Tier 5 roll, 30 + 25 + 20 = 75 ([src/rating/armor.ts:7-8](../../src/rating/armor.ts#L7-L8), [src/rating/armor.ts:130](../../src/rating/armor.ts#L130)).
- **Build fit (25).** How well those top three stats match the stats your builds want, weighting the primary most (0.5 / 0.3 / 0.2) ([src/rating/armor.ts:131-135](../../src/rating/armor.ts#L131-L135)). With no wanted stats known, every piece gets half.
- **Set bonus (25).** How strong the piece's set is for you ([src/rating/armor.ts:137](../../src/rating/armor.ts#L137)). Exotics have no set and get a neutral 60% of this part ([src/rating/armor.ts:46-47](../../src/rating/armor.ts#L46-L47)).
- **Extras (10).** 10 for exotics and Tier 5, 5 for Tier 4 ([src/rating/armor.ts:138](../../src/rating/armor.ts#L138)).

**Wanted stats** come from your settings when you set them; otherwise they are the two highest stat totals across the armor each class has equipped ([src/rating/armor.ts:76-94](../../src/rating/armor.ts#L76-L94)).

**Set value.** Aegis rates each set's 2-piece and 4-piece bonus by tier (S 100 down to F 10, [src/sources/armorSets.ts:13](../../src/sources/armorSets.ts#L13)); unrated bonuses count 40 ([src/rating/armor.ts:48](../../src/rating/armor.ts#L48)). How much of that counts depends on how many distinct slots of the set you own for that class ([src/rating/armor.ts:104-109](../../src/rating/armor.ts#L104-L109)), in `setValue` ([src/rating/armor.ts:54-59](../../src/rating/armor.ts#L54-L59)):

- 4+ slots: both bonuses are active; the better counts 80%, the other 20%.
- 2-3 slots: mostly the 2-piece (85%), a little of the 4-piece (15%).
- 1 slot: only potential, 40% of the better bonus.

## The verdict

Pieces are grouped by class, slot, archetype and tertiary stat; each exotic forms its own group ([src/rating/armor.ts:165-168](../../src/rating/armor.ts#L165-L168)). Legacy armor (no archetype, from before Armor 3.0, [src/vault/decode.ts:182](../../src/vault/decode.ts#L182)) is judged separately. In order ([src/rating/armor.ts:176-226](../../src/rating/armor.ts#L176-L226)):

1. **Protected**: equipped, on your protect list, or tagged Favorite or Keep in DIM ([src/rating/armor.ts:189-193](../../src/rating/armor.ts#L189-L193)).
2. **Exotics**: the best copy is kept; extra copies are marked *review* ([src/rating/armor.ts:194-202](../../src/rating/armor.ts#L194-L202)).
3. **Legacy armor** follows your `legacyArmor` setting, compared with the best new piece for that class and slot ([src/rating/armor.ts:203-210](../../src/rating/armor.ts#L203-L210)).
4. **Best of its group** is kept ([src/rating/armor.ts:215-216](../../src/rating/armor.ts#L215-L216)).
5. **Set pieces**: the best piece per slot of a set worth running (2+ slots owned and a set value of 50 or more) is kept even when it isn't the best of its group ([src/rating/armor.ts:213-219](../../src/rating/armor.ts#L213-L219)).
6. **Beyond your copies per archetype**: shard ([src/rating/armor.ts:220-221](../../src/rating/armor.ts#L220-L221)). Anything else is a *backup*.

Armor uses the global strictness, not per-weapon-type overrides ([src/rating/armor.ts:97](../../src/rating/armor.ts#L97)).

The report also gets the best keeper per class and slot, overall and per archetype ([src/rating/armor.ts:228-233](../../src/rating/armor.ts#L228-L233)), and how many pieces of each set each class owns ([src/rating/armor.ts:101-102](../../src/rating/armor.ts#L101-L102)).
