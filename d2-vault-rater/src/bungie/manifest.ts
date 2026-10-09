import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../config.js";
import { bungie } from "./client.js";
import { versionSlug, type Manifest } from "./defs.js";
import { STRIP_FORMAT, stripItems, stripNamed, type Raw } from "./strip.js";
import { liteTable } from "./tables.js";

export * from "./defs.js";

/** Every plug is kept so vault decoding sees what the full item table has. */
const COMPONENTS: [keyof Omit<Manifest, "version">, string, (t: Raw) => Raw][] = [
  ["items", "DestinyInventoryItemDefinition", (t) => stripItems(t, true)],
  ["stats", "DestinyStatDefinition", stripNamed],
  ["itemSets", "DestinyEquipableItemSetDefinition", stripNamed],
];

let cached: Manifest | null = null;

/** Download (once per game version), strip and load the manifest tables the rater needs. */
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
  // The item table's cache file names its strip format, so an older cache without plug icons is rebuilt.
  for (const [key, table, strip] of COMPONENTS) out[key] = await liteTable(dir, table, async () => en[table], strip, opts.force, key === "items" ? `.v${STRIP_FORMAT}` : "");
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
