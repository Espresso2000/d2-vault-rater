/**
 * Browser stand-ins for the few node:* functions the shared rater code calls.
 * Files live in memory (`files`); the web app registers manifest tables here so
 * src/sources/activities.ts can read them as if they were on disk.
 */
export const files = new Map<string, string>();

// node:fs
export const existsSync = (p: string) => files.has(p);
export const mkdirSync = () => undefined;
export const readFileSync = (p: string): string => {
  const f = files.get(p);
  if (f === undefined) throw new Error(`No file ${p}`);
  return f;
};
export const writeFileSync = (p: string, data: string) => void files.set(p, String(data));

// node:path
export const join = (...parts: string[]) => parts.filter(Boolean).join("/").replace(/\/+/g, "/");
export const dirname = (p: string) => p.replace(/\/[^/]*$/, "") || "/";
export const basename = (p: string) => p.replace(/^.*\//, "");
export const extname = (p: string) => /\.[^./]*$/.exec(p)?.[0] ?? "";

// node:os
export const homedir = () => "/home";
export const tmpdir = () => "/tmp";

// node:crypto
export const randomBytes = (n: number) => {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return { toString: () => [...b].map((x) => x.toString(16).padStart(2, "0")).join("") };
};

// node:url
export const fileURLToPath = (u: string) => u;

export default { existsSync, mkdirSync, readFileSync, writeFileSync, join, dirname, basename, extname, homedir, tmpdir, randomBytes, fileURLToPath };
