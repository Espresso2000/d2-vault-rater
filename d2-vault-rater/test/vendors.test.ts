import "./env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAegisTab, matchHashes, type AegisData } from "../src/sources/aegis.js";
import { decodeProfile } from "../src/vault/decode.js";
import { SettingsSchema } from "../src/rating/settings.js";
import { decodeVendors, isSaleId, type RawVendors } from "../src/vendors/vendors.js";
import { rateVendors } from "../src/vendors/rate.js";
import { manifest, profile } from "./fixtures/build.js";

const m = manifest();
const csv = readFileSync(new URL("./fixtures/aegis-smg.csv", import.meta.url), "utf8");
const weapons = parseAegisTab("SMGs", csv)!;
const aegis: AegisData = { importedAt: "", tabs: [{ name: "SMGs", gid: "1", rows: weapons.length }], weapons, unmatched: matchHashes(weapons, m), warnings: [] };

// frame, barrel, mag, perk1, perk2, origin (see rater.test.ts)
const GOD = [10, 20, 30, 41, 50, 60];
const MEH = [10, 21, 31, 42, 52, 60];
const ZAVALA = 69482069;

/** A GetVendors response built from fixture profile components: the same shapes, keyed by vendorItemIndex. */
function vendors(): RawVendors {
  const p = profile([
    { id: "5", hash: 1001, plugs: GOD, options: { 4: [41, 43] } },
    { id: "7", hash: 1004, plugs: MEH },
  ]);
  return {
    vendors: { data: { [ZAVALA]: { vendorHash: ZAVALA, enabled: true, canPurchase: true, nextRefreshDate: "2026-10-20T17:00:00Z" }, 1: { vendorHash: 1, enabled: true, canPurchase: true } } },
    sales: {
      data: {
        [ZAVALA]: {
          saleItems: {
            5: { vendorItemIndex: 5, itemHash: 1001, quantity: 1, costs: [{ itemHash: 3159615086, quantity: 50 }] },
            7: { vendorItemIndex: 7, itemHash: 1004, quantity: 1 },
            9: { vendorItemIndex: 9, itemHash: 70, quantity: 1 }, // a plug, not gear
            11: { vendorItemIndex: 11, itemHash: 1005, quantity: 1 }, // a preview with no rolled perks
          },
        },
        1: { saleItems: { 0: { vendorItemIndex: 0, itemHash: 70, quantity: 1 } } },
      },
    },
    itemComponents: { [ZAVALA]: p.itemComponents },
  };
}

test("vendor stock decodes like vault items, with sale ids, prices and only gear vendors", () => {
  const stock = decodeVendors(vendors(), m, { [ZAVALA]: { name: "Commander Zavala", subtitle: "Vanguard", icon: "" } }, { 3159615086: { name: "Glimmer", icon: "" } });
  assert.equal(stock.length, 1);
  const z = stock[0];
  assert.equal(z.name, "Commander Zavala");
  assert.equal(z.refreshes, "2026-10-20T17:00:00Z");
  assert.deepEqual(z.weapons.map((w) => w.name).sort(), ["Mystery SMG", "Plain Jane", "Unforgiven"]);
  const u = z.weapons.find((w) => w.name === "Unforgiven")!;
  assert.ok(isSaleId(u.instanceId));
  assert.equal(u.location.where, "vendor");
  assert.deepEqual(u.columns.find((c) => c.kind === "perk1")!.options, ["Attrition Orbs"]);
  assert.deepEqual(z.sales[u.instanceId].costs, [{ itemHash: 3159615086, name: "Glimmer", icon: "", quantity: 50 }]);
  assert.equal(z.sales[u.instanceId].rolled, true);
  assert.equal(z.sales[z.weapons.find((w) => w.name === "Mystery SMG")!.instanceId].rolled, false);
});

test("vendor weapons are rated against the vault: a god roll beats a meh copy you own", () => {
  const vault = decodeProfile(profile([{ id: "u2", hash: 1001, plugs: MEH }]), m);
  const stock = decodeVendors(vendors(), m, {});
  const settings = SettingsSchema.parse({});
  const [z] = rateVendors(stock, vault, { aegis, wishlists: null, manifest: m, armorSets: null }, settings);
  const u = z.weapons.find((s) => s.rating.name === "Unforgiven")!;
  assert.equal(u.owned?.count, 1);
  assert.ok(u.rating.score > u.owned!.score);
  assert.equal(u.buy, "buy");
  assert.match(u.rating.reasons[0], /beats your best copy/);
  // Best first.
  assert.deepEqual(z.weapons.map((s) => s.rating.score), [...z.weapons.map((s) => s.rating.score)].sort((a, b) => b - a));
});
