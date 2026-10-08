/**
 * A saved build and everything computed from it: stat totals, the rating, and conversion to and from
 * DIM's loadout format. No network or DOM here.
 */
import type { ArmorRecord, ArmorSlot, Vault, WeaponRecord, WeaponSlot } from "../../../src/vault/types.js";
import { MOD_CATEGORY, STAT_HASHES, type BuildDefs, type PlugDef, type SubclassDef } from "./defs.strip";
import { norm, tierPoints, type BuildRatings, type Rated, type RatedSubclass } from "./sheets";

export const WEAPON_SLOTS = ["Kinetic", "Energy", "Power"] as const satisfies readonly WeaponSlot[];
export const ARMOR_SLOTS = ["Helmet", "Arms", "Chest", "Legs", "Class Item"] as const satisfies readonly ArmorSlot[];
export type BuildSlot = (typeof WEAPON_SLOTS)[number] | (typeof ARMOR_SLOTS)[number];
export type GearSlot = (typeof ARMOR_SLOTS)[number];
export const CLASSES = ["Titan", "Hunter", "Warlock"] as const;
export const MOD_PCI: Record<GearSlot, string> = {
  Helmet: "enhancements.v2_head",
  Arms: "enhancements.v2_arms",
  Chest: "enhancements.v2_chest",
  Legs: "enhancements.v2_legs",
  "Class Item": "enhancements.v2_class_item",
};
export const GENERAL_PCI = "enhancements.v2_general";
/** Armor 3.0 mod sockets: one general, three for the slot. */
export const MOD_SOCKETS = 4;
export const ARMOR_ENERGY = 10;
export const STAT_MAX = 200;

export interface BuildItem {
  id: string;
  hash: number;
}

export interface Build {
  id: string;
  name: string;
  /** 0 Titan, 1 Hunter, 2 Warlock */
  cls: number;
  notes: string;
  tags: string[];
  subclass: number | null;
  /** Subclass socket index -> plug hash. */
  plugs: Record<number, number>;
  items: Partial<Record<BuildSlot, BuildItem>>;
  /** Armor slot -> [general, slot, slot, slot] mod hashes (0 = empty). */
  mods: Partial<Record<GearSlot, number[]>>;
  /** statHash -> the minimum the build aims for. */
  targets: Record<number, number>;
  created: string;
  updated: string;
  /** Set when the build came from (or was saved to) DIM. */
  dimId?: string;
}

/** What the model reads: the manifest slice, the sheets, the vault and the rater's scores. */
export interface Ctx {
  defs: BuildDefs;
  ratings: BuildRatings | null;
  vault: Vault;
  /** instance id -> vault score (0–100) from the rater */
  scores: Map<string, number>;
  /** statHash -> display name ("Weapons", "Health", …) */
  statNames: Record<number, string>;
  /** instance id -> plugs currently in each socket (from the profile, when loaded) */
  sockets?: Map<string, number[]>;
}

export const newId = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

export function newBuild(cls = 0, name = "New build"): Build {
  const now = new Date().toISOString();
  return { id: newId(), name, cls, notes: "", tags: [], subclass: null, plugs: {}, items: {}, mods: {}, targets: {}, created: now, updated: now };
}

/* ---------- Subclass ---------- */

/** Default plugs for a freshly picked subclass: the game's defaults, aspects and fragments empty. */
export function defaultPlugs(sc: SubclassDef): Record<number, number> {
  return Object.fromEntries(sc.sockets.map((s, i) => [i, s.init]));
}

export const isEmptyPlug = (p: PlugDef | undefined) => !p || /^Empty /i.test(p.n);

/** Fragment slots the chosen aspects open. */
export function fragmentSlots(b: Build, defs: BuildDefs): number {
  const sc = b.subclass ? defs.subclasses[b.subclass] : null;
  if (!sc) return 0;
  return sc.sockets.reduce((n, s, i) => (s.group === "aspects" ? n + (defs.plugs[b.plugs[i]]?.cap ?? 0) : n), 0);
}

/** Socket indexes per group, in order. */
export function socketsOf(sc: SubclassDef, group: SubclassDef["sockets"][number]["group"]): number[] {
  return sc.sockets.flatMap((s, i) => (s.group === group ? [i] : []));
}

/** Fragments past the aspects' slot count are dropped (the game does the same). */
export function trimFragments(b: Build, defs: BuildDefs): void {
  const sc = b.subclass ? defs.subclasses[b.subclass] : null;
  if (!sc) return;
  const slots = fragmentSlots(b, defs);
  socketsOf(sc, "fragments").forEach((i, k) => {
    if (k >= slots) b.plugs[i] = sc.sockets[i].plugs.find((h) => isEmptyPlug(defs.plugs[h])) ?? sc.sockets[i].init;
  });
}

/* ---------- Items ---------- */

export const weaponOf = (ctx: Ctx, id?: string) => (id ? ctx.vault.weapons.find((w) => w.instanceId === id) : undefined);
export const armorOf = (ctx: Ctx, id?: string) => (id ? ctx.vault.armor.find((a) => a.instanceId === id) : undefined);
export const itemOf = (ctx: Ctx, id?: string): WeaponRecord | ArmorRecord | undefined => weaponOf(ctx, id) ?? armorOf(ctx, id);
export const CLASS_NAME = (cls: number) => CLASSES[cls] ?? "Titan";

/** Another exotic of the same kind already in the build (only one exotic weapon and one exotic armor piece). */
export function exoticClash(b: Build, ctx: Ctx, slot: BuildSlot, candidate: WeaponRecord | ArmorRecord): BuildSlot | null {
  if (candidate.rarity !== "Exotic") return null;
  const group: readonly BuildSlot[] = candidate.kind === "weapon" ? WEAPON_SLOTS : ARMOR_SLOTS;
  for (const s of group) if (s !== slot && itemOf(ctx, b.items[s]?.id)?.rarity === "Exotic") return s;
  return null;
}

/* ---------- Stats ---------- */

export interface StatLine {
  hash: number;
  name: string;
  armor: number;
  mods: number;
  fragments: number;
  total: number;
  target: number;
}

const modStats = (hashes: number[], defs: BuildDefs, hash: number) =>
  hashes.reduce((n, h) => n + (defs.plugs[h]?.st?.find(([s]) => s === hash)?.[1] ?? 0), 0);

/**
 * Character stats for the build. Armor stats from the API already include the mods in the armor now;
 * those are taken out and the build's mods added instead.
 */
export function statLines(b: Build, ctx: Ctx): StatLine[] {
  return STAT_HASHES.map((hash) => {
    const name = ctx.statNames[hash] ?? String(hash);
    let armor = 0;
    let mods = 0;
    for (const slot of ARMOR_SLOTS) {
      const a = armorOf(ctx, b.items[slot]?.id);
      if (a) armor += (a.stats[name] ?? 0) - modStats(ctx.sockets?.get(a.instanceId) ?? [], ctx.defs, hash);
      mods += modStats(b.mods[slot] ?? [], ctx.defs, hash);
    }
    const sc = b.subclass ? ctx.defs.subclasses[b.subclass] : null;
    const fragments = sc ? sc.sockets.reduce((n, s, i) => (s.group === "fragments" ? n + modStats([b.plugs[i]], ctx.defs, hash) : n), 0) : 0;
    const total = Math.max(0, Math.min(STAT_MAX, armor + mods + fragments));
    return { hash, name, armor, mods, fragments, total, target: b.targets[hash] ?? 0 };
  });
}

/** Energy used by the mods on one armor piece. */
export const modEnergy = (mods: number[] | undefined, defs: BuildDefs) => (mods ?? []).reduce((n, h) => n + (defs.plugs[h]?.cost ?? 0), 0);

/* ---------- Ratings ---------- */

export const aspectRating = (r: BuildRatings | null, p?: PlugDef): Rated | null => (p && r?.aspects[norm(p.n)]) || null;
export const fragmentRating = (r: BuildRatings | null, p?: PlugDef): Rated | null => (p && r?.fragments[norm(p.n)]) || null;
export const subclassRating = (r: BuildRatings | null, sc?: SubclassDef | null): RatedSubclass | null =>
  (sc && r?.subclasses.find((x) => x.cls === CLASS_NAME(sc.cls) && x.element === sc.el)) || null;
export const infoFor = (r: BuildRatings | null, name: string) => r?.info[norm(name)] ?? "";

export interface ScorePart {
  label: string;
  points: number | null;
  weight: number;
  note: string;
}

/**
 * The build's rating out of 100: subclass 25, aspects 30, fragments 20 (Aegis tiers: S 100 · A 85 ·
 * B 70 · C 50 · D 30), weapons 15 and armor 10 (the rater's vault scores). Missing parts don't count.
 */
export function buildScore(b: Build, ctx: Ctx): { total: number | null; parts: ScorePart[] } {
  const sc = b.subclass ? ctx.defs.subclasses[b.subclass] : null;
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, c) => a + c, 0) / v.length : null;
  };
  const plugsIn = (group: "aspects" | "fragments") =>
    sc ? socketsOf(sc, group).map((i) => ctx.defs.plugs[b.plugs[i]]).filter((p): p is PlugDef => !isEmptyPlug(p)) : [];
  const aspects = plugsIn("aspects");
  const frags = plugsIn("fragments");
  // Empty aspect and fragment slots count as 0, so a half-finished build doesn't rate as a full one.
  const slotsAvg = (pts: (number | null)[], slots: number) => (sc && slots ? pts.reduce<number>((n, p) => n + (p ?? 0), 0) / slots : null);
  const ids = (slots: readonly BuildSlot[]) => slots.map((s) => b.items[s]?.id).filter((x): x is string => !!x);
  const parts: ScorePart[] = [
    { label: "Subclass", points: tierPoints(subclassRating(ctx.ratings, sc)?.tier), weight: 25, note: sc ? `${sc.el} ${CLASS_NAME(sc.cls)}` : "None picked" },
    { label: "Aspects", points: slotsAvg(aspects.map((p) => tierPoints(aspectRating(ctx.ratings, p)?.tier)), sc ? socketsOf(sc, "aspects").length : 0), weight: 30, note: `${aspects.length} picked` },
    { label: "Fragments", points: slotsAvg(frags.map((p) => tierPoints(fragmentRating(ctx.ratings, p)?.tier)), fragmentSlots(b, ctx.defs)), weight: 20, note: `${frags.length} of ${fragmentSlots(b, ctx.defs)} slots` },
    { label: "Weapons", points: avg(ids(WEAPON_SLOTS).map((id) => ctx.scores.get(id) ?? null)), weight: 15, note: "Vault score" },
    { label: "Armor", points: avg(ids(ARMOR_SLOTS).map((id) => ctx.scores.get(id) ?? null)), weight: 10, note: "Vault score" },
  ];
  const used = parts.filter((p) => p.points !== null);
  const w = used.reduce((n, p) => n + p.weight, 0);
  return { total: w ? Math.round(used.reduce((n, p) => n + p.points! * p.weight, 0) / w) : null, parts };
}

/* ---------- DIM loadouts ---------- */

/** DIM's loadout shape (the parts Vault Rater reads and writes). */
export interface DimLoadoutJson {
  id: string;
  name: string;
  classType: number;
  notes?: string;
  clearSpace?: boolean;
  equipped: { id: string; hash: number; socketOverrides?: Record<number, number> }[];
  unequipped: { id: string; hash: number }[];
  parameters?: {
    mods?: number[];
    exoticArmorHash?: number;
    statConstraints?: { statHash: number; minStat?: number; maxStat?: number; minTier?: number; maxTier?: number }[];
  };
}

export function toDimLoadout(b: Build, ctx: Ctx, subclassInstance?: string): DimLoadoutJson {
  const equipped: DimLoadoutJson["equipped"] = [];
  for (const s of [...WEAPON_SLOTS, ...ARMOR_SLOTS]) {
    const it = b.items[s];
    if (it) equipped.push({ id: it.id, hash: it.hash });
  }
  const sc = b.subclass ? ctx.defs.subclasses[b.subclass] : null;
  if (sc) {
    const socketOverrides: Record<number, number> = {};
    sc.sockets.forEach((s, i) => {
      const h = b.plugs[i];
      if (h && s.plugs.length > 1 && !isEmptyPlug(ctx.defs.plugs[h])) socketOverrides[i] = h;
    });
    equipped.push({ id: subclassInstance ?? "0", hash: sc.h, socketOverrides });
  }
  const exotic = ARMOR_SLOTS.map((s) => armorOf(ctx, b.items[s]?.id)).find((a) => a?.rarity === "Exotic");
  const targets = Object.entries(b.targets).filter(([, v]) => v > 0);
  return {
    id: b.dimId ?? b.id,
    name: b.name,
    classType: b.cls,
    notes: b.notes || undefined,
    clearSpace: false,
    equipped,
    unequipped: [],
    parameters: {
      mods: ARMOR_SLOTS.flatMap((s) => (b.mods[s] ?? []).filter((h) => h && !isEmptyPlug(ctx.defs.plugs[h]))),
      ...(exotic ? { exoticArmorHash: exotic.itemHash } : {}),
      ...(targets.length ? { statConstraints: targets.map(([h, v]) => ({ statHash: Number(h), minStat: v, minTier: Math.floor(v / 10) })) } : {}),
    },
  };
}

/** A DIM loadout as a build. Items are matched by instance id; mods go to the first free socket that takes them. */
export function fromDimLoadout(l: DimLoadoutJson, ctx: Ctx): Build {
  const b = newBuild(l.classType > 2 ? 0 : l.classType, l.name || "DIM loadout");
  b.notes = l.notes ?? "";
  b.dimId = l.id;
  b.tags = ["DIM"];
  for (const e of [...(l.equipped ?? []), ...(l.unequipped ?? [])]) {
    const sc = ctx.defs.subclasses[e.hash];
    if (sc) {
      if (b.subclass) continue;
      b.subclass = sc.h;
      b.cls = sc.cls;
      b.plugs = defaultPlugs(sc);
      for (const [i, h] of Object.entries((e as DimLoadoutJson["equipped"][number]).socketOverrides ?? {})) b.plugs[Number(i)] = h;
      continue;
    }
    const it = itemOf(ctx, e.id);
    if (!it || it.slot === "Unknown") continue;
    const slot = it.slot as BuildSlot;
    if (!b.items[slot]) b.items[slot] = { id: it.instanceId, hash: it.itemHash };
  }
  for (const h of l.parameters?.mods ?? []) placeMod(b, h, ctx.defs);
  for (const c of l.parameters?.statConstraints ?? []) {
    const v = c.minStat ?? (c.minTier !== undefined ? c.minTier * 10 : 0);
    if (v > 0) b.targets[c.statHash] = v;
  }
  return b;
}

/** Puts a mod in the first empty socket of an armor slot that takes it. Returns false when none is free. */
export function placeMod(b: Build, hash: number, defs: BuildDefs): boolean {
  const p = defs.plugs[hash];
  if (!p || !MOD_CATEGORY.test(p.c)) return false;
  for (const slot of ARMOR_SLOTS) {
    const mods = (b.mods[slot] ??= Array(MOD_SOCKETS).fill(0));
    for (let i = 0; i < MOD_SOCKETS; i++) {
      const fits = i === 0 ? p.c === GENERAL_PCI : p.c === MOD_PCI[slot];
      if (fits && !mods[i] && modEnergy(mods, defs) + (p.cost ?? 0) <= ARMOR_ENERGY) {
        mods[i] = hash;
        return true;
      }
    }
  }
  return false;
}
