/**
 * Browser version of src/bungie/manifest.ts. The web app loads the (stripped) manifest itself
 * (see ../manifest.ts) and hands it over with setManifest(); loadManifest() just returns it.
 */

/** The subset of DestinyInventoryItemDefinition the rater reads. */
export interface ItemDef {
  hash: number;
  displayProperties: { name: string; icon?: string; description?: string };
  screenshot?: string;
  itemType: number;
  itemTypeDisplayName?: string;
  classType?: number;
  defaultDamageType?: number;
  inventory?: { bucketTypeHash: number; tierType: number; tierTypeName?: string };
  equippingBlock?: { ammoType?: number; equipableItemSetHash?: number };
  sockets?: {
    socketEntries: { socketTypeHash: number; singleInitialItemHash: number }[];
    socketCategories: { socketCategoryHash: number; socketIndexes: number[] }[];
  };
  plug?: { plugCategoryIdentifier: string };
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

let cached: Manifest | null = null;

export async function loadManifest(): Promise<Manifest> {
  if (!cached) throw new Error("The Destiny manifest isn't loaded yet.");
  return cached;
}

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
