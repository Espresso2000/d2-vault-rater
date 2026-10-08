# Your first vault report

In this tutorial you set up a Bungie app, run Vault Rater on your PC, and read the report it makes for your vault. You need Node.js 20.12 or newer ([package.json](../../package.json)) and a Destiny 2 account. It takes about ten minutes, most of it the first download of the game's item database.

Nothing in game changes during this tutorial: the rater only reads your vault and writes a plan ([src/pipeline.ts:55-90](../../src/pipeline.ts#L55-L90)).

## 1. Create a Bungie app

Go to <https://www.bungie.net/en/Application> and create an application:

- **OAuth client type**: Confidential
- **Redirect URL**: `https://localhost:7777/callback`. The page never has to load; you only copy its address.
- **Scopes**: Read your Destiny 2 information, and Move or equip your gear
- **Origin header**: `*`

Keep the page open: you need its API key, OAuth client_id and OAuth client_secret next.

## 2. Add the keys

In the `d2-vault-rater` folder, copy [.env.example](../../.env.example) to `.env` and fill in the three values:

```
BUNGIE_API_KEY=your api key
BUNGIE_CLIENT_ID=your client id
BUNGIE_CLIENT_SECRET=your client secret
```

The CLI reads this file on start ([src/cli.ts:29-34](../../src/cli.ts#L29-L34)).

## 3. Install and build

```bash
npm install
npm run build
```

## 4. Rate your vault

```bash
npm run vault:serve
```

On Windows you can double-click `Vault Rater.cmd` instead, in the folder above `d2-vault-rater`. It installs and builds the first time, then runs this step. It only builds when `dist/` is missing, so after updating the code run `npm run build` yourself.

1. A browser window opens on bungie.net. Approve the app.
2. The browser then goes to `https://localhost:7777/callback?code=...` and shows an error. That is expected. Copy the whole address from the address bar and paste it into the terminal ([src/cli.ts:56-65](../../src/cli.ts#L56-L65)).
3. The terminal lists what it is doing: downloading the manifest, importing Aegis's tier list, the wishlist, armor set tiers and raid loot ([src/pipeline.ts:33-46](../../src/pipeline.ts#L33-L46)), then reading and rating your vault ([src/pipeline.ts:65-82](../../src/pipeline.ts#L65-L82)). The first run takes a few minutes; later runs reuse the downloads ([caching](../explanation/caching.md)).
4. Your report opens at <http://localhost:7780>. Keep the terminal open while you use it ([src/cli.ts:173-178](../../src/cli.ts#L173-L178)).

The terminal ends with a summary like:

```
Done. 412 weapons (57 to shard) and 233 armor pieces (41 to shard).
Report: C:\Users\you\.d2-vault-rater\reports\vault-report-2026-10-08.html
Dry-run lock plan: 2026-10-08T16-40-12-118Z-a3f9c1 (lock 180, unlock 12). Nothing was changed in game.
To apply it: npm run vault -- apply 2026-10-08T16-40-12-118Z-a3f9c1
```

## 5. Read the report

- **Overview**: how many weapons and armor pieces to keep and shard, and your best picks per slot.
- **Weapons**: open any weapon to see its score, its Aegis tier, which perks matched, and the reasons behind its verdict. The reasons are the same sentences the rater writes while deciding ([src/rating/weapons.ts:252-315](../../src/rating/weapons.ts#L252-L315)).
- **Armor**: best piece per class and slot, with stats and set bonuses.
- **RADS**: raids and dungeons ranked by what they would add to your vault, with a loadout from your vault for every encounter.
- **Shard**: everything marked for sharding, grouped by reason.

If something you want to keep is on the shard list, [protect it](../how-to/protect-items.md); if the list is too long or too short, [change the strictness](../how-to/tune-strictness.md). Press **Re-rate my vault** to see the change ([src/cli.ts:151-165](../../src/cli.ts#L151-L165)).

## Next

- [Lock keepers and unlock junk](../how-to/apply-and-undo-locks.md) with the plan you just made.
- [Run the web app on your PC](web-app-on-your-pc.md).
- [How weapons are rated](../explanation/weapon-rating.md).
