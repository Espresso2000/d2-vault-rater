/**
 * Data tied to a game version (the stripped item database, the Builds tab's definitions): from
 * IndexedDB when this version was seen before, else from the snapshot shipped with the site (fast,
 * phone friendly) when it matches the live version, else built in a Web Worker from bungie.net
 * (needed once after each game patch). A new version replaces the cached copy.
 */
import { bungie } from "./shims/client";
import { versionSlug } from "./shims/manifest";
import { idbGet, idbSet } from "./idb";

export interface ManifestMeta {
  version: string;
  jsonWorldComponentContentPaths: Record<string, Record<string, string>>;
}

let meta: Promise<ManifestMeta> | null = null;

/** Bungie's manifest index (live version and table paths), asked once per visit. */
export function manifestMeta(): Promise<ManifestMeta> {
  meta ??= bungie<ManifestMeta>("/Destiny2/Manifest/", { auth: false });
  meta.catch(() => (meta = null));
  return meta;
}

export interface VersionedSource {
  /** IndexedDB key of the cached copy. */
  key: string;
  /** Snapshot file prefix: data/<snapshot>-<version>.json */
  snapshot: string;
  /** The worker that builds the data; it posts {progress}, then {result} or {error}. */
  worker: () => Worker;
  log: (s: string) => void;
  messages: { snapshot?: string; download: string; workerFailed: string };
}

export async function loadVersioned<T extends { version: string }>(src: VersionedSource): Promise<T> {
  const { version, jsonWorldComponentContentPaths } = await manifestMeta();
  const cached = await idbGet<T>(src.key).catch(() => undefined);
  if (cached?.version === version) return cached;
  let data: T | undefined;
  try {
    const res = await fetch(`data/${src.snapshot}-${versionSlug(version)}.json`);
    if (res.ok && res.headers.get("content-type")?.includes("json")) {
      if (src.messages.snapshot) src.log(src.messages.snapshot);
      const snap = (await res.json()) as T;
      if (snap.version === version) data = snap;
    }
  } catch {}
  if (!data) {
    src.log(src.messages.download);
    data = await new Promise<T>((ok, fail) => {
      const w = src.worker();
      w.onmessage = (e) => {
        if (e.data.progress) src.log(e.data.progress);
        if (e.data.error) (w.terminate(), fail(new Error(e.data.error)));
        if (e.data.result) (w.terminate(), ok(e.data.result));
      };
      w.onerror = (e) => (w.terminate(), fail(new Error(e.message || src.messages.workerFailed)));
      w.postMessage({ version, paths: jsonWorldComponentContentPaths.en });
    });
  }
  await idbSet(src.key, data).catch(() => {});
  return data;
}
