/**
 * Weapon roles: how well each copy fills add clear, champion stunning, boss damage, range, support or
 * movement. Every leaf role is scored 0-100 on its own, so a weapon can hold several; the page shows
 * the ones at or above the threshold. Pure: the perk map and Aegis data come in as arguments.
 *
 * score = 100 * clamp(0.30 archetype + 0.35 perks + 0.15 tags + 0.20 quality), each part 0..1.
 */
import { normalizeName } from "../bungie/defs.js";
import { ROLE_TYPES, type Role } from "../data/encounters.js";
import perkRoleData from "../data/perkRoles.json" with { type: "json" };
import type { AegisPerk } from "../sources/aegis.js";
import { bossLookup, type BossDamageData, type BossLookup } from "../sources/bossDamage.js";
import type { WeaponRecord } from "../vault/types.js";

export const LEAF_ROLES = ["add-clear", "champion", "burst", "precision", "sustained", "long", "close", "utility", "movement"] as const;
export type RoleId = (typeof LEAF_ROLES)[number];
export type RoleScores = Record<RoleId, number>;

/** What the page calls each role on a card badge. */
export const ROLE_LABEL: Record<RoleId, string> = {
  "add-clear": "Add clear",
  champion: "Champion",
  burst: "Boss burst",
  precision: "Boss precision",
  sustained: "Sustained DPS",
  long: "Long range",
  close: "Close range",
  utility: "Support",
  movement: "Movement",
};

export const DEFAULT_ROLE_THRESHOLD = 65;
const WEIGHTS = { archetype: 0.3, perks: 0.35, tags: 0.15, quality: 0.2 };
/** What a matched perk is worth by Aegis perk tier; perks the sheet doesn't list count as B. */
const PERK_TIER: Record<string, number> = { S: 1, A: 0.85, B: 0.7, C: 0.5, D: 0.3, E: 0.2, F: 0.1 };
/** Two good perks fill the perk part. */
const PERKS_FOR_FULL = 1.2;

/** Weapon types whose damage comes from precision hits. */
const CRIT_TYPES = new Set(["Sniper Rifle", "Linear Fusion Rifle", "Combat Bow"]);
/** Fit a weapon falls back to when the sheet has no row for it, scaled down so ranked weapons come first. */
const UNRANKED = 0.6;

/** The encounter guide's weapon type fits, where a leaf role has one. */
const GUIDE_ROLE: Partial<Record<RoleId, Role>> = { "add-clear": "add-clear", burst: "boss-burst", precision: "precision", sustained: "boss-sustained", long: "range", close: "close" };
const EXTRA_TYPES: Partial<Record<RoleId, Record<string, number>>> = {
  close: { Sidearm: 0.8 },
  movement: { Sword: 0.5, Glaive: 0.4 },
};
/** Aegis exotic tag -> how strongly it says a role is filled. */
const TAG_ROLES: Record<string, Partial<Record<RoleId, number>>> = {
  dps: { burst: 0.8, sustained: 0.8 },
  boss: { burst: 1, sustained: 1, precision: 0.6 },
  roam: { "add-clear": 1, sustained: 0.6 },
  "add clear": { "add-clear": 1 },
  movement: { movement: 1 },
  utility: { utility: 1 },
  support: { utility: 1 },
};
/** Aegis perk tags that name a damage role, for perks the seed map doesn't list. */
const PERK_TAG_ROLE: Record<string, RoleId> = { burst: "burst", sustained: "sustained" };

export interface RolePerkMap {
  /** Normalized perk name -> roles it serves. */
  perks: Map<string, RoleId[]>;
  /** Normalized exotic name -> roles it is known for. */
  weapons: Map<string, RoleId[]>;
  /** Normalized perk name -> Aegis tier multiplier. */
  tier: Map<string, number>;
  /** Normalized perk name -> roles its Aegis tags imply. */
  tagRoles: Map<string, RoleId[]>;
  /** Boss Damage sheet rank (0..1) per weapon, once the sheet has been imported. */
  sustained?: BossLookup;
  swap?: BossLookup;
}

/** The seed file plus the imported Aegis perk list, indexed once per rating run. */
export function buildRolePerkMap(aegisPerks: AegisPerk[] = [], seed: Record<string, unknown> = perkRoleData, boss: BossDamageData | null = null): RolePerkMap {
  const add = (m: Map<string, RoleId[]>, name: string, role: RoleId) => {
    const k = normalizeName(name);
    m.set(k, [...(m.get(k) ?? []), role]);
  };
  const perks = new Map<string, RoleId[]>(), weapons = new Map<string, RoleId[]>();
  for (const role of LEAF_ROLES) for (const n of (seed[role] as string[] | undefined) ?? []) add(perks, n, role);
  for (const [role, names] of Object.entries((seed.weapons as Record<string, string[]> | undefined) ?? {})) for (const n of names) add(weapons, n, role as RoleId);
  const tier = new Map<string, number>(), tagRoles = new Map<string, RoleId[]>();
  for (const p of aegisPerks) {
    const k = normalizeName(p.name);
    tier.set(k, PERK_TIER[p.tier] ?? 0.7);
    const roles = p.tags.map((t) => PERK_TAG_ROLE[t]).filter((r): r is RoleId => !!r);
    if (roles.length) tagRoles.set(k, roles);
  }
  return { perks, weapons, tier, tagRoles, sustained: boss?.sustained.length ? bossLookup(boss.sustained) : undefined, swap: boss?.swap.length ? bossLookup(boss.swap) : undefined };
}

export interface RoleInput {
  w: WeaponRecord;
  /** Aegis exotic tags for this weapon. */
  tags?: string[];
  /** The copy's overall rating, 0-100. */
  score: number;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function scoreRoles({ w, tags = [], score }: RoleInput, map: RolePerkMap): { scores: RoleScores; why: Partial<Record<RoleId, string[]>> } {
  // Everything equipped that can carry a role: each perk column's active plug, plus the frame or exotic trait.
  const equipped = [...w.columns.map((c) => c.active), w.intrinsic?.name].filter((n): n is string => !!n);
  const range = w.stats?.["Range"];
  const weaponRoles = map.weapons.get(normalizeName(w.name)) ?? [];
  const scores = {} as RoleScores;
  const why: Partial<Record<RoleId, string[]>> = {};
  for (const role of LEAF_ROLES) {
    const notes: string[] = [];
    const guide = GUIDE_ROLE[role];
    const typeFit = Math.max(guide ? ROLE_TYPES[guide][w.type] ?? 0 : 0, EXTRA_TYPES[role]?.[w.type] ?? 0);
    let archetype = typeFit;
    // Boss damage roles read Aegis's Boss Damage ranks (an exotic by name, else type + frame); with no row they fall back to the type fit.
    if (role === "burst" || role === "sustained" || role === "precision") {
      const rank = (l?: BossLookup) => l?.(w.name, w.type, w.frame, w.rarity === "Exotic") ?? null;
      const crit = CRIT_TYPES.has(w.type);
      const sheet = role === "burst" ? rank(map.swap) : role === "sustained" ? rank(map.sustained) : crit ? Math.max(rank(map.swap) ?? 0, rank(map.sustained) ?? 0) || null : null;
      archetype = sheet ?? typeFit * (map.sustained || map.swap ? (role === "precision" && !crit ? 0.6 * UNRANKED : UNRANKED) : 1);
      if (sheet != null) notes.push(`Aegis Boss Damage rank: top ${Math.max(1, Math.round((1 - sheet) * 100))}%`);
    }
    // Nearly every weapon stuns something (frame, exotic trait, seasonal artifact), so one breaker only starts the role; two or more, or a champion perk, hold it.
    const breakers = w.champions?.length ?? 0;
    if (role === "champion") archetype = breakers > 1 ? 1 : breakers ? 0.6 : 0;
    if (role === "champion" && w.champions?.length) notes.push(`stuns ${w.champions.join(", ")}`);
    else if (typeFit >= 0.7) notes.push(`${w.type} suits this role`);

    let perkSum = 0;
    for (const n of equipped) {
      const k = normalizeName(n);
      if ((map.perks.get(k) ?? map.tagRoles.get(k) ?? []).includes(role)) {
        perkSum += map.tier.get(k) ?? 0.7;
        notes.push(n);
      }
    }

    // Support and movement come from perks, not weapon type: a matched perk carries the archetype part.
    if ((role === "utility" || role === "movement") && perkSum > 0) archetype = Math.max(archetype, 0.8);

    // The Range stat is the evidence for long and close range, and a built-in stun for champions, as perks are for the other roles.
    let rangeFit = role === "champion" ? (breakers > 1 ? 0.5 : breakers ? 0.15 : 0) : 0;
    if (range != null && (role === "long" || role === "close")) {
      rangeFit = clamp((role === "long" ? range - 50 : 50 - range) / 30);
      if (rangeFit > 0.5) notes.push(`Range ${range}`);
    }

    let tagFit = weaponRoles.includes(role) ? 1 : 0;
    for (const t of tags) tagFit = Math.max(tagFit, TAG_ROLES[t]?.[role] ?? 0);
    if (tagFit) notes.push("Aegis exotic tag");

    const total = 100 * clamp(WEIGHTS.archetype * archetype + WEIGHTS.perks * clamp(perkSum / PERKS_FOR_FULL + rangeFit) + WEIGHTS.tags * tagFit + WEIGHTS.quality * clamp(score / 100));
    scores[role] = Math.round(total);
    if (notes.length) why[role] = notes;
  }
  return { scores, why };
}

/** The roles a copy holds, best first. */
export const rolesHeld = (scores: RoleScores, threshold = DEFAULT_ROLE_THRESHOLD) =>
  LEAF_ROLES.filter((r) => scores[r] >= threshold).sort((a, b) => scores[b] - scores[a]);
