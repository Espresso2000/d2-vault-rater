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
  armorOf, aspectRating, buildScore, defaultPlugs, exoticClash, fragmentRating, fragmentSlots, fromDimLoadout, fromGameLoadout, infoFor, isEmptyPlug,
  commitBuild, isUnsaved, itemOf, lastUsed, modEnergy, newBuild, sameLoadout, newId, socketsOf, statLines, subclassRating, toDimLoadout, trimFragments, weaponOf,
  type Build, type BuildSlot, type Ctx, type GearSlot,
} from "./model";
import { captureCharacter, charFor, fetchBuildProfile, subclassInstance, type BuildProfile } from "./profile";
import { applyPlan, planEquip, type Plan } from "./equip";
import { loadingBlock } from "../loading";
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
/** Aegis's four subclass scores (0–10): his sheet groups Super and Enhancement under damage, Offense and Defense under roaming. */
const ROLES = [
  ["super", "Boss super", "How much boss damage the subclass's best super does. Aegis, 0 to 10."],
  ["enhancement", "Damage buffs", "Aegis's \"Enhancement\": how much the subclass raises damage for you and your team with buffs and debuffs such as Radiant, Weaken, Unravel or Jolt. 0 to 10."],
  ["offense", "Roam offense", "How well the subclass clears adds while roaming. Aegis, 0 to 10."],
  ["defense", "Roam defense", "How well the subclass keeps you alive while roaming (healing, overshields, damage resistance). Aegis, 0 to 10."],
] as const;
const isWeaponSlot = (s: string) => (WEAPON_SLOTS as readonly string[]).includes(s);
const isArmorSlot = (s: string): s is GearSlot => (ARMOR_SLOTS as readonly string[]).includes(s);

let input: BuildsInput | null = null;
let panel: HTMLElement | null = null;
let defs: BuildDefs | null = null;
let profile: BuildProfile | null = null;
/** True while the characters (and so the in-game loadouts) are being read. */
let profileBusy = false;
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
  window.VR_BUILDS = { render, count: () => builds.length || null, leave: (next) => (unsaved() ? (guard(next), false) : true) };
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
    cur = builds[0] ? structuredClone(builds[0]) : null;
    profileBusy = true;
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
  profileBusy = false;
  draw();
}

function loadingCard() {
  return `<div class="bd-loading glass"><div class="eyebrow">Builds</div><h2>${loadError ? "Couldn't load the build data" : "Loading build data…"}</h2>
    ${loadError ? `<p class="vr-err">${esc(loadError)}</p><button class="btn primary" data-act="retry">Try again</button>` : ""}
    <ol class="vr-log">${log.map((l) => `<li>${esc(l)}</li>`).join("")}</ol></div>`;
}

/* ---------- Saving ---------- */

// The editor works on a draft (cur, a copy of the saved build). Nothing is written until Save; leaving with
// unsaved changes asks first (switching builds, classes or report tabs, and closing the page).
const unsaved = () => isUnsaved(builds, cur);

function touch(redraw = true) {
  if (!cur) return;
  cur.updated = new Date().toISOString();
  if (redraw) draw();
  else saveState();
}

/** Shows whether there is anything to save, without redrawing the editor (typing in the name or notes). */
function saveState() {
  const dirty = unsaved();
  panel?.querySelectorAll<HTMLButtonElement>("[data-act=save], [data-act=revert]").forEach((b) => (b.disabled = !dirty));
  const s = panel?.querySelector("#bd-saved");
  if (s) (s.textContent = dirty ? "Unsaved changes" : "Saved"), s.classList.toggle("dirty", dirty);
}

function saveCur() {
  if (!cur) return;
  builds = commitBuild(builds, cur);
  saveBuilds(builds);
  cur = structuredClone(builds.find((b) => b.id === cur!.id)!);
  draw();
}

function revertCur() {
  const saved = cur && builds.find((b) => b.id === cur!.id);
  cur = saved ? structuredClone(saved) : (builds.find((b) => b.cls === listCls) ? structuredClone(builds.find((b) => b.cls === listCls)!) : null);
  draw();
}

/** Runs next() now if nothing is unsaved; otherwise asks Save / Discard / Keep editing first. */
function guard(next: () => void) {
  if (!unsaved()) return next();
  let dlg = document.getElementById("bd-unsaved") as HTMLDialogElement | null;
  if (!dlg) {
    document.body.insertAdjacentHTML("beforeend", `<dialog class="bd-dialog" id="bd-unsaved" aria-labelledby="bd-unsaved-h"><h3 id="bd-unsaved-h">Unsaved changes</h3><p></p>
      <div class="bd-dialog-btns"><button class="btn primary" value="save">Save</button><button class="btn" value="discard">Discard changes</button><button class="btn ghost" value="cancel">Keep editing</button></div></dialog>`);
    dlg = document.getElementById("bd-unsaved") as HTMLDialogElement;
    dlg.addEventListener("click", (e) => {
      const v = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.value;
      if (v) dlg!.close(v);
    });
  }
  dlg.querySelector("p")!.textContent = `“${cur!.name}” has changes that aren't saved yet.`;
  dlg.returnValue = "cancel";
  dlg.onclose = () => {
    if (dlg!.returnValue === "save") saveCur();
    else if (dlg!.returnValue === "discard") revertCur();
    else return;
    next();
  };
  dlg.showModal();
  dlg.querySelector<HTMLElement>("button[value=save]")?.focus();
}

addEventListener("beforeunload", (e) => {
  if (unsaved()) e.preventDefault();
});

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
  const mine = builds.filter((b) => b.cls === cls).sort((a, b) => lastUsed(b).localeCompare(lastUsed(a)));
  const q = listQuery.toLowerCase();
  const game = gameLoadouts(cls, c);
  return `<section class="bd-saved glass" aria-label="Saved builds">
    <div class="bd-saved-head">
      <span class="cap">Saved builds</span>
      <div class="seg bd-clsseg" role="tablist" aria-label="Class">${classChoices()
        .map((k) => `<button role="tab" data-act="lcls" data-cls="${k}" aria-selected="${k === cls}">${CLASS_NAME(k)}<span class="count">${builds.filter((b) => b.cls === k).length}</span></button>`)
        .join("")}</div>
      ${mine.length > 4 ? `<input class="bd-input bd-q" id="bd-q" type="search" placeholder="Search ${esc(CLASS_NAME(cls))} builds" value="${esc(listQuery)}" aria-label="Search builds">` : ""}
    </div>
    <div class="bd-cards">${loadoutCard(game)}${newCard(cls)}${mine.map((b) => buildCard(b, c, !!q && !listText(b).includes(q), game.find((l) => l.match?.id === b.id))).join("")}</div>
  </section>`;
}

/** This class's in-game loadouts as builds, in slot order, each with the saved build that matches it exactly. */
function gameLoadouts(cls: number, c: Ctx) {
  const ch = charFor(profile, cls);
  if (!ch || !defs) return [];
  const sub = (id: string) => ch.subclasses.find((x) => x.id === id)?.hash;
  return ch.loadouts.flatMap((l, i) => {
    if (l.empty) return [];
    const look = defs!.loadoutLook;
    const name = look?.names[l.nameHash] || `Loadout ${i + 1}`;
    const b = fromGameLoadout(cls, name, l.items, sub, c);
    return [{ i, b, name, icon: look?.icons[l.iconHash], color: look?.colors[l.colorHash], match: builds.find((x) => x.cls === cls && sameLoadout(x, b, defs!)) }];
  });
}

const rowIco = (c: Ctx, b: Build, slot: BuildSlot) => {
  const x = itemOf(c, b.items[slot]?.id);
  return x ? `<span class="bd-gico${x.rarity === "Exotic" ? " exotic" : ""}" title="${esc(x.name)}">${img(x.icon)}</span>` : `<span class="bd-gico none"></span>`;
};

/** The in-game loadout icon over its colour swatch; falls back to the subclass icon. */
const loadGlyph = (l: { icon?: string; color?: string }, sub?: string | null) =>
  l.icon
    ? `<span class="bd-lglyph"${l.color ? ` style="background-image:url('${esc(bungieUrl(l.color))}')"` : ""}>${img(l.icon)}</span>`
    : `<span class="bd-bico">${img(sub)}</span>`;

/** A compact card first in the grid: a few slot chips, the count, and a button for the full list. */
function loadoutCard(list: ReturnType<typeof gameLoadouts>) {
  if (!list.length) return profileBusy ? `<div class="bd-bcard bd-loadcard">${loadingBlock("Reading in-game loadouts…")}</div>` : "";
  const chips = list
    .map((l) => {
      const sc = l.b.subclass ? defs!.subclasses[l.b.subclass] : null;
      return `<span class="bd-lchip" title="${esc(l.name)}" style="--el:var(--${sc?.el ?? "Unknown"})">${loadGlyph(l, sc?.i)}<b>${l.i + 1}</b>${l.match ? `<i class="bd-lmatch" title="Matches your EVR build “${esc(l.match.name)}”">✓</i>` : ""}</span>`;
    })
    .join("");
  return `<button class="bd-bcard bd-loadcard" data-act="loadlist" aria-label="Show all ${list.length} in-game loadouts">
    <span class="cap">In-game loadouts</span>
    <span class="bd-lchips">${chips}</span>
    <span class="bd-lfoot"><b>${list.length} loadouts</b><span class="btn bd-sm">View all</span></span></button>`;
}

/** The modal with every loadout in game order: click one to load it, Save keeps it as an EVR build. */
function openLoadoutList() {
  const c = ctx();
  const list = gameLoadouts(listCls!, c);
  let dlg = document.getElementById("bd-loadouts") as HTMLDialogElement | null;
  if (!dlg) {
    document.body.insertAdjacentHTML("beforeend", `<dialog class="bd-dialog bd-wide" id="bd-loadouts" aria-labelledby="bd-loadouts-h"></dialog>`);
    dlg = document.getElementById("bd-loadouts") as HTMLDialogElement;
    dlg.addEventListener("click", (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
      if (t?.dataset.act === "closedlg") return dlg!.close();
      if (!t || !ACTIONS[t.dataset.act!]) return;
      dlg!.close();
      ACTIONS[t.dataset.act!](t);
    });
  }
  dlg.innerHTML = `<h3 id="bd-loadouts-h">In-game loadouts · ${esc(CLASS_NAME(listCls!))}</h3>
    <div class="bd-lrows">${list
      .map((l) => {
        const { i, b, match } = l;
        const sc = b.subclass ? defs!.subclasses[b.subclass] : null;
        return `<div class="bd-lrow" style="--el:var(--${sc?.el ?? "Unknown"})">
          <button class="bd-lopen" data-act="loadgame" data-i="${i}" title="Load this loadout into the builder">
            ${loadGlyph(l, sc?.i)}<span class="bd-lname"><b>${esc(l.name)}</b><small>${i + 1}</small></span>
            ${l.icon ? `<span class="bd-bico bd-lsub">${img(sc?.i)}</span>` : ""}
            <span class="bd-bgear">${WEAPON_SLOTS.map((s) => rowIco(c, b, s)).join("")}<i></i>${ARMOR_SLOTS.map((s) => rowIco(c, b, s)).join("")}</span>
            ${match ? `<span class="bd-lmatch" title="Matches your EVR build “${esc(match.name)}”">✓</span>` : ""}</button>
          ${match ? `<span class="bd-lsaved" title="Matches your EVR build">Saved as <b>${esc(match.name)}</b></span>` : `<button class="btn bd-sm" data-act="savegame" data-i="${i}" title="Save as an EVR build">Save</button>`}
        </div>`;
      })
      .join("")}</div>
    <div class="bd-dialog-btns"><button class="btn ghost" data-act="closedlg">Close</button></div>`;
  if (!dlg.open) dlg.showModal();
}

/** A small modal asking for a name (Enter confirms, Esc or Cancel aborts). */
function askName(title: string, initial: string, done: (name: string) => void) {
  document.getElementById("bd-name-dlg")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<dialog class="bd-dialog" id="bd-name-dlg" aria-labelledby="bd-name-h"><form method="dialog">
    <h3 id="bd-name-h">${esc(title)}</h3>
    <input class="bd-input" name="n" maxlength="80" aria-label="Build name" value="${esc(initial)}" autocomplete="off" style="width:100%;margin-bottom:16px">
    <div class="bd-dialog-btns"><button class="btn primary" value="ok">Create</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div></form></dialog>`);
  const dlg = document.getElementById("bd-name-dlg") as HTMLDialogElement;
  const input = dlg.querySelector("input")!;
  dlg.addEventListener("close", () => {
    const name = input.value.trim();
    dlg.remove();
    if (dlg.returnValue === "ok" && name) done(name);
  });
  dlg.showModal();
  input.select();
}

/** The first card in the row: start a build for this class, or import one (with a preview to confirm). */
function newCard(cls: number) {
  return `<div class="bd-bcard bd-newcard">
    <button class="bd-newbtn" data-act="new" data-cls="${cls}"><span class="bd-bigplus" aria-hidden="true">+</span><b>New ${esc(CLASS_NAME(cls))} build</b></button>
    <button class="btn bd-sm" data-act="import">Import from DIM</button>
  </div>`;
}

function buildCard(b: Build, c: Ctx, hidden: boolean, game?: ReturnType<typeof gameLoadouts>[number]) {
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
  return `<article class="bd-bcard${b.id === cur?.id ? " on" : ""}${ask ? " asking" : ""}" style="--el:var(--${sc?.el ?? "Unknown"})"${hidden ? " hidden" : ""} data-id="${id}">
    <button class="bd-bopen" data-act="open" data-id="${id}" aria-current="${b.id === cur?.id}" aria-label="${esc(`Open ${b.name}`)}">
      <span class="bd-btop"><span class="bd-bico">${img(sc?.i)}</span>
        <span class="bd-bmeta"><b>${esc(b.name)}</b><span>${sc ? esc(sc.n) : "No subclass"}${b.tags.length ? " · " + b.tags.map(esc).join(", ") : ""}</span></span>
        ${game ? `<span class="bd-bgame" title="Matches in-game loadout ${game.i + 1} (${esc(game.name)})">${loadGlyph(game)}</span>` : ""}${s !== null ? `<span class="bd-bscore t${scoreTier(s)}" title="Build rating">${s}</span>` : ""}</span>
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
        <div class="eyebrow">${esc(CLASS_NAME(b.cls))}${sc ? ` · ${esc(sc.n)}` : ""}${(() => {
          const g = gameLoadouts(b.cls, c).find((l) => l.match?.id === b.id);
          return g ? ` <span class="bd-bgame" title="Matches in-game loadout ${g.i + 1} “${esc(g.name)}”">${loadGlyph(g)}<span class="bd-gname">In-game loadout ${g.i + 1}: ${esc(g.name)}</span></span>` : "";
        })()}</div>
        <input class="bd-name" id="bd-name" value="${esc(b.name)}" aria-label="Build name" maxlength="80">
        <div class="bd-hero-row">
          <div class="bd-tags">${b.tags.map((t, i) => `<span class="chip">${esc(t)}<button class="bd-x" data-act="untag" data-i="${i}" aria-label="Remove tag ${esc(t)}">✕</button></span>`).join("")}
            <input class="bd-input bd-taginput" id="bd-tag" placeholder="+ tag" maxlength="24" aria-label="Add a tag"></div>
        </div>
      </div>
      <div class="bd-savebar">
        <span class="small${unsaved() ? " dirty" : ""}" id="bd-saved" aria-live="polite">${unsaved() ? "Unsaved changes" : "Saved"}</span>
        <button class="btn ghost bd-sm" data-act="revert"${unsaved() ? "" : " disabled"}>Discard changes</button>
        <button class="btn primary" data-act="save"${unsaved() ? "" : " disabled"}>Save</button>
      </div>
    </header>
    <div class="bd-main">
      ${summary(b, c)}
      <div class="bd-col">
        ${subclassCard(b, sc, c)}
        ${abilitiesCard(b, sc, c)}
        ${weaponsCard(b, c)}
        ${armorCard(b, c)}
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
      <div class="bd-minor"><button class="linkbtn" data-act="dup">Duplicate</button><button class="linkbtn" data-act="del">Delete</button></div>
    </div>
  </aside>`;
}

/** Bar pieces for a stat line: armor, mods, Fonts, fragments (positive parts only), cut off at the total. */
function segments(l: { armor: number; mods: number; fonts: number; fragments: number; total: number }): [string, number][] {
  let left = Math.max(0, l.total);
  return ([["a", l.armor], ["m", l.mods], ["o", l.fonts], ["f", l.fragments]] as [string, number][]).map(([k, v]) => {
    const w = Math.min(left, Math.max(0, v));
    left -= w;
    return [k, w];
  });
}

function statsBlock(b: Build, c: Ctx) {
  const lines = statLines(b, c);
  const pct = (n: number) => `${(Math.max(0, n) / STAT_MAX) * 100}%`;
  const sum = lines.reduce((n, l) => n + l.total, 0);
  return `<section class="bd-sumsec"><div class="cap">Stats <span class="bd-capnote">${sum} total · 100 is full benefit, up to 200 enhanced</span></div>
    <div class="bd-slines">${lines
      .map((l) => {
        const met = l.target > 0 && l.total >= l.target;
        const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`;
        const parts = [`Armor ${l.armor}`, l.mods ? `mods ${sign(l.mods)}` : "", l.fonts ? `Font ${sign(l.fonts)} (with Armor Charge)` : "", l.fragments ? `fragments ${sign(l.fragments)}` : ""].filter(Boolean).join(" · ");
        return `<div class="bd-sline" title="${esc(parts)}">
          <span class="bd-sname">${esc(l.name)}</span>
          <span class="bd-sbarwrap"><span class="bd-sbar">${segments(l).map(([k, v]) => `<i class="${k}" style="width:${pct(v)}"></i>`).join("")}
            <s style="left:50%"></s></span>
            <input class="bd-aim${l.target ? " set" : ""}" type="range" min="0" max="${STAT_MAX}" step="10" value="${l.target}" data-target="${l.hash}" aria-label="${esc(l.name)} aim" aria-valuetext="${l.target ? `Aim ${l.target}` : "No aim"}" title="Drag to set an aim for ${esc(l.name)}; drag to 0 to clear"></span>
          <b class="num bd-stot${met ? " met" : l.target ? " short" : ""}${l.total < 0 ? " neg" : ""}">${l.total}</b>
          <span class="bd-aimv num">${l.target ? `/ ${l.target}` : ""}</span>
        </div>`;
      })
      .join("")}</div>
    <div class="bd-legend small muted"><span><i class="a"></i>Armor</span><span><i class="m"></i>Mods</span><span><i class="o"></i>Fonts</span><span><i class="f"></i>Fragments</span><span><u></u>Your aim: drag on a bar</span></div></section>`;
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

/** Subclass choice and Aegis's view of it. The slots themselves are in the Abilities card below. */
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
  return `<section class="bd-card glass bd-subclass" style="--el:var(--${sc.el})">
    <div class="bd-card-head"><h3>Subclass</h3>${r ? `<span class="small muted">Aegis ${tierChip(r.tier)} ${r.total !== null ? `${r.total}/40` : ""}</span>` : ""}</div>
    ${picker}
    ${r ? `<div class="bd-roles">${ROLES.map(([k, label, why]) => `<div tabindex="0" data-tip="" data-tiptext="${esc(why)}" aria-label="${esc(`${label} ${r.scores[k] ?? "unrated"} of 10. ${why}`)}"><span>${label}</span><b class="num">${r.scores[k] ?? "—"}</b><i style="width:${(r.scores[k] ?? 0) * 10}%"></i></div>`).join("")}</div>
      ${r.usage ? `<p class="small muted bd-usage">“${esc(r.usage)}”</p>` : ""}` : ""}
  </section>`;
}

/** The subclass's slots, laid out like the game: super and aspects, then grenade, melee and class ability, then the small slots, then fragments. */
function abilitiesCard(b: Build, sc: SubclassDef | null, c: Ctx) {
  if (!sc) return "";
  const slots = fragmentSlots(b, defs!);
  const group = (g: SocketGroup) => socketsOf(sc, g);
  const chip = (i: number, kind: ChipKind) => socketChip(b, sc, i, c, slots, kind);
  const frags = group("fragments");
  const fragsIn = frags.filter((i, k) => k < slots && !isEmptyPlug(defs!.plugs[b.plugs[i]])).length;
  const extras = group("other");
  return `<section class="bd-card glass bd-abilities" style="--el:var(--${sc.el})">
    <div class="bd-card-head"><h3>Abilities</h3>
      <span class="bd-popmode"><span class="small muted">${popMode === "hover" ? "Rest the pointer on a slot, or tap it, to change it" : "Click or tap a slot to change it"}</span>
        <span class="seg" role="group" aria-label="Open slot pickers on">${(["hover", "click"] as const).map((m) => `<button data-act="popmode" data-m="${m}" aria-pressed="${popMode === m}">${m === "hover" ? "Hover" : "Click"}</button>`).join("")}</span></span></div>
    <div class="bd-sclayout">
      <div class="bd-sc-left">
        ${group("super").map((i) => chip(i, "super")).join("")}
        <div class="bd-sc-aspects"><div class="cap">Aspects <span class="bd-capnote">open ${slots} fragment slot${slots === 1 ? "" : "s"}</span></div>${group("aspects").map((i) => chip(i, "wide")).join("")}</div>
        <div class="bd-fragsec">
          <div class="cap">Fragments <span class="bd-capnote">${fragsIn} of ${slots} slots used</span></div>
          <div class="bd-frags">${frags.map((i) => chip(i, "pill")).join("")}</div>
          ${slots ? `<div class="bd-fragbtn"><button class="btn bd-sm" data-pop="${frags[0]}" aria-haspopup="dialog">Modify fragments</button></div>` : ""}
        </div>
      </div>
      <div class="bd-sc-right">
        <div class="bd-sc-stack">${[...group("grenade"), ...group("melee"), ...group("class")].map((i) => chip(i, "wide")).join("")}</div>
        <div class="bd-sc-small">
          ${group("movement").map((i) => `<div class="bd-sc-sq">${chip(i, "square")}</div>`).join("")}
          ${extras.length ? `<div class="bd-sc-sq bd-sc-extras"><div class="bd-sc-sqrow">${extras.map((i) => chip(i, "square")).join("")}</div><span class="bd-sc-extra">${esc(sc.el)} extras</span></div>` : ""}
        </div>
      </div>
    </div>
  </section>`;
}

type ChipKind = "super" | "wide" | "square" | "pill";

/** The first sentence or line of a plug's description, for the space beside its icon. */
const blurb = (p?: PlugDef) => (p?.d ?? "").split(/\n/)[0].replace(/\[[^\]]+\]\s*/g, "").replace(/^[\s:;,.-]+/, "").trim();

function socketChip(b: Build, sc: SubclassDef, i: number, c: Ctx, slots: number, kind: ChipKind = "wide") {
  const s = sc.sockets[i];
  const p = defs!.plugs[b.plugs[i] ?? s.init];
  const locked = s.plugs.length < 2;
  const off = s.group === "fragments" && socketsOf(sc, "fragments").indexOf(i) >= slots;
  const empty = isEmptyPlug(p);
  const rated = s.group === "aspects" ? aspectRating(c.ratings, p) : s.group === "fragments" ? fragmentRating(c.ratings, p) : null;
  const label = s.group === "other" ? p?.t ?? GROUP_LABEL.other : GROUP_LABEL[s.group];
  const name = empty ? (off ? "Locked" : kind === "pill" ? "Empty slot" : "Empty") : p?.n ?? "";
  const icon = empty ? `<span class="bd-plus">${off ? LOCK : "+"}</span>` : img(p?.i);
  const desc = !empty && kind !== "square" ? blurb(p) : "";
  const stats = (p?.st ?? []).map(([h, v]) => statChip(h, v)).join("");
  const inner =
    kind === "square"
      ? `<span class="bd-sico">${icon}</span><span class="bd-sqlabel">${esc(label)}</span><span class="bd-sqname">${esc(name)}</span>`
      : kind === "super"
        ? `<span class="cap">Super</span><span class="bd-sico">${icon}</span><b>${esc(name)}</b>${desc ? `<span class="bd-cdesc">${esc(desc)}</span>` : ""}`
        : `<span class="bd-sico">${icon}${rated ? tierChip(rated.tier) : ""}</span>
    <span class="bd-cmeta">${kind === "pill" ? "" : `<span class="cap">${esc(label)}</span>`}<b>${esc(name)}</b>${stats}${desc ? `<span class="bd-cdesc">${esc(desc)}</span>` : ""}</span>`;
  const cls = `bd-chip bd-k-${kind}${empty ? " is-empty" : ""}`;
  if (locked || off)
    return `<span class="${cls} ${off ? "off" : "fixed"}" ${off ? `title="Pick aspects with more fragment slots to use this one"` : `data-tip="" data-tiptext="${esc(`${label}: ${p?.n ?? ""}. Fixed for this subclass.`)}" tabindex="0"`}>${inner}</span>`;
  return `<button class="${cls}${pop?.i === i ? " open" : ""}" data-pop="${i}" aria-haspopup="dialog" aria-expanded="${pop?.i === i}" aria-label="${esc(`${label}: ${empty ? "empty" : p?.n}. Change`)}">${inner}</button>`;
}

const LOCK = `<svg class="bd-lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1zm2 0h6V7a3 3 0 0 0-6 0v3z"/></svg>`;

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
      <div class="bd-tiproles">${ROLES.map(([k, label]) => `<span>${label} <b class="num">${r.scores[k] ?? "—"}</b></span>`).join("")}</div>
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
  const plug = t.dataset.tipplug ? defs!.plugs[Number(t.dataset.tipplug)] : undefined;
  const html = plug ? plugDetail(plug, "other", null, true) : t.dataset.tiptext ? `<p>${esc(t.dataset.tiptext)}</p>` : subclassTip(Number(t.dataset.tip));
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
/** How slot popovers open: on hover (after a short rest, so sweeping the mouse across slots opens nothing) or only on click. Remembered in this browser. */
let popMode: "hover" | "click" = (() => {
  try {
    return localStorage.getItem("vr-bd-popmode") === "click" ? "click" : "hover";
  } catch {
    return "hover";
  }
})();
/** Hover intent: the pointer has to rest this long on a slot before its popover opens (or replaces an open one). */
const HOVER_OPEN_MS = 350;
const HOVER_SWITCH_MS = 300;
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

function weaponsCard(b: Build, c: Ctx) {
  return `<section class="bd-card glass bd-weapons">
    <div class="bd-card-head"><h3>Weapons</h3><button class="btn primary bd-sm" data-act="gear">Choose gear and mods</button></div>
    <div class="bd-wlist">${WEAPON_SLOTS.map((slot) => weaponRow(b, c, slot)).join("")}</div>
  </section>`;
}

function armorCard(b: Build, c: Ctx) {
  return `<section class="bd-card glass bd-armorcard">
    <div class="bd-card-head"><h3>Armor and mods</h3><span class="small muted">${ARMOR_ENERGY} mod energy each · point at a mod to see what it does</span><button class="btn primary bd-sm" data-act="gear" data-slot="Helmet">Choose armor and mods</button></div>
    <div class="bd-alist">${ARMOR_SLOTS.map((slot) => armorRow(b, c, slot)).join("")}</div>
  </section>`;
}

const PERK_KIND: Record<string, string> = { barrel: "Barrel", magazine: "Magazine", perk1: "Trait 1", perk2: "Trait 2", origin: "Origin trait", other: "Perk" };

function weaponRow(b: Build, c: Ctx, slot: (typeof WEAPON_SLOTS)[number]) {
  const w = weaponOf(c, b.items[slot]?.id);
  const sc = w ? c.scores.get(w.instanceId) : undefined;
  // Equipped perks in the game's column order: barrel, magazine, trait 1, trait 2, origin. Traits named, the rest icons (names on hover).
  const cols = (w?.columns ?? []).filter((k) => k.active && k.kind !== "other");
  const perk = (k: (typeof cols)[number]) => {
    const named = k.kind === "perk1" || k.kind === "perk2";
    return `<span class="bd-perk${named ? " named" : ""}" tabindex="0" data-tip="" data-tiptext="${esc(`${PERK_KIND[k.kind] ?? "Perk"}: ${k.active}${k.enhanced.includes(k.active) ? " (enhanced)" : ""}`)}">${k.icons?.[k.active] ? img(k.icons[k.active], k.active) : `<span class="ph"></span>`}${named ? `<span>${esc(k.active)}</span>` : ""}</span>`;
  };
  const facts = w ? [w.frame, w.ammo !== "Unknown" ? `${w.ammo} ammo` : "", w.masterwork ? `MW ${w.masterwork}` : "", w.crafted ? "Crafted" : "", w.adept ? "Adept" : "", w.gearTier ? `Tier ${w.gearTier}` : "", w.power ? `Power ${w.power}` : ""].filter(Boolean) : [];
  return `<div class="bd-row bd-wrow${w?.rarity === "Exotic" ? " exotic" : ""}">
    <button class="bd-rowbtn" data-act="gear" data-slot="${slot}" aria-label="${esc(`${slot}: ${w ? w.name : "empty"}. Change`)}">
      <span class="bd-iico">${w ? img(w.icon) : `<span class="bd-plus">+</span>`}${tierChip(weaponTier(w?.instanceId))}</span>
      <span class="bd-imeta"><span class="cap">${slot}</span><b>${w ? esc(w.name) : b.items[slot] ? "Missing item" : "Choose a weapon"}</b>${w ? `<span class="sm">${esc(w.type)} · <span class="el" style="color:var(--${esc(w.element)})"><i></i><span>${esc(w.element)}</span></span></span>` : ""}</span>
      ${sc !== undefined ? `<span class="bd-iscore" title="Vault score">${sc}</span>` : ""}</button>
    ${cols.length ? `<div class="bd-wperks">${cols.map(perk).join("")}</div>` : ""}
    ${w ? `<div class="bd-wfacts">${facts.map((f) => `<span>${esc(f)}</span>`).join("")}<span class="bd-links">${weaponLinks(w)}</span></div>` : ""}
  </div>`;
}

function armorRow(b: Build, c: Ctx, slot: GearSlot) {
  const a = armorOf(c, b.items[slot]?.id);
  const mods = b.mods[slot] ?? Array(MOD_SOCKETS).fill(0);
  const used = modEnergy(mods, defs!);
  const sc = a ? c.scores.get(a.instanceId) : undefined;
  const meta = a ? [a.archetype ?? "Legacy", a.gearTier ? `Tier ${a.gearTier}` : "", a.setName ?? (a.rarity === "Exotic" ? "Exotic" : ""), `${a.statTotal} total`].filter(Boolean).join(" · ") : "";
  return `<div class="bd-row bd-arow${a?.rarity === "Exotic" ? " exotic" : ""}">
    <button class="bd-rowbtn" data-act="gear" data-slot="${slot}" aria-label="${esc(`${slot}: ${a ? a.name : "empty"}. Change`)}">
      <span class="bd-iico">${a ? img(a.icon) : `<span class="bd-plus">+</span>`}${a?.gearTier ? `<span class="tier tU">T${a.gearTier}</span>` : ""}</span>
      <span class="bd-imeta"><span class="cap">${slot}${sc !== undefined ? ` · <span class="bd-ascore" title="Vault score">${sc}</span>` : ""}</span><b>${a ? esc(a.name) : b.items[slot] ? "Missing item" : `Choose ${slot === "Arms" ? "arms" : slot.toLowerCase()}`}</b>${a ? `<span class="sm">${esc(meta)}</span>` : ""}</span></button>
    <span class="bd-astats">${a ? STAT_HASHES.map((h) => {
      const v = a.stats[c.statNames[h]] ?? 0;
      return `<span class="${v >= 25 ? "hi" : v <= 0 ? "lo" : ""}" title="${esc(c.statNames[h])}"><i>${esc((c.statNames[h] ?? "").slice(0, 3))}</i>${v}</span>`;
    }).join("") : ""}</span>
    ${mods
      .map((h, k) => {
        const p = h ? defs!.plugs[h] : undefined;
        const kind = k === 0 ? "General" : slot;
        return p
          ? `<button class="bd-amod" data-act="gear" data-gt="mods" data-slot="${slot}" data-tip="" data-tipplug="${p.h}" aria-label="${esc(`${kind} mod: ${p.n}, ${p.cost ?? 0} energy. Change`)}">${img(p.i)}<span><b>${esc(p.n)}</b><i>${esc(kind)} · ${p.cost ?? 0}</i></span></button>`
          : `<button class="bd-amod is-none" data-act="gear" data-gt="mods" data-slot="${slot}" aria-label="${esc(`Add a ${kind.toLowerCase()} mod`)}"><span class="bd-plus">+</span><span><b>Add mod</b><i>${esc(kind)}</i></span></button>`;
      })
      .join("")}
    <span class="bd-aenergy${used > ARMOR_ENERGY ? " over" : ""}" title="Mod energy used"><b class="num">${used}/${ARMOR_ENERGY}</b><span><i style="width:${Math.min(100, (used / ARMOR_ENERGY) * 100)}%"></i></span></span>
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
        <div class="bd-tabs" role="tablist" aria-label="What to pick">${(["weapons", "armor", "mods"] as GearTab[]).map((t) => `<button class="bd-tab" role="tab" data-dact="gtab" data-gt="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>
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
  for (const t of document.querySelectorAll<HTMLElement>("#bd-drawer [data-dact=gtab]")) t.setAttribute("aria-selected", String(t.dataset.gt === gear.tab));
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
        : `<button class="bd-mod is-empty" data-dact="gtarget" data-slot="${s}" aria-label="Add a mod to ${s}"><span class="bd-plus">${k === 0 ? "G" : "+"}</span></button>`;
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
    gear.tab = t.dataset.gt as GearTab;
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
    hideTip();
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
    if (popMode !== "hover") return;
    popTimer = window.setTimeout(() => openPop(Number(p.dataset.pop), false), pop ? HOVER_SWITCH_MS : HOVER_OPEN_MS);
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
    if (p && popMode === "hover" && p.matches(":focus-visible") && pop?.i !== Number(p.dataset.pop)) openPop(Number(p.dataset.pop), false);
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
    if (t.classList.contains("bd-aim")) {
      t.classList.toggle("set", Number(t.value) > 0);
      const v = t.closest(".bd-sline")?.querySelector(".bd-aimv");
      if (v) v.textContent = Number(t.value) > 0 ? `/ ${t.value}` : "";
      return;
    }
    if (t.id === "bd-q") {
      listQuery = t.value;
      for (const card of panel!.querySelectorAll<HTMLElement>(".bd-bcard")) {
        const b = builds.find((x) => x.id === card.dataset.id);
        card.hidden = !!b && !!listQuery && !listText(b).includes(listQuery.toLowerCase());
      }
    } else if (cur && t.id === "bd-name") {
      cur.name = t.value || "Untitled build";
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
  popmode: (t) => {
    popMode = t.dataset.m === "click" ? "click" : "hover";
    try {
      localStorage.setItem("vr-bd-popmode", popMode);
    } catch {}
    closePop();
    draw();
  },
  save: () => saveCur(),
  revert: () => revertCur(),
  loadlist: () => openLoadoutList(),
  new: (t) => guard(() => {
    const cls = t.dataset.cls ? Number(t.dataset.cls) : (listCls ?? classChoices()[0] ?? 0);
    askName(`Name your new ${CLASS_NAME(cls)} build`, `${CLASS_NAME(cls)} build ${builds.filter((b) => b.cls === cls).length + 1}`, (name) => createBuild(cls, name));
  }),
  open: (t) => {
    if (t.dataset.id === cur?.id) return;
    guard(() => {
      closePop();
      const b = builds.find((x) => x.id === t.dataset.id);
      if (b) cur = structuredClone(b);
      draw();
      panel?.querySelector(".bd-editor")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    });
  },
  loadgame: (t) => {
    const l = gameLoadouts(listCls!, ctx()).find((x) => x.i === Number(t.dataset.i));
    if (!l) return;
    guard(() => {
      closePop();
      // Matching EVR build: open that one; otherwise a new, unsaved draft ("Save" in the title card keeps it).
      cur = structuredClone(l.match ?? l.b);
      draw();
    });
  },
  savegame: (t) => {
    const l = gameLoadouts(listCls!, ctx()).find((x) => x.i === Number(t.dataset.i));
    if (!l) return;
    guard(() =>
      askName("Name this EVR build", l.name, (name) => {
        builds = commitBuild(builds, { ...l.b, name });
        saveBuilds(builds);
        cur = structuredClone(builds.find((x) => x.id === l.b.id)!);
        draw();
      }),
    );
  },
  untag: (t) => {
    if (!cur) return;
    cur.tags.splice(Number(t.dataset.i), 1);
    touch();
  },
  // A copy of what's on screen, as a new unsaved draft.
  dup: () =>
    guard(() => {
      if (!cur) return;
      cur = { ...structuredClone(cur), id: newId(), name: cur.name + " (copy)", dimId: undefined, created: new Date().toISOString() };
      touch();
    }),
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
    if (cur?.id === gone.id) {
      const next = builds.find((b) => b.cls === listCls);
      cur = next ? structuredClone(next) : null;
    }
    draw();
  },
  lcls: (t) => {
    const k = Number(t.dataset.cls);
    if (k === listCls) return;
    guard(() => {
      closePop();
      listCls = k;
      listQuery = "";
      delAsk = null;
      const b = builds.find((x) => x.cls === k);
      cur = b ? structuredClone(b) : null;
      draw();
    });
  },
  subclass: (t) => {
    hideTip();
    const sc = defs!.subclasses[Number(t.dataset.h)];
    if (!cur || !sc || sc.h === cur.subclass) return;
    closePop();
    setSubclass(sc);
    touch();
  },
  gear: (t) => openGear(t.dataset.gt === "mods" ? "mods" : t.dataset.slot && isArmorSlot(t.dataset.slot) ? "armor" : "weapons", t.dataset.slot ?? "all"),
  equip: () => void equipFlow(),
  dim: () => dimFlow(),
  import: () => importFlow(),
};

function createBuild(cls: number, name: string) {
  cur = newBuild(cls, name);
  listCls = cls;
  const sc = Object.values(defs!.subclasses).find((s) => s.cls === cls && s.el === "Prismatic");
  if (sc && (!charFor(profile, cls) || subclassInstance(profile, cls, sc.h))) setSubclass(sc);
  touch();
}

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
    const saved = !undoing && builds.find((x) => x.id === target.id);
    if (saved) {
      saved.applied = new Date().toISOString();
      saveBuilds(builds);
      if (cur?.id === saved.id) cur.applied = saved.applied;
    }
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
    previewImport(captureCharacter(c.id, profile!, ctx(), `${CLASS_NAME(c.cls)} current gear`), `What your ${CLASS_NAME(c.cls)} is wearing now`);
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
    previewImport(fromDimLoadout(l, ctx()), `DIM loadout “${l.name}”`);
  };
}

/** Shows what an import would add, and adds it (saved) only when confirmed. */
function previewImport(b: Build, from: string) {
  const c = ctx();
  const sc = b.subclass ? defs!.subclasses[b.subclass] : null;
  const plugNames = (g: SocketGroup) => (sc ? socketsOf(sc, g).map((i) => defs!.plugs[b.plugs[i]]).filter((p): p is PlugDef => !isEmptyPlug(p)).map((p) => p.n) : []);
  const row = (label: string, value: string) => `<div class="bd-pvrow"><span class="cap">${esc(label)}</span><span>${value || '<span class="muted">None</span>'}</span></div>`;
  const item = (slot: BuildSlot) => {
    const x = itemOf(c, b.items[slot]?.id);
    return `<div class="bd-pvitem${x?.rarity === "Exotic" ? " exotic" : ""}">${x ? img(x.icon) : `<span class="ph"></span>`}<span><span class="cap">${slot}</span><b>${x ? esc(x.name) : "Not set"}</b></span></div>`;
  };
  const mods = ARMOR_SLOTS.reduce((n, s) => n + (b.mods[s] ?? []).filter(Boolean).length, 0);
  const stats = statLines(b, c);
  const score = buildScore(b, c).total;
  openDrawer(`<div class="bd-pick bd-preview">
    <div><div class="eyebrow">Import preview · ${esc(from)}</div><h2>${esc(b.name)}</h2>
      <p class="small muted">${esc(CLASS_NAME(b.cls))}${sc ? ` · ${esc(sc.n)}` : ""}${score !== null ? ` · rated ${score}` : ""}. Nothing is added until you confirm.</p></div>
    <div class="bd-pvsec">
      ${row("Super", plugNames("super").map(esc).join(""))}
      ${row("Abilities", [...plugNames("grenade"), ...plugNames("melee"), ...plugNames("class"), ...plugNames("movement")].map(esc).join(" · "))}
      ${row("Aspects", plugNames("aspects").map(esc).join(" · "))}
      ${row("Fragments", plugNames("fragments").map(esc).join(" · "))}
    </div>
    <div class="cap">Gear</div>
    <div class="bd-pvgear">${[...WEAPON_SLOTS, ...ARMOR_SLOTS].map(item).join("")}</div>
    <p class="small muted">${mods} armor mod${mods === 1 ? "" : "s"}</p>
    <div class="cap">Stats</div>
    <div class="bd-pvstats">${stats.map((l) => `<span><i>${esc(l.name)}</i><b class="num">${l.total}</b></span>`).join("")}</div>
    <div class="bd-pfoot"><button class="btn primary" data-dact="importyes">Import this build</button><button class="btn ghost" data-dact="importback">Back</button></div>
  </div>`);
  DRAWER_ACTIONS.importback = () => importFlow();
  DRAWER_ACTIONS.importyes = () => {
    closeDrawer();
    guard(() => {
      builds = commitBuild(builds, b);
      saveBuilds(builds);
      cur = structuredClone(builds.find((x) => x.id === b.id)!);
      listCls = cur.cls;
      draw();
    });
  };
}

declare global {
  interface Window {
    VR_BUILDS?: { render: (el: HTMLElement) => void; count: () => number | null; leave?: (next: () => void) => boolean };
  }
}
