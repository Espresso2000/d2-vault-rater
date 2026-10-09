/** Saved builds, kept like the rater's other files (IndexedDB through the config shim). */
import { paths, readJson, writeJson } from "../shims/config";
import type { Build } from "./model";

const FILE = `${paths.home}/builds.json`;

export const loadBuilds = (): Build[] => readJson<Build[]>(FILE, []);
export const saveBuilds = (list: Build[]) => writeJson(FILE, list);
