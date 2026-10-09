export const DIM_API = "https://api.destinyitemmanager.com";
export const DIM_TAGS = ["favorite", "keep", "infuse", "junk", "archive"];
/** Read your DIM tags/notes and/or loadouts. */
export async function readDimProfile(call, who, want) {
    const components = [want.tags && "tags", want.loadouts && "loadouts"].filter(Boolean).join(",");
    const out = { tags: {}, loadouts: [], fetchedAt: new Date().toISOString() };
    if (!components)
        return out;
    const r = await call(`/profile?platformMembershipId=${(await who()).membershipId}&destinyVersion=2&components=${components}`);
    for (const t of r.tags ?? [])
        if (t.tag || t.notes)
            out.tags[t.id] = { tag: t.tag ?? null, notes: t.notes ?? null };
    out.loadouts = (r.loadouts ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        classType: l.classType,
        itemIds: [...(l.equipped ?? []), ...(l.unequipped ?? [])].map((i) => i.id).filter((x) => !!x && x !== "0"),
    }));
    return out;
}
/** Instance ids tagged Favorite or Keep, which the rater then never marks for sharding. */
export const keepIds = (d) => Object.entries(d?.tags ?? {}).filter(([, t]) => t.tag === "favorite" || t.tag === "keep").map(([id]) => id);
/** Settings for one rating run: items tagged Favorite or Keep in DIM are protected (setting dim.protectTagged). */
export const withDimKeep = (s, d) => ({ ...s, dimKeep: s.dim.tags && s.dim.protectTagged ? keepIds(d) : [] });
/** Set (or clear, with tag null) one item's DIM tag, keeping or replacing its notes. */
export async function writeDimTag(call, who, itemId, tag, notes) {
    const payload = { id: itemId, tag };
    if (notes !== undefined)
        payload.notes = notes;
    const r = await call("/profile", {
        platformMembershipId: (await who()).membershipId,
        destinyVersion: 2,
        updates: [{ action: "tag", payload }],
    });
    const res = r.results?.[0];
    if (res && res.status !== "Success")
        throw new Error(`DIM rejected the tag: ${res.message ?? res.status}`);
}
//# sourceMappingURL=common.js.map