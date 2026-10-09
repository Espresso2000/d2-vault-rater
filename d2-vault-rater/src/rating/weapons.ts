import { baseName, normalizeName, type Manifest } from "../bungie/manifest.js";
import type { AegisData, AegisWeapon, ColumnKey } from "../sources/aegis.js";
import type { WishlistData } from "../sources/wishlist.js";
import type { WeaponRecord } from "../vault/types.js";
import { strictnessFor, type Settings, type ShardCategory, type Tier } from "./settings.js";
import { groupBy } from "../util.js";

export const TIER_POINTS: Record<Tier, number> = { S: 100, A: 85, B: 70, C: 50, D: 30 };
export const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];
export const COLUMN_WEIGHTS: Record<ColumnKey, number> = {
  perk1: 0.35,
  perk2: 0.35,
  barrel: 0.1,
  magazine: 0.1,
  origin: 0.05,
  masterwork: 0.05,
};
export const WEAPON_WEIGHT = 0.6;
export const ROLL_WEIGHT = 0.4;

export interface WeaponRating {
  instanceId: string;
  itemHash: number;
  name: string;
  type: string;
  frame: string;
  element: string;
  slot: string;
  rarity: string;
  gearTier: number | null;
  icon: string;
  screenshot: string | null;
  locked: boolean;
  aegis: { tier: Tier; rank: number | null; tab: string; notes: string } | null;
  /** Tier the score was based on; for unrated weapons, the wishlist fallback. */
  effectiveTier: Tier;
  weaponScore: number;
  rollScore: number;
  score: number;
  /** Rolled options that match Aegis's picks, by column. */
  matched: Partial<Record<ColumnKey, string[]>>;
  perks: { kind: string; options: string[]; icons?: Record<string, string> }[];
  godRoll: boolean;
  trashRoll: boolean;
  verdict: "keep" | "shard" | "review";
  label: "best" | "backup" | "protected" | "unrated" | "shard";
  category: ShardCategory | null;
  reasons: string[];
}

export interface WeaponReport {
  ratings: WeaponRating[];
  bestBySlot: Record<string, WeaponRating[]>;
  bestByElement: Record<string, WeaponRating[]>;
  bestByArchetype: Record<string, WeaponRating[]>;
  duplicates: { name: string; keep: string; shard: string[] }[];
  shard: WeaponRating[];
  gaps: { name: string; tab: string; tier: Tier; element: string; frame: string }[];
  unratedCount: number;
}

const COLUMN_FOR_KIND: Record<string, ColumnKey | undefined> = {
  barrel: "barrel",
  magazine: "magazine",
  perk1: "perk1",
  perk2: "perk2",
  origin: "origin",
};

function aegisIndex(aegis: AegisData | null) {
  const byHash = new Map<number, AegisWeapon>();
  const byName = new Map<string, AegisWeapon>();
  const tierPosition = new Map<AegisWeapon, number>(); // 0..1, 0 = top of its tier in its tab
  for (const w of aegis?.weapons ?? []) {
    // Reissue rows share a name with the original; keep the better-tiered row.
    const better = (old?: AegisWeapon) => !old || TIER_ORDER.indexOf(w.tier) < TIER_ORDER.indexOf(old.tier);
    for (const h of w.hashes) if (better(byHash.get(h))) byHash.set(h, w);
    if (better(byName.get(normalizeName(w.name)))) byName.set(normalizeName(w.name), w);
  }
  for (const list of groupBy(aegis?.weapons ?? [], (w) => `${w.tab}|${w.tier}`).values()) {
    list.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    list.forEach((w, i) => tierPosition.set(w, list.length > 1 ? i / (list.length - 1) : 0));
  }
  return {
    find: (w: WeaponRecord) =>
      byHash.get(w.itemHash) ?? byName.get(baseName(w.name)) ?? null,
    tierPosition,
  };
}

/** Wishlist rolls for the weapons you own, with perk hashes turned into names to compare with records. */
function wishIndex(wl: WishlistData | null, m: Manifest | null, owned: Set<number>) {
  const byItem = new Map<number, { names: string[]; trash: boolean }[]>();
  if (!wl || !m) return byItem;
  const perkName = new Map<number, string>();
  const nameOf = (h: number) => {
    let n = perkName.get(h);
    if (n === undefined) perkName.set(h, (n = normalizeName(m.items[h]?.displayProperties?.name ?? "")));
    return n;
  };
  for (const r of wl.rolls) {
    // ~275k rolls; only those for items in the vault can match.
    if (!owned.has(r.itemHash)) continue;
    const names = r.perks.map(nameOf).filter(Boolean);
    const list = byItem.get(r.itemHash) ?? [];
    list.push({ names, trash: r.trash });
    byItem.set(r.itemHash, list);
  }
  return byItem;
}

export function scoreRoll(w: WeaponRecord, a: AegisWeapon | null) {
  const matched: Partial<Record<ColumnKey, string[]>> = {};
  if (!a) return { rollScore: w.rarity === "Exotic" ? 100 : 50, matched };
  let total = 0;
  for (const [col, weight] of Object.entries(COLUMN_WEIGHTS) as [ColumnKey, number][]) {
    const wanted = a.recommended[col].map(normalizeName);
    if (col === "masterwork") {
      if (!wanted.length) total += weight * 100;
      else if (!w.masterwork) total += weight * 50;
      else if (wanted.some((x) => normalizeName(w.masterwork!).includes(x))) {
        total += weight * 100;
        matched.masterwork = [w.masterwork];
      }
      continue;
    }
    const column = w.columns.find((c) => COLUMN_FOR_KIND[c.kind] === col);
    if (!wanted.length || !column) {
      total += weight * 100; // nothing to match against: no penalty
      continue;
    }
    const hits = column.options.filter((o) => wanted.includes(normalizeName(o)));
    if (hits.length) {
      matched[col] = hits;
      const enhanced = hits.some((h) => column.enhanced.includes(h));
      total += weight * 100 * (enhanced ? 1.1 : 1);
    }
  }
  if (matched.perk1 && matched.perk2) total += 10;
  return { rollScore: Math.min(100, Math.round(total)), matched };
}

const tierBelow = (t: Tier, floor: Tier) => TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(floor);

export function rateWeapons(
  weapons: WeaponRecord[],
  sources: { aegis: AegisData | null; wishlists: WishlistData | null; manifest: Manifest | null },
  settings: Settings,
): WeaponReport {
  const ai = aegisIndex(sources.aegis);
  const wi = wishIndex(sources.wishlists, sources.manifest, new Set(weapons.map((w) => w.itemHash)));
  const protect = new Set(settings.protect.map(normalizeName));
  const dimKeep = new Set(settings.dimKeep);

  const ratings: WeaponRating[] = weapons.map((w) => {
    const a = ai.find(w);
    const { rollScore, matched } = scoreRoll(w, a);
    const options = new Set(w.columns.flatMap((c) => c.options.map(normalizeName)));
    const rolls = wi.get(w.itemHash) ?? [];
    const fits = (r: { names: string[] }) => r.names.length > 0 && r.names.every((n) => options.has(n));
    const godRoll = rolls.some((r) => !r.trash && fits(r));
    const trashRoll = rolls.some((r) => r.trash && fits(r));
    const effectiveTier: Tier = a ? a.tier : godRoll ? "B" : "C";
    const pos = a ? ai.tierPosition.get(a) ?? 1 : 1;
    const weaponScore = Math.min(100, TIER_POINTS[effectiveTier] + (a ? Math.round(5 * (1 - pos)) : 0));
    return {
      instanceId: w.instanceId,
      itemHash: w.itemHash,
      name: w.name,
      type: w.type,
      frame: w.frame,
      element: w.element,
      slot: w.slot,
      rarity: w.rarity,
      gearTier: w.gearTier,
      icon: w.icon,
      screenshot: w.screenshot,
      locked: w.locked,
      aegis: a ? { tier: a.tier, rank: a.rank, tab: a.tab, notes: a.notes } : null,
      effectiveTier,
      weaponScore,
      rollScore,
      score: Math.round(WEAPON_WEIGHT * weaponScore + ROLL_WEIGHT * rollScore),
      matched,
      perks: w.columns.map((c) => ({ kind: c.kind, options: c.options, icons: c.icons })),
      godRoll,
      trashRoll,
      verdict: "keep",
      label: "best",
      category: null,
      reasons: [],
    };
  });

  const byId = new Map(weapons.map((w) => [w.instanceId, w]));
  const sortDesc = (a: WeaponRating, b: WeaponRating) => b.score - a.score || (b.gearTier ?? 0) - (a.gearTier ?? 0);

  // Protection
  const slotElementCount = new Map<string, number>();
  for (const r of ratings) slotElementCount.set(`${r.slot}|${r.element}`, (slotElementCount.get(`${r.slot}|${r.element}`) ?? 0) + 1);
  const reasonProtected = (r: WeaponRating): string | null => {
    const w = byId.get(r.instanceId)!;
    if (w.location.equipped) return "equipped on a character";
    if (w.adept) return "Adept/Timelost copy";
    if (protect.has(normalizeName(r.name)) || protect.has(normalizeName(r.instanceId))) return "on your protect list";
    if (dimKeep.has(r.instanceId)) return "tagged Favorite or Keep in DIM";
    if (slotElementCount.get(`${r.slot}|${r.element}`) === 1) return `your only ${r.element} ${r.slot.toLowerCase()} weapon`;
    return null;
  };
  // Worked out once: the duplicate sort below asks for it on every comparison.
  const protection = new Map(ratings.map((r) => [r, reasonProtected(r)]));
  const protectedReason = (r: WeaponRating) => protection.get(r) ?? null;

  // Duplicates: same weapon name, best copy first
  const sameName = groupBy(ratings, (r) => baseName(r.name));
  const duplicates: WeaponReport["duplicates"] = [];
  const dupShard = new Set<string>();
  for (const list of sameName.values()) {
    if (list.length < 2) continue;
    // Protected copies (equipped, Adept, protect list) are always kept and count as keepers.
    list.sort((a, b) => Number(protectedReason(b) !== null) - Number(protectedReason(a) !== null) || sortDesc(a, b));
    const s = strictnessFor(settings, list[0].type);
    const keepSet = [list[0]];
    for (const r of list.slice(1)) {
      if (protectedReason(r)) {
        keepSet.push(r);
        continue;
      }
      // A second copy survives only when allowed and it brings a different good perk pair.
      const differentPair =
        JSON.stringify([r.matched.perk1, r.matched.perk2]) !== JSON.stringify([list[0].matched.perk1, list[0].matched.perk2]);
      if (keepSet.length < s.copiesPerArchetype && differentPair && r.rollScore >= s.minRollKept) keepSet.push(r);
      else dupShard.add(r.instanceId);
    }
    const shard = list.filter((r) => dupShard.has(r.instanceId));
    if (shard.length) duplicates.push({ name: list[0].name, keep: list[0].instanceId, shard: shard.map((r) => r.instanceId) });
  }

  // Archetype groups: type + frame + element
  const groups = groupBy(ratings, (r) => `${r.type}|${r.frame}|${r.element}`);
  for (const list of groups.values()) list.sort(sortDesc);

  for (const r of ratings) {
    const s = strictnessFor(settings, r.type);
    const why = (x: string) => r.reasons.push(x);
    const shard = (cat: ShardCategory, reason: string) => {
      r.verdict = "shard";
      r.label = "shard";
      r.category = cat;
      why(reason);
    };
    if (r.aegis) why(`Aegis ${r.aegis.tier} tier${r.aegis.rank ? ` (#${r.aegis.rank} ${r.aegis.tab})` : ""}`);
    else why(r.godRoll ? "not in Aegis's sheet; matches a community god roll" : "not in Aegis's sheet");
    const hits = [...(r.matched.perk1 ?? []), ...(r.matched.perk2 ?? [])];
    if (hits.length) why(`recommended perks: ${hits.join(", ")}`);

    const prot = protectedReason(r);
    const group = groups.get(`${r.type}|${r.frame}|${r.element}`)!.filter((x) => !dupShard.has(x.instanceId));
    const rank = group.indexOf(r);

    if (r.rarity === "Exotic" && dupShard.has(r.instanceId)) {
      r.verdict = "review";
      r.label = "shard";
      r.category = "duplicate";
      why("extra copy of an exotic; check the roll before sharding");
      continue;
    }
    if (prot) {
      r.label = "protected";
      why(`protected: ${prot}`);
      continue;
    }
    if (dupShard.has(r.instanceId)) {
      shard("duplicate", "duplicate; a better copy is kept");
      continue;
    }
    if (r.trashRoll && r.rollScore < 50) {
      shard("trash-roll", "matches a community trash roll");
      continue;
    }
    if (!r.aegis && r.rarity !== "Exotic") {
      if (s.unrated === "shard-unless-godroll" && !r.godRoll) {
        shard("unrated", "unrated and not a known god roll");
        continue;
      }
      if (s.unrated === "wishlist" && !r.godRoll && rank !== 0) {
        shard("unrated", "unrated, not a known god roll, and not your best of its kind");
        continue;
      }
      if (s.unrated === "keep" || s.unrated === "keep-flagged") {
        r.label = "unrated";
        if (s.unrated === "keep-flagged") why("kept until it can be rated");
        continue;
      }
    }
    if (r.aegis && tierBelow(r.aegis.tier, s.minTierKept) && r.rollScore < s.minRollKept) {
      shard(r.aegis.tier === "D" ? "d-tier" : "low-tier", `below your ${s.minTierKept}-tier floor without a strong roll (roll ${r.rollScore})`);
      continue;
    }
    if (rank > 0) {
      const best = group[0];
      if (rank >= s.copiesPerArchetype) {
        shard("outscored", `you keep ${s.copiesPerArchetype} per archetype; ${best.name} scores ${best.score}`);
        continue;
      }
      if (best.score - r.score >= s.outscoredGap) {
        shard("outscored", `outscored by ${best.name} (${best.score} vs ${r.score})`);
        continue;
      }
      r.label = "backup";
      why(`backup to ${best.name}`);
      continue;
    }
    r.label = "best";
    why(`best ${r.frame ? r.frame.replace(/ Frame$/, "") + " " : ""}${r.type} in ${r.element}`);
  }

  const keepers = ratings.filter((r) => r.verdict === "keep");
  const topBy = (key: (r: WeaponRating) => string, n = 3) => {
    const out: Record<string, WeaponRating[]> = {};
    for (const r of [...keepers].sort(sortDesc)) {
      const k = key(r);
      if ((out[k] ??= []).length < n) out[k].push(r);
    }
    return out;
  };

  const ownedHashes = new Set(weapons.map((w) => w.itemHash));
  const ownedNames = new Set(weapons.map((w) => normalizeName(w.name)));
  const gaps = (sources.aegis?.weapons ?? [])
    .filter((a) => a.tier === "S" && !a.hashes.some((h) => ownedHashes.has(h)) && !ownedNames.has(normalizeName(a.name)))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, 15)
    .map((a) => ({ name: a.name, tab: a.tab, tier: a.tier, element: a.element, frame: a.frame }));

  return {
    ratings: ratings.sort(sortDesc),
    bestBySlot: topBy((r) => r.slot),
    bestByElement: topBy((r) => r.element),
    bestByArchetype: topBy((r) => `${r.frame.replace(/ Frame$/, "")} ${r.type}`.trim(), 1),
    duplicates,
    shard: ratings.filter((r) => r.verdict !== "keep"),
    gaps,
    unratedCount: ratings.filter((r) => !r.aegis && r.rarity !== "Exotic").length,
  };
}
