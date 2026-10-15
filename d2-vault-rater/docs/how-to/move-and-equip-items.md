# Move and equip items

Moving works in the local app's report page (`npm run vault:serve`), the web app, and through the MCP server. A plain report file opened from disk can't move anything: the move controls only appear when the page is served by the app ([report-template/site.html:2274-2275](../../report-template/site.html#L2274-L2275), [src/cli.ts:178](../../src/cli.ts#L178), [web/src/main.ts:221](../../web/src/main.ts#L221)).

## Move one item from its drawer

1. Open any weapon or armor piece (from a card, a list row or a Vault tab tile).
2. Under **Move**, press **Pull to Hunter / Titan / Warlock**, or **Send to vault**. Armor only offers characters of its class ([report-template/site.html:2274-2280](../../report-template/site.html#L2274-L2280)).
3. Tick **Equip it after pulling** to equip it on arrival.

The page shows "N of M done" and any error under the buttons ([report-template/site.html:2252-2272](../../report-template/site.html#L2252-L2272)).

## Drag weapons in the Vault tab

In the Vault tab's **Vault** mode, drag a weapon onto another character's column or onto the vault to move it, or onto a character's big equipped slot to equip it there. A message in the bottom corner turns green when the move is done or red with the reason ([report-template/site.html:1748-1775](../../report-template/site.html#L1748-L1775)). Equipped weapons can't be dragged. Layout and filters: [The report page](../reference/report-page.md#vault-tab).

## Pull a whole loadout

- **Encounter loadouts**: on the R&Ds tab, each encounter's loadout has **Pull and equip this loadout on** buttons, one per character ([report-template/site.html:1515-1518](../../report-template/site.html#L1515-L1518)). How the loadout is picked: [Raids, dungeons and encounter loadouts](../explanation/raids-dungeons-encounters.md#encounter-loadouts).
- **DIM loadouts**: with **Read DIM loadouts** on in Settings, an item's drawer lists the DIM loadouts it is in; pressing one pulls every item in that loadout to its character ([report-template/site.html:2291-2293](../../report-template/site.html#L2291-L2293)).
- **Builds** (web app): the Builds tab's **Equip** shows a dry run of every step first; see [The Builds tab](../explanation/builds-tab.md#equipping).

## From an AI client

Ask it to move something; it calls `move_items` with up to 20 instance ids, a destination (`vault`, a class name or a character id) and optionally `equip: true` ([src/server.ts:335-350](../../src/server.ts#L335-L350)). The tool tells the AI to move items only when you ask ([src/server.ts:338](../../src/server.ts#L338)).

## What happens, and why a move can fail

Every move goes character → vault → character with Bungie's [TransferItem](https://bungie-net.github.io/multi/operation_post_Destiny2-TransferItem.html) action, then [EquipItems](https://bungie-net.github.io/multi/operation_post_Destiny2-EquipItems.html) if you asked to equip ([src/bungie/transfer.ts:66-97](../../src/bungie/transfer.ts#L66-L97)). Both need the **Move or equip your gear** scope on your Bungie app.

| Message | Cause | Fix |
| --- | --- | --- |
| Equipped on your … | Bungie won't move an equipped item ([src/bungie/transfer.ts:67](../../src/bungie/transfer.ts#L67)). | Equip something else in that slot first. |
| … armor can't go to your … | Armor for another class ([src/bungie/transfer.ts:64-65](../../src/bungie/transfer.ts#L64-L65)). | Pick a character of that class. |
| No room there | The character's slot or the vault is full. | Make space and try again. |
| Bungie won't allow that right now | Some actions are blocked mid-activity. | Try from orbit or the Tower. |
| Moved, but Bungie wouldn't equip it | Usually a second exotic, or the wrong class. | Unequip the other exotic. |

The friendly messages come from [src/bungie/transfer.ts:24-31](../../src/bungie/transfer.ts#L24-L31) and [src/bungie/transfer.ts:108](../../src/bungie/transfer.ts#L108). If the item isn't where the rater last saw it, re-rate (or press **Refresh** in the web app's Vault tab) and try again.
