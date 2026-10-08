import { bungieUrl } from "../bungie/client.js";
export const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 304, 305, 310];
const DAMAGE = { 1: "Kinetic", 2: "Arc", 3: "Solar", 4: "Void", 6: "Stasis", 7: "Strand" };
const WEAPON_BUCKETS = { 1498876634: "Kinetic", 2465295065: "Energy", 953998645: "Power" };
const ARMOR_BUCKETS = {
    3448274439: "Helmet",
    3551918588: "Arms",
    14239492: "Chest",
    20886954: "Legs",
    1585787867: "Class Item",
};
const CLASSES = { 0: "Titan", 1: "Hunter", 2: "Warlock", 3: "Any" };
const AMMO = { 1: "Primary", 2: "Special", 3: "Heavy" };
export const SOCKET_CATEGORY = { weaponPerks: 4241085061, intrinsic: 3956125808 };
const STATE_LOCKED = 1;
const STATE_CRAFTED = 8;
const rarity = (d) => (d.inventory?.tierType === 6 ? "Exotic" : d.inventory?.tierType === 5 ? "Legendary" : "Other");
function plugName(m, hash) {
    return (hash && m.items[hash]?.displayProperties?.name) || "";
}
function isEnhanced(m, hash) {
    return /enhanced/i.test(m.items[hash]?.itemTypeDisplayName ?? "");
}
function classifySocket(pci) {
    if (pci === "origins")
        return "origin";
    if (pci === "frames")
        return "perk1"; // first trait column; the second becomes perk2
    if (/intrinsic|masterwork|tracker|shader|skin|mod|memento|ornament|empty/.test(pci))
        return "skip";
    return "barrelOrMag";
}
export function decodeProfile(raw, m) {
    const user = raw.profile?.data?.userInfo;
    const chars = raw.characters?.data ?? {};
    const instances = raw.itemComponents?.instances?.data ?? {};
    const statsC = raw.itemComponents?.stats?.data ?? {};
    const socketsC = raw.itemComponents?.sockets?.data ?? {};
    const plugsC = raw.itemComponents?.reusablePlugs?.data ?? {};
    const located = [];
    for (const it of raw.profileInventory?.data?.items ?? [])
        located.push({ item: it, where: "vault", equipped: false });
    for (const [cid, inv] of Object.entries(raw.characterInventories?.data ?? {}))
        for (const it of inv.items)
            located.push({ item: it, where: cid, equipped: false });
    for (const [cid, inv] of Object.entries(raw.characterEquipment?.data ?? {}))
        for (const it of inv.items)
            located.push({ item: it, where: cid, equipped: true });
    const weapons = [];
    const armor = [];
    for (const { item, where, equipped } of located) {
        const id = item.itemInstanceId;
        const def = m.items[item.itemHash];
        if (!id || !def)
            continue;
        const inst = instances[id] ?? {};
        const sockets = socketsC[id]?.sockets ?? [];
        const reusable = plugsC[id]?.plugs ?? {};
        const name = def.displayProperties.name;
        const bucket = def.inventory?.bucketTypeHash ?? 0;
        if (def.itemType === 3) {
            const columns = [];
            let frame = "";
            let masterwork = null;
            const cats = def.sockets?.socketCategories ?? [];
            const intrinsicIdx = cats.find((c) => c.socketCategoryHash === SOCKET_CATEGORY.intrinsic)?.socketIndexes ?? [];
            for (const i of intrinsicIdx)
                frame ||= plugName(m, sockets[i]?.plugHash);
            const perkIdx = cats.find((c) => c.socketCategoryHash === SOCKET_CATEGORY.weaponPerks)?.socketIndexes ?? [];
            let traits = 0;
            let parts = 0;
            for (const i of perkIdx) {
                const active = sockets[i]?.plugHash;
                if (!active || sockets[i]?.isVisible === false)
                    continue;
                const pci = m.items[active]?.plug?.plugCategoryIdentifier ?? "";
                const cls = classifySocket(pci);
                if (cls === "skip")
                    continue;
                const optionHashes = (reusable[String(i)] ?? []).filter((p) => p.canInsert !== false).map((p) => p.plugItemHash);
                if (!optionHashes.includes(active))
                    optionHashes.unshift(active);
                let kind;
                if (cls === "perk1")
                    kind = traits++ === 0 ? "perk1" : traits === 2 ? "perk2" : "other";
                else if (cls === "barrelOrMag")
                    kind = parts++ === 0 ? "barrel" : parts === 2 ? "magazine" : "other";
                else
                    kind = cls;
                columns.push({
                    kind,
                    active: plugName(m, active),
                    options: optionHashes.map((h) => plugName(m, h)).filter(Boolean),
                    enhanced: optionHashes.filter((h) => isEnhanced(m, h)).map((h) => plugName(m, h)),
                });
            }
            for (const s of sockets) {
                const pci = s.plugHash ? m.items[s.plugHash]?.plug?.plugCategoryIdentifier ?? "" : "";
                if (/masterworks\.stat/.test(pci)) {
                    const n = plugName(m, s.plugHash);
                    masterwork = n.includes(":") ? n.split(":").pop().trim() : n || null;
                }
            }
            weapons.push({
                kind: "weapon",
                instanceId: id,
                itemHash: item.itemHash,
                name,
                type: def.itemTypeDisplayName ?? "Weapon",
                frame,
                element: DAMAGE[inst.damageType ?? def.defaultDamageType ?? 0] ?? "Unknown",
                slot: WEAPON_BUCKETS[bucket] ?? "Unknown",
                ammo: AMMO[(def.equippingBlock?.ammoType ?? 0)] ?? "Unknown",
                rarity: rarity(def),
                gearTier: inst.gearTier ?? null,
                power: inst.primaryStat?.value ?? null,
                locked: (item.state & STATE_LOCKED) !== 0,
                crafted: (item.state & STATE_CRAFTED) !== 0,
                adept: /\((adept|timelost|harrowed)\)/i.test(name),
                columns,
                masterwork,
                icon: bungieUrl(def.displayProperties.icon),
                screenshot: def.screenshot ? bungieUrl(def.screenshot) : null,
                location: { where, equipped },
            });
        }
        else if (def.itemType === 2 && ARMOR_BUCKETS[bucket]) {
            const stats = {};
            for (const s of Object.values(statsC[id]?.stats ?? {})) {
                const n = m.stats[s.statHash]?.displayProperties?.name;
                if (n)
                    stats[n] = s.value;
            }
            let archetype = null;
            for (const s of sockets) {
                const pci = s.plugHash ? m.items[s.plugHash]?.plug?.plugCategoryIdentifier ?? "" : "";
                if (/archetype/i.test(pci))
                    archetype = plugName(m, s.plugHash) || null;
            }
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
                stats,
                statTotal: Object.values(stats).reduce((a, b) => a + b, 0),
                archetype,
                setName: setHash ? m.itemSets[setHash]?.displayProperties?.name ?? null : null,
                legacy: archetype === null,
                locked: (item.state & STATE_LOCKED) !== 0,
                icon: bungieUrl(def.displayProperties.icon),
                location: { where, equipped },
            });
        }
    }
    return {
        fetchedAt: new Date().toISOString(),
        membershipId: user?.membershipId ?? "",
        membershipType: user?.membershipType ?? 0,
        characters: Object.entries(chars).map(([id, c]) => ({ id, className: CLASSES[c.classType] ?? "Any" })),
        weapons,
        armor,
    };
}
//# sourceMappingURL=decode.js.map