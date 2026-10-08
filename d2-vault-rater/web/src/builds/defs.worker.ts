/// <reference lib="webworker" />
import { downloadTable } from "../strip";
import { stripBuildDefs } from "./defs.strip";

/** Downloads the four manifest tables the Builds tab needs and strips them off the main thread. */
self.onmessage = async (e: MessageEvent<{ version: string; paths: Record<string, string> }>) => {
  const { version, paths } = e.data;
  try {
    const plugSets = await downloadTable(paths, "DestinyPlugSetDefinition");
    const perks = await downloadTable(paths, "DestinySandboxPerkDefinition");
    const constants = await downloadTable(paths, "DestinyLoadoutConstantsDefinition");
    const items = await downloadTable(paths, "DestinyInventoryItemDefinition");
    self.postMessage({ result: stripBuildDefs(version, items, plugSets, perks, constants) });
  } catch (err) {
    self.postMessage({ error: (err as Error).message });
  }
};
