/**
 * Equipping a build: a dry-run plan of every change first, then the same steps for real.
 * Items move and equip through the rater's moveItems; subclass plugs and armor mods go in with
 * InsertSocketPlugFree; the result can be saved to an in-game loadout slot.
 */
import { action, moveItems, type MoveResult } from "../../../src/bungie/transfer.js";
import type { ArmorRecord, WeaponRecord } from "../../../src/vault/types.js";
import { ARMOR_SLOTS, CLASS_NAME, WEAPON_SLOTS, isEmptyPlug, itemOf, socketsOf, type Build, type BuildSlot, type Ctx, type GearSlot } from "./model";
import { charFor, modSockets, subclassInstance, type BuildProfile } from "./profile";

export interface Step {
  kind: "move" | "subclass" | "plug" | "mod" | "loadout" | "note";
  text: string;
  /** Shown as a warning; the step may fail or is skipped. */
  warn?: boolean;
  /** A failure here is reported but the rest still runs (item moves); otherwise the plan stops. */
  soft?: boolean;
  run?: () => Promise<string | void>;
}

export interface Plan {
  charId: string | null;
  steps: Step[];
  /** Nothing would change. */
  noop: boolean;
}

const insert = (p: BuildProfile, charId: string, itemId: string, socketIndex: number, plugItemHash: number) =>
  action("/Destiny2/Actions/Items/InsertSocketPlugFree/", {
    plug: { socketIndex, socketArrayType: 0, plugItemHash },
    itemId,
    characterId: charId,
    membershipType: p.membershipType,
  });

const check = (r: MoveResult[]) => {
  const bad = r.filter((x) => !x.ok || x.error);
  if (bad.length) throw new Error(bad.map((x) => `${x.name}: ${x.error}`).join(" "));
};

export function planEquip(b: Build, ctx: Ctx, p: BuildProfile, opts: { loadoutSlot?: number } = {}): Plan {
  const steps: Step[] = [];
  const char = charFor(p, b.cls);
  if (!char) return { charId: null, steps: [{ kind: "note", text: `You have no ${CLASS_NAME(b.cls)} to equip this on.`, warn: true }], noop: true };
  const name = (h: number) => ctx.defs.plugs[h]?.n ?? `#${h}`;

  /* Gear: pull what isn't on the character, equip what isn't equipped. Exotics go last so the old exotic is replaced first. */
  const ids: string[] = [];
  const inBuild = new Set(Object.values(b.items).map((x) => x?.id));
  // An item equipped on another character can't move until something else is equipped there.
  const substitute = (rec: WeaponRecord | ArmorRecord, otherId: string) => {
    const cls = CLASS_NAME(p.chars.find((c) => c.id === otherId)?.cls ?? 0);
    const pool: (WeaponRecord | ArmorRecord)[] = rec.kind === "weapon" ? ctx.vault.weapons : ctx.vault.armor;
    const ok = (x: WeaponRecord | ArmorRecord) =>
      x.slot === rec.slot && !inBuild.has(x.instanceId) && x.rarity !== "Exotic" && !x.location.equipped && (x.kind === "weapon" || x.classType === cls || x.classType === "Any");
    return pool.find((x) => ok(x) && x.location.where === otherId) ?? pool.find((x) => ok(x) && x.location.where === "vault");
  };
  for (const slot of [...WEAPON_SLOTS, ...ARMOR_SLOTS] as BuildSlot[]) {
    const it = b.items[slot];
    if (!it) continue;
    const rec = itemOf(ctx, it.id);
    if (!rec) {
      steps.push({ kind: "note", text: `${slot}: the saved item is no longer in your vault or on a character.`, warn: true });
      continue;
    }
    if (char.equipped.has(it.id)) continue;
    const where = rec.location.where;
    const from = where === "vault" ? "vault" : where === char.id ? "inventory" : `${CLASS_NAME(p.chars.find((c) => c.id === where)?.cls ?? 0)}`;
    const blocked = rec.location.equipped && where !== char.id;
    steps.push({
      kind: "move",
      text: `${slot}: ${where === char.id ? "equip" : "pull and equip"} ${rec.name}${where === char.id ? "" : ` (from ${from})`}`,
    });
    if (blocked) {
      const sub = substitute(rec, where);
      if (sub) inBuild.add(sub.instanceId);
      steps.push(
        sub
          ? { kind: "move", soft: true, text: `${from}: equip ${sub.name} in its place, so ${rec.name} can move`, run: () => moveItems([sub.instanceId], where, { equip: true }).then(check) }
          : { kind: "note", text: `${rec.name} is equipped on your ${from} and nothing can replace it there; equip something else first.`, warn: true },
      );
    }
    ids.push(it.id);
  }
  if (ids.length) {
    const ordered = [...ids.filter((id) => itemOf(ctx, id)?.rarity !== "Exotic"), ...ids.filter((id) => itemOf(ctx, id)?.rarity === "Exotic")];
    steps.push({
      kind: "move",
      text: `Moves and equips the ${ordered.length} item${ordered.length > 1 ? "s" : ""} above`,
      soft: true,
      run: () => moveItems(ordered, char.id, { equip: true }).then(check),
    });
  }

  /* Subclass: equip it, then change only the sockets that differ. */
  const sc = b.subclass ? ctx.defs.subclasses[b.subclass] : null;
  const inst = subclassInstance(p, b.cls, b.subclass);
  if (sc && !inst) steps.push({ kind: "note", text: `Your ${CLASS_NAME(b.cls)} doesn't have ${sc.n} unlocked.`, warn: true });
  if (sc && inst) {
    if (!inst.equipped)
      steps.push({
        kind: "subclass",
        text: `Switch subclass to ${sc.n}`,
        run: () => action("/Destiny2/Actions/Items/EquipItems/", { itemIds: [inst.id], characterId: char.id, membershipType: p.membershipType }).then(() => {}),
      });
    const now = p.sockets.get(inst.id) ?? [];
    const want = (i: number) => b.plugs[i] ?? sc.sockets[i].init;
    const changes = sc.sockets.map((s, i) => i).filter((i) => sc.sockets[i].plugs.length > 1 && want(i) && want(i) !== now[i]);
    // A plug can sit in only one socket: clear a socket first when what it holds is wanted elsewhere.
    const emptyOf = (i: number) => sc.sockets[i].plugs.find((h) => isEmptyPlug(ctx.defs.plugs[h]));
    const clears = changes.filter((j) => changes.some((i) => i !== j && sc.sockets[i].group === sc.sockets[j].group && want(i) === now[j]) && emptyOf(j));
    const ins = (i: number, h: number, label: string) => ({ kind: "plug" as const, text: label, run: () => insert(p, char.id, inst.id, i, h).then(() => {}) });
    const order = (g: string) => changes.filter((i) => sc.sockets[i].group === g);
    for (const i of clears.filter((i) => sc.sockets[i].group === "fragments")) steps.push(ins(i, emptyOf(i)!, `Clear fragment slot ${socketsOf(sc, "fragments").indexOf(i) + 1}`));
    for (const i of clears.filter((i) => sc.sockets[i].group === "aspects")) steps.push(ins(i, emptyOf(i)!, `Clear aspect slot ${socketsOf(sc, "aspects").indexOf(i) + 1}`));
    for (const g of ["aspects", "super", "class", "movement", "melee", "grenade", "other", "fragments"])
      for (const i of order(g)) steps.push(ins(i, want(i), `${g[0].toUpperCase() + g.slice(1)}: ${name(now[i])} → ${name(want(i))}`));
  }

  /* Armor mods: clear the sockets that change, then insert, so energy never runs over mid-way. */
  for (const slot of ARMOR_SLOTS as readonly GearSlot[]) {
    const id = b.items[slot]?.id;
    const mods = b.mods[slot];
    if (!id || !mods || !p.sockets.has(id)) continue;
    const plugs = p.sockets.get(id)!;
    const idx = modSockets(id, slot, p, ctx.defs);
    const empty = (i: number) => ctx.defs.mods[ctx.defs.plugs[plugs[i]]?.c ?? ""]?.find((h) => isEmptyPlug(ctx.defs.plugs[h]));
    const changing = idx.map((sock, k) => ({ sock, want: mods[k] ?? 0 })).filter(({ sock, want }) => sock >= 0 && (want || 0) !== (isEmptyPlug(ctx.defs.plugs[plugs[sock]]) ? 0 : plugs[sock]));
    for (const { sock } of changing) {
      const e = empty(sock);
      if (e && !isEmptyPlug(ctx.defs.plugs[plugs[sock]])) steps.push({ kind: "mod", text: `${slot}: remove ${name(plugs[sock])}`, run: () => insert(p, char.id, id, sock, e).then(() => {}) });
    }
    for (const { sock, want } of changing)
      if (want) steps.push({ kind: "mod", text: `${slot}: insert ${name(want)}`, run: () => insert(p, char.id, id, sock, want).then(() => {}) });
  }
  if (ARMOR_SLOTS.some((s) => b.items[s] && b.mods[s]?.some(Boolean) && !p.sockets.has(b.items[s]!.id)))
    steps.push({ kind: "note", text: "Some armor's sockets couldn't be read, so its mods are left as they are.", warn: true });

  const noop = !steps.some((s) => s.run);
  if (opts.loadoutSlot !== undefined && opts.loadoutSlot >= 0) {
    const slot = char.loadouts[opts.loadoutSlot];
    const pick = (now: number | undefined, list: number[]) => (now ? now : list[opts.loadoutSlot! % Math.max(1, list.length)] ?? 0);
    steps.push({
      kind: "loadout",
      text: `Save the result to in-game loadout ${opts.loadoutSlot + 1}${slot && !slot.empty ? " (replaces what's there)" : ""}`,
      warn: !!slot && !slot.empty,
      run: () =>
        action("/Destiny2/Actions/Loadouts/SnapshotLoadout/", {
          loadoutIndex: opts.loadoutSlot,
          characterId: char.id,
          membershipType: p.membershipType,
          colorHash: pick(slot?.colorHash, ctx.defs.loadout.colors),
          iconHash: pick(slot?.iconHash, ctx.defs.loadout.icons),
          nameHash: pick(slot?.nameHash, ctx.defs.loadout.names),
        }).then(() => {}),
    });
  }
  return { charId: char.id, steps, noop };
}

/** Runs the plan's steps in order. Item moves that fail are reported at the end; any other failure stops the run. */
export async function applyPlan(plan: Plan, progress: (i: number, status: "run" | "ok" | "fail", msg?: string) => void): Promise<{ ok: boolean; error?: string }> {
  const errors: string[] = [];
  for (const [i, s] of plan.steps.entries()) {
    if (!s.run) continue;
    progress(i, "run");
    try {
      await s.run();
      progress(i, "ok");
    } catch (e) {
      const msg = (e as Error).message;
      progress(i, "fail", msg);
      errors.push(`${s.text}: ${msg}`);
      if (!s.soft) return { ok: false, error: errors.join(" ") };
    }
  }
  return errors.length ? { ok: false, error: errors.join(" ") } : { ok: true };
}
