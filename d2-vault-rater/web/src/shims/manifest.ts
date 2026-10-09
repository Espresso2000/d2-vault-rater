/**
 * Browser version of src/bungie/manifest.ts. The web app loads the (stripped) manifest itself
 * (see ../manifest.ts) and hands it over with setManifest(); loadManifest() just returns it.
 */
import type { Manifest } from "../../../src/bungie/defs.js";

export * from "../../../src/bungie/defs.js";

let cached: Manifest | null = null;

export async function loadManifest(): Promise<Manifest> {
  if (!cached) throw new Error("The Destiny manifest isn't loaded yet.");
  return cached;
}

export function setManifest(m: Manifest): void {
  cached = m;
}

export function currentManifest(): Manifest | null {
  return cached;
}
