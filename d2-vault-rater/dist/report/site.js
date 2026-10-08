import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { paths, writeText } from "../config.js";
import { loadArmorSets } from "../sources/armorSets.js";
import { buildSiteData } from "./siteData.js";
const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(here, "..", "..", "report-template", "site.html");
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };
/**
 * Images are embedded as data URIs so the page works offline and inside viewers that block
 * remote images. Downloads are cached under ~/.d2-vault-rater/images.
 */
class ImageBank {
    map = {};
    keys = new Map();
    dir = join(paths.home, "images");
    key(url) {
        if (!url)
            return null;
        let k = this.keys.get(url);
        if (!k)
            this.keys.set(url, (k = `i${this.keys.size.toString(36)}`));
        return k;
    }
    async fill(concurrency = 8) {
        mkdirSync(this.dir, { recursive: true });
        const jobs = [...this.keys];
        let failed = 0;
        const worker = async () => {
            for (let job = jobs.shift(); job; job = jobs.shift()) {
                const [url, k] = job;
                try {
                    const name = basename(new URL(url).pathname);
                    const file = join(this.dir, name);
                    if (!existsSync(file)) {
                        const res = await fetch(url);
                        if (!res.ok)
                            throw new Error(String(res.status));
                        writeFileSync(file, Buffer.from(await res.arrayBuffer()));
                    }
                    this.map[k] = `data:${MIME[extname(name).toLowerCase()] ?? "image/jpeg"};base64,${readFileSync(file).toString("base64")}`;
                }
                catch {
                    failed++;
                }
            }
        };
        await Promise.all(Array.from({ length: concurrency }, worker));
        return { failed };
    }
}
/** Builds the interactive report page with every weapon and armor piece and embedded images. */
export async function writeSite(w, a, o) {
    const bank = new ImageBank();
    const data = buildSiteData(w, a, o, (url) => bank.key(url), loadArmorSets());
    const { failed } = await bank.fill();
    // Escape "<" so no string in the data can close the script tag.
    const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
    const title = `${o.wrapped?.name ? o.wrapped.name + "’s" : "Your"} Vault Report`;
    const html = readFileSync(TEMPLATE, "utf8")
        .split("__TITLE__")
        .join(title.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)).split("/*__DATA__*/null").join(json(data)).split("/*__IMG__*/{}").join(json(bank.map));
    const file = join(paths.reportsDir, `vault-report-${new Date().toISOString().slice(0, 10)}.html`);
    writeText(file, html);
    return { file, imagesFailed: failed };
}
//# sourceMappingURL=site.js.map