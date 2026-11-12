import { create } from 'zustand';
import { db } from './db';
import { setLang as applyLang, fmtCm } from './i18n';
import { autoLayout, DEFAULT_AUTO } from './lib/autolayout';
import { createItem, itemToModule, moduleDef, setCustomModules } from './lib/catalog';
import { bounds, ensureClockwise, findFreeSpot, getWalls, itemWall, rectRoom, uid } from './lib/geometry';
import { DEFAULT_FINISHES, DEFAULT_PRICES, DEFAULT_RULES } from './lib/materials';
import type { Finishes, Item, Lang, ModuleDef, Prices, Project, ProjectMeta, Room, Rules, Vec2 } from './types';

const HISTORY_LIMIT = 60;

export type Tab = 'plan' | '3d' | 'finishes' | 'costs' | 'drawings';

interface State {
  ready: boolean;
  lang: Lang;
  metas: ProjectMeta[];
  modules: ModuleDef[];
  defaults: { prices: Prices; rules: Rules };
  project: Project | null;
  selectedId: string | null;
  tab: Tab;
  past: Project[];
  future: Project[];
  toast: { msg: string; id: number } | null;

  init: () => Promise<void>;
  setLang: (l: Lang) => void;
  setTab: (t: Tab) => void;
  notify: (msg: string) => void;

  createProject: (name: string, points: Vec2[], height: number, sample?: boolean) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  closeProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  importProject: (json: string) => Promise<boolean>;

  /** Apply a change to the open project. history=false for intermediate drag updates. */
  commit: (fn: (p: Project) => Project, history?: boolean) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  select: (id: string | null) => void;
  addModule: (def: ModuleDef) => string | null;
  updateItem: (id: string, patch: Partial<Item>, history?: boolean) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  setRoom: (fn: (r: Room) => Room, history?: boolean) => void;
  setFinishes: (patch: Partial<Finishes>) => void;
  setPrices: (patch: Partial<Prices>) => void;
  setRules: (patch: Partial<Rules>) => void;
  saveDefaults: () => Promise<void>;
  saveThumb: (thumb: string) => void;

  saveCustomModule: (itemId: string, name: string) => Promise<void>;
  deleteCustomModule: (key: string) => Promise<void>;
}

export function metaOf(p: Project): ProjectMeta {
  const b = bounds(p.room.points);
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    thumb: p.thumb,
    itemCount: p.items.length,
    roomLabel: `${fmtCm(b.w)} × ${fmtCm(b.h)} × ${fmtCm(p.room.height)}`,
  };
}

/** Fill in fields added by newer versions so old saved projects keep working. */
export function normalizeProject(raw: Project): Project {
  const p = { ...raw };
  p.finishes = { ...DEFAULT_FINISHES, ...(raw.finishes ?? {}) };
  p.prices = {
    ...DEFAULT_PRICES,
    ...(raw.prices ?? {}),
    front: { ...DEFAULT_PRICES.front, ...(raw.prices?.front ?? {}) },
    countertop: { ...DEFAULT_PRICES.countertop, ...(raw.prices?.countertop ?? {}) },
  };
  p.rules = { ...DEFAULT_RULES, ...(raw.rules ?? {}) };
  const rr: Partial<Room> = raw.room ?? {};
  p.room = {
    height: rr.height ?? 280,
    wallThickness: rr.wallThickness ?? 12,
    openings: rr.openings ?? [],
    utilities: rr.utilities ?? [],
    columns: rr.columns ?? [],
    points: ensureClockwise(rr.points && rr.points.length >= 3 ? rr.points : rectRoom(400, 300)),
  };
  p.items = (raw.items ?? []).map((it) => ({ ...it, opts: it.opts ?? {} }));
  return p;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 0;

function scheduleSave(get: () => State) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const p = get().project;
    if (p) void db.putProject(p);
  }, 500);
}

async function flushSave(get: () => State) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const p = get().project;
  if (p) await db.putProject(p);
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  lang: 'ar',
  metas: [],
  modules: [],
  defaults: { prices: DEFAULT_PRICES, rules: DEFAULT_RULES },
  project: null,
  selectedId: null,
  tab: 'plan',
  past: [],
  future: [],
  toast: null,

  async init() {
    const [lang, projects, modules, defaults] = await Promise.all([
      db.getKV<Lang>('lang').catch(() => undefined),
      db.getProjects().catch(() => [] as Project[]),
      db.getModules().catch(() => [] as ModuleDef[]),
      db.getKV<{ prices: Prices; rules: Rules }>('defaults').catch(() => undefined),
    ]);
    const l = lang === 'en' ? 'en' : 'ar';
    applyLang(l);
    setCustomModules(modules);
    set({
      ready: true,
      lang: l,
      modules,
      metas: projects.map((p) => metaOf(normalizeProject(p))).sort((a, b) => b.updatedAt - a.updatedAt),
      defaults: defaults
        ? {
            prices: { ...DEFAULT_PRICES, ...defaults.prices, front: { ...DEFAULT_PRICES.front, ...defaults.prices?.front }, countertop: { ...DEFAULT_PRICES.countertop, ...defaults.prices?.countertop } },
            rules: { ...DEFAULT_RULES, ...defaults.rules },
          }
        : { prices: DEFAULT_PRICES, rules: DEFAULT_RULES },
    });
  },

  setLang(l) {
    applyLang(l);
    set({ lang: l });
    void db.setKV('lang', l);
  },
  setTab(t) {
    set({ tab: t });
  },
  notify(msg) {
    const id = ++toastId;
    set({ toast: { msg, id } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 2600);
  },

  async createProject(name, points, height, sample) {
    const now = Date.now();
    const { defaults } = get();
    const room: Room = { points: ensureClockwise(points), height, wallThickness: 12, openings: [], utilities: [], columns: [] };
    let items: Item[] = [];
    if (sample) {
      const walls = getWalls(room);
      // window on the first wall, door on the last one, services near the window
      const w0 = walls[0];
      const wl = walls[walls.length - 1];
      room.openings.push({ id: uid(), type: 'window', wall: 0, offset: Math.max(40, w0.len / 2 - 60), width: 120, height: 110, sill: 100 });
      room.openings.push({ id: uid(), type: 'door', wall: wl.i, offset: 20, width: 90, height: 210, sill: 0 });
      room.utilities.push({ id: uid(), type: 'water', wall: 0, offset: w0.len / 2 - 15, height: 55 });
      room.utilities.push({ id: uid(), type: 'drain', wall: 0, offset: w0.len / 2 + 15, height: 40 });
      room.utilities.push({ id: uid(), type: 'gas', wall: 1, offset: Math.min(walls[1].len - 60, 190), height: 60 });
      room.utilities.push({ id: uid(), type: 'electric', wall: 1, offset: Math.min(walls[1].len - 60, 190), height: 110 });
      items = autoLayout(room, { ...DEFAULT_AUTO, dishwasher: true }).items;
    }
    const p: Project = {
      id: uid(),
      name,
      createdAt: now,
      updatedAt: now,
      room,
      items,
      finishes: { ...DEFAULT_FINISHES },
      prices: JSON.parse(JSON.stringify(defaults.prices)),
      rules: { ...defaults.rules },
    };
    await db.putProject(p);
    set((s) => ({ project: p, metas: [metaOf(p), ...s.metas], selectedId: null, past: [], future: [], tab: 'plan' }));
  },

  async openProject(id) {
    const raw = await db.getProject(id);
    if (!raw) return;
    set({ project: normalizeProject(raw), selectedId: null, past: [], future: [], tab: 'plan' });
  },

  async closeProject() {
    await flushSave(get);
    const p = get().project;
    set((s) => ({
      project: null,
      selectedId: null,
      past: [],
      future: [],
      metas: p ? [metaOf(p), ...s.metas.filter((m) => m.id !== p.id)].sort((a, b) => b.updatedAt - a.updatedAt) : s.metas,
    }));
  },

  async deleteProject(id) {
    await db.deleteProject(id);
    set((s) => ({ metas: s.metas.filter((m) => m.id !== id) }));
  },

  async duplicateProject(id) {
    const raw = await db.getProject(id);
    if (!raw) return;
    const now = Date.now();
    const copy: Project = { ...JSON.parse(JSON.stringify(raw)), id: uid(), name: raw.name + (get().lang === 'ar' ? ' (نسخة)' : ' (copy)'), createdAt: now, updatedAt: now };
    await db.putProject(copy);
    set((s) => ({ metas: [metaOf(normalizeProject(copy)), ...s.metas] }));
  },

  async renameProject(id, name) {
    const open = get().project;
    if (open && open.id === id) {
      get().commit((p) => ({ ...p, name }), false);
      await flushSave(get);
    } else {
      const raw = await db.getProject(id);
      if (!raw) return;
      await db.putProject({ ...raw, name, updatedAt: Date.now() });
    }
    set((s) => ({ metas: s.metas.map((m) => (m.id === id ? { ...m, name } : m)) }));
  },

  async importProject(json) {
    try {
      const raw = JSON.parse(json);
      const src = raw && raw.kitchenStudio && raw.project ? raw.project : raw;
      if (!src || !src.room || !Array.isArray(src.room.points)) return false;
      const now = Date.now();
      const p = normalizeProject({ ...src, id: uid(), createdAt: src.createdAt ?? now, updatedAt: now });
      await db.putProject(p);
      set((s) => ({ metas: [metaOf(p), ...s.metas] }));
      return true;
    } catch {
      return false;
    }
  },

  commit(fn, history = true) {
    const cur = get().project;
    if (!cur) return;
    const next = { ...fn(cur), updatedAt: Date.now() };
    set((s) => ({
      project: next,
      past: history ? [...s.past.slice(-HISTORY_LIMIT + 1), cur] : s.past,
      future: history ? [] : s.future,
    }));
    scheduleSave(get);
  },
  pushHistory() {
    const cur = get().project;
    if (!cur) return;
    set((s) => ({ past: [...s.past.slice(-HISTORY_LIMIT + 1), cur], future: [] }));
  },
  undo() {
    const { past, project, future } = get();
    if (!past.length || !project) return;
    const prev = past[past.length - 1];
    set({ project: { ...prev, thumb: project.thumb, updatedAt: Date.now() }, past: past.slice(0, -1), future: [project, ...future].slice(0, HISTORY_LIMIT), selectedId: null });
    scheduleSave(get);
  },
  redo() {
    const { past, project, future } = get();
    if (!future.length || !project) return;
    const next = future[0];
    set({ project: { ...next, thumb: project.thumb, updatedAt: Date.now() }, past: [...past, project], future: future.slice(1), selectedId: null });
    scheduleSave(get);
  },

  select(id) {
    set({ selectedId: id });
  },

  addModule(def) {
    const p = get().project;
    if (!p) return null;
    const probe = { w: def.w, d: def.d, elev: def.elev, h: def.h };
    // prefer the wall of the selected item, right after it
    let preferWall: number | undefined;
    let preferAfter: number | undefined;
    const sel = p.items.find((i) => i.id === get().selectedId);
    if (sel) {
      const att = itemWall(sel, getWalls(p.room));
      if (att) {
        preferWall = att.wall.i;
        preferAfter = att.t1;
      }
    }
    let at = def.opts.island ? null : findFreeSpot(p.room, p.items, probe, preferWall, preferAfter);
    if (!at) {
      const b = bounds(p.room.points);
      at = { x: Math.round(b.cx), y: Math.round(b.cy), rot: 0 };
    }
    const it = createItem(def, at);
    get().commit((pr) => ({ ...pr, items: [...pr.items, it] }));
    set({ selectedId: it.id });
    return it.id;
  },

  updateItem(id, patch, history = true) {
    get().commit((p) => ({ ...p, items: p.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }), history);
  },
  removeItem(id) {
    get().commit((p) => ({ ...p, items: p.items.filter((it) => it.id !== id) }));
    if (get().selectedId === id) set({ selectedId: null });
  },
  duplicateItem(id) {
    const p = get().project;
    const src = p?.items.find((i) => i.id === id);
    if (!p || !src) return;
    const copy: Item = { ...JSON.parse(JSON.stringify(src)), id: uid() };
    const att = itemWall(src, getWalls(p.room));
    const spot = findFreeSpot(p.room, p.items, { w: src.w, d: src.d, elev: src.elev, h: src.h }, att?.wall.i, att?.t1);
    if (spot) Object.assign(copy, spot);
    else {
      copy.x += 20;
      copy.y += 20;
    }
    get().commit((pr) => ({ ...pr, items: [...pr.items, copy] }));
    set({ selectedId: copy.id });
  },

  setRoom(fn, history = true) {
    get().commit((p) => ({ ...p, room: fn(p.room) }), history);
  },
  setFinishes(patch) {
    get().commit((p) => ({ ...p, finishes: { ...p.finishes, ...patch } }));
  },
  setPrices(patch) {
    get().commit((p) => ({ ...p, prices: { ...p.prices, ...patch } }), false);
  },
  setRules(patch) {
    get().commit((p) => ({ ...p, rules: { ...p.rules, ...patch } }));
  },
  async saveDefaults() {
    const p = get().project;
    if (!p) return;
    const defaults = { prices: JSON.parse(JSON.stringify(p.prices)), rules: { ...p.rules } };
    set({ defaults });
    await db.setKV('defaults', defaults);
  },
  saveThumb(thumb) {
    const cur = get().project;
    if (!cur) return;
    set({ project: { ...cur, thumb } });
    scheduleSave(get);
  },

  async saveCustomModule(itemId, name) {
    const it = get().project?.items.find((i) => i.id === itemId);
    if (!it) return;
    const mod = itemToModule(it, name);
    await db.putModule(mod);
    const modules = [...get().modules, mod];
    setCustomModules(modules);
    set({ modules });
  },
  async deleteCustomModule(key) {
    await db.deleteModule(key);
    const modules = get().modules.filter((m) => m.key !== key);
    setCustomModules(modules);
    set({ modules });
  },
}));

export { moduleDef };
