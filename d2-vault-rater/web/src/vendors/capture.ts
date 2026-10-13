/**
 * Local runs only: saves what Bungie returns for vendors (every vendor, every sale item, with names) to
 * web/debug/ through the local server, so vendor support can be checked against real data. Runs once
 * per character per visit; a hosted copy has no local server and skips it.
 */
import { bungie, bungieUrl } from "../shims/client";
import { primaryMembership } from "../shims/oauth";
import { appConfig } from "../appConfig";
import { currentManifest } from "../shims/manifest";

const done = new Set<string>();
type Dp = { name?: string; subtitle?: string; icon?: string };
type Def = { displayProperties?: Dp; itemTypeDisplayName?: string; itemType?: number; inventory?: { tierTypeName?: string } };

export async function captureVendors(characterId: string): Promise<void> {
  if (!appConfig().tokenEndpoint || done.has(characterId)) return;
  done.add(characterId);
  try {
    const who = await primaryMembership();
    // 401 adds the vendors' display categories (how the game groups each vendor's offers).
    const raw = await bungie<{ vendors?: { data?: Record<string, unknown> }; sales?: { data?: Record<string, { saleItems: Record<string, { itemHash: number }> }> } }>(
      `/Destiny2/${who.membershipType}/Profile/${who.membershipId}/Character/${characterId}/Vendors/?components=400,401,402,300,305,310&filter=0`,
    );
    const m = currentManifest();
    const entity = (type: string, h: string | number) => bungie<Def>(`/Destiny2/Manifest/${type}/${h}/`, { auth: false }).catch(() => null);
    const vendorHashes = Object.keys(raw.vendors?.data ?? {});
    const vendors: Record<string, unknown> = {};
    await Promise.all(vendorHashes.map(async (h) => {
      const d = (await entity("DestinyVendorDefinition", h)) as (Def & { displayCategories?: { displayProperties?: Dp }[] }) | null;
      vendors[h] = { name: d?.displayProperties?.name, subtitle: d?.displayProperties?.subtitle, icon: bungieUrl(d?.displayProperties?.icon), categories: d?.displayCategories?.map((c) => c.displayProperties?.name) };
    }));
    const hashes = [...new Set(Object.values(raw.sales?.data ?? {}).flatMap((s) => Object.values(s.saleItems).map((i) => i.itemHash)))];
    const items: Record<string, unknown> = {};
    // Cosmetics (most of Eververse) are not in the app's stripped manifest: look those up one by one.
    await Promise.all(hashes.map(async (h) => {
      const d = (m?.items[h] as Def | undefined) ?? (await entity("DestinyInventoryItemDefinition", h));
      items[h] = d && { name: d.displayProperties?.name, type: d.itemTypeDisplayName, itemType: d.itemType, tier: d.inventory?.tierTypeName };
    }));
    // Probes: GetVendors came back without item components (no perks), so try the one-vendor call for
    // Banshee, Zavala and his weekly rewards; and read the weekly list's definitions for the Arsenal weapons.
    const single: Record<string, unknown> = {};
    for (const h of [672118013, 69482069, 153857624])
      single[h] = await bungie(`/Destiny2/${who.membershipType}/Profile/${who.membershipId}/Character/${characterId}/Vendors/${h}/?components=400,402,300,302,304,305,310`).catch((e) => String(e));
    const defs: Record<string, unknown> = {};
    for (const h of [1579969198, 1579969199, 1579969196, 40185715]) defs[h] = await entity("DestinyInventoryItemDefinition", h);
    // GetPublicVendors: the account-free view sites use for Xûr; does it list the locked Arsenal weapon?
    const pub = await bungie(`/Destiny2/Vendors/?components=400,402,300,305,310`, { auth: false }).catch((e) => String(e));
    const weekly = (await bungie<{ itemList?: { itemHash: number; displayCategoryIndex: number; categoryIndex: number }[] }>(`/Destiny2/Manifest/DestinyVendorDefinition/153857624/`, { auth: false }).catch(() => null)) as Record<string, unknown> | null;
    await fetch("debug/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capturedAt: new Date().toISOString(), characterId, vendors, items, raw, probe: { single, defs, weekly, pub } }),
    });
  } catch (e) {
    console.warn("Vendor capture failed", e);
  }
}
