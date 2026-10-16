/**
 * Encounters for every raid and dungeon, with what each one asks of your loadout.
 * The facts live in encounters.json, one entry per encounter with the guides each fact was checked
 * against, so they can be audited without reading code. Monument of Triumph (June 2026) is the final sandbox.
 */
import data from "./encounters.json" with { type: "json" };

export type Role = "boss-burst" | "boss-sustained" | "precision" | "add-clear" | "range" | "close" | "sword" | "support";

export type ShieldElement = "Arc" | "Solar" | "Void" | "Stasis" | "Strand";
export type Range = "close" | "mid" | "long" | "mixed";

export interface Encounter {
  name: string;
  kind: "boss" | "mechanics" | "traversal";
  /** One or two sentences on what the encounter demands. */
  tip: string;
  /** Loadout needs in priority order; the first is the most important. */
  roles: Role[];
  /** Weapons guides single out for this encounter. */
  meta?: string[];
  /** Weapon types guides favour for this encounter, most recommended first. */
  types?: string[];
  /** Elemental shields you have to break, and how often you meet them. */
  shields?: { element: ShieldElement; on: string; frequency: "common" | "some" | "rare" }[];
  /** Champions on normal difficulty. */
  champions?: ("Barrier" | "Overload" | "Unstoppable")[];
  /** Where most of the add clear happens. */
  range?: Range;
  /** How the damage phase plays: a short burst or a long one, and whether the boss moves during it. */
  dps?: { style: "burst" | "sustained" | "none"; bossMoves?: boolean };
}

/** An encounter as encounters.json records it: the facts above plus where they came from. */
export interface EncounterSource extends Encounter {
  enemies?: string[];
  /** Guide pages the facts were checked against. */
  sources: string[];
  confidence?: "high" | "medium" | "low";
  /** Where guides disagreed, and which way this file went. */
  notes?: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  "boss-burst": "Burst DPS",
  "boss-sustained": "Sustained DPS",
  precision: "Precision",
  "add-clear": "Add clear",
  range: "Long range",
  close: "Close range",
  sword: "Sword DPS",
  support: "Support",
};

/** Weapon types that fill each role, with how well they fit (1 = ideal). */
export const ROLE_TYPES: Record<Role, Record<string, number>> = {
  "boss-burst": { "Rocket Launcher": 1, "Linear Fusion Rifle": 1, "Grenade Launcher": 0.9, "Sniper Rifle": 0.85, "Fusion Rifle": 0.75, Sword: 0.75, "Machine Gun": 0.7 },
  "boss-sustained": { "Machine Gun": 1, "Linear Fusion Rifle": 1, Sword: 0.95, "Trace Rifle": 0.9, "Grenade Launcher": 0.9, "Rocket Launcher": 0.85, "Sniper Rifle": 0.8 },
  precision: { "Sniper Rifle": 1, "Linear Fusion Rifle": 1, "Scout Rifle": 0.85, "Pulse Rifle": 0.8, "Hand Cannon": 0.8, "Trace Rifle": 0.8, "Combat Bow": 0.8 },
  "add-clear": { "Submachine Gun": 1, "Auto Rifle": 1, "Grenade Launcher": 0.95, "Pulse Rifle": 0.9, "Machine Gun": 0.9, "Hand Cannon": 0.85, Sidearm: 0.85, "Trace Rifle": 0.85, Glaive: 0.85, "Combat Bow": 0.8, "Fusion Rifle": 0.75, "Scout Rifle": 0.7, Shotgun: 0.7 },
  range: { "Scout Rifle": 1, "Sniper Rifle": 1, "Linear Fusion Rifle": 0.95, "Pulse Rifle": 0.9, "Combat Bow": 0.9, "Hand Cannon": 0.6 },
  close: { Shotgun: 1, "Fusion Rifle": 0.9, "Submachine Gun": 0.9, Glaive: 0.9, Sword: 0.85 },
  sword: { Sword: 1, Glaive: 0.6 },
  support: {},
};

/** Final-sandbox picks guides agree on for each role (Game Rant, Gaming ProMax, Aegis's notes). */
export const ROLE_META: Record<Role, string[]> = {
  "boss-burst": ["Gjallarhorn", "Still Hunt", "Cataclysmic", "Whisper of the Worm", "Two-Tailed Fox", "Fafnir", "Edge Transit", "Apex Predator", "Hezen Vengeance", "Dragon's Breath", "Parasite", "Whirling Ovation"],
  "boss-sustained": ["Microcosm", "Fafnir", "Cataclysmic", "Euphony", "Finality's Auger", "Pro Memoria", "Ergo Sum", "Whisper of the Worm", "Thunderlord", "Xenophage"],
  precision: ["Still Hunt", "Outbreak Perfected", "Thunderlord", "Conspiracy Honed", "Whisper of the Worm", "Cataclysmic", "Briar's Contempt"],
  "add-clear": ["Outbreak Perfected", "Choir of One", "Mint Retrograde", "Lost Signal", "Mida Mini-Tool", "Sunshot", "Trinity Ghoul", "Witherhoard"],
  range: ["Outbreak Perfected", "Choir of One", "Conspiracy Honed", "Still Hunt", "Le Monarque"],
  close: ["Conditional Finality", "Unvoiced", "Heritage", "Matador 64", "Mint Retrograde"],
  sword: ["Ergo Sum", "Bequest", "Falling Guillotine", "Lament"],
  support: ["Divinity", "Tractor Cannon", "Witherhoard"],
};

/** Every raid and dungeon's encounters, keyed like ACTIVITIES in sources/activities.ts. */
export const ENCOUNTERS = data.activities as unknown as Record<string, EncounterSource[]>;
