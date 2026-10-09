/** A tiny promise wrapper around one IndexedDB object store (key -> structured-cloneable value). */
const DB = "vault-rater";
const STORE = "kv";

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  }));
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((ok, fail) => {
        const req = fn(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => ok(req.result as T);
        req.onerror = () => fail(req.error);
      }),
  );
}

export const idbGet = <T>(key: string) => run<T | undefined>("readonly", (s) => s.get(key));
export const idbSet = (key: string, value: unknown) => run<void>("readwrite", (s) => s.put(value, key));
export const idbDel = (key: string) => run<void>("readwrite", (s) => s.delete(key));

/** Every [key, value] whose key starts with `prefix`, in one transaction. */
export function idbEntries(prefix: string): Promise<[string, unknown][]> {
  return db().then(
    (d) =>
      new Promise((ok, fail) => {
        const s = d.transaction(STORE).objectStore(STORE);
        const range = IDBKeyRange.bound(prefix, prefix + "\uffff");
        const keys = s.getAllKeys(range);
        const values = s.getAll(range);
        // Requests in one transaction finish in order, so the keys are there when the values arrive.
        values.onsuccess = () => ok((keys.result as string[]).map((k, i) => [k, values.result[i]]));
        keys.onerror = values.onerror = () => fail(keys.error ?? values.error);
      }),
  );
}
