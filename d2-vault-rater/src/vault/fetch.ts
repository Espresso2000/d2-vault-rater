import { bungie } from "../bungie/client.js";
import { loadManifest } from "../bungie/manifest.js";
import { primaryMembership } from "../bungie/oauth.js";
import { decodeProfile, PROFILE_COMPONENTS, type RawProfile } from "./decode.js";
import type { Vault } from "./types.js";

let last: Vault | null = null;

export async function fetchVault(): Promise<Vault> {
  const m = await loadManifest();
  const who = await primaryMembership();
  const raw = await bungie<RawProfile>(
    `/Destiny2/${who.membershipType}/Profile/${who.membershipId}/?components=${PROFILE_COMPONENTS.join(",")}`,
  );
  last = decodeProfile(raw, m);
  return last;
}

/** The vault from the last fetch in this session, fetching if there is none. */
export async function currentVault(): Promise<Vault> {
  return last ?? fetchVault();
}
