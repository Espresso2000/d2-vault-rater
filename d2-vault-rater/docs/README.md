# Vault Rater documentation

Vault Rater rates every weapon and armor piece in a Destiny 2 vault against Aegis's tier list and community wishlists, says what to keep and what to shard, and can lock keepers, unlock junk, move items and tag them in DIM after you approve. It runs as an MCP tool server for an AI client ([src/server.ts:32](../src/server.ts#L32)), as a command-line app with a local report page ([src/cli.ts:180](../src/cli.ts#L180)), or as a static web app in the browser ([web/src/main.ts:242](../web/src/main.ts#L242)).

These docs follow [Diátaxis](https://diataxis.fr/): tutorials to learn by doing, how-to guides for a specific job, reference to look things up, and explanation for how and why it works. Every statement about the code links to the lines it describes; `npm run docs:check` verifies those links ([scripts/check-doc-refs.mjs](../scripts/check-doc-refs.mjs)).

## Tutorials

- [Your first vault report](tutorials/first-vault-report.md): set up a Bungie app, rate your vault from the command line, and read the report.
- [Run the web app on your PC](tutorials/web-app-on-your-pc.md): the same rater in your browser, and your first build in the Builds tab.

## How-to guides

- [Connect Claude or another MCP client](how-to/connect-an-ai-client.md)
- [Make the rating stricter or more lenient](how-to/tune-strictness.md)
- [Keep an item from ever being marked for sharding](how-to/protect-items.md)
- [Lock keepers, unlock junk, and undo it](how-to/apply-and-undo-locks.md)
- [Fix tier list and source import problems](how-to/fix-source-imports.md)
- [Host the web app on a static site](how-to/host-the-web-app.md)
- [Run the checks before you commit](how-to/develop-and-check.md)

## Reference

- [MCP tools](reference/mcp-tools.md): every tool, its inputs and whether it changes anything in game.
- [CLI, local server and environment](reference/cli-and-local-server.md): commands, routes, environment variables.
- [Settings](reference/settings.md): every field, the strictness presets, how overrides combine.
- [Data files and browser storage](reference/data-files.md): what is saved where.
- [Source layout](reference/source-layout.md): what each file does.

## Explanation

- [How the pieces fit together](explanation/architecture.md): one rating core, three front ends, and how the web app reuses Node code.
- [How weapons are rated](explanation/weapon-rating.md)
- [How armor is rated](explanation/armor-rating.md)
- [Raids, dungeons and encounter loadouts](explanation/raids-dungeons-encounters.md)
- [What is cached, where, and when it is thrown away](explanation/caching.md)
- [Why nothing changes in game until you say so](explanation/safety.md)
- [The Builds tab](explanation/builds-tab.md)
