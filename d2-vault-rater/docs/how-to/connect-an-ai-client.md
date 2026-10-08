# Connect Claude (or another MCP client)

The MCP server is `dist/server.js`, a stdio server ([src/server.ts:420](../../src/server.ts#L420)). It needs the same Bungie app as the local app (Confidential, redirect `https://localhost:7777/callback`; see the [tutorial](../tutorials/first-vault-report.md#1-create-a-bungie-app)).

1. Build it: `npm install && npm run build`.
2. Register it with your client, passing the keys as environment variables ([src/config.ts:24-33](../../src/config.ts#L24-L33)).

   Claude Desktop, in `claude_desktop_config.json`:

   ```json
   {
     "mcpServers": {
       "d2-vault-rater": {
         "command": "node",
         "args": ["/path/to/d2-vault-rater/dist/server.js"],
         "env": { "BUNGIE_API_KEY": "...", "BUNGIE_CLIENT_ID": "...", "BUNGIE_CLIENT_SECRET": "..." }
       }
     }
   }
   ```

   Claude Code:

   ```bash
   claude mcp add d2-vault-rater -e BUNGIE_API_KEY=... -e BUNGIE_CLIENT_ID=... -e BUNGIE_CLIENT_SECRET=... -- node /path/to/dist/server.js
   ```

   The server does not read `.env`; only the CLI does ([src/cli.ts:29-34](../../src/cli.ts#L29-L34)).
3. Give the AI its instructions. The server offers them as the `vault_review` prompt ([src/server.ts:118-122](../../src/server.ts#L118-L122)), read from [skill/SKILL.md](../../skill/SKILL.md) ([src/server.ts:30](../../src/server.ts#L30)). In Claude Code you can also copy the `skill` folder to `~/.claude/skills/d2-vault-review/`.
4. Ask "Review my Destiny vault." The first time, the AI calls `login` and gives you a bungie.net link; approve it and paste back the address your browser lands on, even though that page doesn't load ([src/server.ts:124-136](../../src/server.ts#L124-L136), [src/bungie/oauth.ts:21-35](../../src/bungie/oauth.ts#L21-L35)). Then it calls `refresh_sources` once before rating ([skill/SKILL.md:12-15](../../skill/SKILL.md#L12-L15)).

Tokens and caches go to `~/.d2-vault-rater`, or `VAULT_RATER_HOME` if set in the server's `env` ([src/config.ts:5](../../src/config.ts#L5)). Every tool is listed in the [MCP tools reference](../reference/mcp-tools.md).
