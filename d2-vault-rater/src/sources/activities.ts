import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { paths, readJsonCached, writeJson } from "../config.js";
import { bungie, bungieUrl, BUNGIE } from "../bungie/client.js";
import { baseName, DAMAGE_TYPES as DAMAGE, normalizeName, stripReissue, versionSlug, type Manifest } from "../bungie/manifest.js";
import { setKey, type ArmorSetData } from "./armorSets.js";
import type { AegisData } from "./aegis.js";

/**
 * Every raid and dungeon currently in the game. Loot comes from Bungie's collections
 * ("Source: ..." text on each collectible) plus the source column of Aegis's sheet, so a weapon
 * either list ties to the activity shows up. `match` holds the names both sources use.
 */
export const ACTIVITIES: { key: string; name: string; kind: "raid" | "dungeon"; match: string[] }[] = [
  { key: "desert-perpetual", name: "The Desert Perpetual", kind: "raid", match: ["Desert Perpetual", "Epic Desert Perpetual", "Desert Perpetual - Epic"] },
  { key: "salvations-edge", name: "Salvation's Edge", kind: "raid", match: ["Salvation's Edge"] },
  { key: "crotas-end", name: "Crota's End", kind: "raid", match: ["Crota's End"] },
  { key: "root-of-nightmares", name: "Root of Nightmares", kind: "raid", match: ["Root of Nightmares"] },
  { key: "kings-fall", name: "King's Fall", kind: "raid", match: ["King's Fall"] },
  { key: "vow-of-the-disciple", name: "Vow of the Disciple", kind: "raid", match: ["Vow of the Disciple"] },
  { key: "vault-of-glass", name: "Vault of Glass", kind: "raid", match: ["Vault of Glass"] },
  { key: "deep-stone-crypt", name: "Deep Stone Crypt", kind: "raid", match: ["Deep Stone Crypt"] },
  { key: "garden-of-salvation", name: "Garden of Salvation", kind: "raid", match: ["Garden of Salvation"] },
  { key: "last-wish", name: "Last Wish", kind: "raid", match: ["Last Wish"] },
  { key: "equilibrium", name: "Equilibrium", kind: "dungeon", match: ["Equilibrium"] },
  { key: "sundered-doctrine", name: "Sundered Doctrine", kind: "dungeon", match: ["Sundered Doctrine"] },
  { key: "vespers-host", name: "Vesper's Host", kind: "dungeon", match: ["Vesper's Host"] },
  { key: "warlords-ruin", name: "Warlord's Ruin", kind: "dungeon", match: ["Warlord's Ruin"] },
  { key: "ghosts-of-the-deep", name: "Ghosts of the Deep", kind: "dungeon", match: ["Ghosts of the Deep"] },
  { key: "spire-of-the-watcher", name: "Spire of the Watcher", kind: "dungeon", match: ["Spire of the Watcher"] },
  { key: "duality", name: "Duality", kind: "dungeon", match: ["Duality"] },
  { key: "grasp-of-avarice", name: "Grasp of Avarice", kind: "dungeon", match: ["Grasp of Avarice"] },
  { key: "prophecy", name: "Prophecy", kind: "dungeon", match: ["Prophecy"] },
  { key: "pit-of-heresy", name: "Pit of Heresy", kind: "dungeon", match: ["Pit of Heresy"] },
  { key: "shattered-throne", name: "The Shattered Throne", kind: "dungeon", match: ["Shattered Throne"] },
];

/** Exotics earned through a quest inside the activity, which collections credit to the quest instead. */
const QUEST_EXOTICS: Record<string, string[]> = {
  "pit-of-heresy": ["Xenophage"],
  "shattered-throne": ["Wish-Ender"],
  "grasp-of-avarice": ["Gjallarhorn"],
  "garden-of-salvation": ["Divinity"],
};
/** Steps of an exotic quest that collections list as raid loot. */
const QUEST_STEPS = new Set(["husk of the pit", "eidolon ally"]);

export interface LootWeapon {
  name: string;
  hash: number | null;
  type: string;
  element: string;
  rarity: "Exotic" | "Legendary";
  icon: string;
  /** Where the link came from: Bungie's collections, Aegis's sheet, or an exotic quest in the activity. */
  from: ("collections" | "aegis" | "quest")[];
}

export interface ActivityLoot {
  key: string;
  name: string;
  kind: "raid" | "dungeon";
  image: string;
  weapons: LootWeapon[];
  /** Armor set names this activity drops (with set bonuses). */
  armorSets: string[];
}

export interface ActivityData {
  importedAt: string;
  manifestVersion: string;
  activities: ActivityLoot[];
}

export const activitiesFile = () => join(paths.sourcesDir, "activities.json");

interface ActivityDef { displayProperties?: { name?: string }; originalDisplayProperties?: { name?: string }; pgcrImage?: string }
interface CollectibleDef { sourceString?: string; itemHash?: number }

/** Download (once per game version) a manifest table the main loader does not keep in memory. */
async function extraTable<T>(name: string, version: string): Promise<Record<string, T>> {
  const dir = join(paths.manifestDir, versionSlug(version));
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.json`);
  if (!existsSync(file)) {
    const meta = await bungie<{ jsonWorldComponentContentPaths: Record<string, Record<string, string>> }>("/Destiny2/Manifest/", { auth: false });
    const res = await fetch(BUNGIE + meta.jsonWorldComponentContentPaths.en[name]);
    if (!res.ok) throw new Error(`Manifest download failed for ${name}: ${res.status}`);
    writeFileSync(file, await res.text());
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

const sourceMatches = (source: string, names: string[]) =>
  !/eververse|promotional|guided game/i.test(source) && names.some((n) => source.includes(n));

export async function importActivityLoot(m: Manifest, aegis: AegisData | null, sets: ArmorSetData | null): Promise<ActivityData> {
  const activities = await extraTable<ActivityDef>("DestinyActivityDefinition", m.version);
  const collectibles = await extraTable<CollectibleDef>("DestinyCollectibleDefinition", m.version);

  const out: ActivityLoot[] = ACTIVITIES.map((a) => {
    // Art: the most common loading-screen image among this activity's versions.
    const images: Record<string, number> = {};
    for (const d of Object.values(activities)) {
      const n = d.originalDisplayProperties?.name || d.displayProperties?.name || "";
      if (!a.match.some((x) => n.startsWith(x) || n.startsWith("The " + x)) || !d.pgcrImage || /placeholder/.test(d.pgcrImage)) continue;
      images[d.pgcrImage] = (images[d.pgcrImage] ?? 0) + 1;
    }
    const image = Object.entries(images).sort((x, y) => y[1] - x[1])[0]?.[0];

    const weapons = new Map<string, LootWeapon>();
    const armorSets = new Set<string>();
    for (const c of Object.values(collectibles)) {
      if (!c.sourceString || !c.itemHash || !sourceMatches(c.sourceString, a.match)) continue;
      const def = m.items[c.itemHash];
      if (!def?.displayProperties?.name) continue;
      if (def.itemType === 3) {
        const name = stripReissue(def.displayProperties.name);
        const k = normalizeName(name);
        if (!weapons.has(k) && !QUEST_STEPS.has(k))
          weapons.set(k, {
            name,
            hash: def.hash,
            type: def.itemTypeDisplayName ?? "Weapon",
            element: DAMAGE[def.defaultDamageType ?? 0] ?? "Kinetic",
            rarity: def.inventory?.tierType === 6 ? "Exotic" : "Legendary",
            icon: bungieUrl(def.displayProperties.icon),
            from: ["collections"],
          });
      } else if (def.itemType === 2) {
        const setName = def.equippingBlock?.equipableItemSetHash ? m.itemSets[def.equippingBlock.equipableItemSetHash]?.displayProperties?.name : null;
        if (setName) armorSets.add(sets?.sets[setKey(setName)]?.name ?? setName.replace(/\s+Set$/, ""));
      }
    }
    // Aegis's sheet: weapons whose source names this activity.
    for (const w of aegis?.weapons ?? []) {
      if (!w.source.split(/\s*,\s*/).some((s) => a.match.includes(s.trim()))) continue;
      const k = normalizeName(w.name);
      const have = weapons.get(k);
      if (have) {
        if (!have.from.includes("aegis")) have.from.push("aegis");
        continue;
      }
      const def = w.hashes.map((h) => m.items[h]).find(Boolean);
      weapons.set(k, {
        name: w.name,
        hash: def?.hash ?? null,
        type: def?.itemTypeDisplayName ?? w.tab,
        element: w.element || DAMAGE[def?.defaultDamageType ?? 0] || "Kinetic",
        rarity: def?.inventory?.tierType === 6 ? "Exotic" : "Legendary",
        icon: bungieUrl(def?.displayProperties.icon),
        from: ["aegis"],
      });
    }
    for (const name of QUEST_EXOTICS[a.key] ?? []) {
      const def = Object.values(m.items).find((d) => d.itemType === 3 && d.inventory?.tierType === 6 && d.displayProperties?.name === name);
      if (!def || weapons.has(normalizeName(name))) continue;
      weapons.set(normalizeName(name), {
        name,
        hash: def.hash,
        type: def.itemTypeDisplayName ?? "Weapon",
        element: DAMAGE[def.defaultDamageType ?? 0] ?? "Kinetic",
        rarity: "Exotic",
        icon: bungieUrl(def.displayProperties.icon),
        from: ["quest"],
      });
    }
    // Armor sets Aegis's set tab attributes to this activity.
    for (const s of Object.values(sets?.sets ?? {})) {
      if (s.source.split(/\s*[·,]\s*|\s+-\s+/).some((x) => a.match.includes(x.trim())) || a.match.includes(s.source.trim())) armorSets.add(s.name);
    }
    return { key: a.key, name: a.name, kind: a.kind, image: image ? bungieUrl(image) : "", weapons: [...weapons.values()], armorSets: [...armorSets] };
  });

  // Bungie's collections win over the sheet: drop a sheet-only weapon that collections credit to another activity.
  const owner = new Map<string, string>();
  for (const a of out) for (const w of a.weapons) if (w.from.includes("collections")) owner.set(normalizeName(w.name), a.key);
  for (const a of out) a.weapons = a.weapons.filter((w) => w.from.includes("collections") || (owner.get(normalizeName(w.name)) ?? a.key) === a.key);

  const data: ActivityData = { importedAt: new Date().toISOString(), manifestVersion: m.version, activities: out };
  writeJson(activitiesFile(), data);
  return data;
}

export interface WeaponSource {
  /** Bungie's collections text, e.g. "Vesper's Host" or "Complete activities on Io". */
  bungie: string | null;
  /** The source column on Aegis's sheet. */
  aegis: string | null;
  /** The raid or dungeon that drops it, when it is in RADS. */
  activity: { key: string; name: string } | null;
}

/** Where each weapon comes from, by item hash and name. */
export async function buildSourceLookup(m: Manifest, aegis: AegisData | null, loot: ActivityData | null): Promise<(hash: number, name: string) => WeaponSource> {
  const collectibles = await extraTable<CollectibleDef>("DestinyCollectibleDefinition", m.version).catch(() => ({}) as Record<string, CollectibleDef>);
  // Same-named reissues have different hashes; remember a source per name too.
  const byName = new Map<string, string>();
  const clean = (s: string) => s.replace(/^Source:\s*/i, "").replace(/\s+/g, " ").trim();
  for (const c of Object.values(collectibles)) {
    const def = c.itemHash ? m.items[c.itemHash] : null;
    if (def?.itemType !== 3 || !c.sourceString || /cannot be reacquired/i.test(c.sourceString)) continue;
    const k = baseName(def.displayProperties.name);
    // Fallback only (used when the item's own collectible has no source); keeps the first one found.
    if (!byName.has(k)) byName.set(k, clean(c.sourceString));
  }
  const aegisByName = new Map((aegis?.weapons ?? []).map((w) => [normalizeName(w.name), w.source.replace(/\n/g, ", ")]));
  const actByName = new Map<string, { key: string; name: string }>();
  for (const a of loot?.activities ?? []) for (const w of a.weapons) actByName.set(normalizeName(w.name), { key: a.key, name: a.name });
  return (hash, name) => {
    const k = baseName(name);
    const ch = m.items[hash]?.collectibleHash;
    const own = ch ? collectibles[String(ch)]?.sourceString : undefined;
    return {
      bungie: own && !/cannot be reacquired/i.test(own) ? clean(own) : byName.get(k) ?? null,
      aegis: aegisByName.get(k) || null,
      activity: actByName.get(k) ?? null,
    };
  };
}

export function loadActivityLoot(): ActivityData | null {
  return readJsonCached<ActivityData | null>(activitiesFile(), null);
}
