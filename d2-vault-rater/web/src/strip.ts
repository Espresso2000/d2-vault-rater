/**
 * Cuts Bungie's manifest tables down to the fields the rater reads. The full item table is ~200 MB;
 * the stripped one is ~4 MB, small enough to cache in IndexedDB and to ship as a snapshot.
 * Used by the manifest worker (in the browser) and the snapshot script (in Node).
 */

/** Plug categories that never matter for rating: cosmetics, armor mods and the like. */
const COSMETIC = /shader|ornament|skin|emote|ghost|transmat|vehicle|ship|memento|tracker|^enhancements|spawnfx|sparrow|projection|finisher|deprecated|crafting|hologram|social|events\./i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

export function stripItems(items: Raw): Raw {
  const out: Raw = {};
  for (const d of Object.values(items)) {
    const dp = d.displayProperties ?? {};
    const inventory = d.inventory && { bucketTypeHash: d.inventory.bucketTypeHash, tierType: d.inventory.tierType };
    if (d.itemType === 3) {
      out[d.hash] = {
        hash: d.hash,
        displayProperties: { name: dp.name, icon: dp.icon },
        screenshot: d.screenshot,
        itemType: 3,
        itemTypeDisplayName: d.itemTypeDisplayName,
        defaultDamageType: d.defaultDamageType,
        inventory,
        equippingBlock: d.equippingBlock && { ammoType: d.equippingBlock.ammoType },
        sockets: d.sockets && { socketCategories: d.sockets.socketCategories },
        collectibleHash: d.collectibleHash,
      };
    } else if (d.itemType === 2) {
      out[d.hash] = {
        hash: d.hash,
        displayProperties: { name: dp.name, icon: dp.icon },
        itemType: 2,
        classType: d.classType,
        inventory,
        equippingBlock: d.equippingBlock && { equipableItemSetHash: d.equippingBlock.equipableItemSetHash },
        collectibleHash: d.collectibleHash,
      };
    } else if (d.plug && dp.name && !COSMETIC.test(d.plug.plugCategoryIdentifier ?? "")) {
      out[d.hash] = {
        hash: d.hash,
        displayProperties: { name: dp.name },
        itemType: d.itemType,
        itemTypeDisplayName: d.itemTypeDisplayName,
        plug: { plugCategoryIdentifier: d.plug.plugCategoryIdentifier },
      };
    }
  }
  return out;
}

export const stripNamed = (table: Raw): Raw => {
  const out: Raw = {};
  for (const [k, d] of Object.entries(table)) out[k] = { hash: d.hash, displayProperties: { name: d.displayProperties?.name ?? "" } };
  return out;
};

export const stripCollectibles = (table: Raw): Raw => {
  const out: Raw = {};
  for (const [k, d] of Object.entries(table)) if (d.sourceString && d.itemHash) out[k] = { sourceString: d.sourceString, itemHash: d.itemHash };
  return out;
};

export const stripActivities = (table: Raw): Raw => {
  const out: Raw = {};
  for (const [k, d] of Object.entries(table)) {
    if (!d.pgcrImage) continue;
    out[k] = { displayProperties: { name: d.displayProperties?.name ?? "" }, originalDisplayProperties: { name: d.originalDisplayProperties?.name ?? "" }, pgcrImage: d.pgcrImage };
  }
  return out;
};

export const TABLES = {
  items: ["DestinyInventoryItemDefinition", stripItems],
  stats: ["DestinyStatDefinition", stripNamed],
  itemSets: ["DestinyEquipableItemSetDefinition", stripNamed],
  collectibles: ["DestinyCollectibleDefinition", stripCollectibles],
  activities: ["DestinyActivityDefinition", stripActivities],
} as const;

export type TableKey = keyof typeof TABLES;

/** The stripped manifest the web app keeps: the rater's Manifest plus the two "extra" tables. */
export interface LiteManifest {
  version: string;
  items: Raw;
  stats: Raw;
  itemSets: Raw;
  collectibles: Raw;
  activities: Raw;
}
