import "./env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv } from "../src/sources/csv.js";
import { parseAegisTab, parseAegisExotics, parseTabList, matchHashes, type AegisData } from "../src/sources/aegis.js";
import { parseWishlist } from "../src/sources/wishlist.js";
import { decodeProfile } from "../src/vault/decode.js";
import { moveItems } from "../src/bungie/transfer.js";
import { rateWeapons } from "../src/rating/weapons.js";
import { rateArmor } from "../src/rating/armor.js";
import { SettingsSchema, strictnessFor } from "../src/rating/settings.js";
import { planDimActions, planToCsv, applyDimActions, undoDimActions } from "../src/dim/actions.js";
import { buildMarkdown } from "../src/report/report.js";
import { manifest, profile } from "./fixtures/build.js";

const csv = readFileSync(new URL("./fixtures/aegis-smg.csv", import.meta.url), "utf8");
const m = manifest();

function aegis(): AegisData {
  const weapons = parseAegisTab("SMGs", csv)!;
  const unmatched = matchHashes(weapons, m);
  return { importedAt: "", tabs: [{ name: "SMGs", gid: "1", rows: weapons.length }], weapons, unmatched, warnings: [] };
}

// frame, barrel, mag, perk1, perk2, origin
const GOD_UNFORGIVEN = [10, 20, 30, 41, 50, 60];
const MEH_UNFORGIVEN = [10, 21, 31, 42, 52, 60];

function vault() {
  return decodeProfile(
    profile(
      [
        { id: "u1", hash: 1001, plugs: GOD_UNFORGIVEN, state: 1 },
        { id: "u2", hash: 1001, plugs: MEH_UNFORGIVEN, state: 1 },
        { id: "mm", hash: 1002, plugs: [11, 20, 30, 41, 51, 61] },
        { id: "pj", hash: 1004, plugs: [10, 21, 31, 42, 52, 60], state: 1 },
        { id: "eq", hash: 1004, plugs: [10, 21, 31, 42, 52, 60], equipped: true, state: 1 },
        { id: "my", hash: 1005, plugs: [10, 21, 31, 42, 52, 60] },
      ],
      [
        { id: "h1", stats: { 1: 30, 2: 25, 3: 20, 4: 5 }, archetype: 80, tier: 5 },
        { id: "h2", stats: { 1: 20, 2: 20, 3: 15, 4: 5 }, archetype: 80, tier: 1, },
        { id: "h3", stats: { 2: 30, 3: 25, 1: 20 }, archetype: 81, tier: 4, equipped: true },
      ],
    ),
    m,
  );
}

test("CSV parser keeps newlines inside quoted cells", () => {
  const rows = parseCsv('"a","b\nc","d""e"\n1,2,3\n');
  assert.deepEqual(rows, [["a", "b\nc", 'd"e'], ["1", "2", "3"]]);
});

test("Aegis tab parses tiers, ranks and multi-line perk cells", () => {
  const rows = parseAegisTab("SMGs", csv)!;
  assert.equal(rows.length, 5);
  const u = rows[0];
  assert.equal(u.name, "Unforgiven");
  assert.equal(u.tier, "S");
  assert.equal(u.rank, 1);
  assert.equal(u.element, "Void");
  assert.deepEqual(u.recommended.perk1, ["Destabilizing Rounds", "Attrition Orbs"]);
  assert.deepEqual(u.recommended.barrel, ["Fluted Barrel", "Arrowhead Brake"]);
  assert.deepEqual(u.recommended.masterwork, ["Reload"]);
  assert.match(u.notes, /double stagger/);
  assert.equal(parseAegisTab("DPS", '"Ammo","Weapon","DPS"\n"x","y","1"'), null);
});

test("tab list is read from the htmlview page", () => {
  const html = `items.push({name: "SMGs", pageUrl: "x", gid: "1405969509",initialSheet: false}); <li id="sheet-button-0"><a href="#">Overview</a></li>`;
  assert.deepEqual(parseTabList(html), [
    { gid: "1405969509", name: "SMGs" },
    { gid: "0", name: "Overview" },
  ]);
});

test("names compare without accents: Jötunn and Jotunn are the same weapon", async () => {
  const { normalizeName } = await import("../src/bungie/manifest.js");
  assert.equal(normalizeName("Jötunn"), "jotunn");
  assert.equal(normalizeName("Jötunn"), normalizeName("Jotunn"));
});

test("Aegis names map to manifest hashes", () => {
  const a = aegis();
  assert.deepEqual(a.weapons.find((w) => w.name === "Unforgiven")!.hashes, [1001]);
  assert.ok(a.unmatched.some((u) => u.startsWith("The Recluse")));
});

test("wishlist lines parse, including trash rolls and notes", () => {
  const rolls = parseWishlist("//notes:pve pick\ndimwishlist:item=1001&perks=41,50\ndimwishlist:item=-1004&perks=42#notes:bad");
  assert.deepEqual(rolls[0], { itemHash: 1001, perks: [41, 50], trash: false, notes: "pve pick" });
  assert.deepEqual(rolls[1], { itemHash: 1004, perks: [42], trash: true, notes: "bad" });
});

test("profile decodes into weapon columns and armor stats", () => {
  const v = vault();
  const u = v.weapons.find((w) => w.instanceId === "u1")!;
  assert.equal(u.frame, "Aggressive Frame");
  assert.equal(u.element, "Void");
  assert.equal(u.slot, "Energy");
  assert.equal(u.locked, true);
  assert.equal(u.masterwork, "Reload Speed");
  assert.deepEqual(u.columns.map((c) => [c.kind, c.active]), [
    ["barrel", "Fluted Barrel"],
    ["magazine", "Alloy Magazine"],
    ["perk1", "Attrition Orbs"],
    ["perk2", "Repulsor Brace"],
    ["origin", "Bitterspite"],
  ]);
  const h = v.armor.find((a) => a.instanceId === "h1")!;
  assert.equal(h.archetype, "Gunner");
  assert.equal(h.setName, "Test Set");
  assert.equal(h.statTotal, 80);
  assert.equal(v.weapons.find((w) => w.instanceId === "eq")!.location.equipped, true);
});

test("weapon rating: god roll scores high, duplicate and D tier get sharded at balanced", () => {
  const r = rateWeapons(vault().weapons, { aegis: aegis(), wishlists: null, manifest: m }, SettingsSchema.parse({}));
  const by = (id: string) => r.ratings.find((x) => x.instanceId === id)!;
  assert.equal(by("u1").rollScore, 100);
  assert.ok(by("u1").score >= 95, `god roll scored ${by("u1").score}`);
  assert.equal(by("u1").verdict, "keep");
  assert.equal(by("u2").verdict, "shard");
  assert.equal(by("u2").category, "duplicate");
  assert.equal(by("pj").category, "duplicate", "the equipped Plain Jane is kept instead");
  assert.equal(by("eq").label, "protected");
  assert.equal(by("my").label, "protected", "only Power Void weapon stays");
  assert.deepEqual(r.duplicates.find((d) => d.name === "Unforgiven"), { name: "Unforgiven", keep: "u1", shard: ["u2"] });
  assert.equal(r.duplicates.find((d) => d.name === "Plain Jane")?.keep, "eq", "the equipped copy is the keeper");
  assert.ok(r.gaps.some((g) => g.name === "The Recluse"));
});

test("strictness presets and per type overrides change the outcome", () => {
  const settings = SettingsSchema.parse({ preset: "lenient", overrides: { minTierKept: "D" } });
  assert.equal(strictnessFor(settings).copiesPerArchetype, 3);
  assert.equal(strictnessFor(settings).minTierKept, "D");
  const small = decodeProfile(
    profile([
      { id: "u1", hash: 1001, plugs: GOD_UNFORGIVEN },
      { id: "pj", hash: 1004, plugs: [10, 21, 31, 42, 52, 60] },
    ]),
    m,
  ).weapons;
  const src = { aegis: aegis(), wishlists: null, manifest: m };
  assert.equal(rateWeapons(small, src, SettingsSchema.parse({})).ratings.find((x) => x.instanceId === "pj")!.category, "d-tier");
  const lenient = rateWeapons(small, { aegis: aegis(), wishlists: null, manifest: m }, settings);
  // With a D floor the weak roll is no longer cut for its tier, only for being far behind Unforgiven.
  assert.equal(lenient.ratings.find((x) => x.instanceId === "pj")!.category, "outscored");
  const typed = SettingsSchema.parse({ preset: "lenient", byWeaponType: { "Submachine Gun": { preset: "ruthless" } } });
  assert.equal(strictnessFor(typed, "Submachine Gun").copiesPerArchetype, 1);
  assert.equal(strictnessFor(typed, "Hand Cannon").copiesPerArchetype, 3);
});

test("enhanced perks earn a small bonus", () => {
  const v = decodeProfile(profile([{ id: "x", hash: 1002, plugs: [11, 21, 31, 43, 52, 61] }]), m);
  const r = rateWeapons(v.weapons, { aegis: aegis(), wishlists: null, manifest: m }, SettingsSchema.parse({}));
  // perk1 matched and enhanced (35 * 1.1), perk2 miss, barrel/mag miss, origin hit, MW hit
  assert.equal(r.ratings[0].rollScore, Math.round(35 * 1.1 + 5 + 5));
});

test("weapon details: live stats, base stats for the ones left out, intrinsic frame and masterwork", () => {
  const mm = manifest();
  mm.stats[5] = { hash: 5, displayProperties: { name: "Range" } };
  mm.stats[6] = { hash: 6, displayProperties: { name: "Aim Assistance" } };
  mm.items[1002] = { ...mm.items[1002], stats: { stats: { 5: { statHash: 5, value: 30 }, 6: { statHash: 6, value: 61 } } } };
  const raw = profile([{ id: "x", hash: 1002, plugs: [11, 21, 31, 43, 52, 61] }]);
  raw.itemComponents!.stats!.data!.x = { stats: { 5: { statHash: 5, value: 48 } } };
  const w = decodeProfile(raw, mm).weapons[0];
  assert.deepEqual(w.stats, { Range: 48, "Aim Assistance": 61 }, "the live Range wins over the base one");
  assert.deepEqual(w.baseStats, ["Aim Assistance"]);
  assert.equal(w.intrinsic?.name, "Lightweight Frame");
  assert.deepEqual(w.mods?.map((x) => [x.kind, x.name]), [["masterwork", "Masterworked: Reload Speed"]]);
});

test("weapon mod socket: the unlocked mods that fit, and the request that switches to one", async () => {
  const mm = manifest();
  const mod = (hash: number, name: string, pci: string) => (mm.items[hash] = { hash, displayProperties: { name, icon: `/icons/${hash}.png`, description: `${name} text` }, itemType: 19, plug: { plugCategoryIdentifier: pci } });
  mod(90, "Empty Mod Socket", "v400.weapon.mod_empty");
  mod(91, "Backup Mag", "v400.weapon.mod_magazine");
  mod(92, "Counterbalance Stock", "v400.weapon.mod_guns");
  mod(93, "Freehand Grip", "v400.weapon.mod_guns");
  mod(94, "Some Shader", "shader");
  const entries = Array.from({ length: 8 }, () => ({}) as { reusablePlugSetHash?: number });
  entries[7] = { reusablePlugSetHash: 500 };
  mm.items[1002] = { ...mm.items[1002], sockets: { ...mm.items[1002].sockets!, socketEntries: entries } };
  const raw = profile([{ id: "x", hash: 1002, plugs: [11, 21, 31, 43, 52, 61] }]);
  raw.itemComponents!.sockets!.data!.x.sockets.push({ plugHash: 91, isEnabled: true, isVisible: true });
  const plug = (h: number, canInsert = true) => ({ plugItemHash: h, canInsert, enabled: true });
  raw.profilePlugSets = { data: { plugs: { 500: [plug(90), plug(91), plug(92), plug(93, false), plug(94)] } } };
  raw.characterPlugSets = { data: { c1: { plugs: { 500: [plug(92)] } } } };
  const v = decodeProfile(raw, mm);
  const slot = v.weapons[0].mods!.find((x) => x.kind === "mod")!;
  assert.equal(slot.name, "Backup Mag");
  assert.equal(slot.socket, 7);
  assert.deepEqual(slot.options?.map((o) => o.name), ["Empty Mod Socket", "Backup Mag", "Counterbalance Stock"], "locked mods, other plugs and repeats are left out");

  const { modInsertBody, insertMod } = await import("../src/bungie/transfer.js");
  assert.deepEqual(modInsertBody(v, "x", 7, "Counterbalance Stock").body, { plug: { socketIndex: 7, socketArrayType: 0, plugItemHash: 92 }, itemId: "x", characterId: "c1", membershipType: 3 });
  assert.throws(() => modInsertBody(v, "x", 7, "Freehand Grip"), /isn't a mod you can put on/);
  const sent: unknown[] = [];
  await insertMod("x", 7, "Counterbalance Stock", { vault: v, send: async (_p, b) => void sent.push(b) });
  assert.equal(sent.length, 1);
  assert.equal(slot.name, "Counterbalance Stock", "the vault copy now has the new mod");
});

test("armor rating keeps the Tier 5 piece and shards the weaker copy at strict", () => {
  const a = rateArmor(vault(), SettingsSchema.parse({ preset: "strict" }));
  const by = (id: string) => a.ratings.find((x) => x.instanceId === id)!;
  assert.equal(by("h1").verdict, "keep");
  assert.equal(by("h2").verdict, "shard");
  assert.equal(by("h3").label, "protected");
  assert.deepEqual(a.buildStats.Hunter, ["Grenade", "Super"]);
});

test("DIM plan, CSV, apply and undo; protected items are never unlocked", async () => {
  const v = vault();
  const settings = SettingsSchema.parse({ preset: "ruthless" });
  const w = rateWeapons(v.weapons, { aegis: aegis(), wishlists: null, manifest: m }, settings);
  const a = rateArmor(v, settings);
  const plan = planDimActions(v, w, a, settings);
  const item = (id: string) => plan.items.find((i) => i.instanceId === id)!;
  assert.equal(item("u2").lock, false);
  assert.equal(item("u2").tag, "junk");
  assert.equal(item("mm").lock, true);
  assert.equal(item("u1").tag, "favorite");
  assert.equal(item("eq").lock, null);
  assert.match(plan.searches.junk, /id:u2/);

  const lines = planToCsv(plan).trim().split("\n");
  assert.equal(lines[0], "Id,Hash,Tag,Notes");
  assert.ok(lines.some((l) => l.startsWith("u2,1001,junk,")));

  // Tamper: mark a protected item for unlock; apply must skip it.
  const calls: { itemId: string; state: boolean; characterId: string }[] = [];
  const setLock = async (x: { itemId: string; state: boolean; characterId: string }) => void calls.push(x);
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { paths } = await import("../src/config.js");
  item("eq").lock = false;
  item("eq").protected = true;
  writeFileSync(join(paths.plansDir, `${plan.id}.json`), JSON.stringify(plan));

  const res = await applyDimActions(plan.id, { delayMs: 0, setLock });
  assert.ok(!calls.some((c) => c.itemId === "eq"));
  assert.ok(calls.some((c) => c.itemId === "u2" && c.state === false && c.characterId === "c1"));
  assert.equal(res.failed.length, 0);

  calls.length = 0;
  const undo = await undoDimActions(plan.id, { delayMs: 0, setLock });
  assert.ok(calls.some((c) => c.itemId === "u2" && c.state === true));
  assert.ok(calls.some((c) => c.itemId === "mm" && c.state === false));
  assert.equal(undo.failed.length, 0);
});

test("RADS loot links to your best copy even when the sheet spells the name differently", async () => {
  const { buildSiteData } = await import("../src/report/siteData.js");
  const v = vault();
  const settings = SettingsSchema.parse({});
  const w = rateWeapons(v.weapons, { aegis: aegis(), wishlists: null, manifest: m }, settings);
  const a = rateArmor(v, settings);
  const loot = { name: "UNFORGIVEN", hash: null, type: "Submachine Gun", element: "Void", rarity: "Legendary" as const, icon: "", from: ["aegis" as const] };
  const act = { key: "x", name: "X", kind: "raid" as const, image: "", rank: 1, score: 0, verdict: "Low priority" as const, parts: { quality: 0, need: 0, sets: 0 }, weapons: [{ ...loot, tier: null, aegisRank: null, tab: null, frame: "", notes: "", owned: 2, bestScore: null, bestRoll: null, status: "have" as const }], sets: [], counts: { chase: 0, upgrade: 0, have: 1, sTier: 0 } };
  const data = buildSiteData(w, a, { vaultSize: 0, settings, vault: v, activities: [act] }, () => null, null);
  const best = w.ratings.filter((r) => r.name === "Unforgiven").sort((x, y) => y.score - x.score)[0];
  assert.equal(data.rads[0].weapons[0].best, best.instanceId);
});

test("report markdown has images and every section", () => {
  const v = vault();
  const settings = SettingsSchema.parse({});
  const w = rateWeapons(v.weapons, { aegis: aegis(), wishlists: null, manifest: m }, settings);
  const a = rateArmor(v, settings);
  const md = buildMarkdown(w, a, { vaultSize: 9, settings });
  for (const h of ["## Top picks by slot", "## Best by element", "## Best by archetype", "## Duplicates", "## Shard list", "## Armor"]) assert.ok(md.includes(h), h);
  assert.match(md, /!\[Unforgiven\]\(https:\/\/www\.bungie\.net\/screens\/1001\.jpg\)/);
  assert.match(md, /\*\*Attrition Orbs\*\*/);
});

test("the report embeds only the best raid's and best dungeon's banner art", async () => {
  const { buildSiteData } = await import("../src/report/siteData.js");
  const v = vault();
  const settings = SettingsSchema.parse({});
  const w = rateWeapons(v.weapons, { aegis: aegis(), wishlists: null, manifest: m }, settings);
  const act = (key: string, kind: string, score: number) => ({ key, name: key, kind, score, image: `art:${key}`, weapons: [] });
  const embeds: Record<string, boolean> = {};
  const key = (url: string | null | undefined, embed = true) => (url?.startsWith("art:") && (embeds[url] = embed), url ?? null);
  const activities = [act("r1", "raid", 50), act("r2", "raid", 80), act("d1", "dungeon", 10)] as unknown as NonNullable<Parameters<typeof buildSiteData>[2]["activities"]>;
  buildSiteData(w, rateArmor(v, settings), { vaultSize: 9, settings, activities }, key, null);
  assert.deepEqual(embeds, { "art:r1": false, "art:r2": true, "art:d1": true });
});

test("armor set tiers: Aegis tab and bonus sheet parse, and owning more of a strong set scores higher", async () => {
  const { parseAegisArmorTab, mergeBonusSheet, setKey } = await import("../src/sources/armorSets.js");
  const { setValue } = await import("../src/rating/armor.js");
  const tab = [
    "INFO,,,,,,,,,ANALYSIS,,",
    "img,#,Set,Season,Bonus,Pcs,Tags,Trigger,Effect,Description,#,Tier",
    ',,"Atheon\'s Memory\nVault of Glass",29,Collective Power,4,damage,trigger,Orb at feet,great,1,S',
    ',,"Iron Panoply\nIron Banner",27,Iron Conviction,4,survivability,crit,DR,decent,19,B',
  ].join("\n");
  const sets = parseAegisArmorTab(tab);
  assert.equal(sets[setKey("Atheon's Memory")].bonuses[0].tier, "S");
  assert.equal(sets[setKey("Iron Panoply Set")].source, "Iron Banner");
  mergeBonusSheet(sets, ['"Armor Set Bonuses","",""', '"Atheon\'s Memory\n\nVault of Glass\nRaid","","2 Piece | Radiolaria Breach\n\nOn Orb pickup."', '"","","4 Piece | Collective Power\n\nSpawns an Orb."'].join("\n"));
  const atheon = sets[setKey("Atheon's Memory")];
  assert.deepEqual(atheon.bonuses.map((b) => [b.pieces, b.name, b.tier]), [[2, "Radiolaria Breach", null], [4, "Collective Power", "S"]]);
  assert.equal(atheon.bonuses[1].description, "Spawns an Orb.");
  assert.ok(setValue(85, 100, 4) > setValue(85, 100, 2));
  assert.ok(setValue(85, 100, 2) > setValue(85, 100, 1));
  assert.ok(setValue(100, 100, 4) > setValue(40, 40, 4));
});

test("encounter loadouts: one weapon per slot, at most one exotic, guide picks preferred", async () => {
  const { planEncounter } = await import("../src/rating/encounters.js");
  const w = (name: string, type: string, slot: string, score: number, rarity = "Legendary") =>
    ({ instanceId: name, name, type, slot, score, rarity }) as unknown as import("../src/rating/weapons.js").WeaponRating;
  const vault = [
    w("Gjallarhorn", "Rocket Launcher", "Power", 70, "Exotic"),
    w("Hothead", "Rocket Launcher", "Power", 85),
    w("Still Hunt", "Sniper Rifle", "Kinetic", 80, "Exotic"),
    w("Succession", "Sniper Rifle", "Kinetic", 85),
    w("Gnawing Hunger", "Auto Rifle", "Energy", 95),
  ];
  const plan = planEncounter({ name: "Test boss", kind: "boss", tip: "", roles: ["boss-burst", "precision", "add-clear"], meta: ["Gjallarhorn"] }, vault);
  const picked = plan.picks.map((p) => p.name);
  assert.equal(new Set(plan.picks.map((p) => vault.find((x) => x.name === p.name)!.slot)).size, plan.picks.length);
  assert.ok(plan.picks.filter((p) => vault.find((x) => x.name === p.name)!.rarity === "Exotic").length <= 1);
  assert.equal(plan.picks[0].name, "Gjallarhorn", "the guide's pick wins the burst slot");
  assert.ok(picked.includes("Succession") && picked.includes("Gnawing Hunger"));
});

test("DIM: Favorite and Keep tags become protected ids", async () => {
  const { keepIds } = await import("../src/dim/sync.js");
  const ids = keepIds({ fetchedAt: "", loadouts: [], tags: { a: { tag: "favorite", notes: null }, b: { tag: "junk", notes: null }, c: { tag: "keep", notes: "pvp" }, d: { tag: null, notes: "x" } } });
  assert.deepEqual(ids.sort(), ["a", "c"]);
});

test("moving items: destinations resolve by class name, id or vault", async () => {
  const { resolveTarget } = await import("../src/bungie/transfer.js");
  const v = { characters: [{ id: "111", className: "Hunter" }, { id: "222", className: "Warlock" }] } as unknown as import("../src/vault/types.js").Vault;
  assert.equal(resolveTarget(v, "hunter"), "111");
  assert.equal(resolveTarget(v, "222"), "222");
  assert.equal(resolveTarget(v, "Vault"), "vault");
  assert.throws(() => resolveTarget(v, "Titan"), /No character/);
});

test("readJsonCached parses a file once and re-reads it after a write", async () => {
  const { paths, writeJson, readJsonCached } = await import("../src/config.js");
  const f = `${paths.home}/cache-test.json`;
  assert.equal(readJsonCached(f, null), null);
  writeJson(f, { a: 1 });
  const first = readJsonCached<{ a: number } | null>(f, null);
  assert.equal(first?.a, 1);
  assert.equal(readJsonCached(f, null), first);
  writeJson(f, { a: 2 });
  assert.equal(readJsonCached<{ a: number } | null>(f, null)?.a, 2);
});

test("encounter loadouts: a vault with nothing that fits still plans every encounter", async () => {
  const { planEncounters } = await import("../src/rating/encounters.js");
  const plans = planEncounters([]);
  assert.ok(Object.values(plans).flat().length > 0);
  for (const e of Object.values(plans).flat()) assert.deepEqual(e.picks, []);
});

test("encounter plans filter by activity name, apostrophes and all", async () => {
  const { activityMatches } = await import("../src/rating/encounters.js");
  assert.ok(activityMatches("kings-fall", "King's Fall"));
  assert.ok(activityMatches("salvations-edge", "Salvation’s Edge"));
  assert.ok(activityMatches("shattered-throne", "The Shattered Throne"));
  assert.ok(activityMatches("vow-of-the-disciple", "vow"));
  assert.ok(!activityMatches("last-wish", "King's Fall"));
});

test("postmaster items are kept apart from what the character carries", async () => {
  const raw = profile([{ id: "a", hash: 1002, plugs: GOD_UNFORGIVEN }]);
  const item = (id: string, bucketHash: number) => ({ itemHash: 1002, itemInstanceId: id, bucketHash, state: 0 });
  raw.characterInventories = { data: { c1: { items: [item("carried", 1498876634), item("lost", 215593132)] } } };
  for (const id of ["carried", "lost"]) Object.assign(raw.itemComponents!.sockets!.data!, { [id]: raw.itemComponents!.sockets!.data!.a });
  const vault = decodeProfile(raw, m);
  const loc = Object.fromEntries(vault.weapons.map((w) => [w.instanceId, w.location]));
  assert.deepEqual(loc.carried, { where: "c1", equipped: false });
  assert.deepEqual(loc.lost, { where: "c1", equipped: false, postmaster: true });
  // Moving a postmaster item pulls it into its character's inventory first, then transfers it as usual.
  const calls: string[] = [];
  const send = async (path: string) => (calls.push(path.split("/").at(-2)!), {});
  const [r] = await moveItems(["lost"], "vault", { vault, send, delayMs: 0 });
  assert.deepEqual(calls, ["PullFromPostmaster", "TransferItem"]);
  assert.equal(r.pulled, true);
  assert.equal(r.where, "vault");
});

test("Aegis exotic tab: S to F grades become tiers, E/F clamp to D and score below it", () => {
  const exCsv = [
    '"WEAPON #","Name","INFO Season","Type","Usage","Tier"',
    '"","Praxic Blade","28","special","Hyperblade for movement","B"',
    '"","Ace of Spades","1","primary","bad","F"',
  ].join("\n");
  const rows = parseAegisExotics("Exotic Weapons", exCsv)!;
  assert.deepEqual(rows.map((r) => [r.name, r.tier, r.grade ?? null]), [["Praxic Blade", "B", null], ["Ace of Spades", "D", "F"]]);
  assert.equal(rows[0].notes, "Hyperblade for movement");
  assert.equal(parseAegisExotics("SMGs", csv), null);
});

test("encounter loadouts: shields and range steer add clear to the right weapon", async () => {
  const { planEncounter } = await import("../src/rating/encounters.js");
  const w = (name: string, type: string, slot: string, element: string, score: number) =>
    ({ instanceId: name, name, type, slot, element, score, rarity: "Legendary" }) as unknown as import("../src/rating/weapons.js").WeaponRating;
  const vault = [w("Void SMG", "Submachine Gun", "Energy", "Void", 90), w("Arc SMG", "Submachine Gun", "Energy", "Arc", 84), w("Arc Scout", "Scout Rifle", "Energy", "Arc", 84)];
  const base = { name: "Test", kind: "mechanics" as const, tip: "", roles: ["add-clear" as const] };
  assert.equal(planEncounter(base, vault).picks[0].name, "Void SMG", "with nothing to steer it, the best weapon wins");
  const arc = planEncounter({ ...base, shields: [{ element: "Arc", on: "Knights", frequency: "common" }] }, vault).picks[0];
  assert.equal(arc.name, "Arc SMG");
  assert.equal(arc.why, "Arc shields");
  assert.equal(planEncounter({ ...base, range: "long", shields: [{ element: "Arc", on: "Knights", frequency: "common" }] }, vault).picks[0].name, "Arc Scout");
});

test("encounter data: every raid and dungeon has encounters, each with valid facts and at least two sources", async () => {
  const { ENCOUNTERS, ROLE_TYPES } = await import("../src/data/encounters.js");
  const { ACTIVITIES } = await import("../src/sources/activities.js");
  for (const a of ACTIVITIES) assert.ok(ENCOUNTERS[a.key]?.length, `${a.key} has encounters`);
  for (const [key, list] of Object.entries(ENCOUNTERS)) {
    for (const e of list) {
      const at = `${key} / ${e.name}`;
      assert.ok(e.roles.length >= 1 && e.roles.every((r) => r in ROLE_TYPES), `${at}: roles`);
      assert.ok(new Set(e.sources).size >= 2, `${at}: two or more sources`);
      for (const s of e.shields ?? []) assert.ok(["Arc", "Solar", "Void", "Stasis", "Strand"].includes(s.element) && ["common", "some", "rare"].includes(s.frequency), `${at}: shield`);
      for (const c of e.champions ?? []) assert.ok(["Barrier", "Overload", "Unstoppable"].includes(c), `${at}: champion`);
      if (e.range) assert.ok(["close", "mid", "long", "mixed"].includes(e.range), `${at}: range`);
      if (e.dps) assert.ok(["burst", "sustained", "none"].includes(e.dps.style), `${at}: dps`);
    }
  }
});
