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

This builds the site and serves it over https on the port of your app's redirect URL, 7777 by default ([web/vite.config.ts:56-64](../../web/vite.config.ts#L56-L64), [web/local-server.ts:21-27](../../web/local-server.ts#L21-L27)). The certificate is self-signed, so your browser warns once: choose **Advanced**, then continue.

A small local server runs next to the page in this mode only ([web/local-server.ts:1-8](../../web/local-server.ts#L1-L8)):

- `app-config.json` hands the page your API key and client id from `.env` ([web/local-server.ts:38-43](../../web/local-server.ts#L38-L43)).
- `oauth/token` adds your client secret to Bungie's token exchange, so the secret never reaches the page ([web/local-server.ts:44-66](../../web/local-server.ts#L44-L66)). Because your app is Confidential, you also get a refresh token and stay signed in.

## 3. Sign in

Open <https://localhost:7777> and press **Sign in with Bungie**. Bungie sends you back to the page, which finishes the sign-in itself ([web/src/main.ts:271-294](../../web/src/main.ts#L271-L294)). Next time you open the page you go straight in: an expired access token is renewed with the refresh token your Confidential app gets ([web/src/main.ts:286-287](../../web/src/main.ts#L286-L287), [web/src/shims/client.ts:69-71](../../web/src/shims/client.ts#L69-L71)).

The page then shows its progress while it:

1. loads the item database: from the browser's cache, a snapshot, or by building it from bungie.net the first time ([web/src/manifest.ts:9-26](../../web/src/manifest.ts#L9-L26));
2. imports the tier list, wishlist, armor sets and raid loot when they are over a day old ([web/src/sources.ts:26-88](../../web/src/sources.ts#L26-L88));
3. reads and rates your vault and draws the report ([web/src/main.ts:121-191](../../web/src/main.ts#L121-L191)).

The report has the local app's tabs plus **Vendors** and **Builds**, and its buttons work the same way ([web/src/main.ts:223-268](../../web/src/main.ts#L223-L268)).

## 4. Make a build

Open **Builds**. The first time, it downloads subclass, aspect and fragment definitions, the community build ratings and Destiny Clarity's notes ([web/src/builds/ui.ts:121-141](../../web/src/builds/ui.ts#L121-L141)).

1. Under **Saved builds**, pick your class and press **New … build** on the first card ([web/src/builds/ui.ts:262-268](../../web/src/builds/ui.ts#L262-L268)). Name it in the title card.
2. In the **Subclass** card, pick an element ([web/src/builds/ui.ts:434-457](../../web/src/builds/ui.ts#L434-L457)).
3. In the **Abilities** card, rest the pointer on a slot (or tap it) to open its options, then click one. Aspects and fragments toggle, so you can fill every fragment slot from one popover. If popovers open when you don't want them to, switch the card's header from **Hover** to **Click** ([web/src/builds/ui.ts:469-471](../../web/src/builds/ui.ts#L469-L471)). The rating ring in the summary updates as you go ([web/src/builds/model.ts:195-221](../../web/src/builds/model.ts#L195-L221)).
4. Press **Choose gear and mods**, pick weapons, armor and mods for any slots, check the stat tray, then press **Apply** ([web/src/builds/ui.ts:912-955](../../web/src/builds/ui.ts#L912-L955)).
5. Drag the gold markers on the stat bars to set the stats you aim for ([web/src/builds/ui.ts:401](../../web/src/builds/ui.ts#L401)).
6. Press **Save** in the title card. Nothing is kept until you do; leaving with unsaved changes asks first ([web/src/builds/ui.ts:192-193](../../web/src/builds/ui.ts#L192-L193)).
7. Press **Equip on …**. You get a dry run listing every step; nothing changes until you press **Equip now**, and afterwards **Undo** puts your previous gear back ([web/src/builds/ui.ts:1453-1498](../../web/src/builds/ui.ts#L1453-L1498), [web/src/builds/equip.ts:41](../../web/src/builds/equip.ts#L41)).

What each part does: [The Builds tab](../explanation/builds-tab.md#the-editor).

Your builds are saved in this browser ([web/src/builds/store.ts:5-8](../../web/src/builds/store.ts#L5-L8)).

## 5. Check the vendors

Open **Vendors**. It reads what vendors sell right now for your most recently played character and rates each weapon and armor piece against your vault ([web/src/vendors/ui.ts:77-103](../../web/src/vendors/ui.ts#L77-L103)).

1. Tick **Only worth buying** to see just the items the rater would keep.
2. Open a card for the reasons, every perk option and the price.
3. Switch **Character** to see another class's stock, or press **Eververse** for today's featured offers.

What the calls mean: [The Vendors tab](../explanation/vendors.md).

## Next

- [Host the web app](../how-to/host-the-web-app.md) for other players.
- [The Builds tab](../explanation/builds-tab.md): how builds are rated and equipped.
