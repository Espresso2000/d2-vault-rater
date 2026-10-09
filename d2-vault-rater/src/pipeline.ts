import { ensureDirs } from "./config.js";
import { loadManifest } from "./bungie/manifest.js";
import { loadTokens } from "./bungie/client.js";
import { fetchVault } from "./vault/fetch.js";
import { fetchWrapped } from "./vault/wrapped.js";
import { importAegis, loadAegis } from "./sources/aegis.js";
import { importWishlists, loadWishlists, DEFAULT_WISHLISTS } from "./sources/wishlist.js";
import { importArmorSets, loadArmorSets } from "./sources/armorSets.js";
import { loadSettings } from "./rating/settings.js";
import { rateWeapons } from "./rating/weapons.js";
import { rateArmor } from "./rating/armor.js";
import { writeSite } from "./report/site.js";
import { planDimActions, type DimPlan } from "./dim/actions.js";
import { buildSourceLookup, importActivityLoot, loadActivityLoot } from "./sources/activities.js";
import { rateActivities } from "./rating/activities.js";
import { planEncounters } from "./rating/encounters.js";
import { fetchDimData, withDimKeep } from "./dim/sync.js";

/** The same steps the AI runs through the MCP tools, as plain functions for the local app. */

export function loggedIn(): boolean {
  const t = loadTokens();
  return !!t && Date.now() < t.refresh_expires_at;
}

/** Hours since the oldest rating source was imported, or Infinity if one is missing. */
export function sourcesAgeHours(): number {
  const dates = [loadAegis()?.importedAt, loadWishlists()?.importedAt, loadArmorSets()?.importedAt, loadActivityLoot()?.importedAt];
  if (dates.some((d) => !d)) return Infinity;
  return Math.max(...dates.map((d) => (Date.now() - Date.parse(d!)) / 3_600_000));
}

export async function refreshSources(log: (s: string) => void = () => {}) {
  const settings = loadSettings();
  log("Downloading the Destiny manifest (first run takes a minute)...");
  const manifest = await loadManifest();
  log("Importing Aegis's tier list...");
  const aegis = await importAegis(manifest, settings.aegisTabs);
  log("Importing community wishlists...");
  const wl = await importWishlists(settings.wishlists.length ? settings.wishlists : DEFAULT_WISHLISTS);
  log("Importing armor set tiers...");
  const sets = await importArmorSets().catch(() => null);
  log("Mapping raid and dungeon loot...");
  const acts = await importActivityLoot(manifest, aegis, sets ?? loadArmorSets()).catch(() => null);
  return { aegisWeapons: aegis.weapons.length, unmatched: aegis.unmatched, rolls: wl.rolls.length, sets: sets ? Object.keys(sets.sets).length : 0, activities: acts?.activities.length ?? 0 };
}

export interface ReportResult {
  file: string;
  plan: DimPlan;
  weapons: { total: number; shard: number };
  armor: { total: number; shard: number };
}

/** Read the vault, rate it, draft a dry-run lock plan, and write the interactive report. */
export async function buildReport(log: (s: string) => void = () => {}): Promise<ReportResult> {
  ensureDirs();
  if (sourcesAgeHours() > 24) await refreshSources(log);
  const saved = loadSettings();
  const manifest = await loadManifest();
  const aegis = loadAegis();
  if (!aegis) throw new Error("Aegis's tier list could not be loaded.");
  // Wrapped only needs the manifest: fetch it alongside the vault instead of after rating.
  const wrappedP = fetchWrapped(manifest).catch(() => null);
  log("Reading your vault...");
  const vault = await fetchVault();
  let dim = null, dimError: string | null = null;
  if (saved.dim.tags || saved.dim.loadouts) {
    log(`Reading DIM ${[saved.dim.tags && "tags", saved.dim.loadouts && "loadouts"].filter(Boolean).join(" and ")}...`);
    dim = await fetchDimData(saved.dim).catch((e) => ((dimError = (e as Error).message), null));
    if (dimError) log(`DIM data skipped: ${dimError}`);
  }
  const settings = withDimKeep(saved, dim);
  log("Rating weapons and armor...");
  const w = rateWeapons(vault.weapons, { manifest, aegis, wishlists: loadWishlists() }, settings);
  const a = rateArmor(vault, settings, loadArmorSets());
  const plan = planDimActions(vault, w, a, settings);
  const loot = loadActivityLoot();
  const activities = loot ? rateActivities(loot, aegis, w.ratings, a.ratings, loadArmorSets()) : [];
  log("Fetching your account stats for Wrapped...");
  const wrapped = await wrappedP;
  log("Writing the report (downloading images the first time)...");
  const { file } = await writeSite(w, a, { vaultSize: vault.weapons.length + vault.armor.length, settings, searches: plan.searches, vault, wrapped, activities, sourceOf: await buildSourceLookup(manifest, aegis, loot), encounters: planEncounters(w.ratings), dim, dimError, plan });
  return {
    file,
    plan,
    weapons: { total: w.ratings.length, shard: w.ratings.filter((r) => r.verdict === "shard").length },
    armor: { total: a.ratings.length, shard: a.ratings.filter((r) => r.verdict === "shard").length },
  };
}
