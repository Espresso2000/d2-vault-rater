# Switch a weapon's perks and mods

The item details panel shows a weapon's perks the way the game does and, in the local app or web app, switches the weapon to another perk or mod in game. It works for perks the weapon can already select (multi-option columns on crafted, enhanced or Tier 3+ weapons) and for weapon mods you have unlocked; it can't add perks the weapon doesn't roll.

## Preview a perk

1. Open a weapon (from a card, a list row or a Vault tab tile). Under **Perks**, each perk slot is a column of round sockets: the equipped one is ringed, Aegis's picks are green, enhanced perks are marked ([report-template/site.html:3002-3020](../../report-template/site.html#L3002-L3020)).
2. Hover or focus a socket for a card with its name, column and description ([report-template/site.html:3040-3053](../../report-template/site.html#L3040-L3053)).
3. Click a socket to pin its card under the grid and compare it with the equipped perk; click it again to close the card ([report-template/site.html:3061-3074](../../report-template/site.html#L3061-L3074)).

Previewing changes nothing, and works in a report opened from disk too.

## Switch to it in game

In a served page (local app or web app), the card of a perk that isn't equipped has an **Apply** button ([report-template/site.html:3070-3072](../../report-template/site.html#L3070-L3072)).

1. Be in orbit, a social space such as the Tower, or offline. Bungie refuses these changes mid-activity.
2. Press **Apply**. The page sends `POST /api/perk` with the weapon id, the column's socket index and the perk name ([report-template/site.html:3075-3093](../../report-template/site.html#L3075-L3093)).
3. On success the panel and every list show the new perk and "Switched to … in game".

Behind it, `insertPerk` checks the perk is one of that column's own options, looks up its plug hash, and calls Bungie's [InsertSocketPlugFree](https://bungie-net.github.io/multi/operation_post_Destiny2-InsertSocketPlugFree.html) action ([src/bungie/transfer.ts:131-157](../../src/bungie/transfer.ts#L131-L157)). It needs the **Move or equip your gear** scope the app already asks for. A weapon in the vault still needs a character id for the call, so the first character is used ([src/bungie/transfer.ts:142](../../src/bungie/transfer.ts#L142)). If the perk is already equipped, nothing is sent ([src/bungie/transfer.ts:150](../../src/bungie/transfer.ts#L150)). The local server and the web app answer the route the same way ([src/cli.ts:120-130](../../src/cli.ts#L120-L130), [web/src/main.ts:263-266](../../web/src/main.ts#L263-L266)).

The column's socket index and the plug hash per option are recorded when the vault is read ([src/vault/types.ts:19-21](../../src/vault/types.ts#L19-L21)). Reports made before that have no socket index, so they show the preview without **Apply**.

## Switch a weapon mod

Beside the perk columns sit the masterwork and the weapon mod socket ([report-template/site.html:3017-3018](../../report-template/site.html#L3017-L3018)).

1. Tap the mod socket. A picker lists every weapon mod that fits it and that you have unlocked, plus the empty socket ([report-template/site.html:3094-3110](../../report-template/site.html#L3094-L3110)). The list is the copy's own when Bungie sends one, else the socket's shared plug set filtered to mods you can insert ([src/vault/decode.ts:161-169](../../src/vault/decode.ts#L161-L169)).
2. Pick one to read what it does.
3. In a served page, press **Apply**. The page sends `POST /api/mod`, and `insertMod` checks the mod is in that socket's list before calling InsertSocketPlugFree ([src/bungie/transfer.ts:159-182](../../src/bungie/transfer.ts#L159-L182), [src/cli.ts:131-141](../../src/cli.ts#L131-L141), [web/src/main.ts:267-270](../../web/src/main.ts#L267-L270)).

The panel shows the new mod at once; the weapon's stats update the next time you re-rate ([report-template/site.html:3126-3143](../../report-template/site.html#L3126-L3143)).

## If it fails

| Message | Cause |
| --- | --- |
| … isn't a perk you can select on this …, … isn't a mod you can put on this … | The option isn't in that socket any more; re-rate ([src/bungie/transfer.ts:141](../../src/bungie/transfer.ts#L141), [src/bungie/transfer.ts:165](../../src/bungie/transfer.ts#L165)). |
| Bungie won't allow that right now | You're in an activity; go to orbit or the Tower ([src/bungie/transfer.ts:31](../../src/bungie/transfer.ts#L31)). |
| Bungie won't make that switch from outside the game | The perk or mod isn't unlocked, or isn't free to change from the API ([src/bungie/transfer.ts:32](../../src/bungie/transfer.ts#L32)). |

There is no MCP tool for switching perks or mods; it is only in the report page. Why there is no dry run here: [Safety](../explanation/safety.md#perk-switches).
