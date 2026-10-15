/**
 * Cuts the manifest down to what the Builds tab needs: every subclass with its sockets, the plugs those
 * sockets take (supers, abilities, aspects, fragments) and the armor mods. A few hundred KB, cached per
 * game version. Used by the builds worker in the browser and by the tests in Node.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

/** The six Armor 3.0 stats, in the order the game and DIM show them: Health, Melee, Grenade, Super, Class, Weapons. */
export const STAT_HASHES = [392767087, 4244567218, 1735777505, 144602215, 1943323491, 2996146975] as const;

export type SocketGroup = "class" | "movement" | "super" | "melee" | "grenade" | "aspects" | "fragments" | "other";

export interface PlugDef {
  h: number;
  n: string;
  i?: string;
  /** Description (or the plug's perk descriptions). */
  d: string;
  /** plugCategoryIdentifier */
  c: string;
  t?: string;
  /** Energy cost (fragments, armor mods). */
  cost?: number;
  /** Fragment slots an aspect opens. */
  cap?: number;
  /** Armor stat bonuses: [statHash, value]. */
  st?: [number, number][];
}

export interface SubclassSocket {
  group: SocketGroup;
  /** The default plug. */
  init: number;
  /** Every plug the socket can take (just `init` when it is fixed). */
  plugs: number[];
}

export interface SubclassDef {
  h: number;
  n: string;
  i?: string;
  /** The game's text for the subclass (its flavor text: subclass descriptions are empty). */
  d?: string;
  /** 0 Titan, 1 Hunter, 2 Warlock */
  cls: number;
  el: "Arc" | "Solar" | "Void" | "Stasis" | "Strand" | "Prismatic";
  sockets: SubclassSocket[];
}

export interface BuildDefs {
  version: string;
  plugs: Record<number, PlugDef>;
  subclasses: Record<number, SubclassDef>;
  /** Armor mod plug category (enhancements.v2_head, …) -> mods, cheapest duplicates dropped. */
  mods: Record<string, number[]>;
  /** In-game loadout identifiers (DestinyLoadoutConstantsDefinition), for saving to an empty slot. */
  loadout: { colors: number[]; icons: number[]; names: number[] };
  /** In-game loadout name / icon image / colour swatch image by hash (absent in older cached copies). */
  loadoutLook?: { names: Record<number, string>; icons: Record<number, string>; colors: Record<number, string> };
}

const ELEMENT: Record<number, SubclassDef["el"]> = { 2: "Arc", 3: "Solar", 4: "Void", 6: "Stasis", 7: "Strand" };

export function groupOf(pci: string): SocketGroup {
  const last = pci.split(".").pop() ?? "";
  if (last === "class_abilities") return "class";
  if (last === "movement") return "movement";
  if (last === "supers") return "super";
  if (last === "melee") return "melee";
  if (last === "grenades") return "grenade";
  if (last === "aspects" || last === "totems") return "aspects";
  if (last === "fragments" || last === "trinkets") return "fragments";
  return "other";
}

export const MOD_CATEGORY = /^enhancements\.v2_(general|head|arms|chest|legs|class_item)$/;

export function stripBuildDefs(version: string, items: Raw, plugSets: Raw, perks: Raw, loadoutConstants: Raw = {}, look: { names?: Raw; icons?: Raw; colors?: Raw } = {}): BuildDefs {
  const lc = Object.values(loadoutConstants)[0] ?? {};
  const out: BuildDefs = {
    version,
    plugs: {},
    subclasses: {},
    mods: {},
    loadout: { colors: lc.loadoutColorHashes ?? [], icons: lc.loadoutIconHashes ?? [], names: lc.loadoutNameHashes ?? [] },
    loadoutLook: { names: {}, icons: {}, colors: {} },
  };
  const pick = (t: Raw | undefined, field: string, into: Record<number, string>) => {
    for (const [h, d] of Object.entries(t ?? {})) if ((d as Raw)[field]) into[Number(h)] = (d as Raw)[field];
  };
  pick(look.names, "name", out.loadoutLook!.names);
  pick(look.icons, "iconImagePath", out.loadoutLook!.icons);
  pick(look.colors, "colorImagePath", out.loadoutLook!.colors);
  const statSet = new Set<number>(STAT_HASHES);
  const addPlug = (h: number) => {
    if (out.plugs[h]) return;
    const d = items[h];
    if (!d?.plug) return;
    const desc =
      d.displayProperties?.description ||
      (d.perks ?? [])
        .map((p: Raw) => perks[p.perkHash]?.displayProperties?.description ?? "")
        .filter((s: string) => s && !/[▲▼]\s*$/.test(s))
        .join("\n");
    const st = (d.investmentStats ?? []).filter((s: Raw) => statSet.has(s.statTypeHash) && s.value).map((s: Raw) => [s.statTypeHash, s.value]);
    out.plugs[h] = {
      h,
      n: d.displayProperties?.name ?? "",
      i: d.displayProperties?.icon,
      d: desc,
      c: d.plug.plugCategoryIdentifier ?? "",
      t: d.itemTypeDisplayName || undefined,
      ...(d.plug.energyCost?.energyCost ? { cost: d.plug.energyCost.energyCost } : {}),
      ...(d.plug.energyCapacity?.capacityValue ? { cap: d.plug.energyCapacity.capacityValue } : {}),
      ...(st.length ? { st } : {}),
    };
  };
  const setPlugs = (setHash: number | undefined): number[] =>
    [...new Set<number>((plugSets[setHash ?? -1]?.reusablePlugItems ?? []).map((p: Raw) => p.plugItemHash))];

  for (const d of Object.values(items)) {
    // classType 3 subclasses are the old "Unfocused energy" placeholders.
    if (d.itemType !== 16 || d.classType > 2 || !d.sockets?.socketEntries?.length || d.redacted) continue;
    const sockets: SubclassSocket[] = d.sockets.socketEntries.map((e: Raw) => {
      const plugs = setPlugs(e.reusablePlugSetHash);
      // Some default plugs are retired items; the socket's plug set still names the category.
      const pci = (items[e.singleInitialItemHash] ?? items[plugs[0]])?.plug?.plugCategoryIdentifier ?? "";
      if (!plugs.length && e.singleInitialItemHash) plugs.push(e.singleInitialItemHash);
      for (const h of plugs) addPlug(h);
      addPlug(e.singleInitialItemHash);
      return { group: groupOf(pci), init: e.singleInitialItemHash, plugs };
    });
    const dmg = d.talentGrid?.hudDamageType;
    out.subclasses[d.hash] = {
      h: d.hash,
      n: d.displayProperties.name,
      i: d.displayProperties.icon,
      d: d.displayProperties.description || d.flavorText || undefined,
      cls: d.classType,
      el: /prismatic/i.test(d.displayProperties.name) ? "Prismatic" : ELEMENT[dmg] ?? "Arc",
      sockets,
    };
  }

  // Armor mods: the plug sets the Armor 3.0 mod sockets use. Reduced-cost artifact copies share a name;
  // keep the full-cost one, which every player can insert.
  const byName = new Map<string, number>();
  for (const s of Object.values(plugSets)) {
    for (const p of s.reusablePlugItems ?? []) {
      const d = items[p.plugItemHash];
      const pci = d?.plug?.plugCategoryIdentifier ?? "";
      if (!MOD_CATEGORY.test(pci) || !d.displayProperties?.name || /^Locked /.test(d.displayProperties.name)) continue;
      // Every copy is kept as a definition, so a mod already in someone's armor is recognised.
      addPlug(d.hash);
      const key = pci + "|" + d.displayProperties.name;
      const prev = byName.get(key);
      if (prev === undefined || (d.plug.energyCost?.energyCost ?? 0) > (items[prev].plug.energyCost?.energyCost ?? 0)) byName.set(key, d.hash);
    }
  }
  for (const [key, h] of byName) (out.mods[key.split("|")[0]] ??= []).push(h);
  return out;
}
