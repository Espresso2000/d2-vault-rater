/**
 * What vendors sell right now (Zavala's weekly weapons, Banshee, Xûr and the rest), decoded into the
 * same weapon and armor records as the vault so the rater can score them. Uses GetVendors, which needs
 * the player's sign-in: it returns each sale item's actual rolled perks and stats for one character.
 */
import { bungie, bungieUrl } from "../bungie/client.js";
import { loadManifest, versionSlug, type Manifest } from "../bungie/manifest.js";
import { paths, readJson, writeJson } from "../config.js";
import { primaryMembership } from "../bungie/oauth.js";
import { decodeProfile, type RawProfile } from "../vault/decode.js";
import type { ArmorRecord, WeaponRecord } from "../vault/types.js";

/** 400 vendors, 402 sales, 300 instances, 304 stats, 305 sockets, 310 reusable plugs (every perk in each column). */
export const VENDOR_COMPONENTS = [400, 402, 300, 304, 305, 310];
/** Item components asked of one vendor at a time (GetVendors returns none of them). */
const ITEM_COMPONENTS = [300, 304, 305, 310];

interface RawSale {
  vendorItemIndex: number;
  itemHash: number;
  quantity: number;
  costs?: { itemHash: number; quantity: number }[];
  overrideNextRefreshDate?: string;
}

/** The parts of a GetVendors response this module reads. */
export interface RawVendors {
  /** The vendors you visit (Zavala, Banshee, Xûr…); everything else is a sub-vendor or an archive. */
  vendorGroups?: { data?: { groups: { vendorGroupHash: number; vendorHashes: number[] }[] } };
  vendors?: { data?: Record<string, { vendorHash: number; enabled: boolean; canPurchase: boolean; nextRefreshDate?: string }> };
  sales?: { data?: Record<string, { saleItems: Record<string, RawSale> }> };
  itemComponents?: Record<string, RawProfile["itemComponents"]>;
}

/** The few DestinyVendorDefinition fields shown on the tab. */
export interface VendorDef {
  name: string;
  subtitle: string;
  icon: string;
}

export interface VendorCost {
  itemHash: number;
  name: string;
  icon: string;
  quantity: number;
}

/** A sale item's price and refresh time, keyed by the record's instanceId. */
export interface SaleInfo {
  costs: VendorCost[];
  refreshes: string | null;
  /** False when the sale has no rolled perks to read (a preview), so its roll is decided on purchase. */
  rolled: boolean;
}

/**
 * Eververse's currencies. Its offers are spread over Tess Everis and many unnamed sub-vendors (one per
 * featured slot), so they are found by price: anything sold for Bright Dust or Silver. Cosmetics are
 * listed with price and time left, never rated.
 */
export const BRIGHT_DUST = 2817410917;
export const SILVER = 3147280338;
const EVERVERSE_COST = new Set([BRIGHT_DUST, SILVER]);

/**
 * The Eververse offers worth listing: the rotating ones (they leave before their vendor's weekly reset,
 * usually the next daily reset) and anything for Bright Dust. The weekly Silver catalog is left out.
 */
export function isListedOffer(s: RawSale, vendorRefresh: string | undefined): boolean {
  const costs = s.costs ?? [];
  if (!costs.some((c) => EVERVERSE_COST.has(c.itemHash))) return false;
  const rotating = !!s.overrideNextRefreshDate && s.overrideNextRefreshDate < (vendorRefresh ?? "9");
  return rotating || costs.some((c) => c.itemHash === BRIGHT_DUST);
}

/** A sale item the rater can't score (Eververse's cosmetics). */
export interface Offer {
  name: string;
  icon: string;
  type: string;
  costs: VendorCost[];
  /** When this offer leaves the store (ISO), if it rotates on its own clock (Eververse's daily offers). */
  refreshes: string | null;
  /** Leaves before the weekly reset: one of the daily featured offers. */
  daily: boolean;
}

export interface VendorStock {
  vendorHash: number;
  name: string;
  subtitle: string;
  icon: string;
  /** When the vendor's inventory changes next (ISO), if Bungie says. */
  refreshes: string | null;
  weapons: WeaponRecord[];
  armor: ArmorRecord[];
  sales: Record<string, SaleInfo>;
  offers: Offer[];
}

/** Sale records get ids no vault item can have, so they never clash with owned copies when rated together. */
export const saleId = (vendorHash: number, index: number | string) => `vendor:${vendorHash}:${index}`;
export const isSaleId = (id: string) => id.startsWith("vendor:");

/**
 * Gear only from vendors you visit and their weekly reward lists: exotic archives, season passes and
 * legacy gear lists are collections to re-buy from, not this week's stock.
 */
function gearFilter(raw: RawVendors, defs: Record<string, VendorDef | undefined>) {
  const groups = raw.vendorGroups?.data?.groups;
  const visited = new Set(groups?.flatMap((g) => g.vendorHashes) ?? []);
  return (hash: string) => !groups || visited.has(Number(hash)) || /^weekly\b/i.test(defs[hash]?.name ?? "");
}

/**
 * Turns a GetVendors response into one stock list per vendor that sells weapons or armor.
 * Each vendor's sale items are decoded like vault items: their item components are keyed by
 * vendorItemIndex, which stands in for the instance id.
 */
export function decodeVendors(
  raw: RawVendors,
  m: Manifest,
  defs: Record<string, VendorDef | undefined>,
  costDefs: Record<string, { name: string; icon: string } | undefined> = {},
  /** Names for sale items the stripped manifest leaves out (cosmetics), by item hash. */
  itemDefs: Record<string, { name: string; icon: string; type: string } | undefined> = {},
): VendorStock[] {
  const out: VendorStock[] = [];
  const sellsGear = gearFilter(raw, defs);
  for (const [hash, v] of Object.entries(raw.vendors?.data ?? {})) {
    if (!v.enabled) continue;
    const saleItems = Object.values(raw.sales?.data?.[hash]?.saleItems ?? {});
    if (!saleItems.length) continue;
    const comps = raw.itemComponents?.[hash] ?? {};
    const sockets = comps.sockets?.data ?? {};
    const decoded: { weapons: WeaponRecord[]; armor: ArmorRecord[] } = !sellsGear(hash) ? { weapons: [], armor: [] } : decodeProfile(
      {
        profileInventory: { data: { items: saleItems.map((s) => ({ itemHash: s.itemHash, itemInstanceId: String(s.vendorItemIndex), bucketHash: 0, state: 0 })) } },
        itemComponents: comps,
      },
      m,
    );
    const costsOf = (s: RawSale) => (s.costs ?? []).map((c) => ({ itemHash: c.itemHash, name: costDefs[c.itemHash]?.name ?? "", icon: costDefs[c.itemHash]?.icon ?? "", quantity: c.quantity }));
    const offers: Offer[] = saleItems.flatMap((s) => {
      const d = itemDefs[s.itemHash];
      if (!d?.name || !isListedOffer(s, v.nextRefreshDate)) return [];
      const daily = !!s.overrideNextRefreshDate && s.overrideNextRefreshDate < (v.nextRefreshDate ?? "9");
      return [{ ...d, costs: costsOf(s), refreshes: s.overrideNextRefreshDate ?? v.nextRefreshDate ?? null, daily }];
    });
    if (!decoded.weapons.length && !decoded.armor.length && !offers.length) continue;
    const byIndex = new Map(saleItems.map((s) => [String(s.vendorItemIndex), s]));
    const sales: Record<string, SaleInfo> = {};
    const own = <T extends WeaponRecord | ArmorRecord>(r: T): T => {
      const s = byIndex.get(r.instanceId)!;
      const id = saleId(v.vendorHash, r.instanceId);
      sales[id] = {
        costs: costsOf(s),
        refreshes: s.overrideNextRefreshDate ?? null,
        rolled: !!sockets[r.instanceId]?.sockets?.length,
      };
      return { ...r, instanceId: id, locked: false, location: { where: "vendor", equipped: false } };
    };
    const def = defs[hash];
    out.push({
      vendorHash: v.vendorHash,
      name: def?.name || `Vendor ${hash}`,
      subtitle: def?.subtitle ?? "",
      icon: def?.icon ?? "",
      refreshes: v.nextRefreshDate && !v.nextRefreshDate.startsWith("9999") ? v.nextRefreshDate : null,
      weapons: decoded.weapons.map(own),
      armor: decoded.armor.map(own),
      sales,
      offers,
    });
  }
  return out.sort((a, b) => b.weapons.length - a.weapons.length || a.name.localeCompare(b.name));
}

/**
 * Manifest entities the stripped manifest leaves out (vendors, currencies, cosmetics), keyed "Type/hash".
 * Each is fetched once per manifest version and saved with only the fields the tab shows, so later visits
 * make no requests for them.
 */
type EntityDef = { displayProperties?: { name?: string; subtitle?: string; icon?: string; largeIcon?: string; smallTransparentIcon?: string }; itemTypeDisplayName?: string };
async function entities(version: string, keys: string[]): Promise<Record<string, EntityDef>> {
  const file = `${paths.manifestDir}/entities-${versionSlug(version)}.json`;
  const saved = { ...readJson<Record<string, EntityDef>>(file, {}) };
  const missing = [...new Set(keys)].filter((k) => !saved[k]);
  const got = await Promise.all(missing.map((k) => bungie<EntityDef>(`/Destiny2/Manifest/${k}/`, { auth: false }).catch(() => null)));
  missing.forEach((k, i) => {
    const d = got[i];
    // Failures aren't saved, so they're asked again next time.
    if (d) saved[k] = { displayProperties: d.displayProperties, itemTypeDisplayName: d.itemTypeDisplayName };
  });
  if (got.some(Boolean)) writeJson(file, saved);
  return saved;
}

/** Every vendor's current stock for one character (the most recently played by default). */
export async function fetchVendors(characterId: string): Promise<VendorStock[]> {
  const [m, who] = await Promise.all([loadManifest(), primaryMembership()]);
  const raw = await bungie<RawVendors>(
    `/Destiny2/${who.membershipType}/Profile/${who.membershipId}/Character/${characterId}/Vendors/?components=${VENDOR_COMPONENTS.join(",")}&filter=0`,
  );
  // Names only for vendors that sell gear, and only for the currencies their gear costs.
  const selling = Object.keys(raw.vendors?.data ?? {}).filter(
    (h) => Object.values(raw.sales?.data?.[h]?.saleItems ?? {}).some((s) => [2, 3].includes(m.items[s.itemHash]?.itemType) || isListedOffer(s, raw.vendors?.data?.[h]?.nextRefreshDate)),
  );
  const cosmetics = [
    ...new Set(
      Object.entries(raw.sales?.data ?? {}).flatMap(([h, v]) =>
        Object.values(v.saleItems).filter((s) => isListedOffer(s, raw.vendors?.data?.[h]?.nextRefreshDate)).map((s) => s.itemHash),
      ),
    ),
  ];
  const costHashes = [...new Set(selling.flatMap((h) => Object.values(raw.sales?.data?.[h]?.saleItems ?? {}).flatMap((s) => (s.costs ?? []).map((c) => c.itemHash))))];
  const vendorKey = (h: number | string) => `DestinyVendorDefinition/${h}`, itemKey = (h: number | string) => `DestinyInventoryItemDefinition/${h}`;
  const ent = await entities(m.version, [...selling.map(vendorKey), ...costHashes.map(itemKey), ...cosmetics.map(itemKey)]);
  const defs: Record<string, VendorDef> = {};
  for (const h of selling) {
    const dp = ent[vendorKey(h)]?.displayProperties;
    if (dp) defs[h] = { name: dp.name ?? "", subtitle: dp.subtitle ?? "", icon: bungieUrl(dp.smallTransparentIcon || dp.icon || dp.largeIcon) };
  }
  const costDefs: Record<string, { name: string; icon: string }> = {};
  for (const h of costHashes) {
    const dp = ent[itemKey(h)]?.displayProperties;
    if (dp) costDefs[h] = { name: dp.name ?? "", icon: bungieUrl(dp.icon) };
  }
  const itemDefs: Record<string, { name: string; icon: string; type: string }> = {};
  for (const h of cosmetics) {
    const d = ent[itemKey(h)];
    if (d?.displayProperties?.name) itemDefs[h] = { name: d.displayProperties.name, icon: bungieUrl(d.displayProperties.icon), type: d.itemTypeDisplayName ?? "" };
  }
  // GetVendors leaves out item components (no perks or stats), but the one-vendor call includes them:
  // ask each gear vendor on its own for its items' rolls.
  const sellsGear = gearFilter(raw, defs);
  const gear = selling.filter((h) => sellsGear(h) && Object.values(raw.sales?.data?.[h]?.saleItems ?? {}).some((s) => [2, 3].includes(m.items[s.itemHash]?.itemType)));
  const single = await Promise.all(
    gear.map((h) =>
      bungie<{ itemComponents?: RawProfile["itemComponents"] }>(
        `/Destiny2/${who.membershipType}/Profile/${who.membershipId}/Character/${characterId}/Vendors/${h}/?components=${ITEM_COMPONENTS.join(",")}`,
      ).catch(() => null),
    ),
  );
  raw.itemComponents ??= {};
  gear.forEach((h, i) => {
    const ic = single[i]?.itemComponents;
    if (ic && Object.keys(ic.sockets?.data ?? {}).length) raw.itemComponents![h] = ic;
  });
  return decodeVendors(raw, m, defs, costDefs, itemDefs);
}
