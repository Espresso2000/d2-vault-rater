/**
 * Loads the stripped Destiny manifest: from IndexedDB when this game version was seen before,
 * else from the snapshot shipped with the site (fast, phone friendly) when it matches the live
 * version, else straight from bungie.net in a Web Worker (needed after a game patch).
 */
import { bungie } from "./shims/client";
import { setManifest, versionSlug, type Manifest } from "./shims/manifest";
import { files, join } from "./shims/node";
import { paths } from "./shims/config";
import { idbGet, idbSet } from "./idb";
import type { LiteManifest } from "./strip";

export async function loadLiteManifest(log: (s: string) => void): Promise<LiteManifest> {
  const meta = await bungie<{ version: string; jsonWorldComponentContentPaths: Record<string, Record<string, string>> }>("/Destiny2/Manifest/", { auth: false });
  let m = await idbGet<LiteManifest>("manifest");
  if (m?.version !== meta.version) {
    m = undefined;
    try {
      const res = await fetch(`data/manifest-${versionSlug(meta.version)}.json`);
      if (res.ok && res.headers.get("content-type")?.includes("json")) {
        log("Loading the Destiny item database…");
        const snap = (await res.json()) as LiteManifest;
        if (snap.version === meta.version) m = snap;
      }
    } catch {}
    if (!m) {
      log("New game version: downloading the Destiny item database from Bungie (once per patch, about a minute)…");
      m = await new Promise<LiteManifest>((ok, fail) => {
        const w = new Worker(new URL("./manifest.worker.ts", import.meta.url), { type: "module" });
        w.onmessage = (e) => {
          if (e.data.progress) log(e.data.progress);
          if (e.data.error) (w.terminate(), fail(new Error(e.data.error)));
          if (e.data.manifest) (w.terminate(), ok(e.data.manifest));
        };
        w.onerror = (e) => (w.terminate(), fail(new Error(e.message || "The manifest worker failed.")));
        w.postMessage({ version: meta.version, paths: meta.jsonWorldComponentContentPaths.en });
      });
    }
    await idbSet("manifest", m).catch(() => {});
  }
  setManifest(m as unknown as Manifest);
  // src/sources/activities.ts reads these two tables as files.
  const dir = join(paths.manifestDir, versionSlug(m.version));
  files.set(join(dir, "DestinyCollectibleDefinition.json"), JSON.stringify(m.collectibles));
  files.set(join(dir, "DestinyActivityDefinition.json"), JSON.stringify(m.activities));
  return m;
}
