/**
 * Aegis's Boss Damage sheet: ranked sustained-damage builds (Sustained tab) and burst / swap rotations
 * (Swap tab). The tabs have blank header cells, so columns are read by position, checked against how
 * the sheets are sorted: the Sustained tab is sorted descending by its last column (damage per second),
 * the Swap tab by column 16 (damage in the burst window). Rows are builds ("Aggressive rocket launcher",
 * "Still Hunt"), so each is matched to a weapon by exotic name, or by weapon type plus frame.
 */
import { join } from "node:path";
import { paths, readJson, readJsonCached, writeJson } from "../config.js";
import { normalizeName } from "../bungie/defs.js";
import { parseCsv } from "./csv.js";

export const BOSS_SHEET_ID = "1_5wtBjRYHHxuF4oJKDb_iOGZs-wTkzB6RYbnyNLbuz4";
export const bossFile = () => join(paths.sourcesDir, "bossdamage.json");

export interface BossRow {
  /** First line of the Name cell: an exotic's name, or "<frame> <weapon type>". */
  name: string;
  /** The rest of the Name cell: the perks and buffs the build assumes. */
  notes: string;
  /** Damage per second (Sustained) or damage in the burst window (Swap). */
  dps: number;
}

export interface BossDamageData {
  importedAt: string;
  /** Weapon builds only, best first. */
  sustained: BossRow[];
  swap: BossRow[];
}

const num = (s: string | undefined) => Number((s ?? "").replace(/,/g, ""));
const tabUrl = (tab: string) => `https://docs.google.com/spreadsheets/d/${BOSS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

function rows(csv: string, kindOk: (r: string[]) => boolean, dpsCol: number): BossRow[] {
  const out: BossRow[] = [];
  for (const r of parseCsv(csv).slice(1)) {
    const [name = "", ...rest] = (r[0] ?? "").trim().split(/\s*\n\s*/);
    const dps = num(r[dpsCol]);
    if (name && dps > 0 && kindOk(r)) out.push({ name, notes: rest.join(". "), dps });
  }
  return out;
}

/** Sustained tab: Name, Type (power / special / primary, or melee / grenade / tick), Family, ... last column DPS. */
export const parseBossSustained = (csv: string): BossRow[] =>
  rows(csv, (r) => ["power", "special", "primary"].includes(r[1]) && !["effect", "turret", "melee", "grenade"].includes(r[2]), 19);

/** Swap tab: Name, Type (burst / swap for weapons; super, grenade, melee, LP otherwise), ... column 16 damage. */
export const parseBossSwap = (csv: string): BossRow[] => rows(csv, (r) => r[1] === "burst" || r[1] === "swap", 16);

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

/** Import both tabs. Keeps the previous copy when the sheet can't be read or looks wrong. */
export async function importBossDamage(): Promise<BossDamageData | null> {
  const prev = readJson<BossDamageData | null>(bossFile(), null);
  try {
    const sustained = parseBossSustained(await getText(tabUrl("Sustained")));
    const swap = parseBossSwap(await getText(tabUrl("Swap")));
    if (sustained.length < 10 || swap.length < 10) throw new Error("tabs look different than expected");
    const data: BossDamageData = { importedAt: new Date().toISOString(), sustained, swap };
    writeJson(bossFile(), data);
    return data;
  } catch {
    return prev;
  }
}

export const loadBossDamage = (): BossDamageData | null => readJsonCached<BossDamageData | null>(bossFile(), null);

/** Weapon type -> the phrases the sheet uses for it, longest first so "linear fusion rifle" beats "fusion rifle". */
const TYPE_PHRASES: [string, string][] = [
  ["linear fusion rifle", "Linear Fusion Rifle"], ["fusion rifle", "Fusion Rifle"], ["rocket launcher", "Rocket Launcher"], ["grenade launcher", "Grenade Launcher"],
  ["sniper rifle", "Sniper Rifle"], ["sniper", "Sniper Rifle"], ["machine gun", "Machine Gun"], ["trace rifle", "Trace Rifle"], ["scout rifle", "Scout Rifle"],
  ["pulse rifle", "Pulse Rifle"], ["auto rifle", "Auto Rifle"], ["hand cannon", "Hand Cannon"], ["submachine gun", "Submachine Gun"], ["smg", "Submachine Gun"],
  ["shotgun", "Shotgun"], ["sidearm", "Sidearm"], ["glaive", "Glaive"], ["sword", "Sword"], ["bow", "Combat Bow"],
].sort((a, b) => b[0].length - a[0].length) as [string, string][];

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** "Aggressive rocket launcher" -> { type: "Rocket Launcher", frame: "aggressive" }; null for an exotic's own name. */
function archetypeOf(name: string): { type: string; frame: string } | null {
  const lower = name.toLowerCase();
  for (const [phrase, type] of TYPE_PHRASES) {
    const at = lower.search(new RegExp(`\\b${phrase}\\b`));
    if (at >= 0) return { type, frame: squash(lower.slice(0, at) + lower.slice(at + phrase.length)) };
  }
  return null;
}

export interface BossLookup {
  /** 0..1 for how high this weapon ranks in the tab (1 = top), or null when no row covers it. */
  (name: string, type: string, frame: string, exotic: boolean): number | null;
}

/**
 * Turn one tab into a lookup. A row's value is its rank among the distinct weapons / archetypes, so a
 * build near the top scores near 1. An exotic matches by name; others by type + frame, then by type
 * alone (a row with no frame), then by the type's best frame at a discount.
 */
export function bossLookup(list: BossRow[]): BossLookup {
  const best = new Map<string, number>();
  const typeBest = new Map<string, number>();
  for (const r of list) {
    const a = archetypeOf(r.name);
    const key = a ? `${a.type}|${a.frame}` : `x|${normalizeName(r.name)}`;
    best.set(key, Math.max(best.get(key) ?? 0, r.dps));
    if (a) typeBest.set(a.type, Math.max(typeBest.get(a.type) ?? 0, r.dps));
  }
  const ranked = [...best.entries()].sort((a, b) => b[1] - a[1]);
  const value = new Map(ranked.map(([k], i) => [k, ranked.length > 1 ? 1 - i / (ranked.length - 1) : 1]));
  const typeValue = new Map([...typeBest].map(([t, dps]) => [t, 1 - ranked.findIndex(([, d]) => d <= dps) / Math.max(1, ranked.length - 1)]));
  return (name, type, frame, exotic) => {
    const own = value.get(`x|${normalizeName(name)}`);
    // An exotic the sheet doesn't list says nothing about its type's frames.
    if (own !== undefined || exotic) return own ?? null;
    const f = squash(frame.replace(/\bframe\b/i, ""));
    return value.get(`${type}|${f}`) ?? value.get(`${type}|`) ?? (typeValue.has(type) ? 0.7 * typeValue.get(type)! : null);
  };
}
