import { normalizeName } from "../bungie/manifest.js";
import { ENCOUNTERS, ROLE_META, ROLE_TYPES } from "../data/encounters.js";
const base = (n) => normalizeName(n.replace(/\s*\((adept|harrowed|timelost)\)\s*$/i, ""));
/** Boss roles want heavy grenade launchers, not the special ones. */
const BOSS_ROLES = new Set(["boss-burst", "boss-sustained"]);
const ROLE_WEIGHT = [1, 0.8, 0.6];
const FALLBACK = ["add-clear", "precision", "boss-sustained", "range"];
function candidates(role, enc, weapons) {
    const encMeta = new Set((enc.meta ?? []).map(normalizeName));
    const roleMeta = new Set(ROLE_META[role].map(normalizeName));
    const best = new Map();
    for (const r of weapons) {
        const k = base(r.name);
        // An encounter's guide pick only counts for a role it can actually fill.
        const fitsRole = role === "support" ? roleMeta.has(k) : roleMeta.has(k) || (ROLE_TYPES[role][r.type] ?? 0) > 0;
        const meta = encMeta.has(k) && fitsRole ? "encounter" : roleMeta.has(k) ? "role" : null;
        let fit = ROLE_TYPES[role][r.type] ?? 0;
        if (r.type === "Grenade Launcher" && BOSS_ROLES.has(role) && r.slot !== "Power")
            fit = 0;
        if (role === "support")
            fit = meta ? 1 : 0;
        if (!fit && !meta)
            continue;
        const s = r.score * Math.max(fit, meta ? 0.9 : 0) + (meta === "encounter" ? 30 : meta === "role" ? 15 : 0);
        const old = best.get(k);
        if (!old || s > old.s)
            best.set(k, { r, s, meta });
    }
    return [...best.values()].sort((a, b) => b.s - a.s).slice(0, 8);
}
/** Best three-weapon loadout from your vault: one per slot, at most one exotic, roles filled in priority order. */
export function planEncounter(enc, weapons) {
    // A role nothing in the vault can fill (usually Support) falls back to the next useful one.
    const roles = [];
    for (const role of enc.roles) {
        const next = [role, ...FALLBACK].find((r) => !roles.includes(r) && candidates(r, enc, weapons).length);
        if (next)
            roles.push(next);
    }
    enc = { ...enc, roles };
    const lists = enc.roles.map((role) => candidates(role, enc, weapons));
    let bestCombo = [];
    let bestScore = -1;
    const walk = (i, chosen, score) => {
        if (i === lists.length) {
            if (score > bestScore)
                [bestScore, bestCombo] = [score, [...chosen]];
            return;
        }
        let placed = false;
        for (const c of lists[i]) {
            if (chosen.some((x) => x.c.r.slot === c.r.slot || base(x.c.r.name) === base(c.r.name)))
                continue;
            if (c.r.rarity === "Exotic" && chosen.some((x) => x.c.r.rarity === "Exotic"))
                continue;
            placed = true;
            walk(i + 1, [...chosen, { c, role: enc.roles[i] }], score + c.s * ROLE_WEIGHT[i]);
        }
        if (!placed)
            walk(i + 1, chosen, score); // role left empty when nothing fits
    };
    walk(0, [], 0);
    const picks = bestCombo.map(({ c, role }) => ({ role, id: c.r.instanceId, name: c.r.name, meta: c.meta }));
    const owned = new Set(weapons.map((w) => base(w.name)));
    const missing = [...new Set([...(enc.meta ?? []), ...ROLE_META[enc.roles[0]]])].filter((n) => !owned.has(normalizeName(n))).slice(0, 4);
    return { ...enc, picks, missing };
}
export function planEncounters(weapons) {
    return Object.fromEntries(Object.entries(ENCOUNTERS).map(([key, list]) => [key, list.map((e) => planEncounter(e, weapons))]));
}
//# sourceMappingURL=encounters.js.map