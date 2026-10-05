import { join } from "node:path";
import { bungieEnv, paths, readJson, writeJson } from "../config.js";
import { accessToken, loadTokens } from "../bungie/client.js";
import { primaryMembership } from "../bungie/oauth.js";

/**
 * DIM Sync (api.destinyitemmanager.com): the tags, notes and loadouts DIM stores for you.
 * The rater registers itself once with your Bungie API key, then signs in with your Bungie login.
 */
const DIM = "https://api.destinyitemmanager.com";
const ORIGIN = "https://localhost:7777";
const appFile = () => join(paths.home, "dim-app.json");
const tokenFile = () => join(paths.home, "dim-token.json");

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

async function dimFetch<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(DIM + path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    // DIM matches each app key to the origin it was registered with.
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(init.headers ?? {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`DIM ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/** DIM issues one API key per app id + Bungie API key; asking again returns the same key. */
async function dimApiKey(): Promise<string> {
  const saved = readJson<{ dimApiKey: string } | null>(appFile(), null);
  if (saved?.dimApiKey) return saved.dimApiKey;
  const env = bungieEnv();
  const id = `vault-rater-${(env.clientId || "local").toLowerCase()}`;
  const r = await dimFetch<{ app?: { dimApiKey?: string }; dimApiKey?: string }>("/new_app", {
    body: { id, bungieApiKey: env.apiKey, origin: ORIGIN },
  });
  const key = r.app?.dimApiKey ?? r.dimApiKey;
  if (!key) throw new Error("DIM did not return an API key.");
  writeJson(appFile(), { id, dimApiKey: key, createdAt: new Date().toISOString() });
  return key;
}

async function dimAuth(): Promise<{ apiKey: string; token: string }> {
  const apiKey = await dimApiKey();
  const saved = readJson<{ accessToken: string; expiresAt: number } | null>(tokenFile(), null);
  if (saved && Date.now() < saved.expiresAt - 60_000) return { apiKey, token: saved.accessToken };
  const tokens = loadTokens();
  if (!tokens) throw new Error("Not logged in to Bungie.");
  const r = await dimFetch<{ accessToken: string; expiresInSeconds: number }>("/auth/token", {
    body: { bungieAccessToken: await accessToken(), membershipId: tokens.membership_id },
    headers: { "X-API-Key": apiKey },
  });
  writeJson(tokenFile(), { accessToken: r.accessToken, expiresAt: Date.now() + r.expiresInSeconds * 1000 });
  return { apiKey, token: r.accessToken };
}

/** Read your DIM tags/notes and/or loadouts. */
export async function fetchDimData(want: { tags: boolean; loadouts: boolean }): Promise<DimData> {
  const components = [want.tags && "tags", want.loadouts && "loadouts"].filter(Boolean).join(",");
  const out: DimData = { tags: {}, loadouts: [], fetchedAt: new Date().toISOString() };
  if (!components) return out;
  const { apiKey, token } = await dimAuth();
  const who = await primaryMembership();
  const r = await dimFetch<{
    tags?: { id: string; tag?: DimTagValue | null; notes?: string | null }[];
    loadouts?: { id: string; name: string; classType: number; equipped?: { id?: string }[]; unequipped?: { id?: string }[] }[];
  }>(`/profile?platformMembershipId=${who.membershipId}&destinyVersion=2&components=${components}`, {
    headers: { "X-API-Key": apiKey, Authorization: `Bearer ${token}` },
  });
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

/** Set (or clear, with tag null) one item's DIM tag, keeping or replacing its notes. */
export async function setDimTag(itemId: string, tag: DimTagValue | null, notes?: string | null): Promise<void> {
  const { apiKey, token } = await dimAuth();
  const who = await primaryMembership();
  const payload: Record<string, unknown> = { id: itemId, tag };
  if (notes !== undefined) payload.notes = notes;
  const r = await dimFetch<{ results?: { status: string; message?: string }[] }>("/profile", {
    body: { platformMembershipId: who.membershipId, destinyVersion: 2, updates: [{ action: "tag", payload }] },
    headers: { "X-API-Key": apiKey, Authorization: `Bearer ${token}` },
  });
  const res = r.results?.[0];
  if (res && res.status !== "Success") throw new Error(`DIM rejected the tag: ${res.message ?? res.status}`);
}
