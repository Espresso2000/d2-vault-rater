# How weapons are rated

Every weapon gets a score out of 100 and a verdict: keep, shard, or review. The score answers "how good is this copy?"; the verdict also looks at the rest of your vault and at your strictness settings. All of it happens in `rateWeapons` ([src/rating/weapons.ts:145](../../src/rating/weapons.ts#L145)).

## The score

The score is 60% the weapon and 40% its roll ([src/rating/weapons.ts:18-19](../../src/rating/weapons.ts#L18-L19), applied at [src/rating/weapons.ts:183](../../src/rating/weapons.ts#L183)).

**Weapon score.** Aegis's tier sets the base: S 100, A 85, B 70, C 50, D 30 ([src/rating/weapons.ts:8](../../src/rating/weapons.ts#L8)). Within a tier, a higher rank on its sheet tab adds up to 5 points ([src/rating/weapons.ts:165](../../src/rating/weapons.ts#L165)); the position in the tier comes from sorting each tab's tier by rank ([src/rating/weapons.ts:80-83](../../src/rating/weapons.ts#L80-L83)).

A weapon is matched to Aegis's sheet by item hash first, then by name without the Adept/Timelost/Harrowed suffix ([src/rating/weapons.ts:85-86](../../src/rating/weapons.ts#L85-L86)). When reissues share a name, the better-tiered row wins ([src/rating/weapons.ts:75-78](../../src/rating/weapons.ts#L75-L78)).

Weapons that aren't on the sheet fall back to the community wishlist: B tier if your copy fits a known god roll, C otherwise ([src/rating/weapons.ts:163](../../src/rating/weapons.ts#L163)). A roll "fits" when every perk the wishlist entry names is among your copy's selectable perks ([src/rating/weapons.ts:158-162](../../src/rating/weapons.ts#L158-L162)).

**Roll score.** Each perk column Aegis recommends for counts by weight: both trait columns 35%, barrel and magazine 10% each, origin and masterwork 5% each ([src/rating/weapons.ts:10-17](../../src/rating/weapons.ts#L10-L17)). `scoreRoll` ([src/rating/weapons.ts:112](../../src/rating/weapons.ts#L112)) works through them:

- A column matches when *any* option you can select there is on Aegis's list, not just the one slotted in ([src/rating/weapons.ts:132](../../src/rating/weapons.ts#L132)). Tier 3+ weapons with several options per column benefit.
- An enhanced match is worth 10% more ([src/rating/weapons.ts:135-136](../../src/rating/weapons.ts#L135-L136)).
- If Aegis recommends nothing for a column, or the weapon has no such column, it counts in full: nothing to miss ([src/rating/weapons.ts:128-130](../../src/rating/weapons.ts#L128-L130)).
- The masterwork scores half when the weapon has none yet ([src/rating/weapons.ts:118-125](../../src/rating/weapons.ts#L118-L125)).
- Matching both trait columns adds 10 ([src/rating/weapons.ts:139](../../src/rating/weapons.ts#L139)). The result is capped at 100.
- Weapons Aegis doesn't rate get a neutral roll score: 100 for exotics, 50 otherwise ([src/rating/weapons.ts:114](../../src/rating/weapons.ts#L114)).

## The verdict

Verdicts are decided in a fixed order; the first rule that applies wins ([src/rating/weapons.ts:243-316](../../src/rating/weapons.ts#L243-L316)). Each rule appends a plain-English reason to the weapon's `reasons`.

1. **Extra exotic copies** are marked *review*, never shard: a person should check the roll ([src/rating/weapons.ts:261-267](../../src/rating/weapons.ts#L261-L267)).
2. **Protected** items are kept ([src/rating/weapons.ts:268-272](../../src/rating/weapons.ts#L268-L272)). An item is protected when it is equipped, an Adept/Timelost copy, on your protect list, tagged Favorite or Keep in DIM, or your only weapon for its slot and element ([src/rating/weapons.ts:201-209](../../src/rating/weapons.ts#L201-L209)).
3. **Duplicates.** Copies of the same weapon are compared best first, with protected copies always kept ([src/rating/weapons.ts:215-237](../../src/rating/weapons.ts#L215-L237)). A second copy survives only if your strictness allows another copy, it has a different matched trait pair, and its roll score clears your floor ([src/rating/weapons.ts:229-233](../../src/rating/weapons.ts#L229-L233)). The rest are shard as *duplicate*.
4. **Trash rolls** that match a community trash roll and score under 50 are shard ([src/rating/weapons.ts:277-280](../../src/rating/weapons.ts#L277-L280)).
5. **Unrated** legendaries follow your `unrated` setting: keep, keep and flag, shard unless it is a god roll or the best of its type, frame and element, or shard unless it is a god roll ([src/rating/weapons.ts:281-295](../../src/rating/weapons.ts#L281-L295)).
6. **Below your tier floor** without a strong roll: shard as *d-tier* or *low-tier* ([src/rating/weapons.ts:296-299](../../src/rating/weapons.ts#L296-L299)).
7. **Archetype rank.** Weapons are grouped by type, frame and element ([src/rating/weapons.ts:240](../../src/rating/weapons.ts#L240)). Beyond your copies-per-archetype, or far enough below the group's best, they are shard as *outscored*; otherwise they are a *backup* ([src/rating/weapons.ts:300-313](../../src/rating/weapons.ts#L300-L313)).
8. Anything left is the **best** of its archetype ([src/rating/weapons.ts:314-315](../../src/rating/weapons.ts#L314-L315)).

Which values the rules use comes from your strictness for that weapon type ([src/rating/weapons.ts:244](../../src/rating/weapons.ts#L244)); see [Settings](../reference/settings.md).

## What else the report gets

- Best three keepers per slot and per element, and the best per archetype ([src/rating/weapons.ts:318-340](../../src/rating/weapons.ts#L318-L340)).
- **Gaps**: up to 15 S-tier weapons on Aegis's sheet you don't own, best ranked first ([src/rating/weapons.ts:328-334](../../src/rating/weapons.ts#L328-L334)).
- The count of legendaries missing from the sheet ([src/rating/weapons.ts:344](../../src/rating/weapons.ts#L344)).

Ratings come back sorted by score, then by gear tier ([src/rating/weapons.ts:196](../../src/rating/weapons.ts#L196)).
