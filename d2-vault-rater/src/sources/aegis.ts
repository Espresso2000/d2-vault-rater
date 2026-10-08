import { join } from "node:path";
import { paths, readJson, writeJson } from "../config.js";
import { normalizeName, weaponHashesByName, type Manifest } from "../bungie/manifest.js";
import { gvizCsvUrl, parseCsv } from "./csv.js";

export const AEGIS_SHEET_ID = "1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY";
export const TIERS = ["S", "A", "B", "C", "D"] as const;
export type Tier = (typeof TIERS)[number];

export type ColumnKey = "barrel" | "magazine" | "masterwork" | "perk1" | "perk2" | "origin";

export interface AegisWeapon {
  tab: string;
  name: string;
  season: string;
  element: string;
  frame: string;
  source: string;
  recommended: Record<ColumnKey, string[]>;
  notes: string;
  rank: number | null;
  tier: Tier;
  /** Manifest hashes that carry this name (empty when unmatched). */
  hashes: number[];
}

export interface AegisData {
  importedAt: string;
  tabs: { name: string; gid: string; rows: number }[];
  weapons: AegisWeapon[];
  unmatched: string[];
  warnings: string[];
}

export const aegisFile = () => join(paths.sourcesDir, "aegis.json");
const aliasFile = () => join(paths.sourcesDir, "aliases.json");

type Field = keyof Omit<AegisWeapon, "tab" | "recommended" | "hashes" | "rank" | "tier"> | ColumnKey | "rank" | "tier";

/** Map a header cell (gviz joins stacked header rows, e.g. "PERKS Barrel") to a field. */
export function headerField(h: string): Field | null {
  const s = h.toLowerCase().replace(/[^\w# ]+/g, " ").trim();
  const last = s.split(/\s+/).slice(-2).join(" ");
  if (/^#$|\brank\b/.test(last) || s.endsWith("#")) return "rank";
  if (/\btier\b/.test(last)) return "tier";
  if (/\bperk 1\b|\bperk1\b/.test(last)) return "perk1";
  if (/\bperk 2\b|\bperk2\b/.test(last)) return "perk2";
  if (/\borigin\b/.test(last)) return "origin";
  if (/\bmw\b|masterwork/.test(last)) return "masterwork";
  if (/\bmag|\barrow|\bbattery|\bguard|\bbolt/.test(last)) return "magazine";
  if (/\bbarrel|\bscope|\bsight|\bhaft|\bblade|\bstring|\blauncher|\btube/.test(last)) return "barrel";
  if (/\bnotes?\b/.test(last)) return "notes";
  if (/\bseason\b/.test(last)) return "season";
  if (/\benergy\b|\belement\b/.test(last)) return "element";
  if (/\bframe\b|\barchetype\b/.test(last)) return "frame";
  if (/\bsource\b/.test(last)) return "source";
  if (/\bname\b/.test(last)) return "name";
  return null;
}

const splitCell = (v: string) =>
  v
    .split(/\r?\n|\s*\/\s*/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Parse one tab's CSV. Returns null when the tab is not a weapon tier tab. */
export function parseAegisTab(tab: string, csv: string): AegisWeapon[] | null {
  const rows = parseCsv(csv);
  const headerAt = rows.findIndex((r) => {
    const f = r.map(headerField);
    return f.includes("tier") && f.includes("perk1") && f.includes("name");
  });
  if (headerAt < 0) return null;
  const fields = rows[headerAt].map(headerField);
  const out: AegisWeapon[] = [];
  for (const r of rows.slice(headerAt + 1)) {
    const get = (f: Field) => r[fields.indexOf(f)] ?? "";
    // Reissues carry a second line in the name cell ("Prosecutor\nRotN version"); match on the first line.
    const [name = "", ...version] = get("name").trim().split(/\s*\n\s*/);
    const tier = get("tier").trim().toUpperCase() as Tier;
    if (!name || !TIERS.includes(tier)) continue;
    const rank = parseInt(get("rank"), 10);
    out.push({
      tab,
      name,
      season: get("season").trim(),
      element: get("element").trim(),
      frame: get("frame").trim(),
      source: get("source").trim(),
      recommended: {
        barrel: splitCell(get("barrel")),
        magazine: splitCell(get("magazine")),
        masterwork: splitCell(get("masterwork")),
        perk1: splitCell(get("perk1")),
        perk2: splitCell(get("perk2")),
        origin: splitCell(get("origin")),
      },
      notes: [...version, get("notes").trim()].filter(Boolean).join(". "),
      rank: Number.isFinite(rank) ? rank : null,
      tier,
      hashes: [],
    });
  }
  return out;
}

/** Find tab names and gids in the sheet's public htmlview page. */
export function parseTabList(html: string): { name: string; gid: string }[] {
  const seen = new Map<string, string>();
  for (const m of html.matchAll(/name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(\d+)"/g)) seen.set(m[2], JSON.parse(`"${m[1]}"`));
  for (const m of html.matchAll(/id="sheet-button-(\d+)"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g)) if (!seen.has(m[1])) seen.set(m[1], m[2].trim());
  return [...seen].map(([gid, name]) => ({ gid, name }));
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

export function matchHashes(weapons: AegisWeapon[], m: Manifest): string[] {
  const byName = weaponHashesByName(m);
  const aliases = readJson<Record<string, string>>(aliasFile(), {});
  const unmatched: string[] = [];
  for (const w of weapons) {
    const alias = aliases[w.name];
    w.hashes = byName.get(normalizeName(alias ?? w.name)) ?? [];
    if (!w.hashes.length) unmatched.push(`${w.name} (${w.tab})`);
  }
  return unmatched;
}

/**
 * Import every weapon tab of Aegis's sheet. Tabs come from the htmlview page, plus any listed in
 * settings (`aegisTabs`) in case Google changes that page.
 */
export async function importAegis(m: Manifest, extraTabs: { name: string; gid: string }[] = []): Promise<AegisData> {
  const warnings: string[] = [];
  let tabs: { name: string; gid: string }[] = [];
  try {
    tabs = parseTabList(await getText(`https://docs.google.com/spreadsheets/d/${AEGIS_SHEET_ID}/htmlview`));
  } catch (e) {
    warnings.push(`Could not list tabs: ${(e as Error).message}`);
  }
  for (const t of extraTabs) if (!tabs.some((x) => x.gid === t.gid)) tabs.push(t);
  if (!tabs.length) throw new Error("No Aegis tabs found. Add them to settings.aegisTabs as {name, gid}.");

  const weapons: AegisWeapon[] = [];
  const used: AegisData["tabs"] = [];
  for (const t of tabs) {
    try {
      const csv = await getText(gvizCsvUrl(AEGIS_SHEET_ID, t.gid));
      const rows = parseAegisTab(t.name, csv);
      if (rows?.length) {
        weapons.push(...rows);
        used.push({ ...t, rows: rows.length });
      }
    } catch (e) {
      warnings.push(`Tab ${t.name}: ${(e as Error).message}`);
    }
  }
  const prev = readJson<AegisData | null>(aegisFile(), null);
  if (!weapons.length) {
    if (prev) return { ...prev, warnings: [...warnings, "Import found no weapons; kept the previous import."] };
    throw new Error(`Aegis import found no weapon rows. ${warnings.join("; ")}`);
  }
  const unmatched = matchHashes(weapons, m);
  const data: AegisData = { importedAt: new Date().toISOString(), tabs: used, weapons, unmatched, warnings };
  writeJson(aegisFile(), data);
  return data;
}

export function loadAegis(): AegisData | null {
  return readJson<AegisData | null>(aegisFile(), null);
}
