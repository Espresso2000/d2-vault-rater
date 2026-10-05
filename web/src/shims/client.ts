/**
 * Browser version of src/bungie/client.ts. Tokens live in localStorage. A public OAuth client gets
 * no refresh token, so when the access token runs out (about an hour) the player signs in again.
 */
import { bungieEnv } from "./config";

export const BUNGIE = "https://www.bungie.net";
const PLATFORM = `${BUNGIE}/Platform`;
const KEY = "vr-tokens";

export interface Tokens {
  access_token: string;
  refresh_token: string;
  /** epoch ms */
  access_expires_at: number;
  refresh_expires_at: number;
  membership_id: string;
}

/** Thrown when the player has to sign in (again). The app shows its sign-in screen for it. */
export class LoginRequired extends Error {
  constructor(message = "Your Bungie sign-in has expired. Sign in again to continue.") {
    super(message);
  }
}

export function loadTokens(): Tokens | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function clearTokens(): void {
  localStorage.removeItem(KEY);
}

export function saveTokens(raw: { access_token: string; refresh_token?: string; expires_in: number; refresh_expires_in?: number; membership_id: string }): Tokens {
  const now = Date.now();
  const tokens: Tokens = {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token ?? "",
    access_expires_at: now + raw.expires_in * 1000,
    refresh_expires_at: raw.refresh_token && raw.refresh_expires_in ? now + raw.refresh_expires_in * 1000 : now + raw.expires_in * 1000,
    membership_id: raw.membership_id,
  };
  localStorage.setItem(KEY, JSON.stringify(tokens));
  return tokens;
}

export async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const env = bungieEnv();
  const res = await fetch(`${PLATFORM}/App/OAuth/Token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-API-Key": env.apiKey },
    // Public client: the client id goes in the body and there is no secret.
    body: new URLSearchParams({ ...body, client_id: env.clientId }).toString(),
  });
  if (!res.ok) throw new Error(`Bungie sign-in failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return saveTokens(await res.json());
}

/** Minutes of sign-in left, or 0. */
export const minutesLeft = () => Math.max(0, Math.floor(((loadTokens()?.access_expires_at ?? 0) - Date.now()) / 60_000));

export async function accessToken(): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) throw new LoginRequired("Sign in with Bungie to continue.");
  if (Date.now() > tokens.access_expires_at - 60_000) {
    if (!tokens.refresh_token || Date.now() > tokens.refresh_expires_at) throw new LoginRequired();
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
  if (res.status === 401) throw new LoginRequired();
  const json = (await res.json().catch(() => null)) as
    | { Response: T; ErrorCode: number; ErrorStatus: string; Message: string; ThrottleSeconds: number }
    | null;
  if (!json) throw new Error(`Bungie ${path} returned ${res.status} with no JSON body`);
  // 99 WebAuthRequired, 22 WebAuthModuleAsyncFailed, 2111/2112 access token invalid/expired
  if ([99, 22, 2111, 2112].includes(json.ErrorCode)) throw new LoginRequired();
  if (json.ErrorCode !== 1) throw new BungieError(json.ErrorCode, json.ErrorStatus, json.Message, json.ThrottleSeconds);
  return json.Response;
}

export const bungieUrl = (path: string | undefined | null): string => (path ? (path.startsWith("http") ? path : BUNGIE + path) : "");
