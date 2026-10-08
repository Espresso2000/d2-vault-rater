import { z } from "zod";
import { paths, readJson, writeJson } from "../config.js";
export const PRESETS = ["lenient", "balanced", "strict", "ruthless"];
export const SHARD_CATEGORIES = ["duplicate", "d-tier", "low-tier", "outscored", "trash-roll", "unrated", "armor"];
export const PRESET_VALUES = {
    lenient: {
        minTierKept: "C",
        minRollKept: 50,
        copiesPerArchetype: 3,
        outscoredGap: 35,
        unrated: "keep",
        armorCopies: 3,
        legacyArmor: "keep",
        unlock: ["duplicate"],
    },
    balanced: {
        minTierKept: "B",
        minRollKept: 70,
        copiesPerArchetype: 2,
        outscoredGap: 25,
        unrated: "keep-flagged",
        armorCopies: 2,
        legacyArmor: "keep-if-better",
        unlock: ["duplicate"],
    },
    strict: {
        minTierKept: "A",
        minRollKept: 80,
        copiesPerArchetype: 1,
        outscoredGap: 15,
        unrated: "wishlist",
        armorCopies: 1,
        legacyArmor: "shard-if-outscored",
        unlock: ["duplicate", "d-tier"],
    },
    ruthless: {
        minTierKept: "S",
        minRollKept: 90,
        copiesPerArchetype: 1,
        outscoredGap: 10,
        unrated: "shard-unless-godroll",
        armorCopies: 1,
        legacyArmor: "shard",
        unlock: ["duplicate", "d-tier", "low-tier", "outscored", "trash-roll", "unrated", "armor"],
    },
};
export const StrictnessOverride = z
    .object({
    minTierKept: z.enum(["S", "A", "B", "C", "D"]),
    minRollKept: z.number().min(0).max(100),
    copiesPerArchetype: z.number().int().min(1).max(10),
    outscoredGap: z.number().min(0).max(100),
    unrated: z.enum(["keep", "keep-flagged", "wishlist", "shard-unless-godroll"]),
    armorCopies: z.number().int().min(1).max(10),
    legacyArmor: z.enum(["keep", "keep-if-better", "shard-if-outscored", "shard"]),
    unlock: z.array(z.enum(SHARD_CATEGORIES)),
})
    .partial();
export const SettingsSchema = z.object({
    preset: z.enum(PRESETS).default("balanced"),
    overrides: StrictnessOverride.default({}),
    /** Per weapon type ("Submachine Gun", "Rocket Launcher") preset or overrides. */
    byWeaponType: z.record(z.string(), z.object({ preset: z.enum(PRESETS).optional(), overrides: StrictnessOverride.optional() })).default({}),
    focus: z.enum(["pve", "pvp", "both"]).default("pve"),
    /** Weapon or armor names (or instance ids) never marked for sharding. */
    protect: z.array(z.string()).default([]),
    /** Stats the player's builds want, e.g. {"Hunter": ["Grenade", "Weapons"]}. Inferred from equipped armor when empty. */
    buildStats: z.record(z.string(), z.array(z.string())).default({}),
    tone: z.enum(["short", "detailed"]).default("detailed"),
    wishlists: z.array(z.string()).default([]),
    aegisTabs: z.array(z.object({ name: z.string(), gid: z.string() })).default([]),
    /** Read DIM Sync data into the report. Each adds a request to DIM's API; turn off for faster reports. */
    dim: z
        .object({
        tags: z.boolean().default(true),
        loadouts: z.boolean().default(true),
        /** Never mark items you tagged Favorite or Keep in DIM for sharding. */
        protectTagged: z.boolean().default(true),
    })
        .default({ tags: true, loadouts: true, protectTagged: true }),
    /** Filled at rating time from DIM tags (never saved): instance ids tagged Favorite or Keep. */
    dimKeep: z.array(z.string()).default([]),
});
export function loadSettings() {
    return SettingsSchema.parse(readJson(paths.settings, {}));
}
export function saveSettings(s) {
    const parsed = SettingsSchema.parse(s);
    writeJson(paths.settings, parsed);
    return parsed;
}
/** Strictness for one weapon type: preset, then global overrides, then the type's own preset/overrides. */
export function strictnessFor(s, weaponType) {
    const t = weaponType ? s.byWeaponType[weaponType] : undefined;
    const base = PRESET_VALUES[t?.preset ?? s.preset];
    return { ...base, ...(t?.preset ? {} : s.overrides), ...(t?.overrides ?? {}) };
}
//# sourceMappingURL=settings.js.map