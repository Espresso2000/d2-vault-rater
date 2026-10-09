# Fix tier list and source import problems

## Force a refresh

Sources refresh by themselves after a day ([src/pipeline.ts:58](../../src/pipeline.ts#L58), [web/src/sources.ts:28](../../web/src/sources.ts#L28)). To refresh now:

- CLI: `npm run vault -- refresh` ([src/cli.ts:205-207](../../src/cli.ts#L205-L207)).
- AI: `refresh_sources`; with `force_manifest: true` it also downloads the manifest again ([src/server.ts:138-158](../../src/server.ts#L138-L158)).

## A weapon on Aegis's sheet isn't recognised

Aegis rows are matched to the manifest by name, ignoring Adept-style suffixes, case and punctuation ([src/sources/aegis.ts:122-132](../../src/sources/aegis.ts#L122-L132)). Rows that match nothing are reported: `refresh_sources` returns the first 40 and the count ([src/server.ts:152](../../src/server.ts#L152)); the CLI's `refresh` prints the list ([src/pipeline.ts:45](../../src/pipeline.ts#L45)).

Map a sheet name to the game's name in `~/.d2-vault-rater/sources/aliases.json` ([src/sources/aegis.ts:36](../../src/sources/aegis.ts#L36)):

```json
{ "Name On The Sheet": "Name In Game" }
```

Then refresh. Aliases are applied on every import ([src/sources/aegis.ts:124-128](../../src/sources/aegis.ts#L124-L128)).

## No tabs found / Google changed the sheet page

The importer finds the sheet's tabs on its public page ([src/sources/aegis.ts:108-114](../../src/sources/aegis.ts#L108-L114)). If that stops working, list the tabs yourself in `settings.json`; they are added to whatever was found ([src/sources/aegis.ts:146-147](../../src/sources/aegis.ts#L146-L147)):

```json
{ "aegisTabs": [{ "name": "SMGs", "gid": "1405969509" }] }
```

The `gid` is the number after `#gid=` in the tab's URL. A tab is used only if it has a header row with Name, Tier and Perk 1 columns ([src/sources/aegis.ts:68-75](../../src/sources/aegis.ts#L68-L75)).

If an import finds no weapons at all, the previous import is kept ([src/sources/aegis.ts:163-167](../../src/sources/aegis.ts#L163-L167)). In the web app, the snapshot shipped with the site is used when nothing has been imported yet ([web/src/sources.ts:40-46](../../web/src/sources.ts#L40-L46)).

## Armor sets or raid loot are missing

Both imports are allowed to fail without stopping a report ([src/pipeline.ts:42-44](../../src/pipeline.ts#L42-L44)). Set bonus descriptions come from a second sheet; if it can't be read you get tiers without descriptions and a warning ([src/sources/armorSets.ts:107-111](../../src/sources/armorSets.ts#L107-L111)). Raid loot needs two extra manifest tables, downloaded on first use per game version ([src/sources/activities.ts:85-91](../../src/sources/activities.ts#L85-L91)).

## Use other wishlists

Set `wishlists` to a list of DIM wishlist URLs in `settings.json`; empty means the voltron list ([src/pipeline.ts:40](../../src/pipeline.ts#L40), [src/sources/wishlist.ts:4-6](../../src/sources/wishlist.ts#L4-L6)). Lines must follow DIM's `dimwishlist:item=...&perks=...` format; a negative item id marks a trash roll ([src/sources/wishlist.ts:23-42](../../src/sources/wishlist.ts#L23-L42)).
