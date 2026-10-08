import { join } from "node:path";
import { paths, readJson, writeJson } from "../config.js";

export const DEFAULT_WISHLISTS = [
  "https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt",
];

export interface WishRoll {
  itemHash: number; // 69420 = any item
  perks: number[];
  trash: boolean;
  notes: string;
}

export interface WishlistData {
  importedAt: string;
  sources: string[];
  rolls: WishRoll[];
}

export const wishlistFile = () => join(paths.sourcesDir, "wishlists.json");

/** Parse DIM wishlist text: `dimwishlist:item=<hash>&perks=<h>,<h>#notes:...`; a negative item is a trash roll. */
export function parseWishlist(text: string): WishRoll[] {
  const out: WishRoll[] = [];
  let blockNotes = "";
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("//notes:")) blockNotes = t.slice(8).trim();
    else if (t === "") blockNotes = "";
    const m = t.match(/^dimwishlist:item=(-?\d+)(?:&perks=([\d,]*))?(?:#notes:(.*))?/);
    if (!m) continue;
    const item = parseInt(m[1], 10);
    out.push({
      itemHash: Math.abs(item),
      trash: item < 0,
      perks: (m[2] ?? "").split(",").filter(Boolean).map(Number),
      notes: (m[3] ?? blockNotes).trim(),
    });
  }
  return out;
}

export async function importWishlists(urls: string[] = DEFAULT_WISHLISTS): Promise<WishlistData> {
  const rolls: WishRoll[] = [];
  for (const u of urls) {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`Wishlist ${u} -> ${res.status}`);
    // A loop, not push(...rows): ~275k rolls overflow the call stack as spread arguments.
    for (const roll of parseWishlist(await res.text())) rolls.push(roll);
  }
  const data = { importedAt: new Date().toISOString(), sources: urls, rolls };
  writeJson(wishlistFile(), data);
  return data;
}

export function loadWishlists(): WishlistData | null {
  return readJson<WishlistData | null>(wishlistFile(), null);
}
