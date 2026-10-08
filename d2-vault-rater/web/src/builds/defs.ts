/**
 * The Builds tab's slice of the manifest (subclasses, their plugs, armor mods): from IndexedDB when this
 * game version was seen before, else from a snapshot shipped with the site, else built in a worker
 * from bungie.net (about 200 MB once per game patch, like DIM).
 */
import { bungie } from "../shims/client";
import { idbGet, idbSet } from "../idb";
import type { BuildDefs } from "./defs.strip";

let cached: BuildDefs | null = null;

export async function loadBuildDefs(log: (s: string) => void): Promise<BuildDefs> {
  const meta = await bungie<{ version: string; jsonWorldComponentContentPaths: Record<string, Record<string, string>> }>("/Destiny2/Manifest/", { auth: false });
  if (cached?.version === meta.version) return cached;
  let d = await idbGet<BuildDefs>("build-defs").catch(() => undefined);
  if (d?.version !== meta.version) {
    d = undefined;
    try {
      const res = await fetch(`data/builds-${meta.version.replace(/[^\w.-]/g, "_")}.json`);
      if (res.ok && res.headers.get("content-type")?.includes("json")) d = await res.json();
    } catch {}
    if (d?.version !== meta.version) {
      log("Downloading subclass, aspect and fragment definitions from Bungie (once per game patch, about a minute)…");
      d = await new Promise<BuildDefs>((ok, fail) => {
        const w = new Worker(new URL("./defs.worker.ts", import.meta.url), { type: "module" });
        w.onmessage = (e) => {
          if (e.data.progress) log(e.data.progress);
          if (e.data.error) (w.terminate(), fail(new Error(e.data.error)));
          if (e.data.defs) (w.terminate(), ok(e.data.defs));
        };
        w.onerror = (e) => (w.terminate(), fail(new Error(e.message || "The definitions worker failed.")));
        w.postMessage({ version: meta.version, paths: meta.jsonWorldComponentContentPaths.en });
      });
    }
    await idbSet("build-defs", d).catch(() => {});
  }
  return (cached = d!);
}
