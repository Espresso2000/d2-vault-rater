export type Element = "Kinetic" | "Arc" | "Solar" | "Void" | "Stasis" | "Strand" | "Unknown";
export type WeaponSlot = "Kinetic" | "Energy" | "Power" | "Unknown";
export type ArmorSlot = "Helmet" | "Arms" | "Chest" | "Legs" | "Class Item" | "Unknown";
export type ClassName = "Titan" | "Hunter" | "Warlock" | "Any";

/** One perk column on a weapon: every plug the player can currently select there. */
export interface PerkColumn {
  kind: "barrel" | "magazine" | "perk1" | "perk2" | "origin" | "other";
  /** Currently inserted plug name. */
  active: string;
  /** All selectable plug names (includes active). Tier 3+ weapons have several. */
  options: string[];
  /** Names of the options that are enhanced versions. */
  enhanced: string[];
  /** Icon URL by option name, for options that have one. Missing in vault snapshots saved before icons were kept. */
  icons?: Record<string, string>;
  /** Description by option name, for options that have one. Missing in older vault snapshots. */
  descriptions?: Record<string, string>;
  /** The weapon's socket index for this column, and plug hash by option name, for switching perks. Missing in older vault snapshots. */
  socket?: number;
  hashes?: Record<string, number>;
}

export interface Location {
  /** "vault" or a character id */
  where: string;
  equipped: boolean;
  /** In that character's postmaster (Lost Items): not in its slots until it's pulled. */
  postmaster?: boolean;
}

export interface WeaponRecord {
  kind: "weapon";
  instanceId: string;
  itemHash: number;
  name: string;
  type: string; // e.g. "Submachine Gun"
  frame: string; // e.g. "Lightweight Frame"
  element: Element;
  slot: WeaponSlot;
  ammo: "Primary" | "Special" | "Heavy" | "Unknown";
  rarity: "Exotic" | "Legendary" | "Other";
  gearTier: number | null;
  power: number | null;
  locked: boolean;
  crafted: boolean;
  adept: boolean;
  columns: PerkColumn[];
  masterwork: string | null;
  /** Stat name -> value: this copy's live stats, then base stats for the ones the live data leaves out. Missing in older vault snapshots. */
  stats?: Record<string, number>;
  /** Names of the stats in `stats` that come from the weapon's base stats, not this copy. */
  baseStats?: string[];
  /** The intrinsic (frame) perk and the masterwork and weapon mod plugs, for the details panel. Missing in older vault snapshots. */
  intrinsic?: WeaponPlug | null;
  mods?: WeaponMod[];
  icon: string;
  screenshot: string | null;
  location: Location;
}

export interface WeaponPlug {
  name: string;
  icon: string | null;
  description: string;
}

/** A masterwork or weapon mod socket: what's in it and, for mod sockets, the mods you could put in instead. */
export interface WeaponMod extends WeaponPlug {
  kind: "masterwork" | "mod";
  /** The socket index, for switching the mod in game. */
  socket?: number;
  /** Mods you own that fit this socket (with the empty socket), by plug item hash. */
  options?: (WeaponPlug & { hash: number })[];
}

export interface ArmorRecord {
  kind: "armor";
  instanceId: string;
  itemHash: number;
  name: string;
  classType: ClassName;
  slot: ArmorSlot;
  rarity: "Exotic" | "Legendary" | "Other";
  gearTier: number | null;
  power?: number | null;
  /** stat name -> value as reported by the API */
  stats: Record<string, number>;
  statTotal: number;
  archetype: string | null;
  setName: string | null;
  /** true for armor that predates Armor 3.0 (no archetype plug) */
  legacy: boolean;
  locked: boolean;
  icon: string;
  location: Location;
}

export interface Vault {
  fetchedAt: string;
  membershipId: string;
  membershipType: number;
  characters: { id: string; className: ClassName }[];
  weapons: WeaponRecord[];
  armor: ArmorRecord[];
  /** Armor stat name -> its icon URL, from the manifest. */
  statIcons?: Record<string, string>;
}
