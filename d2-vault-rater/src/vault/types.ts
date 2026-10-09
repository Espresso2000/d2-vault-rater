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
}

export interface Location {
  /** "vault" or a character id */
  where: string;
  equipped: boolean;
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
  icon: string;
  screenshot: string | null;
  location: Location;
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
}
