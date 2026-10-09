/// <reference lib="webworker" />
import { TABLES, downloadTable, type LiteManifest, type TableKey } from "./strip";

/** Downloads each manifest table from bungie.net and strips it off the main thread. */
self.onmessage = async (e: MessageEvent<{ version: string; paths: Record<string, string> }>) => {
  const { version, paths } = e.data;
  const out = { version } as LiteManifest;
  try {
    for (const [key, [table, strip]] of Object.entries(TABLES) as [TableKey, (typeof TABLES)[TableKey]][]) out[key] = strip(await downloadTable(paths, table));
    self.postMessage({ result: out });
  } catch (err) {
    self.postMessage({ error: (err as Error).message });
  }
};
