import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";

export const HOME = process.env.VAULT_RATER_HOME || join(homedir(), ".d2-vault-rater");

export const paths = {
  home: HOME,
  tokens: join(HOME, "tokens.json"),
  settings: join(HOME, "settings.json"),
  manifestDir: join(HOME, "manifest"),
  sourcesDir: join(HOME, "sources"),
  snapshotsDir: join(HOME, "snapshots"),
  plansDir: join(HOME, "plans"),
  reportsDir: join(HOME, "reports"),
};

export function ensureDirs(): void {
  for (const p of [paths.home, paths.manifestDir, paths.sourcesDir, paths.snapshotsDir, paths.plansDir, paths.reportsDir]) {
    mkdirSync(p, { recursive: true });
  }
}

export function bungieEnv() {
  const apiKey = process.env.BUNGIE_API_KEY;
  if (!apiKey) throw new Error("BUNGIE_API_KEY is not set. Create an app at https://www.bungie.net/en/Application and set it in the MCP server's env.");
  return {
    apiKey,
    clientId: process.env.BUNGIE_CLIENT_ID ?? "",
    clientSecret: process.env.BUNGIE_CLIENT_SECRET ?? "",
    redirectUrl: process.env.BUNGIE_REDIRECT_URL ?? "https://localhost:7777/callback",
  };
}

export function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

const parsed = new Map<string, { stamp: string; value: unknown }>();

/**
 * readJson for the big source files (Aegis, wishlists, armor sets, raid loot): parsed once, then
 * reused until the file changes. Callers must not modify what it returns.
 */
export function readJsonCached<T>(file: string, fallback: T): T {
  const st = statSync(file, { throwIfNoEntry: false });
  if (!st) return fallback;
  const stamp = `${st.mtimeMs}:${st.size}`;
  const hit = parsed.get(file);
  if (hit?.stamp === stamp) return hit.value as T;
  const value = readJson(file, fallback);
  parsed.set(file, { stamp, value });
  return value;
}

export function writeText(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  parsed.delete(file);
}

export function writeJson(file: string, value: unknown): void {
  writeText(file, JSON.stringify(value, null, 2));
}
