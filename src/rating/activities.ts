import { normalizeName } from "../bungie/manifest.js";
import type { AegisData, AegisWeapon } from "../sources/aegis.js";
import type { ActivityData, LootWeapon } from "../sources/activities.js";
import { SET_TIER_POINTS, setKey, type ArmorSetData, type SetTier } from "../sources/armorSets.js";
import type { WeaponRating } from "./weapons.js";
import type { ArmorRating } from "./armor.js";

const TIER_POINTS: Record<string, number> = { S: 100, A: 85, B: 70, C: 50, D: 30 };
const UNRATED_POINTS = 40;
/** A copy with this roll score or better counts as a roll you already have. */
const GOOD_ROLL = 70;

export type LootStatus = "chase" | "upgrade" | "have";

export interface RatedLoot extends LootWeapon {
  tier: string | null;
  aegisRank: number | null;
  tab: string | null;
  frame: string;
  notes: string;
  /** Copies you own, your best vault score and roll score among them. */
  owned: number;
  bestScore: number | null;
  bestRoll: number | null;
  status: LootStatus;
}

export interface RatedSet {
  name: string;
  source: string;
  bonuses: { pieces: number; name: string; tier: SetTier | null }[];
  /** Distinct slots of the set you own, per class. */
  ownedSlots: Record<string, number>;
  value: number;
}

export interface RatedActivity {
  key: string;
  name: string;
  kind: "raid" | "dungeon";
  image: string;
  rank: number;
  score: number;
  verdict: "Farm it" | "Worth a run" | "Low priority";
  parts: { quality: number; need: number; sets: number };
  weapons: RatedLoot[];
  sets: RatedSet[];
  counts: { chase: number; upgrade: number; have: number; sTier: number };
}

const base = (n: string) => normalizeName(n.replace(/\s*\((adept|harrowed|timelost)\)\s*$/i, ""));

/**
 * Ranks raids and dungeons by how much they would add to this vault:
 * 40% loot quality (the activity's three best weapons on Aegis's sheet),
 * 40% need (good loot you lack, or own only with a weak roll), 20% armor set bonus you don't have yet.
 */
export function rateActivities(
  loot: ActivityData,
  aegis: AegisData | null,
  weapons: WeaponRating[],
  armor: ArmorRating[],
  sets: ArmorSetData | null,
): RatedActivity[] {
  const byName = new Map<string, AegisWeapon>();
  for (const w of aegis?.weapons ?? []) {
    const k = normalizeName(w.name), old = byName.get(k);
    if (!old || "SABCD".indexOf(w.tier) < "SABCD".indexOf(old.tier)) byName.set(k, w);
  }
  const mine = new Map<string, WeaponRating[]>();
  for (const r of weapons) mine.set(base(r.name), [...(mine.get(base(r.name)) ?? []), r]);
  const slots = new Map<string, Map<string, Set<string>>>();
  for (const a of armor) {
    if (!a.setName) continue;
    const bySet = slots.get(setKey(a.setName)) ?? new Map<string, Set<string>>();
    bySet.set(a.classType, (bySet.get(a.classType) ?? new Set()).add(a.slot));
    slots.set(setKey(a.setName), bySet);
  }

  const rated = loot.activities.map((act) => {
    const ws: RatedLoot[] = act.weapons.map((w) => {
      const ae = byName.get(normalizeName(w.name)) ?? null;
      const copies = mine.get(base(w.name)) ?? [];
      const bestScore = copies.length ? Math.max(...copies.map((c) => c.score)) : null;
      const bestRoll = copies.length ? Math.max(...copies.map((c) => c.rollScore)) : null;
      const status: LootStatus = !copies.length ? "chase" : (bestRoll ?? 0) >= GOOD_ROLL || copies.some((c) => c.godRoll) ? "have" : "upgrade";
      return { ...w, tier: ae?.tier ?? null, aegisRank: ae?.rank ?? null, tab: ae?.tab ?? null, frame: ae?.frame ?? "", notes: ae?.notes ?? "", owned: copies.length, bestScore, bestRoll, status };
    });
    const pts = (w: RatedLoot) => (w.tier ? TIER_POINTS[w.tier] : UNRATED_POINTS);
    ws.sort((a, b) => pts(b) - pts(a) || (a.aegisRank ?? 99) - (b.aegisRank ?? 99) || a.name.localeCompare(b.name));

    const top = ws.slice(0, 3).map(pts);
    const quality = top.length ? Math.round(top.reduce((n, x) => n + x, 0) / top.length) : 0;
    const good = ws.filter((w) => w.tier && "SAB".includes(w.tier));
    const need = good.length
      ? Math.round((100 * good.reduce((n, w) => n + (pts(w) / 100) * (w.status === "chase" ? 1 : w.status === "upgrade" ? 0.5 : 0), 0)) / good.length)
      : 0;

    const rs: RatedSet[] = act.armorSets.map((name) => {
      const def = sets?.sets[setKey(name)];
      const owned: Record<string, number> = Object.fromEntries([...(slots.get(setKey(name)) ?? new Map<string, Set<string>>()).entries()].map(([cls, s]) => [cls, s.size]));
      const best = Math.max(0, ...(def?.bonuses ?? []).map((b) => (b.tier ? SET_TIER_POINTS[b.tier] : 0)));
      const most = Math.max(0, ...Object.values(owned));
      return {
        name: def?.name ?? name,
        source: def?.source ?? act.name,
        bonuses: (def?.bonuses ?? []).map((b) => ({ pieces: b.pieces, name: b.name, tier: b.tier })),
        ownedSlots: owned,
        // A strong set is worth more while you still lack pieces of it.
        value: Math.round(best * (1 - 0.6 * Math.min(1, most / 5))),
      };
    });
    const setPart = Math.max(0, ...rs.map((s) => s.value));
    const score = Math.round(0.4 * quality + 0.4 * need + 0.2 * setPart);
    return {
      key: act.key,
      name: act.name,
      kind: act.kind,
      image: act.image,
      rank: 0,
      score,
      verdict: (score >= 70 ? "Farm it" : score >= 50 ? "Worth a run" : "Low priority") as RatedActivity["verdict"],
      parts: { quality, need, sets: setPart },
      weapons: ws,
      sets: rs,
      counts: {
        chase: ws.filter((w) => w.status === "chase").length,
        upgrade: ws.filter((w) => w.status === "upgrade").length,
        have: ws.filter((w) => w.status === "have").length,
        sTier: ws.filter((w) => w.tier === "S").length,
      },
    };
  });
  rated.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  rated.forEach((r, i) => (r.rank = i + 1));
  return rated;
}
