/// <reference lib="webworker" />
import { TABLES, type LiteManifest, type TableKey } from "./strip";

/** Downloads each manifest table from bungie.net and strips it off the main thread. */
self.onmessage = async (e: MessageEvent<{ version: string; paths: Record<string, string> }>) => {
  const { version, paths } = e.data;
  const out = { version } as LiteManifest;
  try {
    for (const [key, [table, strip]] of Object.entries(TABLES) as [TableKey, (typeof TABLES)[TableKey]][]) {
      self.postMessage({ progress: `Downloading ${table.replace(/^Destiny|Definition$/g, "")} definitions…` });
      const res = await fetch("https://www.bungie.net" + paths[table]);
      if (!res.ok) throw new Error(`Manifest download failed for ${table}: ${res.status}`);
      out[key] = strip(await res.json());
    }
    self.postMessage({ manifest: out });
  } catch (err) {
    self.postMessage({ error: (err as Error).message });
  }
};
