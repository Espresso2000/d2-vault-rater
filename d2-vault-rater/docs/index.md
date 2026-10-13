# Vault Rater documentation

Vault Rater rates every weapon and armor piece in a Destiny 2 vault against Aegis's tier list and community wishlists, says what to keep and what to shard, and can lock keepers, unlock junk, move items and tag them in DIM after you approve. It runs as an MCP tool server for an AI client ([src/server.ts:32](../src/server.ts#L32)), as a command-line app with a local report page ([src/cli.ts:191](../src/cli.ts#L191)), or as a static web app in the browser ([web/src/main.ts:269](../web/src/main.ts#L269)).

## How these docs are organised

The docs follow [Diátaxis](https://diataxis.fr/), which splits documentation by what you need at the moment:

| Section | Use it when you want to… | Written as |
| --- | --- | --- |
| [Tutorials](#tutorials) | learn the tool by using it once, start to finish | a lesson: follow the steps in order |
| [How-to guides](#how-to-guides) | get one specific job done | a recipe: assumes you already know the basics |
| [Reference](#reference) | look up a command, setting, route, file or source | dry, complete lists and tables |
| [Explanation](#explanation) | understand how and why it works the way it does | discussion: design, trade-offs, rules |

Every statement about the code links to the lines it describes, and `npm run docs:check` verifies those links ([scripts/check-doc-refs.mjs](../scripts/check-doc-refs.mjs)). Outside sources (the Bungie.net API, the manifest, DIM, Aegis's sheet, wishlists and so on) are listed in [References](reference/references.md) and cited where a page relies on them.

## Tutorials

- [Your first vault report](tutorials/first-vault-report.md): set up a Bungie app, rate your vault from the command line, and read the report.
- [Run the web app on your PC](tutorials/web-app-on-your-pc.md): the same rater in your browser, and your first build in the Builds tab.

## How-to guides

- [Connect Claude or another MCP client](how-to/connect-an-ai-client.md)
- [Make the rating stricter or more lenient](how-to/tune-strictness.md)
- [Keep an item from ever being marked for sharding](how-to/protect-items.md)
- [Move and equip items](how-to/move-and-equip-items.md)
- [Lock keepers, unlock junk, and undo it](how-to/apply-and-undo-locks.md)
- [Fix tier list and source import problems](how-to/fix-source-imports.md)
- [Host the web app on a static site](how-to/host-the-web-app.md)
- [Run the checks before you commit](how-to/develop-and-check.md)

## Reference

- [MCP tools](reference/mcp-tools.md): every tool, its inputs and whether it changes anything in game.
- [CLI, local server and environment](reference/cli-and-local-server.md): commands, routes, environment variables.
- [Settings](reference/settings.md): every field, the strictness presets, how overrides combine.
- [The report page](reference/report-page.md): every tab, the Vault tab's modes and toolbar, perk display, and what the page remembers.
- [Data files and browser storage](reference/data-files.md): what is saved where.
- [Source layout](reference/source-layout.md): what each file does.
- [References](reference/references.md): the APIs, data and community projects the rater relies on, with links.

## Explanation

- [How the pieces fit together](explanation/architecture.md): one rating core, three front ends, and how the web app reuses Node code.
- [How weapons are rated](explanation/weapon-rating.md)
- [How armor is rated](explanation/armor-rating.md)
- [Raids, dungeons and encounter loadouts](explanation/raids-dungeons-encounters.md)
- [What is cached, where, and when it is thrown away](explanation/caching.md)
- [Why nothing changes in game until you say so](explanation/safety.md)
- [The Builds tab](explanation/builds-tab.md)
- [UX review: what was messy, and what changed](explanation/ux-review.md)
