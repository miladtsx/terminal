const DB_NAME = "terminal-history";
const STORE_NAME = "commands";
const KEY = "entries";
const VERSION = 1;
const MAX_ENTRIES = 1000;

let memoryFallback: string[] = [];

function hasIndexedDb(): boolean {
    return typeof indexedDB !== "undefined";
}

async function openDb(): Promise<IDBDatabase | null> {
    if (!hasIndexedDb()) return null;

    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

function wrapRequest<T>(request: IDBRequest<T>): Promise<T | null> {
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => resolve(null);
    });
}

async function readEntries(db: IDBDatabase): Promise<string[]> {
    try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const result = await wrapRequest<string[] | undefined>(store.get(KEY));
        return Array.isArray(result) ? result : [];
    } catch (error) {
        console.error("history read failed", error);
        return [];
    }
}

async function writeEntries(db: IDBDatabase, entries: string[]): Promise<void> {
    try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(entries, KEY);
        await new Promise<void>((resolve) => {
            tx.oncomplete = () => resolve();
            tx.onabort = () => resolve();
            tx.onerror = () => resolve();
        });
    } catch (error) {
        console.error("history write failed", error);
    }
}

export async function loadHistory(): Promise<string[]> {
    const db = await openDb();
    if (!db) return [...memoryFallback];
    const entries = await readEntries(db);
    memoryFallback = [...entries];
    return entries;
}

export async function appendHistory(command: string): Promise<void> {
    const trimmed = (command || "").trim();
    if (!trimmed) return;

    const db = await openDb();
    if (!db) {
        const last = memoryFallback[memoryFallback.length - 1];
        if (last !== trimmed) {
            memoryFallback.push(trimmed);
            if (memoryFallback.length > MAX_ENTRIES) memoryFallback.shift();
        }
        return;
    }

    const entries = await readEntries(db);
    const last = entries[entries.length - 1];
    if (last !== trimmed) {
        entries.push(trimmed);
        if (entries.length > MAX_ENTRIES) entries.shift();
        memoryFallback = [...entries];
        await writeEntries(db, entries);
    }
}

export async function clearPersistedHistory(): Promise<void> {
    const db = await openDb();
    memoryFallback = [];
    if (!db) return;
    await writeEntries(db, []);
}
