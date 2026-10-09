import { normalizeName } from "../bungie/manifest.js";
import type { ArmorRecord, Vault } from "../vault/types.js";
import { strictnessFor, type Settings } from "./settings.js";
import { SET_TIER_POINTS, setKey, type ArmorSetData, type SetTier } from "../sources/armorSets.js";
import { groupBy } from "../util.js";

/** Best possible primary + secondary + tertiary roll (Tier 5: 30 / 25 / 20). */
export const MAX_TOP3 = 75;

export interface ArmorRating {
  instanceId: string;
  itemHash: number;
  name: string;
  classType: string;
  slot: string;
  rarity: string;
  gearTier: number | null;
  archetype: string | null;
  /** Top three stats, highest first: primary, secondary, tertiary. */
  topStats: { name: string; value: number }[];
  statTotal: number;
  setName: string | null;
  legacy: boolean;
  icon: string;
  locked: boolean;
  score: number;
  parts: { stats: number; buildFit: number; set: number; extras: number };
  /** The armor set this piece belongs to, rated by Aegis's set bonus tiers. */
  setInfo: SetInfo | null;
  verdict: "keep" | "shard" | "review";
  label: "best" | "backup" | "protected" | "set" | "shard";
  reasons: string[];
}

export interface SetInfo {
  name: string;
  /** Distinct slots of this set you own for the class. */
  ownedSlots: number;
  /** 0-100 strength of the bonuses you have (or nearly have) active. */
  value: number;
  bonuses: { pieces: 2 | 4; name: string; tier: SetTier | null; rank: number | null; active: boolean }[];
}

/** Weights: stats 40, build fit 25, set bonus 25, Tier 5 / exotic 10. */
export const ARMOR_WEIGHTS = { stats: 40, buildFit: 25, set: 25, extras: 10 };
/** Exotics have no set; a neutral set score keeps them from being marked down for it. */
const EXOTIC_SET_VALUE = 60;
const UNRATED_BONUS_POINTS = 40;

/**
 * How good a set is for you: an active 4-piece counts both bonuses (the better one weighs most),
 * an active 2-piece counts mostly the 2-piece, and a single piece is only potential.
 */
export function setValue(t2: number | null, t4: number | null, ownedSlots: number): number {
  const two = t2 ?? UNRATED_BONUS_POINTS, four = t4 ?? UNRATED_BONUS_POINTS;
  if (ownedSlots >= 4) return Math.round(Math.max(two, four) * 0.8 + Math.min(two, four) * 0.2);
  if (ownedSlots >= 2) return Math.round(two * 0.85 + four * 0.15);
  return Math.round(Math.max(two, four) * 0.4);
}

export interface ArmorReport {
  ratings: ArmorRating[];
  buildStats: Record<string, string[]>;
  /** class -> slot -> best piece overall, then best per archetype */
  best: Record<string, Record<string, { overall: ArmorRating; byArchetype: Record<string, ArmorRating> }>>;
  setCounts: Record<string, Record<string, number>>;
  shard: ArmorRating[];
}

const topStats = (a: ArmorRecord) =>
  Object.entries(a.stats)
    .map(([name, value]) => ({ name, value }))
    .sort((x, y) => y.value - x.value)
    .slice(0, 3);

/** Stats each class's builds want: settings first, else the two highest stats on equipped armor. */
export function inferBuildStats(vault: Vault, settings: Settings): Record<string, string[]> {
  const out: Record<string, string[]> = { ...settings.buildStats };
  const classOf = new Map(vault.characters.map((c) => [c.id, c.className]));
  const sums: Record<string, Record<string, number>> = {};
  for (const a of vault.armor) {
    if (!a.location.equipped) continue;
    const cls = classOf.get(a.location.where) ?? a.classType;
    for (const [k, v] of Object.entries(a.stats)) ((sums[cls] ??= {})[k] = (sums[cls][k] ?? 0) + v);
  }
  for (const [cls, s] of Object.entries(sums)) {
    if (out[cls]?.length) continue;
    out[cls] = Object.entries(s)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => k);
  }
  return out;
}

export function rateArmor(vault: Vault, settings: Settings, setData: ArmorSetData | null = null): ArmorReport {
  const s = strictnessFor(settings);
  const protect = new Set(settings.protect.map(normalizeName));
  const buildStats = inferBuildStats(vault, settings);

  const setCounts: Record<string, Record<string, number>> = {};
  for (const a of vault.armor) if (a.setName) (setCounts[a.classType] ??= {})[a.setName] = (setCounts[a.classType][a.setName] ?? 0) + 1;

  const slotsOwned = new Map<string, Set<string>>();
  for (const a of vault.armor) {
    if (!a.setName) continue;
    const k = `${a.classType}|${setKey(a.setName)}`;
    slotsOwned.set(k, (slotsOwned.get(k) ?? new Set()).add(a.slot));
  }
  const setInfoFor = (a: ArmorRecord): SetInfo | null => {
    if (!a.setName) return null;
    const def = setData?.sets[setKey(a.setName)];
    const owned = slotsOwned.get(`${a.classType}|${setKey(a.setName)}`)?.size ?? 1;
    const pts = (pieces: 2 | 4) => {
      const t = def?.bonuses.find((b) => b.pieces === pieces)?.tier;
      return t ? SET_TIER_POINTS[t] : null;
    };
    return {
      name: def?.name ?? a.setName.replace(/\s+Set$/, ""),
      ownedSlots: owned,
      value: setValue(pts(2), pts(4), owned),
      bonuses: (def?.bonuses ?? []).map((b) => ({ pieces: b.pieces, name: b.name, tier: b.tier, rank: b.rank, active: owned >= b.pieces })),
    };
  };

  const ratings: ArmorRating[] = vault.armor.map((a) => {
    const top = topStats(a);
    const top3 = top.reduce((n, t) => n + t.value, 0);
    const W = ARMOR_WEIGHTS;
    const stats = Math.round(W.stats * Math.min(1, top3 / MAX_TOP3));
    const wanted = (buildStats[a.classType] ?? []).map((x) => x.toLowerCase());
    const fitWeights = [0.5, 0.3, 0.2];
    const buildFit = wanted.length
      ? Math.round(W.buildFit * top.reduce((n, t, i) => n + (wanted.includes(t.name.toLowerCase()) ? fitWeights[i] : 0), 0) / 0.8)
      : Math.round(W.buildFit / 2);
    const setInfo = setInfoFor(a);
    const set = Math.round((W.set * (a.rarity === "Exotic" ? EXOTIC_SET_VALUE : setInfo?.value ?? 0)) / 100);
    const extras = a.rarity === "Exotic" || a.gearTier === 5 ? 10 : (a.gearTier ?? 0) >= 4 ? 5 : 0;
    return {
      instanceId: a.instanceId,
      itemHash: a.itemHash,
      name: a.name,
      classType: a.classType,
      slot: a.slot,
      rarity: a.rarity,
      gearTier: a.gearTier,
      archetype: a.archetype,
      topStats: top,
      statTotal: a.statTotal,
      setName: a.setName,
      legacy: a.legacy,
      icon: a.icon,
      locked: a.locked,
      score: Math.min(100, stats + Math.min(W.buildFit, buildFit) + set + extras),
      parts: { stats, buildFit: Math.min(W.buildFit, buildFit), set, extras },
      setInfo,
      verdict: "keep",
      label: "best",
      reasons: [],
    };
  });

  const byId = new Map(vault.armor.map((a) => [a.instanceId, a]));
  const sortDesc = (x: ArmorRating, y: ArmorRating) => y.score - x.score;
  const groupKey = (r: ArmorRating) =>
    r.rarity === "Exotic" ? `exotic|${r.itemHash}` : `${r.classType}|${r.slot}|${r.archetype}|${r.topStats[2]?.name ?? ""}`;
  const groups = groupBy(ratings.filter((r) => !r.legacy || r.rarity === "Exotic"), groupKey);
  for (const g of groups.values()) g.sort(sortDesc);
  const bestNew = new Map<string, number>();
  for (const r of ratings) if (!r.legacy) bestNew.set(`${r.classType}|${r.slot}`, Math.max(bestNew.get(`${r.classType}|${r.slot}`) ?? 0, r.score));
  // Best score per set piece (set + class + slot), for "keep the best piece of a set worth running".
  const setSlot = (r: ArmorRating) => `${r.setName}|${r.classType}|${r.slot}`;
  const bestInSet = new Map<string, number>();
  for (const r of ratings) if (r.setName) bestInSet.set(setSlot(r), Math.max(bestInSet.get(setSlot(r)) ?? 0, r.score));

  for (const r of ratings) {
    const a = byId.get(r.instanceId)!;
    const why = (x: string) => r.reasons.push(x);
    const shard = (reason: string) => {
      r.verdict = "shard";
      r.label = "shard";
      why(reason);
    };
    why(`${r.archetype ?? "legacy armor"}${r.gearTier ? `, Tier ${r.gearTier}` : ""}: ${r.topStats.map((t) => `${t.name} ${t.value}`).join(" / ")}`);
    if (r.setInfo) {
      const b = r.setInfo.bonuses.map((x) => `${x.pieces}pc ${x.name} (${x.tier ? x.tier + " tier" : "unrated"}${x.active ? ", active" : ""})`).join(", ");
      why(`${r.setInfo.name} set, ${r.setInfo.ownedSlots} of 5 slots owned${b ? `: ${b}` : ", not on Aegis's set list"}`);
    }
    if (a.location.equipped || protect.has(normalizeName(r.name)) || protect.has(r.instanceId) || settings.dimKeep.includes(r.instanceId)) {
      r.label = "protected";
      why(a.location.equipped ? "protected: equipped" : settings.dimKeep.includes(r.instanceId) ? "protected: tagged Favorite or Keep in DIM" : "protected: on your protect list");
      continue;
    }
    if (r.rarity === "Exotic") {
      const g = groups.get(groupKey(r))!;
      if (g[0] !== r) {
        r.verdict = "review";
        r.label = "shard";
        why(`extra copy of ${r.name}; the best roll scores ${g[0].score}`);
      } else why("best copy of this exotic");
      continue;
    }
    if (r.legacy) {
      const best = bestNew.get(`${r.classType}|${r.slot}`) ?? 0;
      if (s.legacyArmor === "shard") shard("legacy armor");
      else if (s.legacyArmor === "shard-if-outscored" && best > r.score) shard(`legacy armor outscored by new armor (${best})`);
      else if (s.legacyArmor === "keep-if-better" && best - r.score >= 10) shard(`legacy armor well below your new armor (${best})`);
      else r.label = "backup";
      continue;
    }
    const g = groups.get(groupKey(r))!;
    const rank = g.indexOf(r);
    // Keep the best piece per slot of a set whose bonus is worth running (C tier or better, 2+ slots owned).
    const setNeeded = r.setName && (r.setInfo?.ownedSlots ?? 0) >= 2 && (r.setInfo?.value ?? 0) >= 50 && r.score >= (bestInSet.get(setSlot(r)) ?? 0);
    if (rank === 0) {
      why(`best ${r.classType} ${r.slot} for ${r.archetype} + ${r.topStats[2]?.name ?? "?"}`);
    } else if (setNeeded) {
      r.label = "set";
      why(`best ${r.setName} ${r.slot} for your set bonus`);
    } else if (rank >= s.armorCopies) {
      shard(`you keep ${s.armorCopies} per archetype; a better copy scores ${g[0].score}`);
    } else {
      r.label = "backup";
      why(`backup to a ${g[0].score} piece`);
    }
  }

  const best: ArmorReport["best"] = {};
  for (const r of [...ratings].sort(sortDesc)) {
    if (r.verdict !== "keep") continue;
    const slot = ((best[r.classType] ??= {})[r.slot] ??= { overall: r, byArchetype: {} });
    slot.byArchetype[r.archetype ?? "Legacy"] ??= r;
  }
  return { ratings: ratings.sort(sortDesc), buildStats, best, setCounts, shard: ratings.filter((r) => r.verdict !== "keep") };
}
