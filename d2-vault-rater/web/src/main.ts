/**
 * Vault Rater in the browser: sign in with Bungie, read the vault, rate it with the same code as the
 * local app (../../src), and render the same report page. Nothing runs on a server.
 */
import { hydrate, paths, readText } from "./shims/config";
import { loadTokens, clearTokens, LoginRequired, minutesLeft } from "./shims/client";
import { startLogin, finishLogin } from "./shims/oauth";
import { clearDimToken, fetchDimData, withDimKeep, setDimTag, DIM_TAGS, type DimTagValue, type DimData } from "./shims/sync";
import { appConfig, configured, loadServedConfig, redirectUrl, saveLocalConfig } from "./appConfig";
import { loadLiteManifest } from "./manifest";
import { ensureSources } from "./sources";
import { fetchVault } from "../../src/vault/fetch.js";
import { fetchWrapped } from "../../src/vault/wrapped.js";
import { loadAegis } from "../../src/sources/aegis.js";
import { loadWishlists } from "../../src/sources/wishlist.js";
import { loadArmorSets } from "../../src/sources/armorSets.js";
import { buildSourceLookup, loadActivityLoot } from "../../src/sources/activities.js";
import { applyPageSettings, loadSettings, saveSettings } from "../../src/rating/settings.js";
import { rateWeapons } from "../../src/rating/weapons.js";
import { rateArmor } from "../../src/rating/armor.js";
import { rateActivities } from "../../src/rating/activities.js";
import { planEncounters } from "../../src/rating/encounters.js";
import { planDimActions, applyDimActions, undoDimActions, type DimPlan } from "../../src/dim/actions.js";
import { moveItems } from "../../src/bungie/transfer.js";
import { buildSiteData } from "../../src/report/siteData.js";
import { loadBuilds } from "./builds/store";
import { esc } from "./html";
import type { BuildsInput } from "./builds/ui";

declare global {
  interface Window {
    VR_LOCAL?: boolean;
    VR_WEB?: boolean;
    VR_API?: (path: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>;
    VR_START?: (data: unknown, images: Record<string, string>) => void;
    VR_SESSION?: () => string;
  }
}

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;

/* ---------- Shell (sign-in, setup, progress) ---------- */
function shell(html: string) {
  document.body.classList.add("vr-booting");
  $("#vr-shell").hidden = false;
  $("#vr-shell-body").innerHTML = html;
}
const log = (s: string) => {
  const li = document.createElement("li");
  li.textContent = s;
  $("#vr-log").append(li);
};

function showSignIn(message = "") {
  shell(`${message ? `<p class="vr-err">${esc(message)}</p>` : ""}
    <p class="lede">Sign in with your Bungie account. Vault Rater reads your vault and rates every weapon and armor piece against Aegis's tier list.
    It never changes anything in game until you preview a change and confirm it.</p>
    <div class="vr-actions"><button class="btn primary" id="vr-signin">Sign in with Bungie</button></div>
    ${appConfig().tokenEndpoint ? "" : `<p class="small muted">Bungie keeps you signed in for about an hour; after that this page asks you to sign in again.</p>`}`);
  $("#vr-signin").onclick = () => {
    try {
      location.href = startLogin();
    } catch (e) {
      showSignIn((e as Error).message);
    }
  };
}

function showSetup(message = "") {
  const c = appConfig();
  shell(`${message ? `<p class="vr-err">${esc(message)}</p>` : ""}
    <p class="lede">This copy of Vault Rater isn't connected to a Bungie app yet. Create one at
    <a href="https://www.bungie.net/en/Application" target="_blank" rel="noopener">bungie.net/en/Application</a> with these settings, then paste its keys here.</p>
    <dl class="vr-setup">
      <dt>OAuth client type</dt><dd><b>Public</b></dd>
      <dt>Redirect URL</dt><dd><code>${esc(redirectUrl())}</code></dd>
      <dt>Origin header</dt><dd><code>${esc(location.origin)}</code></dd>
      <dt>Scopes</dt><dd>Read your Destiny 2 information; Move or equip your gear</dd>
    </dl>
    <form id="vr-setup" class="vr-form">
      <label>API key <input name="bungieApiKey" value="${esc(c.bungieApiKey)}" autocomplete="off" required></label>
      <label>OAuth client_id <input name="bungieClientId" value="${esc(c.bungieClientId)}" autocomplete="off" inputmode="numeric" required></label>
      <div class="vr-actions"><button class="btn primary">Save</button></div>
    </form>
    <p class="small muted">These aren't secrets: a Public client has no secret, and Bungie only accepts the key from this site's origin. They are saved in this browser only.</p>`);
  $<HTMLFormElement>("#vr-setup").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    saveLocalConfig({ bungieApiKey: String(f.get("bungieApiKey")), bungieClientId: String(f.get("bungieClientId")) });
    location.reload();
  };
}

function showError(e: unknown) {
  if (e instanceof LoginRequired) return showSignIn(e.message);
  shell(`<p class="vr-err">${esc((e as Error).message || e)}</p>
    <div class="vr-actions"><button class="btn primary" onclick="location.reload()">Try again</button><button class="btn" id="vr-out">Sign out</button></div>`);
  $("#vr-out").onclick = signOut;
}

function signOut() {
  clearTokens();
  clearDimToken();
  location.hash = "";
  location.reload();
}

/** Shown over the report when the hour-long Bungie sign-in runs out mid-visit. */
function expiredBanner(message: string) {
  const b = $("#vr-banner");
  b.innerHTML = `<span>${esc(message)}</span><button class="btn primary" id="vr-resign">Sign in again</button>`;
  b.hidden = false;
  $("#vr-resign").onclick = () => (location.href = startLogin());
}

/* ---------- Rating run ---------- */
let currentPlan: DimPlan | null = null;

async function run() {
  shell(`<p class="lede">Rating your vault…</p>`);
  $("#vr-log").innerHTML = "";
  const settings = loadSettings();
  const m = await loadLiteManifest(log);
  const status = await ensureSources(m, settings, log);
  const aegis = loadAegis();
  if (!aegis) throw new Error("Aegis's tier list could not be loaded.");

  // Wrapped only needs the manifest: fetch it alongside the vault instead of after rating.
  const wrappedP = fetchWrapped(m).catch(() => null);
  log("Reading your vault…");
  const vault = await fetchVault();
  let dim: DimData | null = null;
  let dimError: string | null = null;
  if (settings.dim.tags || settings.dim.loadouts) {
    log(`Reading DIM ${[settings.dim.tags && "tags", settings.dim.loadouts && "loadouts"].filter(Boolean).join(" and ")}…`);
    dim = await fetchDimData(settings.dim).catch((e) => ((dimError = (e as Error).message), null));
  }
  const rated = withDimKeep(settings, dim);

  log("Rating weapons and armor…");
  const w = rateWeapons(vault.weapons, { manifest: m, aegis, wishlists: loadWishlists() }, rated);
  const a = rateArmor(vault, rated, loadArmorSets());
  const plan = (currentPlan = planDimActions(vault, w, a, rated));
  const loot = loadActivityLoot();
  const activities = loot ? rateActivities(loot, aegis, w.ratings, a.ratings, loadArmorSets()) : [];
  log("Reading your account stats for Wrapped…");
  const wrapped = await wrappedP;

  // Images load straight from bungie.net, so each key is just the URL.
  const images: Record<string, string> = {};
  const key = (url: string | null | undefined) => (url ? (images[url] = url) : null);
  const data = buildSiteData(w, a, {
    vaultSize: vault.weapons.length + vault.armor.length,
    settings: rated,
    searches: plan.searches,
    vault,
    wrapped,
    activities,
    sourceOf: await buildSourceLookup(m, aegis, loot),
    encounters: planEncounters(w.ratings),
    dim,
    dimError,
    plan,
    // Images load lazily from bungie.net, so every weapon can have its screenshot (type card banners, the drawer).
    allScreenshots: true,
  }, key, loadArmorSets());

  document.title = `${wrapped?.name ? wrapped.name + "’s" : "Your"} Vault Report`;
  $("#vr-shell").hidden = true;
  if (status.warnings.length) console.warn("Vault Rater sources:", status.warnings);
  const back = sessionStorage.getItem("vr-return-hash");
  if (back) (sessionStorage.removeItem("vr-return-hash"), history.replaceState(null, "", back));
  lazyBuilds({ vault, data, manifest: m });
  window.VR_START!(data, images);
  watchSession();
}

/** The Builds tab is its own chunk: the report draws first while the tab's code loads in the background. */
function lazyBuilds(input: BuildsInput) {
  // initBuilds swaps in the real VR_BUILDS, so render below reaches the loaded tab.
  const ready = import("./builds/ui").then((b) => b.initBuilds(input));
  window.VR_BUILDS = { count: () => loadBuilds().length || null, render: (el) => void ready.then(() => window.VR_BUILDS!.render(el)) };
}

/** Sign-in status for the Settings panel, and a banner once Bungie access really runs out. */
function watchSession() {
  const canRefresh = () => {
    const t = loadTokens();
    return !!t?.refresh_token && Date.now() < t.refresh_expires_at;
  };
  window.VR_SESSION = () => (canRefresh() ? "Signed in to Bungie; this browser renews the sign-in by itself." : minutesLeft() > 0 ? `Signed in to Bungie for ${minutesLeft()} more minutes.` : "Your Bungie sign-in has expired.");
  const tick = () => {
    if (!canRefresh() && minutesLeft() <= 0) expiredBanner("Your Bungie sign-in expired. Sign in again to move items, change locks or edit DIM tags.");
  };
  tick();
  setInterval(tick, 30_000);
}

/* ---------- What the report page's buttons call (instead of the local server) ---------- */
window.VR_LOCAL = true;
window.VR_WEB = true;
window.VR_API = async (path, body) => {
  try {
    switch (path) {
      case "/api/refresh":
        // The page reloads after this, which re-reads the vault and re-rates.
        return { ok: true };
      case "/api/signout":
        signOut();
        return { ok: true };
      case "/api/settings": {
        const st = applyPageSettings(loadSettings(), body);
        saveSettings(st);
        return { ok: true, dim: st.dim };
      }
      case "/api/tag": {
        const tag = body.tag === null || DIM_TAGS.includes(body.tag as DimTagValue) ? (body.tag as DimTagValue | null) : undefined;
        if (typeof body.id !== "string" || tag === undefined) return { ok: false, error: "Send an item id and a DIM tag (or null to clear)." };
        await setDimTag(body.id, tag, typeof body.notes === "string" || body.notes === null ? (body.notes as string | null) : undefined);
        return { ok: true };
      }
      case "/api/move": {
        const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
        if (!ids.length || typeof body.to !== "string") return { ok: false, error: "Send item ids and a destination." };
        return { ok: true, results: await moveItems(ids, body.to, { equip: body.equip === true }) };
      }
      case "/api/locks/apply": {
        // Only the plan the page previewed, and only with the explicit confirmation.
        if (body.confirm !== true || !currentPlan || body.planId !== currentPlan.id) return { ok: false, error: "Preview the current plan and confirm it first." };
        const r = await applyDimActions(currentPlan.id);
        return { ok: true, ...r, csv: readText(`${paths.plansDir}/${currentPlan.id}-dim-tags.csv`) };
      }
      case "/api/locks/undo":
        if (typeof body.planId !== "string") return { ok: false, error: "Send the plan id to undo." };
        return { ok: true, ...(await undoDimActions(body.planId)) };
      default:
        return { ok: false, error: `Unknown action ${path}` };
    }
  } catch (e) {
    if (e instanceof LoginRequired) expiredBanner(e.message);
    return { ok: false, error: (e as Error).message };
  }
};

/* ---------- Boot ---------- */
async function boot() {
  await Promise.all([hydrate().catch(() => {}), loadServedConfig()]);
  if (!configured()) return showSetup();
  const url = new URL(location.href);
  if (url.searchParams.has("code") || url.searchParams.has("error")) {
    history.replaceState(null, "", redirectUrl() + (sessionStorage.getItem("vr-return-hash") || ""));
    if (url.searchParams.has("error")) return showSignIn(`Bungie sign-in was cancelled (${url.searchParams.get("error")}).`);
    try {
      shell(`<p class="lede">Finishing sign-in…</p>`);
      await finishLogin(url.href);
    } catch (e) {
      return showSignIn((e as Error).message);
    }
  }
  const t = loadTokens();
  if (!t || Date.now() > t.access_expires_at - 60_000) return showSignIn(t ? "Your Bungie sign-in has expired. Sign in again to continue." : "");
  try {
    await run();
  } catch (e) {
    console.error(e);
    showError(e);
  }
}

void boot();
