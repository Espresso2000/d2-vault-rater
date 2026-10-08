/// <reference lib="webworker" />
import { stripBuildDefs } from "./defs.strip";

/** Downloads the three manifest tables the Builds tab needs and strips them off the main thread. */
self.onmessage = async (e: MessageEvent<{ version: string; paths: Record<string, string> }>) => {
  const { version, paths } = e.data;
  try {
    const get = async (table: string) => {
      self.postMessage({ progress: `Downloading ${table.replace(/^Destiny|Definition$/g, "")} definitions…` });
      const res = await fetch("https://www.bungie.net" + paths[table]);
      if (!res.ok) throw new Error(`Manifest download failed for ${table}: ${res.status}`);
      return res.json();
    };
    const plugSets = await get("DestinyPlugSetDefinition");
    const perks = await get("DestinySandboxPerkDefinition");
    const constants = await get("DestinyLoadoutConstantsDefinition");
    const items = await get("DestinyInventoryItemDefinition");
    self.postMessage({ defs: stripBuildDefs(version, items, plugSets, perks, constants) });
  } catch (err) {
    self.postMessage({ error: (err as Error).message });
  }
};
