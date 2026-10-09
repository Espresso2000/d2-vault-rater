/** Items grouped by key, each group in input order (Map.groupBy, which Node 20 doesn't have yet). */
export function groupBy(items, key) {
    const out = new Map();
    for (const item of items) {
        const k = key(item);
        const list = out.get(k);
        if (list)
            list.push(item);
        else
            out.set(k, [item]);
    }
    return out;
}
//# sourceMappingURL=util.js.map