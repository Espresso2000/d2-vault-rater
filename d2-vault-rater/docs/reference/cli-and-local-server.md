# CLI, local server and environment

## npm scripts

Run from the package folder ([package.json](../../package.json)):

| Script | Runs |
| --- | --- |
| `npm run build` | Compiles `src/` to `dist/` with TypeScript. |
| `npm start` | The MCP server, `dist/server.js`. |
| `npm run dev` | The MCP server from source with tsx. |
| `npm run vault -- <command>` | The CLI, `dist/cli.js` (commands below). |
| `npm run vault:serve` | The CLI's `serve` command. |
| `npm test` | Unit tests in `test/` (fixtures, no network). |
| `npm run typecheck` | Type checking, including unused code. |
| `npm run docs:check` | Checks every code link in `docs/` ([scripts/check-doc-refs.mjs](../../scripts/check-doc-refs.mjs)). |

The web app has its own scripts in [web/package.json](../../web/package.json): `dev`, `build`, `preview`, `typecheck`, `local` (build and serve on your PC with the token relay) and `snapshot` (ship a stripped manifest and a sources snapshot).

## CLI commands

`vault-rater [command] [argument]`, or `npm run vault -- [command] [argument]` ([src/cli.ts:202-258](../../src/cli.ts#L202-L258)). It reads `.env` next to `package.json` first ([src/cli.ts:29-34](../../src/cli.ts#L29-L34)) and stops if `BUNGIE_API_KEY` is missing ([src/cli.ts:206-209](../../src/cli.ts#L206-L209)). `report`, `serve`, `apply` and `undo` log in first when needed ([src/cli.ts:210](../../src/cli.ts#L210)).

| Command | What it does | Source |
| --- | --- | --- |
| `report` (default) | Refresh sources if older than a day, rate the vault, write a dry-run lock plan and the HTML report, open it. | [src/cli.ts:230-235](../../src/cli.ts#L230-L235) |
| `serve` | The same, then serve the report with working buttons at `http://localhost:7780` (or `VAULT_RATER_PORT`). | [src/cli.ts:236-237](../../src/cli.ts#L236-L237) |
| `login` | Log in to Bungie again: opens the approval page and asks you to paste the address you land on. | [src/cli.ts:56-65](../../src/cli.ts#L56-L65) |
| `refresh` | Re-import Aegis's sheet, wishlists, armor set tiers and raid loot. | [src/cli.ts:227-229](../../src/cli.ts#L227-L229) |
| `dim <tags\|loadouts\|protect\|on\|off> [on\|off]` | Turn reading DIM tags or loadouts, or protecting Favorite/Keep items, on or off. | [src/cli.ts:215-226](../../src/cli.ts#L215-L226) |
| `apply <plan-id>` | Show the plan's counts, ask you to type "yes", then apply its locks and write the DIM CSV. | [src/cli.ts:238-249](../../src/cli.ts#L238-L249) |
| `undo <plan-id>` | Ask for "yes", then restore every lock the plan changed. | [src/cli.ts:250-255](../../src/cli.ts#L250-L255) |

## Local server routes

`serve` listens on `127.0.0.1` ([src/cli.ts:195](../../src/cli.ts#L195)). POST requests must come from the page itself ([src/cli.ts:94-95](../../src/cli.ts#L94-L95)). The web app answers the same routes in the browser ([web/src/main.ts:223-268](../../web/src/main.ts#L223-L268)).

| Route | Body | Does | Source |
| --- | --- | --- | --- |
| `GET /` | | The latest report, flagged as served locally, never cached. | [src/cli.ts:188-192](../../src/cli.ts#L188-L192) |
| `POST /api/refresh` | | Re-reads the vault and rebuilds the report; concurrent calls share one run. | [src/cli.ts:173-187](../../src/cli.ts#L173-L187) |
| `POST /api/settings` | Settings panel fields | Saves preset, focus, protect list, per-type settings and DIM switches. | [src/cli.ts:142-151](../../src/cli.ts#L142-L151) |
| `POST /api/tag` | `id`, `tag` or null, `notes?` | Sets or clears a DIM tag. | [src/cli.ts:96-107](../../src/cli.ts#L96-L107) |
| `POST /api/move` | `ids`, `to`, `equip?` | Moves items, optionally equipping them. | [src/cli.ts:108-119](../../src/cli.ts#L108-L119) |
| `POST /api/perk` | `id`, `socket`, `perk` | Switches a weapon's perk column to one of its own options in game ([how-to](../how-to/switch-weapon-perks.md)). | [src/cli.ts:120-130](../../src/cli.ts#L120-L130) |
| `POST /api/locks/apply` | `planId`, `confirm: true` | Applies the current plan only. | [src/cli.ts:153-163](../../src/cli.ts#L153-L163) |
| `POST /api/locks/undo` | `planId` | Undoes an applied plan. | [src/cli.ts:164-172](../../src/cli.ts#L164-L172) |

The web app also answers `POST /api/signout`, which signs you out of Bungie in that browser ([web/src/main.ts:244-246](../../web/src/main.ts#L244-L246), [web/src/main.ts:104-109](../../web/src/main.ts#L104-L109)); its `/api/refresh` only acknowledges, because the page reloads and rates again ([web/src/main.ts:241-243](../../web/src/main.ts#L241-L243)).

## Web app local server

`npm run local` in `web/` builds the site and serves it over https with two extra routes ([web/local-server.ts:1-8](../../web/local-server.ts#L1-L8)):

| Route | Does | Source |
| --- | --- | --- |
| `GET /app-config.json` | Hands the page the API key and client id from `.env`, and the token relay's address when a client secret is set. Not secret. | [web/local-server.ts:38-43](../../web/local-server.ts#L38-L43) |
| `POST /oauth/token` | Relays Bungie's token exchange and refresh, adding the client secret; only from the page's own origin. | [web/local-server.ts:44-67](../../web/local-server.ts#L44-L67) |

## Windows launchers

Two files in the folder above `d2-vault-rater` start the apps with a double-click:

| File | Does |
| --- | --- |
| [`Vault Rater.cmd`](../../../Vault%20Rater.cmd) | Installs packages when `node_modules` is missing and builds when `dist/cli.js` is missing (so after updating the code, run `npm run build` yourself), then runs the CLI's `serve` command. |
| [`Vault Rater Web.cmd`](../../../Vault%20Rater%20Web.cmd) | Installs the root packages (the web app imports shared code from `src/`, which needs `zod`) and the web packages when they are missing or half-installed, opens <https://localhost:7777/> after a few seconds, and runs `npm run local`. |

## Environment variables

| Variable | Used for | Source |
| --- | --- | --- |
| `BUNGIE_API_KEY` | Every Bungie request. Required. | [src/config.ts:24-26](../../src/config.ts#L24-L26) |
| `BUNGIE_CLIENT_ID` | OAuth login. | [src/config.ts:29](../../src/config.ts#L29) |
| `BUNGIE_CLIENT_SECRET` | OAuth token requests (Confidential app). | [src/config.ts:30](../../src/config.ts#L30) |
| `BUNGIE_REDIRECT_URL` | Default `https://localhost:7777/callback`; the web app's local mode also takes its port from it. | [src/config.ts:31](../../src/config.ts#L31), [web/local-server.ts:21-27](../../web/local-server.ts#L21-L27) |
| `VAULT_RATER_HOME` | Data folder, default `~/.d2-vault-rater`. | [src/config.ts:5](../../src/config.ts#L5) |
| `VAULT_RATER_PORT` | `serve` port, default 7780. | [src/cli.ts:237](../../src/cli.ts#L237) |
| `VAULT_RATER_NO_OPEN` | Don't open a browser window. | [src/cli.ts:37](../../src/cli.ts#L37) |
| `VR_NO_SSL` | Web app local mode over plain http. | [web/vite.config.ts:61-62](../../web/vite.config.ts#L61-L62) |

`.env` values never override variables already set in the environment ([src/cli.ts:33](../../src/cli.ts#L33), [web/local-server.ts:14-18](../../web/local-server.ts#L14-L18)). See [.env.example](../../.env.example).
