/**
 * Browser version of src/config.ts. The rater's JSON "files" (settings, sources, plans, undo snapshots)
 * live in memory and are saved to IndexedDB, so sync readJson/writeJson keep working unchanged.
 * Call hydrate() once at startup to load what earlier visits saved.
 */
import { appConfig, redirectUrl } from "../appConfig";
import { idbDel, idbEntries, idbSet } from "../idb";

export const HOME = "/vr";

export const paths = {
  home: HOME,
  tokens: `${HOME}/tokens.json`,
  settings: `${HOME}/settings.json`,
  manifestDir: `${HOME}/manifest`,
  sourcesDir: `${HOME}/sources`,
  snapshotsDir: `${HOME}/snapshots`,
  plansDir: `${HOME}/plans`,
  reportsDir: `${HOME}/reports`,
};

const mem = new Map<string, unknown>();
/** Paths kept only for this visit (plans are re-made every rating; reports are not files here). */
const volatile = (file: string) => file.startsWith(paths.reportsDir) || file.endsWith(".csv");

export async function hydrate(): Promise<void> {
  const saved = await idbEntries("file:");
  // Every rating saves a lock plan; only plans that were applied (they have an undo snapshot) are
  // ever read again. The rest are deleted rather than loaded on every visit from now on.
  const applied = new Set(saved.map(([k]) => k.slice(5)).filter((f) => f.startsWith(`${paths.snapshotsDir}/`)).map((f) => f.slice(paths.snapshotsDir.length)));
  for (const [k, value] of saved) {
    const file = k.slice(5);
    if (file.startsWith(`${paths.plansDir}/`) && !applied.has(file.slice(paths.plansDir.length))) void idbDel(k).catch(() => {});
    else mem.set(file, value);
  }
}

export function ensureDirs(): void {}

export function bungieEnv() {
  const c = appConfig();
  if (!c.bungieApiKey) throw new Error("This site has no Bungie API key configured yet.");
  return { apiKey: c.bungieApiKey, clientId: c.bungieClientId, clientSecret: "", redirectUrl: redirectUrl() };
}

export function readJson<T>(file: string, fallback: T): T {
  return mem.has(file) ? (mem.get(file) as T) : fallback;
}

/** Files already live parsed in memory here, so the cached read is the plain one. */
export const readJsonCached = readJson;

export function writeText(file: string, text: string): void {
  mem.set(file, text);
  if (!volatile(file)) void idbSet("file:" + file, text);
}

export function writeJson(file: string, value: unknown): void {
  mem.set(file, value);
  if (!volatile(file)) void idbSet("file:" + file, value);
}

/** The text of a file written this visit (e.g. the DIM tags CSV). */
export const readText = (file: string): string | null => (typeof mem.get(file) === "string" ? (mem.get(file) as string) : null);
