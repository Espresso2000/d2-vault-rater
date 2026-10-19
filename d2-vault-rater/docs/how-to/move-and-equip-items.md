# Move and equip items

Moving works in the local app's report page (`npm run vault:serve`), the web app, and through the MCP server. A plain report file opened from disk can't move anything: the move controls only appear when the page is served by the app ([report-template/site.html:2869-2870](../../report-template/site.html#L2869-L2870), [src/cli.ts:189](../../src/cli.ts#L189), [web/src/main.ts:236](../../web/src/main.ts#L236)).

## Move one item from its details panel

1. Open any weapon or armor piece (from a card, a list row or a Vault tab tile): its details panel has a **Move** box under **Actions**.
2. Under **Move**, press **Pull to Hunter / Titan / Warlock**, or **Send to vault**. Armor only offers characters of its class ([report-template/site.html:2869-2875](../../report-template/site.html#L2869-L2875)).
3. Tick **Equip it after pulling** to equip it on arrival.

The page shows "N of M done" and any error under the buttons ([report-template/site.html:2847-2867](../../report-template/site.html#L2847-L2867)).

## Drag items in the Vault tab

In the Vault tab's **Vault** mode, drag a weapon or armor piece onto another character's column or onto the vault to move it, or onto a character's big equipped slot to equip it there. Armor only drops on characters of its class. Equipped items, and weapons hidden by your filters, can't be dragged. A message in the bottom corner turns green when the move is done or red with the reason ([report-template/site.html:2212-2240](../../report-template/site.html#L2212-L2240)). Layout and filters: [The report page](../reference/report-page.md#vault-tab).

## Get items out of the postmaster

Open the Vault tab's **Postmaster** section and drag an item from a character's Lost Items to where you want it. It is first pulled into that character's inventory with Bungie's [PullFromPostmaster](https://bungie-net.github.io/multi/operation_post_Destiny2-PullFromPostmaster.html) action, then moved like any other item ([src/bungie/transfer.ts:70-78](../../src/bungie/transfer.ts#L70-L78), [report-template/site.html:2164-2168](../../report-template/site.html#L2164-L2168)). Postmaster items don't count as carried by the character ([src/vault/decode.ts:96-99](../../src/vault/decode.ts#L96-L99)).

## Pull a whole loadout

- **Encounter loadouts**: on the R&Ds tab, each encounter's loadout has **Pull and equip this loadout on** buttons, one per character ([report-template/site.html:1868-1883](../../report-template/site.html#L1868-L1883)). How the loadout is picked: [Raids, dungeons and encounter loadouts](../explanation/raids-dungeons-encounters.md#encounter-loadouts).
- **DIM loadouts**: with **Read DIM loadouts** on in Settings, an item's details panel lists the DIM loadouts it is in; pressing one pulls every item in that loadout to its character ([report-template/site.html:2887-2889](../../report-template/site.html#L2887-L2889)).
- **Builds** (web app): the Builds tab's **Equip** shows a dry run of every step first; see [The Builds tab](../explanation/builds-tab.md#equipping).

## From an AI client

Ask it to move something; it calls `move_items` with up to 20 instance ids, a destination (`vault`, a class name or a character id) and optionally `equip: true` ([src/server.ts:335-350](../../src/server.ts#L335-L350)). The tool tells the AI to move items only when you ask ([src/server.ts:338](../../src/server.ts#L338)).

## What happens, and why a move can fail

Every move goes character → vault → character with Bungie's [TransferItem](https://bungie-net.github.io/multi/operation_post_Destiny2-TransferItem.html) action, then [EquipItems](https://bungie-net.github.io/multi/operation_post_Destiny2-EquipItems.html) if you asked to equip ([src/bungie/transfer.ts:79-110](../../src/bungie/transfer.ts#L79-L110)). Both need the **Move or equip your gear** scope on your Bungie app.

| Message | Cause | Fix |
| --- | --- | --- |
| Equipped on your … | Bungie won't move an equipped item ([src/bungie/transfer.ts:80](../../src/bungie/transfer.ts#L80)). | Equip something else in that slot first. |
| … armor can't go to your … | Armor for another class ([src/bungie/transfer.ts:68-69](../../src/bungie/transfer.ts#L68-L69)). | Pick a character of that class. |
| No room there | The character's slot or the vault is full. | Make space and try again. |
| Bungie won't allow that right now | Some actions are blocked mid-activity. | Try from orbit or the Tower. |
| Moved, but Bungie wouldn't equip it | Usually a second exotic, or the wrong class. | Unequip the other exotic. |

The friendly messages come from [src/bungie/transfer.ts:27-34](../../src/bungie/transfer.ts#L27-L34) and [src/bungie/transfer.ts:121](../../src/bungie/transfer.ts#L121). If the item isn't where the rater last saw it, re-rate (or press **Refresh** in the web app's Vault tab) and try again.
