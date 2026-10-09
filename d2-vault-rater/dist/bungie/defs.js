/** Element names by Bungie damage type. */
export const DAMAGE_TYPES = { 1: "Kinetic", 2: "Arc", 3: "Solar", 4: "Void", 6: "Stasis", 7: "Strand" };
/** A game version as a file-name-safe string (manifest folders and snapshot files). */
export const versionSlug = (version) => version.replace(/[^\w.-]/g, "_");
// ponytail: unbounded cache, fine while keys are game item and perk names (tens of thousands at most).
const normalized = new Map();
/** Lower case, accents and quotes removed, everything else non-alphanumeric as single spaces. Cached: the rater asks for the same names constantly. */
export function normalizeName(s) {
    let n = normalized.get(s);
    if (n === undefined) {
        n = s
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[‘’“”'"]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
        normalized.set(s, n);
    }
    return n;
}
/** A weapon name without its "(Adept)", "(Timelost)" or "(Harrowed)" suffix. */
export const stripReissue = (name) => name.replace(/\s*\((adept|timelost|harrowed)\)\s*$/i, "");
/** The normalized name every copy of a weapon shares, Adept and Timelost versions included. */
export const baseName = (name) => normalizeName(stripReissue(name));
/** name -> every weapon hash with that name (reissues share names). */
export function weaponHashesByName(m) {
    const out = new Map();
    for (const d of Object.values(m.items)) {
        if (d.itemType !== 3 || !d.displayProperties?.name)
            continue;
        const key = baseName(d.displayProperties.name);
        const list = out.get(key) ?? [];
        list.push(d.hash);
        out.set(key, list);
    }
    return out;
}
//# sourceMappingURL=defs.js.map