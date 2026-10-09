import type { WeaponRating, WeaponReport } from "../rating/weapons.js";
import type { ArmorRating, ArmorReport } from "../rating/armor.js";
import type { ReportOptions } from "./report.js";
import { setKey, type ArmorSetData } from "../sources/armorSets.js";
import { stripReissue } from "../bungie/defs.js";

/**
 * The data the report page renders: every weapon and armor piece, highlights, RADS, Wrapped and DIM.
 * Pure (no file or network access) so the local report and the browser app share it.
 * `imageKey` turns an image URL into the key the page looks up in its image map.
 */
export function buildSiteData(w: WeaponReport, a: ArmorReport, o: ReportOptions, imageKey: (url: string | null | undefined) => string | null, setData: ArmorSetData | null) {
  const ids = (list: WeaponRating[]) => list.map((r) => r.instanceId);
  // Full-size screenshots are ~170 KB each, so an embedded report gives only the top picks per slot one.
  const withShot = new Set(Object.values(w.bestBySlot).flatMap((l) => l.slice(0, 1).map((r) => r.instanceId)));

  const recW = new Map((o.vault?.weapons ?? []).map((x) => [x.instanceId, x]));
  const recA = new Map((o.vault?.armor ?? []).map((x) => [x.instanceId, x]));
  const classOf = new Map((o.vault?.characters ?? []).map((c) => [c.id, c.className]));
  const where = (l?: { where: string; equipped: boolean }) => (!l ? null : l.where === "vault" ? "Vault" : `${classOf.get(l.where) ?? "Character"}${l.equipped ? " (equipped)" : ""}`);
  // DIM Sync: tag, notes and the loadouts each item is in.
  const inLoadouts = new Map<string, string[]>();
  for (const l of o.dim?.loadouts ?? []) for (const id of l.itemIds) inLoadouts.set(id, [...(inLoadouts.get(id) ?? []), l.name]);
  // Your best copy of each weapon by name (first one on a tie), for RADS loot.
  const bestCopy = new Map<string, WeaponRating>();
  for (const r of w.ratings) {
    const k = stripReissue(r.name);
    if (r.score > (bestCopy.get(k)?.score ?? -Infinity)) bestCopy.set(k, r);
  }
  const dimOf = (id: string) => {
    const rec = recW.get(id) ?? recA.get(id);
    return { tg: o.dim?.tags[id]?.tag ?? null, nt: o.dim?.tags[id]?.notes ?? null, lo: inLoadouts.get(id) ?? [], wh: rec?.location.where ?? null, eq: rec?.location.equipped ?? false };
  };
  const weapons = w.ratings.map((r) => {
    const matched = new Set(Object.values(r.matched).flat());
    return {
    ...dimOf(r.instanceId),
    id: r.instanceId,
    n: r.name,
    t: r.type,
    f: r.frame,
    e: r.element,
    s: r.slot,
    r: r.rarity,
    ic: imageKey(r.icon),
    ss: o.allScreenshots || withShot.has(r.instanceId) ? imageKey(r.screenshot) : null,
    tier: r.aegis?.tier ?? null,
    rank: r.aegis?.rank ?? null,
    tab: r.aegis?.tab ?? null,
    notes: r.aegis?.notes || null,
    sc: r.score,
    ws: r.weaponScore,
    rs: r.rollScore,
    pk: r.perks.map((p) => ({ k: p.kind, o: p.options, m: p.options.filter((x) => matched.has(x)) })),
    v: r.verdict,
    l: r.label,
    c: r.category,
    why: r.reasons,
    lk: r.locked,
    god: r.godRoll,
    src: o.sourceOf?.(r.itemHash, r.name) ?? null,
    trash: r.trashRoll,
    gt: r.gearTier,
    am: recW.get(r.instanceId)?.ammo ?? null,
    pw: recW.get(r.instanceId)?.power ?? null,
    cr: recW.get(r.instanceId)?.crafted ?? false,
    ad: recW.get(r.instanceId)?.adept ?? false,
    mw: recW.get(r.instanceId)?.masterwork ?? null,
    loc: where(recW.get(r.instanceId)?.location),
    };
  });
  const armor = a.ratings.map((r: ArmorRating) => ({
    ...dimOf(r.instanceId),
    id: r.instanceId,
    n: r.name,
    cls: r.classType,
    s: r.slot,
    r: r.rarity,
    gt: r.gearTier,
    arch: r.archetype,
    st: r.topStats.map((t) => [t.name, t.value]),
    tot: r.statTotal,
    set: r.setName,
    legacy: r.legacy,
    ic: imageKey(r.icon),
    lk: r.locked,
    sc: r.score,
    parts: r.parts,
    v: r.verdict,
    l: r.label,
    why: r.reasons,
    all: recA.get(r.instanceId)?.stats ?? null,
    si: r.setInfo,
    loc: where(recA.get(r.instanceId)?.location),
  }));
  const wrapped = o.wrapped
    ? {
        ...o.wrapped,
        characters: o.wrapped.characters.map((c) => ({ ...c, emblem: imageKey(c.emblem) })),
        topWeapons: o.wrapped.topWeapons.map((t) => ({ ...t, icon: imageKey(t.icon), owned: w.ratings.some((r) => r.itemHash === t.hash) })),
      }
    : null;
  const shardW = w.ratings.filter((r) => r.verdict === "shard").length;
  const shardA = a.ratings.filter((r) => r.verdict === "shard").length;
  // One icon per perk name across the vault, so the page can show perks as symbols.
  const perkIcons: Record<string, string> = {};
  for (const r of w.ratings) for (const p of r.perks) for (const [n, url] of Object.entries(p.icons ?? {})) perkIcons[n] ??= imageKey(url) ?? "";
  const data = {
    perkIcons,
    generated: new Date().toISOString(),
    preset: o.settings.preset,
    focus: o.settings.focus,
    summary: {
      vaultSize: o.vaultSize,
      weapons: w.ratings.length,
      weaponKeep: w.ratings.length - shardW,
      weaponShard: shardW,
      armor: a.ratings.length,
      armorKeep: a.ratings.length - shardA,
      armorShard: shardA,
      unrated: w.unratedCount,
    },
    weapons,
    armor,
    bestBySlot: Object.fromEntries(Object.entries(w.bestBySlot).map(([k, v]) => [k, ids(v)])),
    bestByElement: Object.fromEntries(Object.entries(w.bestByElement).map(([k, v]) => [k, ids(v)])),
    bestByArchetype: Object.fromEntries(Object.entries(w.bestByArchetype).map(([k, v]) => [k, ids(v)])),
    duplicates: w.duplicates,
    gaps: w.gaps,
    armorBest: Object.fromEntries(
      Object.entries(a.best).map(([cls, slots]) => [
        cls,
        Object.fromEntries(Object.entries(slots).map(([slot, b]) => [slot, { overall: b.overall.instanceId, byArchetype: Object.fromEntries(Object.entries(b.byArchetype).map(([k, v]) => [k, v.instanceId])) }])),
      ]),
    ),
    buildStats: a.buildStats,
    setCounts: a.setCounts,
    // Full bonus details for the sets you own.
    sets: Object.fromEntries(
      [...new Set(a.ratings.filter((r) => r.setInfo).map((r) => r.setInfo!.name))].flatMap((n) => {
        const def = setData?.sets[setKey(n)];
        return def ? [[def.name, def]] : [];
      }),
    ),
    wrapped,
    // Raids and dungeons ranked for farming, with their loading-screen art.
    rads: (o.activities ?? []).map((act) => ({
      ...act,
      image: imageKey(act.image),
      weapons: act.weapons.map((x) => ({
        ...x,
        icon: imageKey(x.icon),
        src: o.sourceOf?.(x.hash ?? 0, x.name) ?? null,
        // Your best copy, so the page can open its details.
        best: bestCopy.get(x.name)?.instanceId ?? null,
      })),
    })),
    encounters: o.encounters ?? {},
    chars: (o.vault?.characters ?? []).map((c) => ({ id: c.id, cls: c.className })),
    dimLoadouts: (o.dim?.loadouts ?? []).map((l) => ({ name: l.name, classType: l.classType, ids: l.itemIds })),
    dim: {
      tags: o.settings.dim.tags,
      loadouts: o.settings.dim.loadouts,
      protectTagged: o.settings.dim.tags && o.settings.dim.protectTagged,
      loaded: !!o.dim,
      error: o.dimError ?? null,
      loadoutCount: o.dim?.loadouts.length ?? 0,
      taggedCount: Object.keys(o.dim?.tags ?? {}).length,
    },
    searches: o.searches ?? null,
    // Dry-run lock plan: only the items whose lock would change.
    plan: o.plan
      ? {
          id: o.plan.id,
          counts: o.plan.counts,
          items: o.plan.items.filter((i) => i.lock !== null && !(i.lock === false && i.protected)).map((i) => ({ id: i.instanceId, n: i.name, k: i.kind, lock: i.lock, c: i.category })),
        }
      : null,
    settings: { preset: o.settings.preset, focus: o.settings.focus, byWeaponType: o.settings.byWeaponType, protect: o.settings.protect },
    weaponTypes: [...new Set(w.ratings.map((r) => r.type))].sort(),
  };
  return data;
}

export type SiteData = ReturnType<typeof buildSiteData>;
