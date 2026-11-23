import { DAMAGE_TYPES as DAMAGE, normalizeName, type Manifest, type ItemDef } from "../bungie/defs.js";
import { bungieUrl } from "../bungie/client.js";
import type { ArmorRecord, ArmorSlot, Catalyst, ClassName, PerkColumn, Vault, WeaponMod, WeaponPlug, WeaponRecord, WeaponSlot } from "./types.js";

/** 309 is each plug's objectives (catalyst kills); 900 the account's records (is a catalyst finished). */
export const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 304, 305, 306, 307, 309, 310, 900];

const WEAPON_BUCKETS: Record<number, WeaponSlot> = { 1498876634: "Kinetic", 2465295065: "Energy", 953998645: "Power" };
const ARMOR_BUCKETS: Record<number, ArmorSlot> = {
  3448274439: "Helmet",
  3551918588: "Arms",
  14239492: "Chest",
  20886954: "Legs",
  1585787867: "Class Item",
};
const POSTMASTER_BUCKET = 215593132;
/** The vault's general bucket: weapons, armor and other gear (not mods or consumables). */
export const VAULT_BUCKET = 138197802;
const CLASSES: Record<number, ClassName> ={ 0: "Titan", 1: "Hunter", 2: "Warlock", 3: "Any" };
const AMMO = { 1: "Primary", 2: "Special", 3: "Heavy" } as const;
/** Bungie's breaker types: the champion a weapon stuns. */
const BREAKER = { 1: "Barrier", 2: "Overload", 3: "Unstoppable" } as const;

export const SOCKET_CATEGORY = { weaponPerks: 4241085061, intrinsic: 3956125808, catalyst: 2685412949 };
const STATE_LOCKED = 1;
const STATE_CRAFTED = 8;

interface RawItem {
  itemHash: number;
  itemInstanceId?: string;
  bucketHash: number;
  state: number;
}
interface RawSocket {
  plugHash?: number;
  isEnabled: boolean;
  isVisible: boolean;
}
interface RawPlug {
  plugItemHash: number;
  canInsert: boolean;
  enabled: boolean;
}

interface RawObjective {
  progress?: number;
  completionValue: number;
  complete: boolean;
}

/** The parts of a GetProfile response the decoder reads. */
export interface RawProfile {
  profile?: { data?: { userInfo: { membershipId: string; membershipType: number } } };
  profileInventory?: { data?: { items: RawItem[] } };
  profileRecords?: { data?: { records: Record<string, { objectives?: RawObjective[] }> } };
  characters?: { data?: Record<string, { classType: number; dateLastPlayed?: string }> };
  characterInventories?: { data?: Record<string, { items: RawItem[] }> };
  characterEquipment?: { data?: Record<string, { items: RawItem[] }> };
  /** Unlocked plugs in shared plug sets (weapon mods among them), by plug set hash (components 306 and 307). */
  profilePlugSets?: { data?: { plugs: Record<string, RawPlug[]> } };
  characterPlugSets?: { data?: Record<string, { plugs: Record<string, RawPlug[]> }> };
  itemComponents?: {
    instances?: { data?: Record<string, { damageType?: number; primaryStat?: { value: number }; gearTier?: number }> };
    stats?: { data?: Record<string, { stats: Record<string, { statHash: number; value: number }> }> };
    sockets?: { data?: Record<string, { sockets: RawSocket[] }> };
    reusablePlugs?: { data?: Record<string, { plugs: Record<string, RawPlug[]> }> };
    plugObjectives?: { data?: Record<string, { objectivesPerPlug: Record<string, RawObjective[]> }> };
  };
}

const rarity = (d: ItemDef) => (d.inventory?.tierType === 6 ? "Exotic" : d.inventory?.tierType === 5 ? "Legendary" : "Other");

function plugName(m: Manifest, hash?: number): string {
  return (hash && m.items[hash]?.displayProperties?.name) || "";
}

/** A plug's name, icon and description, or null for an empty socket. */
function plugOf(m: Manifest, hash?: number): WeaponPlug | null {
  const d = hash ? m.items[hash]?.displayProperties : undefined;
  return d?.name ? { name: d.name, icon: d.icon ? bungieUrl(d.icon) : null, description: d.description ?? "" } : null;
}

const catalystsByName = new WeakMap<Manifest, Map<string, number>>();
/** Weapon names are looser than their records ("Whisper Catalyst" for Whisper of the Worm): the record's words must run together in the weapon's name. */
const wordsOf = (s: string) => normalizeName(s).split(" ").filter((w) => w !== "the");
const runsIn = (rec: string[], weapon: string[]) => rec.length > 0 && weapon.some((_, i) => rec.every((w, j) => weapon[i + j] === w));
/** Most catalysts only say they upgrade the weapon to a masterwork; that is not worth showing as a description. */
const GENERIC_CATALYST = /masterwork|catalyst can be inserted/i;

/**
 * A weapon's exotic catalysts: the ones in its catalyst socket (inserted, or offered), else the record named after it.
 * It's acquired when the socket holds it; it's finished when the plug's or record's objectives are all done.
 */
function catalystsOf(m: Manifest, raw: RawProfile, id: string, weaponName: string, def: ItemDef, sockets: RawSocket[], reusable: Record<string, RawPlug[]>): Catalyst[] {
  const idxs = def.sockets?.socketCategories?.find((c) => c.socketCategoryHash === SOCKET_CATEGORY.catalyst)?.socketIndexes ?? [];
  if (!idxs.length) return [];
  let byName = catalystsByName.get(m);
  if (!byName) catalystsByName.set(m, (byName = new Map(Object.values(m.records ?? {}).map((r) => [r.displayProperties.name, r.hash]))));
  const plugObj = raw.itemComponents?.plugObjectives?.data?.[id]?.objectivesPerPlug ?? {};
  const out = new Map<string, Catalyst>();
  const add = (name: string, plugHash: number | undefined, acquired: boolean) => {
    const recHash = byName!.get(name);
    const rec = recHash ? m.records?.[recHash] : undefined;
    const plug = plugHash ? m.items[plugHash]?.displayProperties : undefined;
    // The record knows best whether it's finished; the plug's own objectives stand in when it has no record.
    const objs = (recHash && raw.profileRecords?.data?.records[recHash]?.objectives) || plugObj[String(plugHash)] || [];
    const open = objs.filter((o) => !o.complete).map((o) => ({ cur: o.progress ?? 0, max: o.completionValue }));
    const desc = plug?.description ?? "";
    out.set(name, {
      name,
      icon: (icon => (icon ? bungieUrl(icon) : null))(rec?.displayProperties.icon ?? plug?.icon),
      description: desc && !GENERIC_CATALYST.test(desc.split(/\n/)[0]) ? desc : "",
      ...(rec?.displayProperties.description ? { unlock: rec.displayProperties.description } : {}),
      ...(rec?.source ? { source: rec.source } : {}),
      acquired,
      ...(acquired && open.length ? { progress: open } : {}),
    });
  };
  for (const i of idxs) {
    const active = sockets[i]?.plugHash;
    for (const h of [active, ...(reusable[String(i)] ?? []).map((p) => p.plugItemHash)]) {
      const n = plugName(m, h);
      if (h && /Catalyst$/.test(n) && !out.has(n)) add(n, h, h === active);
    }
  }
  if (!out.size) {
    // The socket is empty and offers nothing (Bungie leaves that out for catalysts you haven't earned): find the record by the weapon's name.
    const w = wordsOf(weaponName);
    for (const r of Object.values(m.records ?? {})) if (runsIn(wordsOf(r.displayProperties.name.replace(/ Catalyst$/, "")), w)) add(r.displayProperties.name, undefined, false);
  }
  return [...out.values()];
}

function isEnhanced(m: Manifest, hash: number): boolean {
  return /enhanced/i.test(m.items[hash]?.itemTypeDisplayName ?? "");
}

function classifySocket(pci: string): PerkColumn["kind"] | "skip" | "barrelOrMag" {
  if (pci === "origins") return "origin";
  if (pci === "frames") return "perk1"; // first trait column; the second becomes perk2
  if (/intrinsic|masterwork|tracker|shader|skin|mod|memento|ornament|empty/.test(pci)) return "skip";
  return "barrelOrMag";
}

export function decodeProfile(raw: RawProfile, m: Manifest): Vault {
  const user = raw.profile?.data?.userInfo;
  const chars = raw.characters?.data ?? {};
  const instances = raw.itemComponents?.instances?.data ?? {};
  const statsC = raw.itemComponents?.stats?.data ?? {};
  const socketsC = raw.itemComponents?.sockets?.data ?? {};
  const plugsC = raw.itemComponents?.reusablePlugs?.data ?? {};
  type Champ = "Barrier" | "Overload" | "Unstoppable";
  /** Every champion a weapon stuns: from its frame or exotic trait (intrinsic plugs), and its own definition. */
  const championsOf = (def: ItemDef, plugHashes: (number | undefined)[]): Champ[] => {
    const all = [...plugHashes.map((h) => m.items[h ?? 0]?.breakerType), def.breakerType].map((b) => BREAKER[(b ?? 0) as 1 | 2 | 3]);
    return [...new Set(all.filter((c): c is Champ => !!c))];
  };
  // A plug set's unlocked plugs: the account's, plus any a character has on its own.
  const plugSet = (hash?: number): RawPlug[] => !hash ? [] : [
    ...(raw.profilePlugSets?.data?.plugs[hash] ?? []),
    ...Object.values(raw.characterPlugSets?.data ?? {}).flatMap((c) => c.plugs[hash] ?? []),
  ];

  const located: { item: RawItem; where: string; equipped: boolean; postmaster?: boolean }[] = [];
  for (const it of raw.profileInventory?.data?.items ?? []) located.push({ item: it, where: "vault", equipped: false });
  // A character's inventory also holds its postmaster (Lost Items). Those items aren't in its slots until they're
  // pulled, so they're flagged: counting them as carried filled the Vault page with items the game doesn't show there.
  for (const [cid, inv] of Object.entries(raw.characterInventories?.data ?? {}))
    for (const it of inv.items) located.push({ item: it, where: cid, equipped: false, postmaster: it.bucketHash === POSTMASTER_BUCKET || undefined });
  for (const [cid, inv] of Object.entries(raw.characterEquipment?.data ?? {}))
    for (const it of inv.items) located.push({ item: it, where: cid, equipped: true });

  const weapons: WeaponRecord[] = [];
  const armor: ArmorRecord[] = [];
  const statIcons: Record<string, string> = {};

  for (const { item, where, equipped, postmaster } of located) {
    const id = item.itemInstanceId;
    const def = m.items[item.itemHash];
    if (!id || !def) continue;
    const inst = instances[id] ?? {};
    const sockets = socketsC[id]?.sockets ?? [];
    const reusable = plugsC[id]?.plugs ?? {};
    const name = def.displayProperties.name;
    const bucket = def.inventory?.bucketTypeHash ?? 0;

    if (def.itemType === 3) {
      const columns: PerkColumn[] = [];
      let frame = "";
      let intrinsic: WeaponPlug | null = null;
      let masterwork: string | null = null;
      const mods: WeaponMod[] = [];
      const cats = def.sockets?.socketCategories ?? [];
      const intrinsicIdx = cats.find((c) => c.socketCategoryHash === SOCKET_CATEGORY.intrinsic)?.socketIndexes ?? [];
      for (const i of intrinsicIdx) if (!frame) { frame = plugName(m, sockets[i]?.plugHash); intrinsic = plugOf(m, sockets[i]?.plugHash); }
      const perkIdx = cats.find((c) => c.socketCategoryHash === SOCKET_CATEGORY.weaponPerks)?.socketIndexes ?? [];
      let traits = 0;
      let parts = 0;
      for (const i of perkIdx) {
        const active = sockets[i]?.plugHash;
        if (!active || sockets[i]?.isVisible === false) continue;
        const pci = m.items[active]?.plug?.plugCategoryIdentifier ?? "";
        const cls = classifySocket(pci);
        if (cls === "skip") continue;
        const optionHashes = (reusable[String(i)] ?? []).filter((p) => p.canInsert !== false).map((p) => p.plugItemHash);
        if (!optionHashes.includes(active)) optionHashes.unshift(active);
        let kind: PerkColumn["kind"];
        if (cls === "perk1") kind = traits++ === 0 ? "perk1" : traits === 2 ? "perk2" : "other";
        else if (cls === "barrelOrMag") kind = parts++ === 0 ? "barrel" : parts === 2 ? "magazine" : "other";
        else kind = cls;
        columns.push({
          kind,
          active: plugName(m, active),
          options: optionHashes.map((h) => plugName(m, h)).filter(Boolean),
          enhanced: optionHashes.filter((h) => isEnhanced(m, h)).map((h) => plugName(m, h)),
          icons: Object.fromEntries(optionHashes.filter((h) => plugName(m, h) && m.items[h]?.displayProperties?.icon).map((h) => [plugName(m, h), bungieUrl(m.items[h].displayProperties.icon)])),
          descriptions: Object.fromEntries(optionHashes.map((h) => [plugName(m, h), m.items[h]?.displayProperties?.description ?? ""]).filter(([n, d]) => n && d)),
          socket: i,
          hashes: Object.fromEntries(optionHashes.map((h) => [plugName(m, h), h] as const).filter(([n]) => n)),
        });
      }
      sockets.forEach((s, i) => {
        const pci = s.plugHash ? m.items[s.plugHash]?.plug?.plugCategoryIdentifier ?? "" : "";
        if (/masterworks\.stat/.test(pci)) {
          const n = plugName(m, s.plugHash);
          masterwork = n.includes(":") ? n.split(":").pop()!.trim() : n || null;
        }
        const plug = /masterworks\.stat|weapon\.mod_/.test(pci) && s.isVisible !== false ? plugOf(m, s.plugHash) : null;
        if (!plug) return;
        if (/masterworks/.test(pci)) return void mods.push({ ...plug, kind: "masterwork" });
        // The mods that fit: this copy's own list when Bungie sends one, else the socket's shared plug set (unlocked ones only).
        const entry = def.sockets?.socketEntries?.[i];
        const own = reusable[String(i)] ?? [];
        const avail = own.length ? own : plugSet(entry?.reusablePlugSetHash ?? entry?.randomizedPlugSetHash);
        const seen = new Set<number>();
        const options = avail
          .filter((p) => p.canInsert !== false && p.enabled !== false && /weapon\.mod_/.test(m.items[p.plugItemHash]?.plug?.plugCategoryIdentifier ?? ""))
          .flatMap((p) => { const o = plugOf(m, p.plugItemHash); return o && !seen.has(p.plugItemHash) && seen.add(p.plugItemHash) ? [{ ...o, hash: p.plugItemHash }] : []; });
        mods.push({ ...plug, kind: "mod", socket: i, options: options.length ? options : undefined });
      });
      // Live stats first; the base stats fill in what the live data leaves out.
      const stats: Record<string, number> = {};
      for (const st of Object.values(statsC[id]?.stats ?? {})) {
        const n = m.stats[st.statHash]?.displayProperties?.name;
        if (n) stats[n] = st.value;
      }
      const baseStats: string[] = [];
      for (const st of Object.values(def.stats?.stats ?? {})) {
        const n = m.stats[st.statHash]?.displayProperties?.name;
        if (n && !(n in stats)) { stats[n] = st.value; baseStats.push(n); }
      }
      const catalysts = rarity(def) === "Exotic" ? catalystsOf(m, raw, id, name, def, sockets, reusable) : [];
      weapons.push({
        kind: "weapon",
        instanceId: id,
        itemHash: item.itemHash,
        name,
        type: def.itemTypeDisplayName ?? "Weapon",
        frame,
        element: DAMAGE[inst.damageType ?? def.defaultDamageType ?? 0] ?? "Unknown",
        slot: WEAPON_BUCKETS[bucket] ?? "Unknown",
        ammo: AMMO[(def.equippingBlock?.ammoType ?? 0) as 1 | 2 | 3] ?? "Unknown",
        champions: championsOf(def, intrinsicIdx.map((i) => sockets[i]?.plugHash)),
        rarity: rarity(def),
        gearTier: inst.gearTier ?? null,
        power: inst.primaryStat?.value ?? null,
        locked: (item.state & STATE_LOCKED) !== 0,
        crafted: (item.state & STATE_CRAFTED) !== 0,
        adept: /\((adept|timelost|harrowed)\)/i.test(name),
        columns,
        masterwork,
        stats,
        baseStats,
        intrinsic,
        mods,
        ...(catalysts.length ? { catalysts } : {}),
        icon: bungieUrl(def.displayProperties.icon),
        screenshot: def.screenshot ? bungieUrl(def.screenshot) : null,
        location: { where, equipped, ...(postmaster ? { postmaster } : {}) },
      });
    } else if (def.itemType === 2 && ARMOR_BUCKETS[bucket]) {
      const stats: Record<string, number> = {};
      for (const s of Object.values(statsC[id]?.stats ?? {})) {
        const d = m.stats[s.statHash]?.displayProperties, n = d?.name;
        if (n) stats[n] = s.value;
        if (n && d?.icon) statIcons[n] ??= bungieUrl(d.icon);
      }
      let archetype: string | null = null;
      for (const s of sockets) {
        const pci = s.plugHash ? m.items[s.plugHash]?.plug?.plugCategoryIdentifier ?? "" : "";
        if (/archetype/i.test(pci)) archetype = plugName(m, s.plugHash) || null;
      }
      // An exotic's trait is its intrinsic plug.
      // (Exotics carry several empty "intrinsics" sockets, so take the first one with a name.)
      const trait = rarity(def) === "Exotic" ? sockets.map((s) => (m.items[s.plugHash ?? 0]?.plug?.plugCategoryIdentifier === "intrinsics" ? plugOf(m, s.plugHash) : null)).find(Boolean) ?? null : null;
      const setHash = def.equippingBlock?.equipableItemSetHash;
      armor.push({
        kind: "armor",
        instanceId: id,
        itemHash: item.itemHash,
        name,
        classType: CLASSES[def.classType ?? 3] ?? "Any",
        slot: ARMOR_BUCKETS[bucket],
        rarity: rarity(def),
        gearTier: inst.gearTier ?? null,
        power: inst.primaryStat?.value ?? null,
        stats,
        statTotal: Object.values(stats).reduce((a, b) => a + b, 0),
        archetype,
        trait,
        setName: setHash ? m.itemSets[setHash]?.displayProperties?.name ?? null : null,
        legacy: archetype === null,
        locked: (item.state & STATE_LOCKED) !== 0,
        icon: bungieUrl(def.displayProperties.icon),
        location: { where, equipped, ...(postmaster ? { postmaster } : {}) },
      });
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    membershipId: user?.membershipId ?? "",
    membershipType: user?.membershipType ?? 0,
    // Most recently played first, as the game and DIM list them.
    characters: Object.entries(chars)
      .sort(([, a], [, b]) => (b.dateLastPlayed ?? "").localeCompare(a.dateLastPlayed ?? ""))
      .map(([id, c]) => ({ id, className: CLASSES[c.classType] ?? "Any" })),
    weapons,
    armor,
    statIcons,
    space: { used: (raw.profileInventory?.data?.items ?? []).filter((i) => i.bucketHash === VAULT_BUCKET).length, capacity: null },
  };
}
