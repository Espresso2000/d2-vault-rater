/**
 * Browser version of src/dim/sync.ts: DIM Sync tags, notes and loadouts.
 * DIM ties each API key to the origin it was registered for, and the browser sends this page's
 * origin itself. The key comes from app.config.json, or is registered for this origin on first use.
 */
import { appConfig } from "../appConfig";
import { bungieEnv, paths, readJson, writeJson } from "./config";
import { accessToken, loadTokens } from "./client";
import { primaryMembership } from "./oauth";
import { DIM_API, readDimProfile, writeDimTag, type DimCall, type DimTagValue } from "../../../src/dim/common.js";

export { DIM_TAGS, keepIds, withDimKeep, type DimData, type DimLoadout, type DimTagValue } from "../../../src/dim/common.js";

const appFile = () => `${paths.home}/dim-app.json`;
const TOKEN_KEY = "vr-dim-token";

async function dimFetch<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(DIM_API + path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`DIM ${path.split("?")[0]} failed: ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function dimApiKey(): Promise<string> {
  const fixed = appConfig().dimApiKey;
  if (fixed) return fixed;
  const saved = readJson<{ dimApiKey: string; origin: string } | null>(appFile(), null);
  if (saved?.dimApiKey && saved.origin === location.origin) return saved.dimApiKey;
  const env = bungieEnv();
  // DIM app ids: lowercase letters, digits and dashes; one per origin.
  const id = `vault-rater-${(env.clientId || "web").toLowerCase()}-${location.host.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.slice(0, 60);
  const r = await dimFetch<{ app?: { dimApiKey?: string }; dimApiKey?: string }>("/new_app", { body: { id, bungieApiKey: env.apiKey, origin: location.origin } });
  const key = r.app?.dimApiKey ?? r.dimApiKey;
  if (!key) throw new Error("DIM did not return an API key.");
  writeJson(appFile(), { id, dimApiKey: key, origin: location.origin, createdAt: new Date().toISOString() });
  return key;
}

async function dimAuth(): Promise<{ apiKey: string; token: string }> {
  const apiKey = await dimApiKey();
  const tokens = loadTokens();
  if (!tokens) throw new Error("Not signed in to Bungie.");
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null") as { accessToken: string; expiresAt: number; membership: string } | null;
    if (saved && saved.membership === tokens.membership_id && Date.now() < saved.expiresAt - 60_000) return { apiKey, token: saved.accessToken };
  } catch {}
  const r = await dimFetch<{ accessToken: string; expiresInSeconds: number }>("/auth/token", {
    body: { bungieAccessToken: await accessToken(), membershipId: tokens.membership_id },
    headers: { "X-API-Key": apiKey },
  });
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken: r.accessToken, expiresAt: Date.now() + r.expiresInSeconds * 1000, membership: tokens.membership_id }));
  return { apiKey, token: r.accessToken };
}

export const clearDimToken = () => sessionStorage.removeItem(TOKEN_KEY);

export const fetchDimData = (want: { tags: boolean; loadouts: boolean }) => readDimProfile(dimCall, primaryMembership, want);

export const setDimTag = (itemId: string, tag: DimTagValue | null, notes?: string | null) => writeDimTag(dimCall, primaryMembership, itemId, tag, notes);

/** Any DIM API call as the signed-in player (the Builds tab reads and saves loadouts with it). */
export const dimCall: DimCall = async (path, body) => {
  const { apiKey, token } = await dimAuth();
  return dimFetch(path, { body, headers: { "X-API-Key": apiKey, Authorization: `Bearer ${token}` } });
};
