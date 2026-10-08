import { normalizeName } from "../bungie/manifest.js";
import { strictnessFor } from "./settings.js";
import { SET_TIER_POINTS, setKey } from "../sources/armorSets.js";
/** Best possible primary + secondary + tertiary roll (Tier 5: 30 / 25 / 20). */
export const MAX_TOP3 = 75;
/** Weights: stats 40, build fit 25, set bonus 25, Tier 5 / exotic 10. */
export const ARMOR_WEIGHTS = { stats: 40, buildFit: 25, set: 25, extras: 10 };
/** Exotics have no set; a neutral set score keeps them from being marked down for it. */
const EXOTIC_SET_VALUE = 60;
const UNRATED_BONUS_POINTS = 40;
/**
 * How good a set is for you: an active 4-piece counts both bonuses (the better one weighs most),
 * an active 2-piece counts mostly the 2-piece, and a single piece is only potential.
 */
export function setValue(t2, t4, ownedSlots) {
    const two = t2 ?? UNRATED_BONUS_POINTS, four = t4 ?? UNRATED_BONUS_POINTS;
    if (ownedSlots >= 4)
        return Math.round(Math.max(two, four) * 0.8 + Math.min(two, four) * 0.2);
    if (ownedSlots >= 2)
        return Math.round(two * 0.85 + four * 0.15);
    return Math.round(Math.max(two, four) * 0.4);
}
const topStats = (a) => Object.entries(a.stats)
    .map(([name, value]) => ({ name, value }))
    .sort((x, y) => y.value - x.value)
    .slice(0, 3);
/** Stats each class's builds want: settings first, else the two highest stats on equipped armor. */
export function inferBuildStats(vault, settings) {
    const out = { ...settings.buildStats };
    const classOf = new Map(vault.characters.map((c) => [c.id, c.className]));
    const sums = {};
    for (const a of vault.armor) {
        if (!a.location.equipped)
            continue;
        const cls = classOf.get(a.location.where) ?? a.classType;
        for (const [k, v] of Object.entries(a.stats))
            ((sums[cls] ??= {})[k] = (sums[cls][k] ?? 0) + v);
    }
    for (const [cls, s] of Object.entries(sums)) {
        if (out[cls]?.length)
            continue;
        out[cls] = Object.entries(s)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([k]) => k);
    }
    return out;
}
export function rateArmor(vault, settings, setData = null) {
    const s = strictnessFor(settings);
    const protect = new Set(settings.protect.map(normalizeName));
    const buildStats = inferBuildStats(vault, settings);
    const setCounts = {};
    for (const a of vault.armor)
        if (a.setName)
            (setCounts[a.classType] ??= {})[a.setName] = (setCounts[a.classType][a.setName] ?? 0) + 1;
    const slotsOwned = new Map();
    for (const a of vault.armor) {
        if (!a.setName)
            continue;
        const k = `${a.classType}|${setKey(a.setName)}`;
        slotsOwned.set(k, (slotsOwned.get(k) ?? new Set()).add(a.slot));
    }
    const setInfoFor = (a) => {
        if (!a.setName)
            return null;
        const def = setData?.sets[setKey(a.setName)];
        const owned = slotsOwned.get(`${a.classType}|${setKey(a.setName)}`)?.size ?? 1;
        const pts = (pieces) => {
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
    const ratings = vault.armor.map((a) => {
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
    const sortDesc = (x, y) => y.score - x.score;
    const groupKey = (r) => r.rarity === "Exotic" ? `exotic|${r.itemHash}` : `${r.classType}|${r.slot}|${r.archetype}|${r.topStats[2]?.name ?? ""}`;
    const groups = new Map();
    for (const r of ratings.filter((r) => !r.legacy || r.rarity === "Exotic"))
        groups.set(groupKey(r), [...(groups.get(groupKey(r)) ?? []), r]);
    for (const g of groups.values())
        g.sort(sortDesc);
    const bestNew = new Map();
    for (const r of ratings)
        if (!r.legacy)
            bestNew.set(`${r.classType}|${r.slot}`, Math.max(bestNew.get(`${r.classType}|${r.slot}`) ?? 0, r.score));
    for (const r of ratings) {
        const a = byId.get(r.instanceId);
        const why = (x) => r.reasons.push(x);
        const shard = (reason) => {
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
            const g = groups.get(groupKey(r));
            if (g[0] !== r) {
                r.verdict = "review";
                r.label = "shard";
                why(`extra copy of ${r.name}; the best roll scores ${g[0].score}`);
            }
            else
                why("best copy of this exotic");
            continue;
        }
        if (r.legacy) {
            const best = bestNew.get(`${r.classType}|${r.slot}`) ?? 0;
            if (s.legacyArmor === "shard")
                shard("legacy armor");
            else if (s.legacyArmor === "shard-if-outscored" && best > r.score)
                shard(`legacy armor outscored by new armor (${best})`);
            else if (s.legacyArmor === "keep-if-better" && best - r.score >= 10)
                shard(`legacy armor well below your new armor (${best})`);
            else
                r.label = "backup";
            continue;
        }
        const g = groups.get(groupKey(r));
        const rank = g.indexOf(r);
        // Keep the best piece per slot of a set whose bonus is worth running (C tier or better, 2+ slots owned).
        const setNeeded = r.setName && (r.setInfo?.ownedSlots ?? 0) >= 2 && (r.setInfo?.value ?? 0) >= 50 &&
            !ratings.some((o) => o !== r && o.setName === r.setName && o.slot === r.slot && o.classType === r.classType && o.score > r.score);
        if (rank === 0) {
            why(`best ${r.classType} ${r.slot} for ${r.archetype} + ${r.topStats[2]?.name ?? "?"}`);
        }
        else if (setNeeded) {
            r.label = "set";
            why(`best ${r.setName} ${r.slot} for your set bonus`);
        }
        else if (rank >= s.armorCopies) {
            shard(`you keep ${s.armorCopies} per archetype; a better copy scores ${g[0].score}`);
        }
        else {
            r.label = "backup";
            why(`backup to a ${g[0].score} piece`);
        }
    }
    const best = {};
    for (const r of [...ratings].sort(sortDesc)) {
        if (r.verdict !== "keep")
            continue;
        const slot = ((best[r.classType] ??= {})[r.slot] ??= { overall: r, byArchetype: {} });
        slot.byArchetype[r.archetype ?? "Legacy"] ??= r;
    }
    return { ratings: ratings.sort(sortDesc), buildStats, best, setCounts, shard: ratings.filter((r) => r.verdict !== "keep") };
}
//# sourceMappingURL=armor.js.map