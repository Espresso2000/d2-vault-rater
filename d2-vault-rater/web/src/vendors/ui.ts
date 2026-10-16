/**
 * The Vendors tab: what every vendor sells right now, rated like the vault and marked Buy, Maybe or
 * Skip against what you already own. Rows open to show every perk column, the reasons and the price.
 * Rendered into the report's #p-vendors panel; vendor stock is read from Bungie when the tab first opens.
 */
import "./vendors.css";
import type { Manifest } from "../../../src/bungie/defs.js";
import type { AegisData } from "../../../src/sources/aegis.js";
import { loadArmorSets } from "../../../src/sources/armorSets.js";
import { loadWishlists } from "../../../src/sources/wishlist.js";
import type { Settings } from "../../../src/rating/settings.js";
import type { ArmorRating } from "../../../src/rating/armor.js";
import type { WeaponRating } from "../../../src/rating/weapons.js";
import type { Vault } from "../../../src/vault/types.js";
import { fetchVendors } from "../../../src/vendors/vendors.js";
import { rateVendors, type Buy, type RatedSale, type RatedVendor } from "../../../src/vendors/rate.js";
import { BRIGHT_DUST, type Offer, type VendorCost } from "../../../src/vendors/vendors.js";
import { LoginRequired } from "../shims/client";
import { esc } from "../html";
import { loadingBlock } from "../loading";

export interface VendorsInput {
  vault: Vault;
  manifest: Manifest;
  aegis: AegisData;
  settings: Settings;
}

declare global {
  interface Window {
    VR_VENDORS?: { render: (el: HTMLElement) => void; count: () => number | null };
    /** The page's hover card asks for a vendor item by its data-vt id. */
    VR_TIP?: (id: string) => { w?: object; a?: object } | null;
  }
}

let input: VendorsInput;
let panel: HTMLElement | null = null;
let charId = "";
/** Rated stock by character id; a character's stock is read once per visit unless refreshed. */
const stock = new Map<string, RatedVendor[]>();
let loading: Promise<void> | null = null;
let error = "";
type Kind = "weapons" | "armor" | "eververse";
let kind: Kind = "weapons";
/** The vendor shown, by hash; "" shows every vendor. */
let vendor = "";
let onlyBuy = false;
/** Sections the player collapsed (vendor hashes, or "daily" / "dust" for Eververse), kept between visits. */
let closed = new Set<string>();

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export function initVendors(i: VendorsInput) {
  input = i;
  const saved = store.get("vr-vendors-char");
  charId = i.vault.characters.find((c) => c.id === saved)?.id ?? i.vault.characters[0]?.id ?? "";
  const k = store.get("vr-vendors-kind");
  kind = k === "armor" || k === "eververse" ? k : "weapons";
  onlyBuy = store.get("vr-vendors-buy") === "1";
  try { closed = new Set(JSON.parse(store.get("vr-vendors-closed") || "[]") as string[]); } catch { /* keep all open */ }
  window.VR_VENDORS = { render, count: () => buyCount() };
  window.VR_TIP = (id) => tips.get(id) ?? null;
}

/** Each drawn card's item in the report's own shape, so the page's hover card can show it like vault gear. */
const tips = new Map<string, { w?: object; a?: object }>();
const tipFor = (item: { w?: object; a?: object }) => {
  const id = `v${tips.size}`;
  tips.set(id, item);
  return id;
};
const weaponTip = (r: WeaponRating, rolled: boolean) => {
  const good = goodSet(r);
  return {
    w: {
      id: r.instanceId, n: r.name, e: r.element, t: r.type, f: r.frame, r: r.rarity, gt: r.gearTier,
      sc: r.score, rs: r.rollScore, v: r.verdict, tier: r.aegis?.tier ?? null, rank: r.aegis?.rank ?? null, tab: r.aegis?.tab ?? "", rmw: r.recMasterwork,
      // Before purchase the roll isn't decided, so there are no perks to show.
      pk: rolled ? r.perks.map((p) => ({ k: p.kind, a: p.active, o: p.options, m: p.options.filter((o) => good.has(o)) })) : [],
      pi: Object.assign({}, ...r.perks.map((p) => p.icons ?? {})),
    },
  };
};
const armorTip = (a: ArmorRating) => ({
  a: {
    id: a.instanceId, n: a.name, cls: a.classType, s: a.slot, r: a.rarity, gt: a.gearTier, arch: a.archetype,
    st: a.topStats.map((t) => [t.name, t.value]), tot: a.statTotal, set: a.setName, si: a.setInfo, sc: a.score, v: a.verdict,
  },
});

const buyCount = () => {
  const list = stock.get(charId);
  return list ? list.reduce((n, v) => n + v.weapons.filter((s) => s.buy === "buy").length, 0) || null : null;
};

function render(el: HTMLElement) {
  panel = el;
  if (!el.dataset.wired) wire(el);
  if (!stock.has(charId) && !error) void load();
  draw();
}

async function load(force = false) {
  if (loading) return loading;
  const id = charId;
  if (force) stock.delete(id);
  error = "";
  draw();
  loading = (async () => {
    try {
      const raw = await fetchVendors(id);
      stock.set(id, rateVendors(raw, input.vault, { aegis: input.aegis, wishlists: loadWishlists(), manifest: input.manifest, armorSets: loadArmorSets() }, input.settings));
      // The tab's count (weapons worth buying) is only known once stock is read.
      const tab = document.querySelector("#t-vendors");
      tab?.querySelector(".count")?.remove();
      const count = buyCount();
      if (tab && count) tab.insertAdjacentHTML("beforeend", `<span class="count">${count}</span>`);
    } catch (e) {
      console.error(e);
      error = e instanceof LoginRequired ? "Your Bungie sign-in expired. Sign in again (Re-rate) to read vendor stock." : `Couldn't read vendor stock: ${(e as Error).message}`;
    } finally {
      loading = null;
      // The character changed while this one was reading: read theirs too.
      if (!stock.has(charId) && !error) void load();
      draw();
    }
  })();
  return loading;
}

/* ---------- Drawing ---------- */
const BUY_LABEL: Record<Buy, string> = { buy: "Worth buying", maybe: "Maybe", skip: "Skip" };
const COL: Record<string, string> = { barrel: "Barrel", magazine: "Magazine", perk1: "Trait 1", perk2: "Trait 2", origin: "Origin", other: "Other" };
const PERK_ORDER = ["barrel", "magazine", "perk1", "perk2", "origin"];
const rank = (k: string) => (PERK_ORDER.includes(k) ? PERK_ORDER.indexOf(k) : 99);

const img = (src: string, cls = "") => (src ? `<img${cls ? ` class="${cls}"` : ""} src="${esc(src)}" alt="" loading="lazy" decoding="async">` : `<span class="ph"></span>`);
const buyBadge = (b: Buy) => `<span class="vbuy ${b}">${BUY_LABEL[b]}</span>`;
const tierBadge = (r: WeaponRating) => `<span class="tier t${r.aegis?.tier ?? "U"}" title="${r.aegis ? `Aegis ${r.aegis.tier} tier${r.aegis.rank ? ` #${r.aegis.rank}` : ""} ${esc(r.aegis.tab)}` : "Not on Aegis's sheet"}">${r.aegis?.tier ?? "—"}</span>`;
const elDot = (e: string) => `<span class="el" style="color:var(--${esc(e)})"><i></i><span>${esc(e)}</span></span>`;
const score = (n: number) => `<b class="vsc num${n >= 90 ? " hi" : ""}">${n}</b>`;

/** "3 days", "5 h" or "under an hour" until an ISO time; "" once it has passed. */
function timeLeft(iso: string | null) {
  if (!iso) return "";
  const ms = Date.parse(iso) - Date.now();
  if (!(ms > 0)) return "";
  const h = Math.round(ms / 3_600_000);
  return h >= 48 ? `${Math.round(h / 24)} days` : h >= 1 ? `${h} h` : "under an hour";
}

const goodSet = (r: WeaponRating) => new Set(Object.values(r.matched).flat() as string[]);
const perkIcon = (name: string, src: string | undefined, cls: string) =>
  src ? `<span class="${cls} pico" title="${esc(name)}"><img src="${esc(src)}" alt="${esc(name)}" loading="lazy" decoding="async"></span>` : `<span class="${cls}">${esc(name)}</span>`;
const price = (costs: VendorCost[]) =>
  costs.map((c) => `<span class="vprice">${c.icon ? `<img src="${esc(c.icon)}" alt="" title="${esc(c.name)}">` : ""}${c.quantity.toLocaleString()}${c.icon ? "" : " " + esc(c.name)}</span>`).join("");

/** A weapon card: the headline (score, tier, buy call) and rolled perks; it opens to show every column and the reasons. */
function weaponCard({ rating: r, sale, buy, owned }: RatedSale<WeaponRating>) {
  const good = goodSet(r);
  const cols = r.perks.filter((p) => p.options.length).sort((a, b) => rank(a.kind) - rank(b.kind));
  const line = cols.filter((p) => PERK_ORDER.includes(p.kind)).map((p) => perkIcon(p.active, p.icons?.[p.active], good.has(p.active) ? "good" : "")).join("");
  const exo = r.rarity === "Exotic";
  return `<details class="vcard v-${buy}"><summary data-vt="${tipFor(weaponTip(r, sale.rolled))}">
      <div class="vdhead"><span class="ico${exo ? " exotic" : ""}">${img(r.icon)}${tierBadge(r)}</span>
        <div class="vname"><div class="nm">${esc(r.name)}</div><div class="sm">${esc([r.frame.replace(/ Frame$/, ""), r.type].filter(Boolean).join(" "))}</div><div class="sm">${elDot(r.element)}${exo ? ' · <span class="exo">Exotic</span>' : ""}</div></div>
        ${score(r.score)}</div>
      <div class="perkline">${sale.rolled ? line : "<span>Roll decided when you buy it</span>"}</div>
      <div class="vfoot">${buyBadge(buy)}${r.godRoll ? '<span class="vgod" title="Matches a community wishlist god roll">★ God roll</span>' : ""}${owned ? `<span class="small muted" title="Your best copy scores ${owned.score}">Own ${owned.count} · best ${owned.score}</span>` : ""}<span class="vcost">${price(sale.costs)}</span></div>
    </summary>
    <div class="vbody">
      <ul class="reasons">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      ${r.aegis?.notes ? `<div class="vnotes"><b>Aegis:</b> ${esc(r.aegis.notes)}</div>` : ""}
      ${sale.rolled ? `<div class="perkcols">${cols.map((p) => `<div class="perkcol"><div class="cap">${COL[p.kind] ?? esc(p.kind)}</div><div class="perkopts">${p.options.map((o) => perkIcon(o, p.icons?.[o], ["perk", p.active === o ? "on" : "", good.has(o) ? "good" : ""].filter(Boolean).join(" "))).join("")}</div></div>`).join("")}</div>` : ""}
      <div class="vfacts">${fact("Weapon", r.weaponScore)}${fact("Roll", sale.rolled ? r.rollScore : "—")}${fact("Aegis", r.aegis ? `${r.aegis.tier}${r.aegis.rank ? " #" + r.aegis.rank : ""}` : "Not on sheet")}</div>
    </div></details>`;
}

function armorCard({ rating: a, sale, buy }: RatedSale<ArmorRating>) {
  const exo = a.rarity === "Exotic";
  return `<details class="vcard v-${buy}"><summary data-vt="${tipFor(armorTip(a))}">
      <div class="vdhead"><span class="ico${exo ? " exotic" : ""}">${img(a.icon)}<span class="tier tU" title="Gear tier">${a.gearTier ? "T" + a.gearTier : exo ? "EX" : "—"}</span></span>
        <div class="vname"><div class="nm">${esc(a.name)}</div><div class="sm">${esc(a.classType)} ${esc(a.slot)}</div><div class="sm">${esc(a.archetype || "Legacy")}${a.setName ? " · " + esc(a.setName) : ""}</div></div>
        ${score(a.score)}</div>
      <div class="perkline">${a.topStats.map((s) => `<span>${esc(s.name)} ${s.value}</span>`).join("")}${a.statTotal ? `<span>Total ${a.statTotal}</span>` : ""}</div>
      <div class="vfoot">${buyBadge(buy)}<span class="vcost">${price(sale.costs)}</span></div>
    </summary>
    <div class="vbody">
      <ul class="reasons">${a.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="vfacts">${fact("Stats", Math.round(a.parts.stats))}${fact("Build fit", Math.round(a.parts.buildFit))}${fact("Set", Math.round(a.parts.set))}</div>
    </div></details>`;
}

/** A collapsible card holding one vendor's stock (or one Eververse list); open unless the player closed it. */
const section = (id: string, head: string, body: string, n = 0) =>
  `<details class="vgroup" data-sec="${esc(id)}"${n ? ` style="--n:${Math.min(n, 4)}"` : ""}${closed.has(id) ? "" : " open"}><summary><div class="vghead">${head}</div><span class="vchev" aria-hidden="true"></span></summary><div class="vgbody">${body}</div></details>`;

const fact = (k: string, v: unknown) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`;

/** Eververse cosmetics: price and time left. Offers that leave within a day (the daily ones) come first. */
function offerTile(o: Offer) {
  const left = timeLeft(o.refreshes);
  return `<div class="voffer">${img(o.icon)}<div class="vname"><div class="nm" title="${esc(o.name)}">${esc(o.name)}</div><div class="sm">${esc(o.type)}</div><div class="vcost">${price(o.costs)}</div></div>${left ? `<span class="vleft" title="Leaves the store in ${left}">${left}</span>` : ""}</div>`;
}

function offersBlock(list: RatedVendor[]) {
  // The same offer can sit in more than one featured slot: list it once.
  const seen = new Set<string>();
  const offers = list.flatMap((v) => v.offers).filter((o) => !seen.has(o.name) && !!seen.add(o.name));
  if (!offers.length) return `<p class="muted">Eververse isn't listing any offers for this character right now.</p>`;
  const daily = offers.filter((o) => o.daily);
  const dust = offers.filter((o) => !o.daily && o.costs.some((c) => c.itemHash === BRIGHT_DUST));
  const group = (id: string, title: string, items: Offer[], note: string) =>
    items.length ? section(id, `<div><h3>${title}</h3><div class="sm">${note}</div></div>`, `<div class="voffers">${items.map(offerTile).join("")}</div>`) : "";
  const left = daily[0] ? timeLeft(daily[0].refreshes) : "";
  return group("daily", "Today only", daily, `${daily.length} featured offers${left ? `, leaving in ${left}` : ""}`) + group("dust", "This week for Bright Dust", dust, `${dust.length} offer${dust.length === 1 ? "" : "s"}`);
}

function vendorBlock(v: RatedVendor) {
  const items = (kind === "weapons" ? v.weapons : v.armor) as RatedSale<WeaponRating | ArmorRating>[];
  const shown = onlyBuy ? items.filter((s) => s.buy === "buy") : items;
  if (!shown.length) return "";
  const card = kind === "weapons" ? (s: RatedSale<WeaponRating | ArmorRating>) => weaponCard(s as RatedSale<WeaponRating>) : (s: RatedSale<WeaponRating | ArmorRating>) => armorCard(s as RatedSale<ArmorRating>);
  const left = timeLeft(v.refreshes);
  const buys = shown.filter((s) => s.buy === "buy").length;
  const sub = [v.subtitle, `${shown.length} ${kind}${buys ? `, ${buys} worth buying` : ""}`, left && `new stock in ${left}`].filter(Boolean).map((x) => esc(x as string)).join(" · ");
  return section(String(v.vendorHash), `${v.icon ? `<img class="vico" src="${esc(v.icon)}" alt="">` : ""}<div><h3>${esc(v.name)}</h3><div class="sm">${sub}</div></div>`, `<div class="vcards">${shown.map(card).join("")}</div>`, shown.length);
}

function draw() {
  if (!panel) return;
  tips.clear();
  const list = stock.get(charId);
  const chars = input.vault.characters;
  const gear = (list ?? []).filter((v) => v.weapons.length || v.armor.length);
  if (vendor && list && !list.some((v) => String(v.vendorHash) === vendor)) vendor = "";
  const picked = vendor ? gear.filter((v) => String(v.vendorHash) === vendor) : gear;
  const all = picked.flatMap((v) => (kind === "armor" ? v.armor : v.weapons) as RatedSale<unknown>[]);
  const buys = all.filter((s) => s.buy === "buy").length;
  const blocks = kind === "eververse" ? "" : picked.map(vendorBlock).join("");
  const body = error
    ? `<p class="vr-err">${esc(error)}</p><button class="btn" type="button" id="vd-retry">Try again</button>`
    : !list
      ? loadingBlock("Reading vendor stock…", "Asking Bungie what every vendor sells right now, then rating it against your vault.")
      : kind === "eververse"
        ? offersBlock(list)
        : blocks ? `<div class="vgrid">${blocks}</div>` : `<p class="muted">${onlyBuy ? "Nothing here is worth buying right now." : `No vendor is selling ${kind} right now.`}</p>`;
  const select = (id: string, label: string, opts: [string, string][], cur: string) =>
    `<label class="ctl" style="--h:38px"><span>${label}</span><select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
  const count = (v: RatedVendor) => (kind === "armor" ? v.armor : v.weapons).length;
  panel.innerHTML = `<div class="vendors">
    <div class="sec-head"><h2>Vendors</h2><p>What vendors sell right now, rated against your vault. <b>Worth buying</b> means the rater would keep it if it joined your vault. Open a card for every perk and the reasons.</p></div>
    <div class="vdbar">
      <div class="seg" role="group" aria-label="Show">${(["weapons", "armor", "eververse"] as Kind[]).map((k) => `<button type="button" data-vk="${k}" aria-pressed="${kind === k}">${k === "eververse" ? "Eververse" : k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div>
      ${kind !== "eververse" && list ? select("vd-vendor", "Vendor", [["", "All vendors"], ...gear.filter(count).map((v) => [String(v.vendorHash), `${v.name} (${count(v)})`] as [string, string])], vendor) : ""}
      ${chars.length > 1 ? select("vd-char", "Character", chars.map((c) => [c.id, c.className]), charId) : ""}
      ${kind !== "eververse" ? `<label class="vonly"><input type="checkbox" id="vd-only"${onlyBuy ? " checked" : ""}> Only worth buying</label>` : ""}
      <span class="vsum small muted">${list && kind !== "eververse" ? `${buys} of ${all.length} worth buying` : ""}</span>
      <button class="btn" type="button" id="vd-refresh"${loading ? " disabled" : ""}>${loading ? "Reading…" : "Refresh"}</button>
    </div>
    ${body}</div>`;
}

function wire(el: HTMLElement) {
  el.dataset.wired = "1";
  el.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const k = t.closest<HTMLElement>("[data-vk]");
    if (k) {
      kind = k.dataset.vk as Kind;
      store.set("vr-vendors-kind", kind);
      draw();
    } else if (t.closest("#vd-refresh, #vd-retry")) void load(true);
  });
  // Toggle doesn't bubble: listen in the capture phase. Vendor cards' own weapon cards are ignored.
  el.addEventListener("toggle", (e) => {
    const d = e.target as HTMLDetailsElement;
    const id = d.matches?.(".vgroup") ? d.dataset.sec : undefined;
    if (!id || d.open === !closed.has(id)) return;
    if (d.open) closed.delete(id);
    else closed.add(id);
    store.set("vr-vendors-closed", JSON.stringify([...closed]));
  }, true);
  el.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "vd-only") {
      onlyBuy = t.checked;
      store.set("vr-vendors-buy", onlyBuy ? "1" : "");
    } else if (t.id === "vd-vendor") vendor = t.value;
    else if (t.id === "vd-char") {
      charId = t.value;
      store.set("vr-vendors-char", charId);
      error = "";
      if (!stock.has(charId)) void load();
    }
    draw();
  });
}
