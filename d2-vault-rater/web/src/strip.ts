/**
 * The stripped manifest the web app ships and keeps in IndexedDB (~4 MB instead of ~200 MB): the
 * shared strip functions in src/bungie/strip.ts, minus cosmetic plugs.
 * Used by the manifest worker (in the browser) and the snapshot script (in Node).
 */
import { stripActivities, stripCollectibles, stripItems, stripNamed, type Raw } from "../../src/bungie/strip.js";

export const TABLES = {
  items: ["DestinyInventoryItemDefinition", (t: Raw) => stripItems(t)],
  stats: ["DestinyStatDefinition", stripNamed],
  itemSets: ["DestinyEquipableItemSetDefinition", stripNamed],
  collectibles: ["DestinyCollectibleDefinition", stripCollectibles],
  activities: ["DestinyActivityDefinition", stripActivities],
} as const;

export type TableKey = keyof typeof TABLES;

/** The stripped manifest the web app keeps: the rater's Manifest plus the two "extra" tables. */
export interface LiteManifest {
  version: string;
  items: Raw;
  stats: Raw;
  itemSets: Raw;
  collectibles: Raw;
  activities: Raw;
}

/** In a worker: download one manifest table from bungie.net, telling the page which. */
export async function downloadTable(paths: Record<string, string>, table: string): Promise<Raw> {
  self.postMessage({ progress: `Downloading ${table.replace(/^Destiny|Definition$/g, "")} definitions…` });
  const res = await fetch("https://www.bungie.net" + paths[table]);
  if (!res.ok) throw new Error(`Manifest download failed for ${table}: ${res.status}`);
  return res.json();
}
