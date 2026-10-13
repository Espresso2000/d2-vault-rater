/**
 * The Builds tab: saved builds and an editor for one. Subclass sockets change from popovers that open on
 * hover, focus or tap; weapons, armor and mods for every slot are picked together in one list and applied
 * at once. A summary column keeps the rating, stats, set bonuses and the equip and DIM actions in view.
 * Rendered into the report's #p-builds panel.
 */
import "./builds.css";
import type { ArmorRecord, Vault, WeaponRecord } from "../../../src/vault/types.js";
import { STAT_HASHES, type BuildDefs, type PlugDef, type SocketGroup, type SubclassDef } from "./defs.strip";
import { loadBuildDefs } from "./defs";
import { cachedClarity, cachedRatings, loadClarity, loadRatings } from "./ratings";
import { TIER_POINTS } from "./sheets";
import {
  ARMOR_ENERGY, ARMOR_SLOTS, CLASSES, CLASS_NAME, GENERAL_PCI, MOD_PCI, MOD_SOCKETS, STAT_MAX, WEAPON_SLOTS,
  armorOf, aspectRating, buildScore, defaultPlugs, exoticClash, fragmentRating, fragmentSlots, fromDimLoadout, infoFor, isEmptyPlug,
  itemOf, modEnergy, newBuild, newId, socketsOf, statLines, subclassRating, toDimLoadout, trimFragments, weaponOf,
  type Build, type BuildSlot, type Ctx, type GearSlot,
} from "./model";
import { captureCharacter, charFor, fetchBuildProfile, subclassInstance, type BuildProfile } from "./profile";
import { applyPlan, planEquip, type Plan } from "./equip";
import { dimImportUrl, dimLoadouts, saveToDim, shareDimLoadout } from "./dim";
import { loadBuilds, saveBuilds } from "./store";
import { bungieUrl } from "../shims/client";
import { esc } from "../html";

interface SetBonus {
  pieces: number;
  name: string;
  tier?: string | null;
  effect?: string;
  description?: string;
}

export interface BuildsInput {
  vault: Vault;
  /** The report's site data: the rater's scores per item, and the armor set bonuses. */
  data: {
    weapons: { id: string; sc: number; tier: string | null }[];
    armor: { id: string; sc: number }[];
    sets?: Record<string, { name: string; bonuses: SetBonus[] }>;
    /** Wrapped's per-character play dates, for ordering classes. */
    wrapped?: { characters?: { className: string; lastPlayed: string }[] } | null;
  };
  manifest: { stats: Record<string, { displayProperties: { name: string } }> };
}

const img = (p?: string | null, alt = "") => (p ? `<img src="${esc(bungieUrl(p))}" alt="${esc(alt)}" loading="lazy">` : `<span class="ph"></span>`);
const tierChip = (t?: string | null, title = "") => (t ? `<span class="tier t${esc(t)}"${title ? ` title="${esc(title)}"` : ""}>${esc(t)}</span>` : "");
const scoreTier = (n: number) => (n >= 90 ? "S" : n >= 80 ? "A" : n >= 65 ? "B" : n >= 50 ? "C" : "D");
const statChip = (h: number, v: number) => `<span class="bd-stat ${v > 0 ? "up" : "down"}">${v > 0 ? "+" : ""}${v} ${esc(ctx().statNames[h] ?? "")}</span>`;
const GROUP_LABEL: Record<SocketGroup, string> = { super: "Super", class: "Class ability", movement: "Jump", melee: "Melee", grenade: "Grenade", aspects: "Aspect", fragments: "Fragment", other: "Passive" };
const EL_ORDER = ["Prismatic", "Arc", "Solar", "Void", "Stasis", "Strand"];
const isWeaponSlot = (s: string) => (WEAPON_SLOTS as readonly string[]).includes(s);
const isArmorSlot = (s: string): s is GearSlot => (ARMOR_SLOTS as readonly string[]).includes(s);

let input: BuildsInput | null = null;
let panel: HTMLElement | null = null;
let defs: BuildDefs | null = null;
let profile: BuildProfile | null = null;
let builds: Build[] = [];
let cur: Build | null = null;
let loadError = "";
let loading: Promise<void> | null = null;
/** Destiny Clarity's notes: plug hash -> paragraphs. */
let clarity: Record<number, string[]> = {};
const log: string[] = [];
/** The character's gear before the last equip, to put it back. */
let undo: { build: Build; charId: string } | null = null;

/** What ctx() needs from the rated vault, worked out once per rating run rather than on every draw. */
let fixed: { scores: Map<string, number>; statNames: Record<number, string>; tiers: Map<string, string | null> } | null = null;
function vaultData() {
  if (fixed) return fixed;
  const scores = new Map<string, number>();
  for (const w of input!.data.weapons) scores.set(w.id, w.sc);
  for (const a of input!.data.armor) scores.set(a.id, a.sc);
  const statNames: Record<number, string> = {};
  for (const h of STAT_HASHES) statNames[h] = input!.manifest.stats[h]?.displayProperties?.name ?? String(h);
  return (fixed = { scores, statNames, tiers: new Map(input!.data.weapons.map((w) => [w.id, w.tier])) });
}
const ctx = (): Ctx => {
  const { scores, statNames } = vaultData();
  return { defs: defs!, ratings: cachedRatings(), vault: input!.vault, scores, statNames, sockets: profile?.sockets };
};
const weaponTier = (id?: string) => (id ? vaultData().tiers.get(id) ?? null : null);
const where = (loc: { where: string; equipped: boolean }) =>
  loc.where === "vault" ? "Vault" : `${input!.vault.characters.find((x) => x.id === loc.where)?.className ?? "Character"}${loc.equipped ? " (equipped)" : ""}`;
/** Roll and perk pages for a weapon on light.gg and D2 Foundry (needs the item hash). */
const weaponLinks = (w: WeaponRecord) =>
  w.itemHash
    ? `<a class="bd-link" href="https://www.light.gg/db/items/${w.itemHash}/" target="_blank" rel="noopener" title="${esc(w.name)} on light.gg">light.gg</a><a class="bd-link" href="https://d2foundry.gg/w/${w.itemHash}" target="_blank" rel="noopener" title="${esc(w.name)} on D2 Foundry">Foundry</a>`
    : "";

/* ---------- Entry points (called by the report page) ---------- */

export function initBuilds(i: BuildsInput) {
  input = i;
  fixed = null;
  builds = loadBuilds();
  window.VR_BUILDS = { render, count: () => builds.length || null };
}

function render(el: HTMLElement) {
  panel = el;
  if (!el.dataset.wired) wire(el);
  if (!defs) {
    el.innerHTML = loadingCard();
    loading ??= load();
    return;
  }
  draw();
}

async function load() {
  const note = (s: string) => {
    log.push(s);
    if (panel && !defs) panel.innerHTML = loadingCard();
  };
  try {
    note("Loading subclass, aspect and fragment definitions…");
    const [d] = await Promise.all([loadBuildDefs(note), loadRatings().catch((e) => note(`Couldn't read the rating sheets: ${(e as Error).message}`))]);
    defs = d;
    clarity = cachedClarity();
    cur = builds[0] ?? null;
    draw();
    void refreshProfile();
    void loadClarity((h) => !!d.plugs[h]).then((t) => (clarity = t));
  } catch (e) {
    loadError = (e as Error).message;
    loading = null;
    if (panel) panel.innerHTML = loadingCard();
  }
}

async function refreshProfile() {
  try {
    profile = await fetchBuildProfile();
  } catch (e) {
    console.warn("Builds: couldn't read characters", e);
  }
  draw();
}

function loadingCard() {
  return `<div class="bd-loading glass"><div class="eyebrow">Builds</div><h2>${loadError ? "Couldn't load the build data" : "Loading build data…"}</h2>
    ${loadError ? `<p class="vr-err">${esc(loadError)}</p><button class="btn primary" data-act="retry">Try again</button>` : ""}
    <ol class="vr-log">${log.map((l) => `<li>${esc(l)}</li>`).join("")}</ol></div>`;
}

/* ---------- Saving ---------- */

let saveTimer = 0;
function touch(redraw = true) {
  if (!cur) return;
  cur.updated = new Date().toISOString();
  if (!builds.includes(cur)) builds.unshift(cur);
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveBuilds(builds);
    const s = panel?.querySelector("#bd-saved");
    if (s) s.textContent = "Saved";
  }, 250);
  if (redraw) draw();
}

/* ---------- Layout ---------- */

function draw() {
  if (!panel || !defs) return;
  listCls ??= cur?.cls ?? classChoices()[0];
  const c = ctx();
  const y = scrollY;
  panel.innerHTML = `<div class="bd">
    <div class="sec-head"><h2>Builds</h2><span class="badge">${builds.length} saved</span>
      <p>Hover or tap a subclass slot to change it, pick gear and mods for every slot from one list, then equip the build or send it to DIM. Builds are saved in this browser.</p></div>
    <div class="bd-layout">${listPane()}${cur && cur.cls === listCls ? editor(cur, c) : emptyEditor()}</div></div>`;
  scrollTo({ top: y });
  if (pop) refreshPop();
}

let listQuery = "";
/** The class whose builds are shown; set on the first draw. */
let listCls: number | null = null;
/** The saved build waiting for a delete confirmation. */
let delAsk: string | null = null;
const listText = (b: Build) => `${b.name} ${b.tags.join(" ")} ${CLASS_NAME(b.cls)}`.toLowerCase();
const TRASH = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h1.5v-8H10zm3.5 0v8H15v-8h-1.5z"/></svg>`;

/** The saved builds of one class, each card showing enough to tell builds apart without opening them. */
function listPane() {
  const c = ctx();
  const cls = listCls!;
  const mine = builds.filter((b) => b.cls === cls);
  const q = listQuery.toLowerCase();
  return `<section class="bd-saved glass" aria-label="Saved builds">
    <div class="bd-saved-head">
      <span class="cap">Saved builds</span>
      <div class="seg bd-clsseg" role="tablist" aria-label="Class">${classChoices()
        .map((k) => `<button role="tab" data-act="lcls" data-cls="${k}" aria-selected="${k === cls}">${CLASS_NAME(k)}<span class="count">${builds.filter((b) => b.cls === k).length}</span></button>`)
        .join("")}</div>
      ${mine.length > 4 ? `<input class="bd-input bd-q" id="bd-q" type="search" placeholder="Search ${esc(CLASS_NAME(cls))} builds" value="${esc(listQuery)}" aria-label="Search builds">` : ""}
      <div class="bd-list-actions"><button class="btn primary bd-sm" data-act="new" data-cls="${cls}">+ New ${esc(CLASS_NAME(cls))} build</button><button class="btn bd-sm" data-act="import">Import</button></div>
    </div>
    <div class="bd-cards">${mine.map((b) => buildCard(b, c, !!q && !listText(b).includes(q))).join("") || `<p class="small muted bd-pad">No ${esc(CLASS_NAME(cls))} builds yet. Start one, or import your current gear or a DIM loadout.</p>`}</div>
  </section>`;
}

function buildCard(b: Build, c: Ctx, hidden: boolean) {
  const sc = b.subclass ? defs!.subclasses[b.subclass] : null;
  const s = buildScore(b, c).total;
  const weapons = WEAPON_SLOTS.map((slot) => weaponOf(c, b.items[slot]?.id));
  const armor = ARMOR_SLOTS.map((slot) => armorOf(c, b.items[slot]?.id));
  const exotics = [...weapons, ...armor].filter((x): x is WeaponRecord | ArmorRecord => x?.rarity === "Exotic");
  const aspects = sc ? socketsOf(sc, "aspects").map((i) => defs!.plugs[b.plugs[i]]).filter((p): p is PlugDef => !isEmptyPlug(p)) : [];
  const frags = sc ? socketsOf(sc, "fragments").filter((i) => !isEmptyPlug(defs!.plugs[b.plugs[i]])).length : 0;
  const top = statLines(b, c).filter((l) => l.total > 0).sort((x, y) => y.total - x.total).slice(0, 3);
  const gearIco = (x: WeaponRecord | ArmorRecord | undefined) =>
    x ? `<span class="bd-gico${x.rarity === "Exotic" ? " exotic" : ""}" title="${esc(x.name)}">${img(x.icon)}</span>` : `<span class="bd-gico none"></span>`;
  const id = esc(b.id);
  const ask = delAsk === b.id;
  return `<article class="bd-bcard${b === cur ? " on" : ""}${ask ? " asking" : ""}" style="--el:var(--${sc?.el ?? "Unknown"})"${hidden ? " hidden" : ""} data-id="${id}">
    <button class="bd-bopen" data-act="open" data-id="${id}" aria-current="${b === cur}" aria-label="${esc(`Open ${b.name}`)}">
      <span class="bd-btop"><span class="bd-bico">${img(sc?.i)}</span>
        <span class="bd-bmeta"><b>${esc(b.name)}</b><span>${sc ? esc(sc.n) : "No subclass"}${b.tags.length ? " · " + b.tags.map(esc).join(", ") : ""}</span></span>
        ${s !== null ? `<span class="bd-bscore t${scoreTier(s)}" title="Build rating">${s}</span>` : ""}</span>
      <span class="bd-bgear">${weapons.map(gearIco).join("")}<i></i>${armor.map(gearIco).join("")}</span>
      <span class="bd-bline"><span class="cap">Exotics</span><span>${exotics.length ? exotics.map((x) => esc(x.name)).join(" · ") : "None"}</span></span>
      <span class="bd-bline"><span class="cap">Aspects</span><span>${aspects.length ? aspects.map((p) => esc(p.n)).join(" · ") : "None"}${frags ? ` · ${frags} fragment${frags === 1 ? "" : "s"}` : ""}</span></span>
      ${top.length ? `<span class="bd-bstats">${top.map((l) => `<span><i>${esc(l.name)}</i><b class="num">${l.total}</b></span>`).join("")}</span>` : ""}
    </button>
    <button class="bd-bdel" data-act="askdel" data-id="${id}" aria-label="${esc(`Delete ${b.name}`)}" title="Delete from Vault Rater">${TRASH}</button>
    ${
      ask
        ? `<div class="bd-bconfirm" role="alertdialog" aria-label="Delete build" aria-describedby="bd-del-${id}">
      <p id="bd-del-${id}">Delete <b>${esc(b.name)}</b> from Vault Rater? ${b.dimId ? "Its DIM loadout stays in DIM. " : ""}Nothing changes in DIM or the game. This can't be undone.</p>
      <div><button class="btn bd-sm bd-danger" data-act="delyes" data-id="${id}">Delete</button><button class="btn ghost bd-sm" data-act="delno">Cancel</button></div></div>`
        : ""
    }
  </article>`;
}

function emptyEditor() {
  const k = listCls ?? classChoices()[0];
  return `<section class="bd-editor"><div class="bd-empty glass">
    <div class="eyebrow">Start a ${esc(CLASS_NAME(k))} build</div><h2>What are you <span class="grad-text">playing</span>?</h2>
    <p class="muted">Start from scratch, or bring in what your ${esc(CLASS_NAME(k))} is wearing right now or a DIM loadout.</p>
    <div class="bd-pills"><button class="btn primary" data-act="new" data-cls="${k}">+ New ${esc(CLASS_NAME(k))} build</button><button class="btn" data-act="import">Import from a character or DIM</button></div></div></section>`;
}

/** Classes you have, most recently played first (Wrapped's play dates, else the vault's character order). */
const classChoices = () => {
  const played = (cls: string) => input!.data.wrapped?.characters?.find((x) => x.className === cls)?.lastPlayed ?? "";
  const chars = [...input!.vault.characters].sort((a, b) => played(b.className).localeCompare(played(a.className)));
  const have = [...new Set(chars.map((c) => CLASSES.indexOf(c.className as (typeof CLASSES)[number])).filter((x) => x >= 0))];
  return have.length ? have : [0, 1, 2];
};

function editor(b: Build, c: Ctx) {
  const sc = b.subclass ? defs!.subclasses[b.subclass] : null;
  return `<section class="bd-editor">
    <header class="bd-hero" style="--el:var(--${sc?.el ?? "Unknown"})">
      <div class="bd-hero-ico">${img(sc?.i)}</div>
      <div class="bd-hero-text">
        <div class="eyebrow">${esc(CLASS_NAME(b.cls))}${sc ? ` · ${esc(sc.n)}` : ""}</div>
        <input class="bd-name" id="bd-name" value="${esc(b.name)}" aria-label="Build name" maxlength="80">
        <div class="bd-hero-row">
          <div class="bd-pills" role="radiogroup" aria-label="Class">${classChoices().map((k) => `<button class="bd-pill${k === b.cls ? " on" : ""}" role="radio" data-act="cls" data-cls="${k}" aria-checked="${k === b.cls}">${CLASS_NAME(k)}</button>`).join("")}</div>
          <div class="bd-tags">${b.tags.map((t, i) => `<span class="chip">${esc(t)}<button class="bd-x" data-act="untag" data-i="${i}" aria-label="Remove tag ${esc(t)}">✕</button></span>`).join("")}
            <input class="bd-input bd-taginput" id="bd-tag" placeholder="+ tag" maxlength="24" aria-label="Add a tag"></div>
        </div>
      </div>
    </header>
    <div class="bd-main">
      ${summary(b, c)}
      <div class="bd-col">
        ${subclassCard(b, sc, c)}
        ${gearCard(b, c)}
        <section class="bd-card glass bd-notes"><div class="bd-card-head"><h3>Notes</h3></div>
          <textarea id="bd-notes" rows="3" placeholder="How to play it, what it's for, which artifact perks it wants…">${esc(b.notes)}</textarea></section>
      </div>
    </div>
  </section>`;
}

function ring(total: number | null) {
  const v = total ?? 0;
  return `<div class="bd-ring" style="--v:${v}" title="Build rating out of 100"><div><b class="num">${total ?? "—"}</b><span>${total === null ? "Unrated" : `${scoreTier(v)} tier`}</span></div></div>`;
}

/* ---------- Summary column ---------- */

function summary(b: Build, c: Ctx) {
  const score = buildScore(b, c);
  const char = charFor(profile, b.cls);
  return `<aside class="bd-summary glass" aria-label="Build summary">
    <div class="bd-sumtop">${ring(score.total)}<div class="bd-parts">${score.parts
      .map((p) => `<div class="bd-part" title="${esc(p.note)}"><span>${p.label}</span><span class="bd-pbar"><i style="width:${p.points ?? 0}%"></i></span><b class="num">${p.points === null ? "—" : Math.round(p.points)}</b></div>`)
      .join("")}</div></div>
    ${statsBlock(b, c)}
    ${setsBlock(b, c)}
    <div class="bd-acts">
      <button class="btn primary" data-act="equip"${char || !profile ? "" : " disabled"}>Equip${char ? ` on ${CLASS_NAME(b.cls)}` : ""}…</button>
      <button class="btn" data-act="dim">Export to DIM</button>
      <div class="bd-minor"><button class="linkbtn" data-act="dup">Duplicate</button><button class="linkbtn" data-act="del">Delete</button><span class="small muted" id="bd-saved" aria-live="polite">Saved</span></div>
    </div>
  </aside>`;
}

function statsBlock(b: Build, c: Ctx) {
  const lines = statLines(b, c);
  const pct = (n: number) => `${(Math.max(0, n) / STAT_MAX) * 100}%`;
  const sum = lines.reduce((n, l) => n + l.total, 0);
  return `<section class="bd-sumsec"><div class="cap">Stats <span class="bd-capnote">${sum} total · 100 is full benefit, up to 200 enhanced</span></div>
    <div class="bd-slines">${lines
      .map((l) => {
        const met = l.target > 0 && l.total >= l.target;
        const parts = [`Armor ${l.armor}`, l.mods ? `mods ${l.mods > 0 ? "+" : ""}${l.mods}` : "", l.fragments ? `fragments ${l.fragments > 0 ? "+" : ""}${l.fragments}` : ""].filter(Boolean).join(" · ");
        return `<div class="bd-sline" title="${esc(parts)}">
          <span class="bd-sname">${esc(l.name)}</span>
          <span class="bd-sbar"><i class="a" style="width:${pct(Math.min(l.total, l.armor))}"></i><i class="m" style="width:${pct(Math.min(Math.max(0, l.total - l.armor), Math.max(0, l.mods)))}"></i><i class="f" style="width:${pct(Math.max(0, l.total - Math.max(0, l.armor) - Math.max(0, l.mods)))}"></i>
            <s style="left:50%"></s>${l.target ? `<u style="left:${pct(l.target)}"></u>` : ""}</span>
          <b class="num bd-stot${met ? " met" : l.target ? " short" : ""}">${l.total}</b>
          <label class="bd-target"><span class="sr">${esc(l.name)} target</span><input type="number" min="0" max="${STAT_MAX}" step="10" value="${l.target || ""}" placeholder="aim" data-target="${l.hash}"></label>
        </div>`;
      })
      .join("")}</div>
    <div class="bd-legend small muted"><span><i class="a"></i>Armor</span><span><i class="m"></i>Mods</span><span><i class="f"></i>Fragments</span><span><u></u>Your aim</span></div></section>`;
}

/** Armor set bonuses the build's armor pieces turn on (bonus details from the report's set data). */
function setsBlock(b: Build, c: Ctx) {
  const counts = new Map<string, number>();
  for (const s of ARMOR_SLOTS) {
    const n = armorOf(c, b.items[s]?.id)?.setName;
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  if (!counts.size) return "";
  // Single pieces turn nothing on: one line for them, full bonus lists for sets of two or more.
  const singles = [...counts].filter(([, n]) => n < 2).map(([name]) => name);
  return `<section class="bd-sumsec"><div class="cap">Set bonuses</div><div class="bd-sets">${[...counts]
    .filter(([, n]) => n >= 2)
    .sort((x, y) => y[1] - x[1])
    .map(([name, n]) => {
      const bonuses = input!.data.sets?.[name]?.bonuses ?? [];
      return `<div class="bd-set"><div class="bd-sethead"><b>${esc(name)}</b><span class="num">${n} piece${n === 1 ? "" : "s"}</span></div>${bonuses
        .map((x) => `<div class="bd-bonus${n >= x.pieces ? " on" : ""}" title="${esc(x.description || x.effect || "")}"><span class="num">${x.pieces}pc</span>${tierChip(x.tier)}<span>${esc(x.name)}</span></div>`)
        .join("")}</div>`;
    })
    .join("")}${singles.length ? `<p class="small muted">One piece each: ${singles.map(esc).join(", ")}</p>` : ""}</div></section>`;
}

/* ---------- Subclass ---------- */

function subclassCard(b: Build, sc: SubclassDef | null, c: Ctx) {
  const all = Object.values(defs!.subclasses)
    .filter((s) => s.cls === b.cls)
    .sort((x, y) => EL_ORDER.indexOf(x.el) - EL_ORDER.indexOf(y.el));
  const char = charFor(profile, b.cls);
  const owned = (s: SubclassDef) => !char || char.subclasses.some((x) => x.hash === s.h);
  const picker = `<div class="bd-els" role="radiogroup" aria-label="Subclass">${all
    .map((s) => {
      const r = subclassRating(c.ratings, s);
      return `<button class="bd-el${s.h === b.subclass ? " on" : ""}" role="radio" aria-checked="${s.h === b.subclass}" data-act="subclass" data-h="${s.h}" style="--el:var(--${s.el})"
        ${owned(s) ? `data-tip="${s.h}" aria-describedby="bd-tip"` : `title="Not unlocked on this character" disabled`}>
        ${img(s.i)}<span>${esc(s.el)}</span>${tierChip(r?.tier)}</button>`;
    })
    .join("")}</div>`;
  if (!sc) return `<section class="bd-card glass bd-subclass"><div class="bd-card-head"><h3>Subclass</h3></div>${picker}<p class="small muted">Pick a subclass to choose its super, abilities, aspects and fragments.</p></section>`;
  const r = subclassRating(c.ratings, sc);
  const slots = fragmentSlots(b, defs!);
  const group = (g: SocketGroup) => socketsOf(sc, g);
  const chips = (is: number[]) => is.map((i) => socketChip(b, sc, i, c, slots)).join("");
  const abilities = (["super", "class", "movement", "melee", "grenade", "other"] as SocketGroup[]).flatMap(group);
  const fragsIn = group("fragments").filter((i, k) => k < slots && !isEmptyPlug(defs!.plugs[b.plugs[i]])).length;
  return `<section class="bd-card glass bd-subclass" style="--el:var(--${sc.el})">
    <div class="bd-card-head"><h3>Subclass</h3>${r ? `<span class="small muted">Aegis ${tierChip(r.tier)} ${r.total !== null ? `${r.total}/40` : ""}</span>` : ""}</div>
    ${picker}
    ${r ? `<div class="bd-roles">${(["super", "enhancement", "offense", "defense"] as const).map((k) => `<div><span>${k}</span><b class="num">${r.scores[k] ?? "—"}</b><i style="width:${(r.scores[k] ?? 0) * 10}%"></i></div>`).join("")}</div>
      ${r.usage ? `<p class="small muted bd-usage">“${esc(r.usage)}”</p>` : ""}` : ""}
    <div class="bd-group"><div class="cap">Abilities</div><div class="bd-chips">${chips(abilities)}</div></div>
    <div class="bd-group"><div class="cap">Aspects <span class="bd-capnote">open ${slots} fragment slot${slots === 1 ? "" : "s"}</span></div><div class="bd-chips">${chips(group("aspects"))}</div></div>
    <div class="bd-group"><div class="cap">Fragments <span class="bd-capnote">${fragsIn} of ${slots}</span></div><div class="bd-chips">${chips(group("fragments"))}</div></div>
  </section>`;
}

function socketChip(b: Build, sc: SubclassDef, i: number, c: Ctx, slots: number) {
  const s = sc.sockets[i];
  const p = defs!.plugs[b.plugs[i] ?? s.init];
  const locked = s.plugs.length < 2;
  const off = s.group === "fragments" && socketsOf(sc, "fragments").indexOf(i) >= slots;
  const empty = isEmptyPlug(p);
  const rated = s.group === "aspects" ? aspectRating(c.ratings, p) : s.group === "fragments" ? fragmentRating(c.ratings, p) : null;
  const label = s.group === "other" ? p?.t ?? GROUP_LABEL.other : GROUP_LABEL[s.group];
  const inner = `<span class="bd-sico">${empty ? `<span class="bd-plus">${off ? "🔒" : "+"}</span>` : img(p?.i)}${rated ? tierChip(rated.tier) : ""}</span>
    <span class="bd-cmeta"><span class="cap">${esc(label)}</span><b>${empty ? (off ? "Locked" : "Empty") : esc(p?.n)}</b>${(p?.st ?? []).map(([h, v]) => statChip(h, v)).join("")}</span>`;
  if (locked || off)
    return `<span class="bd-chip${empty ? " empty" : ""} ${off ? "off" : "fixed"}" title="${esc(off ? "Pick aspects with more fragment slots to use this one" : `${label}: ${p?.n ?? ""} (fixed)`)}">${inner}</span>`;
  return `<button class="bd-chip${empty ? " empty" : ""}${pop?.i === i ? " open" : ""}" data-pop="${i}" aria-haspopup="dialog" aria-expanded="${pop?.i === i}" aria-label="${esc(`${label}: ${empty ? "empty" : p?.n}. Change`)}">${inner}</button>`;
}

/* ---------- Subclass hover card ---------- */

/** What a subclass is: the game's description, Aegis's rating and any community notes. Shown on hover and keyboard focus. */
function subclassTip(h: number) {
  const s = defs!.subclasses[h];
  if (!s) return "";
  const r = subclassRating(cachedRatings(), s);
  const info = infoFor(cachedRatings(), s.n);
  const notes = clarity[s.h] ?? [];
  const supers = socketsOf(s, "super").flatMap((i) => s.sockets[i].plugs).map((p) => defs!.plugs[p]?.n).filter((n): n is string => !!n && !/^Empty /i.test(n));
  const aspects = socketsOf(s, "aspects").length;
  return `<div class="bd-dhead">${img(s.i)}<div><b>${esc(s.n)}</b><span>${esc(CLASS_NAME(s.cls))} · ${esc(s.el)}</span></div>${r ? `<span class="bd-dtier">${tierChip(r.tier)}<span>${r.total !== null ? `${r.total}/40` : ""}</span></span>` : ""}</div>
    ${s.d ? `<p class="bd-desc bd-flavor">“${esc(s.d)}”</p>` : ""}
    ${supers.length ? `<div class="bd-tipline"><span class="cap">Supers</span><span>${[...new Set(supers)].map(esc).join(" · ")}</span></div>` : ""}
    <div class="bd-tipline"><span class="cap">Slots</span><span>${aspects} aspect${aspects === 1 ? "" : "s"} · fragments by aspect</span></div>
    ${notes.length ? `<div class="bd-clarity"><div class="cap">Clarity · community tested</div>${notes.map((t) => `<p>${esc(t)}</p>`).join("")}</div>` : ""}
    ${r ? `<div class="bd-aegis"><div class="cap">Aegis · ${esc(r.tier)} tier</div>
      <div class="bd-tiproles">${(["super", "enhancement", "offense", "defense"] as const).map((k) => `<span>${k} <b class="num">${r.scores[k] ?? "—"}</b></span>`).join("")}</div>
      ${r.supers ? `<div><span>Picks</span><p>${esc(r.supers)}</p></div>` : ""}${r.usage ? `<div><span>Why</span><p>${esc(r.usage)}</p></div>` : ""}</div>` : ""}
    ${info && !r ? `<p class="small muted">${esc(info)}</p>` : ""}`;
}

function tipEl(): HTMLElement {
  let el = document.getElementById("bd-tip");
  if (!el) {
    document.body.insertAdjacentHTML("beforeend", `<div class="bd-tip" id="bd-tip" role="tooltip" hidden></div>`);
    el = document.getElementById("bd-tip")!;
    addEventListener("scroll", () => hideTip(), { passive: true });
  }
  return el;
}
function showTip(t: HTMLElement) {
  const el = tipEl();
  const html = subclassTip(Number(t.dataset.tip));
  if (!html) return;
  el.innerHTML = html;
  el.hidden = false;
  const r = t.getBoundingClientRect();
  const below = r.bottom + 8 + el.offsetHeight < innerHeight;
  el.style.left = `${Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8))}px`;
  el.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - el.offsetHeight - 8)}px`;
}
const hideTip = () => {
  const el = document.getElementById("bd-tip");
  if (el) el.hidden = true;
};

/* ---------- Socket popover ---------- */

/** The open popover: the socket it belongs to, and whether a click or tap pinned it open. */
let pop: { i: number; pinned: boolean; q: string; detail: number | null } | null = null;
let popTimer = 0;

function popEl(): HTMLElement {
  let el = document.getElementById("bd-pop");
  if (el) return el;
  document.body.insertAdjacentHTML("beforeend", `<div class="bd-pop" id="bd-pop" role="dialog" hidden></div>`);
  el = document.getElementById("bd-pop")!;
  el.addEventListener("pointerenter", () => clearTimeout(popTimer));
  el.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && !pop?.pinned && closeSoon());
  el.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-ph], [data-popclose]");
    if (!t) return;
    if (t.dataset.popclose !== undefined) return closePop(true);
    if (t.getAttribute("aria-disabled") !== "true") pickPlug(Number(t.dataset.ph));
  });
  const showDetail = (e: Event) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-ph]");
    if (!t || !pop || pop.detail === Number(t.dataset.ph)) return;
    pop.detail = Number(t.dataset.ph);
    el!.querySelector("#bd-popd")!.innerHTML = popDetail();
  };
  el.addEventListener("pointerover", showDetail);
  el.addEventListener("focusin", showDetail);
  el.addEventListener("input", (e) => {
    if (!pop || (e.target as HTMLElement).id !== "bd-popq") return;
    pop.q = (e.target as HTMLInputElement).value;
    el!.querySelector("#bd-popg")!.innerHTML = popGrid();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return e.stopPropagation(), closePop(true);
    const opts = [...el!.querySelectorAll<HTMLElement>("[data-ph]")];
    const at = opts.indexOf(document.activeElement as HTMLElement);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step && (at >= 0 || (e.key === "ArrowDown" && (e.target as HTMLElement).id === "bd-popq"))) {
      e.preventDefault();
      opts[Math.max(0, Math.min(opts.length - 1, at + step))]?.focus();
    } else if ((e.key === "Home" || e.key === "End") && at >= 0) {
      e.preventDefault();
      opts[e.key === "Home" ? 0 : opts.length - 1]?.focus();
    }
  });
  el.addEventListener("focusout", (e) => leaveCheck(e.relatedTarget as Node | null));
  document.addEventListener("pointerdown", (e) => {
    if (pop && !el!.contains(e.target as Node) && !popTrigger()?.contains(e.target as Node)) closePop();
  });
  addEventListener("scroll", () => pop && placePop(), { passive: true });
  addEventListener("resize", () => pop && placePop());
  return el;
}

const popTrigger = () => (pop ? panel?.querySelector<HTMLElement>(`[data-pop="${pop.i}"]`) ?? null : null);
const closeSoon = () => {
  clearTimeout(popTimer);
  popTimer = window.setTimeout(() => closePop(), 220);
};
/** Focus left both the socket and its popover: close it. */
function leaveCheck(to: Node | null) {
  if (!pop) return;
  if (to && (popEl().contains(to) || popTrigger()?.contains(to))) return;
  setTimeout(() => {
    const a = document.activeElement;
    if (pop && a && a !== document.body && !popEl().contains(a) && !popTrigger()?.contains(a)) closePop();
  });
}

function openPop(i: number, pinned: boolean, focus = false) {
  clearTimeout(popTimer);
  const same = pop?.i === i;
  pop = { i, pinned: pinned || (same && pop!.pinned), q: same ? pop!.q : "", detail: same ? pop!.detail : null };
  for (const t of panel?.querySelectorAll<HTMLElement>("[data-pop]") ?? []) {
    t.setAttribute("aria-expanded", String(t.dataset.pop === String(i)));
    t.classList.toggle("open", t.dataset.pop === String(i));
  }
  refreshPop();
  if (focus) popEl().querySelector<HTMLElement>("[data-ph][aria-selected=true], #bd-popq, [data-ph]")?.focus();
}

function closePop(returnFocus = false) {
  clearTimeout(popTimer);
  if (!pop) return;
  const t = popTrigger();
  pop = null;
  popEl().hidden = true;
  t?.setAttribute("aria-expanded", "false");
  t?.classList.remove("open");
  if (returnFocus) t?.focus();
}

interface PopCtx {
  sc: SubclassDef;
  group: SocketGroup;
  multi: boolean;
  sockets: number[];
  limit: number;
  chosen: Set<number>;
  opts: PlugDef[];
}

function popCtx(): PopCtx | null {
  const b = cur;
  const sc = b?.subclass ? defs!.subclasses[b.subclass] : null;
  if (!b || !sc || !pop || !sc.sockets[pop.i]) return null;
  const s = sc.sockets[pop.i];
  const multi = s.group === "aspects" || s.group === "fragments";
  const sockets = multi ? socketsOf(sc, s.group) : [pop.i];
  const limit = s.group === "fragments" ? fragmentSlots(b, defs!) : sockets.length;
  const chosen = new Set(sockets.slice(0, limit).map((j) => b.plugs[j]).filter((h) => !isEmptyPlug(defs!.plugs[h])));
  const r = cachedRatings();
  const rank = (p: PlugDef) => TIER_POINTS[(s.group === "aspects" ? aspectRating(r, p) : s.group === "fragments" ? fragmentRating(r, p) : null)?.tier ?? ""] ?? -1;
  // Best rated first; unrated keep the game's order.
  const opts = s.plugs.map((h) => defs!.plugs[h]).filter((p): p is PlugDef => !!p && !isEmptyPlug(p)).sort((x, y) => rank(y) - rank(x));
  return { sc, group: s.group, multi, sockets, limit, chosen, opts };
}

function refreshPop() {
  const pc = popCtx();
  if (!pc) return closePop();
  const el = popEl();
  const focusedHash = (document.activeElement as HTMLElement | null)?.closest?.("#bd-pop [data-ph]")?.getAttribute("data-ph");
  const hadSearch = document.activeElement?.id === "bd-popq";
  pop!.detail ??= [...pc.chosen][0] ?? pc.opts[0]?.h ?? null;
  const label = GROUP_LABEL[pc.group];
  el.setAttribute("aria-label", `Choose ${label.toLowerCase()}`);
  el.innerHTML = `<div class="bd-pop-head"><div><span class="cap">${esc(pc.multi ? `${label}s` : label)}</span>
      <b>${pc.multi ? `${pc.chosen.size} of ${pc.limit} picked` : esc(pc.sc.n)}</b></div>
      <button class="bd-x bd-pop-x" data-popclose aria-label="Close">✕</button></div>
    ${pc.opts.length > 10 ? `<input class="bd-input" id="bd-popq" type="search" placeholder="Filter ${esc(label.toLowerCase())}s" value="${esc(pop!.q)}" aria-label="Filter">` : ""}
    <div class="bd-pop-body"><div class="bd-pop-grid" id="bd-popg" role="listbox" aria-multiselectable="${pc.multi}" aria-label="${esc(label)}">${popGrid(pc)}</div>
    <div class="bd-pop-detail" id="bd-popd" aria-live="polite">${popDetail()}</div></div>
    <p class="bd-pop-hint">${pc.multi ? "Click to add or remove · arrow keys move · Esc closes" : "Click to use it · arrow keys move · Esc closes"}</p>`;
  el.hidden = false;
  placePop();
  if (focusedHash) el.querySelector<HTMLElement>(`[data-ph="${focusedHash}"]`)?.focus();
  else if (hadSearch) el.querySelector<HTMLInputElement>("#bd-popq")?.focus();
}

function popGrid(pc = popCtx()) {
  if (!pc || !pop) return "";
  const b = cur!;
  const unlocked = profile?.unlocked.get(subclassInstance(profile, b.cls, pc.sc.h)?.id ?? "")?.[pop.i];
  const r = cachedRatings();
  const q = pop.q.trim().toLowerCase();
  const list = pc.opts.filter((p) => !q || `${p.n} ${p.d}`.toLowerCase().includes(q));
  return (
    list
      .map((p) => {
        const on = pc.multi ? pc.chosen.has(p.h) : b.plugs[pop!.i] === p.h;
        const rated = pc.group === "aspects" ? aspectRating(r, p) : pc.group === "fragments" ? fragmentRating(r, p) : null;
        const lock = unlocked && !unlocked.has(p.h) ? "Not unlocked yet" : "";
        const sub = [...(p.st ?? []).map(([h, v]) => `${v > 0 ? "+" : ""}${v} ${ctx().statNames[h]}`), pc.group === "aspects" ? `${p.cap ?? 0} fragment slot${p.cap === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
        return `<button class="bd-popt${on ? " on" : ""}" role="option" aria-selected="${on}" data-ph="${p.h}"${lock ? ` aria-disabled="true" title="${lock}"` : ""}>
          <span class="bd-sico">${img(p.i)}${tierChip(rated?.tier)}</span><span class="bd-pmeta"><b>${esc(p.n)}</b>${sub || lock ? `<span>${esc(lock || sub)}</span>` : ""}</span>${pc.multi ? `<span class="bd-check" aria-hidden="true"></span>` : ""}</button>`;
      })
      .join("") || `<p class="small muted">Nothing matches.</p>`
  );
}

function popDetail() {
  const pc = popCtx();
  const p = pop?.detail ? defs!.plugs[pop.detail] : undefined;
  return pc && p ? plugDetail(p, pc.group, pc.sc, true) : "";
}

function placePop() {
  const t = popTrigger();
  const el = popEl();
  if (!t) return closePop();
  if (innerWidth < 640) return void ((el.style.left = ""), (el.style.top = ""));
  const r = t.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let top = r.bottom + 6;
  if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6 > 8 ? r.top - h - 6 : innerHeight - h - 8);
  el.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  el.style.top = `${top}px`;
}

/** A plug from the popover: replaces an ability; adds or removes an aspect or fragment. */
function pickPlug(h: number) {
  const pc = popCtx();
  const b = cur;
  if (!pc || !b || !pop) return;
  const i = pop.i;
  if (!pc.multi) {
    b.plugs[i] = h;
    closePop();
    touch();
    panel?.querySelector<HTMLElement>(`[data-pop="${i}"]`)?.focus();
    return;
  }
  const open = pc.sockets.slice(0, pc.limit);
  const emptyOf = (j: number) => pc.sc.sockets[j].plugs.find((x) => isEmptyPlug(defs!.plugs[x])) ?? pc.sc.sockets[j].init;
  const at = open.find((j) => b.plugs[j] === h);
  if (at !== undefined) b.plugs[at] = emptyOf(at);
  else {
    // A free slot first; when they are all full, the slot the popover was opened from.
    const target = open.find((j) => isEmptyPlug(defs!.plugs[b.plugs[j]])) ?? (open.includes(i) ? i : open[open.length - 1]);
    if (target === undefined) return;
    b.plugs[target] = h;
  }
  if (pc.group === "aspects") trimFragments(b, defs!);
  pop.detail = h;
  touch();
}

/* ---------- Gear and mods (main column) ---------- */

function gearCard(b: Build, c: Ctx) {
  return `<section class="bd-card glass bd-gear">
    <div class="bd-card-head"><h3>Gear and mods</h3><button class="btn primary bd-sm" data-act="gear">Choose gear and mods</button></div>
    <div class="bd-gearcols">
      <div class="bd-rows"><div class="cap">Weapons</div>${WEAPON_SLOTS.map((slot) => weaponRow(b, c, slot)).join("")}</div>
      <div class="bd-rows"><div class="cap">Armor <span class="bd-capnote">${ARMOR_ENERGY} mod energy each</span></div>${ARMOR_SLOTS.map((slot) => armorRow(b, c, slot)).join("")}</div>
    </div>
  </section>`;
}

function weaponRow(b: Build, c: Ctx, slot: (typeof WEAPON_SLOTS)[number]) {
  const w = weaponOf(c, b.items[slot]?.id);
  const sc = w ? c.scores.get(w.instanceId) : undefined;
  return `<div class="bd-row${w?.rarity === "Exotic" ? " exotic" : ""}">
    <button class="bd-rowbtn" data-act="gear" data-slot="${slot}" aria-label="${esc(`${slot}: ${w ? w.name : "empty"}. Change`)}">
      <span class="bd-iico">${w ? img(w.icon) : `<span class="bd-plus">+</span>`}${tierChip(weaponTier(w?.instanceId))}</span>
      <span class="bd-imeta"><span class="cap">${slot}</span><b>${w ? esc(w.name) : b.items[slot] ? "Missing item" : "Choose a weapon"}</b>${w ? `<span class="sm">${esc(w.type)} · <span class="el" style="color:var(--${esc(w.element)})"><i></i><span>${esc(w.element)}</span></span></span>` : ""}</span>
      ${sc !== undefined ? `<span class="bd-iscore" title="Vault score">${sc}</span>` : ""}</button>
    ${w ? `<span class="bd-links">${weaponLinks(w)}</span>` : ""}
  </div>`;
}

function armorRow(b: Build, c: Ctx, slot: GearSlot) {
  const a = armorOf(c, b.items[slot]?.id);
  const mods = b.mods[slot] ?? Array(MOD_SOCKETS).fill(0);
  const used = modEnergy(mods, defs!);
  const sc = a ? c.scores.get(a.instanceId) : undefined;
  return `<div class="bd-row bd-arow${a?.rarity === "Exotic" ? " exotic" : ""}">
    <button class="bd-rowbtn" data-act="gear" data-slot="${slot}" aria-label="${esc(`${slot}: ${a ? a.name : "empty"}. Change`)}">
      <span class="bd-iico">${a ? img(a.icon) : `<span class="bd-plus">+</span>`}${a?.gearTier ? `<span class="tier tU">T${a.gearTier}</span>` : ""}</span>
      <span class="bd-imeta"><span class="cap">${slot}</span><b>${a ? esc(a.name) : b.items[slot] ? "Missing item" : `Choose ${slot === "Arms" ? "arms" : slot.toLowerCase()}`}</b>${a ? `<span class="sm">${esc(a.archetype ?? "Legacy")} · ${a.statTotal} total</span>` : ""}</span>
      ${sc !== undefined ? `<span class="bd-iscore" title="Vault score">${sc}</span>` : ""}</button>
    <div class="bd-mods">${mods
      .map((h, k) => {
        const p = h ? defs!.plugs[h] : undefined;
        return `<button class="bd-mod${p ? "" : " empty"}" data-act="gear" data-tab="mods" data-slot="${slot}" title="${esc(p ? `${p.n} (${p.cost ?? 0} energy)` : k === 0 ? "General mod" : `${slot} mod`)}" aria-label="${esc(p ? `${slot} mod: ${p.n}` : `Add a ${k === 0 ? "general" : slot} mod`)}">${p ? img(p.i) : `<span class="bd-plus">${k === 0 ? "G" : "+"}</span>`}${p?.cost ? `<i>${p.cost}</i>` : ""}</button>`;
      })
      .join("")}<span class="bd-energy${used > ARMOR_ENERGY ? " over" : ""}" title="Mod energy used"><span style="width:${Math.min(100, (used / ARMOR_ENERGY) * 100)}%"></span><b class="num">${used}/${ARMOR_ENERGY}</b></span></div>
  </div>`;
}

/* ---------- Drawer (gear picker, equip plan, export, import) ---------- */

function drawer(): { el: HTMLElement; scrim: HTMLElement } {
  let el = document.getElementById("bd-drawer");
  let scrim = document.getElementById("bd-scrim");
  if (!el) {
    document.body.insertAdjacentHTML("beforeend", `<div class="scrim" id="bd-scrim"></div><aside class="drawer bd-drawer" id="bd-drawer" role="dialog" aria-modal="true" aria-label="Builds"></aside>`);
    el = document.getElementById("bd-drawer")!;
    scrim = document.getElementById("bd-scrim")!;
    scrim.onclick = closeDrawer;
    el.addEventListener("click", onDrawerClick);
    el.addEventListener("input", (e) => {
      if ((e.target as HTMLElement).id === "bd-gq" && gear) (gear.q = (e.target as HTMLInputElement).value), (gear.shown = LIST_PAGE), drawGearList();
    });
    el.addEventListener("change", (e) => {
      if ((e.target as HTMLElement).id === "bd-gsort" && gear) return (gear.sort = (e.target as HTMLSelectElement).value), drawGearList();
      onDrawerChange(e);
    });
    el.addEventListener("pointerover", (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-dact=gmod]");
      const d = document.getElementById("bd-gdetail");
      const p = t && defs!.plugs[Number(t.dataset.h)];
      if (p && d) d.innerHTML = plugDetail(p, "other", null, true);
    });
    window.addEventListener("keydown", (e: KeyboardEvent) => e.key === "Escape" && el!.classList.contains("open") && closeDrawer());
  }
  return { el, scrim: scrim! };
}
function openDrawer(html: string, wide = false) {
  const d = drawer();
  d.el.classList.toggle("bd-wide", wide);
  d.el.innerHTML = `<button class="d-close" aria-label="Close" data-dact="close">✕</button>${html}`;
  d.el.scrollTop = 0;
  d.el.classList.add("open");
  d.scrim.classList.add("open");
  d.el.querySelector<HTMLElement>("input, .d-close")?.focus();
}
function closeDrawer() {
  const d = drawer();
  d.el.classList.remove("open");
  d.scrim.classList.remove("open");
  gear = null;
}

function onDrawerClick(e: Event) {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-dact]");
  if (!t) return;
  const a = t.dataset.dact;
  if (a === "close") return closeDrawer();
  DRAWER_ACTIONS[a!]?.(t);
}
const DRAWER_ACTIONS: Record<string, (t: HTMLElement) => void> = {};
let onDrawerChange: (e: Event) => void = () => {};

/* ---------- Gear picker: every slot from one list, applied at once ---------- */

type GearTab = "weapons" | "armor" | "mods";
const LIST_PAGE = 120;
let gear: {
  tab: GearTab;
  /** Slot filter on the weapons and armor tabs ("all" or a slot). */
  slot: string;
  /** The armor piece the mods tab adds to. */
  target: GearSlot;
  filter: string;
  sort: string;
  q: string;
  shown: number;
  /** The picks so far; the build changes only on Apply. */
  items: Build["items"];
  mods: Build["mods"];
  note: string;
} | null = null;

const staged = (): Build => ({ ...cur!, items: gear!.items, mods: gear!.mods });

function openGear(tab: GearTab = "weapons", slot = "all") {
  const b = cur!;
  gear = { tab, slot, target: isArmorSlot(slot) ? slot : "Helmet", filter: "all", sort: "score", q: "", shown: LIST_PAGE, items: structuredClone(b.items), mods: structuredClone(b.mods), note: "" };
  if (tab === "mods") gear.slot = "all";
  openDrawer(`<div class="bd-gp">
    <header class="bd-gp-head"><div class="eyebrow">${esc(CLASS_NAME(b.cls))} · ${esc(b.name)}</div><h2>Gear and mods</h2>
      <p class="small muted">Pick for as many slots as you like. Nothing changes until you apply.</p></header>
    <div class="bd-gp-body">
      <div class="bd-gp-pick">
        <div class="bd-tabs" role="tablist" aria-label="What to pick">${(["weapons", "armor", "mods"] as GearTab[]).map((t) => `<button class="bd-tab" role="tab" data-dact="gtab" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>
        <div class="bd-gp-tools"><input class="bd-input" id="bd-gq" type="search" placeholder="Search" aria-label="Search"><label class="bd-sortl"><span class="sr">Sort by</span><select id="bd-gsort" title="Sort by"></select></label></div>
        <div class="subchips" id="bd-gslots"></div>
        <div class="subchips" id="bd-gfilters"></div>
        <div class="bd-glist" id="bd-glist" role="listbox" aria-multiselectable="true" aria-label="Choices"></div>
      </div>
      <aside class="bd-gp-tray" id="bd-gtray" aria-label="Your picks"></aside>
    </div>
    <div class="bd-pfoot"><button class="btn primary" data-dact="gapply" id="bd-gapply">Apply</button><button class="btn ghost" data-dact="greset">Reset</button><button class="btn ghost" data-dact="close">Cancel</button></div>
  </div>`, true);
  drawGear();
}

function drawGear() {
  if (!gear) return;
  for (const t of document.querySelectorAll<HTMLElement>("#bd-drawer [data-dact=gtab]")) t.setAttribute("aria-selected", String(t.dataset.tab === gear.tab));
  const sorts: [string, string][] =
    gear.tab === "weapons" ? [["score", "Vault score"], ["tier", "Aegis tier"], ["name", "Name"]]
    : gear.tab === "armor" ? [["score", "Vault score"], ["total", "Stat total"], ...STAT_HASHES.map((h): [string, string] => [`s${h}`, `${ctx().statNames[h]} stat`]), ["name", "Name"]]
    : [["name", "Name"], ["cost", "Energy cost"]];
  if (!sorts.some(([k]) => k === gear!.sort)) gear.sort = sorts[0][0];
  document.getElementById("bd-gsort")!.innerHTML = sorts.map(([k, l]) => `<option value="${k}"${k === gear!.sort ? " selected" : ""}>${esc(l)}</option>`).join("");
  const slotChips =
    gear.tab === "mods"
      ? ARMOR_SLOTS.map((s) => [s, s] as [string, string])
      : [["all", "All slots"] as [string, string], ...(gear.tab === "weapons" ? WEAPON_SLOTS : ARMOR_SLOTS).map((s) => [s, s] as [string, string])];
  const slotOn = gear.tab === "mods" ? gear.target : gear.slot;
  document.getElementById("bd-gslots")!.innerHTML = `${gear.tab === "mods" ? `<span class="bd-chiplabel">Add to</span>` : ""}${slotChips
    .map(([k, l]) => `<button class="subchip" data-dact="gslot" data-slot="${esc(k)}" aria-pressed="${k === slotOn}">${esc(l)}</button>`)
    .join("")}`;
  const filters: [string, string][] =
    gear.tab === "weapons" ? [["all", "All"], ["exotic", "Exotic"], ...["Kinetic", "Arc", "Solar", "Void", "Stasis", "Strand"].map((e): [string, string] => [e, e])]
    : gear.tab === "armor" ? [["all", "All"], ["exotic", "Exotic"], ["legendary", "Legendary"], ["t5", "Tier 5"]]
    : [["all", "All"], ["stat", "Stat mods"], ["general", "General"], ["slot", `${gear.target} only`]];
  if (!filters.some(([k]) => k === gear!.filter)) gear.filter = "all";
  document.getElementById("bd-gfilters")!.innerHTML = filters.map(([k, l]) => `<button class="subchip" data-dact="gfilter" data-f="${esc(k)}" aria-pressed="${k === gear!.filter}">${esc(l)}</button>`).join("");
  drawGearList();
}

function gearItems(): (WeaponRecord | ArmorRecord)[] {
  const g = gear!;
  const c = ctx();
  const cls = CLASS_NAME(cur!.cls);
  const q = g.q.trim().toLowerCase();
  const list: (WeaponRecord | ArmorRecord)[] =
    g.tab === "weapons" ? c.vault.weapons.filter((w) => isWeaponSlot(w.slot)) : c.vault.armor.filter((a) => isArmorSlot(a.slot) && (a.classType === cls || a.classType === "Any"));
  const pass = (x: WeaponRecord | ArmorRecord) => {
    if (g.slot !== "all" && x.slot !== g.slot) return false;
    if (g.filter === "exotic" && x.rarity !== "Exotic") return false;
    if (g.filter === "legendary" && x.rarity === "Exotic") return false;
    if (g.filter === "t5" && (x.kind !== "armor" || x.gearTier !== 5)) return false;
    if (x.kind === "weapon" && !["all", "exotic"].includes(g.filter) && x.element !== g.filter) return false;
    if (!q) return true;
    const text = x.kind === "weapon" ? `${x.name} ${x.type} ${x.element} ${x.frame}` : `${x.name} ${x.archetype} ${x.setName}`;
    return `${text} ${x.rarity}`.toLowerCase().includes(q);
  };
  const score = (x: WeaponRecord | ArmorRecord) => c.scores.get(x.instanceId) ?? -1;
  const key: Record<string, (x: WeaponRecord | ArmorRecord) => number> = {
    score,
    tier: (x) => TIER_POINTS[weaponTier(x.instanceId) ?? ""] ?? -1,
    total: (x) => (x.kind === "armor" ? x.statTotal : 0),
  };
  const by = g.sort.startsWith("s") && g.sort !== "score" ? (x: WeaponRecord | ArmorRecord) => (x.kind === "armor" ? x.stats[c.statNames[Number(g.sort.slice(1))]] ?? 0 : 0) : key[g.sort];
  const out = list.filter(pass);
  return g.sort === "name" ? out.sort((x, y) => x.name.localeCompare(y.name)) : out.sort((x, y) => by(y) - by(x) || score(y) - score(x));
}

function gearMods(): PlugDef[] {
  const g = gear!;
  const q = g.q.trim().toLowerCase();
  const pcis = g.filter === "general" ? [GENERAL_PCI] : g.filter === "slot" ? [MOD_PCI[g.target]] : [MOD_PCI[g.target], GENERAL_PCI];
  const out = pcis
    .flatMap((pci) => defs!.mods[pci] ?? [])
    .map((h) => defs!.plugs[h])
    .filter((p): p is PlugDef => !!p && !isEmptyPlug(p) && (g.filter !== "stat" || !!p.st?.length) && (!q || `${p.n} ${p.d}`.toLowerCase().includes(q)));
  return g.sort === "cost" ? out.sort((x, y) => (y.cost ?? 0) - (x.cost ?? 0) || x.n.localeCompare(y.n)) : out.sort((x, y) => x.n.localeCompare(y.n));
}

function drawGearList() {
  const g = gear;
  const box = document.getElementById("bd-glist");
  if (!g || !box) return;
  const c = ctx();
  if (g.tab === "mods") {
    const mods = g.mods[g.target] ?? [];
    const free = ARMOR_ENERGY - modEnergy(mods, defs!);
    box.innerHTML =
      gearMods()
        .map((p) => {
          const n = mods.filter((h) => h === p.h).length;
          const cant = (p.cost ?? 0) > free;
          return `<button class="bd-grow bd-gmod${n ? " on" : ""}${cant ? " dim" : ""}" role="option" aria-selected="${n > 0}" data-dact="gmod" data-h="${p.h}" title="${esc(cant ? `Needs ${p.cost} energy, ${free} free on ${g.target}` : p.n)}">
            <span class="bd-iico">${img(p.i)}${p.cost ? `<span class="bd-cost">${p.cost}</span>` : ""}</span>
            <span class="bd-gmeta"><b>${esc(p.n)}</b><span>${p.c === GENERAL_PCI ? "General" : esc(g.target)}${p.st ? " · " + p.st.map(([h, v]) => `+${v} ${esc(c.statNames[h])}`).join(", ") : ""}${clarity[p.h] ? " · Clarity" : ""}</span></span>
            ${n ? `<span class="bd-count num">×${n}</span>` : ""}</button>`;
        })
        .join("") || `<p class="small muted">Nothing matches.</p>`;
  } else {
    const all = gearItems();
    const picked = new Set(Object.values(g.items).map((x) => x?.id));
    box.innerHTML =
      all
        .slice(0, g.shown)
        .map((x) => {
          const sc = c.scores.get(x.instanceId);
          const on = picked.has(x.instanceId);
          const sub =
            x.kind === "weapon"
              ? `${x.type} · <span class="el" style="color:var(--${esc(x.element)})"><i></i><span>${esc(x.element)}</span></span>`
              : `${esc(x.archetype ?? "Legacy")}${x.setName ? ` · ${esc(x.setName)}` : ""}`;
          const stats =
            x.kind === "armor"
              ? `<span class="bd-gstats">${STAT_HASHES.map((h) => {
                  const v = x.stats[c.statNames[h]] ?? 0;
                  return `<span class="${v >= 25 ? "hi" : v <= 0 ? "lo" : ""}" title="${esc(c.statNames[h])}"><i>${esc((c.statNames[h] ?? "").slice(0, 3))}</i>${v}</span>`;
                }).join("")}<span class="tot" title="Stat total"><i>Tot</i>${x.statTotal}</span></span>`
              : "";
          return `<button class="bd-grow${on ? " on" : ""}${x.rarity === "Exotic" ? " exotic" : ""}" role="option" aria-selected="${on}" data-dact="gpick" data-id="${esc(x.instanceId)}">
            <span class="bd-iico">${img(x.icon)}${x.kind === "weapon" ? tierChip(weaponTier(x.instanceId)) : x.gearTier ? `<span class="tier tU">T${x.gearTier}</span>` : ""}</span>
            <span class="bd-gmeta"><b>${esc(x.name)}</b><span>${sub} · ${esc(where(x.location))}</span></span>
            ${stats}<span class="bd-gslot">${esc(x.slot)}</span>${sc !== undefined ? `<span class="bd-iscore" title="Vault score">${sc}</span>` : `<span></span>`}<span class="bd-check" aria-hidden="true"></span></button>`;
        })
        .join("") +
        (all.length > g.shown ? `<button class="btn ghost bd-more" data-dact="gmore">Show all ${all.length}</button>` : "") || `<p class="small muted">Nothing matches.</p>`;
  }
  drawTray();
}

function drawTray() {
  const g = gear;
  const box = document.getElementById("bd-gtray");
  if (!g || !box) return;
  const c = ctx();
  const b = cur!;
  const changes =
    [...WEAPON_SLOTS, ...ARMOR_SLOTS].filter((s) => (g.items[s]?.id ?? "") !== (b.items[s]?.id ?? "")).length +
    ARMOR_SLOTS.reduce((n, s) => n + Array.from({ length: MOD_SOCKETS }, (_, k) => ((g.mods[s]?.[k] ?? 0) !== (b.mods[s]?.[k] ?? 0) ? 1 : 0)).reduce<number>((a, x) => a + x, 0), 0);
  const slot = (s: BuildSlot) => {
    const x = itemOf(c, g.items[s]?.id);
    const changed = (g.items[s]?.id ?? "") !== (b.items[s]?.id ?? "");
    return `<div class="bd-tslot${changed ? " changed" : ""}${x?.rarity === "Exotic" ? " exotic" : ""}">
      <button class="bd-tico" data-dact="gslot" data-slot="${s}" title="${esc(x ? `${s}: ${x.name}` : `Choose ${s}`)}" aria-label="${esc(`${s}: ${x ? x.name : "empty"}`)}">${x ? img(x.icon) : `<span class="bd-plus">+</span>`}</button>
      <span class="bd-tmeta"><span class="cap">${s}</span><b>${x ? esc(x.name) : "Empty"}</b></span>
      ${g.items[s] ? `<button class="bd-x" data-dact="gclear" data-slot="${s}" aria-label="Clear ${s}">✕</button>` : ""}</div>`;
  };
  const modRow = (s: GearSlot) => {
    const mods = g.mods[s] ?? Array(MOD_SOCKETS).fill(0);
    const used = modEnergy(mods, defs!);
    return `<div class="bd-tmods${g.tab === "mods" && g.target === s ? " on" : ""}"><button class="bd-tmlabel" data-dact="gtarget" data-slot="${s}">${s}</button>${Array.from({ length: MOD_SOCKETS }, (_, k) => {
      const p = mods[k] ? defs!.plugs[mods[k]] : undefined;
      return p
        ? `<button class="bd-mod" data-dact="gunmod" data-slot="${s}" data-k="${k}" title="${esc(`${p.n}: click to remove`)}" aria-label="Remove ${esc(p.n)}">${img(p.i)}${p.cost ? `<i>${p.cost}</i>` : ""}</button>`
        : `<button class="bd-mod empty" data-dact="gtarget" data-slot="${s}" aria-label="Add a mod to ${s}"><span class="bd-plus">${k === 0 ? "G" : "+"}</span></button>`;
    }).join("")}<span class="bd-energy${used > ARMOR_ENERGY ? " over" : ""}"><span style="width:${Math.min(100, (used / ARMOR_ENERGY) * 100)}%"></span><b class="num">${used}/${ARMOR_ENERGY}</b></span></div>`;
  };
  const before = new Map(statLines(b, c).map((l) => [l.hash, l.total]));
  const stats = statLines(staged(), c)
    .map((l) => {
      const d = l.total - (before.get(l.hash) ?? 0);
      return `<div class="bd-tstat"><span>${esc(l.name)}</span><span class="bd-sbar"><i class="a" style="width:${(l.total / STAT_MAX) * 100}%"></i><s style="left:50%"></s></span><b class="num">${l.total}</b><em class="${d > 0 ? "up" : d < 0 ? "down" : ""}">${d ? (d > 0 ? "+" : "") + d : ""}</em></div>`;
    })
    .join("");
  box.innerHTML = `<div class="cap">Your picks <span class="bd-capnote">${changes} change${changes === 1 ? "" : "s"}</span></div>
    <div class="bd-tslots">${[...WEAPON_SLOTS, ...ARMOR_SLOTS].map(slot).join("")}</div>
    <div class="cap">Mods</div><div class="bd-tmodlist">${ARMOR_SLOTS.map(modRow).join("")}</div>
    ${g.tab === "mods" ? `<div class="bd-gdetail" id="bd-gdetail"><p class="small muted">Point at a mod to see what it does.</p></div>` : ""}
    <div class="bd-tstats"><div class="cap">Stats with these picks</div>${stats}</div>
    <p class="small bd-gnote" aria-live="polite">${esc(g.note)}</p>`;
  const apply = document.getElementById("bd-gapply") as HTMLButtonElement | null;
  if (apply) {
    apply.disabled = !changes;
    apply.textContent = changes ? `Apply ${changes} change${changes === 1 ? "" : "s"}` : "No changes yet";
  }
}

Object.assign(DRAWER_ACTIONS, {
  gtab: (t: HTMLElement) => {
    if (!gear) return;
    gear.tab = t.dataset.tab as GearTab;
    gear.slot = "all";
    gear.filter = "all";
    gear.shown = LIST_PAGE;
    drawGear();
  },
  gslot: (t: HTMLElement) => {
    if (!gear) return;
    const s = t.dataset.slot!;
    if (gear.tab === "mods" && isArmorSlot(s)) gear.target = s;
    else {
      gear.tab = s === "all" ? gear.tab : isWeaponSlot(s) ? "weapons" : "armor";
      gear.slot = gear.slot === s && s !== "all" ? "all" : s;
    }
    gear.shown = LIST_PAGE;
    drawGear();
  },
  gtarget: (t: HTMLElement) => {
    if (!gear) return;
    gear.tab = "mods";
    gear.target = t.dataset.slot as GearSlot;
    drawGear();
  },
  gfilter: (t: HTMLElement) => {
    if (!gear) return;
    gear.filter = t.dataset.f!;
    gear.shown = LIST_PAGE;
    drawGear();
  },
  gmore: () => {
    if (!gear) return;
    gear.shown = Infinity;
    drawGearList();
  },
  gpick: (t: HTMLElement) => {
    if (!gear) return;
    const c = ctx();
    const x = itemOf(c, t.dataset.id);
    if (!x || x.slot === "Unknown") return;
    const s = x.slot as BuildSlot;
    gear.note = "";
    if (gear.items[s]?.id === x.instanceId) {
      delete gear.items[s];
      gear.note = `${s} cleared.`;
    } else {
      const clash = exoticClash(staged(), c, s, x);
      if (clash) (delete gear.items[clash]), (gear.note = `Only one exotic ${x.kind}: took it out of ${clash}.`);
      gear.items[s] = { id: x.instanceId, hash: x.itemHash };
    }
    const top = document.getElementById("bd-glist")?.scrollTop ?? 0;
    drawGearList();
    document.getElementById("bd-glist")!.scrollTop = top;
  },
  gclear: (t: HTMLElement) => {
    if (!gear) return;
    delete gear.items[t.dataset.slot as BuildSlot];
    drawGearList();
  },
  gmod: (t: HTMLElement) => {
    if (!gear) return;
    const p = defs!.plugs[Number(t.dataset.h)];
    const mods = (gear.mods[gear.target] ??= Array(MOD_SOCKETS).fill(0));
    const k = p.c === GENERAL_PCI ? (mods[0] ? -1 : 0) : mods.findIndex((h, j) => j > 0 && !h);
    const free = ARMOR_ENERGY - modEnergy(mods, defs!);
    gear.note = k < 0 ? `No free ${p.c === GENERAL_PCI ? "general" : gear.target} socket: click a mod on the right to remove it.` : (p.cost ?? 0) > free ? `${p.n} needs ${p.cost} energy; ${gear.target} has ${free} free.` : "";
    if (!gear.note) mods[k] = p.h;
    drawGearList();
  },
  gunmod: (t: HTMLElement) => {
    if (!gear) return;
    const mods = gear.mods[t.dataset.slot as GearSlot];
    if (mods) mods[Number(t.dataset.k)] = 0;
    drawGearList();
  },
  greset: () => {
    if (!gear || !cur) return;
    gear.items = structuredClone(cur.items);
    gear.mods = structuredClone(cur.mods);
    gear.note = "Back to the build as saved.";
    drawGearList();
  },
  gapply: () => {
    if (!gear || !cur) return;
    cur.items = gear.items;
    cur.mods = gear.mods;
    closeDrawer();
    touch();
  },
});

/* ---------- Details ---------- */

function plugDetail(p: PlugDef, group: SocketGroup, sc: SubclassDef | null, compact = false) {
  const r = ctx().ratings;
  const rated = group === "aspects" ? aspectRating(r, p) : group === "fragments" ? fragmentRating(r, p) : null;
  const info = infoFor(r, p.n);
  const notes = clarity[p.h] ?? [];
  const stats = (p.st ?? []).map(([h, v]) => statChip(h, v)).join("");
  const sub = sc && group === "super" ? subclassRating(r, sc) : null;
  return `<div class="bd-dhead">${img(p.i)}<div><b>${esc(p.n)}</b><span>${esc(p.t ?? GROUP_LABEL[group])}${p.cap ? ` · ${p.cap} fragment slots` : ""}${p.cost && group !== "fragments" ? ` · ${p.cost} energy` : ""}</span></div>
      ${rated ? `<span class="bd-dtier">${tierChip(rated.tier)}<span>${rated.rank ? `#${rated.rank}` : ""}</span></span>` : ""}</div>
    ${stats ? `<div class="bd-dstats">${stats}</div>` : ""}
    ${p.d ? `<p class="bd-desc">${esc(p.d)}</p>` : ""}
    ${notes.length ? `<div class="bd-clarity"><div class="cap">Clarity · community tested</div>${notes.map((t) => `<p>${esc(t)}</p>`).join("")}</div>` : ""}
    ${rated ? `<div class="bd-aegis"><div class="cap">Aegis · ${esc(rated.tier)} tier${rated.subclass ? ` · ${esc(rated.subclass)}` : ""}</div>
      ${!compact && rated.trigger ? `<div><span>Trigger</span><p>${esc(rated.trigger)}</p></div>` : ""}${rated.effect && !(compact && notes.length) ? `<div><span>Effect</span><p>${esc(rated.effect)}</p></div>` : ""}${rated.usage ? `<div><span>Why</span><p>${esc(rated.usage)}</p></div>` : ""}</div>` : ""}
    ${sub ? `<div class="bd-aegis"><div class="cap">Aegis · super ${sub.scores.super ?? "—"}/10 for ${esc(sub.element)} ${esc(sub.cls)}</div><p>${esc(sub.supers)}</p></div>` : ""}
    ${info && !(compact && (notes.length || rated)) ? `<details class="bd-info"${rated || notes.length ? "" : " open"}><summary class="cap">Data Compendium</summary><p>${esc(info)}</p></details>` : ""}`;
}

/* ---------- Actions ---------- */

function wire(el: HTMLElement) {
  el.dataset.wired = "1";
  el.addEventListener("click", (e) => {
    const p = (e.target as HTMLElement).closest<HTMLElement>("[data-pop]");
    if (p) {
      const i = Number(p.dataset.pop);
      // A second click on a pinned popover's socket closes it; a click (or tap) otherwise pins it open.
      if (pop?.i === i && pop.pinned) return closePop();
      return openPop(i, true, (e as MouseEvent).detail === 0);
    }
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (t && !(t as HTMLButtonElement).disabled) ACTIONS[t.dataset.act!]?.(t);
  });
  // Subclass buttons: a hover card with what the subclass is (mouse and keyboard focus).
  el.addEventListener("pointerover", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (t && e.pointerType === "mouse") showTip(t);
  });
  el.addEventListener("pointerout", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (t && !t.contains(e.relatedTarget as Node | null)) hideTip();
  });
  el.addEventListener("focusin", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (t?.matches(":focus-visible")) showTip(t);
  });
  el.addEventListener("focusout", (e) => (e.target as HTMLElement).closest("[data-tip]") && hideTip());
  // Hover opens a socket's popover (mouse only; touch taps go through click).
  el.addEventListener("pointerover", (e) => {
    const p = (e.target as HTMLElement).closest<HTMLElement>("[data-pop]");
    if (!p || e.pointerType !== "mouse" || pop?.pinned) return;
    clearTimeout(popTimer);
    if (pop?.i === Number(p.dataset.pop)) return;
    popTimer = window.setTimeout(() => openPop(Number(p.dataset.pop), false), pop ? 60 : 160);
  });
  el.addEventListener("pointerout", (e) => {
    const p = (e.target as HTMLElement).closest<HTMLElement>("[data-pop]");
    if (!p || e.pointerType !== "mouse" || pop?.pinned) return;
    const to = e.relatedTarget as Node | null;
    if (to && (p.contains(to) || document.getElementById("bd-pop")?.contains(to))) return;
    if (pop) closeSoon();
    else clearTimeout(popTimer);
  });
  // Keyboard focus shows the popover; arrow down moves into it.
  el.addEventListener("focusin", (e) => {
    const p = (e.target as HTMLElement).closest<HTMLElement>("[data-pop]");
    if (p && p.matches(":focus-visible") && pop?.i !== Number(p.dataset.pop)) openPop(Number(p.dataset.pop), false);
  });
  el.addEventListener("focusout", (e) => {
    if ((e.target as HTMLElement).closest("[data-pop]")) leaveCheck(e.relatedTarget as Node | null);
  });
  el.addEventListener("keydown", (e) => {
    const p = (e.target as HTMLElement).closest<HTMLElement>("[data-pop]");
    if (p && e.key === "ArrowDown") return e.preventDefault(), openPop(Number(p.dataset.pop), true, true);
    if (p && e.key === "Escape" && pop) return closePop();
    if (e.key === "Escape" && delAsk) return ACTIONS.delno(e.target as HTMLElement);
    const t = e.target as HTMLInputElement;
    if (t.id === "bd-tag" && e.key === "Enter" && cur && t.value.trim()) {
      cur.tags = [...new Set([...cur.tags, t.value.trim()])];
      touch();
      panel?.querySelector<HTMLInputElement>("#bd-tag")?.focus();
    }
  });
  el.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "bd-q") {
      listQuery = t.value;
      for (const card of panel!.querySelectorAll<HTMLElement>(".bd-bcard")) {
        const b = builds.find((x) => x.id === card.dataset.id);
        card.hidden = !!b && !!listQuery && !listText(b).includes(listQuery.toLowerCase());
      }
    } else if (cur && t.id === "bd-name") {
      cur.name = t.value || "Untitled build";
      const card = panel!.querySelector(".bd-bcard.on .bd-bmeta b");
      if (card) card.textContent = cur.name;
      touch(false);
    } else if (cur && t.id === "bd-notes") (cur.notes = t.value), touch(false);
  });
  el.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (cur && t.dataset.target) {
      const v = Math.max(0, Math.min(STAT_MAX, Math.round(Number(t.value) || 0)));
      if (v) cur.targets[Number(t.dataset.target)] = v;
      else delete cur.targets[Number(t.dataset.target)];
      touch();
    }
  });
}

const ACTIONS: Record<string, (t: HTMLElement) => void> = {
  retry: () => {
    loadError = "";
    log.length = 0;
    loading = load();
    if (panel) panel.innerHTML = loadingCard();
  },
  new: (t) => {
    cur = newBuild(t.dataset.cls ? Number(t.dataset.cls) : (listCls ?? classChoices()[0] ?? 0));
    listCls = cur.cls;
    const sc = Object.values(defs!.subclasses).find((s) => s.cls === cur!.cls && s.el === "Prismatic");
    cur.name = `${CLASS_NAME(cur.cls)} build ${builds.filter((b) => b.cls === cur!.cls).length + 1}`;
    if (sc && (!charFor(profile, cur.cls) || subclassInstance(profile, cur.cls, sc.h))) setSubclass(sc);
    touch();
  },
  open: (t) => {
    closePop();
    cur = builds.find((b) => b.id === t.dataset.id) ?? cur;
    draw();
    panel?.querySelector(".bd-editor")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  },
  cls: (t) => {
    if (!cur || Number(t.dataset.cls) === cur.cls) return;
    cur.cls = Number(t.dataset.cls);
    listCls = cur.cls;
    cur.subclass = null;
    cur.plugs = {};
    for (const s of ARMOR_SLOTS) delete cur.items[s];
    cur.mods = {};
    touch();
  },
  untag: (t) => {
    if (!cur) return;
    cur.tags.splice(Number(t.dataset.i), 1);
    touch();
  },
  dup: () => {
    if (!cur) return;
    const copy: Build = { ...structuredClone(cur), id: newId(), name: cur.name + " (copy)", dimId: undefined, created: new Date().toISOString() };
    builds.splice(builds.indexOf(cur), 0, copy);
    cur = copy;
    touch();
  },
  // Delete asks first, in the build's card, and removes the build from this app only: DIM and the game are untouched.
  del: () => cur && askDelete(cur.id),
  askdel: (t) => askDelete(t.dataset.id!),
  delno: () => {
    const id = delAsk;
    delAsk = null;
    draw();
    panel?.querySelector<HTMLElement>(`.bd-bdel[data-id="${id}"]`)?.focus();
  },
  delyes: (t) => {
    const gone = builds.find((b) => b.id === t.dataset.id);
    delAsk = null;
    if (!gone) return draw();
    builds = builds.filter((b) => b !== gone);
    saveBuilds(builds);
    if (cur === gone) cur = builds.find((b) => b.cls === listCls) ?? null;
    draw();
  },
  lcls: (t) => {
    const k = Number(t.dataset.cls);
    if (k === listCls) return;
    closePop();
    listCls = k;
    listQuery = "";
    delAsk = null;
    cur = builds.find((b) => b.cls === k) ?? null;
    draw();
  },
  subclass: (t) => {
    hideTip();
    const sc = defs!.subclasses[Number(t.dataset.h)];
    if (!cur || !sc || sc.h === cur.subclass) return;
    closePop();
    setSubclass(sc);
    touch();
  },
  gear: (t) => openGear(t.dataset.tab === "mods" ? "mods" : t.dataset.slot && isArmorSlot(t.dataset.slot) ? "armor" : "weapons", t.dataset.slot ?? "all"),
  equip: () => void equipFlow(),
  dim: () => dimFlow(),
  import: () => importFlow(),
};

function askDelete(id: string) {
  const b = builds.find((x) => x.id === id);
  if (!b) return;
  listCls = b.cls;
  delAsk = id;
  draw();
  const box = panel?.querySelector<HTMLElement>(".bd-bcard.asking");
  box?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  box?.querySelector<HTMLElement>("[data-act=delno]")?.focus();
}

function setSubclass(sc: SubclassDef) {
  if (!cur) return;
  // Keep the aspects and fragments that the new subclass also takes (Prismatic shares many).
  const old = cur.subclass ? defs!.subclasses[cur.subclass] : null;
  const keep = new Map<SocketGroup, number[]>();
  if (old) for (const g of ["aspects", "fragments"] as SocketGroup[]) keep.set(g, socketsOf(old, g).map((i) => cur!.plugs[i]).filter((h) => h && !isEmptyPlug(defs!.plugs[h])));
  cur.subclass = sc.h;
  cur.plugs = defaultPlugs(sc);
  for (const [g, hs] of keep) {
    const free = socketsOf(sc, g);
    for (const h of hs) if (sc.sockets[free[0]]?.plugs.includes(h)) cur.plugs[free.shift()!] = h;
  }
  trimFragments(cur, defs!);
}

/* ---------- Equip ---------- */

let lastPlan: Plan | null = null;

async function equipFlow(target: Build | null = cur, undoing = false) {
  if (!target) return;
  openDrawer(`<div class="bd-pick"><div><div class="eyebrow">Dry run</div><h2>Checking your ${esc(CLASS_NAME(target.cls))}…</h2></div><p class="small muted">Reading your characters from Bungie. Nothing changes yet.</p></div>`);
  try {
    profile = await fetchBuildProfile();
  } catch (e) {
    return openDrawer(`<div class="bd-pick"><h2>Couldn't read your characters</h2><p class="vr-err">${esc((e as Error).message)}</p></div>`);
  }
  const slotSel = (charFor(profile, target.cls)?.loadouts ?? []).map((l, i) => `<option value="${i}">Loadout ${i + 1}${l.empty ? " (empty)" : ""}</option>`).join("");
  const drawPlan = (slot = -1) => {
    lastPlan = planEquip(target, ctx(), profile!, { loadoutSlot: slot });
    const steps = lastPlan.steps;
    const changes = steps.filter((s) => s.kind !== "note" && !(s.kind === "move" && !s.run));
    openDrawer(`<div class="bd-pick bd-plan">
      <div><div class="eyebrow">${undoing ? "Undo · dry run" : "Dry run"} · nothing has changed yet</div><h2>${esc(target.name)} → ${esc(CLASS_NAME(target.cls))}</h2></div>
      ${lastPlan.noop && slot < 0 ? `<p class="bd-ok">Your ${esc(CLASS_NAME(target.cls))} already matches this build.</p>` : `<p class="small muted">${changes.length} change${changes.length === 1 ? "" : "s"}. Bungie needs you in orbit, the Tower or a social space for subclass and mod changes.</p>`}
      <ol class="bd-steps">${steps.map((s, i) => `<li class="k-${s.kind}${s.warn ? " warn" : ""}" data-step="${i}"><span class="bd-dot"></span><span>${esc(s.text)}</span><em></em></li>`).join("")}</ol>
      ${slotSel ? `<label class="small bd-slot">Also save it to an in-game loadout <select id="bd-lslot"><option value="-1">No</option>${slotSel}</select></label>` : ""}
      <div class="bd-pfoot"><button class="btn primary" data-dact="apply" ${lastPlan.noop && slot < 0 ? "disabled" : ""}>${undoing ? "Put it back" : "Equip now"}</button><button class="btn ghost" data-dact="close">Cancel</button></div>
      <p class="small muted" id="bd-eqmsg" aria-live="polite"></p></div>`);
    const sel = document.getElementById("bd-lslot") as HTMLSelectElement | null;
    if (sel) sel.value = String(slot);
  };
  onDrawerChange = (e) => {
    if ((e.target as HTMLElement).id === "bd-lslot") drawPlan(Number((e.target as HTMLSelectElement).value));
  };
  DRAWER_ACTIONS.apply = async (btn) => {
    if (!lastPlan?.charId) return;
    (btn as HTMLButtonElement).disabled = true;
    const before = undoing ? null : { build: captureCharacter(lastPlan.charId, profile!, ctx(), `Before ${target.name}`), charId: lastPlan.charId };
    const msg = document.getElementById("bd-eqmsg")!;
    msg.textContent = "Working…";
    const r = await applyPlan(lastPlan, (i, st, m) => {
      const li = document.querySelector<HTMLElement>(`#bd-drawer [data-step="${i}"]`);
      if (!li) return;
      li.dataset.st = st;
      li.querySelector("em")!.textContent = st === "ok" ? "✓" : st === "fail" ? `✕ ${m ?? ""}` : "…";
    });
    if (before) undo = before;
    msg.innerHTML = r.ok
      ? `Done. ${undo && !undoing ? `<button class="linkbtn" data-dact="undo">Undo: put the previous gear back</button>` : ""}`
      : `Not everything worked: ${esc(r.error)} ${undo && !undoing ? `<button class="linkbtn" data-dact="undo">Put the previous gear back</button>` : ""}`;
    profile = await fetchBuildProfile().catch(() => profile);
    draw();
  };
  DRAWER_ACTIONS.undo = () => undo && void equipFlow(undo.build, true);
  drawPlan();
}

/* ---------- DIM ---------- */

function dimFlow() {
  const b = cur!;
  const inst = subclassInstance(profile, b.cls, b.subclass)?.id;
  const json = toDimLoadout(b, ctx(), inst);
  openDrawer(`<div class="bd-pick">
    <div><div class="eyebrow">Export</div><h2>${esc(b.name)} → DIM</h2></div>
    <p class="small muted">DIM gets the weapons, armor, subclass setup, mods and stat targets. Save it to your DIM loadouts, or share a link anyone can open.</p>
    <div class="bd-dimbtns">
      <button class="btn primary" data-dact="dimsave">Save to my DIM loadouts</button>
      <button class="btn" data-dact="dimshare">Copy dim.gg share link</button>
      <a class="btn" href="${esc(dimImportUrl(json))}" target="_blank" rel="noopener">Open in DIM</a>
      <button class="btn ghost" data-dact="dimjson">Copy JSON</button>
    </div>
    <p class="small" id="bd-dimmsg" aria-live="polite"></p>
    <details class="bd-info"><summary class="cap">Loadout JSON</summary><textarea class="bd-json" readonly rows="10">${esc(JSON.stringify(json, null, 2))}</textarea></details></div>`);
  const msg = (s: string) => (document.getElementById("bd-dimmsg")!.innerHTML = s);
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      msg(done);
    } catch {
      msg(`Copy this: <input class="bd-input" readonly value="${esc(text)}" onfocus="this.select()">`);
    }
  };
  DRAWER_ACTIONS.dimsave = async (t) => {
    (t as HTMLButtonElement).disabled = true;
    msg("Saving to DIM…");
    try {
      await saveToDim(json);
      b.dimId = json.id;
      touch(false);
      msg("Saved. It shows in DIM's Loadouts after DIM syncs (reload DIM if it's open).");
    } catch (e) {
      msg(`Couldn't save to DIM: ${esc((e as Error).message)}`);
    }
    (t as HTMLButtonElement).disabled = false;
  };
  DRAWER_ACTIONS.dimshare = async (t) => {
    (t as HTMLButtonElement).disabled = true;
    msg("Asking DIM for a link…");
    try {
      const link = await shareDimLoadout(json);
      await copy(link, `Copied <a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>`);
    } catch (e) {
      msg(`Couldn't make a share link: ${esc((e as Error).message)}`);
    }
    (t as HTMLButtonElement).disabled = false;
  };
  DRAWER_ACTIONS.dimjson = () => void copy(JSON.stringify(json), "Copied the loadout JSON.");
}

/* ---------- Import ---------- */

function importFlow() {
  const chars = profile?.chars ?? [];
  openDrawer(`<div class="bd-pick">
    <div><div class="eyebrow">Import</div><h2>Start from something you have</h2></div>
    <div class="cap">What a character is wearing</div>
    <div class="bd-dimbtns">${chars.length ? chars.map((c) => `<button class="btn" data-dact="fromchar" data-id="${c.id}">${esc(CLASS_NAME(c.cls))} · ${c.light}</button>`).join("") : `<span class="small muted">${profile ? "No characters found." : "Still reading your characters… try again in a moment."}</span>`}</div>
    <div class="cap">DIM loadouts</div>
    <div id="bd-dimlist"><button class="btn" data-dact="dimlist">Load my DIM loadouts</button></div></div>`);
  DRAWER_ACTIONS.fromchar = (t) => {
    const c = chars.find((x) => x.id === t.dataset.id)!;
    cur = captureCharacter(c.id, profile!, ctx(), `${CLASS_NAME(c.cls)} current gear`);
    closeDrawer();
    touch();
  };
  let list: Awaited<ReturnType<typeof dimLoadouts>> = [];
  DRAWER_ACTIONS.dimlist = async (t) => {
    (t as HTMLButtonElement).disabled = true;
    const box = document.getElementById("bd-dimlist")!;
    box.innerHTML = `<p class="small muted">Reading DIM…</p>`;
    try {
      list = (await dimLoadouts()).filter((l) => l.classType <= 2 || l.classType === 3);
      box.innerHTML = list.length
        ? `<div class="bd-pgrid">${list
            .map((l, i) => {
              const sc = l.equipped?.map((e) => defs!.subclasses[e.hash]).find(Boolean);
              return `<button class="bd-opt" data-dact="fromdim" data-i="${i}"><span class="bd-oico">${img(sc?.i)}</span><span class="bd-ometa"><b>${esc(l.name)}</b><span>${esc(l.classType <= 2 ? CLASS_NAME(l.classType) : "Any class")} · ${(l.equipped?.length ?? 0) + (l.unequipped?.length ?? 0)} items</span></span></button>`;
            })
            .join("")}</div>`
        : `<p class="small muted">You have no DIM loadouts.</p>`;
    } catch (e) {
      box.innerHTML = `<p class="vr-err">Couldn't read DIM: ${esc((e as Error).message)}</p>`;
    }
  };
  DRAWER_ACTIONS.fromdim = (t) => {
    const l = list[Number(t.dataset.i)];
    if (!l) return;
    cur = fromDimLoadout(l, ctx());
    closeDrawer();
    touch();
  };
}

declare global {
  interface Window {
    VR_BUILDS?: { render: (el: HTMLElement) => void; count: () => number | null };
  }
}
