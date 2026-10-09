/** DIM: read loadouts into the builder, save a build as a DIM loadout, and make a dim.gg share link. */
import { dimCall } from "../shims/sync";
import { primaryMembership } from "../shims/oauth";
import type { DimLoadoutJson } from "./model";

export async function dimLoadouts(): Promise<DimLoadoutJson[]> {
  const who = await primaryMembership();
  const r = await dimCall<{ loadouts?: DimLoadoutJson[] }>(`/profile?platformMembershipId=${who.membershipId}&destinyVersion=2&components=loadouts`);
  return r.loadouts ?? [];
}

export async function saveToDim(l: DimLoadoutJson): Promise<void> {
  const who = await primaryMembership();
  const r = await dimCall<{ results?: { status: string; message?: string }[] }>("/profile", {
    platformMembershipId: who.membershipId,
    destinyVersion: 2,
    updates: [{ action: "loadout", payload: l }],
  });
  const res = r.results?.[0];
  if (res && res.status !== "Success") throw new Error(`DIM rejected the loadout: ${res.message ?? res.status}`);
}

/** A dim.gg link anyone can open to view and import the loadout. */
export async function shareDimLoadout(l: DimLoadoutJson): Promise<string> {
  const who = await primaryMembership();
  const r = await dimCall<{ shareUrl?: string }>("/loadout_share", { platformMembershipId: who.membershipId, loadout: l });
  if (!r.shareUrl) throw new Error("DIM didn't return a share link.");
  return r.shareUrl;
}

/** Opens DIM with the loadout ready to import; works without DIM sync. */
export const dimImportUrl = (l: DimLoadoutJson) => `https://app.destinyitemmanager.com/loadouts?loadout=${encodeURIComponent(JSON.stringify(l))}`;
