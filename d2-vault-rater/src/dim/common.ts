/**
 * DIM Sync pieces shared by the Node client (sync.ts) and the web app's shim: tag names, the data
 * shapes, and reading or writing a profile. Each side brings its own signed-in request function.
 */
import type { Settings } from "../rating/settings.js";

export const DIM_API = "https://api.destinyitemmanager.com";

export const DIM_TAGS = ["favorite", "keep", "infuse", "junk", "archive"] as const;
export type DimTagValue = (typeof DIM_TAGS)[number];

export interface DimLoadout {
  id: string;
  name: string;
  classType: number;
  itemIds: string[];
}

export interface DimData {
  tags: Record<string, { tag: DimTagValue | null; notes: string | null }>;
  loadouts: DimLoadout[];
  fetchedAt: string;
}

/** One request to DIM's API as the signed-in player (POST when there is a body). */
export type DimCall = <T>(path: string, body?: unknown) => Promise<T>;
type Who = () => Promise<{ membershipId: string }>;

/** Read your DIM tags/notes and/or loadouts. */
export async function readDimProfile(call: DimCall, who: Who, want: { tags: boolean; loadouts: boolean }): Promise<DimData> {
  const components = [want.tags && "tags", want.loadouts && "loadouts"].filter(Boolean).join(",");
  const out: DimData = { tags: {}, loadouts: [], fetchedAt: new Date().toISOString() };
  if (!components) return out;
  const r = await call<{
    tags?: { id: string; tag?: DimTagValue | null; notes?: string | null }[];
    loadouts?: { id: string; name: string; classType: number; equipped?: { id?: string }[]; unequipped?: { id?: string }[] }[];
  }>(`/profile?platformMembershipId=${(await who()).membershipId}&destinyVersion=2&components=${components}`);
  for (const t of r.tags ?? []) if (t.tag || t.notes) out.tags[t.id] = { tag: t.tag ?? null, notes: t.notes ?? null };
  out.loadouts = (r.loadouts ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    classType: l.classType,
    itemIds: [...(l.equipped ?? []), ...(l.unequipped ?? [])].map((i) => i.id).filter((x): x is string => !!x && x !== "0"),
  }));
  return out;
}

/** Instance ids tagged Favorite or Keep, which the rater then never marks for sharding. */
export const keepIds = (d: DimData | null) => Object.entries(d?.tags ?? {}).filter(([, t]) => t.tag === "favorite" || t.tag === "keep").map(([id]) => id);

/** Settings for one rating run: items tagged Favorite or Keep in DIM are protected (setting dim.protectTagged). */
export const withDimKeep = (s: Settings, d: DimData | null): Settings => ({ ...s, dimKeep: s.dim.tags && s.dim.protectTagged ? keepIds(d) : [] });

/** Set (or clear, with tag null) one item's DIM tag, keeping or replacing its notes. */
export async function writeDimTag(call: DimCall, who: Who, itemId: string, tag: DimTagValue | null, notes?: string | null): Promise<void> {
  const payload: Record<string, unknown> = { id: itemId, tag };
  if (notes !== undefined) payload.notes = notes;
  const r = await call<{ results?: { status: string; message?: string }[] }>("/profile", {
    platformMembershipId: (await who()).membershipId,
    destinyVersion: 2,
    updates: [{ action: "tag", payload }],
  });
  const res = r.results?.[0];
  if (res && res.status !== "Success") throw new Error(`DIM rejected the tag: ${res.message ?? res.status}`);
}
