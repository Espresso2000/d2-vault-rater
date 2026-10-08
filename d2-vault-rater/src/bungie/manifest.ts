import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../config.js";
import { bungie, BUNGIE } from "./client.js";

/** The subset of DestinyInventoryItemDefinition the rater reads. */
export interface ItemDef {
  hash: number;
  displayProperties: { name: string; icon?: string; description?: string };
  screenshot?: string;
  itemType: number; // 2 armor, 3 weapon, 19 mod/plug
  itemTypeDisplayName?: string;
  classType?: number; // 0 Titan, 1 Hunter, 2 Warlock, 3 any
  defaultDamageType?: number;
  inventory?: { bucketTypeHash: number; tierType: number; tierTypeName?: string };
  equippingBlock?: { ammoType?: number; equipableItemSetHash?: number };
  sockets?: {
    socketEntries: { socketTypeHash: number; singleInitialItemHash: number }[];
    socketCategories: { socketCategoryHash: number; socketIndexes: number[] }[];
  };
  plug?: { plugCategoryIdentifier: string };
  /** Links to DestinyCollectibleDefinition, which holds the "Source: ..." text. */
  collectibleHash?: number;
}

export interface StatDef {
  hash: number;
  displayProperties: { name: string };
}

export interface ItemSetDef {
  hash: number;
  displayProperties: { name: string };
}

export interface Manifest {
  version: string;
  items: Record<string, ItemDef>;
  stats: Record<string, StatDef>;
  itemSets: Record<string, ItemSetDef>;
}

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
  const dir = join(paths.manifestDir, meta.version.replace(/[^\w.-]/g, "_"));
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

export const normalizeName = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[‘’“”'"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** name -> every weapon hash with that name (reissues share names). */
export function weaponHashesByName(m: Manifest): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const d of Object.values(m.items)) {
    if (d.itemType !== 3 || !d.displayProperties?.name) continue;
    const key = normalizeName(d.displayProperties.name.replace(/\s*\((adept|timelost|harrowed)\)\s*$/i, ""));
    const list = out.get(key) ?? [];
    list.push(d.hash);
    out.set(key, list);
  }
  return out;
}
