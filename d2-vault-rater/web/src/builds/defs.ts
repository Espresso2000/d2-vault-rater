/**
 * The Builds tab's slice of the manifest (subclasses, their plugs, armor mods), loaded like the item
 * database (see ../versioned.ts); built from bungie.net it is about 200 MB once per game patch, like DIM.
 */
import { loadVersioned, manifestMeta } from "../versioned";
import type { BuildDefs } from "./defs.strip";

let cached: BuildDefs | null = null;

export async function loadBuildDefs(log: (s: string) => void): Promise<BuildDefs> {
  if (cached?.version === (await manifestMeta()).version) return cached;
  return (cached = await loadVersioned<BuildDefs>({
    key: "build-defs",
    snapshot: "builds",
    worker: () => new Worker(new URL("./defs.worker.ts", import.meta.url), { type: "module" }),
    log,
    messages: {
      download: "Downloading subclass, aspect and fragment definitions from Bungie (once per game patch, about a minute)…",
      workerFailed: "The definitions worker failed.",
    },
  }));
}
