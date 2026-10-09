# Host the web app on a static site

The web app is plain static files: no server code runs after the build. Everything, including Bungie sign-in, happens in the visitor's browser ([web/src/main.ts:1-4](../../web/src/main.ts#L1-L4)).

## 1. Create a Public Bungie app for the site

A hosted site can't keep a client secret, so it needs its own app at <https://www.bungie.net/en/Application> (keep the Confidential one for the local app):

- **OAuth client type**: Public. Public clients get no refresh token, so visitors sign in again after about an hour ([web/src/shims/client.ts:1-4](../../web/src/shims/client.ts#L1-L4)).
- **Redirect URL**: the page's own address, e.g. `https://you.github.io/vault-rater/`. Bungie sends visitors back to the page itself ([web/src/appConfig.ts:46-47](../../web/src/appConfig.ts#L46-L47)).
- **Origin header**: the site's origin, e.g. `https://you.github.io`.
- **Scopes**: Read your Destiny 2 information; Move or equip your gear.

The setup screen shows these exact values for the address it is running at ([web/src/main.ts:69-92](../../web/src/main.ts#L69-L92)).

## 2. Put the keys in the build

Write the API key and client id into [web/app.config.json](../../web/app.config.json). They are bundled into the page ([web/src/appConfig.ts:1](../../web/src/appConfig.ts#L1)); neither is secret, since the key only works from your origin ([web/src/appConfig.ts:3-7](../../web/src/appConfig.ts#L3-L7)). Leave `dimApiKey` empty and the site registers one for its origin the first time someone uses DIM ([web/src/shims/sync.ts:28-41](../../web/src/shims/sync.ts#L28-L41)).

If you leave the file empty, each visitor sees a setup screen and their keys are saved in their own browser ([web/src/appConfig.ts:28-39](../../web/src/appConfig.ts#L28-L39)).

## 3. Ship snapshots (optional, recommended)

```bash
cd web
npm install
npm run snapshot
```

This writes a stripped manifest and the Builds tab's definitions for the live game version, plus a copy of Aegis's tier list and armor set tiers, into `public/data` ([web/scripts/snapshot.ts:1-7](../../web/scripts/snapshot.ts#L1-L7)). With them, a first visit loads a few MB instead of building the item database from 200 MB of Bungie tables ([web/src/versioned.ts:1-6](../../web/src/versioned.ts#L1-L6)). The sources copy comes from your local app's cache, so run its `refresh` first if it is old ([web/scripts/snapshot.ts:56-61](../../web/scripts/snapshot.ts#L56-L61)). Re-run after each game patch; a snapshot for an older version is simply skipped ([web/src/versioned.ts:44-47](../../web/src/versioned.ts#L44-L47)).

## 4. Build and upload

```bash
npm run build
```

Upload `web/dist/` anywhere. Asset paths are relative ([web/vite.config.ts:59](../../web/vite.config.ts#L59)), so a sub-folder such as `/vault-rater/` works.

## 5. Cache headers

Nothing in the app sets HTTP headers for a static host; set these on your host if it allows:

| Path | Header | Why |
| --- | --- | --- |
| `assets/*` | `Cache-Control: public, max-age=31536000, immutable` | Vite puts a content hash in every script and style name, so a changed file gets a new name. |
| `data/manifest-*.json`, `data/builds-*.json` | `Cache-Control: public, max-age=31536000, immutable` | The game version is in the name ([web/src/versioned.ts:42](../../web/src/versioned.ts#L42)). |
| `index.html`, `data/sources.json`, `app-config.json` | `Cache-Control: no-cache` | Same name, new contents after each deploy. |

The app also caches the item database in IndexedDB per game version ([caching](../explanation/caching.md)), so repeat visits barely touch these files.
