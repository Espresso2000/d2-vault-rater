import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../config.js";
import { bungie, BUNGIE } from "./client.js";
const COMPONENTS = {
    items: "DestinyInventoryItemDefinition",
    stats: "DestinyStatDefinition",
    itemSets: "DestinyEquipableItemSetDefinition",
};
let cached = null;
/** Download (once per game version) and load the manifest tables the rater needs. */
export async function loadManifest(opts = {}) {
    const meta = await bungie("/Destiny2/Manifest/", { auth: false });
    if (cached && cached.version === meta.version && !opts.force)
        return cached;
    const dir = join(paths.manifestDir, meta.version.replace(/[^\w.-]/g, "_"));
    mkdirSync(dir, { recursive: true });
    const en = meta.jsonWorldComponentContentPaths.en;
    const out = { version: meta.version };
    for (const [key, table] of Object.entries(COMPONENTS)) {
        const file = join(dir, `${table}.json`);
        if (!existsSync(file) || opts.force) {
            const res = await fetch(BUNGIE + en[table]);
            if (!res.ok)
                throw new Error(`Manifest download failed for ${table}: ${res.status}`);
            writeFileSync(file, await res.text());
        }
        out[key] = JSON.parse(readFileSync(file, "utf8"));
    }
    cached = out;
    return cached;
}
/** Use an in-memory manifest (tests, or a pre-loaded copy). */
export function setManifest(m) {
    cached = m;
}
export function currentManifest() {
    return cached;
}
export const normalizeName = (s) => s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[‘’“”'"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/** name -> every weapon hash with that name (reissues share names). */
export function weaponHashesByName(m) {
    const out = new Map();
    for (const d of Object.values(m.items)) {
        if (d.itemType !== 3 || !d.displayProperties?.name)
            continue;
        const key = normalizeName(d.displayProperties.name.replace(/\s*\((adept|timelost|harrowed)\)\s*$/i, ""));
        const list = out.get(key) ?? [];
        list.push(d.hash);
        out.set(key, list);
    }
    return out;
}
//# sourceMappingURL=manifest.js.map