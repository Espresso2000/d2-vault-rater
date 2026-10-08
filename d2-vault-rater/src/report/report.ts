import { writeSite } from "./site.js";
import type { WeaponRating, WeaponReport } from "../rating/weapons.js";
import type { ArmorRating, ArmorReport } from "../rating/armor.js";
import type { Settings } from "../rating/settings.js";
import type { Vault } from "../vault/types.js";
import type { Wrapped } from "../vault/wrapped.js";
import type { RatedActivity } from "../rating/activities.js";
import type { WeaponSource } from "../sources/activities.js";
import type { DimData } from "../dim/sync.js";
import type { EncounterPlan } from "../rating/encounters.js";
import type { DimPlan } from "../dim/actions.js";

const tierBadge = (r: WeaponRating) => (r.aegis ? r.aegis.tier : "unrated");

function perkLine(r: WeaponRating): string {
  const good = new Set(Object.values(r.matched).flat());
  return r.perks
    .filter((p) => p.kind === "perk1" || p.kind === "perk2")
    .map((p) => p.options.map((o) => (good.has(o) ? `**${o}**` : o)).join(" / "))
    .join(" + ");
}

export interface ReportOptions {
  vaultSize: number;
  settings: Settings;
  searches?: { keep: string; junk: string; review: string };
  /** Raw vault records, for fields the ratings leave out (ammo, power, crafted, every armor stat). */
  vault?: Vault;
  /** Account stats for the Wrapped section. */
  wrapped?: Wrapped | null;
  /** Raids and dungeons rated for farming. */
  activities?: RatedActivity[];
  /** Where each weapon comes from (Bungie's collections, Aegis's sheet, RADS activity). */
  sourceOf?: (hash: number, name: string) => WeaponSource;
  /** DIM Sync tags/notes and loadouts; null when turned off or unreachable. */
  dim?: DimData | null;
  dimError?: string | null;
  /** Per raid/dungeon key: each encounter with a loadout built from the vault. */
  encounters?: Record<string, EncounterPlan[]>;
  /** Dry-run lock plan, so the page can preview and (after confirming) apply it. */
  plan?: DimPlan | null;
}

export function buildMarkdown(w: WeaponReport, a: ArmorReport, o: ReportOptions): string {
  const out: string[] = [];
  const shardW = w.shard.filter((r) => r.verdict === "shard");
  const shardA = a.shard.filter((r) => r.verdict === "shard");
  out.push(`# Vault report`);
  out.push(
    `${o.vaultSize} items rated at **${o.settings.preset}** strictness. Keep ${w.ratings.length - w.shard.length} weapons and ${a.ratings.length - a.shard.length} armor pieces; ${shardW.length + shardA.length} can be sharded, freeing ${shardW.length + shardA.length} slots. ${w.unratedCount} weapons are not in Aegis's sheet.`,
  );

  out.push(`## Top picks by slot`);
  for (const [slot, list] of Object.entries(w.bestBySlot)) {
    const r = list[0];
    out.push(`### ${slot}: ${r.name} (${tierBadge(r)}, score ${r.score})`);
    if (r.screenshot) out.push(`![${r.name}](${r.screenshot})`);
    out.push(`${perkLine(r)}  \n${r.reasons.join("; ")}`);
    if (list.length > 1) out.push(`Runners-up: ${list.slice(1).map((x) => `${x.name} (${x.score})`).join(", ")}`);
  }

  out.push(`## Best by element`);
  out.push(`| | Element | Weapon | Tier | Score |\n| --- | --- | --- | --- | --- |`);
  for (const [el, list] of Object.entries(w.bestByElement))
    for (const r of list) out.push(`| ![](${r.icon}) | ${el} | ${r.name} | ${tierBadge(r)} | ${r.score} |`);

  out.push(`## Best by archetype`);
  out.push(`| | Archetype | Weapon | Element | Tier | Score |\n| --- | --- | --- | --- | --- | --- |`);
  for (const [arch, [r]] of Object.entries(w.bestByArchetype).sort()) out.push(`| ![](${r.icon}) | ${arch} | ${r.name} | ${r.element} | ${tierBadge(r)} | ${r.score} |`);

  if (w.duplicates.length) {
    out.push(`## Duplicates`);
    const byId = new Map(w.ratings.map((r) => [r.instanceId, r]));
    for (const d of w.duplicates) {
      const keep = byId.get(d.keep)!;
      out.push(`- ![](${keep.icon}) **${d.name}**: keep the ${keep.score} roll (${perkLine(keep)}); shard ${d.shard.map((id) => `${byId.get(id)!.score} (${perkLine(byId.get(id)!)})`).join(", ")}`);
    }
  }

  out.push(`## Shard list`);
  const byCat = new Map<string, WeaponRating[]>();
  for (const r of w.shard) byCat.set(r.verdict === "review" ? "review first" : r.category ?? "other", [...(byCat.get(r.verdict === "review" ? "review first" : r.category ?? "other") ?? []), r]);
  for (const [cat, list] of byCat) {
    out.push(`**${cat}** (${list.length})`);
    for (const r of list) out.push(`- ![](${r.icon}) ${r.name}, ${r.element} ${r.type}, score ${r.score}: ${r.reasons.at(-1)}`);
  }
  if (o.searches?.junk) out.push(`Paste into DIM search to select all junk:\n\n\`\`\`\n${o.searches.junk}\n\`\`\``);

  if (w.gaps.length) {
    out.push(`## Worth farming`);
    for (const g of w.gaps) out.push(`- ${g.name}: S tier ${g.tab} (${g.element}${g.frame ? `, ${g.frame}` : ""})`);
  }

  out.push(`## Armor`);
  for (const [cls, slots] of Object.entries(a.best)) {
    out.push(`### ${cls}${a.buildStats[cls]?.length ? ` (builds want ${a.buildStats[cls].join(" + ")})` : ""}`);
    out.push(`| | Slot | Best piece | Archetype | Stats | Score |\n| --- | --- | --- | --- | --- | --- |`);
    for (const [slot, b] of Object.entries(slots)) {
      const r = b.overall;
      out.push(`| ![](${r.icon}) | ${slot} | ${r.name} | ${r.archetype ?? "legacy"} | ${r.topStats.map((t) => `${t.name} ${t.value}`).join(" / ")} | ${r.score} |`);
    }
  }
  if (a.shard.length) {
    out.push(`**Armor to shard** (${a.shard.length})`);
    for (const r of a.shard) out.push(`- ![](${r.icon}) ${r.classType} ${r.slot}: ${r.name}, score ${r.score}: ${r.reasons.at(-1)}`);
  }
  return out.join("\n\n");
}

/** The interactive HTML report (see site.ts), saved under the reports folder. */
export async function writeHtml(w: WeaponReport, a: ArmorReport, o: ReportOptions): Promise<string> {
  return (await writeSite(w, a, o)).file;
}
