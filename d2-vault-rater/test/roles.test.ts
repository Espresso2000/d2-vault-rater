import "./env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRolePerkMap, scoreRoles, rolesHeld, isMovementWeapon, DEFAULT_ROLE_THRESHOLD } from "../src/rating/roles.js";
import { parseAegisExotics, parseAegisPerks } from "../src/sources/aegis.js";
import { decodeProfile } from "../src/vault/decode.js";
import { manifest, profile } from "./fixtures/build.js";
import type { WeaponRecord } from "../src/vault/types.js";

const weapon = (over: Partial<WeaponRecord> & { perks?: string[] }): WeaponRecord =>
  ({
    kind: "weapon", instanceId: "x", itemHash: 1, name: "Test", type: "Submachine Gun", frame: "", element: "Kinetic", slot: "Kinetic", ammo: "Primary", rarity: "Legendary",
    gearTier: null, power: null, locked: false, crafted: false, adept: false, masterwork: null, icon: "", screenshot: null, location: { where: "vault", equipped: false },
    columns: (over.perks ?? []).map((p) => ({ kind: "perk1" as const, active: p, options: [p], enhanced: [] })),
    ...over,
  }) as WeaponRecord;

const map = buildRolePerkMap([{ name: "Heal Clip", season: "", tags: ["utility"], trigger: "", effect: "", usage: "", tier: "S" }]);

test("an SMG with area damage perks holds add clear, not majors", () => {
  const { scores } = scoreRoles({ w: weapon({ perks: ["Firefly", "Destabilizing Rounds"] }), score: 80 }, map);
  assert.ok(scores["add-clear"] >= DEFAULT_ROLE_THRESHOLD);
  assert.ok(scores.major < DEFAULT_ROLE_THRESHOLD);
  assert.equal(rolesHeld(scores)[0], "add-clear");
});

test("damage perks make majors, Rampage counts for both, perk names match loosely", () => {
  const rl = scoreRoles({ w: weapon({ type: "Rocket Launcher", perks: ["Cluster Bomb", "TARGET LOCK"] }), score: 85 }, map).scores;
  assert.ok(rl.major >= DEFAULT_ROLE_THRESHOLD);
  const smg = scoreRoles({ w: weapon({ perks: ["Rampage", "Kill Clip"] }), score: 85 }, map).scores;
  assert.ok(smg.major >= DEFAULT_ROLE_THRESHOLD && smg["add-clear"] >= DEFAULT_ROLE_THRESHOLD);
});

test("movement comes only from Aegis: exotic tag or a movement note", () => {
  const sword = weapon({ type: "Sword", perks: ["Eager Edge"] });
  assert.equal(scoreRoles({ w: sword, score: 70 }, map).scores.movement, 0);
  assert.ok(scoreRoles({ w: sword, notes: "also has Flash + Eager", score: 70 }, map).scores.movement === 0);
  assert.ok(scoreRoles({ w: sword, notes: "best movement and swap GL", score: 70 }, map).scores.movement >= DEFAULT_ROLE_THRESHOLD);
  assert.ok(scoreRoles({ w: sword, tags: ["movement"], score: 70 }, map).scores.movement >= DEFAULT_ROLE_THRESHOLD);
  assert.equal(isMovementWeapon([], "more viable non-movement perks"), false);
});

test("Aegis exotic tags count for add clear", () => {
  const roam = scoreRoles({ w: weapon({ type: "Hand Cannon", rarity: "Exotic" }), tags: ["roam", "dps"], score: 85 }, map).scores;
  assert.ok(roam["add-clear"] > scoreRoles({ w: weapon({ type: "Hand Cannon" }), score: 85 }, map).scores["add-clear"]);
});

test("Aegis Exotic tab keeps Tags and the Perks tab parses (picture column ignored)", () => {
  const ex = parseAegisExotics("Exotic Weapons", '"WEAPON #","Name","INFO Season","Type","Tags","Usage","Tier"\n"","Choir of One","24","special","roam\nDPS","good","A"\n')!;
  assert.deepEqual(ex[0].tags, ["roam", "dps"]);
  const perks = parseAegisPerks('"NAME 🖼️","Name","INFO Season","Tags","Trigger","Effect","Usage","#","Tier"\n"","Eager Edge","15","utility","sword ready","lunge","movement","1","S"\n')!;
  assert.equal(perks[0].name, "Eager Edge");
  assert.deepEqual(perks[0].tags, ["utility"]);
  assert.equal(perks[0].tier, "S");
});

test("champions come from the frame's hidden breaker perk only, not from leftover artifact perks", () => {
  const m = manifest();
  m.items[10] = { ...m.items[10], breakerType: 1 }; // the frame plug: Barrier
  m.items[9001] = { hash: 9001, displayProperties: { name: "Unstoppable Submachine Gun" }, itemType: 19 };
  const raw = profile([{ id: "u1", hash: 1001, plugs: [10, 20, 30, 41, 50, 60] }]) as Record<string, unknown>;
  // Stale data the live profile still returns: an "active" artifact perk for this weapon's type.
  raw.characterProgressions = { data: { c1: { seasonalArtifact: { tiers: [{ items: [{ itemHash: 9001, isActive: true }] }] } } } };
  const w = decodeProfile(raw as never, m).weapons[0];
  assert.equal(w.type, "Submachine Gun");
  assert.deepEqual(w.champions, ["Barrier"]);
});
