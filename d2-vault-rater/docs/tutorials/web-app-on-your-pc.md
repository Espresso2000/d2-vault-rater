# Run the web app on your PC

The web app is the same rater running entirely in your browser. In this tutorial you start it on your own PC with the Bungie app from [Your first vault report](first-vault-report.md), sign in, and open the Builds tab. You need that tutorial's `.env` file.

## 1. Install

```bash
cd web
npm install
```

## 2. Start it

```bash
npm run local
```

On Windows you can double-click `Vault Rater Web.cmd` instead, next to `Vault Rater.cmd` in the folder above `d2-vault-rater`. It also opens the page for you.

This builds the site and serves it over https on the port of your app's redirect URL, 7777 by default ([web/vite.config.ts:55-63](../../web/vite.config.ts#L55-L63), [web/local-server.ts:21-27](../../web/local-server.ts#L21-L27)). The certificate is self-signed, so your browser warns once: choose **Advanced**, then continue.

Two small helpers run next to the page in this mode only ([web/local-server.ts:1-8](../../web/local-server.ts#L1-L8)):

- `app-config.json` hands the page your API key and client id from `.env` ([web/local-server.ts:38-43](../../web/local-server.ts#L38-L43)).
- `oauth/token` adds your client secret to Bungie's token exchange, so the secret never reaches the page ([web/local-server.ts:44-66](../../web/local-server.ts#L44-L66)). Because your app is Confidential, you also get a refresh token and stay signed in.

## 3. Sign in

Open <https://localhost:7777> and press **Sign in with Bungie**. Bungie sends you back to the page, which finishes the sign-in itself ([web/src/main.ts:246-268](../../web/src/main.ts#L246-L268)).

The page then shows its progress while it:

1. loads the item database: from the browser's cache, a snapshot, or by building it from bungie.net the first time ([web/src/manifest.ts:8-26](../../web/src/manifest.ts#L8-L26));
2. imports the tier list, wishlist, armor sets and raid loot when they are over a day old ([web/src/sources.ts:26-88](../../web/src/sources.ts#L26-L88));
3. reads and rates your vault and draws the report ([web/src/main.ts:119-176](../../web/src/main.ts#L119-L176)).

The report has the same tabs as the local app's, and its buttons work the same way ([web/src/main.ts:202-243](../../web/src/main.ts#L202-L243)).

## 4. Make a build

Open **Builds**. The first time, it downloads subclass, aspect and fragment definitions and the community build ratings ([web/src/builds/ui.ts:86-103](../../web/src/builds/ui.ts#L86-L103)).

1. Press **New**, pick a class and a subclass.
2. Fill the aspect and fragment sockets; the rating ring updates as you go ([web/src/builds/model.ts:186-212](../../web/src/builds/model.ts#L186-L212)).
3. Pick weapons and armor from your vault, and armor mods.
4. Press **Equip**. You get a dry run listing every step; nothing changes until you confirm ([web/src/builds/equip.ts:41](../../web/src/builds/equip.ts#L41)).

Your builds are saved in this browser ([web/src/builds/store.ts:5-8](../../web/src/builds/store.ts#L5-L8)).

## Next

- [Host the web app](../how-to/host-the-web-app.md) for other players.
- [The Builds tab](../explanation/builds-tab.md): how builds are rated and equipped.
