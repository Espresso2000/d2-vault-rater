#!/usr/bin/env node
/**
 * Run the vault rater on its own, without an AI client.
 *
 *   vault-rater            log in if needed, rate the vault and open the report
 *   vault-rater serve      the same, then keep a local page open with a "Re-rate my vault" button
 *   vault-rater login      log in to Bungie again
 *   vault-rater refresh    re-download Aegis's sheet, wishlists and armor set tiers
 *   vault-rater apply ID   lock keepers and unlock junk from a plan (asks first)
 *   vault-rater undo ID    put every lock an applied plan changed back
 */
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { parseEnv } from "node:util";
import { ensureDirs } from "./config.js";
import { startLogin, finishLogin } from "./bungie/oauth.js";
import { buildReport, loggedIn, refreshSources, type ReportResult } from "./pipeline.js";
import { applyDimActions, loadPlan, undoDimActions } from "./dim/actions.js";
import { setDimTag, DIM_TAGS, type DimTagValue } from "./dim/sync.js";
import { moveItems } from "./bungie/transfer.js";
import { applyPageSettings, loadSettings, saveSettings } from "./rating/settings.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Load KEY=value lines from .env next to package.json; real environment variables win. */
function loadEnv() {
  const file = join(root, ".env");
  if (!existsSync(file)) return;
  for (const [k, v] of Object.entries(parseEnv(readFileSync(file, "utf8")))) if (v && process.env[k] === undefined) process.env[k] = v;
}

function openInBrowser(target: string) {
  if (process.env.VAULT_RATER_NO_OPEN) return;
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", '""', `"${target}"`]] : process.platform === "darwin" ? ["open", [target]] : ["xdg-open", [target]];
  try {
    spawn(cmd, args as string[], { detached: true, stdio: "ignore", windowsVerbatimArguments: process.platform === "win32" }).unref();
  } catch {
    console.log(`Open this in your browser: ${target}`);
  }
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function login() {
  const url = startLogin();
  console.log("\nLog in to Bungie in the browser window that just opened. If none opened, use this link:\n");
  console.log(`  ${url}\n`);
  console.log("After you approve, the browser goes to a localhost page that fails to load. That is expected.");
  openInBrowser(url);
  const landed = await ask("Copy the full address from the browser's address bar and paste it here: ");
  const me = await finishLogin(landed.startsWith("http") ? landed : `https://${landed}`);
  console.log(`\nLogged in as ${me.displayName}.\n`);
}

const log = (s: string) => console.log(`  ${s}`);

function summary(r: ReportResult) {
  console.log(`\nDone. ${r.weapons.total} weapons (${r.weapons.shard} to shard) and ${r.armor.total} armor pieces (${r.armor.shard} to shard).`);
  console.log(`Report: ${r.file}`);
  console.log(`Dry-run lock plan: ${r.plan.id} (lock ${r.plan.counts.lock}, unlock ${r.plan.counts.unlock}). Nothing was changed in game.`);
  console.log(`To apply it: npm run vault -- apply ${r.plan.id}\n`);
}

async function serve(port: number) {
  let latest = await buildReport(log);
  summary(latest);
  let busy: Promise<void> | null = null;
  const json = (res: import("node:http").ServerResponse, code: number, body: unknown) => res.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(body));
  const readBody = (req: import("node:http").IncomingMessage) =>
    new Promise<Record<string, unknown>>((ok) => {
      let b = "";
      req.on("data", (c) => (b += c)).on("end", () => {
        try {
          ok(JSON.parse(b || "{}"));
        } catch {
          ok({});
        }
      });
    });
  const server = createServer(async (req, res) => {
    // Only accept writes from the page this server serves.
    const sameSite = !req.headers.origin || req.headers.origin === `http://localhost:${port}` || req.headers.origin === `http://127.0.0.1:${port}`;
    if (req.method === "POST" && !sameSite) return json(res, 403, { ok: false, error: "Wrong origin" });
    if (req.method === "POST" && req.url === "/api/tag") {
      const b = await readBody(req);
      const tag = b.tag === null || DIM_TAGS.includes(b.tag as DimTagValue) ? (b.tag as DimTagValue | null) : undefined;
      if (typeof b.id !== "string" || tag === undefined) return json(res, 400, { ok: false, error: "Send an item id and a DIM tag (or null to clear)." });
      try {
        await setDimTag(b.id, tag, typeof b.notes === "string" || b.notes === null ? (b.notes as string | null) : undefined);
        console.log(`  DIM: ${tag ? `tagged ${tag}` : "cleared tag on"} ${b.id}`);
        return json(res, 200, { ok: true });
      } catch (e) {
        return json(res, 500, { ok: false, error: (e as Error).message });
      }
    }
    if (req.method === "POST" && req.url === "/api/move") {
      const b = await readBody(req);
      const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string") : [];
      if (!ids.length || typeof b.to !== "string") return json(res, 400, { ok: false, error: "Send item ids and a destination (vault or a character)." });
      try {
        const results = await moveItems(ids, b.to, { equip: b.equip === true });
        for (const m of results) console.log(`  Move: ${m.name} -> ${m.where}${m.equipped ? " (equipped)" : ""}${m.error ? ` [${m.error}]` : ""}`);
        return json(res, 200, { ok: true, results });
      } catch (e) {
        return json(res, 500, { ok: false, error: (e as Error).message });
      }
    }
    if (req.method === "POST" && req.url === "/api/settings") {
      const b = await readBody(req);
      const st = applyPageSettings(loadSettings(), b);
      try {
        saveSettings(st);
      } catch (e) {
        return json(res, 400, { ok: false, error: (e as Error).message });
      }
      return json(res, 200, { ok: true, dim: st.dim });
    }
    // Lock plan: the page shows a dry-run preview and only sends this after the player confirms.
    if (req.method === "POST" && req.url === "/api/locks/apply") {
      const b = await readBody(req);
      if (b.confirm !== true || b.planId !== latest.plan.id) return json(res, 400, { ok: false, error: "Preview the current plan and confirm it first." });
      try {
        const r = await applyDimActions(latest.plan.id);
        console.log(`  Locks: locked ${r.locked}, unlocked ${r.unlocked}, failed ${r.failed.length} (undo: npm run vault -- undo ${r.planId})`);
        return json(res, 200, { ok: true, ...r });
      } catch (e) {
        return json(res, 500, { ok: false, error: (e as Error).message });
      }
    }
    if (req.method === "POST" && req.url === "/api/locks/undo") {
      const b = await readBody(req);
      if (typeof b.planId !== "string") return json(res, 400, { ok: false, error: "Send the plan id to undo." });
      try {
        return json(res, 200, { ok: true, ...(await undoDimActions(b.planId)) });
      } catch (e) {
        return json(res, 500, { ok: false, error: (e as Error).message });
      }
    }
    if (req.method === "POST" && req.url === "/api/refresh") {
      busy ??= buildReport(log)
        .then((r) => {
          latest = r;
          summary(r);
        })
        .finally(() => (busy = null));
      try {
        await busy;
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: (e as Error).message }));
      }
      return;
    }
    if (req.method === "GET" && (req.url === "/" || req.url?.startsWith("/#") || req.url?.startsWith("/?"))) {
      const html = readFileSync(latest.file, "utf8").replace("</head>", "<script>window.VR_LOCAL = true;</script></head>");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(html);
      return;
    }
    res.writeHead(404).end("Not found");
  });
  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}/`;
    console.log(`Your report is running at ${url}  (press Ctrl+C to stop)`);
    openInBrowser(url);
  });
}

async function main() {
  loadEnv();
  ensureDirs();
  const [cmd = "report", arg] = process.argv.slice(2);
  if (!process.env.BUNGIE_API_KEY) {
    console.error("BUNGIE_API_KEY is not set. Copy .env.example to .env and fill in your Bungie app's keys (see README).");
    process.exit(1);
  }
  if (cmd === "login" || (!loggedIn() && ["report", "serve", "apply", "undo"].includes(cmd))) await login();

  switch (cmd) {
    case "login":
      return;
    case "dim": {
      // npm run vault -- dim tags off | dim loadouts on | dim off | dim on
      const st = loadSettings();
      const [what, onOff] = [arg, process.argv[4]];
      const val = (onOff ?? what) === "on";
      if (what === "tags" || what === "on" || what === "off") st.dim.tags = val;
      if (what === "loadouts" || what === "on" || what === "off") st.dim.loadouts = val;
      if (what === "protect") st.dim.protectTagged = val;
      saveSettings(st);
      console.log(`DIM tags: ${st.dim.tags ? "on" : "off"}, DIM loadouts: ${st.dim.loadouts ? "on" : "off"}, protect Favorite/Keep: ${st.dim.protectTagged ? "on" : "off"}`);
      return;
    }
    case "refresh":
      console.log(await refreshSources(log));
      return;
    case "report": {
      const r = await buildReport(log);
      summary(r);
      openInBrowser(r.file);
      return;
    }
    case "serve":
      return serve(Number(process.env.VAULT_RATER_PORT) || 7780);
    case "apply": {
      if (!arg) throw new Error("Give the plan id to apply, e.g. npm run vault -- apply 2026-10-01T23-46-27-720Z-f23ed8");
      const plan = loadPlan(arg);
      console.log(`\nPlan ${plan.id}: lock ${plan.counts.lock} items, unlock ${plan.counts.unlock} items.`);
      console.log("Equipped items, Adept copies and protected items are never unlocked. You can undo this afterwards.");
      if ((await ask('Type "yes" to change these locks in game: ')).toLowerCase() !== "yes") return console.log("Nothing changed.");
      const res = await applyDimActions(arg);
      console.log(`Locked ${res.locked}, unlocked ${res.unlocked}, failed ${res.failed.length}.`);
      console.log(`DIM tags CSV: ${res.csvFile} (DIM: Settings > Spreadsheets > Import tags/notes).`);
      console.log(`To undo: npm run vault -- undo ${arg}`);
      return;
    }
    case "undo": {
      if (!arg) throw new Error("Give the plan id to undo.");
      if ((await ask(`Type "yes" to restore every lock plan ${arg} changed: `)).toLowerCase() !== "yes") return console.log("Nothing changed.");
      console.log(await undoDimActions(arg));
      return;
    }
    default:
      console.log("Commands: report (default), serve, login, refresh, dim <tags|loadouts|protect|on|off> [on|off], apply <plan-id>, undo <plan-id>");
  }
}

main().catch((e) => {
  console.error(`\nError: ${(e as Error).message}`);
  process.exit(1);
});
