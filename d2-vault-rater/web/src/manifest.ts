/** Loads the stripped Destiny manifest (see versioned.ts for where it comes from) and hands it to the rater. */
import { setManifest, versionSlug, type Manifest } from "./shims/manifest";
import { files, join } from "./shims/node";
import { paths } from "./shims/config";
import { loadVersioned } from "./versioned";
import type { LiteManifest } from "./strip";

export async function loadLiteManifest(log: (s: string) => void): Promise<LiteManifest> {
  const m = await loadVersioned<LiteManifest>({
    key: "manifest",
    snapshot: "manifest",
    worker: () => new Worker(new URL("./manifest.worker.ts", import.meta.url), { type: "module" }),
    log,
    messages: {
      snapshot: "Loading the Destiny item database…",
      download: "New game version: downloading the Destiny item database from Bungie (once per patch, about a minute)…",
      workerFailed: "The manifest worker failed.",
    },
  });
  setManifest(m as unknown as Manifest);
  // src/sources/activities.ts reads these two (already stripped) tables as files.
  const dir = join(paths.manifestDir, versionSlug(m.version));
  files.set(join(dir, "DestinyCollectibleDefinition.lite.json"), JSON.stringify(m.collectibles));
  files.set(join(dir, "DestinyActivityDefinition.lite.json"), JSON.stringify(m.activities));
  return m;
}
