/**
 * Builds the data the site ships with (run before `vite build`; see package.json "snapshot"):
 *   public/data/manifest-<version>.json  the stripped manifest for the live game version
 *   public/data/sources.json             Aegis's tier list and armor set tiers, used if the sheets can't be read
 * The manifest key comes from BUNGIE_API_KEY (or ../.env). Sources come from the local app's cache
 * (~/.d2-vault-rater/sources), so run the local app's refresh first if they're old.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { TABLES, type LiteManifest, type TableKey } from "../src/strip";
import { stripBuildDefs } from "../src/builds/defs.strip";
import { versionSlug } from "../../src/bungie/defs.js";

const here = resolve(import.meta.dirname, "..");
const out = join(here, "public", "data");
mkdirSync(out, { recursive: true });

function apiKey(): string {
  if (process.env.BUNGIE_API_KEY) return process.env.BUNGIE_API_KEY;
  const env = join(here, "..", ".env");
  const m = existsSync(env) && readFileSync(env, "utf8").match(/^\s*BUNGIE_API_KEY\s*=\s*(\S+)/m);
  if (!m) throw new Error("Set BUNGIE_API_KEY (any Bungie API key works for the manifest).");
  return m[1];
}

const meta = (await (await fetch("https://www.bungie.net/Platform/Destiny2/Manifest/", { headers: { "X-API-Key": apiKey() } })).json()).Response as {
  version: string;
  jsonWorldComponentContentPaths: Record<string, Record<string, string>>;
};
const file = `manifest-${versionSlug(meta.version)}.json`;
if (existsSync(join(out, file))) console.log(`Manifest ${meta.version} snapshot is current.`);
else {
  const lite = { version: meta.version } as LiteManifest;
  for (const [k, [table, strip]] of Object.entries(TABLES) as [TableKey, (typeof TABLES)[TableKey]][]) {
    console.log(`Downloading ${table}…`);
    const res = await fetch("https://www.bungie.net" + meta.jsonWorldComponentContentPaths.en[table]);
    if (!res.ok) throw new Error(`${table}: ${res.status}`);
    lite[k] = strip(await res.json());
  }
  for (const f of readdirSync(out)) if (/^manifest-.*\.json$/.test(f)) rmSync(join(out, f));
  writeFileSync(join(out, file), JSON.stringify(lite));
  console.log(`Wrote ${file}`);
}

// The Builds tab's definitions (subclasses, aspects, fragments, mods), so browsers skip the 200 MB item table.
const buildsFile = `builds-${versionSlug(meta.version)}.json`;
if (!existsSync(join(out, buildsFile))) {
  const get = async (t: string) => (await fetch("https://www.bungie.net" + meta.jsonWorldComponentContentPaths.en[t])).json();
  console.log("Downloading the Builds tab's definitions…");
  const defs = stripBuildDefs(meta.version, await get("DestinyInventoryItemDefinition"), await get("DestinyPlugSetDefinition"), await get("DestinySandboxPerkDefinition"), await get("DestinyLoadoutConstantsDefinition"));
  for (const f of readdirSync(out)) if (/^builds-.*\.json$/.test(f)) rmSync(join(out, f));
  writeFileSync(join(out, buildsFile), JSON.stringify(defs));
  console.log(`Wrote ${buildsFile}`);
}

const src = join(process.env.VAULT_RATER_HOME || join(homedir(), ".d2-vault-rater"), "sources");
const aegis = JSON.parse(readFileSync(join(src, "aegis.json"), "utf8"));
for (const w of aegis.weapons) w.hashes = [];
const armorSets = JSON.parse(readFileSync(join(src, "armor-sets.json"), "utf8"));
writeFileSync(join(out, "sources.json"), JSON.stringify({ aegis: { ...aegis, unmatched: [], warnings: [] }, armorSets }));
console.log(`Wrote sources.json (Aegis ${aegis.importedAt}, armor sets ${armorSets.importedAt})`);
