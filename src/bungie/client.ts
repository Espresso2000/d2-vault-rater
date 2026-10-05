import { bungieEnv, paths, readJson, writeJson } from "../config.js";

export const BUNGIE = "https://www.bungie.net";
const PLATFORM = `${BUNGIE}/Platform`;

export interface Tokens {
  access_token: string;
  refresh_token: string;
  /** epoch ms */
  access_expires_at: number;
  refresh_expires_at: number;
  membership_id: string;
}

export function loadTokens(): Tokens | null {
  return readJson<Tokens | null>(paths.tokens, null);
}

export function saveTokens(raw: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  membership_id: string;
}): Tokens {
  const now = Date.now();
  const tokens: Tokens = {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    access_expires_at: now + raw.expires_in * 1000,
    refresh_expires_at: now + raw.refresh_expires_in * 1000,
    membership_id: raw.membership_id,
  };
  writeJson(paths.tokens, tokens);
  return tokens;
}

export async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const env = bungieEnv();
  const res = await fetch(`${PLATFORM}/App/OAuth/Token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-Key": env.apiKey,
      Authorization: "Basic " + Buffer.from(`${env.clientId}:${env.clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`Bungie token request failed: ${res.status} ${await res.text()}`);
  return saveTokens(await res.json());
}

export async function accessToken(): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) throw new Error("Not logged in. Call the login tool first.");
  if (Date.now() > tokens.access_expires_at - 60_000) {
    if (Date.now() > tokens.refresh_expires_at) throw new Error("Bungie login expired. Call the login tool again.");
    tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
  }
  return tokens.access_token;
}

export class BungieError extends Error {
  constructor(public errorCode: number, public errorStatus: string, message: string, public throttleSeconds = 0) {
    super(`${errorStatus} (${errorCode}): ${message}`);
  }
}

/** Call a Bungie Platform endpoint and unwrap `Response`. */
export async function bungie<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const env = bungieEnv();
  const headers: Record<string, string> = { "X-API-Key": env.apiKey };
  if (init.auth !== false) headers.Authorization = `Bearer ${await accessToken()}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${PLATFORM}${path}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as
    | { Response: T; ErrorCode: number; ErrorStatus: string; Message: string; ThrottleSeconds: number }
    | null;
  if (!json) throw new Error(`Bungie ${path} returned ${res.status} with no JSON body`);
  if (json.ErrorCode !== 1) throw new BungieError(json.ErrorCode, json.ErrorStatus, json.Message, json.ThrottleSeconds);
  return json.Response;
}

export const bungieUrl = (path: string | undefined | null): string => (path ? (path.startsWith("http") ? path : BUNGIE + path) : "");
