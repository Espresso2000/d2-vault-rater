import { baseName as base, normalizeName } from "../bungie/manifest.js";
import { ENCOUNTERS, ROLE_META, ROLE_TYPES, type Encounter, type Range, type Role } from "../data/encounters.js";
import type { WeaponRating } from "./weapons.js";

export interface EncounterPick {
  role: Role;
  id: string;
  name: string;
  /** Guides name this weapon for the encounter (or the role, in the final sandbox). */
  meta: "encounter" | "role" | null;
  /** What made it the pick for this encounter in particular, such as "Arc shields" or "Long range". */
  why?: string;
}

export interface EncounterPlan extends Encounter {
  picks: EncounterPick[];
  /** Meta picks for this encounter you don't own. */
  missing: string[];
}

/** Boss roles want heavy grenade launchers, not the special ones. */
const BOSS_ROLES = new Set<Role>(["boss-burst", "boss-sustained"]);
const ROLE_WEIGHT = [1, 0.8, 0.6];
const FALLBACK: Role[] = ["add-clear", "precision", "boss-sustained", "range"];
/** Bonus for a guide pick for this encounter, and for a final-sandbox pick for the role. */
const ENCOUNTER_META = 30;
const ROLE_META_BONUS = 6;
/** Bonus for an add-clear weapon that breaks the encounter's shields, by how often you meet them. */
const SHIELD_BONUS = { common: 14, some: 8, rare: 3 } as const;
/** Bonus for the weapon types guides favour for the encounter, by how high they rank them. */
const TYPE_BONUS = [18, 12, 7, 3];

/** How well each weapon type suits the distance the encounter's add clear happens at (1 = no change). */
const RANGE_FIT: Record<Range, Record<string, number>> = {
  close: { "Submachine Gun": 1.15, Shotgun: 1.15, Sidearm: 1.1, Glaive: 1.1, "Fusion Rifle": 1.1, Sword: 1.1, "Hand Cannon": 1.05, "Scout Rifle": 0.75, "Sniper Rifle": 0.7, "Linear Fusion Rifle": 0.8, "Combat Bow": 0.85 },
  mid: { "Auto Rifle": 1.05, "Pulse Rifle": 1.05, "Hand Cannon": 1.05, "Trace Rifle": 1.05, Shotgun: 0.85, Sword: 0.85, "Sniper Rifle": 0.9 },
  long: { "Scout Rifle": 1.15, "Pulse Rifle": 1.1, "Sniper Rifle": 1.1, "Combat Bow": 1.1, "Linear Fusion Rifle": 1.05, "Submachine Gun": 0.75, Sidearm: 0.75, Shotgun: 0.6, Glaive: 0.8, "Fusion Rifle": 0.8, Sword: 0.6 },
  mixed: {},
};
/** On a boss that moves during damage, weapons that need you planted or in melee range lose out. */
const MOVING_FIT: Record<string, number> = { Sword: 0.5, Glaive: 0.7, "Fusion Rifle": 0.85 };
const RANGE_WORD: Record<Range, string> = { close: "Close range", mid: "Mid range", long: "Long range", mixed: "" };

function candidates(role: Role, enc: Encounter, weapons: WeaponRating[]): { r: WeaponRating; s: number; meta: EncounterPick["meta"]; why?: string }[] {
  const encMeta = new Set((enc.meta ?? []).map(normalizeName));
  const roleMeta = new Set(ROLE_META[role].map(normalizeName));
  const boss = BOSS_ROLES.has(role);
  const shields = new Map<string, number>();
  for (const sh of enc.shields ?? []) shields.set(sh.element, Math.max(shields.get(sh.element) ?? 0, SHIELD_BONUS[sh.frequency] ?? 0));
  const best = new Map<string, { r: WeaponRating; s: number; meta: EncounterPick["meta"]; why?: string }>();
  for (const r of weapons) {
    const k = base(r.name);
    // An encounter's guide pick only counts for a role it can actually fill.
    const fitsRole = role === "support" ? roleMeta.has(k) : roleMeta.has(k) || (ROLE_TYPES[role][r.type] ?? 0) > 0;
    const meta: EncounterPick["meta"] = encMeta.has(k) && fitsRole ? "encounter" : roleMeta.has(k) ? "role" : null;
    let fit = ROLE_TYPES[role][r.type] ?? 0;
    if (r.type === "Grenade Launcher" && boss && r.slot !== "Power") fit = 0;
    if (role === "support") fit = meta ? 1 : 0;
    if (!fit && !meta) continue;
    const why: string[] = [];
    let bonus = meta === "encounter" ? ENCOUNTER_META : meta === "role" ? ROLE_META_BONUS : 0;
    if (meta === "encounter") why.push("Guide pick");
    let rf = 1;
    if (boss) {
      if (enc.dps?.bossMoves && MOVING_FIT[r.type]) fit *= MOVING_FIT[r.type];
    } else if (role !== "support") {
      // Add clear, range and precision roles feel the arena: its distances and the shields you have to break.
      rf = enc.range ? RANGE_FIT[enc.range][r.type] ?? 1 : 1;
      fit *= rf;
      const sb = shields.get(r.element) ?? 0;
      bonus += sb;
      if (sb >= SHIELD_BONUS.some) why.push(`${r.element} shields`);
    }
    // A type guides favour for this fight, ranked by how strongly they favour it.
    const rank = fit > 0 && role !== "support" ? (enc.types ?? []).indexOf(r.type) : -1;
    const tb = rank >= 0 ? TYPE_BONUS[rank] ?? 0 : 0;
    bonus += tb;
    if (tb >= TYPE_BONUS[1]) why.push("Suits this fight");
    // The Close and Long range roles already say so.
    if (rf > 1 && enc.range && role !== "close" && role !== "range") why.push(RANGE_WORD[enc.range]);
    const s = r.score * Math.max(fit, meta ? 0.9 : 0) + bonus;
    const old = best.get(k);
    if (!old || s > old.s) best.set(k, { r, s, meta, why: why[0] });
  }
  return [...best.values()].sort((a, b) => b.s - a.s).slice(0, 8);
}

/** Best three-weapon loadout from your vault: one per slot, at most one exotic, roles filled in priority order. */
export function planEncounter(enc: Encounter, weapons: WeaponRating[]): EncounterPlan {
  // Each role's candidates, worked out once: the fallback search below asks for the same roles repeatedly.
  const byRole = new Map<Role, ReturnType<typeof candidates>>();
  const cands = (r: Role) => byRole.get(r) ?? byRole.set(r, candidates(r, enc, weapons)).get(r)!;
  // A role nothing in the vault can fill (usually Support) falls back to the next useful one.
  const roles: Role[] = [];
  for (const role of enc.roles) {
    const next = [role, ...FALLBACK].find((r) => !roles.includes(r) && cands(r).length);
    if (next) roles.push(next);
  }
  enc = { ...enc, roles };
  const lists = enc.roles.map(cands);
  type Pick = { c: (typeof lists)[number][number]; role: Role };
  let bestCombo: Pick[] = [];
  let bestScore = -1;
  const walk = (i: number, chosen: Pick[], score: number) => {
    if (i === lists.length) {
      if (score > bestScore) [bestScore, bestCombo] = [score, [...chosen]];
      return;
    }
    let placed = false;
    for (const c of lists[i]) {
      if (chosen.some((x) => x.c.r.slot === c.r.slot || base(x.c.r.name) === base(c.r.name))) continue;
      if (c.r.rarity === "Exotic" && chosen.some((x) => x.c.r.rarity === "Exotic")) continue;
      placed = true;
      walk(i + 1, [...chosen, { c, role: enc.roles[i] }], score + c.s * ROLE_WEIGHT[i]);
    }
    if (!placed) walk(i + 1, chosen, score); // role left empty when nothing fits
  };
  walk(0, [], 0);
  // A role left empty because its weapons share a slot with a better pick (a sword and a rocket both
  // need the Power slot) hands its place to the first fallback role that fits a free slot.
  const fits = (c: Pick["c"]) => !bestCombo.some((x) => x.c.r.slot === c.r.slot || base(x.c.r.name) === base(c.r.name)) && !(c.r.rarity === "Exotic" && bestCombo.some((x) => x.c.r.rarity === "Exotic"));
  for (let i = 0; i < roles.length; i++) {
    if (bestCombo.some((x) => x.role === roles[i])) continue;
    for (const r of FALLBACK) {
      const c = roles.includes(r) ? undefined : cands(r).find(fits);
      if (!c) continue;
      roles[i] = r;
      bestCombo.push({ c, role: r });
      break;
    }
  }
  bestCombo.sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role));

  const picks: EncounterPick[] = bestCombo.map(({ c, role }) => ({ role, id: c.r.instanceId, name: c.r.name, meta: c.meta, ...(c.why ? { why: c.why } : {}) }));
  const owned = new Set(weapons.map((w) => base(w.name)));
  // No roles left means nothing in the vault fits this encounter (an empty vault, say): only its guide picks are missing.
  const missing = [...new Set([...(enc.meta ?? []), ...(enc.roles.length ? ROLE_META[enc.roles[0]] : [])])].filter((n) => !owned.has(normalizeName(n))).slice(0, 4);
  // Sources and notes stay in encounters.json; the plan carries only what the guide shows.
  const { name, kind, tip, meta, shields, champions, range, dps } = enc;
  return { name, kind, tip, roles, meta, shields, champions, range, dps, picks, missing };
}

export function planEncounters(weapons: WeaponRating[]): Record<string, EncounterPlan[]> {
  return Object.fromEntries(Object.entries(ENCOUNTERS).map(([key, list]) => [key, list.map((e) => planEncounter(e, weapons))]));
}

/** Whether an activity key ("kings-fall") is what a player typed ("King's Fall", "the shattered throne", "vow"). */
export function activityMatches(key: string, query: string): boolean {
  const q = query.toLowerCase().replace(/['’]/g, "").replace(/[^a-z]+/g, "-").replace(/^-+|-+$/g, "").replace(/^the-/, "");
  return key.includes(q);
}
