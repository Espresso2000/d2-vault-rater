/**
 * Rating sources in the browser. Aegis's sheet, the armor set sheets and the voltron wishlist all
 * allow cross-origin reads, so they refresh live once a day like the local app. If a sheet can't be
 * read, the snapshot shipped with the site (public/data/sources.json) is used instead.
 */
import { importAegis, loadAegis, matchHashes, aegisFile, type AegisData } from "../../src/sources/aegis.js";
import { importArmorSets, loadArmorSets, armorSetsFile, type ArmorSetData } from "../../src/sources/armorSets.js";
import { parseWishlist, loadWishlists, wishlistFile, DEFAULT_WISHLISTS, type WishRoll } from "../../src/sources/wishlist.js";
import { importActivityLoot, loadActivityLoot } from "../../src/sources/activities.js";
import { writeJson } from "./shims/config";
import type { Manifest } from "./shims/manifest";
import type { Settings } from "../../src/rating/settings.js";

const ageHours = (iso?: string) => (iso ? (Date.now() - Date.parse(iso)) / 3_600_000 : Infinity);

let snapshot: Promise<{ aegis: AegisData; armorSets: ArmorSetData } | null> | null = null;
const loadSnapshot = () => (snapshot ??= fetch("data/sources.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));

export interface SourceStatus {
  aegis: string;
  wishlist: string;
  armorSets: string;
  warnings: string[];
}

export async function ensureSources(m: Manifest, settings: Settings, log: (s: string) => void, force = false): Promise<SourceStatus> {
  const warnings: string[] = [];
  const stale = (iso?: string) => force || ageHours(iso) > 24;

  let aegis = loadAegis();
  // Re-match names to hashes when the game version changed since the import.
  if (stale(aegis?.importedAt)) {
    log("Importing Aegis's tier list…");
    try {
      aegis = await importAegis(m, settings.aegisTabs);
    } catch (e) {
      warnings.push(`Aegis's sheet: ${(e as Error).message}`);
    }
  }
  if (!aegis) {
    const snap = await loadSnapshot();
    if (!snap) throw new Error("Couldn't read Aegis's tier list and the site has no snapshot of it.");
    const fromSnap: AegisData = { ...snap.aegis, warnings: ["Using the tier list snapshot shipped with the site."] };
    fromSnap.unmatched = matchHashes(fromSnap.weapons, m);
    writeJson(aegisFile(), (aegis = fromSnap));
  }

  const wl = loadWishlists();
  if (stale(wl?.importedAt)) {
    log("Importing the community wishlist (voltron)…");
    try {
      const urls = settings.wishlists.length ? settings.wishlists : DEFAULT_WISHLISTS;
      const rolls: WishRoll[] = [];
      for (const u of urls) {
        const res = await fetch(u);
        if (!res.ok) throw new Error(`${u} -> ${res.status}`);
        // Notes are dropped: the rater only reads perks, and notes make the cache ~10x bigger.
        for (const r of parseWishlist(await res.text())) rolls.push({ itemHash: r.itemHash, perks: r.perks, trash: r.trash, notes: "" });
      }
      writeJson(wishlistFile(), { importedAt: new Date().toISOString(), sources: urls, rolls });
    } catch (e) {
      warnings.push(`Wishlist: ${(e as Error).message}`);
    }
  }

  let sets = loadArmorSets();
  if (stale(sets?.importedAt)) {
    log("Importing armor set tiers…");
    try {
      sets = await importArmorSets();
    } catch (e) {
      warnings.push(`Armor sets: ${(e as Error).message}`);
    }
  }
  if (!sets) {
    const snap = await loadSnapshot();
    if (snap?.armorSets) writeJson(armorSetsFile(), (sets = snap.armorSets));
  }

  const loot = loadActivityLoot();
  if (stale(loot?.importedAt) || loot?.manifestVersion !== m.version) {
    log("Mapping raid and dungeon loot…");
    await importActivityLoot(m, aegis as AegisData, sets).catch((e) => warnings.push(`Raid and dungeon loot: ${(e as Error).message}`));
  }

  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "not loaded");
  return { aegis: when(loadAegis()?.importedAt), wishlist: when(loadWishlists()?.importedAt), armorSets: when(loadArmorSets()?.importedAt), warnings };
}
