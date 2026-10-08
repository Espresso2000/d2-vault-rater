import { bungie, bungieUrl } from "../bungie/client.js";
import { primaryMembership } from "../bungie/oauth.js";
const MODES = [
    ["raid", 4, "Raids", false],
    ["dungeon", 82, "Dungeons", false],
    ["allStrikes", 18, "Strikes", false],
    ["scored_nightfall", 46, "Nightfalls", false],
    ["story", 2, "Story", false],
    ["patrol", 6, "Patrol", false],
    ["pvecomp_gambit", 63, "Gambit", true],
    ["allPvP", 5, "Crucible", true],
    ["trials_of_osiris", 84, "Trials of Osiris", true],
    ["ironBanner", 19, "Iron Banner", true],
];
const CLASSES = { 0: "Titan", 1: "Hunter", 2: "Warlock" };
const TYPE_LABELS = {
    AutoRifle: "Auto Rifle", BeamRifle: "Trace Rifle", Bow: "Bow", Glaive: "Glaive", FusionRifle: "Fusion Rifle",
    HandCannon: "Hand Cannon", TraceRifle: "Linear Fusion Rifle", MachineGun: "Machine Gun", PulseRifle: "Pulse Rifle",
    RocketLauncher: "Rocket Launcher", ScoutRifle: "Scout Rifle", Shotgun: "Shotgun", Sniper: "Sniper Rifle",
    Submachinegun: "Submachine Gun", SideArm: "Sidearm", Sword: "Sword", GrenadeLauncher: "Grenade Launcher",
};
const numbers = (b) => (b ? Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.basic.value])) : null);
/** Display name without the Bungie code: "Espresso-6" or "Espresso#1234" becomes "Espresso". */
export const shortName = (n) => n.replace(/(\s*[#-]\d+)+$/, "").trim() || n;
export async function fetchWrapped(m) {
    const who = await primaryMembership();
    const base = `/Destiny2/${who.membershipType}`;
    const out = { name: shortName(who.displayName), characters: [], pve: null, pvp: null, bestTypePve: null, weaponTypeKills: [], topWeapons: [], modes: [], triumphs: null, titles: [] };
    try {
        const me = await bungie("/User/GetMembershipsForCurrentUser/");
        out.name = shortName(me.bungieNetUser.uniqueName || me.bungieNetUser.displayName || out.name);
    }
    catch { }
    let charIds = [];
    try {
        const p = await bungie(`${base}/Profile/${who.membershipId}/?components=200,900`);
        charIds = Object.keys(p.characters.data);
        const rec = p.profileRecords?.data;
        if (rec)
            out.triumphs = { active: rec.activeScore, lifetime: rec.lifetimeScore, legacy: rec.legacyScore };
        for (const c of Object.values(p.characters.data)) {
            if (!c.titleRecordHash)
                continue;
            try {
                const r = await bungie(`/Destiny2/Manifest/DestinyRecordDefinition/${c.titleRecordHash}/`, { auth: false });
                const t = r.titleInfo?.titlesByGender && Object.values(r.titleInfo.titlesByGender)[0];
                if (t)
                    out.titles.push({ className: CLASSES[c.classType] ?? "Guardian", title: t });
            }
            catch { }
        }
        out.characters = Object.values(p.characters.data).map((c) => ({
            className: CLASSES[c.classType] ?? "Guardian",
            minutes: Number(c.minutesPlayedTotal) || 0,
            light: c.light,
            lastPlayed: c.dateLastPlayed,
            emblem: bungieUrl(c.emblemBackgroundPath),
        }));
    }
    catch { }
    try {
        const s = await bungie(`${base}/Account/${who.membershipId}/Stats/?groups=1`);
        const pve = s.mergedAllCharacters.results.allPvE?.allTime;
        out.pve = numbers(pve);
        out.pvp = numbers(s.mergedAllCharacters.results.allPvP?.allTime);
        out.bestTypePve = pve?.weaponBestType?.basic.displayValue ?? null;
        if (out.pve) {
            out.weaponTypeKills = Object.entries(TYPE_LABELS)
                .map(([k, type]) => ({ type, kills: out.pve[`weaponKills${k}`] ?? 0, precision: out.pve[`weaponPrecisionKills${k}`] ?? 0 }))
                .filter((t) => t.kills > 0)
                .sort((a, b) => b.kills - a.kills);
        }
    }
    catch { }
    try {
        const s = await bungie(`${base}/Account/${who.membershipId}/Character/0/Stats/?groups=1&modes=${MODES.map((x) => x[1]).join(",")}`);
        for (const [key, , label, pvp] of MODES) {
            const stats = numbers(s[key]?.allTime);
            if (stats && (stats.activitiesEntered ?? 0) > 0)
                out.modes.push({ key, label, pvp, stats });
        }
    }
    catch { }
    // Per-weapon kill counts (Bungie tracks these for exotics) merged across characters.
    const kills = new Map();
    for (const cid of charIds) {
        try {
            const u = await bungie(`${base}/Account/${who.membershipId}/Character/${cid}/Stats/UniqueWeapons/`);
            for (const w of u.weapons ?? []) {
                const cur = kills.get(w.referenceId) ?? { kills: 0, precision: 0 };
                cur.kills += w.values.uniqueWeaponKills?.basic.value ?? 0;
                cur.precision += w.values.uniqueWeaponPrecisionKills?.basic.value ?? 0;
                kills.set(w.referenceId, cur);
            }
        }
        catch { }
    }
    out.topWeapons = [...kills]
        .map(([hash, k]) => ({ hash, def: m.items[hash], ...k }))
        .filter((w) => w.def && w.kills > 0)
        .sort((a, b) => b.kills - a.kills)
        .slice(0, 10)
        .map((w) => ({ hash: w.hash, name: w.def.displayProperties.name, type: w.def.itemTypeDisplayName ?? "", icon: bungieUrl(w.def.displayProperties.icon), kills: w.kills, precision: w.precision }));
    return out;
}
//# sourceMappingURL=wrapped.js.map