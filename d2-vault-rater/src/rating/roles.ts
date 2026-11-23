/**
 * Weapon roles: add clear (area damage), majors (easy damage perks, over about 10%) and movement (Aegis's
 * movement weapons). Each is scored 0-100 on its own, so a weapon can hold several; the page shows the
 * ones at or above the threshold. Pure: the perk map and Aegis data come in as arguments.
 *
 * score = 100 * clamp(0.30 archetype + 0.35 perks + 0.15 tags + 0.20 quality), each part 0..1.
 * Movement skips the formula: only weapons Aegis calls movement hold it.
 */
import { normalizeName } from "../bungie/defs.js";
import { ROLE_TYPES, type Role } from "../data/encounters.js";
import perkRoleData from "../data/perkRoles.json" with { type: "json" };
import type { AegisPerk } from "../sources/aegis.js";
import type { WeaponRecord } from "../vault/types.js";

export const LEAF_ROLES = ["add-clear", "major", "movement"] as const;
export type RoleId = (typeof LEAF_ROLES)[number];
export type RoleScores = Record<RoleId, number>;

/** What the page calls each role on a card badge. */
export const ROLE_LABEL: Record<RoleId, string> = { "add-clear": "Add clear", major: "Majors", movement: "Movement" };

export const DEFAULT_ROLE_THRESHOLD = 65;
const WEIGHTS = { archetype: 0.3, perks: 0.35, tags: 0.15, quality: 0.2 };
/** What a matched perk is worth by Aegis perk tier; perks the sheet doesn't list count as B. */
const PERK_TIER: Record<string, number> = { S: 1, A: 0.85, B: 0.7, C: 0.5, D: 0.3, E: 0.2, F: 0.1 };
/** Two good perks fill the perk part. */
const PERKS_FOR_FULL = 1.2;

/** Weapon types that suit each role, from the encounter guide's fits (majors: its damage roles, and any weapon can run damage perks). */
const typeFit = (role: RoleId, type: string) =>
  role === "add-clear" ? ROLE_TYPES["add-clear"][type] ?? 0 : role === "major" ? Math.max(0.5, ...(["boss-burst", "boss-sustained", "precision"] as Role[]).map((r) => ROLE_TYPES[r][type] ?? 0)) : 0;
/** Aegis perk tags that name a role, for perks the seed map doesn't list ("spree" is Rampage and friends: both). */
const PERK_TAG_ROLE: Record<string, RoleId[]> = { splash: ["add-clear"], sustained: ["major"], burst: ["major"], spree: ["add-clear", "major"] };
/** Aegis calls a weapon a movement weapon in its exotic Tags column, or in its notes ("non-movement" doesn't count). */
export const isMovementWeapon = (tags: string[] = [], notes = "") => tags.includes("movement") || /(?<!non-)\bmovement\b/i.test(notes);

export interface RolePerkMap {
  /** Normalized perk name -> roles it serves. */
  perks: Map<string, RoleId[]>;
  /** Normalized perk name -> Aegis tier multiplier. */
  tier: Map<string, number>;
  /** Normalized perk name -> roles its Aegis tags imply. */
  tagRoles: Map<string, RoleId[]>;
}

/** The seed file plus the imported Aegis perk list, indexed once per rating run. */
export function buildRolePerkMap(aegisPerks: AegisPerk[] = [], seed: Record<string, unknown> = perkRoleData): RolePerkMap {
  const add = (m: Map<string, RoleId[]>, name: string, role: RoleId) => {
    const k = normalizeName(name);
    m.set(k, [...(m.get(k) ?? []), role]);
  };
  const perks = new Map<string, RoleId[]>();
  for (const role of LEAF_ROLES) for (const n of (seed[role] as string[] | undefined) ?? []) add(perks, n, role);
  const tier = new Map<string, number>(), tagRoles = new Map<string, RoleId[]>();
  for (const p of aegisPerks) {
    const k = normalizeName(p.name);
    tier.set(k, PERK_TIER[p.tier] ?? 0.7);
    const roles = p.tags.flatMap((t) => PERK_TAG_ROLE[t] ?? []);
    if (roles.length) tagRoles.set(k, roles);
  }
  return { perks, tier, tagRoles };
}

export interface RoleInput {
  w: WeaponRecord;
  /** Aegis exotic tags for this weapon. */
  tags?: string[];
  /** Aegis notes for this weapon. */
  notes?: string;
  /** The copy's overall rating, 0-100. */
  score: number;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function scoreRoles({ w, tags = [], notes = "", score }: RoleInput, map: RolePerkMap): { scores: RoleScores; why: Partial<Record<RoleId, string[]>> } {
  // Everything equipped that can carry a role: each perk column's active plug, plus the frame or exotic trait.
  const equipped = [...w.columns.map((c) => c.active), w.intrinsic?.name].filter((n): n is string => !!n);
  const scores = {} as RoleScores;
  const why: Partial<Record<RoleId, string[]>> = {};
  for (const role of LEAF_ROLES) {
    const notesOut: string[] = [];
    if (role === "movement") {
      const hit = isMovementWeapon(tags, notes);
      scores[role] = hit ? Math.round(100 * clamp(0.65 + 0.35 * (score / 100))) : 0;
      if (hit) why[role] = ["Aegis lists it as a movement weapon"];
      continue;
    }
    const fit = typeFit(role, w.type);
    if (fit >= 0.7) notesOut.push(`${w.type} suits this role`);
    let perkSum = 0;
    for (const n of equipped) {
      const k = normalizeName(n);
      if ([...(map.perks.get(k) ?? []), ...(map.tagRoles.get(k) ?? [])].includes(role)) {
        perkSum += map.tier.get(k) ?? 0.7;
        notesOut.push(n);
      }
    }
    const total = 100 * clamp(WEIGHTS.archetype * fit + WEIGHTS.perks * clamp(perkSum / PERKS_FOR_FULL) + WEIGHTS.quality * clamp(score / 100) + (role === "add-clear" ? WEIGHTS.tags * (tags.includes("add clear") || tags.includes("roam") || tags.includes("splash") ? 1 : 0) : WEIGHTS.tags * (tags.includes("dps") || tags.includes("boss") || tags.includes("damage") ? 1 : 0)));
    scores[role] = Math.round(total);
    if (notesOut.length) why[role] = notesOut;
  }
  return { scores, why };
}

/** The roles a copy holds, best first. */
export const rolesHeld = (scores: RoleScores, threshold = DEFAULT_ROLE_THRESHOLD) =>
  LEAF_ROLES.filter((r) => scores[r] >= threshold).sort((a, b) => scores[b] - scores[a]);
