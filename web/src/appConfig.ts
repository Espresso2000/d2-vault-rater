import built from "../app.config.json";

/**
 * The Bungie app this site talks to. Nothing here is secret: a public OAuth client has no secret,
 * the API key is locked to this site's origin on bungie.net, and the DIM key is locked to the origin too.
 * Values in app.config.json are baked in at build time; the setup screen can override them per browser.
 */
export interface AppConfig {
  bungieApiKey: string;
  bungieClientId: string;
  /** Optional: a DIM API key registered for this origin. Registered on first use when empty. */
  dimApiKey: string;
}

const KEY = "vr-app-config";

export function appConfig(): AppConfig {
  let local: Partial<AppConfig> = {};
  try {
    local = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {}
  const pick = (k: keyof AppConfig) => (local[k] || (built as Partial<AppConfig>)[k] || "").trim();
  return { bungieApiKey: pick("bungieApiKey"), bungieClientId: pick("bungieClientId"), dimApiKey: pick("dimApiKey") };
}

export function saveLocalConfig(c: Partial<AppConfig>): void {
  localStorage.setItem(KEY, JSON.stringify(c));
}

export const configured = () => {
  const c = appConfig();
  return !!(c.bungieApiKey && c.bungieClientId);
};

/** Where Bungie sends the player back after approving: this page, without query or hash. */
export const redirectUrl = () => location.origin + location.pathname;
