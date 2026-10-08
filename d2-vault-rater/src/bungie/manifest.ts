import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../config.js";
import { bungie, BUNGIE } from "./client.js";
import { versionSlug, type Manifest } from "./defs.js";

export * from "./defs.js";

const COMPONENTS = {
  items: "DestinyInventoryItemDefinition",
  stats: "DestinyStatDefinition",
  itemSets: "DestinyEquipableItemSetDefinition",
} as const;

let cached: Manifest | null = null;

/** Download (once per game version) and load the manifest tables the rater needs. */
export async function loadManifest(opts: { force?: boolean } = {}): Promise<Manifest> {
  const meta = await bungie<{ version: string; jsonWorldComponentContentPaths: Record<string, Record<string, string>> }>(
    "/Destiny2/Manifest/",
    { auth: false },
  );
  if (cached && cached.version === meta.version && !opts.force) return cached;
  const dir = join(paths.manifestDir, versionSlug(meta.version));
  mkdirSync(dir, { recursive: true });
  const en = meta.jsonWorldComponentContentPaths.en;
  const out: Partial<Manifest> = { version: meta.version };
  for (const [key, table] of Object.entries(COMPONENTS)) {
    const file = join(dir, `${table}.json`);
    if (!existsSync(file) || opts.force) {
      const res = await fetch(BUNGIE + en[table]);
      if (!res.ok) throw new Error(`Manifest download failed for ${table}: ${res.status}`);
      writeFileSync(file, await res.text());
    }
    (out as Record<string, unknown>)[key] = JSON.parse(readFileSync(file, "utf8"));
  }
  cached = out as Manifest;
  return cached;
}

/** Use an in-memory manifest (tests, or a pre-loaded copy). */
export function setManifest(m: Manifest): void {
  cached = m;
}

export function currentManifest(): Manifest | null {
  return cached;
}
