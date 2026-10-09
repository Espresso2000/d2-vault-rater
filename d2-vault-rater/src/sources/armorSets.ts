import { join } from "node:path";
import { paths, readJsonCached, writeJson } from "../config.js";
import { AEGIS_SHEET_ID } from "./aegis.js";
import { gvizCsvUrl, parseCsv } from "./csv.js";

/** Aegis's armor set bonus tab, and a community sheet with every set's full bonus text. */
export const AEGIS_ARMOR_GID = "1665223292";
export const BONUS_SHEET_ID = "1WaxvbLx7UoSZaBqdFr1u32F2uWVLo-CJunJB4nlGUE4";
export const BONUS_SHEET_GID = "1287885342";

export const SET_TIERS = ["S", "A", "B", "C", "D", "E", "F"] as const;
export type SetTier = (typeof SET_TIERS)[number];
export const SET_TIER_POINTS: Record<SetTier, number> = { S: 100, A: 85, B: 70, C: 55, D: 40, E: 25, F: 10 };

export interface SetBonus {
  pieces: 2 | 4;
  name: string;
  /** Aegis's rating; null when the bonus is not on his tab. */
  tier: SetTier | null;
  rank: number | null;
  tags: string[];
  trigger: string;
  effect: string;
  /** Aegis's analysis. */
  notes: string;
  /** Full in-game text from the bonus sheet. */
  description: string;
}

export interface ArmorSet {
  name: string;
  source: string;
  bonuses: SetBonus[];
}

export interface ArmorSetData {
  importedAt: string;
  sets: Record<string, ArmorSet>;
}

export const armorSetsFile = () => join(paths.sourcesDir, "armor-sets.json");

/** "Iron Panoply Set" and "Iron Panoply" are the same set. */
export const setKey = (name: string) => name.toLowerCase().replace(/\s+set$/, "").replace(/[^a-z0-9]+/g, " ").trim();

const firstLine = (s: string) => s.split("\n")[0].trim();
const rest = (s: string) => s.split("\n").slice(1).map((x) => x.trim()).filter(Boolean);

export function parseAegisArmorTab(csv: string): Record<string, ArmorSet> {
  const rows = parseCsv(csv);
  const headerAt = rows.findIndex((r) => r.some((c) => c.trim() === "Set") && r.some((c) => c.trim() === "Tier"));
  if (headerAt < 0) throw new Error("Aegis armor tab: no header row with Set and Tier");
  const h = rows[headerAt].map((c) => c.trim());
  const col = (name: string, last = false) => (last ? h.lastIndexOf(name) : h.indexOf(name));
  const c = { set: col("Set"), bonus: col("Bonus"), pcs: col("Pcs"), tags: col("Tags"), trigger: col("Trigger"), effect: col("Effect"), notes: col("Description"), rank: col("#", true), tier: col("Tier") };
  const out: Record<string, ArmorSet> = {};
  for (const r of rows.slice(headerAt + 1)) {
    const tier = (r[c.tier] ?? "").trim().toUpperCase() as SetTier;
    const name = firstLine(r[c.set] ?? "");
    if (!name || !SET_TIERS.includes(tier)) continue;
    const set = (out[setKey(name)] ??= { name, source: rest(r[c.set]).join(" · "), bonuses: [] });
    const rank = parseInt(r[c.rank], 10);
    set.bonuses.push({
      pieces: r[c.pcs]?.trim() === "4" ? 4 : 2,
      name: (r[c.bonus] ?? "").trim(),
      tier,
      rank: Number.isFinite(rank) ? rank : null,
      tags: (r[c.tags] ?? "").split("\n").map((x) => x.trim()).filter(Boolean),
      trigger: (r[c.trigger] ?? "").trim(),
      effect: (r[c.effect] ?? "").trim(),
      notes: (r[c.notes] ?? "").trim(),
      description: "",
    });
  }
  return out;
}

/** Adds the full bonus text, and any bonuses Aegis has not rated, from the community bonus sheet. */
export function mergeBonusSheet(sets: Record<string, ArmorSet>, csv: string): void {
  let current: ArmorSet | null = null;
  for (const r of parseCsv(csv)) {
    const setCell = (r[0] ?? "").trim();
    const text = (r[2] ?? "").trim();
    if (setCell && setCell !== "Armor Set" && setCell !== "Armor Set Bonuses") {
      const lines = setCell.split("\n").map((x) => x.trim()).filter(Boolean);
      current = sets[setKey(lines[0])] ??= { name: lines[0], source: lines.slice(1).join(" · "), bonuses: [] };
    }
    const m = text.match(/^([24])\s*Piece\s*\|\s*([^\n]+)\n?([\s\S]*)$/i);
    if (!current || !m) continue;
    const pieces = m[1] === "4" ? 4 : 2;
    const description = m[3].replace(/\n{3,}/g, "\n\n").trim();
    const b = current.bonuses.find((x) => x.pieces === pieces);
    if (b) b.description = description;
    else current.bonuses.push({ pieces, name: m[2].trim(), tier: null, rank: null, tags: [], trigger: "", effect: "", notes: "", description });
  }
  for (const s of Object.values(sets)) s.bonuses.sort((a, b) => a.pieces - b.pieces);
}

export async function importArmorSets(): Promise<ArmorSetData & { warnings: string[] }> {
  const warnings: string[] = [];
  const get = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    return res.text();
  };
  const sets = parseAegisArmorTab(await get(`https://docs.google.com/spreadsheets/d/${AEGIS_SHEET_ID}/export?format=csv&gid=${AEGIS_ARMOR_GID}`));
  try {
    mergeBonusSheet(sets, await get(gvizCsvUrl(BONUS_SHEET_ID, BONUS_SHEET_GID)));
  } catch (e) {
    warnings.push(`Set bonus descriptions not loaded: ${(e as Error).message}`);
  }
  const data = { importedAt: new Date().toISOString(), sets };
  writeJson(armorSetsFile(), data);
  return { ...data, warnings };
}

export function loadArmorSets(): ArmorSetData | null {
  return readJsonCached<ArmorSetData | null>(armorSetsFile(), null);
}
