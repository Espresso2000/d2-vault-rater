import { join } from "node:path";
import { bungieEnv, paths, readJson, writeJson } from "../config.js";
import { accessToken, loadTokens } from "../bungie/client.js";
import { primaryMembership } from "../bungie/oauth.js";
import { DIM_API, readDimProfile, writeDimTag, type DimCall, type DimTagValue } from "./common.js";

export { DIM_TAGS, keepIds, type DimData, type DimLoadout, type DimTagValue } from "./common.js";

/**
 * DIM Sync (api.destinyitemmanager.com): the tags, notes and loadouts DIM stores for you.
 * The rater registers itself once with your Bungie API key, then signs in with your Bungie login.
 */
const ORIGIN = "https://localhost:7777";
const appFile = () => join(paths.home, "dim-app.json");
const tokenFile = () => join(paths.home, "dim-token.json");

async function dimFetch<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(DIM_API + path, {
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

/** Any DIM API call as the signed-in player. */
const dimCall: DimCall = async (path, body) => {
  const { apiKey, token } = await dimAuth();
  return dimFetch(path, { body, headers: { "X-API-Key": apiKey, Authorization: `Bearer ${token}` } });
};

/** Read your DIM tags/notes and/or loadouts. */
export const fetchDimData = (want: { tags: boolean; loadouts: boolean }) => readDimProfile(dimCall, primaryMembership, want);

/** Set (or clear, with tag null) one item's DIM tag, keeping or replacing its notes. */
export const setDimTag = (itemId: string, tag: DimTagValue | null, notes?: string | null) => writeDimTag(dimCall, primaryMembership, itemId, tag, notes);
