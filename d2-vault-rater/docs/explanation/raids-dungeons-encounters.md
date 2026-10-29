# Raids, dungeons and encounter loadouts (the R&Ds tab)

The R&Ds tab answers two questions: which raid or dungeon is most worth farming for *your* vault, and which three weapons you already own suit each encounter.

## Where the loot list comes from

The activities are a fixed list of every raid and dungeon in the game, each with the names Bungie and Aegis use for it ([src/sources/activities.ts:16-37](../../src/sources/activities.ts#L16-L37)). `importActivityLoot` ([src/sources/activities.ts:98](../../src/sources/activities.ts#L98)) builds each activity's loot from three places:

1. **Bungie's collections**: every collectible whose "Source:" text names the activity, leaving out Eververse, promotional and Guided Games sources ([src/sources/activities.ts:95-96](../../src/sources/activities.ts#L95-L96), [src/sources/activities.ts:117-138](../../src/sources/activities.ts#L117-L138)). Armor in those collectibles gives the activity's armor sets.
2. **Aegis's sheet**: weapons whose source column names the activity ([src/sources/activities.ts:139-158](../../src/sources/activities.ts#L139-L158)).
3. **Exotic quests** that collections credit to the quest rather than the activity, such as Xenophage in Pit of Heresy ([src/sources/activities.ts:41-46](../../src/sources/activities.ts#L41-L46), [src/sources/activities.ts:159](../../src/sources/activities.ts#L159)).

When the two disagree, collections win: a weapon only the sheet ties to an activity is dropped if collections credit it to another one ([src/sources/activities.ts:179-182](../../src/sources/activities.ts#L179-L182)). Each activity's art is the most common loading-screen image among its versions ([src/sources/activities.ts:103-111](../../src/sources/activities.ts#L103-L111)).

The two manifest tables this needs (activities and collectibles) are downloaded and stripped once per game version, separately from the main manifest ([src/sources/activities.ts:87-93](../../src/sources/activities.ts#L87-L93)).

## Ranking activities

`rateActivities` ([src/rating/activities.ts:65](../../src/rating/activities.ts#L65)) scores each activity out of 100 as 40% loot quality, 40% need and 20% armor sets ([src/rating/activities.ts:121](../../src/rating/activities.ts#L121)):

- **Quality**: the average tier points of its three best weapons on Aegis's sheet; unrated loot counts 40 ([src/rating/activities.ts:96-100](../../src/rating/activities.ts#L96-L100), [src/rating/activities.ts:11](../../src/rating/activities.ts#L11)).
- **Need**: of its S, A and B tier weapons, how many you still *chase* (own none), or could *upgrade* (own only weak rolls, which count half) ([src/rating/activities.ts:101-104](../../src/rating/activities.ts#L101-L104)). A copy with a roll score of 70+ or a god roll counts as *have* ([src/rating/activities.ts:12-13](../../src/rating/activities.ts#L12-L13), [src/rating/activities.ts:93](../../src/rating/activities.ts#L93)).
- **Sets**: the best bonus tier among its armor sets, worth less the more slots of that set you already own ([src/rating/activities.ts:106-120](../../src/rating/activities.ts#L106-L120)).

70+ reads "Farm it", 50+ "Worth a run", anything lower "Low priority" ([src/rating/activities.ts:129](../../src/rating/activities.ts#L129)). Raids and dungeons are ranked separately ([src/rating/activities.ts:143-145](../../src/rating/activities.ts#L143-L145)).

## Your clears

Each card shows how many times you've finished the activity and how long you've spent in it. Every version of an activity (normal, master, legacy) keeps its hashes from the manifest ([src/sources/activities.ts:103-110](../../src/sources/activities.ts#L103-L110)), and the account stats read Bungie's per-activity stats for each character ([src/vault/wrapped.ts:87](../../src/vault/wrapped.ts#L87), [src/vault/wrapped.ts:90-100](../../src/vault/wrapped.ts#L90-L100)); `rateActivities` adds them up per activity ([src/rating/activities.ts:55-58](../../src/rating/activities.ts#L55-L58)). Bungie counts a finished checkpoint run as a clear, and characters you deleted aren't included, so the totals can be lower than the account-wide raid count on the Wrapped tab. The tab can be ordered by clears instead of farm score, and Wrapped lists your five most-run activities.

## Encounter loadouts

Each raid and dungeon encounter is described in [src/data/encounters.json](../../src/data/encounters.json), a data file you can audit without reading code. Every entry says what the encounter demands, the roles it needs in priority order, and the facts that steer the picks: elemental shields you have to break, champions, the distance most fights happen at, how the damage phase plays (a short burst or a long phase, and whether the boss moves), the weapon types guides favour and the weapons they name. Each entry lists the guide pages its facts were checked against (at least two), a confidence, and notes on where guides disagreed. Shields and champions are normal difficulty only; master-only ones are in the notes. The fields are typed in [src/data/encounters.ts:13-42](../../src/data/encounters.ts#L13-L42). Roles map to weapon types with a fit from 0 to 1 ([src/data/encounters.ts:56](../../src/data/encounters.ts#L56)), and each role has its own list of final-sandbox meta weapons ([src/data/encounters.ts:68](../../src/data/encounters.ts#L68)).

`planEncounter` ([src/rating/encounters.ts:88](../../src/rating/encounters.ts#L88)) picks the best three-weapon loadout from your rated vault:

- **Candidates per role**: your weapons scored by vault score times role fit, plus bonuses; the top eight per role are kept ([src/rating/encounters.ts:44-86](../../src/rating/encounters.ts#L44-L86)). Special-ammo grenade launchers don't count for boss damage.
  - **Guide picks**: +30 when guides name the weapon for this encounter, +6 when it's a final-sandbox pick for the role ([src/rating/encounters.ts:26-27](../../src/rating/encounters.ts#L26-L27)).
  - **Favoured types**: +18, +12, +7 or +3 for the weapon types guides favour for the fight, in their order ([src/rating/encounters.ts:31](../../src/rating/encounters.ts#L31)).
  - **Shields**: add clear, range and precision weapons whose element breaks the encounter's shields get +14 when those shields are common, +8 when you meet some, +3 when rare ([src/rating/encounters.ts:29](../../src/rating/encounters.ts#L29)).
  - **Range**: the same roles' fit scales with the encounter's distance, so SMGs and shotguns rise in close fights and scouts and snipers in long ones ([src/rating/encounters.ts:34-39](../../src/rating/encounters.ts#L34-L39)).
  - **Moving bosses**: swords, glaives and fusion rifles count for less when the boss moves during damage ([src/rating/encounters.ts:41](../../src/rating/encounters.ts#L41)).
- **Why it was picked**: each pick carries its strongest reason (guide pick, the shield element, "Suits this fight", or the range), shown next to its role.
- **Roles nobody can fill** (often Support) fall back to add clear, precision, sustained damage or range ([src/rating/encounters.ts:24](../../src/rating/encounters.ts#L24), [src/rating/encounters.ts:93-97](../../src/rating/encounters.ts#L93-L97)).
- **Combination search**: every pick is tried with one weapon per slot, no weapon twice and at most one exotic; the first role weighs 1, the second 0.8, the third 0.6 ([src/rating/encounters.ts:23](../../src/rating/encounters.ts#L23), [src/rating/encounters.ts:99-117](../../src/rating/encounters.ts#L99-L117)). A role left empty because its weapons share a slot with a better pick (a sword and a rocket both need Power) gives its place to a fallback role that fits a free slot ([src/rating/encounters.ts:118-131](../../src/rating/encounters.ts#L118-L131)).
- **Worth getting**: up to four meta picks for the encounter or its main role that you don't own ([src/rating/encounters.ts:136](../../src/rating/encounters.ts#L136)).

On the R&Ds tab, showing or hiding one card's encounter guide does the same for every card on its row, so the row stays level.
