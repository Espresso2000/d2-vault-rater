import type { Manifest, ItemDef } from "../../src/bungie/manifest.js";
import type { RawProfile } from "../../src/vault/decode.js";
import { SOCKET_CATEGORY } from "../../src/vault/decode.js";

const KINETIC = 1498876634, ENERGY = 2465295065, POWER = 953998645, HELMET = 3448274439;

/** plug name -> hash, with categories */
const plugs: [number, string, string, string?][] = [
  [10, "Aggressive Frame", "intrinsics"],
  [11, "Lightweight Frame", "intrinsics"],
  [20, "Fluted Barrel", "barrels"],
  [21, "Smallbore", "barrels"],
  [30, "Alloy Magazine", "magazines"],
  [31, "Ricochet Rounds", "magazines"],
  [40, "Destabilizing Rounds", "frames"],
  [41, "Attrition Orbs", "frames"],
  [42, "Outlaw", "frames"],
  [43, "Attrition Orbs", "frames", "Enhanced Trait"],
  [50, "Repulsor Brace", "frames"],
  [51, "Kinetic Tremors", "frames"],
  [52, "Rampage", "frames"],
  [60, "Bitterspite", "origins"],
  [61, "Skulking Wolf", "origins"],
  [70, "Masterworked: Reload Speed", "v400.plugs.weapons.masterworks.stat.reload"],
  [80, "Gunner", "armor_archetypes"],
  [81, "Grenadier", "armor_archetypes"],
];

const weapon = (hash: number, name: string, bucket: number, dmg: number, tier = 5): ItemDef => ({
  hash,
  displayProperties: { name, icon: `/icons/${hash}.png` },
  screenshot: `/screens/${hash}.jpg`,
  itemType: 3,
  itemTypeDisplayName: "Submachine Gun",
  defaultDamageType: dmg,
  inventory: { bucketTypeHash: bucket, tierType: tier },
  equippingBlock: { ammoType: 1 },
  sockets: {
    socketEntries: Array.from({ length: 7 }, () => ({ socketTypeHash: 0, singleInitialItemHash: 0 })),
    socketCategories: [
      { socketCategoryHash: SOCKET_CATEGORY.intrinsic, socketIndexes: [0] },
      { socketCategoryHash: SOCKET_CATEGORY.weaponPerks, socketIndexes: [1, 2, 3, 4, 5] },
    ],
  },
});

export function manifest(): Manifest {
  const items: Record<string, ItemDef> = {};
  for (const [hash, name, pci, typeName] of plugs)
    items[hash] = { hash, displayProperties: { name }, itemType: 19, itemTypeDisplayName: typeName ?? "Trait", plug: { plugCategoryIdentifier: pci } };
  items[1001] = weapon(1001, "Unforgiven", ENERGY, 4);
  items[1002] = weapon(1002, "Multimach CCX", KINETIC, 1);
  items[1004] = weapon(1004, "Plain Jane", ENERGY, 4);
  items[1005] = weapon(1005, "Mystery SMG", POWER, 4);
  items[2001] = {
    hash: 2001,
    displayProperties: { name: "Test Helm", icon: "/icons/2001.png" },
    itemType: 2,
    classType: 1,
    inventory: { bucketTypeHash: HELMET, tierType: 5 },
    equippingBlock: { equipableItemSetHash: 900 },
  };
  return {
    version: "test",
    items,
    stats: {
      1: { hash: 1, displayProperties: { name: "Weapons" } },
      2: { hash: 2, displayProperties: { name: "Grenade" } },
      3: { hash: 3, displayProperties: { name: "Super" } },
      4: { hash: 4, displayProperties: { name: "Health" } },
    },
    itemSets: { 900: { hash: 900, displayProperties: { name: "Test Set" } } },
  };
}

type W = { id: string; hash: number; plugs: number[]; options?: Record<number, number[]>; state?: number; equipped?: boolean };

export function profile(weapons: W[], armor: { id: string; stats: Record<number, number>; archetype: number; tier: number; equipped?: boolean }[] = []): RawProfile {
  const vaultItems = weapons.filter((w) => !w.equipped);
  const equipped = weapons.filter((w) => w.equipped);
  const sockets: Record<string, { sockets: { plugHash?: number; isEnabled: boolean; isVisible: boolean }[] }> = {};
  const reusable: Record<string, { plugs: Record<string, { plugItemHash: number; canInsert: boolean; enabled: boolean }[]> }> = {};
  const instances: Record<string, { damageType?: number; gearTier?: number }> = {};
  for (const w of weapons) {
    sockets[w.id] = { sockets: [...w.plugs, 70].map((h) => ({ plugHash: h, isEnabled: true, isVisible: true })) };
    reusable[w.id] = {
      plugs: Object.fromEntries(Object.entries(w.options ?? {}).map(([i, hs]) => [i, hs.map((h) => ({ plugItemHash: h, canInsert: true, enabled: true }))])),
    };
    instances[w.id] = { gearTier: 3 };
  }
  const stats: Record<string, { stats: Record<string, { statHash: number; value: number }> }> = {};
  for (const a of armor) {
    sockets[a.id] = { sockets: [{ plugHash: a.archetype, isEnabled: true, isVisible: true }] };
    stats[a.id] = { stats: Object.fromEntries(Object.entries(a.stats).map(([h, v]) => [h, { statHash: Number(h), value: v }])) };
    instances[a.id] = { gearTier: a.tier };
  }
  return {
    profile: { data: { userInfo: { membershipId: "m1", membershipType: 3 } } },
    characters: { data: { c1: { classType: 1 } } },
    profileInventory: {
      data: {
        items: [
          ...vaultItems.map((w) => ({ itemHash: w.hash, itemInstanceId: w.id, bucketHash: 138197802, state: w.state ?? 0 })),
          ...armor.filter((a) => !a.equipped).map((a) => ({ itemHash: 2001, itemInstanceId: a.id, bucketHash: 138197802, state: 0 })),
        ],
      },
    },
    characterEquipment: {
      data: {
        c1: {
          items: [
            ...equipped.map((w) => ({ itemHash: w.hash, itemInstanceId: w.id, bucketHash: 0, state: w.state ?? 0 })),
            ...armor.filter((a) => a.equipped).map((a) => ({ itemHash: 2001, itemInstanceId: a.id, bucketHash: 0, state: 0 })),
          ],
        },
      },
    },
    itemComponents: { instances: { data: instances }, sockets: { data: sockets }, reusablePlugs: { data: reusable }, stats: { data: stats } },
  };
}
