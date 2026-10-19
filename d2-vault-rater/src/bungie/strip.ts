/**
 * Cuts Bungie's manifest tables down to the fields the rater reads. The full item table is ~200 MB;
 * the stripped one is a few MB. The Node rater caches stripped tables per game version, and the web
 * app ships and stores them (see web/src/strip.ts).
 */

/** Bumped when stripped tables gain fields, so caches made by an older format are rebuilt. 2: plug icons. 3: plug descriptions. 4: stat icons. 5: weapon base stats. 6: weapon mod plug sets. */
export const STRIP_FORMAT = 6;

/** Plug categories that never matter for rating: cosmetics, armor mods and the like. */
const COSMETIC = /shader|ornament|skin|emote|ghost|transmat|vehicle|ship|memento|tracker|^enhancements|spawnfx|sparrow|projection|finisher|deprecated|crafting|hologram|social|events\./i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Raw = Record<string, any>;

/** A weapon's socket entries cut to the plug set hashes of its mod sockets (found by their default plug), or undefined if it has none. */
function modSocketSets(items: Raw, entries: Raw[] | undefined): Raw[] | undefined {
  if (!entries?.length) return undefined;
  let any = false;
  const out = entries.map((e) => {
    const pci = items[e.singleInitialItemHash]?.plug?.plugCategoryIdentifier ?? "";
    const set = e.reusablePlugSetHash || e.randomizedPlugSetHash;
    if (!/weapon\.mod_/.test(pci) || !set) return {};
    any = true;
    return e.reusablePlugSetHash ? { reusablePlugSetHash: e.reusablePlugSetHash } : { randomizedPlugSetHash: e.randomizedPlugSetHash };
  });
  return any ? out : undefined;
}

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
        // Socket entries only carry the plug set of a weapon mod socket, for the mods you could put in it.
        sockets: d.sockets && { socketCategories: d.sockets.socketCategories, socketEntries: modSocketSets(items, d.sockets.socketEntries) },
        // Base stats, for the stats the live item data leaves out (hidden ones like Aim Assistance and Zoom).
        stats: d.stats?.stats && { stats: Object.fromEntries(Object.values(d.stats.stats as Raw).map((x: Raw) => [x.statHash, { statHash: x.statHash, value: x.value }])) },
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
        // The icon and description are for showing perks as symbols, with what they do, in the report.
        displayProperties: { name: dp.name, icon: dp.icon, description: dp.description },
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
  for (const [k, d] of Object.entries(table)) out[k] = { hash: d.hash, displayProperties: { name: d.displayProperties?.name ?? "", ...(d.displayProperties?.icon ? { icon: d.displayProperties.icon } : {}) } };
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
