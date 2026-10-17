/**
 * Rates vendor stock the way the vault is rated, and says whether each piece is worth buying.
 * Each sale item is rated together with the vault, one at a time, so its verdict means "kept if it
 * joined your vault": it is compared with your own copies and archetype, never with other sale items.
 */
import { baseName, type Manifest } from "../bungie/manifest.js";
import type { AegisData } from "../sources/aegis.js";
import type { ArmorSetData } from "../sources/armorSets.js";
import type { WishlistData } from "../sources/wishlist.js";
import { rateArmor, type ArmorRating } from "../rating/armor.js";
import type { Settings } from "../rating/settings.js";
import { rateWeapons, type WeaponRating } from "../rating/weapons.js";
import type { Vault } from "../vault/types.js";
import type { Offer, SaleInfo, VendorStock } from "./vendors.js";

export type Buy = "buy" | "maybe" | "skip";

export interface RatedSale<R> {
  rating: R;
  sale: SaleInfo;
  buy: Buy;
  /** Your best copy of this weapon (by name), if you own one. */
  owned: { score: number; count: number } | null;
}

export interface RatedVendor {
  vendorHash: number;
  name: string;
  subtitle: string;
  icon: string;
  refreshes: string | null;
  weapons: RatedSale<WeaponRating>[];
  armor: RatedSale<ArmorRating>[];
  offers: Offer[];
}

/** Keep in the vault reads as buy; a backup or an unrated piece as maybe; anything the rater would shard as skip. */
const buyFor = (r: { verdict: string; label: string }): Buy =>
  r.verdict !== "keep" ? "skip" : r.label === "backup" || r.label === "unrated" ? "maybe" : "buy";

export function rateVendors(
  stock: VendorStock[],
  vault: Vault,
  sources: { aegis: AegisData | null; wishlists: WishlistData | null; manifest: Manifest | null; armorSets: ArmorSetData | null },
  settings: Settings,
): RatedVendor[] {
  const ownedBest = new Map<string, { score: number; count: number }>();
  for (const r of rateWeapons(vault.weapons, sources, settings).ratings) {
    const k = baseName(r.name);
    const o = ownedBest.get(k);
    ownedBest.set(k, { score: Math.max(o?.score ?? -1, r.score), count: (o?.count ?? 0) + 1 });
  }
  return stock.map((v) => ({
    vendorHash: v.vendorHash,
    name: v.name,
    subtitle: v.subtitle,
    icon: v.icon,
    refreshes: v.refreshes,
    weapons: v.weapons
      .map((w) => {
        const rating = rateWeapons([...vault.weapons, w], sources, settings).ratings.find((r) => r.instanceId === w.instanceId)!;
        const owned = ownedBest.get(baseName(w.name)) ?? null;
        const sale = v.sales[w.instanceId];
        if (owned && rating.score > owned.score) rating.reasons.unshift(`beats your best copy (${rating.score} vs ${owned.score})`);
        // A preview without rolled perks is scored on the weapon alone; its roll is a gamble until bought.
        if (!sale.rolled) rating.reasons.unshift("the roll is decided when you buy it, so only the weapon is rated");
        const buy = buyFor(rating);
        return { rating, sale, buy: !sale.rolled && buy === "buy" && w.rarity !== "Exotic" ? "maybe" : buy, owned } as RatedSale<WeaponRating>;
      })
      .sort((a, b) => b.rating.score - a.rating.score),
    armor: v.armor
      .map((a) => {
        const rating = rateArmor({ ...vault, armor: [...vault.armor, a] }, settings, sources.armorSets).ratings.find((r) => r.instanceId === a.instanceId)!;
        return { rating, sale: v.sales[a.instanceId], buy: buyFor(rating), owned: null };
      })
      .sort((a, b) => b.rating.score - a.rating.score),
    offers: v.offers,
  }));
}
