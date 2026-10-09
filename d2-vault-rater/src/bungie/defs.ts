/**
 * The browser-safe half of the manifest module: definition types and name helpers.
 * manifest.ts (Node) and the web app's manifest shim both re-export this, so there is one copy.
 */
import type { Element } from "../vault/types.js";

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

/** Element names by Bungie damage type. */
export const DAMAGE_TYPES: Record<number, Element> = { 1: "Kinetic", 2: "Arc", 3: "Solar", 4: "Void", 6: "Stasis", 7: "Strand" };

/** A game version as a file-name-safe string (manifest folders and snapshot files). */
export const versionSlug = (version: string): string => version.replace(/[^\w.-]/g, "_");

// ponytail: unbounded cache, fine while keys are game item and perk names (tens of thousands at most).
const normalized = new Map<string, string>();

/** Lower case, accents and quotes removed, everything else non-alphanumeric as single spaces. Cached: the rater asks for the same names constantly. */
export function normalizeName(s: string): string {
  let n = normalized.get(s);
  if (n === undefined) {
    n = s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[‘’“”'"]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    normalized.set(s, n);
  }
  return n;
}

/** A weapon name without its "(Adept)", "(Timelost)" or "(Harrowed)" suffix. */
export const stripReissue = (name: string): string => name.replace(/\s*\((adept|timelost|harrowed)\)\s*$/i, "");

/** The normalized name every copy of a weapon shares, Adept and Timelost versions included. */
export const baseName = (name: string): string => normalizeName(stripReissue(name));

/** name -> every weapon hash with that name (reissues share names). */
export function weaponHashesByName(m: Manifest): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const d of Object.values(m.items)) {
    if (d.itemType !== 3 || !d.displayProperties?.name) continue;
    const key = baseName(d.displayProperties.name);
    const list = out.get(key) ?? [];
    list.push(d.hash);
    out.set(key, list);
  }
  return out;
}
