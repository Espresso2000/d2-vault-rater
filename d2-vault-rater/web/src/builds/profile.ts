/**
 * What equipping needs beyond the rated vault: each character's subclasses and what is in their sockets,
 * which plugs are unlocked, the mods in each armor piece, and the in-game loadout slots.
 */
import { bungie } from "../shims/client";
import { primaryMembership } from "../shims/oauth";
import type { BuildDefs } from "./defs.strip";
import { ARMOR_SLOTS, GENERAL_PCI, MOD_PCI, MOD_SOCKETS, WEAPON_SLOTS, defaultPlugs, itemOf, newBuild, type Build, type BuildSlot, type Ctx, type GearSlot } from "./model";

const SUBCLASS_BUCKET = 3284755031;

export interface CharState {
  id: string;
  cls: number;
  light: number;
  emblem?: string;
  /** Instance ids equipped now. */
  equipped: Set<string>;
  subclasses: { id: string; hash: number; equipped: boolean }[];
  loadouts: { colorHash: number; iconHash: number; nameHash: number; empty: boolean }[];
}

export interface BuildProfile {
  membershipType: number;
  chars: CharState[];
  /** instance id -> plug hash in each socket */
  sockets: Map<string, number[]>;
  /** subclass instance id -> socket index -> unlocked plug hashes */
  unlocked: Map<string, Record<number, Set<number>>>;
  fetchedAt: number;
}

type Item = { itemInstanceId?: string; itemHash: number; bucketHash: number };
interface RawProfile {
  characters?: { data?: Record<string, { characterId: string; classType: number; light: number; emblemPath?: string }> };
  characterInventories?: { data?: Record<string, { items: Item[] }> };
  characterEquipment?: { data?: Record<string, { items: Item[] }> };
  characterLoadouts?: { data?: Record<string, { loadouts: { colorHash: number; iconHash: number; nameHash: number; items: { itemInstanceId: string }[] }[] }> };
  itemComponents?: {
    sockets?: { data?: Record<string, { sockets: { plugHash?: number }[] }> };
    reusablePlugs?: { data?: Record<string, { plugs: Record<string, { plugItemHash: number; canInsert: boolean; enabled: boolean }[]> }> };
  };
}

export async function fetchBuildProfile(): Promise<BuildProfile> {
  const who = await primaryMembership();
  const raw = await bungie<RawProfile>(`/Destiny2/${who.membershipType}/Profile/${who.membershipId}/?components=200,201,205,206,305,310`);
  const sockets = new Map<string, number[]>();
  for (const [id, s] of Object.entries(raw.itemComponents?.sockets?.data ?? {})) sockets.set(id, s.sockets.map((x) => x.plugHash ?? 0));
  const unlocked = new Map<string, Record<number, Set<number>>>();
  const chars: CharState[] = Object.values(raw.characters?.data ?? {}).map((c) => {
    const eq = raw.characterEquipment?.data?.[c.characterId]?.items ?? [];
    const inv = raw.characterInventories?.data?.[c.characterId]?.items ?? [];
    const subclasses = [...eq.map((i) => ({ i, equipped: true })), ...inv.map((i) => ({ i, equipped: false }))]
      .filter(({ i }) => i.bucketHash === SUBCLASS_BUCKET && i.itemInstanceId)
      .map(({ i, equipped }) => ({ id: i.itemInstanceId!, hash: i.itemHash, equipped }));
    for (const s of subclasses) {
      const plugs = raw.itemComponents?.reusablePlugs?.data?.[s.id]?.plugs;
      if (plugs) unlocked.set(s.id, Object.fromEntries(Object.entries(plugs).map(([k, v]) => [Number(k), new Set(v.filter((p) => p.canInsert && p.enabled).map((p) => p.plugItemHash))])));
    }
    return {
      id: c.characterId,
      cls: c.classType,
      light: c.light,
      emblem: c.emblemPath,
      equipped: new Set(eq.map((i) => i.itemInstanceId).filter((x): x is string => !!x)),
      subclasses,
      loadouts: (raw.characterLoadouts?.data?.[c.characterId]?.loadouts ?? []).map((l) => ({
        colorHash: l.colorHash,
        iconHash: l.iconHash,
        nameHash: l.nameHash,
        empty: !l.items?.some((x) => x.itemInstanceId && x.itemInstanceId !== "0"),
      })),
    };
  });
  return { membershipType: who.membershipType, chars, sockets, unlocked, fetchedAt: Date.now() };
}

export const charFor = (p: BuildProfile | null, cls: number) => p?.chars.find((c) => c.cls === cls) ?? null;
export const subclassInstance = (p: BuildProfile | null, cls: number, hash: number | null) => charFor(p, cls)?.subclasses.find((s) => s.hash === hash) ?? null;

/** Armor mod sockets of one armor piece, as socket indexes: [general, slot, slot, slot]. */
export function modSockets(armorId: string, slot: GearSlot, p: BuildProfile, defs: BuildDefs): number[] {
  const plugs = p.sockets.get(armorId) ?? [];
  const pci = (h: number) => defs.plugs[h]?.c;
  const general = plugs.flatMap((h, i) => (pci(h) === GENERAL_PCI ? [i] : []));
  const slotted = plugs.flatMap((h, i) => (pci(h) === MOD_PCI[slot] ? [i] : []));
  return [general[0] ?? -1, ...slotted.slice(0, MOD_SOCKETS - 1)];
}

/** A character's current gear, subclass setup and mods as a build (for "Import from character" and undo). */
export function captureCharacter(charId: string, p: BuildProfile, ctx: Ctx, name: string): Build {
  const c = p.chars.find((x) => x.id === charId)!;
  const b = newBuild(c.cls, name);
  b.tags = ["Snapshot"];
  for (const id of c.equipped) {
    const it = itemOf(ctx, id);
    if (it && it.slot !== "Unknown" && ([...WEAPON_SLOTS, ...ARMOR_SLOTS] as string[]).includes(it.slot)) b.items[it.slot as BuildSlot] = { id, hash: it.itemHash };
  }
  for (const slot of ARMOR_SLOTS) {
    const id = b.items[slot]?.id;
    if (!id) continue;
    const plugs = p.sockets.get(id) ?? [];
    b.mods[slot] = modSockets(id, slot, p, ctx.defs).map((i) => {
      const h = i >= 0 ? plugs[i] : 0;
      return h && !/^Empty /i.test(ctx.defs.plugs[h]?.n ?? "") ? h : 0;
    });
  }
  const sc = c.subclasses.find((s) => s.equipped);
  const def = sc && ctx.defs.subclasses[sc.hash];
  if (sc && def) {
    b.subclass = def.h;
    b.plugs = defaultPlugs(def);
    (p.sockets.get(sc.id) ?? []).forEach((h, i) => h && i < def.sockets.length && (b.plugs[i] = h));
  }
  return b;
}
