import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { paths, readJson, writeJson, writeText } from "../config.js";
import { bungie, BungieError } from "../bungie/client.js";
import { strictnessFor } from "../rating/settings.js";
const planFile = (id) => join(paths.plansDir, `${id}.json`);
const snapshotFile = (id) => join(paths.snapshotsDir, `${id}.json`);
export function searchString(ids) {
    return ids.length ? ids.map((i) => `id:${i}`).join(" or ") : "";
}
export function planDimActions(vault, weapons, armor, settings) {
    const items = [];
    for (const r of weapons.ratings) {
        const s = strictnessFor(settings, r.type);
        const note = `VR ${r.score}: ${r.reasons.slice(0, 3).join("; ")}`;
        if (r.verdict === "keep") {
            items.push({ ...base(r, "weapon"), lock: r.locked ? null : true, tag: r.label === "best" ? "favorite" : "keep", note, category: null, protected: r.label === "protected" });
        }
        else if (r.verdict === "review") {
            items.push({ ...base(r, "weapon"), lock: null, tag: "archive", note: `review: ${note}`, category: r.category, protected: false });
        }
        else {
            const unlock = r.category !== null && s.unlock.includes(r.category);
            items.push({ ...base(r, "weapon"), lock: unlock && r.locked ? false : null, tag: "junk", note, category: r.category, protected: false });
        }
    }
    const s = strictnessFor(settings);
    for (const r of armor.ratings) {
        const note = `VR ${r.score}: ${r.reasons.slice(0, 2).join("; ")}`;
        if (r.verdict === "keep")
            items.push({ ...base(r, "armor"), lock: r.locked ? null : true, tag: r.label === "best" ? "favorite" : "keep", note, category: null, protected: r.label === "protected" });
        else if (r.verdict === "review")
            items.push({ ...base(r, "armor"), lock: null, tag: "archive", note: `review: ${note}`, category: "duplicate", protected: false });
        else
            items.push({ ...base(r, "armor"), lock: s.unlock.includes("armor") && r.locked ? false : null, tag: "junk", note, category: "armor", protected: false });
    }
    const locations = {};
    for (const w of [...vault.weapons, ...vault.armor])
        locations[w.instanceId] = w.location.where;
    const plan = {
        id: `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`,
        createdAt: new Date().toISOString(),
        membershipType: vault.membershipType,
        characterIds: vault.characters.map((c) => c.id),
        locations,
        items,
        counts: {
            lock: items.filter((i) => i.lock === true).length,
            unlock: items.filter((i) => i.lock === false).length,
            tagKeep: items.filter((i) => i.tag === "keep" || i.tag === "favorite").length,
            tagJunk: items.filter((i) => i.tag === "junk").length,
            review: items.filter((i) => i.tag === "archive").length,
        },
        searches: {
            keep: searchString(items.filter((i) => i.tag === "keep" || i.tag === "favorite").map((i) => i.instanceId)),
            junk: searchString(items.filter((i) => i.tag === "junk").map((i) => i.instanceId)),
            review: searchString(items.filter((i) => i.tag === "archive").map((i) => i.instanceId)),
        },
    };
    writeJson(planFile(plan.id), plan);
    return plan;
}
function base(r, kind) {
    return { instanceId: r.instanceId, itemHash: r.itemHash, name: r.name, kind, wasLocked: r.locked };
}
export function loadPlan(id) {
    const p = readJson(planFile(id), null);
    if (!p)
        throw new Error(`No plan with id ${id}. Run plan_dim_actions first.`);
    return p;
}
const csvCell = (v) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** DIM's "Import tags/notes from CSV" reads Id, Hash, Tag and Notes. */
export function planToCsv(plan) {
    const rows = [["Id", "Hash", "Tag", "Notes"]];
    for (const i of plan.items)
        if (i.tag)
            rows.push([i.instanceId, String(i.itemHash), i.tag, i.note]);
    return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
export function exportCsv(planId) {
    const plan = loadPlan(planId);
    const file = join(paths.plansDir, `${planId}-dim-tags.csv`);
    writeText(file, planToCsv(plan));
    return file;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const bungieSetLock = async (args) => {
    await bungie("/Destiny2/Actions/Items/SetLockState/", { body: args });
};
async function setWithRetry(set, args) {
    for (let attempt = 0;; attempt++) {
        try {
            return await set(args);
        }
        catch (e) {
            const throttle = e instanceof BungieError && (e.throttleSeconds > 0 || /throttl/i.test(e.errorStatus));
            if (!throttle || attempt >= 4)
                throw e;
            await sleep(Math.max(1, e.throttleSeconds) * 1000 * (attempt + 1));
        }
    }
}
/** Apply a plan's lock changes. Protected items are never unlocked, even if the plan file was edited. */
export async function applyDimActions(planId, opts = {}) {
    const plan = loadPlan(planId);
    const set = opts.setLock ?? bungieSetLock;
    const snapshot = plan.items.map((i) => ({ instanceId: i.instanceId, name: i.name, locked: i.wasLocked }));
    writeJson(snapshotFile(planId), { planId, takenAt: new Date().toISOString(), items: snapshot });
    const res = { planId, locked: 0, unlocked: 0, failed: [], csvFile: exportCsv(planId), snapshotFile: snapshotFile(planId) };
    const fallbackChar = plan.characterIds[0];
    for (const i of plan.items) {
        if (i.lock === null || (i.lock === false && i.protected))
            continue;
        const where = plan.locations[i.instanceId];
        const characterId = where && where !== "vault" ? where : fallbackChar;
        try {
            await setWithRetry(set, { itemId: i.instanceId, characterId, membershipType: plan.membershipType, state: i.lock });
            i.lock ? res.locked++ : res.unlocked++;
        }
        catch (e) {
            res.failed.push({ instanceId: i.instanceId, name: i.name, error: e.message });
        }
        await sleep(opts.delayMs ?? 250);
    }
    return res;
}
/** Put every lock in a plan back the way it was before apply. */
export async function undoDimActions(planId, opts = {}) {
    const plan = loadPlan(planId);
    const snap = readJson(snapshotFile(planId), null);
    if (!snap)
        throw new Error(`Plan ${planId} was never applied, so there is nothing to undo.`);
    const set = opts.setLock ?? bungieSetLock;
    const changed = new Set(plan.items.filter((i) => i.lock !== null).map((i) => i.instanceId));
    let restored = 0;
    const failed = [];
    for (const s of snap.items) {
        if (!changed.has(s.instanceId))
            continue;
        const where = plan.locations[s.instanceId];
        try {
            await setWithRetry(set, {
                itemId: s.instanceId,
                characterId: where && where !== "vault" ? where : plan.characterIds[0],
                membershipType: plan.membershipType,
                state: s.locked,
            });
            restored++;
        }
        catch (e) {
            failed.push({ name: s.name, error: e.message });
        }
        await sleep(opts.delayMs ?? 250);
    }
    return { planId, restored, failed, note: "DIM tags are not undone here; re-import an earlier CSV or clear tags in DIM." };
}
//# sourceMappingURL=actions.js.map