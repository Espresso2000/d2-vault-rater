# Raids, dungeons and encounter loadouts (the R&Ds tab)

The R&Ds tab answers two questions: which raid or dungeon is most worth farming for *your* vault, and which three weapons you already own suit each encounter.

## Where the loot list comes from

The activities are a fixed list of every raid and dungeon in the game, each with the names Bungie and Aegis use for it ([src/sources/activities.ts:16-37](../../src/sources/activities.ts#L16-L37)). `importActivityLoot` ([src/sources/activities.ts:96](../../src/sources/activities.ts#L96)) builds each activity's loot from three places:

1. **Bungie's collections**: every collectible whose "Source:" text names the activity, leaving out Eververse, promotional and Guided Games sources ([src/sources/activities.ts:93-94](../../src/sources/activities.ts#L93-L94), [src/sources/activities.ts:112-133](../../src/sources/activities.ts#L112-L133)). Armor in those collectibles gives the activity's armor sets.
2. **Aegis's sheet**: weapons whose source column names the activity ([src/sources/activities.ts:134-153](../../src/sources/activities.ts#L134-L153)).
3. **Exotic quests** that collections credit to the quest rather than the activity, such as Xenophage in Pit of Heresy ([src/sources/activities.ts:41-46](../../src/sources/activities.ts#L41-L46), [src/sources/activities.ts:154](../../src/sources/activities.ts#L154)).

When the two disagree, collections win: a weapon only the sheet ties to an activity is dropped if collections credit it to another one ([src/sources/activities.ts:174-177](../../src/sources/activities.ts#L174-L177)). Each activity's art is the most common loading-screen image among its versions ([src/sources/activities.ts:101-106](../../src/sources/activities.ts#L101-L106)).

The two manifest tables this needs (activities and collectibles) are downloaded and stripped once per game version, separately from the main manifest ([src/sources/activities.ts:85-91](../../src/sources/activities.ts#L85-L91)).

## Ranking activities

`rateActivities` ([src/rating/activities.ts:57](../../src/rating/activities.ts#L57)) scores each activity out of 100 as 40% loot quality, 40% need and 20% armor sets ([src/rating/activities.ts:112](../../src/rating/activities.ts#L112)):

- **Quality**: the average tier points of its three best weapons on Aegis's sheet; unrated loot counts 40 ([src/rating/activities.ts:87-91](../../src/rating/activities.ts#L87-L91), [src/rating/activities.ts:10](../../src/rating/activities.ts#L10)).
- **Need**: of its S, A and B tier weapons, how many you still *chase* (own none), or could *upgrade* (own only weak rolls, which count half) ([src/rating/activities.ts:92-95](../../src/rating/activities.ts#L92-L95)). A copy with a roll score of 70+ or a god roll counts as *have* ([src/rating/activities.ts:11-12](../../src/rating/activities.ts#L11-L12), [src/rating/activities.ts:84](../../src/rating/activities.ts#L84)).
- **Sets**: the best bonus tier among its armor sets, worth less the more slots of that set you already own ([src/rating/activities.ts:97-111](../../src/rating/activities.ts#L97-L111)).

70+ reads "Farm it", 50+ "Worth a run", anything lower "Low priority" ([src/rating/activities.ts:120](../../src/rating/activities.ts#L120)). Raids and dungeons are ranked separately ([src/rating/activities.ts:133-135](../../src/rating/activities.ts#L133-L135)).

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
