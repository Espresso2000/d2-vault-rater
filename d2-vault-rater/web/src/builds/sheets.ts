/**
 * Parses the two community sheets the Builds tab rates with:
 *  - Aegis's Endgame Analysis: tiered Aspects, Fragments and Subclasses tabs.
 *  - The Destiny Data Compendium: descriptions for abilities, aspects, fragments, mods and exotics.
 * Pure functions (no fetching) so they run in the tests.
 */
import { parseCsv } from "../../../src/sources/csv.js";
import { normalizeName as norm } from "../../../src/bungie/defs.js";

export { norm };
export { AEGIS_SHEET_ID as AEGIS_ID } from "../../../src/sources/aegis.js";
/** The Destiny Data Compendium (also the armor set bonus sheet). */
export { BONUS_SHEET_ID as COMPENDIUM_ID } from "../../../src/sources/armorSets.js";
export const AEGIS_TABS = { aspects: "1426359048", fragments: "1402770816", subclasses: "895871604" };
/** Arc, Solar, Void, Stasis, Strand, Prismatic, Class Abilities, Armor Mods, Exotic Armors, Exotic Class. */
export const COMPENDIUM_TABS = ["618967225", "1186062409", "1907852650", "1088259962", "1870531554", "1918152785", "527596209", "1934379638", "1500097863", "20898389"];

export const TIER_POINTS: Record<string, number> = { S: 100, A: 85, B: 70, C: 50, D: 30, E: 20, F: 10 };

export interface Rated {
  name: string;
  tier: string;
  rank: number | null;
  /** Element (or "Prismatic") as the sheet lists it. */
  subclass: string;
  /** T / H / W for aspects. */
  cls: string;
  /** Fragment slots (aspects) or stat line (fragments). */
  extra: string;
  trigger: string;
  effect: string;
  usage: string;
}

export interface RatedSubclass {
  cls: "Titan" | "Hunter" | "Warlock";
  element: string;
  tier: string;
  total: number | null;
  /** 0–10 scores per role, as the sheet gives them. */
  scores: { super: number | null; enhancement: number | null; offense: number | null; defense: number | null };
  supers: string;
  usage: string;
}

export interface BuildRatings {
  importedAt: string;
  /** norm(name) -> rating */
  aspects: Record<string, Rated>;
  fragments: Record<string, Rated>;
  subclasses: RatedSubclass[];
  /** norm(name) -> description from the Data Compendium */
  info: Record<string, string>;
  warnings: string[];
}

const lastWord = (h: string) => h.trim().toLowerCase().split(/\s+/).pop() ?? "";
const CLS: Record<string, RatedSubclass["cls"]> = { T: "Titan", H: "Hunter", W: "Warlock" };

/** The Aspects or Fragments tab: one row per plug with a Tier column. */
export function parseRatedTab(csv: string): Record<string, Rated> {
  const rows = parseCsv(csv);
  const hi = rows.findIndex((r) => r.some((h) => lastWord(h) === "name") && r.some((h) => lastWord(h) === "tier"));
  if (hi < 0) return {};
  const head = rows[hi].map(lastWord);
  const col = (k: string) => head.indexOf(k);
  const at = (r: string[], k: string) => (col(k) >= 0 ? (r[col(k)] ?? "").trim() : "");
  const out: Record<string, Rated> = {};
  for (const r of rows.slice(hi + 1)) {
    const name = at(r, "name");
    const tier = at(r, "tier").toUpperCase();
    if (!name || !TIER_POINTS[tier]) continue;
    const rank = Number(at(r, "#"));
    out[norm(name)] = {
      name,
      tier,
      rank: Number.isFinite(rank) && rank > 0 ? rank : null,
      subclass: at(r, "subclass"),
      cls: at(r, "class"),
      extra: at(r, "fragments") || at(r, "stats").replace(/^\/$/, ""),
      trigger: at(r, "trigger"),
      effect: at(r, "effect"),
      usage: at(r, "usage"),
    };
  }
  return out;
}

/** Supers by element. The Subclasses tab shows the element only as a picture, so it is read from the supers each row names. */
const SUPERS: Record<string, string[]> = {
  Solar: ["golden gun", "blade barrage", "hammer of sol", "burning maul", "daybreak", "well of radiance", "song of flame"],
  Arc: ["arc staff", "gathering storm", "storms edge", "fists of havoc", "thundercrash", "stormtrance", "chaos reach", "storms keep"],
  Void: ["shadowshot", "moebius quiver", "deadfall", "spectral blades", "sentinel shield", "ward of dawn", "twilight arsenal", "nova bomb", "nova warp"],
  Stasis: ["silence and squall", "glacial quake", "winters wrath"],
  Strand: ["silkstrike", "bladefury", "needlestorm"],
};

export function elementFromSupers(text: string): string | null {
  const t = norm(text);
  const found = Object.keys(SUPERS).filter((el) => SUPERS[el].some((s) => t.includes(s)));
  return found.length > 1 ? "Prismatic" : found[0] ?? null;
}

/** The Subclasses tab: class letter, then Super / Enhancement / Offense / Defense with a 0–10 score after each. */
export function parseSubclassTab(csv: string): RatedSubclass[] {
  const rows = parseCsv(csv);
  const hi = rows.findIndex((r) => r.some((h) => /super/i.test(h)) && r.some((h) => lastWord(h) === "tier"));
  if (hi < 0) return [];
  const head = rows[hi];
  const find = (re: RegExp) => head.findIndex((h) => re.test(h));
  const c = {
    cls: find(/class/i),
    super: find(/super/i),
    enh: find(/enhancement/i),
    off: find(/offense/i),
    def: find(/defense/i),
    usage: find(/usage/i),
    tier: head.findIndex((h) => lastWord(h) === "tier"),
  };
  const num = (r: string[], i: number) => {
    const n = Number((r[i + 1] ?? "").trim());
    return i >= 0 && Number.isFinite(n) && (r[i + 1] ?? "").trim() !== "" ? n : null;
  };
  const out: RatedSubclass[] = [];
  for (const r of rows.slice(hi + 1)) {
    const cls = CLS[(r[c.cls] ?? "").trim().toUpperCase()];
    const tier = (r[c.tier] ?? "").trim().toUpperCase();
    if (!cls || !TIER_POINTS[tier]) continue;
    const element = elementFromSupers(r[c.super] ?? "");
    if (!element) continue;
    const total = Number((r[c.tier - 1] ?? "").trim());
    out.push({
      cls,
      element,
      tier,
      total: Number.isFinite(total) && (r[c.tier - 1] ?? "").trim() !== "" ? total : null,
      scores: { super: num(r, c.super), enhancement: num(r, c.enh), offense: num(r, c.off), defense: num(r, c.def) },
      supers: (r[c.super] ?? "").trim(),
      usage: (r[c.usage] ?? "").trim(),
    });
  }
  return out;
}

/**
 * Any Data Compendium tab: its layouts differ, so take every short cell followed (within three
 * columns) by a long one as "name -> description". Names like "Ammo Finder\n[3 Energy]" keep the first line.
 */
export function parseInfoTab(csv: string, into: Record<string, string> = {}): Record<string, string> {
  for (const r of parseCsv(csv)) {
    for (let i = 0; i < r.length; i++) {
      const name = (r[i] ?? "").split(/\r?\n/)[0].replace(/\s*\[[^\]]*\]\s*$/, "").trim();
      if (!name || name.length > 48 || /^[-–/]$/.test(name)) continue;
      for (let j = i + 1; j <= i + 3 && j < r.length; j++) {
        const text = (r[j] ?? "").trim();
        if (!text) continue;
        if (text.length >= 40 && !into[norm(name)]) into[norm(name)] = text;
        break;
      }
    }
  }
  return into;
}

/** Points for a tier letter, or null when unrated. */
export const tierPoints = (t: string | null | undefined) => (t && TIER_POINTS[t] !== undefined ? TIER_POINTS[t] : null);
