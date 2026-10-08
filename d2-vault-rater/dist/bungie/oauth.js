import { randomBytes } from "node:crypto";
import { bungieEnv, paths, readJson, writeJson } from "../config.js";
import { bungie, tokenRequest } from "./client.js";
import { join } from "node:path";
const stateFile = () => join(paths.home, "oauth-state.json");
/** Step 1: the URL the player opens to approve access. */
export function startLogin() {
    const env = bungieEnv();
    if (!env.clientId)
        throw new Error("BUNGIE_CLIENT_ID is not set.");
    const state = randomBytes(16).toString("hex");
    writeJson(stateFile(), { state, createdAt: Date.now() });
    const url = new URL("https://www.bungie.net/en/OAuth/Authorize");
    url.searchParams.set("client_id", env.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return url.toString();
}
/**
 * Step 2: the player pastes the URL their browser landed on (the redirect page may not load;
 * the code is in the address bar).
 */
export async function finishLogin(redirectedUrl) {
    const url = new URL(redirectedUrl.trim());
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const saved = readJson(stateFile(), null);
    if (!code)
        throw new Error("That URL has no ?code= parameter. Copy the full address after approving on bungie.net.");
    if (!saved || saved.state !== state)
        throw new Error("Login state does not match. Start the login again.");
    const tokens = await tokenRequest({ grant_type: "authorization_code", code });
    const me = await bungie("/User/GetMembershipsForCurrentUser/");
    return { membershipId: tokens.membership_id, displayName: me.bungieNetUser.displayName };
}
/** The Destiny account to read: the cross-save primary when there is one. */
export async function primaryMembership() {
    const r = await bungie("/User/GetMembershipsForCurrentUser/");
    const ms = r.destinyMemberships;
    if (!ms.length)
        throw new Error("This Bungie account has no Destiny 2 profile.");
    return (ms.find((m) => m.membershipId === r.primaryMembershipId) ??
        ms.find((m) => m.crossSaveOverride !== 0 && m.crossSaveOverride === m.membershipType) ??
        ms[0]);
}
//# sourceMappingURL=oauth.js.map