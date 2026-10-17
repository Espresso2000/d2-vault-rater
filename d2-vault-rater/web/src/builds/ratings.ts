/** Fetches and caches the Builds tab's sheets, refreshing once a day like the rater's other sources. */
import { paths, readJson, writeJson } from "../shims/config";
import { gvizCsvUrl } from "../../../src/sources/csv.js";
import { AEGIS_ID, AEGIS_TABS, CLARITY_URL, COMPENDIUM_ID, COMPENDIUM_TABS, parseClarity, parseInfoTab, parseRatedTab, parseSubclassTab, type BuildRatings, type ClarityJson } from "./sheets";

const FILE = `${paths.sourcesDir}/build-ratings.json`;
const text = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.text();
};

export const cachedRatings = () => readJson<BuildRatings | null>(FILE, null);

export async function loadRatings(force = false): Promise<BuildRatings | null> {
  const prev = cachedRatings();
  if (!force && prev && Date.now() - Date.parse(prev.importedAt) < 24 * 3_600_000) return prev;
  const warnings: string[] = [];
  const get = (sheet: string, gid: string, what: string) => text(gvizCsvUrl(sheet, gid)).catch((e) => (warnings.push(`${what}: ${(e as Error).message}`), ""));
  const [aspects, fragments, subclasses, ...info] = await Promise.all([
    get(AEGIS_ID, AEGIS_TABS.aspects, "Aegis aspects"),
    get(AEGIS_ID, AEGIS_TABS.fragments, "Aegis fragments"),
    get(AEGIS_ID, AEGIS_TABS.subclasses, "Aegis subclasses"),
    ...COMPENDIUM_TABS.map((g) => get(COMPENDIUM_ID, g, `Data Compendium tab ${g}`)),
  ]);
  const next: BuildRatings = {
    importedAt: new Date().toISOString(),
    aspects: parseRatedTab(aspects),
    fragments: parseRatedTab(fragments),
    subclasses: parseSubclassTab(subclasses),
    info: info.reduce((acc, csv) => parseInfoTab(csv, acc), {} as Record<string, string>),
    warnings,
  };
  // A failed refresh keeps yesterday's data rather than blanking every badge.
  if (!Object.keys(next.aspects).length && prev) return { ...prev, warnings };
  writeJson(FILE, next);
  return next;
}

/* ---------- Destiny Clarity ---------- */

const CLARITY_FILE = `${paths.sourcesDir}/clarity.json`;
interface ClarityCache {
  importedAt: string;
  /** plug hash -> paragraphs */
  text: Record<number, string[]>;
}

export const cachedClarity = () => readJson<ClarityCache | null>(CLARITY_FILE, null)?.text ?? {};

/** Clarity's notes on the tab's plugs (abilities, aspects, fragments, mods), refreshed daily; a failed refresh keeps the old copy. */
export async function loadClarity(known: (hash: number) => boolean): Promise<Record<number, string[]>> {
  const prev = readJson<ClarityCache | null>(CLARITY_FILE, null);
  if (prev && Date.now() - Date.parse(prev.importedAt) < 24 * 3_600_000) return prev.text;
  try {
    const text = parseClarity((await (await fetch(CLARITY_URL)).json()) as ClarityJson, known);
    writeJson(CLARITY_FILE, { importedAt: new Date().toISOString(), text });
    return text;
  } catch (e) {
    console.warn("Builds: couldn't read Destiny Clarity", e);
    return prev?.text ?? {};
  }
}
