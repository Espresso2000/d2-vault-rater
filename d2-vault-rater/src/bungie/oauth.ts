import { randomBytes } from "node:crypto";
import { bungieEnv, paths, readJson, writeJson } from "../config.js";
import { bungie, loadTokens, tokenRequest } from "./client.js";
import { join } from "node:path";

const stateFile = () => join(paths.home, "oauth-state.json");

/** Step 1: the URL the player opens to approve access. */
export function startLogin(): string {
  const env = bungieEnv();
  if (!env.clientId) throw new Error("BUNGIE_CLIENT_ID is not set.");
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
export async function finishLogin(redirectedUrl: string): Promise<{ membershipId: string; displayName: string }> {
  const url = new URL(redirectedUrl.trim());
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = readJson<{ state: string } | null>(stateFile(), null);
  if (!code) throw new Error("That URL has no ?code= parameter. Copy the full address after approving on bungie.net.");
  if (!saved || saved.state !== state) throw new Error("Login state does not match. Start the login again.");
  const tokens = await tokenRequest({ grant_type: "authorization_code", code });
  const me = await bungie<{ bungieNetUser: { displayName: string } }>("/User/GetMembershipsForCurrentUser/");
  return { membershipId: tokens.membership_id, displayName: me.bungieNetUser.displayName };
}

export interface DestinyMembership {
  membershipType: number;
  membershipId: string;
  crossSaveOverride: number;
  displayName: string;
}

let cached: { account: string; who: Promise<DestinyMembership> } | null = null;

/** The Destiny account to read: the cross-save primary when there is one. Asked once per Bungie account. */
export function primaryMembership(): Promise<DestinyMembership> {
  const account = loadTokens()?.membership_id ?? "";
  if (cached?.account !== account) {
    const who = bungie<{ destinyMemberships: DestinyMembership[]; primaryMembershipId?: string }>("/User/GetMembershipsForCurrentUser/").then((r) => {
      const ms = r.destinyMemberships;
      if (!ms.length) throw new Error("This Bungie account has no Destiny 2 profile.");
      return (
        ms.find((m) => m.membershipId === r.primaryMembershipId) ??
        ms.find((m) => m.crossSaveOverride !== 0 && m.crossSaveOverride === m.membershipType) ??
        ms[0]
      );
    });
    cached = { account, who };
    who.catch(() => cached?.who === who && (cached = null));
  }
  return cached.who;
}
