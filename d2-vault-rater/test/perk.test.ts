import "./env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeProfile } from "../src/vault/decode.js";
import { insertPerk } from "../src/bungie/transfer.js";
import { manifest, profile } from "./fixtures/build.js";

test("switching a perk: InsertSocketPlugFree body, equipped perk updates, bad perks and Bungie errors are readable", async () => {
  // A vault weapon whose first trait socket (index 3) can roll Outlaw, Destabilizing Rounds or Attrition Orbs.
  const vault = decodeProfile(profile([{ id: "x", hash: 1002, plugs: [11, 21, 31, 41, 52, 61], options: { 3: [41, 42, 40] } }]), manifest());
  const w = vault.weapons[0];
  const col = w.columns.find((c) => c.socket === 3)!;
  const other = "Outlaw";
  assert.ok(col.options.includes(other) && col.active !== other);
  const sent: [string, Record<string, unknown>][] = [];
  const send = async (path: string, body: Record<string, unknown>) => (sent.push([path, body]), {});

  await insertPerk(w.instanceId, col.socket!, other, { vault, send });
  assert.equal(sent[0][0], "/Destiny2/Actions/Items/InsertSocketPlugFree/");
  assert.deepEqual(sent[0][1].plug, { socketIndex: col.socket, socketArrayType: 0, plugItemHash: col.hashes![other] });
  assert.equal(sent[0][1].itemId, w.instanceId);
  assert.equal(sent[0][1].characterId, w.location.where === "vault" ? vault.characters[0].id : w.location.where);
  assert.equal(col.active, other);

  // Already equipped: nothing is sent.
  await insertPerk(w.instanceId, col.socket!, other, { vault, send });
  assert.equal(sent.length, 1);

  await assert.rejects(insertPerk(w.instanceId, col.socket!, "Not A Perk", { vault, send }), /isn't a perk you can select/);
  const fail = async () => {
    throw new Error("DestinyCharacterNotInTower: not in a social space");
  };
  await assert.rejects(insertPerk(w.instanceId, col.socket!, col.options.find((o) => o !== other)!, { vault, send: fail }), /Try from orbit or the Tower/);
});
