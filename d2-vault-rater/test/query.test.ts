import "./env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The DIM-style query parser lives inside report-template/site.html between QUERY-BEGIN and QUERY-END markers.
const code = readFileSync("report-template/site.html", "utf8").split("// QUERY-BEGIN")[1].split("// QUERY-END")[0];
const w = (n: string, t: string, e: string, o: object = {}) => ({ n, t, e, s: "Energy", am: "Special", r: "Legendary", pk: [{ o: ["Kill Clip", "Rampage"] }], pw: 1800, ...o });
const items = [w("Alpha", "Sniper Rifle", "Void", { tg: "junk" }), w("Beta", "Hand Cannon", "Solar", { lk: true, pw: 1810 }), w("Beta", "Hand Cannon", "Solar", { pw: 1790, tg: "keep" }), w("Gamma", "Sniper Rifle", "Solar")];
const SETS = { w: { items, search: (x: any) => [x.n, x.t, x.e].join(" ") }, a: { items: [] } };
const compile = new Function("SETS", code + ";return compileQuery;")(SETS);
const run = (q: string) => items.map((x, i) => (compile(q, "w")(x) ? i : -1)).filter((i) => i >= 0);

test("DIM-style search queries", () => {
  const cases: [string, number[]][] = [
    ["is:weapon", [0, 1, 2, 3]], ["is:sniperrifle", [0, 3]], ["is:void or is:solar -is:locked", [0, 2, 3]], ["tag:junk", [0]], ["-tag:junk", [1, 2, 3]],
    ["tag:none", [1, 3]], ["-is:locked is:dupe", [2]], ["is:maxpower", [1]], ["exactperk:\"kill clip\" and alpha", [0]], ["exactname:beta", [1, 2]],
    ["(is:void or is:solar) -tag:junk", [1, 2, 3]], ["hand cannon", [1, 2]], ["-", []], ["(alpha", [0]], ["is:bogus", []],
  ];
  for (const [q, want] of cases) assert.deepEqual(run(q), want, q);
});

test("tag: matches EVR tags by key or name, and tag:none needs neither tag", () => {
  const x = { n: "Delta", t: "Bow", e: "Arc", et: "c1", etl: "Raid gear" };
  for (const q of ["tag:raidgear", 'tag:"raid gear"', "tag:c1"]) assert.ok(compile(q, "w")(x), q);
  assert.ok(!compile("tag:none", "w")(x));
  assert.ok(compile("tag:favourite", "w")({ ...x, et: "favorite" }));
});
