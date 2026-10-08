# Why nothing changes in game until you say so

Vault Rater can lock and unlock items, move and equip them, set DIM tags and change subclass and mod sockets. It never deletes or dismantles anything: unlocking only makes an item easy to dismantle yourself. Every change that touches the game goes through a preview first.

## Locks: plan, confirm, apply, undo

1. **The plan is a dry run.** `planDimActions` ([src/dim/actions.ts:46](../../src/dim/actions.ts#L46)) decides, for every rated item, whether to lock it, unlock it or leave it, and which DIM tag it should get. It only writes the plan to a file ([src/dim/actions.ts:89](../../src/dim/actions.ts#L89)); the MCP tool says so in its description ([src/server.ts:378](../../src/server.ts#L378)).
2. **Keepers are locked; only some junk is unlocked.** A shard item is unlocked only when its category is in your strictness's `unlock` list ([src/dim/actions.ts:55-57](../../src/dim/actions.ts#L55-L57)). Items to review (extra exotics) are never unlocked ([src/dim/actions.ts:53-54](../../src/dim/actions.ts#L53-L54)).
3. **Applying needs an explicit yes.**
   - MCP: `apply_dim_actions` requires `confirm: true` and is marked destructive ([src/server.ts:399-400](../../src/server.ts#L399-L400)).
   - CLI: you type "yes" ([src/cli.ts:221](../../src/cli.ts#L221)).
   - Report page: only the plan the page previewed, with the confirmation flag ([src/cli.ts:133](../../src/cli.ts#L133), [web/src/main.ts:225](../../web/src/main.ts#L225)).
4. **Protected items are never unlocked**, even if someone edits the plan file: apply skips them itself ([src/dim/actions.ts:139](../../src/dim/actions.ts#L139), [src/dim/actions.ts:148](../../src/dim/actions.ts#L148)). Protected means equipped, Adept/Timelost, on your protect list, tagged Favorite or Keep in DIM, or your only weapon of a slot and element ([src/rating/weapons.ts:193-201](../../src/rating/weapons.ts#L193-L201)).
5. **Undo.** Before changing anything, apply saves every item's previous lock state ([src/dim/actions.ts:143-144](../../src/dim/actions.ts#L143-L144)); `undoDimActions` puts back exactly the locks that plan changed ([src/dim/actions.ts:163-188](../../src/dim/actions.ts#L163-L188)). DIM tags aren't undone this way.

Lock changes are spaced out (250 ms by default) and retried while Bungie throttles them ([src/dim/actions.ts:157](../../src/dim/actions.ts#L157), [src/bungie/errors.ts:16-27](../../src/bungie/errors.ts#L16-L27)).

## Moves and equips

`moveItems` ([src/bungie/transfer.ts:46](../../src/bungie/transfer.ts#L46)) refuses moves that can't work instead of half-doing them: armor for another class ([src/bungie/transfer.ts:63-64](../../src/bungie/transfer.ts#L63-L64)), and anything currently equipped, which Bungie won't move until something else is equipped ([src/bungie/transfer.ts:66](../../src/bungie/transfer.ts#L66)). The MCP tool tells the AI to use it only when the player asks ([src/server.ts:335](../../src/server.ts#L335)), and Bungie's error codes are turned into plain advice ([src/bungie/transfer.ts:24-31](../../src/bungie/transfer.ts#L24-L31)).

In the Builds tab, equipping a build first shows every step it would take ("Dry run · nothing has changed yet") and runs them only when you confirm ([web/src/builds/ui.ts:736](../../web/src/builds/ui.ts#L736), [web/src/builds/equip.ts:41](../../web/src/builds/equip.ts#L41)).

## The local server only takes requests from its own page

The CLI's server listens on `127.0.0.1` only ([src/cli.ts:173](../../src/cli.ts#L173)) and rejects any POST whose `Origin` isn't the page it serves ([src/cli.ts:94-95](../../src/cli.ts#L94-L95)). The web app's local token relay does the same check ([web/local-server.ts:46-49](../../web/local-server.ts#L46-L49)) and keeps the client secret out of the page by adding it on the server side ([web/local-server.ts:60](../../web/local-server.ts#L60)).

## The report page can't be broken by item names

Data embedded in the local report escapes `<`, so no weapon name or note can close the script tag ([src/report/site.ts:62-63](../../src/report/site.ts#L62-L63)). The Settings panel's input is filtered field by field, taking only values of the right type ([src/rating/settings.ts:127-142](../../src/rating/settings.ts#L127-L142)), and saved settings are validated against the schema ([src/rating/settings.ts:121-125](../../src/rating/settings.ts#L121-L125)).
