# How weapons are rated

Every weapon gets a score out of 100 and a verdict: keep, shard, or review. The score answers "how good is this copy?"; the verdict also looks at the rest of your vault and at your strictness settings. All of it happens in `rateWeapons` ([src/rating/weapons.ts:137](../../src/rating/weapons.ts#L137)).

## The score

The score is 60% the weapon and 40% its roll ([src/rating/weapons.ts:18-19](../../src/rating/weapons.ts#L18-L19), applied at [src/rating/weapons.ts:175](../../src/rating/weapons.ts#L175)).

**Weapon score.** Aegis's tier sets the base: S 100, A 85, B 70, C 50, D 30 ([src/rating/weapons.ts:8](../../src/rating/weapons.ts#L8)). Within a tier, a higher rank on its sheet tab adds up to 5 points ([src/rating/weapons.ts:157](../../src/rating/weapons.ts#L157)); the position in the tier comes from sorting each tab's tier by rank ([src/rating/weapons.ts:80-83](../../src/rating/weapons.ts#L80-L83)).

A weapon is matched to Aegis's sheet by item hash first, then by name without the Adept/Timelost/Harrowed suffix ([src/rating/weapons.ts:85-86](../../src/rating/weapons.ts#L85-L86)). When reissues share a name, the better-tiered row wins ([src/rating/weapons.ts:75-78](../../src/rating/weapons.ts#L75-L78)).

Weapons that aren't on the sheet fall back to the community wishlist: B tier if your copy fits a known god roll, C otherwise ([src/rating/weapons.ts:155](../../src/rating/weapons.ts#L155)). A roll "fits" when every perk the wishlist entry names is among your copy's selectable perks ([src/rating/weapons.ts:150-154](../../src/rating/weapons.ts#L150-L154)).

**Roll score.** Each perk column Aegis recommends for counts by weight: both trait columns 35%, barrel and magazine 10% each, origin and masterwork 5% each ([src/rating/weapons.ts:10-17](../../src/rating/weapons.ts#L10-L17)). `scoreRoll` ([src/rating/weapons.ts:104](../../src/rating/weapons.ts#L104)) works through them:

- A column matches when *any* option you can select there is on Aegis's list, not just the one slotted in ([src/rating/weapons.ts:124](../../src/rating/weapons.ts#L124)). Tier 3+ weapons with several options per column benefit.
- An enhanced match is worth 10% more ([src/rating/weapons.ts:127-128](../../src/rating/weapons.ts#L127-L128)).
- If Aegis recommends nothing for a column, or the weapon has no such column, it counts in full: nothing to miss ([src/rating/weapons.ts:120-122](../../src/rating/weapons.ts#L120-L122)).
- The masterwork scores half when the weapon has none yet ([src/rating/weapons.ts:110-117](../../src/rating/weapons.ts#L110-L117)).
- Matching both trait columns adds 10 ([src/rating/weapons.ts:131](../../src/rating/weapons.ts#L131)). The result is capped at 100.
- Weapons Aegis doesn't rate get a neutral roll score: 100 for exotics, 50 otherwise ([src/rating/weapons.ts:106](../../src/rating/weapons.ts#L106)).

## The verdict

Verdicts are decided in a fixed order; the first rule that applies wins ([src/rating/weapons.ts:235-308](../../src/rating/weapons.ts#L235-L308)). Each rule appends a plain-English reason to the weapon's `reasons`.

1. **Extra exotic copies** are marked *review*, never shard: a person should check the roll ([src/rating/weapons.ts:253-259](../../src/rating/weapons.ts#L253-L259)).
2. **Protected** items are kept ([src/rating/weapons.ts:260-264](../../src/rating/weapons.ts#L260-L264)). An item is protected when it is equipped, an Adept/Timelost copy, on your protect list, tagged Favorite or Keep in DIM, or your only weapon for its slot and element ([src/rating/weapons.ts:193-201](../../src/rating/weapons.ts#L193-L201)).
3. **Duplicates.** Copies of the same weapon are compared best first, with protected copies always kept ([src/rating/weapons.ts:207-229](../../src/rating/weapons.ts#L207-L229)). A second copy survives only if your strictness allows another copy, it has a different matched trait pair, and its roll score clears your floor ([src/rating/weapons.ts:221-225](../../src/rating/weapons.ts#L221-L225)). The rest are shard as *duplicate*.
4. **Trash rolls** that match a community trash roll and score under 50 are shard ([src/rating/weapons.ts:269-272](../../src/rating/weapons.ts#L269-L272)).
5. **Unrated** legendaries follow your `unrated` setting: keep, keep and flag, keep only the best of its kind unless it is a god roll, or shard unless it is a god roll ([src/rating/weapons.ts:273-287](../../src/rating/weapons.ts#L273-L287)).
6. **Below your tier floor** without a strong roll: shard as *d-tier* or *low-tier* ([src/rating/weapons.ts:288-291](../../src/rating/weapons.ts#L288-L291)).
7. **Archetype rank.** Weapons are grouped by type, frame and element ([src/rating/weapons.ts:232](../../src/rating/weapons.ts#L232)). Beyond your copies-per-archetype, or far enough below the group's best, they are shard as *outscored*; otherwise they are a *backup* ([src/rating/weapons.ts:292-305](../../src/rating/weapons.ts#L292-L305)).
8. Anything left is the **best** of its archetype ([src/rating/weapons.ts:306-307](../../src/rating/weapons.ts#L306-L307)).

Which values the rules use comes from your strictness for that weapon type ([src/rating/weapons.ts:236](../../src/rating/weapons.ts#L236)); see [Settings](../reference/settings.md).

## What else the report gets

- Best three keepers per slot and per element, and the best per archetype ([src/rating/weapons.ts:310-332](../../src/rating/weapons.ts#L310-L332)).
- **Gaps**: up to 15 S-tier weapons on Aegis's sheet you don't own, best ranked first ([src/rating/weapons.ts:320-326](../../src/rating/weapons.ts#L320-L326)).
- The count of legendaries missing from the sheet ([src/rating/weapons.ts:336](../../src/rating/weapons.ts#L336)).

Ratings come back sorted by score, then by gear tier ([src/rating/weapons.ts:188](../../src/rating/weapons.ts#L188)).
