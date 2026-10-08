import { bungieEnv, paths, readJson, writeJson } from "../config.js";
export const BUNGIE = "https://www.bungie.net";
const PLATFORM = `${BUNGIE}/Platform`;
export function loadTokens() {
    return readJson(paths.tokens, null);
}
export function saveTokens(raw) {
    const now = Date.now();
    const tokens = {
        access_token: raw.access_token,
        refresh_token: raw.refresh_token,
        access_expires_at: now + raw.expires_in * 1000,
        refresh_expires_at: now + raw.refresh_expires_in * 1000,
        membership_id: raw.membership_id,
    };
    writeJson(paths.tokens, tokens);
    return tokens;
}
export async function tokenRequest(body) {
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
    if (!res.ok)
        throw new Error(`Bungie token request failed: ${res.status} ${await res.text()}`);
    return saveTokens(await res.json());
}
export async function accessToken() {
    let tokens = loadTokens();
    if (!tokens)
        throw new Error("Not logged in. Call the login tool first.");
    if (Date.now() > tokens.access_expires_at - 60_000) {
        if (Date.now() > tokens.refresh_expires_at)
            throw new Error("Bungie login expired. Call the login tool again.");
        tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
    }
    return tokens.access_token;
}
export class BungieError extends Error {
    errorCode;
    errorStatus;
    throttleSeconds;
    constructor(errorCode, errorStatus, message, throttleSeconds = 0) {
        super(`${errorStatus} (${errorCode}): ${message}`);
        this.errorCode = errorCode;
        this.errorStatus = errorStatus;
        this.throttleSeconds = throttleSeconds;
    }
}
/** Call a Bungie Platform endpoint and unwrap `Response`. */
export async function bungie(path, init = {}) {
    const env = bungieEnv();
    const headers = { "X-API-Key": env.apiKey };
    if (init.auth !== false)
        headers.Authorization = `Bearer ${await accessToken()}`;
    if (init.body !== undefined)
        headers["Content-Type"] = "application/json";
    const res = await fetch(`${PLATFORM}${path}`, {
        method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const json = (await res.json().catch(() => null));
    if (!json)
        throw new Error(`Bungie ${path} returned ${res.status} with no JSON body`);
    if (json.ErrorCode !== 1)
        throw new BungieError(json.ErrorCode, json.ErrorStatus, json.Message, json.ThrottleSeconds);
    return json.Response;
}
export const bungieUrl = (path) => (path ? (path.startsWith("http") ? path : BUNGIE + path) : "");
//# sourceMappingURL=client.js.map