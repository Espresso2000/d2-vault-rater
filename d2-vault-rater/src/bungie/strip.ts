/**
 * Cuts Bungie's manifest tables down to the fields the rater reads. The full item table is ~200 MB;
 * the stripped one is a few MB. The Node rater caches stripped tables per game version, and the web
 * app ships and stores them (see web/src/strip.ts).
 */

/** Plug categories that never matter for rating: cosmetics, armor mods and the like. */
const COSMETIC = /shader|ornament|skin|emote|ghost|transmat|vehicle|ship|memento|tracker|^enhancements|spawnfx|sparrow|projection|finisher|deprecated|crafting|hologram|social|events\./i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Raw = Record<string, any>;

/**
 * Weapons, armor and plugs, with only the fields the rater reads. `allPlugs` keeps every plug, cosmetic
 * and unnamed ones too, so vault decoding sees exactly what the full table has; the web app leaves them
 * out to stay small.
 */
export function stripItems(items: Raw, allPlugs = false): Raw {
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
    } else if (d.plug && (allPlugs || (dp.name && !COSMETIC.test(d.plug.plugCategoryIdentifier ?? "")))) {
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
