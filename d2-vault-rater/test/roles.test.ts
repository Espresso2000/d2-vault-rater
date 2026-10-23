import "./env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRolePerkMap, scoreRoles, rolesHeld, DEFAULT_ROLE_THRESHOLD } from "../src/rating/roles.js";
import { parseAegisExotics, parseAegisPerks } from "../src/sources/aegis.js";
import { parseBossSustained, parseBossSwap, bossLookup } from "../src/sources/bossDamage.js";
import type { WeaponRecord } from "../src/vault/types.js";

const weapon = (over: Partial<WeaponRecord> & { perks?: string[] }): WeaponRecord =>
  ({
    kind: "weapon", instanceId: "x", itemHash: 1, name: "Test", type: "Submachine Gun", frame: "", element: "Kinetic", slot: "Kinetic", ammo: "Primary", rarity: "Legendary",
    gearTier: null, power: null, locked: false, crafted: false, adept: false, masterwork: null, icon: "", screenshot: null, location: { where: "vault", equipped: false },
    columns: (over.perks ?? []).map((p) => ({ kind: "perk1" as const, active: p, options: [p], enhanced: [] })),
    ...over,
  }) as WeaponRecord;

const map = buildRolePerkMap([{ name: "Heal Clip", season: "", tags: ["utility"], trigger: "", effect: "", usage: "", tier: "S" }]);

test("an SMG with add clear perks holds add clear, not boss burst", () => {
  const { scores } = scoreRoles({ w: weapon({ perks: ["Killing Tally", "Destabilizing Rounds"] }), score: 80 }, map);
  assert.ok(scores["add-clear"] >= DEFAULT_ROLE_THRESHOLD);
  assert.ok(scores.burst < DEFAULT_ROLE_THRESHOLD);
  assert.equal(rolesHeld(scores)[0], "add-clear");
});

test("a weapon can hold several roles, and perk names match loosely", () => {
  const w = weapon({ type: "Hand Cannon", perks: ["KILLING TALLY", "Chain Reaction", "Armor Piercing Rounds"], champions: ["Barrier", "Overload"] });
  const held = rolesHeld(scoreRoles({ w, score: 90 }, map).scores);
  assert.ok(held.includes("champion") && held.includes("add-clear"));
});

test("support comes from support perks only; movement is a separate role", () => {
  const heal = scoreRoles({ w: weapon({ perks: ["Heal Clip", "Reciprocity"] }), score: 70 }, map).scores;
  assert.ok(heal.utility >= DEFAULT_ROLE_THRESHOLD && heal.movement < DEFAULT_ROLE_THRESHOLD);
  const move = scoreRoles({ w: weapon({ type: "Sword", perks: ["Eager Edge", "Perpetual Motion"] }), score: 70 }, map).scores;
  assert.ok(move.movement >= DEFAULT_ROLE_THRESHOLD && move.utility < DEFAULT_ROLE_THRESHOLD);
});

test("range stat splits long from close", () => {
  const sniper = scoreRoles({ w: weapon({ type: "Sniper Rifle", stats: { Range: 90 }, perks: ["Opening Shot"] }), score: 80 }, map).scores;
  assert.ok(sniper.long > sniper.close);
  const shotgun = scoreRoles({ w: weapon({ type: "Shotgun", stats: { Range: 20 }, perks: ["Full Choke"] }), score: 80 }, map).scores;
  assert.ok(shotgun.close > shotgun.long);
});

test("Aegis exotic tags and known exotic names count", () => {
  const roam = scoreRoles({ w: weapon({ type: "Hand Cannon", rarity: "Exotic" }), tags: ["roam", "dps"], score: 85 }, map).scores;
  assert.ok(roam["add-clear"] > scoreRoles({ w: weapon({ type: "Hand Cannon" }), score: 85 }, map).scores["add-clear"]);
  const ergo = scoreRoles({ w: weapon({ name: "Ergo Sum", type: "Sword", rarity: "Exotic" }), score: 90 }, map).scores;
  assert.ok(ergo.movement > 0.15 * 100);
});

test("Aegis Exotic tab keeps Tags and the Perks tab parses (picture column ignored)", () => {
  const ex = parseAegisExotics("Exotic Weapons", '"WEAPON #","Name","INFO Season","Type","Tags","Usage","Tier"\n"","Choir of One","24","special","roam\nDPS","good","A"\n')!;
  assert.deepEqual(ex[0].tags, ["roam", "dps"]);
  const perks = parseAegisPerks('"NAME 🖼️","Name","INFO Season","Tags","Trigger","Effect","Usage","#","Tier"\n"","Eager Edge","15","utility","sword ready","lunge","movement","1","S"\n')!;
  assert.equal(perks[0].name, "Eager Edge");
  assert.deepEqual(perks[0].tags, ["utility"]);
  assert.equal(perks[0].tier, "S");
});

// Boss Damage sheet: blank headers, columns by position, rows are builds.
const pad = (cells: string[], n: number) => [...cells, ...Array(n - cells.length).fill("")];
const sheet = (rows: string[][], n: number) => `${pad(["Name"], n).map((c) => `"${c}"`).join(",")}\n${rows.map((r) => pad(r, n).map((c) => `"${c}"`).join(",")).join("\n")}\n`;
const sustainedCsv = sheet(
  [
    ["Aggressive rocket launcher\nCluster Bomb + Honing", "power", "rocket", ...Array(16).fill(""), "17,960"],
    ["Leviathan's Breath\nsimulated", "power", "bow", ...Array(16).fill(""), "12,904"],
    ["Adaptive sword\nx", "power", "sword", ...Array(16).fill(""), "9,000"],
    ["Flux grenade", "grenade", "grenade", ...Array(16).fill(""), "5,000"],
  ],
  22,
);
const swapCsv = sheet(
  [
    ["Still Hunt\npre-popped", "burst", ...Array(14).fill(""), "49,241"],
    ["Golden Gun - Marksman", "super", ...Array(14).fill(""), "46,566"],
    ["Aggressive rocket launcher\nx", "swap", ...Array(14).fill(""), "20,000"],
    ["Precision hand cannon", "swap", ...Array(14).fill(""), "2,000"],
  ],
  18,
);

test("Boss Damage tabs keep weapon builds and read DPS by position", () => {
  const s = parseBossSustained(sustainedCsv);
  assert.deepEqual(s.map((r) => [r.name, r.dps]), [["Aggressive rocket launcher", 17960], ["Leviathan's Breath", 12904], ["Adaptive sword", 9000]]);
  assert.equal(s[0].notes, "Cluster Bomb + Honing");
  assert.deepEqual(parseBossSwap(swapCsv).map((r) => r.name), ["Still Hunt", "Aggressive rocket launcher", "Precision hand cannon"]);
});

test("Boss Damage ranks map to exotics by name and to archetypes by type and frame", () => {
  const look = bossLookup(parseBossSustained(sustainedCsv));
  assert.equal(look("Leviathan's Breath", "Combat Bow", "", true), 0.5);
  assert.equal(look("Some Rocket", "Rocket Launcher", "Aggressive Frame", false), 1);
  assert.equal(look("Other", "Rocket Launcher", "Rapid-Fire Frame", false)! > 0, true); // type's best frame, discounted
  assert.equal(look("Unlisted Exotic", "Rocket Launcher", "Aggressive Frame", true), null);
  assert.equal(look("Pulse", "Pulse Rifle", "Adaptive Frame", false), null);
});

test("with the sheet loaded, a top-ranked archetype outscores an unranked type for burst", () => {
  const boss = { importedAt: "", sustained: parseBossSustained(sustainedCsv), swap: parseBossSwap(swapCsv) };
  const m2 = buildRolePerkMap([], undefined, boss);
  const rocket = scoreRoles({ w: weapon({ type: "Rocket Launcher", frame: "Aggressive Frame" }), score: 80 }, m2).scores;
  const other = scoreRoles({ w: weapon({ type: "Rocket Launcher", frame: "Adaptive Frame" }), score: 80 }, m2).scores;
  assert.ok(rocket.burst >= other.burst);
  const still = scoreRoles({ w: weapon({ name: "Still Hunt", type: "Sniper Rifle", rarity: "Exotic" }), score: 90 }, m2).scores;
  assert.ok(still.precision > scoreRoles({ w: weapon({ type: "Pulse Rifle" }), score: 90 }, m2).scores.precision);
});
