import { bungie, BungieError } from "./client.js";
import { currentVault } from "../vault/fetch.js";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Bungie throttles item actions; wait and retry like DIM does. */
async function action(path, body) {
    for (let attempt = 0;; attempt++) {
        try {
            return await bungie(path, { body });
        }
        catch (e) {
            const throttle = e instanceof BungieError && (e.throttleSeconds > 0 || /throttl/i.test(e.errorStatus));
            if (!throttle || attempt >= 4)
                throw e;
            await sleep(Math.max(1, e.throttleSeconds) * 1000 * (attempt + 1));
        }
    }
}
const friendly = (e) => {
    const m = e.message;
    if (/NoRoomInDestination|DestinyNoRoom/i.test(m))
        return "No room there. Make space on the character (or in the vault) and try again.";
    if (/ItemNotFound/i.test(m))
        return "Bungie can't find the item where expected. Re-rate to refresh your vault and try again.";
    if (/CannotPerformActionAtThisLocation|ActionOnlyInGame|ClientMustBeInGame/i.test(m))
        return "Bungie won't allow that right now (for example mid-activity). Try from orbit or the Tower.";
    return m;
};
/** Resolve "vault", a character id, or a class name ("Hunter") to a destination. */
export function resolveTarget(vault, to) {
    if (to.toLowerCase() === "vault")
        return "vault";
    const byId = vault.characters.find((c) => c.id === to);
    if (byId)
        return byId.id;
    const byClass = vault.characters.find((c) => c.className.toLowerCase() === to.toLowerCase());
    if (byClass)
        return byClass.id;
    throw new Error(`No character "${to}". Use vault, Titan, Hunter or Warlock.`);
}
/**
 * Pull items to a character (or send them to the vault), optionally equipping them.
 * Equipped items are never moved: Bungie requires equipping something else first.
 */
export async function moveItems(ids, to, opts = {}) {
    const vault = await currentVault();
    const target = resolveTarget(vault, to);
    const targetClass = vault.characters.find((c) => c.id === target)?.className;
    const byId = new Map([...vault.weapons, ...vault.armor].map((x) => [x.instanceId, x]));
    const results = [];
    const toEquip = [];
    for (const id of ids) {
        const item = byId.get(id);
        if (!item) {
            results.push({ id, name: id, ok: false, where: "", equipped: false, error: "Not in your vault or on a character (re-rate to refresh)." });
            continue;
        }
        const res = { id, name: item.name, ok: true, where: item.location.where, equipped: item.location.equipped };
        results.push(res);
        try {
            if (item.kind === "armor" && target !== "vault" && item.classType !== "Any" && item.classType !== targetClass)
                throw new Error(`${item.classType} armor can't go to your ${targetClass}.`);
            if (item.location.where !== target) {
                if (item.location.equipped)
                    throw new Error(`Equipped on your ${vault.characters.find((c) => c.id === item.location.where)?.className ?? "character"}. Equip something else there first.`);
                if (item.location.where !== "vault") {
                    await action("/Destiny2/Actions/Items/TransferItem/", {
                        itemReferenceHash: item.itemHash, stackSize: 1, transferToVault: true, itemId: id, characterId: item.location.where, membershipType: vault.membershipType,
                    });
                    item.location = { where: "vault", equipped: false };
                    await sleep(opts.delayMs ?? 150);
                }
                if (target !== "vault") {
                    await action("/Destiny2/Actions/Items/TransferItem/", {
                        itemReferenceHash: item.itemHash, stackSize: 1, transferToVault: false, itemId: id, characterId: target, membershipType: vault.membershipType,
                    });
                    item.location = { where: target, equipped: false };
                    await sleep(opts.delayMs ?? 150);
                }
                res.where = item.location.where;
                res.equipped = false;
            }
            if (opts.equip && target !== "vault" && !item.location.equipped)
                toEquip.push(id);
        }
        catch (e) {
            res.ok = false;
            res.error = friendly(e);
            res.where = item.location.where;
        }
    }
    if (toEquip.length && target !== "vault") {
        try {
            const r = (await action("/Destiny2/Actions/Items/EquipItems/", { itemIds: toEquip, characterId: target, membershipType: vault.membershipType }));
            for (const er of r.equipResults ?? []) {
                const res = results.find((x) => x.id === er.itemInstanceId);
                if (er.equipStatus === 1) {
                    // Whatever was equipped in that slot before is now just in the inventory.
                    const item = byId.get(er.itemInstanceId);
                    for (const other of byId.values())
                        if (other !== item && other.location.where === target && other.location.equipped && sameSlot(other, item))
                            other.location = { where: target, equipped: false };
                    item.location = { where: target, equipped: true };
                    res.equipped = true;
                }
                else {
                    res.error = `Moved, but Bungie wouldn't equip it (code ${er.equipStatus}; usually a second exotic or the wrong class).`;
                }
            }
        }
        catch (e) {
            for (const id of toEquip)
                results.find((x) => x.id === id).error = `Moved, but equipping failed: ${friendly(e)}`;
        }
    }
    return results;
}
const sameSlot = (a, b) => a.kind === b.kind && a.slot === b.slot;
//# sourceMappingURL=transfer.js.map