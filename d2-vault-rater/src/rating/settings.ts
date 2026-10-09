// zod/mini: the same validation as "zod" at a fraction of the size, since the web app bundles this file.
import * as z from "zod/mini";
import { paths, readJson, writeJson } from "../config.js";

export const PRESETS = ["lenient", "balanced", "strict", "ruthless"] as const;
export type Preset = (typeof PRESETS)[number];
export type Tier = "S" | "A" | "B" | "C" | "D";

export const SHARD_CATEGORIES = ["duplicate", "d-tier", "low-tier", "outscored", "trash-roll", "unrated", "armor"] as const;
export type ShardCategory = (typeof SHARD_CATEGORIES)[number];

export interface Strictness {
  /** Lowest Aegis tier kept even without a great roll. */
  minTierKept: Tier;
  /** Roll score (0-100) a non-best copy needs to be kept. */
  minRollKept: number;
  /** Copies kept per weapon type + frame + element. */
  copiesPerArchetype: number;
  /** Score gap below the group's best that marks a weapon outscored. */
  outscoredGap: number;
  /** How weapons missing from Aegis's sheet are treated. */
  unrated: "keep" | "keep-flagged" | "wishlist" | "shard-unless-godroll";
  /** Armor copies kept per class + slot + archetype + tertiary stat. */
  armorCopies: number;
  legacyArmor: "keep" | "keep-if-better" | "shard-if-outscored" | "shard";
  /** Shard categories that get unlocked when a DIM plan is applied. */
  unlock: ShardCategory[];
}

export const PRESET_VALUES: Record<Preset, Strictness> = {
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

const between = (min: number, max: number) => z.number().check(z.minimum(min), z.maximum(max));
const count = () => z.int().check(z.minimum(1), z.maximum(10));

export const StrictnessOverride = z.partial(
  z.object({
    minTierKept: z.enum(["S", "A", "B", "C", "D"]),
    minRollKept: between(0, 100),
    copiesPerArchetype: count(),
    outscoredGap: between(0, 100),
    unrated: z.enum(["keep", "keep-flagged", "wishlist", "shard-unless-godroll"]),
    armorCopies: count(),
    legacyArmor: z.enum(["keep", "keep-if-better", "shard-if-outscored", "shard"]),
    unlock: z.array(z.enum(SHARD_CATEGORIES)),
  }),
);

export const SettingsSchema = z.object({
  preset: z._default(z.enum(PRESETS), "balanced"),
  overrides: z._default(StrictnessOverride, {}),
  /** Per weapon type ("Submachine Gun", "Rocket Launcher") preset or overrides. */
  byWeaponType: z._default(z.record(z.string(), z.object({ preset: z.optional(z.enum(PRESETS)), overrides: z.optional(StrictnessOverride) })), {}),
  focus: z._default(z.enum(["pve", "pvp", "both"]), "pve"),
  /** Weapon or armor names (or instance ids) never marked for sharding. */
  protect: z._default(z.array(z.string()), []),
  /** Stats the player's builds want, e.g. {"Hunter": ["Grenade", "Weapons"]}. Inferred from equipped armor when empty. */
  buildStats: z._default(z.record(z.string(), z.array(z.string())), {}),
  tone: z._default(z.enum(["short", "detailed"]), "detailed"),
  wishlists: z._default(z.array(z.string()), []),
  aegisTabs: z._default(z.array(z.object({ name: z.string(), gid: z.string() })), []),
  /** Read DIM Sync data into the report. Each adds a request to DIM's API; turn off for faster reports. */
  dim: z._default(
    z.object({
      tags: z._default(z.boolean(), true),
      loadouts: z._default(z.boolean(), true),
      /** Never mark items you tagged Favorite or Keep in DIM for sharding. */
      protectTagged: z._default(z.boolean(), true),
    }),
    { tags: true, loadouts: true, protectTagged: true },
  ),
  /** Filled at rating time from DIM tags (never saved): instance ids tagged Favorite or Keep. */
  dimKeep: z._default(z.array(z.string()), []),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function loadSettings(): Settings {
  return SettingsSchema.parse(readJson(paths.settings, {}));
}

export function saveSettings(s: Settings): Settings {
  const parsed = SettingsSchema.parse(s);
  writeJson(paths.settings, parsed);
  return parsed;
}

/**
 * Apply what the report page's Settings panel sends (local server and web app alike).
 * Only fields with the right type are taken; everything else is ignored.
 */
export function applyPageSettings(st: Settings, body: Record<string, unknown>): Settings {
  const d = (body.dim ?? {}) as Partial<Record<keyof Settings["dim"], unknown>>;
  for (const k of ["tags", "loadouts", "protectTagged"] as const) {
    const v = d[k];
    if (typeof v === "boolean") st.dim[k] = v;
  }
  if (typeof body.preset === "string" && (PRESETS as readonly string[]).includes(body.preset)) st.preset = body.preset as Preset;
  if (body.focus === "pve" || body.focus === "pvp" || body.focus === "both") st.focus = body.focus;
  if (Array.isArray(body.protect)) st.protect = body.protect.filter((x): x is string => typeof x === "string");
  if (body.byWeaponType && typeof body.byWeaponType === "object") st.byWeaponType = body.byWeaponType as Settings["byWeaponType"];
  return st;
}

/** Strictness for one weapon type: preset, then global overrides, then the type's own preset/overrides. */
export function strictnessFor(s: Settings, weaponType?: string): Strictness {
  const t = weaponType ? s.byWeaponType[weaponType] : undefined;
  const base = PRESET_VALUES[t?.preset ?? s.preset];
  return { ...base, ...(t?.preset ? {} : s.overrides), ...(t?.overrides ?? {}) } as Strictness;
}
