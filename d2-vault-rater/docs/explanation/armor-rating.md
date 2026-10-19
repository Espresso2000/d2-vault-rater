# How armor is rated

Armor 3.0 pieces have an archetype (which fixes the primary and secondary stat), a tertiary stat, a gear tier and often a set bonus. `rateArmor` ([src/rating/armor.ts:97](../../src/rating/armor.ts#L97)) scores each piece out of 100 and then decides what to keep.

## The score

Four parts, weighted 40 / 25 / 25 / 10 ([src/rating/armor.ts:45-46](../../src/rating/armor.ts#L45-L46)), computed at [src/rating/armor.ts:127-163](../../src/rating/armor.ts#L127-L163):

- **Stats (40).** The piece's three highest stats against the best possible Tier 5 roll, 30 + 25 + 20 = 75 ([src/rating/armor.ts:7-8](../../src/rating/armor.ts#L7-L8), [src/rating/armor.ts:131](../../src/rating/armor.ts#L131)).
- **Build fit (25).** How well those top three stats match the stats your builds want, weighting the primary most (0.5 / 0.3 / 0.2) ([src/rating/armor.ts:132-136](../../src/rating/armor.ts#L132-L136)). With no wanted stats known, every piece gets half.
- **Set bonus (25).** How strong the piece's set is for you ([src/rating/armor.ts:138](../../src/rating/armor.ts#L138)). Exotics have no set and get a neutral 60% of this part ([src/rating/armor.ts:47-48](../../src/rating/armor.ts#L47-L48)).
- **Extras (10).** 10 for exotics and Tier 5, 5 for Tier 4 ([src/rating/armor.ts:139](../../src/rating/armor.ts#L139)).

**Wanted stats** come from your settings when you set them; otherwise they are the two highest stat totals across the armor each class has equipped ([src/rating/armor.ts:77-95](../../src/rating/armor.ts#L77-L95)).

**Set value.** [Aegis's sheet](https://docs.google.com/spreadsheets/d/1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY/htmlview) rates each set's 2-piece and 4-piece bonus by tier (S 100 down to F 10, [src/sources/armorSets.ts:13](../../src/sources/armorSets.ts#L13)); unrated bonuses count 40 ([src/rating/armor.ts:49](../../src/rating/armor.ts#L49)). How much of that counts depends on how many distinct slots of the set you own for that class ([src/rating/armor.ts:105-110](../../src/rating/armor.ts#L105-L110)), in `setValue` ([src/rating/armor.ts:55-60](../../src/rating/armor.ts#L55-L60)):

- 4+ slots: both bonuses are active; the better counts 80%, the other 20%.
- 2-3 slots: mostly the 2-piece (85%), a little of the 4-piece (15%).
- 1 slot: only potential, 40% of the better bonus.

## The verdict

Pieces are grouped by class, slot, archetype and tertiary stat; each exotic forms its own group ([src/rating/armor.ts:167-170](../../src/rating/armor.ts#L167-L170)). Legacy armor (no archetype, from before Armor 3.0, [src/vault/decode.ts:239](../../src/vault/decode.ts#L239)) is judged separately. In order ([src/rating/armor.ts:178-228](../../src/rating/armor.ts#L178-L228)):

1. **Protected**: equipped, on your protect list, or tagged Favorite or Keep in DIM ([src/rating/armor.ts:191-195](../../src/rating/armor.ts#L191-L195)).
2. **Exotics**: the best copy is kept; extra copies are marked *review* ([src/rating/armor.ts:196-204](../../src/rating/armor.ts#L196-L204)).
3. **Legacy armor** follows your `legacyArmor` setting, compared with the best new piece for that class and slot ([src/rating/armor.ts:205-212](../../src/rating/armor.ts#L205-L212)).
4. **Best of its group** is kept ([src/rating/armor.ts:217-218](../../src/rating/armor.ts#L217-L218)).
5. **Set pieces**: the best piece per slot of a set worth running (2+ slots owned and a set value of 50 or more) is kept even when it isn't the best of its group ([src/rating/armor.ts:215-221](../../src/rating/armor.ts#L215-L221)).
6. **Beyond your copies per archetype**: shard ([src/rating/armor.ts:222-223](../../src/rating/armor.ts#L222-L223)). Anything else is a *backup*.

Armor uses the global strictness, not per-weapon-type overrides ([src/rating/armor.ts:98](../../src/rating/armor.ts#L98)).

The report also gets the best keeper per class and slot, overall and per archetype ([src/rating/armor.ts:230-235](../../src/rating/armor.ts#L230-L235)), and how many pieces of each set each class owns ([src/rating/armor.ts:102-103](../../src/rating/armor.ts#L102-L103)).
