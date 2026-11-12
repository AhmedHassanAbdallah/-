import type { ModuleDef, Project } from './types';

/** Tiny promise wrapper over IndexedDB with an in-memory fallback (private mode, old WebViews). */
const DB_NAME = 'kitchen-studio';
const VERSION = 1;
type StoreName = 'projects' | 'modules' | 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory: Record<StoreName, Map<string, unknown>> = { projects: new Map(), modules: new Map(), kv: new Map() };

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('modules')) d.createObjectStore('modules', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then(
    (d) =>
      new Promise<T | undefined>((resolve, reject) => {
        if (!d) return resolve(undefined);
        try {
          const tx = d.transaction(store, mode);
          const req = fn(tx.objectStore(store));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } catch (e) {
          reject(e);
        }
      }),
  );
}

async function hasDb(): Promise<boolean> {
  return (await open()) !== null;
}

export const db = {
  async getProjects(): Promise<Project[]> {
    if (!(await hasDb())) return [...memory.projects.values()] as Project[];
    return ((await run<Project[]>('projects', 'readonly', (s) => s.getAll())) ?? []) as Project[];
  },
  async getProject(id: string): Promise<Project | undefined> {
    if (!(await hasDb())) return memory.projects.get(id) as Project | undefined;
    return (await run<Project>('projects', 'readonly', (s) => s.get(id))) as Project | undefined;
  },
  async putProject(p: Project): Promise<void> {
    if (!(await hasDb())) {
      memory.projects.set(p.id, p);
      return;
    }
    await run('projects', 'readwrite', (s) => s.put(p));
  },
  async deleteProject(id: string): Promise<void> {
    if (!(await hasDb())) {
      memory.projects.delete(id);
      return;
    }
    await run('projects', 'readwrite', (s) => s.delete(id));
  },
  async getModules(): Promise<ModuleDef[]> {
    if (!(await hasDb())) return [...memory.modules.values()] as ModuleDef[];
    return ((await run<ModuleDef[]>('modules', 'readonly', (s) => s.getAll())) ?? []) as ModuleDef[];
  },
  async putModule(m: ModuleDef): Promise<void> {
    if (!(await hasDb())) {
      memory.modules.set(m.key, m);
      return;
    }
    await run('modules', 'readwrite', (s) => s.put(m));
  },
  async deleteModule(key: string): Promise<void> {
    if (!(await hasDb())) {
      memory.modules.delete(key);
      return;
    }
    await run('modules', 'readwrite', (s) => s.delete(key));
  },
  async getKV<T>(key: string): Promise<T | undefined> {
    if (!(await hasDb())) return memory.kv.get(key) as T | undefined;
    return (await run<T>('kv', 'readonly', (s) => s.get(key))) as T | undefined;
  },
  async setKV(key: string, value: unknown): Promise<void> {
    if (!(await hasDb())) {
      memory.kv.set(key, value);
      return;
    }
    await run('kv', 'readwrite', (s) => s.put(value, key));
  },
};
