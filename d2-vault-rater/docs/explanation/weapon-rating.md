# How weapons are rated

Every weapon gets a score out of 100 and a verdict: keep, shard, or review. The score answers "how good is this copy?"; the verdict also looks at the rest of your vault and at your strictness settings. All of it happens in `rateWeapons` ([src/rating/weapons.ts:141](../../src/rating/weapons.ts#L141)).

## The score

The score is 60% the weapon and 40% its roll ([src/rating/weapons.ts:18-19](../../src/rating/weapons.ts#L18-L19), applied at [src/rating/weapons.ts:179](../../src/rating/weapons.ts#L179)).

**Weapon score.** The tier on [Aegis's Endgame Analysis sheet](https://docs.google.com/spreadsheets/d/1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY/htmlview) sets the base: S 100, A 85, B 70, C 50, D 30 ([src/rating/weapons.ts:8](../../src/rating/weapons.ts#L8)). Within a tier, a higher rank on its sheet tab adds up to 5 points ([src/rating/weapons.ts:161](../../src/rating/weapons.ts#L161)); the position in the tier comes from sorting each tab's tier by rank ([src/rating/weapons.ts:80-83](../../src/rating/weapons.ts#L80-L83)).

A weapon is matched to Aegis's sheet by item hash first, then by name without the Adept/Timelost/Harrowed suffix ([src/rating/weapons.ts:85-86](../../src/rating/weapons.ts#L85-L86)). When reissues share a name, the better-tiered row wins ([src/rating/weapons.ts:75-78](../../src/rating/weapons.ts#L75-L78)).

Weapons that aren't on the sheet fall back to the community wishlist (by default [voltron](https://github.com/48klocs/dim-wish-list-sources), in [DIM's wish list format](https://github.com/DestinyItemManager/DIM/wiki/Creating-Wish-Lists)): B tier if your copy fits a known god roll, C otherwise ([src/rating/weapons.ts:159](../../src/rating/weapons.ts#L159)). A roll "fits" when every perk the wishlist entry names is among your copy's selectable perks ([src/rating/weapons.ts:154-158](../../src/rating/weapons.ts#L154-L158)).

**Roll score.** Each perk column Aegis recommends for counts by weight: both trait columns 35%, barrel and magazine 10% each, origin and masterwork 5% each ([src/rating/weapons.ts:10-17](../../src/rating/weapons.ts#L10-L17)). `scoreRoll` ([src/rating/weapons.ts:108](../../src/rating/weapons.ts#L108)) works through them:

- A column matches when *any* option you can select there is on Aegis's list, not just the one slotted in ([src/rating/weapons.ts:128](../../src/rating/weapons.ts#L128)). Tier 3+ weapons with several options per column benefit.
- An enhanced match is worth 10% more ([src/rating/weapons.ts:131-132](../../src/rating/weapons.ts#L131-L132)).
- If Aegis recommends nothing for a column, or the weapon has no such column, it counts in full: nothing to miss ([src/rating/weapons.ts:124-126](../../src/rating/weapons.ts#L124-L126)).
- The masterwork scores half when the weapon has none yet ([src/rating/weapons.ts:114-121](../../src/rating/weapons.ts#L114-L121)).
- Matching both trait columns adds 10 ([src/rating/weapons.ts:135](../../src/rating/weapons.ts#L135)). The result is capped at 100.
- Weapons Aegis doesn't rate get a neutral roll score: 100 for exotics, 50 otherwise ([src/rating/weapons.ts:110](../../src/rating/weapons.ts#L110)).

## The verdict

Verdicts are decided in a fixed order; the first rule that applies wins ([src/rating/weapons.ts:239-312](../../src/rating/weapons.ts#L239-L312)). Each rule appends a plain-English reason to the weapon's `reasons`.

1. **Extra exotic copies** are marked *review*, never shard: a person should check the roll ([src/rating/weapons.ts:257-263](../../src/rating/weapons.ts#L257-L263)).
2. **Protected** items are kept ([src/rating/weapons.ts:264-268](../../src/rating/weapons.ts#L264-L268)). An item is protected when it is equipped, an Adept/Timelost copy, on your protect list, tagged Favorite or Keep in DIM, or your only weapon for its slot and element ([src/rating/weapons.ts:197-205](../../src/rating/weapons.ts#L197-L205)).
3. **Duplicates.** Copies of the same weapon are compared best first, with protected copies always kept ([src/rating/weapons.ts:211-233](../../src/rating/weapons.ts#L211-L233)). A second copy survives only if your strictness allows another copy, it has a different matched trait pair, and its roll score clears your floor ([src/rating/weapons.ts:225-229](../../src/rating/weapons.ts#L225-L229)). The rest are shard as *duplicate*.
4. **Trash rolls** that match a community trash roll and score under 50 are shard ([src/rating/weapons.ts:273-276](../../src/rating/weapons.ts#L273-L276)).
5. **Unrated** legendaries follow your `unrated` setting: keep, keep and flag, shard unless it is a god roll or the best of its type, frame and element, or shard unless it is a god roll ([src/rating/weapons.ts:277-291](../../src/rating/weapons.ts#L277-L291)).
6. **Below your tier floor** without a strong roll: shard as *d-tier* or *low-tier* ([src/rating/weapons.ts:292-295](../../src/rating/weapons.ts#L292-L295)).
7. **Archetype rank.** Weapons are grouped by type, frame and element ([src/rating/weapons.ts:236](../../src/rating/weapons.ts#L236)). Beyond your copies-per-archetype, or far enough below the group's best, they are shard as *outscored*; otherwise they are a *backup* ([src/rating/weapons.ts:296-309](../../src/rating/weapons.ts#L296-L309)).
8. Anything left is the **best** of its archetype ([src/rating/weapons.ts:310-311](../../src/rating/weapons.ts#L310-L311)).

Which values the rules use comes from your strictness for that weapon type ([src/rating/weapons.ts:240](../../src/rating/weapons.ts#L240)); see [Settings](../reference/settings.md).

## What else the report gets

- Best three keepers per slot and per element, and the best per archetype ([src/rating/weapons.ts:314-336](../../src/rating/weapons.ts#L314-L336)).
- **Gaps**: up to 15 S-tier weapons on Aegis's sheet you don't own, best ranked first ([src/rating/weapons.ts:324-330](../../src/rating/weapons.ts#L324-L330)).
- The count of legendaries missing from the sheet ([src/rating/weapons.ts:340](../../src/rating/weapons.ts#L340)).

Perk names, icons and which options each column offers come from the item's sockets in the vault read and the manifest's plug definitions ([sources](../reference/references.md#the-destiny-manifest)).

Ratings come back sorted by score, then by gear tier ([src/rating/weapons.ts:192](../../src/rating/weapons.ts#L192)).
