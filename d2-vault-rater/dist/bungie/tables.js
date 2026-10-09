import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUNGIE } from "./errors.js";
/**
 * One manifest table cut down by `strip`, cached in the version folder as <table>.lite.json, so later
 * runs parse a few MB instead of the full table (the item table is ~200 MB). A full table left by an
 * older version of the rater is stripped once instead of downloaded again.
 */
export async function liteTable(dir, table, path, strip, force = false) {
    const lite = join(dir, `${table}.lite.json`);
    if (force || !existsSync(lite)) {
        const full = join(dir, `${table}.json`);
        let data;
        if (!force && existsSync(full))
            data = JSON.parse(readFileSync(full, "utf8"));
        else {
            const res = await fetch(BUNGIE + (await path()));
            if (!res.ok)
                throw new Error(`Manifest download failed for ${table}: ${res.status}`);
            data = await res.json();
        }
        writeFileSync(lite, JSON.stringify(strip(data)));
    }
    return JSON.parse(readFileSync(lite, "utf8"));
}
//# sourceMappingURL=tables.js.map