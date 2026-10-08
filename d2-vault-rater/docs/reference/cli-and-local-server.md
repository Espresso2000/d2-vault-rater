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

`vault-rater [command] [argument]`, or `npm run vault -- [command] [argument]` ([src/cli.ts:180-236](../../src/cli.ts#L180-L236)). It reads `.env` next to `package.json` first ([src/cli.ts:29-34](../../src/cli.ts#L29-L34)) and stops if `BUNGIE_API_KEY` is missing ([src/cli.ts:184-187](../../src/cli.ts#L184-L187)). `report`, `serve`, `apply` and `undo` log in first when needed ([src/cli.ts:188](../../src/cli.ts#L188)).

| Command | What it does | Source |
| --- | --- | --- |
| `report` (default) | Refresh sources if older than a day, rate the vault, write a dry-run lock plan and the HTML report, open it. | [src/cli.ts:208-213](../../src/cli.ts#L208-L213) |
| `serve` | The same, then serve the report with working buttons at `http://localhost:7780` (or `VAULT_RATER_PORT`). | [src/cli.ts:214-215](../../src/cli.ts#L214-L215) |
| `login` | Log in to Bungie again: opens the approval page and asks you to paste the address you land on. | [src/cli.ts:56-65](../../src/cli.ts#L56-L65) |
| `refresh` | Re-import Aegis's sheet, wishlists, armor set tiers and raid loot. | [src/cli.ts:205-207](../../src/cli.ts#L205-L207) |
| `dim <tags\|loadouts\|protect\|on\|off> [on\|off]` | Turn reading DIM tags or loadouts, or protecting Favorite/Keep items, on or off. | [src/cli.ts:193-204](../../src/cli.ts#L193-L204) |
| `apply <plan-id>` | Show the plan's counts, ask you to type "yes", then apply its locks and write the DIM CSV. | [src/cli.ts:216-227](../../src/cli.ts#L216-L227) |
| `undo <plan-id>` | Ask for "yes", then restore every lock the plan changed. | [src/cli.ts:228-233](../../src/cli.ts#L228-L233) |

## Local server routes

`serve` listens on `127.0.0.1` ([src/cli.ts:173](../../src/cli.ts#L173)). POST requests must come from the page itself ([src/cli.ts:94-95](../../src/cli.ts#L94-L95)). The web app answers the same routes in the browser ([web/src/main.ts:198-239](../../web/src/main.ts#L198-L239)).

| Route | Body | Does | Source |
| --- | --- | --- | --- |
| `GET /` | | The latest report, flagged as served locally, never cached. | [src/cli.ts:166-170](../../src/cli.ts#L166-L170) |
| `POST /api/refresh` | | Re-reads the vault and rebuilds the report; concurrent calls share one run. | [src/cli.ts:151-165](../../src/cli.ts#L151-L165) |
| `POST /api/settings` | Settings panel fields | Saves preset, focus, protect list, per-type settings and DIM switches. | [src/cli.ts:120-129](../../src/cli.ts#L120-L129) |
| `POST /api/tag` | `id`, `tag` or null, `notes?` | Sets or clears a DIM tag. | [src/cli.ts:96-107](../../src/cli.ts#L96-L107) |
| `POST /api/move` | `ids`, `to`, `equip?` | Moves items, optionally equipping them. | [src/cli.ts:108-119](../../src/cli.ts#L108-L119) |
| `POST /api/locks/apply` | `planId`, `confirm: true` | Applies the current plan only. | [src/cli.ts:131-141](../../src/cli.ts#L131-L141) |
| `POST /api/locks/undo` | `planId` | Undoes an applied plan. | [src/cli.ts:142-150](../../src/cli.ts#L142-L150) |

## Environment variables

| Variable | Used for | Source |
| --- | --- | --- |
| `BUNGIE_API_KEY` | Every Bungie request. Required. | [src/config.ts:24-26](../../src/config.ts#L24-L26) |
| `BUNGIE_CLIENT_ID` | OAuth login. | [src/config.ts:29](../../src/config.ts#L29) |
| `BUNGIE_CLIENT_SECRET` | OAuth token requests (Confidential app). | [src/config.ts:30](../../src/config.ts#L30) |
| `BUNGIE_REDIRECT_URL` | Default `https://localhost:7777/callback`; the web app's local mode also takes its port from it. | [src/config.ts:31](../../src/config.ts#L31), [web/local-server.ts:21-27](../../web/local-server.ts#L21-L27) |
| `VAULT_RATER_HOME` | Data folder, default `~/.d2-vault-rater`. | [src/config.ts:5](../../src/config.ts#L5) |
| `VAULT_RATER_PORT` | `serve` port, default 7780. | [src/cli.ts:215](../../src/cli.ts#L215) |
| `VAULT_RATER_NO_OPEN` | Don't open a browser window. | [src/cli.ts:37](../../src/cli.ts#L37) |
| `VR_NO_SSL` | Web app local mode over plain http. | [web/vite.config.ts:60-61](../../web/vite.config.ts#L60-L61) |

`.env` values never override variables already set in the environment ([src/cli.ts:33](../../src/cli.ts#L33), [web/local-server.ts:14-18](../../web/local-server.ts#L14-L18)). See [.env.example](../../.env.example).
