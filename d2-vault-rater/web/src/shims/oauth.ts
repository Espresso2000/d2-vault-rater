/** Browser version of src/bungie/oauth.ts: Bungie's OAuth redirect lands back on this page. */
import { bungieEnv } from "./config";
import { bungie, tokenRequest } from "./client";

const STATE = "vr-oauth-state";

/** Step 1: the URL that asks the player to approve access. */
export function startLogin(): string {
  const env = bungieEnv();
  if (!env.clientId) throw new Error("This site has no Bungie OAuth client id configured yet.");
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  sessionStorage.setItem(STATE, state);
  // Remember the tab the player was on, to come back to it.
  sessionStorage.setItem("vr-return-hash", location.hash);
  const url = new URL("https://www.bungie.net/en/OAuth/Authorize");
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

/** Step 2: exchange the ?code= Bungie sent back for a token. */
export async function finishLogin(redirectedUrl: string): Promise<{ membershipId: string; displayName: string }> {
  const url = new URL(redirectedUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = sessionStorage.getItem(STATE);
  sessionStorage.removeItem(STATE);
  if (!code) throw new Error("Bungie sent no sign-in code back. Try signing in again.");
  if (!saved || saved !== state) throw new Error("The sign-in reply doesn't match this browser tab. Try signing in again.");
  const tokens = await tokenRequest({ grant_type: "authorization_code", code });
  cachedMembership = null;
  const me = await bungie<{ bungieNetUser: { displayName: string } }>("/User/GetMembershipsForCurrentUser/");
  return { membershipId: tokens.membership_id, displayName: me.bungieNetUser.displayName };
}

export interface DestinyMembership {
  membershipType: number;
  membershipId: string;
  crossSaveOverride: number;
  displayName: string;
}

let cachedMembership: Promise<DestinyMembership> | null = null;

/** The Destiny account to read: the cross-save primary when there is one. Asked once per visit. */
export function primaryMembership(): Promise<DestinyMembership> {
  cachedMembership ??= bungie<{ destinyMemberships: DestinyMembership[]; primaryMembershipId?: string }>("/User/GetMembershipsForCurrentUser/").then((r) => {
    const ms = r.destinyMemberships;
    if (!ms.length) throw new Error("This Bungie account has no Destiny 2 profile.");
    return (
      ms.find((m) => m.membershipId === r.primaryMembershipId) ??
      ms.find((m) => m.crossSaveOverride !== 0 && m.crossSaveOverride === m.membershipType) ??
      ms[0]
    );
  });
  cachedMembership.catch(() => (cachedMembership = null));
  return cachedMembership;
}
