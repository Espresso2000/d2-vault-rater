# Run the web app on your PC

The web app is the same rater running entirely in your browser. In this tutorial you start it on your own PC with the Bungie app from [Your first vault report](first-vault-report.md), sign in, and open the Builds tab. You need that tutorial's `.env` file.

## 1. Install

The web app imports the rating code from `src/`, so it needs the package folder's packages as well as its own. If you did the first tutorial, the first command is already done.

```bash
npm install
cd web
npm install
```

## 2. Start it

```bash
npm run local
```

On Windows you can double-click `Vault Rater Web.cmd` instead, next to `Vault Rater.cmd` in the folder above `d2-vault-rater`. It installs both sets of packages when they are missing and opens the page for you ([launchers](../reference/cli-and-local-server.md#windows-launchers)).

This builds the site and serves it over https on the port of your app's redirect URL, 7777 by default ([web/vite.config.ts:56-64](../../web/vite.config.ts#L56-L64), [web/local-server.ts:22-28](../../web/local-server.ts#L22-L28)). The certificate is self-signed, so your browser warns once: choose **Advanced**, then continue.

A small local server runs next to the page in this mode only ([web/local-server.ts:1-9](../../web/local-server.ts#L1-L9)):

- `app-config.json` hands the page your API key and client id from `.env` ([web/local-server.ts:39-44](../../web/local-server.ts#L39-L44)).
- `oauth/token` adds your client secret to Bungie's token exchange, so the secret never reaches the page ([web/local-server.ts:55-77](../../web/local-server.ts#L55-L77)). Because your app is Confidential, you also get a refresh token and stay signed in.
- `debug/vendors` saves the Vendors tab's raw data to `web/debug/` for checking vendor support ([web/local-server.ts:45-54](../../web/local-server.ts#L45-L54)).

## 3. Sign in

Open <https://localhost:7777> and press **Sign in with Bungie**. Bungie sends you back to the page, which finishes the sign-in itself ([web/src/main.ts:269-291](../../web/src/main.ts#L269-L291)).

The page then shows its progress while it:

1. loads the item database: from the browser's cache, a snapshot, or by building it from bungie.net the first time ([web/src/manifest.ts:9-26](../../web/src/manifest.ts#L9-L26));
2. imports the tier list, wishlist, armor sets and raid loot when they are over a day old ([web/src/sources.ts:26-88](../../web/src/sources.ts#L26-L88));
3. reads and rates your vault and draws the report ([web/src/main.ts:121-189](../../web/src/main.ts#L121-L189)).

The report has the local app's tabs plus **Vendors** and **Builds**, and its buttons work the same way ([web/src/main.ts:221-266](../../web/src/main.ts#L221-L266)).

## 4. Make a build

Open **Builds**. The first time, it downloads subclass, aspect and fragment definitions, the community build ratings and Destiny Clarity's notes ([web/src/builds/ui.ts:122-141](../../web/src/builds/ui.ts#L122-L141)). The tab is being redesigned, so buttons may have moved, but the steps are the same:

1. Start a new build for a class and pick a subclass.
2. Fill the abilities, aspects and fragments; the rating updates as you go ([web/src/builds/model.ts:195-221](../../web/src/builds/model.ts#L195-L221)).
3. Choose weapons, armor and mods, check the stat preview, and apply them to the build.
4. **Save** the build; nothing is kept until you do.
5. **Equip** it. You get a dry run listing every step; nothing changes until you confirm ([web/src/builds/equip.ts:41](../../web/src/builds/equip.ts#L41)).

Your builds are saved in this browser ([web/src/builds/store.ts:5-8](../../web/src/builds/store.ts#L5-L8)).

## 5. Check the vendors

Open **Vendors**. It reads what vendors sell right now for your most recently played character and rates each weapon and armor piece against your vault ([web/src/vendors/ui.ts:78-105](../../web/src/vendors/ui.ts#L78-L105)).

1. Tick **Only worth buying** to see just the items the rater would keep.
2. Open a card for the reasons, every perk option and the price.
3. Switch **Character** to see another class's stock, or press **Eververse** for today's featured offers.

What the calls mean: [The Vendors tab](../explanation/vendors.md).

## Next

- [Host the web app](../how-to/host-the-web-app.md) for other players.
- [The Builds tab](../explanation/builds-tab.md): how builds are rated and equipped.
