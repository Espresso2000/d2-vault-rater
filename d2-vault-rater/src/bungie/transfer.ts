import { bungie } from "./client.js";
import { retryThrottled, sleep } from "./errors.js";
import { currentVault } from "../vault/fetch.js";
import type { ArmorRecord, Vault, WeaponRecord } from "../vault/types.js";

/**
 * Move items between the vault and characters, and equip them, through Bungie's item actions
 * (needs the "Move or equip your gear" scope). Character to character goes through the vault.
 */

export interface MoveResult {
  id: string;
  name: string;
  ok: boolean;
  /** Where the item is now: "vault" or a character id. */
  where: string;
  equipped: boolean;
  /** It was in the postmaster and has been pulled into its character's inventory. */
  pulled?: boolean;
  error?: string;
}

/** An item action (move, equip, insert plug...), retried while Bungie throttles it. */
export const action = (path: string, body: Record<string, unknown>): Promise<unknown> => retryThrottled(() => bungie(path, { body }));
const sendAction = action;

const friendly = (e: unknown): string => {
  const m = (e as Error).message;
  if (/NoRoomInDestination|DestinyNoRoom/i.test(m)) return "No room there. Make space on the character (or in the vault) and try again.";
  if (/ItemNotFound/i.test(m)) return "Bungie can't find the item where expected. Re-rate to refresh your vault and try again.";
  if (/CannotPerformActionAtThisLocation|ActionOnlyInGame|ClientMustBeInGame|NotInTower|SocialSpace/i.test(m)) return "Bungie won't allow that right now (for example mid-activity). Try from orbit or the Tower.";
  if (/SocketAction|PlugNotFree|InvalidPlug|PlugSet|PlugUnavailable|ItemActionForbidden|NotAllowed/i.test(m)) return `Bungie won't make that switch from outside the game (it may not be unlocked, or not free to change). ${m}`;
  return m;
};

/** Resolve "vault", a character id, or a class name ("Hunter") to a destination. */
export function resolveTarget(vault: Vault, to: string): string {
  if (to.toLowerCase() === "vault") return "vault";
  const byId = vault.characters.find((c) => c.id === to);
  if (byId) return byId.id;
  const byClass = vault.characters.find((c) => c.className.toLowerCase() === to.toLowerCase());
  if (byClass) return byClass.id;
  throw new Error(`No character "${to}". Use vault, Titan, Hunter or Warlock.`);
}

/**
 * Pull items to a character (or send them to the vault), optionally equipping them.
 * Equipped items are never moved: Bungie requires equipping something else first.
 */
export async function moveItems(ids: string[], to: string, opts: { equip?: boolean; delayMs?: number; vault?: Vault; send?: typeof action } = {}): Promise<MoveResult[]> {
  const vault = opts.vault ?? (await currentVault());
  const action = opts.send ?? sendAction;
  const target = resolveTarget(vault, to);
  const targetClass = vault.characters.find((c) => c.id === target)?.className;
  const byId = new Map<string, WeaponRecord | ArmorRecord>([...vault.weapons, ...vault.armor].map((x) => [x.instanceId, x]));
  const results: MoveResult[] = [];
  const toEquip: string[] = [];

  for (const id of ids) {
    const item = byId.get(id);
    if (!item) {
      results.push({ id, name: id, ok: false, where: "", equipped: false, error: "Not in your vault or on a character (re-rate to refresh)." });
      continue;
    }
    const res: MoveResult = { id, name: item.name, ok: true, where: item.location.where, equipped: item.location.equipped };
    results.push(res);
    try {
      if (item.kind === "armor" && target !== "vault" && item.classType !== "Any" && item.classType !== targetClass)
        throw new Error(`${item.classType} armor can't go to your ${targetClass}.`);
      // Lost Items first come out of the postmaster into their own character's inventory, then move on as usual.
      if (item.location.postmaster) {
        await action("/Destiny2/Actions/Items/PullFromPostmaster/", {
          itemReferenceHash: item.itemHash, stackSize: 1, itemId: id, characterId: item.location.where, membershipType: vault.membershipType,
        });
        item.location = { where: item.location.where, equipped: false };
        res.pulled = true;
        await sleep(opts.delayMs ?? 150);
      }
      if (item.location.where !== target) {
        if (item.location.equipped) throw new Error(`Equipped on your ${vault.characters.find((c) => c.id === item.location.where)?.className ?? "character"}. Equip something else there first.`);
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
      if (opts.equip && target !== "vault" && !item.location.equipped) toEquip.push(id);
    } catch (e) {
      res.ok = false;
      res.error = friendly(e);
      res.where = item.location.where;
    }
  }

  if (toEquip.length && target !== "vault") {
    try {
      const r = (await action("/Destiny2/Actions/Items/EquipItems/", { itemIds: toEquip, characterId: target, membershipType: vault.membershipType })) as {
        equipResults?: { itemInstanceId: string; equipStatus: number }[];
      };
      for (const er of r.equipResults ?? []) {
        const res = results.find((x) => x.id === er.itemInstanceId)!;
        if (er.equipStatus === 1) {
          // Whatever was equipped in that slot before is now just in the inventory.
          const item = byId.get(er.itemInstanceId)!;
          for (const other of byId.values())
            if (other !== item && other.location.where === target && other.location.equipped && sameSlot(other, item)) other.location = { where: target, equipped: false };
          item.location = { where: target, equipped: true };
          res.equipped = true;
        } else {
          res.error = `Moved, but Bungie wouldn't equip it (code ${er.equipStatus}; usually a second exotic or the wrong class).`;
        }
      }
    } catch (e) {
      for (const id of toEquip) results.find((x) => x.id === id)!.error = `Moved, but equipping failed: ${friendly(e)}`;
    }
  }
  return results;
}

/**
 * The InsertSocketPlugFree request that switches a weapon's perk column to one of its own options.
 * Bungie only allows "free" plugs (the weapon's selectable perks), with the character in orbit, a social
 * space or offline. A vault weapon still needs a character id: any of the account's characters works.
 */
export function perkInsertBody(vault: Vault, id: string, socket: number, perk: string) {
  const w = vault.weapons.find((x) => x.instanceId === id);
  if (!w) throw new Error("Not in your vault or on a character (re-rate to refresh).");
  const col = w.columns.find((c) => c.socket === socket);
  const plugItemHash = col?.hashes?.[perk];
  if (!col || !plugItemHash || !col.options.includes(perk)) throw new Error(`${perk} isn't a perk you can select on this ${w.name}. Re-rate to refresh.`);
  const characterId = w.location.where !== "vault" ? w.location.where : vault.characters[0]?.id;
  if (!characterId) throw new Error("Bungie needs one of your characters for this, and none were found.");
  return { col, body: { plug: { socketIndex: socket, socketArrayType: 0, plugItemHash }, itemId: id, characterId, membershipType: vault.membershipType } };
}

/** Switch a weapon's perk in game (needs the "Move or equip your gear" scope). */
export async function insertPerk(id: string, socket: number, perk: string, opts: { vault?: Vault; send?: typeof action } = {}): Promise<void> {
  const { col, body } = perkInsertBody(opts.vault ?? (await currentVault()), id, socket, perk);
  if (col.active === perk) return;
  try {
    await (opts.send ?? action)("/Destiny2/Actions/Items/InsertSocketPlugFree/", body);
  } catch (e) {
    throw new Error(friendly(e));
  }
  col.active = perk;
}

/** The InsertSocketPlugFree request that puts one of your unlocked weapon mods (or the empty socket) in a weapon's mod socket. */
export function modInsertBody(vault: Vault, id: string, socket: number, mod: string) {
  const w = vault.weapons.find((x) => x.instanceId === id);
  if (!w) throw new Error("Not in your vault or on a character (re-rate to refresh).");
  const slot = w.mods?.find((x) => x.kind === "mod" && x.socket === socket);
  const opt = slot?.options?.find((o) => o.name === mod);
  if (!slot || !opt) throw new Error(`${mod} isn't a mod you can put on this ${w.name}. Re-rate to refresh.`);
  const characterId = w.location.where !== "vault" ? w.location.where : vault.characters[0]?.id;
  if (!characterId) throw new Error("Bungie needs one of your characters for this, and none were found.");
  return { slot, opt, body: { plug: { socketIndex: socket, socketArrayType: 0, plugItemHash: opt.hash }, itemId: id, characterId, membershipType: vault.membershipType } };
}

/** Switch a weapon's mod in game (needs the "Move or equip your gear" scope). */
export async function insertMod(id: string, socket: number, mod: string, opts: { vault?: Vault; send?: typeof action } = {}): Promise<void> {
  const { slot, opt, body } = modInsertBody(opts.vault ?? (await currentVault()), id, socket, mod);
  if (slot.name === mod) return;
  try {
    await (opts.send ?? action)("/Destiny2/Actions/Items/InsertSocketPlugFree/", body);
  } catch (e) {
    throw new Error(friendly(e));
  }
  Object.assign(slot, { name: opt.name, icon: opt.icon, description: opt.description });
}

const sameSlot = (a: WeaponRecord | ArmorRecord, b: WeaponRecord | ArmorRecord) => a.kind === b.kind && a.slot === b.slot;
