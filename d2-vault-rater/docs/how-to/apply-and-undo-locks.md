# Lock keepers, unlock junk, and undo it

Rating always writes a dry-run plan first; nothing changes in game until you apply it. Why it works this way: [Safety](../explanation/safety.md).

## 1. Look at the plan

- **CLI**: `npm run vault` prints the plan id and how many items it would lock and unlock ([src/cli.ts:69-74](../../src/cli.ts#L69-L74)).
- **Report page**: the lock preview lists only the items whose lock would change ([src/report/siteData.ts:167-174](../../src/report/siteData.ts#L167-L174)).
- **AI**: `plan_dim_actions` returns the counts, every unlock with its reason, the items to lock, and DIM search strings ([src/server.ts:375-392](../../src/server.ts#L375-L392)).

Which shard categories get unlocked is your strictness's `unlock` list; at the default preset only duplicates are ([src/rating/settings.ts:41-50](../../src/rating/settings.ts#L41-L50)). To unlock more, see [Tune strictness](tune-strictness.md).

## 2. Apply it

- **CLI**: `npm run vault -- apply <plan-id>` and type `yes` ([src/cli.ts:216-227](../../src/cli.ts#L216-L227)).
- **Report page**: press **Preview changes** on the Shard tab, check the list, then press **Apply** under it. Only the plan that page showed can be applied ([src/cli.ts:131-141](../../src/cli.ts#L131-L141), [web/src/main.ts:227-232](../../web/src/main.ts#L227-L232)).
- **AI**: `apply_dim_actions` with the `plan_id` and `confirm: true` after you approve ([src/server.ts:394-406](../../src/server.ts#L394-L406)).

Applying saves an undo snapshot, writes the DIM tags CSV, then changes locks one by one ([src/dim/actions.ts:140-160](../../src/dim/actions.ts#L140-L160)). Items that fail are listed in the result; the rest still go through ([src/dim/actions.ts:154-156](../../src/dim/actions.ts#L154-L156)). DIM shows the new locks after its next refresh.

## 3. Import the DIM tags (optional)

The plan tags keepers `favorite` (best) or `keep`, junk `junk`, and items to review `archive`, each with a note starting with the score ([src/dim/actions.ts:48-66](../../src/dim/actions.ts#L48-L66)). In DIM: **Settings → Spreadsheets → Import tags/notes from CSV**, and pick the CSV the apply step reported ([src/server.ts:404](../../src/server.ts#L404)). The file has DIM's `Id`, `Hash`, `Tag` and `Notes` columns ([src/dim/actions.ts:108-113](../../src/dim/actions.ts#L108-L113)). In the web app the CSV comes back with the apply result ([web/src/main.ts:231](../../web/src/main.ts#L231)).

To write the CSV without changing locks, use `export_dim_csv` ([src/server.ts:408-412](../../src/server.ts#L408-L412)).

## 4. Undo

- **CLI**: `npm run vault -- undo <plan-id>` and type `yes` ([src/cli.ts:228-233](../../src/cli.ts#L228-L233)).
- **AI**: `undo_dim_actions` with the `plan_id` ([src/server.ts:414-418](../../src/server.ts#L414-L418)).

Undo restores every lock that plan changed to its state before apply ([src/dim/actions.ts:163-188](../../src/dim/actions.ts#L163-L188)). It needs the snapshot, so a plan that was never applied can't be undone ([src/dim/actions.ts:166](../../src/dim/actions.ts#L166)). DIM tags are not undone; re-import an older CSV or clear them in DIM ([src/dim/actions.ts:187](../../src/dim/actions.ts#L187)).
