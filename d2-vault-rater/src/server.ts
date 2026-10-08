#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ensureDirs } from "./config.js";
import { startLogin, finishLogin } from "./bungie/oauth.js";
import { loadManifest, currentManifest } from "./bungie/manifest.js";
import { fetchVault, currentVault } from "./vault/fetch.js";
import { fetchWrapped } from "./vault/wrapped.js";
import { importAegis, loadAegis } from "./sources/aegis.js";
import { importWishlists, loadWishlists, DEFAULT_WISHLISTS } from "./sources/wishlist.js";
import { importArmorSets, loadArmorSets } from "./sources/armorSets.js";
import { buildSourceLookup, importActivityLoot, loadActivityLoot } from "./sources/activities.js";
import { rateActivities } from "./rating/activities.js";
import { planEncounters } from "./rating/encounters.js";
import { ROLE_LABEL } from "./data/encounters.js";
import { moveItems } from "./bungie/transfer.js";
import { fetchDimData, setDimTag, keepIds, DIM_TAGS, type DimData } from "./dim/sync.js";
import { loadSettings, saveSettings, strictnessFor, PRESETS, StrictnessOverride } from "./rating/settings.js";
import { rateWeapons, type WeaponRating, type WeaponReport } from "./rating/weapons.js";
import { rateArmor, type ArmorRating, type ArmorReport } from "./rating/armor.js";
import { buildMarkdown, writeHtml } from "./report/report.js";
import { planDimActions, applyDimActions, exportCsv, undoDimActions, loadPlan } from "./dim/actions.js";

ensureDirs();
const here = dirname(fileURLToPath(import.meta.url));
const instructions = readFileSync(join(here, "..", "skill", "SKILL.md"), "utf8");

const server = new McpServer({ name: "d2-vault-rater", version: "0.1.0" }, { instructions: "Rates a Destiny 2 vault. Read the vault_review prompt before using the tools." });

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = (e: unknown) => ({ ...text(`Error: ${(e as Error).message}`), isError: true });
const wrap =
  <A,>(fn: (args: A) => Promise<unknown> | unknown) =>
  async (args: A) => {
    try {
      return text(await fn(args));
    } catch (e) {
      return fail(e);
    }
  };

let weaponReport: WeaponReport | null = null;
let armorReport: ArmorReport | null = null;

async function sources() {
  const manifest = currentManifest() ?? (await loadManifest());
  return { manifest, aegis: loadAegis(), wishlists: loadWishlists() };
}

/** DIM data for this session, re-read at most every five minutes. */
let dimCache: { at: number; data: DimData | null; error: string | null } | null = null;
async function dimData(s: ReturnType<typeof loadSettings>) {
  if (!s.dim.tags && !s.dim.loadouts) return { data: null, error: null };
  if (!dimCache || Date.now() - dimCache.at > 300_000) {
    try {
      dimCache = { at: Date.now(), data: await fetchDimData({ tags: true, loadouts: true }), error: null };
    } catch (e) {
      dimCache = { at: Date.now(), data: null, error: (e as Error).message };
    }
  }
  return dimCache;
}

async function rateAll() {
  const vault = await currentVault();
  const saved = loadSettings();
  const dim = await dimData(saved);
  const settings = { ...saved, dimKeep: saved.dim.tags && saved.dim.protectTagged ? keepIds(dim.data) : [] };
  const src = await sources();
  if (!src.aegis) throw new Error("Aegis's tier list has not been imported yet. Call refresh_sources first.");
  weaponReport = rateWeapons(vault.weapons, src, settings);
  armorReport = rateArmor(vault, settings, loadArmorSets());
  return { vault, settings, weaponReport, armorReport };
}

const brief = (r: WeaponRating) => ({
  id: r.instanceId,
  name: r.name,
  type: `${r.frame.replace(/ Frame$/, "")} ${r.type}`.trim(),
  element: r.element,
  slot: r.slot,
  tier: r.aegis?.tier ?? "unrated",
  score: r.score,
  roll: r.rollScore,
  verdict: r.verdict,
  label: r.label,
  category: r.category,
  perks: r.perks.filter((p) => p.kind === "perk1" || p.kind === "perk2").map((p) => p.options.join(" / ")),
  matched: r.matched,
  reasons: r.reasons,
  aegisNotes: r.aegis?.notes || undefined,
  icon: r.icon,
  screenshot: r.screenshot ?? undefined,
});
const abrief = (r: ArmorRating) => ({
  id: r.instanceId,
  name: r.name,
  class: r.classType,
  slot: r.slot,
  archetype: r.archetype ?? "legacy",
  tier: r.gearTier,
  stats: r.topStats.map((t) => `${t.name} ${t.value}`).join(" / "),
  set: r.setName ?? undefined,
  score: r.score,
  verdict: r.verdict,
  label: r.label,
  reasons: r.reasons,
  icon: r.icon,
});

server.registerPrompt(
  "vault_review",
  { description: "Instructions for analysing a Destiny 2 vault with these tools and writing the report." },
  () => ({ messages: [{ role: "user", content: { type: "text", text: instructions } }] }),
);

server.registerTool(
  "login",
  {
    description:
      "Log in to Bungie.net. Call with no arguments to get the approval URL for the player. After they approve, call again with redirected_url set to the full URL their browser landed on (the page itself may fail to load; that is fine).",
    inputSchema: { redirected_url: z.string().optional() },
  },
  wrap(async ({ redirected_url }: { redirected_url?: string }) =>
    redirected_url
      ? { loggedIn: true, ...(await finishLogin(redirected_url)) }
      : { approveAt: startLogin(), next: "Open this URL, approve, then send back the full address you land on." },
  ),
);

server.registerTool(
  "refresh_sources",
  {
    description: "Download the Destiny manifest, re-import Aegis's tier list sheet, and re-import community wishlists. Run once before the first rating and whenever the player wants fresh data.",
    inputSchema: { force_manifest: z.boolean().optional() },
  },
  wrap(async ({ force_manifest }: { force_manifest?: boolean }) => {
    const settings = loadSettings();
    const manifest = await loadManifest({ force: force_manifest });
    const aegis = await importAegis(manifest, settings.aegisTabs);
    const wl = await importWishlists(settings.wishlists.length ? settings.wishlists : DEFAULT_WISHLISTS);
    const armorSets = await importArmorSets().catch((e) => ({ sets: {}, warnings: [`Armor set tiers not loaded: ${(e as Error).message}`] }));
    return {
      manifestVersion: manifest.version,
      aegis: { tabs: aegis.tabs, weapons: aegis.weapons.length, unmatched: aegis.unmatched.slice(0, 40), unmatchedCount: aegis.unmatched.length, warnings: aegis.warnings },
      wishlists: { sources: wl.sources, rolls: wl.rolls.length },
      activities: await importActivityLoot(manifest, aegis, loadArmorSets()).then((d) => d.activities.map((x) => `${x.name}: ${x.weapons.length} weapons, sets ${x.armorSets.join(", ") || "none"}`)).catch((e) => `not loaded: ${(e as Error).message}`),
      armorSets: { sets: Object.keys(armorSets.sets).length, rated: Object.values(armorSets.sets).filter((x) => x.bonuses.some((b) => b.tier)).length, warnings: armorSets.warnings },
    };
  }),
);

server.registerTool(
  "get_vault",
  { description: "Fetch the player's vault and characters from Bungie (fresh every call) and summarise what is there.", inputSchema: {} },
  wrap(async () => {
    const v = await fetchVault();
    weaponReport = armorReport = null;
    const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
    return {
      characters: v.characters,
      weapons: v.weapons.length,
      armor: v.armor.length,
      weaponsBySlot: count(v.weapons.map((w) => w.slot)),
      weaponsByType: count(v.weapons.map((w) => w.type)),
      armorByClass: count(v.armor.map((a) => a.classType)),
      fetchedAt: v.fetchedAt,
    };
  }),
);

server.registerTool(
  "get_settings",
  { description: "Show the strictness preset, its resolved values, per weapon type overrides, protect list and other settings.", inputSchema: {} },
  wrap(() => {
    const s = loadSettings();
    return { settings: s, resolved: strictnessFor(s), presets: PRESETS };
  }),
);

server.registerTool(
  "update_settings",
  {
    description:
      "Change how strict the rating is. preset: lenient | balanced | strict | ruthless. overrides: change single values (minTierKept, minRollKept, copiesPerArchetype, outscoredGap, unrated, armorCopies, legacyArmor, unlock). weapon_type + preset/overrides applies only to that weapon type (e.g. 'Submachine Gun'). Also sets focus, tone, protect list and build stats.",
    inputSchema: {
      preset: z.enum(PRESETS).optional(),
      overrides: z.optional(StrictnessOverride),
      weapon_type: z.string().optional(),
      clear_weapon_type: z.boolean().optional(),
      focus: z.enum(["pve", "pvp", "both"]).optional(),
      tone: z.enum(["short", "detailed"]).optional(),
      protect_add: z.array(z.string()).optional(),
      protect_remove: z.array(z.string()).optional(),
      build_stats: z.record(z.string(), z.array(z.string())).optional(),
      dim_tags: z.boolean().optional(),
      dim_loadouts: z.boolean().optional(),
      dim_protect_tagged: z.boolean().optional(),
    },
  },
  wrap((a: {
    preset?: (typeof PRESETS)[number];
    overrides?: z.infer<typeof StrictnessOverride>;
    weapon_type?: string;
    clear_weapon_type?: boolean;
    focus?: "pve" | "pvp" | "both";
    tone?: "short" | "detailed";
    protect_add?: string[];
    protect_remove?: string[];
    build_stats?: Record<string, string[]>;
    dim_tags?: boolean;
    dim_loadouts?: boolean;
    dim_protect_tagged?: boolean;
  }) => {
    const s = loadSettings();
    if (a.weapon_type) {
      if (a.clear_weapon_type) delete s.byWeaponType[a.weapon_type];
      else s.byWeaponType[a.weapon_type] = { preset: a.preset, overrides: { ...(s.byWeaponType[a.weapon_type]?.overrides ?? {}), ...(a.overrides ?? {}) } };
    } else {
      if (a.preset) {
        s.preset = a.preset;
        s.overrides = {};
      }
      if (a.overrides) s.overrides = { ...s.overrides, ...a.overrides };
    }
    if (a.focus) s.focus = a.focus;
    if (a.tone) s.tone = a.tone;
    if (a.protect_add) s.protect = [...new Set([...s.protect, ...a.protect_add])];
    if (a.protect_remove) s.protect = s.protect.filter((p) => !a.protect_remove!.includes(p));
    if (a.build_stats) s.buildStats = { ...s.buildStats, ...a.build_stats };
    if (a.dim_tags !== undefined) s.dim.tags = a.dim_tags;
    if (a.dim_loadouts !== undefined) s.dim.loadouts = a.dim_loadouts;
    if (a.dim_protect_tagged !== undefined) s.dim.protectTagged = a.dim_protect_tagged;
    const saved = saveSettings(s);
    weaponReport = armorReport = null;
    return { saved, resolved: strictnessFor(saved, a.weapon_type) };
  }),
);

server.registerTool(
  "rate_weapons",
  {
    description: "Score every weapon against Aegis's tier list and its roll, then return best per slot, element and archetype, duplicates, the shard list and S-tier gaps. detail='full' adds every weapon.",
    inputSchema: { detail: z.enum(["summary", "full"]).optional() },
  },
  wrap(async ({ detail }: { detail?: "summary" | "full" }) => {
    const { weaponReport: w, settings } = await rateAll();
    const map = (o: Record<string, WeaponRating[]>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.map(brief)]));
    return {
      strictness: settings.preset,
      total: w.ratings.length,
      keep: w.ratings.length - w.shard.length,
      shardCount: w.shard.length,
      unrated: w.unratedCount,
      bestBySlot: map(w.bestBySlot),
      bestByElement: map(w.bestByElement),
      bestByArchetype: map(w.bestByArchetype),
      duplicates: w.duplicates,
      shard: w.shard.map(brief),
      gaps: w.gaps,
      all: detail === "full" ? w.ratings.map(brief) : undefined,
    };
  }),
);

server.registerTool(
  "rate_armor",
  { description: "Score every armor piece (stats, gear tier, build fit, set bonus) and return the best per class and slot plus the shard list.", inputSchema: { detail: z.enum(["summary", "full"]).optional() } },
  wrap(async ({ detail }: { detail?: "summary" | "full" }) => {
    const { armorReport: a } = await rateAll();
    return {
      buildStats: a.buildStats,
      setCounts: a.setCounts,
      best: Object.fromEntries(
        Object.entries(a.best).map(([cls, slots]) => [
          cls,
          Object.fromEntries(Object.entries(slots).map(([slot, b]) => [slot, { overall: abrief(b.overall), byArchetype: Object.fromEntries(Object.entries(b.byArchetype).map(([k, v]) => [k, abrief(v)])) }])),
        ]),
      ),
      shard: a.shard.map(abrief),
      all: detail === "full" ? a.ratings.map(abrief) : undefined,
    };
  }),
);

server.registerTool(
  "rate_activities",
  {
    description: "Rank every raid and dungeon by how worth farming it is for this vault: loot quality on Aegis's sheet, S/A-tier loot the player lacks or owns only with a weak roll, and armor set bonuses they don't have yet. Run refresh_sources first.",
    inputSchema: {},
  },
  wrap(async () => {
    const { weaponReport: w, armorReport: a } = await rateAll();
    const loot = loadActivityLoot();
    if (!loot) throw new Error("Raid and dungeon loot has not been imported yet. Call refresh_sources first.");
    return rateActivities(loot, loadAegis(), w.ratings, a.ratings, loadArmorSets()).map((r) => ({
      rank: r.rank,
      name: r.name,
      kind: r.kind,
      score: r.score,
      verdict: r.verdict,
      parts: r.parts,
      chase: r.weapons.filter((x) => x.status !== "have").map((x) => `${x.name} (${x.tier ?? "unrated"}, ${x.status})`),
      sets: r.sets.map((s) => `${s.name}: ${s.bonuses.map((b) => `${b.pieces}pc ${b.tier ?? "?"}`).join(" / ")}`),
    }));
  }),
);

server.registerTool(
  "plan_encounters",
  {
    description: "For each raid and dungeon encounter: what it demands and the best three-weapon loadout from the player's vault (one per slot, max one exotic), plus meta picks they don't own. Optionally filter by activity name.",
    inputSchema: { activity: z.string().optional() },
  },
  wrap(async ({ activity }: { activity?: string }) => {
    const { weaponReport: w } = await rateAll();
    const all = planEncounters(w.ratings);
    const q = activity?.toLowerCase();
    return Object.fromEntries(
      Object.entries(all)
        .filter(([k]) => !q || k.includes(q.replace(/[^a-z]+/g, "-").replace(/^the-/, "")))
        .map(([k, list]) => [k, list.map((e) => ({ encounter: e.name, kind: e.kind, tip: e.tip, loadout: e.picks.map((p) => `${ROLE_LABEL[p.role]}: ${p.name}${p.meta ? " (meta)" : ""}`), worthGetting: e.missing }))]),
    );
  }),
);

server.registerTool(
  "move_items",
  {
    description: "Pull items to a character (Titan, Hunter, Warlock, or a character id) or send them to the vault, optionally equipping them on arrival. Use item ids from rate_weapons, rate_armor or plan_encounters. Only when the player asks. Equipped items can't be moved until something else is equipped.",
    inputSchema: { ids: z.array(z.string()).min(1).max(20), to: z.string(), equip: z.boolean().optional() },
  },
  wrap(async ({ ids, to, equip }: { ids: string[]; to: string; equip?: boolean }) => {
    await currentVault();
    return moveItems(ids, to, { equip });
  }),
);

server.registerTool(
  "set_dim_tag",
  {
    description: "Set or clear one item's DIM tag (favorite, keep, infuse, junk, archive) and optionally its notes, through DIM Sync. Only when the player asks for it. Use the item id from rate_weapons or rate_armor.",
    inputSchema: { id: z.string(), tag: z.enum(DIM_TAGS).nullable(), notes: z.string().nullable().optional() },
  },
  wrap(async ({ id, tag, notes }: { id: string; tag: (typeof DIM_TAGS)[number] | null; notes?: string | null }) => {
    await setDimTag(id, tag, notes);
    dimCache = null;
    return { ok: true, id, tag, notes };
  }),
);

server.registerTool(
  "build_report",
  { description: "Build the player-facing report (markdown with weapon images) and save an HTML copy. Uses the latest ratings.", inputSchema: { plan_id: z.string().optional() } },
  wrap(async ({ plan_id }: { plan_id?: string }) => {
    const { vault, settings, weaponReport: w, armorReport: a } = await rateAll();
    const searches = plan_id ? loadPlan(plan_id).searches : undefined;
    const wrapped = await fetchWrapped((await sources()).manifest).catch(() => null);
    const loot = loadActivityLoot();
    const activities = loot ? rateActivities(loot, loadAegis(), w.ratings, a.ratings, loadArmorSets()) : [];
    const sourceOf = await buildSourceLookup((await sources()).manifest, loadAegis(), loot);
    const opts = { vaultSize: vault.weapons.length + vault.armor.length, settings, searches, vault, wrapped, activities, sourceOf, encounters: planEncounters(w.ratings) } as Parameters<typeof writeHtml>[2];
    const d = await dimData(settings);
    opts.dim = d.data && { ...d.data, tags: settings.dim.tags ? d.data.tags : {}, loadouts: settings.dim.loadouts ? d.data.loadouts : [] };
    opts.dimError = d.error;
    return { markdown: buildMarkdown(w, a, opts), htmlFile: await writeHtml(w, a, opts) };
  }),
);

server.registerTool(
  "plan_dim_actions",
  {
    description: "Dry run: list what would be locked, unlocked and tagged in DIM, with reasons. Changes nothing. Show the counts to the player and ask before applying.",
    inputSchema: {},
  },
  wrap(async () => {
    const { vault, settings, weaponReport: w, armorReport: a } = await rateAll();
    const plan = planDimActions(vault, w, a, settings);
    return {
      planId: plan.id,
      counts: plan.counts,
      unlock: plan.items.filter((i) => i.lock === false).map((i) => ({ name: i.name, why: i.note, category: i.category })),
      lock: plan.items.filter((i) => i.lock === true).map((i) => i.name),
      searches: plan.searches,
    };
  }),
);

server.registerTool(
  "apply_dim_actions",
  {
    description:
      "Apply an approved plan: lock keepers and unlock junk in game through Bungie, then write the DIM tags CSV. Only call after the player explicitly approved this plan_id. confirm must be true.",
    inputSchema: { plan_id: z.string(), confirm: z.literal(true) },
    annotations: { destructiveHint: true },
  },
  wrap(async ({ plan_id }: { plan_id: string; confirm: true }) => ({
    ...(await applyDimActions(plan_id)),
    next: "In DIM: Settings > Spreadsheets > Import tags/notes from CSV, and choose the csvFile. Locks show after DIM refreshes.",
  })),
);

server.registerTool(
  "export_dim_csv",
  { description: "Write the DIM tags/notes CSV for a plan without changing any locks.", inputSchema: { plan_id: z.string() } },
  wrap(({ plan_id }: { plan_id: string }) => ({ csvFile: exportCsv(plan_id), next: "Import it in DIM: Settings > Spreadsheets > Import tags/notes from CSV." })),
);

server.registerTool(
  "undo_dim_actions",
  { description: "Restore every lock an applied plan changed to its state before apply.", inputSchema: { plan_id: z.string() }, annotations: { destructiveHint: true } },
  wrap(({ plan_id }: { plan_id: string }) => undoDimActions(plan_id)),
);

await server.connect(new StdioServerTransport());
