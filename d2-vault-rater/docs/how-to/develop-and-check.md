# Run the checks before you commit

From the package folder:

```bash
npm test
npm run typecheck
npm run docs:check
```

And for the web app:

```bash
cd web
npm run typecheck
npm run build
```

## What each one covers

- **`npm test`** runs every `test/*.test.ts` with Node's test runner ([package.json](../../package.json)): [test/rater.test.ts](../../test/rater.test.ts) (sheet, CSV and wishlist parsing, vault decoding, weapon and armor rating, strictness presets, the lock plan with apply and undo, the markdown report, armor sets, encounter loadouts, DIM tags, item moves, the parsed-file cache, accent-free name matching, the embedded raid and dungeon art, and encounter plans for an empty vault or apostrophe names), [test/builds.test.ts](../../test/builds.test.ts) (the Builds tab's sheets, definitions, rating, mods, stats, drafts, DIM loadout round trip, equip dry runs and Clarity notes), [test/perk.test.ts](../../test/perk.test.ts) (the perk switch request, its no-op and errors), [test/web.test.ts](../../test/web.test.ts) (the web app's sign-in check and snapshot name) [test/vendors.test.ts](../../test/vendors.test.ts) (decoding and rating vendor stock) and [test/query.test.ts](../../test/query.test.ts) (the report page's DIM-style search, read straight out of the page between its `QUERY-BEGIN` and `QUERY-END` markers, [report-template/site.html:1999](../../report-template/site.html#L1999), [test/query.test.ts:6-7](../../test/query.test.ts#L6-L7)). They use fixtures only, no network: a fake manifest and profile ([test/fixtures/build.ts:47](../../test/fixtures/build.ts#L47), [test/fixtures/build.ts:78](../../test/fixtures/build.ts#L78)) and a copy of one Aegis tab ([test/fixtures/aegis-smg.csv](../../test/fixtures/aegis-smg.csv)). A temporary data folder keeps them away from your real one ([test/env.ts:5](../../test/env.ts#L5)).
- **`npm run typecheck`** is strict TypeScript and also fails on unused variables, imports and parameters ([tsconfig.json](../../tsconfig.json)). The web app's typecheck covers its own code and the shared `src/` it imports ([web/tsconfig.json](../../web/tsconfig.json)).
- **`npm run docs:check`** checks that every relative link in `docs/` points at a file that exists, that `#L<n>` anchors are inside the file, and that link text like `file.ts:42` names the anchored line ([scripts/check-doc-refs.mjs](../../scripts/check-doc-refs.mjs)). Run it after changing code that the docs cite: a moved line makes it fail, and the message names the doc and link to fix.
- **`npm run build`** in `web/` proves the shims still cover every Node-only import ([web/vite.config.ts:22-34](../../web/vite.config.ts#L22-L34)).

## Changing shared code

Code in `src/` runs in Node and, through the shims, in the browser. Before adding a Node import to a shared module:

- `node:fs`, `node:path`, `node:os`, `node:crypto` and `node:url` only work in the browser through the small stand-ins in [web/src/shims/node.ts](../../web/src/shims/node.ts); a function missing there breaks the web build or fails at run time.
- Logic that both sides need belongs in a browser-safe module that the Node file and the shim both re-export, like [src/bungie/defs.ts](../../src/bungie/defs.ts) or [src/dim/common.ts](../../src/dim/common.ts).

## Running the apps from source

- MCP server: `npm run dev` ([package.json](../../package.json)).
- Web app with hot reload: `cd web && npm run dev` (port 5173, [web/vite.config.ts:63](../../web/vite.config.ts#L63)). Bungie sign-in needs the https local mode instead: see the [web app tutorial](../tutorials/web-app-on-your-pc.md).
