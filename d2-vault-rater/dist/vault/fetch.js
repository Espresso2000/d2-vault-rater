import { bungie } from "../bungie/client.js";
import { loadManifest } from "../bungie/manifest.js";
import { primaryMembership } from "../bungie/oauth.js";
import { decodeProfile, PROFILE_COMPONENTS } from "./decode.js";
let last = null;
export async function fetchVault() {
    const m = await loadManifest();
    const who = await primaryMembership();
    const raw = await bungie(`/Destiny2/${who.membershipType}/Profile/${who.membershipId}/?components=${PROFILE_COMPONENTS.join(",")}`);
    last = decodeProfile(raw, m);
    return last;
}
/** The vault from the last fetch in this session, fetching if there is none. */
export async function currentVault() {
    return last ?? fetchVault();
}
export function setVault(v) {
    last = v;
}
//# sourceMappingURL=fetch.js.map