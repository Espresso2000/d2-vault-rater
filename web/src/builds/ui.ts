/**
 * The Builds tab: a list of saved builds and an editor for one, with pickers for every socket,
 * live stats and rating, an equip dry run, and DIM export. Rendered into the report's #p-builds panel.
 */
import "./builds.css";
import type { Vault } from "../../../src/vault/types.js";
import { STAT_HASHES, type BuildDefs, type PlugDef, type SocketGroup, type SubclassDef } from "./defs.strip";
import { loadBuildDefs } from "./defs";
import { cachedRatings, loadRatings } from "./ratings";
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

export interface BuildsInput {
  vault: Vault;
  /** The report's site data: the rater's scores per item. */
  data: { weapons: { id: string; sc: number; tier: string | null }[]; armor: { id: string; sc: number }[] };
  manifest: { stats: Record<string, { displayProperties: { name: string } }> };
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const url = (p?: string | null) => (!p ? "" : p.startsWith("http") ? p : "https://www.bungie.net" + p);
const img = (p?: string | null, alt = "") => (p ? `<img src="${esc(url(p))}" alt="${esc(alt)}" loading="lazy">` : `<span class="ph"></span>`);
const tierChip = (t?: string | null, title = "") => (t ? `<span class="tier t${esc(t)}"${title ? ` title="${esc(title)}"` : ""}>${esc(t)}</span>` : "");
const scoreTier = (n: number) => (n >= 90 ? "S" : n >= 80 ? "A" : n >= 65 ? "B" : n >= 50 ? "C" : "D");
const GROUP_LABEL: Record<SocketGroup, string> = { super: "Super", class: "Class ability", movement: "Jump", melee: "Melee", grenade: "Grenade", aspects: "Aspect", fragments: "Fragment", other: "Passive" };
const EL_ORDER = ["Prismatic", "Arc", "Solar", "Void", "Stasis", "Strand"];

let input: BuildsInput | null = null;
let panel: HTMLElement | null = null;
let defs: BuildDefs | null = null;
let profile: BuildProfile | null = null;
let builds: Build[] = [];
let cur: Build | null = null;
let loadError = "";
let loading: Promise<void> | null = null;
const log: string[] = [];
/** The character's gear before the last equip, to put it back. */
let undo: { build: Build; charId: string } | null = null;

const ctx = (): Ctx => {
  const scores = new Map<string, number>();
  for (const w of input!.data.weapons) scores.set(w.id, w.sc);
  for (const a of input!.data.armor) scores.set(a.id, a.sc);
  const statNames: Record<number, string> = {};
  for (const h of STAT_HASHES) statNames[h] = input!.manifest.stats[h]?.displayProperties?.name ?? String(h);
  return { defs: defs!, ratings: cachedRatings(), vault: input!.vault, scores, statNames, sockets: profile?.sockets };
};
const weaponTier = (id?: string) => input!.data.weapons.find((w) => w.id === id)?.tier ?? null;

/* ---------- Entry points (called by the report page) ---------- */

export function initBuilds(i: BuildsInput) {
  input = i;
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
    cur = builds[0] ?? null;
    draw();
    void refreshProfile();
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
  const c = ctx();
  const y = scrollY;
  panel.innerHTML = `<div class="bd">
    <div class="sec-head"><h2>Builds</h2><span class="badge">${builds.length} saved</span>
      <p>Put together a subclass, gear and mods, see how Aegis rates it, then equip it in one go or send it to DIM. Builds are saved in this browser.</p></div>
    <div class="bd-layout">${listPane()}${cur ? editor(cur, c) : emptyEditor()}</div></div>`;
  scrollTo({ top: y });
}

let listQuery = "";
const listText = (b: Build) => `${b.name} ${b.tags.join(" ")} ${CLASS_NAME(b.cls)}`.toLowerCase();
function listPane() {
  const q = listQuery.toLowerCase();
  return `<aside class="bd-list glass">
    <div class="bd-list-head"><span class="cap">Saved builds</span>
      <div class="bd-list-actions"><button class="btn primary bd-sm" data-act="new">+ New</button><button class="btn bd-sm" data-act="import">Import</button></div></div>
    ${builds.length > 4 ? `<input class="bd-input" id="bd-q" type="search" placeholder="Search builds" value="${esc(listQuery)}" aria-label="Search builds">` : ""}
    <div class="bd-cards">${
      builds
        .map((b) => {
          const sc = b.subclass ? defs!.subclasses[b.subclass] : null;
          const s = buildScore(b, ctx()).total;
          return `<button class="bd-bcard${b === cur ? " on" : ""}" data-act="open" data-id="${esc(b.id)}" style="--el:var(--${sc?.el ?? "Unknown"})"${q && !listText(b).includes(q) ? " hidden" : ""}>
          <span class="bd-bico">${img(sc?.i)}</span>
          <span class="bd-bmeta"><b>${esc(b.name)}</b><span>${esc(CLASS_NAME(b.cls))}${sc ? " · " + esc(sc.el) : ""}${b.tags.length ? " · " + b.tags.map(esc).join(", ") : ""}</span></span>
          ${s !== null ? `<span class="bd-bscore t${scoreTier(s)}">${s}</span>` : ""}</button>`;
        })
        .join("") || `<p class="small muted bd-pad">No builds yet. Start one, or import your current gear or a DIM loadout.</p>`
    }</div></aside>`;
}

function emptyEditor() {
  return `<section class="bd-editor"><div class="bd-empty glass">
    <div class="eyebrow">Start a build</div><h2>What are you <span class="grad-text">playing</span>?</h2>
    <p class="muted">Pick a class to start from scratch, or bring in what a character is wearing right now.</p>
    <div class="bd-pills">${classChoices().map((c) => `<button class="bd-pill" data-act="new" data-cls="${c}">${CLASS_NAME(c)}</button>`).join("")}</div>
    <div class="bd-pills"><button class="btn" data-act="import">Import from a character or DIM</button></div></div></section>`;
}

const classChoices = () => {
  const have = [...new Set(input!.vault.characters.map((c) => CLASSES.indexOf(c.className as (typeof CLASSES)[number])).filter((x) => x >= 0))];
  return have.length ? have.sort() : [0, 1, 2];
};

function editor(b: Build, c: Ctx) {
  const sc = b.subclass ? defs!.subclasses[b.subclass] : null;
  const score = buildScore(b, c);
  const char = charFor(profile, b.cls);
  return `<section class="bd-editor">
    <header class="bd-hero" style="--el:var(--${sc?.el ?? "Unknown"})">
      <div class="bd-hero-main">
        <div class="bd-hero-ico">${img(sc?.i)}</div>
        <div class="bd-hero-text">
          <div class="eyebrow">${esc(CLASS_NAME(b.cls))}${sc ? ` · ${esc(sc.n)}` : ""}</div>
          <input class="bd-name" id="bd-name" value="${esc(b.name)}" aria-label="Build name" maxlength="80">
          <div class="bd-pills">${classChoices().map((k) => `<button class="bd-pill${k === b.cls ? " on" : ""}" data-act="cls" data-cls="${k}" aria-pressed="${k === b.cls}">${CLASS_NAME(k)}</button>`).join("")}</div>
          <div class="bd-tags">${b.tags.map((t, i) => `<span class="chip">${esc(t)}<button class="bd-x" data-act="untag" data-i="${i}" aria-label="Remove tag ${esc(t)}">✕</button></span>`).join("")}
            <input class="bd-input bd-taginput" id="bd-tag" placeholder="+ tag" maxlength="24" aria-label="Add a tag"></div>
        </div>
      </div>
      <div class="bd-score">${ring(score.total)}<div class="bd-parts">${score.parts
        .map((p) => `<div class="bd-part" title="${esc(p.note)}"><span>${p.label}</span><span class="bd-pbar"><i style="width:${p.points ?? 0}%"></i></span><b class="num">${p.points === null ? "—" : Math.round(p.points)}</b></div>`)
        .join("")}</div></div>
    </header>
    <div class="bd-grid">
      ${subclassCard(b, sc, c)}
      ${weaponsCard(b, c)}
      ${armorCard(b, c)}
      ${statsCard(b, c)}
      <div class="bd-card glass bd-notes"><div class="bd-card-head"><h3>Notes</h3></div>
        <textarea id="bd-notes" rows="4" placeholder="How to play it, what it's for, which artifact perks it wants…">${esc(b.notes)}</textarea></div>
    </div>
    <div class="bd-actions glass">
      <span class="small muted" id="bd-saved" aria-live="polite">Saved</span>
      <div class="bd-actbtns">
        <button class="btn ghost bd-sm" data-act="dup">Duplicate</button>
        <button class="btn ghost bd-sm" data-act="del">Delete</button>
        <button class="btn" data-act="dim"><span class="bd-long">Export to </span>DIM</button>
        <button class="btn primary" data-act="equip"${char || !profile ? "" : " disabled"}>Equip<span class="bd-long">${char ? ` on ${CLASS_NAME(b.cls)}` : ""}</span>…</button>
      </div>
    </div>
  </section>`;
}

function ring(total: number | null) {
  const v = total ?? 0;
  return `<div class="bd-ring" style="--v:${v}" title="Build rating out of 100"><div><b class="num">${total ?? "—"}</b><span>${total === null ? "Unrated" : `${scoreTier(v)} tier`}</span></div></div>`;
}

/* ---------- Subclass ---------- */

function subclassCard(b: Build, sc: SubclassDef | null, c: Ctx) {
  const all = Object.values(defs!.subclasses)
    .filter((s) => s.cls === b.cls)
    .sort((x, y) => EL_ORDER.indexOf(x.el) - EL_ORDER.indexOf(y.el));
  const char = charFor(profile, b.cls);
  const owned = (s: SubclassDef) => !char || char.subclasses.some((x) => x.hash === s.h);
  const picker = `<div class="bd-subs">${all
    .map((s) => {
      const r = subclassRating(c.ratings, s);
      return `<button class="bd-sub${s.h === b.subclass ? " on" : ""}" data-act="subclass" data-h="${s.h}" style="--el:var(--${s.el})" ${owned(s) ? "" : "disabled title='Not unlocked on this character'"}>
        ${img(s.i)}<span>${esc(s.el)}</span>${tierChip(r?.tier, r ? `Aegis ${r.tier} tier subclass` : "")}</button>`;
    })
    .join("")}</div>`;
  if (!sc) return `<div class="bd-card glass bd-subclass"><div class="bd-card-head"><h3>Subclass</h3></div>${picker}<p class="small muted">Pick a subclass to choose its super, abilities, aspects and fragments.</p></div>`;
  const r = subclassRating(c.ratings, sc);
  const slots = fragmentSlots(b, defs!);
  const tile = (i: number) => socketTile(b, sc, i, c, slots);
  const group = (g: SocketGroup) => socketsOf(sc, g);
  const abilities = (["super", "class", "movement", "melee", "grenade", "other"] as SocketGroup[]).flatMap(group);
  return `<div class="bd-card glass bd-subclass" style="--el:var(--${sc.el})">
    <div class="bd-card-head"><h3>Subclass</h3>${r ? `<span class="small muted">Aegis: ${tierChip(r.tier)} ${r.total !== null ? `${r.total}/40` : ""}</span>` : ""}</div>
    ${picker}
    ${r ? `<div class="bd-roles">${(["super", "enhancement", "offense", "defense"] as const).map((k) => `<div><span>${k}</span><b class="num">${r.scores[k] ?? "—"}</b><i style="width:${(r.scores[k] ?? 0) * 10}%"></i></div>`).join("")}</div>
      ${r.usage ? `<p class="small muted bd-usage">“${esc(r.usage)}”</p>` : ""}` : ""}
    <div class="cap">Abilities</div><div class="bd-sockets">${abilities.map(tile).join("")}</div>
    <div class="cap">Aspects <span class="bd-capnote">open ${slots} fragment slot${slots === 1 ? "" : "s"}</span></div><div class="bd-sockets">${group("aspects").map(tile).join("")}</div>
    <div class="cap">Fragments <span class="bd-capnote">${group("fragments").filter((i, k) => k < slots && !isEmptyPlug(defs!.plugs[b.plugs[i]])).length} of ${slots}</span></div>
    <div class="bd-sockets bd-frags">${group("fragments").map(tile).join("")}</div>
  </div>`;
}

function socketTile(b: Build, sc: SubclassDef, i: number, c: Ctx, slots: number) {
  const s = sc.sockets[i];
  const p = defs!.plugs[b.plugs[i] ?? s.init];
  const fixed = s.plugs.length < 2;
  const off = s.group === "fragments" && socketsOf(sc, "fragments").indexOf(i) >= slots;
  const empty = isEmptyPlug(p);
  const rated = s.group === "aspects" ? aspectRating(c.ratings, p) : s.group === "fragments" ? fragmentRating(c.ratings, p) : null;
  const superScore = s.group === "super" ? subclassRating(c.ratings, sc)?.scores.super : null;
  const stats = (p?.st ?? []).map(([h, v]) => `<span class="bd-stat ${v > 0 ? "up" : "down"}">${v > 0 ? "+" : ""}${v} ${esc(c.statNames[h] ?? "")}</span>`).join("");
  return `<button class="bd-sock${empty ? " empty" : ""}${off ? " off" : ""}${fixed ? " fixed" : ""}" data-act="socket" data-i="${i}" ${off ? "disabled" : ""}
      title="${esc(off ? "Pick aspects with more fragment slots to use this one" : `${GROUP_LABEL[s.group]}: ${p?.n ?? ""}${fixed ? " (fixed)" : ""}`)}">
    <span class="bd-sico">${empty ? `<span class="bd-plus">${off ? "🔒" : "+"}</span>` : img(p?.i)}${rated ? tierChip(rated.tier) : ""}</span>
    <span class="bd-smeta"><span class="cap">${s.group === "other" ? esc(p?.t ?? GROUP_LABEL.other) : GROUP_LABEL[s.group]}</span><b>${empty ? (off ? "Locked" : "Empty") : esc(p?.n)}</b>${stats}${superScore != null ? `<span class="badge" title="Aegis super score for this subclass">${superScore}/10</span>` : ""}</span>
  </button>`;
}

/* ---------- Weapons and armor ---------- */

function weaponsCard(b: Build, c: Ctx) {
  return `<div class="bd-card glass"><div class="bd-card-head"><h3>Weapons</h3><span class="small muted">From your vault and characters</span></div>
    <div class="bd-items">${WEAPON_SLOTS.map((slot) => {
      const w = weaponOf(c, b.items[slot]?.id);
      const sc = w ? c.scores.get(w.instanceId) : undefined;
      return `<button class="bd-item${w?.rarity === "Exotic" ? " exotic" : ""}" data-act="item" data-slot="${slot}" style="--el:var(--${w?.element ?? "Unknown"})">
        <span class="bd-iico">${w ? img(w.icon) : `<span class="bd-plus">+</span>`}${tierChip(weaponTier(w?.instanceId))}</span>
        <span class="bd-imeta"><span class="cap">${slot}</span><b>${w ? esc(w.name) : b.items[slot] ? "Missing item" : "Choose a weapon"}</b>${w ? `<span class="sm">${esc(w.type)} · <span class="el" style="color:var(--${esc(w.element)})"><i></i><span>${esc(w.element)}</span></span></span>` : ""}</span>
        ${sc !== undefined ? `<span class="bd-iscore">${sc}</span>` : ""}</button>`;
    }).join("")}</div></div>`;
}

function armorCard(b: Build, c: Ctx) {
  return `<div class="bd-card glass bd-armor"><div class="bd-card-head"><h3>Armor and mods</h3><span class="small muted">${ARMOR_ENERGY} energy per piece</span></div>
    <div class="bd-armorlist">${ARMOR_SLOTS.map((slot) => {
      const a = armorOf(c, b.items[slot]?.id);
      const mods = b.mods[slot] ?? Array(MOD_SOCKETS).fill(0);
      const used = modEnergy(mods, defs!);
      const sc = a ? c.scores.get(a.instanceId) : undefined;
      return `<div class="bd-arow">
        <button class="bd-item${a?.rarity === "Exotic" ? " exotic" : ""}" data-act="item" data-slot="${slot}">
          <span class="bd-iico">${a ? img(a.icon) : `<span class="bd-plus">+</span>`}</span>
          <span class="bd-imeta"><span class="cap">${slot}</span><b>${a ? esc(a.name) : b.items[slot] ? "Missing item" : `Choose ${slot === "Arms" ? "arms" : slot.toLowerCase()}`}</b>${a ? `<span class="sm">${esc(a.archetype ?? "Legacy")} · ${a.statTotal} total${a.gearTier ? ` · Tier ${a.gearTier}` : ""}</span>` : ""}</span>
          ${sc !== undefined ? `<span class="bd-iscore">${sc}</span>` : ""}</button>
        <div class="bd-mods">${mods
          .map((h, k) => {
            const p = h ? defs!.plugs[h] : undefined;
            return `<button class="bd-mod${p ? "" : " empty"}" data-act="mod" data-slot="${slot}" data-k="${k}" title="${esc(p ? `${p.n} (${p.cost ?? 0} energy)` : k === 0 ? "General mod" : `${slot} mod`)}">${p ? img(p.i) : `<span class="bd-plus">${k === 0 ? "G" : "+"}</span>`}${p?.cost ? `<i>${p.cost}</i>` : ""}</button>`;
          })
          .join("")}<span class="bd-energy${used > ARMOR_ENERGY ? " over" : ""}" title="Mod energy used"><span style="width:${Math.min(100, (used / ARMOR_ENERGY) * 100)}%"></span><b class="num">${used}/${ARMOR_ENERGY}</b></span></div>
      </div>`;
    }).join("")}</div></div>`;
}

function statsCard(b: Build, c: Ctx) {
  const lines = statLines(b, c);
  return `<div class="bd-card glass bd-stats"><div class="bd-card-head"><h3>Stats</h3><span class="small muted">Armor + mods + fragments · targets are yours to set</span></div>
    ${lines
      .map((l) => {
        const pct = (n: number) => `${(Math.max(0, n) / STAT_MAX) * 100}%`;
        const met = l.target > 0 && l.total >= l.target;
        return `<div class="bd-sline">
          <span class="bd-sname">${esc(l.name)}</span>
          <span class="bd-sbar" title="Armor ${l.armor} · Mods ${l.mods} · Fragments ${l.fragments}">
            <i class="a" style="width:${pct(Math.min(l.total, l.armor))}"></i><i class="m" style="width:${pct(Math.min(Math.max(0, l.total - l.armor), Math.max(0, l.mods)))}"></i><i class="f" style="width:${pct(Math.max(0, l.total - Math.max(0, l.armor) - Math.max(0, l.mods)))}"></i>
            <s style="left:50%" title="100: full benefit; above 100 is the enhanced range"></s>${l.target ? `<u style="left:${pct(l.target)}"></u>` : ""}</span>
          <b class="num bd-stot${met ? " met" : l.target ? " short" : ""}">${l.total}</b>
          <span class="bd-sdelta small">${l.fragments ? `<span class="bd-stat ${l.fragments > 0 ? "up" : "down"}">${l.fragments > 0 ? "+" : ""}${l.fragments} frag</span>` : ""}${l.mods ? `<span class="bd-stat up">+${l.mods} mods</span>` : ""}</span>
          <label class="bd-target"><span class="sr">${esc(l.name)} target</span><input type="number" min="0" max="${STAT_MAX}" step="10" value="${l.target || ""}" placeholder="Target" data-target="${l.hash}"></label>
        </div>`;
      })
      .join("")}
    <div class="bd-legend small muted"><span><i class="a"></i>Armor</span><span><i class="m"></i>Mods</span><span><i class="f"></i>Fragments</span><span><u></u>Target</span></div></div>`;
}

/* ---------- Picker (shared drawer) ---------- */

interface Opt {
  key: string;
  icon?: string;
  name: string;
  sub?: string;
  badge?: string;
  locked?: string;
  on?: boolean;
  detail: () => string;
  search?: string;
  exotic?: boolean;
}

let pick: { opts: Opt[]; onPick: (k: string) => void; chosen: string | null; filters?: { id: string; label: string; test: (o: Opt) => boolean }[]; filter: string } | null = null;

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
      if ((e.target as HTMLElement).id === "bd-pq") drawPickGrid();
    });
    el.addEventListener("change", (e) => onDrawerChange(e));
    window.addEventListener("keydown", (e: KeyboardEvent) => e.key === "Escape" && el!.classList.contains("open") && closeDrawer());
  }
  return { el, scrim: scrim! };
}
function openDrawer(html: string) {
  const d = drawer();
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
  pick = null;
}

function openPicker(title: string, sub: string, opts: Opt[], onPick: (k: string) => void, filters?: NonNullable<typeof pick>["filters"]) {
  pick = { opts, onPick, chosen: opts.find((o) => o.on)?.key ?? null, filters, filter: "all" };
  openDrawer(`<div class="bd-pick">
    <div><div class="eyebrow">${esc(sub)}</div><h2>${esc(title)}</h2></div>
    <input class="bd-input" id="bd-pq" type="search" placeholder="Search" aria-label="Search">
    ${filters?.length ? `<div class="subchips">${[{ id: "all", label: "All" }, ...filters].map((f) => `<button class="subchip" data-dact="filter" data-f="${f.id}" aria-pressed="${f.id === "all"}">${esc(f.label)}</button>`).join("")}</div>` : ""}
    <div class="bd-pgrid" id="bd-pgrid"></div>
    <div class="bd-detail" id="bd-detail"></div>
    <div class="bd-pfoot"><button class="btn primary" data-dact="use" id="bd-use" disabled>Use it</button><button class="btn ghost" data-dact="close">Cancel</button></div></div>`);
  drawPickGrid();
  showDetail();
}

function drawPickGrid() {
  if (!pick) return;
  const q = (document.getElementById("bd-pq") as HTMLInputElement | null)?.value.trim().toLowerCase() ?? "";
  const f = pick.filters?.find((x) => x.id === pick!.filter);
  const list = pick.opts.filter((o) => (!q || (o.search ?? o.name + " " + (o.sub ?? "")).toLowerCase().includes(q)) && (!f || f.test(o)));
  document.getElementById("bd-pgrid")!.innerHTML =
    list
      .map(
        (o) => `<button class="bd-opt${o.key === pick!.chosen ? " on" : ""}${o.locked ? " locked" : ""}${o.exotic ? " exotic" : ""}" data-dact="opt" data-k="${esc(o.key)}" title="${esc(o.locked || o.name)}">
      <span class="bd-oico">${o.icon !== undefined ? img(o.icon) : ""}${o.badge ?? ""}</span><span class="bd-ometa"><b>${esc(o.name)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ""}</span></button>`,
      )
      .join("") || `<p class="small muted">Nothing matches.</p>`;
}

function showDetail() {
  if (!pick) return;
  const o = pick.opts.find((x) => x.key === pick!.chosen);
  document.getElementById("bd-detail")!.innerHTML = o ? o.detail() : `<p class="small muted">Pick one to see what it does and how Aegis rates it.</p>`;
  const use = document.getElementById("bd-use") as HTMLButtonElement;
  use.disabled = !o || !!o.locked;
  use.textContent = o ? (o.locked ? o.locked : `Use ${o.name}`) : "Use it";
}

function onDrawerClick(e: Event) {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-dact]");
  if (!t) return;
  const a = t.dataset.dact;
  if (a === "close") return closeDrawer();
  if (a === "opt" && pick) {
    pick.chosen = t.dataset.k!;
    for (const b of document.querySelectorAll<HTMLElement>("#bd-pgrid .bd-opt")) b.classList.toggle("on", b.dataset.k === pick.chosen);
    showDetail();
    if (innerWidth < 700) document.getElementById("bd-detail")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // Double-click (or a second tap) uses it straight away.
    if ((e as MouseEvent).detail > 1) t.closest("aside")!.querySelector<HTMLButtonElement>("#bd-use")?.click();
    return;
  }
  if (a === "use" && pick?.chosen) {
    const o = pick.opts.find((x) => x.key === pick!.chosen);
    if (!o || o.locked) return;
    const fn = pick.onPick;
    closeDrawer();
    fn(o.key);
    return;
  }
  if (a === "filter" && pick) {
    pick.filter = t.dataset.f!;
    for (const b of document.querySelectorAll<HTMLElement>("#bd-drawer [data-dact=filter]")) b.setAttribute("aria-pressed", String(b === t));
    drawPickGrid();
    return;
  }
  DRAWER_ACTIONS[a!]?.(t);
}
const DRAWER_ACTIONS: Record<string, (t: HTMLElement) => void> = {};
let onDrawerChange: (e: Event) => void = () => {};

/* ---------- Details ---------- */

function plugDetail(p: PlugDef, group: SocketGroup, sc: SubclassDef | null) {
  const r = ctx().ratings;
  const rated = group === "aspects" ? aspectRating(r, p) : group === "fragments" ? fragmentRating(r, p) : null;
  const info = infoFor(r, p.n);
  const stats = (p.st ?? []).map(([h, v]) => `<span class="bd-stat ${v > 0 ? "up" : "down"}">${v > 0 ? "+" : ""}${v} ${esc(ctx().statNames[h] ?? "")}</span>`).join("");
  const sub = sc && group === "super" ? subclassRating(r, sc) : null;
  return `<div class="bd-dhead">${img(p.i)}<div><b>${esc(p.n)}</b><span>${esc(p.t ?? GROUP_LABEL[group])}${p.cap ? ` · ${p.cap} fragment slots` : ""}${p.cost && group !== "fragments" ? ` · ${p.cost} energy` : ""}</span></div>
      ${rated ? `<span class="bd-dtier">${tierChip(rated.tier)}<span>${rated.rank ? `#${rated.rank}` : ""}</span></span>` : ""}</div>
    ${stats ? `<div class="bd-dstats">${stats}</div>` : ""}
    ${p.d ? `<p class="bd-desc">${esc(p.d)}</p>` : ""}
    ${rated ? `<div class="bd-aegis"><div class="cap">Aegis · ${esc(rated.tier)} tier${rated.subclass ? ` · ${esc(rated.subclass)}` : ""}</div>
      ${rated.trigger ? `<div><span>Trigger</span><p>${esc(rated.trigger)}</p></div>` : ""}${rated.effect ? `<div><span>Effect</span><p>${esc(rated.effect)}</p></div>` : ""}${rated.usage ? `<div><span>Why</span><p>${esc(rated.usage)}</p></div>` : ""}</div>` : ""}
    ${sub ? `<div class="bd-aegis"><div class="cap">Aegis · super ${sub.scores.super ?? "—"}/10 for ${esc(sub.element)} ${esc(sub.cls)}</div><p>${esc(sub.supers)}</p></div>` : ""}
    ${info ? `<details class="bd-info"${rated ? "" : " open"}><summary class="cap">Data Compendium</summary><p>${esc(info)}</p></details>` : ""}`;
}

/* ---------- Actions ---------- */

function wire(el: HTMLElement) {
  el.dataset.wired = "1";
  el.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (t && !(t as HTMLButtonElement).disabled) ACTIONS[t.dataset.act!]?.(t);
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
      const card = panel!.querySelector(".bd-bcard.on b");
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
  el.addEventListener("keydown", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "bd-tag" && e.key === "Enter" && cur && t.value.trim()) {
      cur.tags = [...new Set([...cur.tags, t.value.trim()])];
      touch();
      panel?.querySelector<HTMLInputElement>("#bd-tag")?.focus();
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
    cur = newBuild(t.dataset.cls ? Number(t.dataset.cls) : (classChoices()[0] ?? 0));
    const sc = Object.values(defs!.subclasses).find((s) => s.cls === cur!.cls && s.el === "Prismatic");
    cur.name = `${CLASS_NAME(cur.cls)} build ${builds.filter((b) => b.cls === cur!.cls).length + 1}`;
    if (sc && (!charFor(profile, cur.cls) || subclassInstance(profile, cur.cls, sc.h))) setSubclass(sc);
    touch();
  },
  open: (t) => {
    cur = builds.find((b) => b.id === t.dataset.id) ?? cur;
    draw();
    panel?.querySelector(".bd-editor")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  },
  cls: (t) => {
    if (!cur || Number(t.dataset.cls) === cur.cls) return;
    cur.cls = Number(t.dataset.cls);
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
  del: () => {
    if (!cur || !confirm(`Delete “${cur.name}”? This can't be undone.`)) return;
    builds = builds.filter((b) => b !== cur);
    saveBuilds(builds);
    cur = builds[0] ?? null;
    draw();
  },
  subclass: (t) => {
    const sc = defs!.subclasses[Number(t.dataset.h)];
    if (!cur || !sc || sc.h === cur.subclass) return;
    setSubclass(sc);
    touch();
  },
  socket: (t) => socketPicker(Number(t.dataset.i)),
  item: (t) => itemPicker(t.dataset.slot as BuildSlot),
  mod: (t) => modPicker(t.dataset.slot as GearSlot, Number(t.dataset.k)),
  equip: () => void equipFlow(),
  dim: () => dimFlow(),
  import: () => importFlow(),
};

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

function socketPicker(i: number) {
  const b = cur!;
  const sc = defs!.subclasses[b.subclass!];
  const s = sc.sockets[i];
  const unlocked = profile?.unlocked.get(subclassInstance(profile, b.cls, sc.h)?.id ?? "")?.[i];
  const r = ctx().ratings;
  const taken = new Set(socketsOf(sc, s.group).filter((j) => j !== i).map((j) => b.plugs[j]));
  const slots = fragmentSlots(b, defs!);
  const rank = (o: Opt) => (!o.icon ? 1000 : TIER_POINTS[o.badge?.match(/>(\w)</)?.[1] ?? ""] ?? -1);
  const opts: Opt[] = s.plugs
    .map((h) => defs!.plugs[h])
    .filter((p): p is PlugDef => !!p)
    .map((p) => {
      const rated = s.group === "aspects" ? aspectRating(r, p) : s.group === "fragments" ? fragmentRating(r, p) : null;
      const empty = isEmptyPlug(p);
      const cap = s.group === "aspects" && !empty ? `${p.cap ?? 0} fragment slots` : "";
      return {
        key: String(p.h),
        icon: empty ? undefined : p.i,
        name: empty ? "Leave empty" : p.n,
        sub: [...(p.st ?? []).map(([h, v]) => `${v > 0 ? "+" : ""}${v} ${ctx().statNames[h]}`), cap].filter(Boolean).join(" · "),
        badge: rated ? tierChip(rated.tier) : "",
        on: (b.plugs[i] ?? s.init) === p.h,
        locked: !empty && taken.has(p.h) ? "Already in another slot" : !empty && unlocked && !unlocked.has(p.h) ? "Not unlocked yet" : undefined,
        detail: () => (empty ? `<p class="small muted">Leaves this slot empty.</p>` : plugDetail(p, s.group, sc)),
        search: `${p.n} ${p.d} ${rated?.effect ?? ""}`,
      };
    })
    // "Leave empty" first, then best rated; unrated keep the game's order.
    .sort((x, y) => rank(y) - rank(x));
  const filters =
    s.group === "fragments"
      ? [
          { id: "free", label: "No stat penalty", test: (o: Opt) => !o.sub?.includes("-") },
          { id: "top", label: "S and A tier", test: (o: Opt) => /tier t[SA]/.test(o.badge ?? "") },
        ]
      : undefined;
  openPicker(GROUP_LABEL[s.group], `${sc.n} · ${s.group === "fragments" ? `${slots} slots open` : CLASS_NAME(b.cls)}`, opts, (k) => {
    b.plugs[i] = Number(k);
    if (s.group === "aspects") trimFragments(b, defs!);
    touch();
  }, filters);
}

function itemPicker(slot: BuildSlot) {
  const b = cur!;
  const c = ctx();
  const isWeapon = (WEAPON_SLOTS as readonly string[]).includes(slot);
  const where = (loc: { where: string; equipped: boolean }) =>
    loc.where === "vault" ? "Vault" : `${input!.vault.characters.find((x) => x.id === loc.where)?.className ?? "Character"}${loc.equipped ? " (equipped)" : ""}`;
  const recs = isWeapon
    ? c.vault.weapons.filter((w) => w.slot === slot)
    : c.vault.armor.filter((a) => a.slot === slot && (a.classType === CLASS_NAME(b.cls) || a.classType === "Any"));
  const opts: Opt[] = recs
    .map((x) => {
      const score = c.scores.get(x.instanceId);
      const statsLine = x.kind === "armor" ? STAT_HASHES.map((h) => `${(c.statNames[h] ?? "").slice(0, 3)} ${x.stats[c.statNames[h]] ?? 0}`).join(" · ") : "";
      return {
        key: x.instanceId,
        icon: x.icon,
        name: x.name,
        sub: `${x.rarity === "Exotic" ? "Exotic · " : ""}${x.kind === "weapon" ? `${x.type} · ${x.element}` : `${x.archetype ?? "Legacy"} · ${x.statTotal}`}${score !== undefined ? ` · score ${score}` : ""} · ${where(x.location)}`,
        exotic: x.rarity === "Exotic",
        badge: x.kind === "weapon" ? tierChip(weaponTier(x.instanceId)) : x.gearTier ? `<span class="tier tU">T${x.gearTier}</span>` : "",
        on: b.items[slot]?.id === x.instanceId,
        detail: () => `<div class="bd-dhead">${img(x.icon)}<div><b>${esc(x.name)}</b><span>${esc(x.rarity)} · ${esc(x.kind === "weapon" ? `${x.frame ? x.frame.replace(/ Frame$/, "") + " " : ""}${x.type}` : `${x.archetype ?? "Legacy armor"}${x.setName ? " · " + x.setName : ""}`)}</span></div>
            ${score !== undefined ? `<span class="bd-dtier"><b class="num grad-text">${score}</b><span>vault score</span></span>` : ""}</div>
          ${x.kind === "armor" ? `<div class="bd-dstats">${STAT_HASHES.map((h) => `<span class="bd-stat">${esc(c.statNames[h])} <b>${x.stats[c.statNames[h]] ?? 0}</b></span>`).join("")}</div>` : ""}
          <p class="small muted">${esc(where(x.location))}${x.kind === "weapon" && weaponTier(x.instanceId) ? ` · Aegis ${weaponTier(x.instanceId)} tier` : ""}</p>
          ${x.rarity === "Exotic" && exoticClash(b, c, slot, x) ? `<p class="small" style="color:var(--gold)">Replaces the exotic in your ${exoticClash(b, c, slot, x)} slot (one exotic ${x.kind} at a time).</p>` : ""}`,
        search: `${x.name} ${x.kind === "weapon" ? `${x.type} ${x.element} ${x.frame}` : `${x.archetype} ${x.setName} ${statsLine}`} ${x.rarity}`,
        score: score ?? -1,
      };
    })
    .sort((x, y) => y.score - x.score);
  const filters = isWeapon
    ? [
        { id: "exotic", label: "Exotic", test: (o: Opt) => !!o.exotic },
        ...["Kinetic", "Arc", "Solar", "Void", "Stasis", "Strand"].map((el) => ({ id: el, label: el, test: (o: Opt) => (o.sub ?? "").includes(`· ${el}`) })),
      ]
    : [
        { id: "exotic", label: "Exotic", test: (o: Opt) => !!o.exotic },
        { id: "legendary", label: "Legendary", test: (o: Opt) => !o.exotic && !!o.key },
      ];
  if (b.items[slot]) opts.unshift({ key: "", name: "Leave empty", sub: "Keep whatever is equipped", detail: () => `<p class="small muted">The build won't change this slot.</p>` });
  openPicker(slot, `${CLASS_NAME(b.cls)} · ${isWeapon ? "weapons" : "armor"} by vault score`, opts, (k) => {
    if (!k) delete b.items[slot];
    else {
      const x = itemOf(c, k)!;
      const clash = exoticClash(b, c, slot, x);
      if (clash) delete b.items[clash];
      b.items[slot] = { id: x.instanceId, hash: x.itemHash };
    }
    touch();
  }, filters);
}

function modPicker(slot: GearSlot, k: number) {
  const b = cur!;
  const mods = (b.mods[slot] ??= Array(MOD_SOCKETS).fill(0));
  const pci = k === 0 ? GENERAL_PCI : MOD_PCI[slot];
  const free = ARMOR_ENERGY - modEnergy(mods.filter((_, j) => j !== k), defs!);
  const c = ctx();
  const opts: Opt[] = (defs!.mods[pci] ?? [])
    .map((h) => defs!.plugs[h])
    .filter((p): p is PlugDef => !!p)
    .map((p) => {
      const empty = isEmptyPlug(p);
      return {
        key: empty ? "0" : String(p.h),
        icon: empty ? undefined : p.i,
        name: empty ? "No mod" : p.n,
        sub: empty ? "Free the socket" : `${p.cost ?? 0} energy${p.st ? " · " + p.st.map(([h, v]) => `+${v} ${c.statNames[h]}`).join(", ") : ""}`,
        badge: p.cost ? `<span class="bd-cost">${p.cost}</span>` : "",
        on: empty ? !mods[k] : mods[k] === p.h,
        locked: !empty && (p.cost ?? 0) > free ? `Needs ${p.cost} energy (${free} free)` : undefined,
        detail: () => (empty ? `<p class="small muted">Leaves this socket empty.</p>` : plugDetail(p, "other", null)),
        search: `${p.n} ${p.d}`,
      };
    })
    .sort((x, y) => (x.key === "0" ? -1 : y.key === "0" ? 1 : x.name.localeCompare(y.name)));
  const filters = k === 0 ? undefined : [{ id: "stat", label: "Stat mods", test: (o: Opt) => /\+\d+ /.test(o.sub ?? "") }];
  openPicker(k === 0 ? "General mod" : `${slot} mod`, `${slot} · ${free} energy free`, opts, (key) => {
    mods[k] = Number(key);
    touch();
  }, filters);
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
