import "./env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRatedTab, parseSubclassTab, parseInfoTab, elementFromSupers, norm } from "../web/src/builds/sheets.js";
import { stripBuildDefs, type BuildDefs } from "../web/src/builds/defs.strip.js";
import { buildScore, fragmentSlots, fromDimLoadout, newBuild, placeMod, statLines, toDimLoadout, trimFragments, defaultPlugs, type Ctx } from "../web/src/builds/model.js";
import { planEquip } from "../web/src/builds/equip.js";
import type { BuildProfile } from "../web/src/builds/profile.js";
import type { Vault } from "../src/vault/types.js";

const ASPECTS = `"INFO","Name","Subclass","Class","Fragments","Trigger","Effect","ANALYSIS Usage","#","Tier","KEY ",""
"","Controlled Demolition","Void","T","2","void damage","volatile on hit","great","1","S","S","outlier"
"","Bastion","Void","T","1","class","overshield","ok","9","B","A",""`;
const FRAGMENTS = `"INFO","Name","Subclass","Tags","Trigger","Effect","Stats","ANALYSIS Usage","#","Tier","KEY ",""
"","Echo of Starvation","Void","survivability","orb pickup","Devour","-10 Class","free heal","2","S","",""
"","Echo of Leeching","Void","regen","reload","heal","+10 Health","meh","40","C","",""`;
const SUBCLASSES = `"x","INFO Class","Aspects","","","","","DAMAGE Super","#","Enhancement","","ROAM Offense","","Defense","#","ANALYSIS Usage","","Tier"
"","T","","","","","","Twilight Arsenal | Sentinel Shield w/ Synthoceps","2","Ward of Dawn","7","defensive","0","overshield","9","very survivable","18","C"
"","H","","","","","","Golden Gun w/ Nighthawk + Silkstrike w/ Star-Eater","10","x","6","y","6","z","9","best","31","S"`;

test("Aegis build sheets: aspects, fragments and subclasses parse; the element comes from the supers named", () => {
  const a = parseRatedTab(ASPECTS);
  assert.equal(a[norm("Controlled Demolition")].tier, "S");
  assert.equal(a[norm("Controlled Demolition")].extra, "2");
  assert.equal(a[norm("Bastion")].rank, 9);
  assert.equal(parseRatedTab(FRAGMENTS)[norm("Echo of Starvation")].extra, "-10 Class");
  const s = parseSubclassTab(SUBCLASSES);
  assert.deepEqual(s.map((x) => [x.cls, x.element, x.tier, x.total]), [["Titan", "Void", "C", 18], ["Hunter", "Prismatic", "S", 31]]);
  assert.deepEqual(s[0].scores, { super: 2, enhancement: 7, offense: 0, defense: 9 });
  assert.equal(elementFromSupers("Winter's Wrath w/ Ballidorse"), "Stasis");
});

test("Data Compendium: short name cell followed by a long description", () => {
  const info = parseInfoTab(`"","Ammo Finder\n[3 Energy]","","Special Ammo Finders: 1.25x progress per kill and more text here",""\n"","Glossary","","",""`);
  assert.match(info[norm("Ammo Finder")], /^Special Ammo/);
  assert.equal(info[norm("Glossary")], undefined);
});

/* A tiny manifest: one Void Titan subclass and two armor mod plug sets. */
const items: Record<number, object> = {
  500: { hash: 500, itemType: 16, classType: 0, displayProperties: { name: "Sentinel", icon: "/s.png" }, talentGrid: { hudDamageType: 4 },
    sockets: { socketEntries: [
      { singleInitialItemHash: 10, reusablePlugSetHash: 1 }, // super
      { singleInitialItemHash: 20, reusablePlugSetHash: 2 }, // aspect
      { singleInitialItemHash: 20, reusablePlugSetHash: 2 }, // aspect
      { singleInitialItemHash: 30, reusablePlugSetHash: 3 }, // fragment x3
      { singleInitialItemHash: 30, reusablePlugSetHash: 3 },
      { singleInitialItemHash: 30, reusablePlugSetHash: 3 },
    ] } },
  10: { hash: 10, displayProperties: { name: "Sentinel Shield" }, plug: { plugCategoryIdentifier: "titan.void.supers" } },
  11: { hash: 11, displayProperties: { name: "Twilight Arsenal" }, plug: { plugCategoryIdentifier: "titan.void.supers" } },
  20: { hash: 20, displayProperties: { name: "Empty Aspect Socket" }, plug: { plugCategoryIdentifier: "titan.void.aspects" } },
  21: { hash: 21, displayProperties: { name: "Controlled Demolition" }, plug: { plugCategoryIdentifier: "titan.void.aspects", energyCapacity: { capacityValue: 2 } } },
  22: { hash: 22, displayProperties: { name: "Bastion" }, plug: { plugCategoryIdentifier: "titan.void.aspects", energyCapacity: { capacityValue: 1 } } },
  30: { hash: 30, displayProperties: { name: "Empty Fragment Socket" }, plug: { plugCategoryIdentifier: "shared.void.fragments" } },
  31: { hash: 31, displayProperties: { name: "Echo of Starvation" }, plug: { plugCategoryIdentifier: "shared.void.fragments", energyCost: { energyCost: 1 } }, investmentStats: [{ statTypeHash: 1943323491, value: -10 }] },
  32: { hash: 32, displayProperties: { name: "Echo of Leeching" }, plug: { plugCategoryIdentifier: "shared.void.fragments", energyCost: { energyCost: 1 } }, investmentStats: [{ statTypeHash: 392767087, value: 10 }] },
  40: { hash: 40, displayProperties: { name: "Empty Mod Socket" }, plug: { plugCategoryIdentifier: "enhancements.v2_general" } },
  41: { hash: 41, displayProperties: { name: "Health Mod" }, plug: { plugCategoryIdentifier: "enhancements.v2_general", energyCost: { energyCost: 3 } }, investmentStats: [{ statTypeHash: 392767087, value: 10 }] },
  42: { hash: 42, displayProperties: { name: "Health Mod" }, plug: { plugCategoryIdentifier: "enhancements.v2_general", energyCost: { energyCost: 1 } }, investmentStats: [{ statTypeHash: 392767087, value: 10 }] },
  50: { hash: 50, displayProperties: { name: "Empty Mod Socket" }, plug: { plugCategoryIdentifier: "enhancements.v2_head" } },
  51: { hash: 51, displayProperties: { name: "Heavy Ammo Finder" }, plug: { plugCategoryIdentifier: "enhancements.v2_head", energyCost: { energyCost: 3 } } },
};
const sets = {
  1: { reusablePlugItems: [{ plugItemHash: 10 }, { plugItemHash: 11 }] },
  2: { reusablePlugItems: [{ plugItemHash: 20 }, { plugItemHash: 21 }, { plugItemHash: 22 }] },
  3: { reusablePlugItems: [{ plugItemHash: 30 }, { plugItemHash: 31 }, { plugItemHash: 32 }] },
  4: { reusablePlugItems: [{ plugItemHash: 40 }, { plugItemHash: 41 }, { plugItemHash: 42 }] },
  5: { reusablePlugItems: [{ plugItemHash: 50 }, { plugItemHash: 51 }] },
};
const defs: BuildDefs = stripBuildDefs("v1", items, sets, {});

const vault: Vault = {
  fetchedAt: "", membershipId: "m", membershipType: 3,
  characters: [{ id: "c1", className: "Titan" }],
  weapons: [{ kind: "weapon", instanceId: "w1", itemHash: 900, name: "Gun", type: "Auto Rifle", frame: "", element: "Kinetic", slot: "Kinetic", ammo: "Primary", rarity: "Legendary", gearTier: null, power: null, locked: false, crafted: false, adept: false, columns: [], masterwork: null, icon: "", screenshot: null, location: { where: "vault", equipped: false } }],
  armor: [{ kind: "armor", instanceId: "h1", itemHash: 901, name: "Helm", classType: "Titan", slot: "Helmet", rarity: "Exotic", gearTier: 5, stats: { Health: 30, Class: 20 }, statTotal: 50, archetype: "Bulwark", setName: null, legacy: false, locked: false, icon: "", location: { where: "c1", equipped: true } }],
};
const ctx = (): Ctx => ({
  defs,
  ratings: { importedAt: "", aspects: parseRatedTab(ASPECTS), fragments: parseRatedTab(FRAGMENTS), subclasses: parseSubclassTab(SUBCLASSES), info: {}, warnings: [] },
  vault,
  scores: new Map([["w1", 80], ["h1", 90]]),
  statNames: { 2996146975: "Weapons", 392767087: "Health", 1943323491: "Class", 1735777505: "Grenade", 144602215: "Super", 4244567218: "Melee" },
  // The helmet has a Health Mod in it now; its 30 Health includes that mod's +10.
  sockets: new Map([["h1", [41, 50, 50, 50]], ["sub", [10, 20, 20, 30, 30, 30]]]),
});

test("build defs: subclass sockets grouped, element from the damage type, mod copies deduped to the full-cost one", () => {
  const sc = defs.subclasses[500];
  assert.equal(sc.el, "Void");
  assert.deepEqual(sc.sockets.map((s) => s.group), ["super", "aspects", "aspects", "fragments", "fragments", "fragments"]);
  assert.equal(defs.plugs[21].cap, 2);
  assert.deepEqual(defs.plugs[31].st, [[1943323491, -10]]);
  assert.deepEqual(defs.mods["enhancements.v2_general"].sort(), [40, 41]);
  assert.ok(defs.plugs[42], "the reduced-cost copy is still known");
});

test("builds: fragment slots follow the aspects, stats swap old mods for new, score weighs the parts", () => {
  const b = newBuild(0);
  b.subclass = 500;
  b.plugs = defaultPlugs(defs.subclasses[500]);
  b.plugs[1] = 21; // Controlled Demolition: 2 slots
  b.plugs[3] = 31;
  b.plugs[4] = 32;
  b.plugs[5] = 31;
  assert.equal(fragmentSlots(b, defs), 2);
  trimFragments(b, defs);
  assert.equal(b.plugs[5], 30, "third fragment dropped");
  b.items.Helmet = { id: "h1", hash: 901 };
  b.items.Kinetic = { id: "w1", hash: 900 };
  b.mods.Helmet = [0, 51, 0, 0];
  const s = Object.fromEntries(statLines(b, ctx()).map((l) => [l.name, l]));
  assert.equal(s.Health.armor, 20, "the Health Mod already in the helmet is taken out");
  assert.equal(s.Health.fragments, 10);
  assert.equal(s.Class.total, 10);
  const score = buildScore(b, ctx());
  // Subclass C 50·25, aspects (S 100 + empty 0)/2·30, fragments (S 100 + C 50)/2 slots·20, weapons 80·15, armor 90·10
  assert.equal(score.total, Math.round((50 * 25 + 50 * 30 + 75 * 20 + 80 * 15 + 90 * 10) / 100));
});

test("builds: mods fit their socket and the 10 energy budget", () => {
  const b = newBuild(0);
  assert.equal(placeMod(b, 51, defs), true);
  assert.deepEqual(b.mods.Helmet, [0, 51, 0, 0]);
  assert.equal(placeMod(b, 41, defs), true);
  assert.equal(b.mods.Helmet![0], 41);
  for (let i = 0; i < 3; i++) placeMod(b, 51, defs);
  assert.deepEqual(b.mods.Helmet, [41, 51, 51, 0], "a third 3-cost mod would exceed 10 energy");
});

test("builds: DIM loadout round trip keeps items, subclass plugs, mods and stat targets", () => {
  const b = newBuild(0, "Void tank");
  b.subclass = 500;
  b.plugs = { ...defaultPlugs(defs.subclasses[500]), 0: 11, 1: 21, 3: 31 };
  b.items.Helmet = { id: "h1", hash: 901 };
  b.items.Kinetic = { id: "w1", hash: 900 };
  b.mods.Helmet = [41, 51, 0, 0];
  b.targets[392767087] = 100;
  const l = toDimLoadout(b, ctx(), "sub");
  assert.deepEqual(l.equipped.find((e) => e.hash === 500)?.socketOverrides, { 0: 11, 1: 21, 3: 31 });
  assert.equal(l.parameters?.exoticArmorHash, 901);
  assert.deepEqual(l.parameters?.mods, [41, 51]);
  const back = fromDimLoadout(l, ctx());
  assert.equal(back.name, "Void tank");
  assert.deepEqual(back.items, b.items);
  assert.equal(back.plugs[0], 11);
  assert.equal(back.plugs[1], 21);
  assert.deepEqual(back.mods.Helmet, [41, 51, 0, 0]);
  assert.equal(back.targets[392767087], 100);
});

test("equip dry run: pulls from the vault, switches only changed plugs, clears before re-slotting, swaps mods", () => {
  const b = newBuild(0);
  b.subclass = 500;
  b.plugs = { ...defaultPlugs(defs.subclasses[500]), 0: 11, 1: 22, 2: 21, 3: 31 };
  b.items.Kinetic = { id: "w1", hash: 900 };
  b.items.Helmet = { id: "h1", hash: 901 };
  b.mods.Helmet = [0, 51, 0, 0];
  const p: BuildProfile = {
    membershipType: 3,
    fetchedAt: 0,
    chars: [{ id: "c1", cls: 0, light: 2000, equipped: new Set(["h1", "sub"]), subclasses: [{ id: "sub", hash: 500, equipped: true }], loadouts: [{ colorHash: 1, iconHash: 2, nameHash: 3, empty: true }] }],
    // Controlled Demolition sits in aspect slot 1 now but the build wants it in slot 2.
    sockets: new Map([["h1", [41, 50, 50, 50]], ["sub", [10, 21, 20, 30, 30, 30]]]),
    unlocked: new Map(),
  };
  const plan = planEquip(b, ctx(), p, { loadoutSlot: 0 });
  const texts = plan.steps.map((s) => s.text);
  assert.ok(texts.some((t) => /Kinetic: pull and equip Gun \(from vault\)/.test(t)));
  assert.ok(!texts.some((t) => /Helmet: .*equip/.test(t)), "the helmet is already equipped");
  assert.equal(texts.indexOf("Clear aspect slot 1") >= 0, true);
  assert.ok(texts.indexOf("Clear aspect slot 1") < texts.findIndex((t) => t.startsWith("Aspects:")));
  assert.ok(texts.includes("Super: Sentinel Shield → Twilight Arsenal"));
  assert.ok(texts.includes("Helmet: remove Health Mod") && texts.includes("Helmet: insert Heavy Ammo Finder"));
  assert.ok(texts.some((t) => /in-game loadout 1/.test(t)));
  assert.equal(plan.noop, false);
});

test("equip dry run: a weapon equipped on another character gets a stand-in equipped there first", () => {
  const w2 = { ...vault.weapons[0], instanceId: "w2", name: "Spare", location: { where: "vault", equipped: false } };
  const v: Vault = { ...vault, characters: [...vault.characters, { id: "c2", className: "Hunter" }], weapons: [{ ...vault.weapons[0], location: { where: "c2", equipped: true } }, w2] };
  const b = newBuild(0);
  b.items.Kinetic = { id: "w1", hash: 900 };
  const p: BuildProfile = {
    membershipType: 3,
    fetchedAt: 0,
    chars: [
      { id: "c1", cls: 0, light: 1, equipped: new Set(), subclasses: [], loadouts: [] },
      { id: "c2", cls: 1, light: 1, equipped: new Set(["w1"]), subclasses: [], loadouts: [] },
    ],
    sockets: new Map(),
    unlocked: new Map(),
  };
  const texts = planEquip(b, { ...ctx(), vault: v }, p).steps.map((s) => s.text);
  const stand = texts.findIndex((t) => t === "Hunter: equip Spare in its place, so Gun can move");
  assert.ok(stand >= 0, texts.join("\n"));
  assert.ok(stand < texts.findIndex((t) => t.startsWith("Moves and equips")));
});
