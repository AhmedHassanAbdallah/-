import type { Category, Item, ItemOptions, LText, ModuleDef, Section } from '../types';
import { uid } from './geometry';

// Standard dimensions (cm)
export const BASE_H = 82; // carcass 72 + plinth 10
export const BASE_D = 58; // carcass 56 + front 2 (countertop adds the overhang)
export const WALL_H = 72;
export const WALL_D = 34;
export const WALL_ELEV = 146; // 86 worktop + 60 splash
export const TALL_H = 218; // lines up with the top of the wall units
export const TALL_D = 58;

export const STD_WIDTHS = [15, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 120];

export const GROUPS: { id: string; cat: Category; name: LText }[] = [
  { id: 'base', cat: 'base', name: { ar: 'وحدات سفلية', en: 'Base units' } },
  { id: 'drawers', cat: 'base', name: { ar: 'أدراج وتخزين', en: 'Drawers & storage' } },
  { id: 'corner', cat: 'base', name: { ar: 'أركان وجزيرة', en: 'Corners & island' } },
  { id: 'wall', cat: 'wall', name: { ar: 'وحدات علوية', en: 'Wall units' } },
  { id: 'tall', cat: 'tall', name: { ar: 'أعمدة (دواليب طويلة)', en: 'Tall units' } },
  { id: 'appliance', cat: 'appliance', name: { ar: 'أجهزة', en: 'Appliances' } },
];

const door = (n = 1, h = 0): Section => ({ kind: 'door', h, n });
const drawer = (h = 0): Section => ({ kind: 'drawer', h });

function base(key: string, group: string, name: LText, w: number, minW: number, maxW: number, opts: ItemOptions, extra: Partial<ModuleDef> = {}): ModuleDef {
  return { key, cat: 'base', group, name, w, d: BASE_D, h: BASE_H, elev: 0, minW, maxW, opts: { countertop: true, ...opts }, ...extra };
}
function wall(key: string, name: LText, w: number, minW: number, maxW: number, opts: ItemOptions, extra: Partial<ModuleDef> = {}): ModuleDef {
  return { key, cat: 'wall', group: 'wall', name, w, d: WALL_D, h: WALL_H, elev: WALL_ELEV, minW, maxW, opts, ...extra };
}
function tall(key: string, name: LText, w: number, minW: number, maxW: number, opts: ItemOptions, extra: Partial<ModuleDef> = {}): ModuleDef {
  return { key, cat: 'tall', group: 'tall', name, w, d: TALL_D, h: TALL_H, elev: 0, minW, maxW, opts, ...extra };
}

export const CATALOG: ModuleDef[] = [
  // ---- Base ----
  base('base_1d', 'base', { ar: 'سفلية ضلفة واحدة', en: 'Base, 1 door' }, 45, 25, 60, { sections: [door(1)], shelves: 1, hinge: 'L' }),
  base('base_2d', 'base', { ar: 'سفلية ضلفتين', en: 'Base, 2 doors' }, 80, 60, 120, { sections: [door(2)], shelves: 1 }),
  base('base_1dr1d', 'base', { ar: 'سفلية درج + ضلفة', en: 'Base, drawer + door' }, 45, 30, 60, { sections: [drawer(14), door(1)], shelves: 1, hinge: 'L' }),
  base('base_1dr2d', 'base', { ar: 'سفلية درج + ضلفتين', en: 'Base, drawer + 2 doors' }, 80, 60, 120, { sections: [drawer(14), door(2)], shelves: 1 }),
  base('base_sink', 'base', { ar: 'وحدة حوض', en: 'Sink unit' }, 80, 50, 120, { sections: [door(2)], shelves: 0, sink: 'single' }),
  base('base_sink2', 'base', { ar: 'وحدة حوض مزدوج', en: 'Double sink unit' }, 100, 80, 140, { sections: [door(2)], shelves: 0, sink: 'double' }),
  base('base_hob', 'base', { ar: 'وحدة مسطح بوتاجاز', en: 'Hob unit' }, 60, 60, 100, { sections: [drawer(14), drawer(0), drawer(0)], shelves: 0, cooktop: 'gas' }),
  base('base_oven', 'base', { ar: 'وحدة فرن بلت إن + مسطح', en: 'Built-in oven + hob' }, 60, 60, 90, { sections: [{ kind: 'oven', h: 60 }, drawer(0)], shelves: 0, cooktop: 'gas' }),
  base('base_open', 'base', { ar: 'سفلية أرفف مفتوحة', en: 'Open shelf base' }, 30, 15, 60, { sections: [{ kind: 'open', h: 0 }], shelves: 2 }),
  base('base_filler', 'base', { ar: 'حشوة / فيلر', en: 'Filler strip' }, 5, 2, 20, { sections: [{ kind: 'panel', h: 0 }], filler: true }),
  // ---- Drawers & storage ----
  base('base_3dr', 'drawers', { ar: 'وحدة 3 أدراج', en: '3-drawer unit' }, 60, 30, 100, { sections: [drawer(14), drawer(0), drawer(0)], shelves: 0 }),
  base('base_4dr', 'drawers', { ar: 'وحدة 4 أدراج', en: '4-drawer unit' }, 50, 30, 90, { sections: [drawer(0), drawer(0), drawer(0), drawer(0)], shelves: 0 }),
  base('base_2dr', 'drawers', { ar: 'وحدة درجين عميقين (حلل)', en: '2 deep pan drawers' }, 90, 40, 120, { sections: [drawer(0), drawer(0)], shelves: 0 }),
  base('base_pullout', 'drawers', { ar: 'سحّابة زجاجات', en: 'Bottle pull-out' }, 20, 15, 30, { sections: [drawer(0)], shelves: 0 }),
  // ---- Corners & island ----
  base('base_corner', 'corner', { ar: 'ركنة سفلية (عمياء)', en: 'Blind corner base' }, 100, 80, 130, { sections: [door(1)], shelves: 1, blind: 'L', blindW: 55, hinge: 'L' }),
  base('island', 'corner', { ar: 'جزيرة', en: 'Island' }, 160, 90, 300, { sections: [drawer(14), door(4)], shelves: 1, island: true }, { d: 90 }),
  base('bar', 'corner', { ar: 'بار إفطار', en: 'Breakfast bar' }, 140, 80, 300, { sections: [{ kind: 'panel', h: 0 }], shelves: 0, island: true }, { d: 45, h: 100 }),
  // ---- Wall ----
  wall('wall_1d', { ar: 'علوية ضلفة واحدة', en: 'Wall, 1 door' }, 45, 25, 60, { sections: [door(1)], shelves: 1, hinge: 'L' }),
  wall('wall_2d', { ar: 'علوية ضلفتين', en: 'Wall, 2 doors' }, 80, 60, 120, { sections: [door(2)], shelves: 1 }),
  wall('wall_flap', { ar: 'علوية قلاب', en: 'Wall, lift-up flap' }, 80, 40, 120, { sections: [{ kind: 'flap', h: 0 }], shelves: 0 }, { h: 36, elev: WALL_ELEV + 36 }),
  wall('wall_2flap', { ar: 'علوية قلابين', en: 'Wall, 2 flaps' }, 80, 40, 120, { sections: [{ kind: 'flap', h: 0 }, { kind: 'flap', h: 0 }], shelves: 0 }),
  wall('wall_glass', { ar: 'علوية زجاج', en: 'Wall, glass doors' }, 80, 30, 120, { sections: [{ kind: 'glass', h: 0, n: 2 }], shelves: 2 }),
  wall('wall_open', { ar: 'علوية أرفف مفتوحة', en: 'Open wall shelf' }, 40, 15, 120, { sections: [{ kind: 'open', h: 0 }], shelves: 1 }),
  wall('wall_hood', { ar: 'علوية شفاط مدمج', en: 'Built-in hood unit' }, 60, 60, 90, { sections: [door(1)], shelves: 0, hood: true, hinge: 'L' }),
  wall('wall_micro', { ar: 'علوية ميكروويف', en: 'Microwave wall unit' }, 60, 55, 70, { sections: [{ kind: 'flap', h: 0 }, { kind: 'micro', h: 38 }], shelves: 0 }),
  wall('wall_corner', { ar: 'ركنة علوية (عمياء)', en: 'Blind corner wall' }, 70, 60, 100, { sections: [door(1)], shelves: 1, blind: 'L', blindW: 33, hinge: 'L' }),
  wall('wall_top', { ar: 'علوية قصيرة (فوق الثلاجة)', en: 'Short wall unit (over fridge)' }, 80, 40, 120, { sections: [door(2)], shelves: 0 }, { h: 36, elev: WALL_ELEV + 36, d: 58 }),
  // ---- Tall ----
  tall('tall_pantry', { ar: 'عمود تخزين (مؤن)', en: 'Pantry tower' }, 60, 30, 100, { sections: [door(1, 0), door(1, 72)], shelves: 4, hinge: 'L' }),
  tall('tall_oven', { ar: 'عمود فرن + ميكروويف', en: 'Oven + microwave tower' }, 60, 60, 70, { sections: [door(1, 0), { kind: 'micro', h: 38 }, { kind: 'oven', h: 60 }, drawer(36), drawer(36)], shelves: 0, hinge: 'L' }),
  tall('tall_fridge', { ar: 'عمود ثلاجة مدمجة', en: 'Integrated fridge tower' }, 60, 56, 75, { sections: [door(1, 0), door(1, 72)], shelves: 0, hinge: 'L' }),
  tall('tall_drawers', { ar: 'عمود بأدراج', en: 'Tower with drawers' }, 60, 40, 100, { sections: [door(1, 0), drawer(24), drawer(24), drawer(24)], shelves: 3, hinge: 'L' }),
  // ---- Appliances ----
  { key: 'app_fridge', cat: 'appliance', group: 'appliance', name: { ar: 'ثلاجة', en: 'Fridge' }, w: 70, d: 70, h: 180, elev: 0, minW: 50, maxW: 90, appliance: 'fridge', opts: {}, price: 0 },
  { key: 'app_fridge_sbs', cat: 'appliance', group: 'appliance', name: { ar: 'ثلاجة دولابي', en: 'Side-by-side fridge' }, w: 91, d: 72, h: 178, elev: 0, minW: 80, maxW: 120, appliance: 'fridge_sbs', opts: {}, price: 0 },
  { key: 'app_cooker', cat: 'appliance', group: 'appliance', name: { ar: 'بوتاجاز قائم', en: 'Freestanding cooker' }, w: 60, d: 60, h: 86, elev: 0, minW: 50, maxW: 90, appliance: 'cooker', opts: {}, price: 0 },
  { key: 'app_hood', cat: 'appliance', group: 'appliance', name: { ar: 'شفاط مدخنة', en: 'Chimney hood' }, w: 60, d: 48, h: 62, elev: 156, minW: 50, maxW: 120, appliance: 'hood', opts: {}, price: 0 },
  { key: 'app_dishwasher', cat: 'appliance', group: 'appliance', name: { ar: 'غسالة أطباق', en: 'Dishwasher' }, w: 60, d: BASE_D, h: BASE_H, elev: 0, minW: 45, maxW: 60, appliance: 'dishwasher', opts: { countertop: true }, price: 0 },
  { key: 'app_washer', cat: 'appliance', group: 'appliance', name: { ar: 'غسالة ملابس', en: 'Washing machine' }, w: 60, d: BASE_D, h: BASE_H, elev: 0, minW: 55, maxW: 65, appliance: 'washer', opts: { countertop: true }, price: 0 },
  { key: 'app_microwave', cat: 'appliance', group: 'appliance', name: { ar: 'ميكروويف', en: 'Microwave' }, w: 50, d: 38, h: 29, elev: 86, minW: 40, maxW: 60, appliance: 'microwave', opts: {}, price: 0 },
];

let customModules: ModuleDef[] = [];
export function setCustomModules(mods: ModuleDef[]) {
  customModules = mods;
}
export function getCustomModules(): ModuleDef[] {
  return customModules;
}

export function moduleDef(key: string): ModuleDef | undefined {
  return CATALOG.find((m) => m.key === key) ?? customModules.find((m) => m.key === key);
}

export function itemName(it: Item, lang: 'ar' | 'en'): string {
  if (it.label) return it.label;
  const def = moduleDef(it.type);
  if (def) return def.name[lang];
  return lang === 'ar' ? 'وحدة' : 'Unit';
}

export function createItem(def: ModuleDef, at: { x: number; y: number; rot: number }, w?: number): Item {
  return {
    id: uid(),
    type: def.key,
    cat: def.cat,
    appliance: def.appliance,
    label: def.custom ? def.name.ar : undefined,
    x: at.x,
    y: at.y,
    rot: at.rot,
    w: w ?? def.w,
    d: def.d,
    h: def.h,
    elev: def.elev,
    opts: JSON.parse(JSON.stringify(def.opts)),
    price: def.price,
  };
}

/** Save an item as a reusable module definition. */
export function itemToModule(it: Item, name: string): ModuleDef {
  const src = moduleDef(it.type);
  return {
    key: 'custom_' + uid(),
    cat: it.cat,
    group: 'custom',
    name: { ar: name, en: name },
    w: it.w,
    d: it.d,
    h: it.h,
    elev: it.elev,
    minW: Math.min(src?.minW ?? 15, it.w),
    maxW: Math.max(src?.maxW ?? 300, it.w),
    appliance: it.appliance,
    opts: JSON.parse(JSON.stringify(it.opts)),
    price: it.price,
    custom: true,
  };
}

/** Short tag used on drawings: B = base, W = wall, T = tall, A = appliance. */
export function catLetter(cat: Category): string {
  return cat === 'base' ? 'B' : cat === 'wall' ? 'W' : cat === 'tall' ? 'T' : 'A';
}

export const SECTION_NAMES: Record<string, LText> = {
  door: { ar: 'ضلفة', en: 'Door' },
  drawer: { ar: 'درج', en: 'Drawer' },
  open: { ar: 'مفتوح', en: 'Open' },
  glass: { ar: 'ضلفة زجاج', en: 'Glass door' },
  flap: { ar: 'قلاب', en: 'Flap' },
  oven: { ar: 'فرن', en: 'Oven' },
  micro: { ar: 'ميكروويف', en: 'Microwave' },
  panel: { ar: 'وجه ثابت', en: 'Fixed panel' },
};

export const CAT_NAMES: Record<Category, LText> = {
  base: { ar: 'سفلية', en: 'Base' },
  wall: { ar: 'علوية', en: 'Wall' },
  tall: { ar: 'عمود', en: 'Tall' },
  appliance: { ar: 'جهاز', en: 'Appliance' },
};
