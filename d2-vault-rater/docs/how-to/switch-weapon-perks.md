# Preview and switch a weapon's perks

The weapon drawer lets you look at any perk a weapon can roll in each column and, in the local app or web app, switch the weapon to it in game. This works for perks the weapon can already select (multi-option columns on crafted, enhanced or Tier 3+ weapons); it can't add perks the weapon doesn't have.

## Preview a perk

1. Open a weapon (from a card, a list row or a Vault tab tile). Each perk column lists every option, with the equipped one ringed ([report-template/site.html:2325](../../report-template/site.html#L2325)).
2. Click another option. Its symbol, name and description replace the column's card, and the option gets a dashed gold ring; the equipped one keeps its solid ring ([report-template/site.html:2333-2345](../../report-template/site.html#L2333-L2345), [report-template/site.html:809-812](../../report-template/site.html#L809-L812)).

Previewing changes nothing, and works in a report opened from disk too.

## Switch to it in game

In a served page (local app or web app), a previewed perk gets an **Apply** button under its card ([report-template/site.html:2342-2345](../../report-template/site.html#L2342-L2345)).

1. Be in orbit, a social space such as the Tower, or offline. Bungie refuses perk changes mid-activity.
2. Press **Apply**. The page sends `POST /api/perk` with the weapon id, the column's socket index and the perk name ([report-template/site.html:2346-2361](../../report-template/site.html#L2346-L2361)).
3. On success the drawer and every list show the new perk and "Switched to … in game" ([report-template/site.html:2353-2358](../../report-template/site.html#L2353-L2358)).

Behind it, `insertPerk` checks the perk is one of that column's own options, looks up its plug hash, and calls Bungie's [InsertSocketPlugFree](https://bungie-net.github.io/multi/operation_post_Destiny2-InsertSocketPlugFree.html) action ([src/bungie/transfer.ts:118-145](../../src/bungie/transfer.ts#L118-L145)). It needs the **Move or equip your gear** scope the app already asks for. A weapon in the vault still needs a character id for the call, so the first character is used ([src/bungie/transfer.ts:129](../../src/bungie/transfer.ts#L129)). If the perk is already equipped, nothing is sent ([src/bungie/transfer.ts:137](../../src/bungie/transfer.ts#L137)). The local server and the web app answer the route the same way ([src/cli.ts:120-130](../../src/cli.ts#L120-L130), [web/src/main.ts:246-249](../../web/src/main.ts#L246-L249)).

The column's socket index and the plug hash per option are recorded when the vault is read ([src/vault/decode.ts:128-129](../../src/vault/decode.ts#L128-L129), [src/vault/types.ts:19-21](../../src/vault/types.ts#L19-L21)). Reports made before that have no socket index, so they show the preview without **Apply** ([report-template/site.html:2343](../../report-template/site.html#L2343)).

## If it fails

| Message | Cause |
| --- | --- |
| … isn't a perk you can select on this … | The option isn't in the weapon's column any more; re-rate ([src/bungie/transfer.ts:128](../../src/bungie/transfer.ts#L128)). |
| Bungie won't allow that right now | You're in an activity; go to orbit or the Tower ([src/bungie/transfer.ts:28](../../src/bungie/transfer.ts#L28)). |
| Bungie won't switch to that perk from outside the game | The perk isn't unlocked or isn't free to change from the API ([src/bungie/transfer.ts:29](../../src/bungie/transfer.ts#L29)). |

There is no MCP tool for switching perks; it is only in the report page. Why there is no dry run here: [Safety](../explanation/safety.md#perk-switches).
