import type { CountertopType, DoorMaterialType, Finishes, HandleType, LText, Prices, Rules } from '../types';

export interface DoorFinish {
  id: string;
  type: DoorMaterialType;
  name: LText;
  color: string;
  /** secondary colour for the wood grain; presence means a wood texture */
  grain?: string;
  rough: number;
  clearcoat?: number;
}

export const DOOR_TYPES: { id: DoorMaterialType; name: LText; desc: LText }[] = [
  { id: 'mdf', name: { ar: 'MDF لاكيه', en: 'Lacquered MDF' }, desc: { ar: 'دهان مطفي ناعم', en: 'Smooth matt paint' } },
  { id: 'hpl', name: { ar: 'HPL فورمايكا', en: 'HPL laminate' }, desc: { ar: 'مقاوم للخدش والحرارة', en: 'Scratch & heat resistant' } },
  { id: 'pvc', name: { ar: 'PVC ممبرين', en: 'PVC membrane' }, desc: { ar: 'تلبيس نصف لامع', en: 'Semi-gloss wrap' } },
  { id: 'acrylic', name: { ar: 'أكريليك', en: 'Acrylic' }, desc: { ar: 'لامع عاكس (هاي جلوس)', en: 'High gloss' } },
  { id: 'wood', name: { ar: 'قشرة خشب طبيعي', en: 'Wood veneer' }, desc: { ar: 'خشب طبيعي دافئ', en: 'Warm natural wood' } },
];

export const DOOR_FINISHES: DoorFinish[] = [
  // MDF lacquer — matt solids
  { id: 'mdf-white', type: 'mdf', name: { ar: 'أبيض مطفي', en: 'Matt white' }, color: '#f4f3ef', rough: 0.62 },
  { id: 'mdf-ivory', type: 'mdf', name: { ar: 'عاجي', en: 'Ivory' }, color: '#ebe3d2', rough: 0.62 },
  { id: 'mdf-cashmere', type: 'mdf', name: { ar: 'كشمير', en: 'Cashmere' }, color: '#cfc2b0', rough: 0.62 },
  { id: 'mdf-lightgrey', type: 'mdf', name: { ar: 'رمادي فاتح', en: 'Light grey' }, color: '#c9cbcc', rough: 0.62 },
  { id: 'mdf-anthracite', type: 'mdf', name: { ar: 'أنثراسيت', en: 'Anthracite' }, color: '#3c4043', rough: 0.58 },
  { id: 'mdf-navy', type: 'mdf', name: { ar: 'كحلي', en: 'Navy' }, color: '#22344f', rough: 0.58 },
  { id: 'mdf-sage', type: 'mdf', name: { ar: 'أخضر ميرمية', en: 'Sage green' }, color: '#8a9a84', rough: 0.62 },
  { id: 'mdf-olive', type: 'mdf', name: { ar: 'زيتوني غامق', en: 'Dark olive' }, color: '#4c5540', rough: 0.6 },
  { id: 'mdf-terracotta', type: 'mdf', name: { ar: 'تيراكوتا', en: 'Terracotta' }, color: '#b5654a', rough: 0.62 },
  { id: 'mdf-black', type: 'mdf', name: { ar: 'أسود مطفي', en: 'Matt black' }, color: '#1f2022', rough: 0.55 },
  // HPL — patterns
  { id: 'hpl-oak', type: 'hpl', name: { ar: 'بلوط طبيعي', en: 'Natural oak' }, color: '#c9a877', grain: '#a98452', rough: 0.7 },
  { id: 'hpl-walnut', type: 'hpl', name: { ar: 'جوز', en: 'Walnut' }, color: '#6f4b33', grain: '#4b3020', rough: 0.68 },
  { id: 'hpl-wenge', type: 'hpl', name: { ar: 'وينجي', en: 'Wenge' }, color: '#3a2b24', grain: '#231914', rough: 0.68 },
  { id: 'hpl-ash', type: 'hpl', name: { ar: 'دردار فاتح', en: 'Light ash' }, color: '#ddd0b8', grain: '#c2b294', rough: 0.72 },
  { id: 'hpl-concrete', type: 'hpl', name: { ar: 'خرساني', en: 'Concrete' }, color: '#9a9a96', rough: 0.8 },
  { id: 'hpl-white', type: 'hpl', name: { ar: 'أبيض', en: 'White' }, color: '#eeeeea', rough: 0.7 },
  // PVC — semi gloss
  { id: 'pvc-white', type: 'pvc', name: { ar: 'أبيض', en: 'White' }, color: '#f2f2f0', rough: 0.38 },
  { id: 'pvc-cream', type: 'pvc', name: { ar: 'كريمي', en: 'Cream' }, color: '#eadfc6', rough: 0.38 },
  { id: 'pvc-cappuccino', type: 'pvc', name: { ar: 'كابتشينو', en: 'Cappuccino' }, color: '#a48b73', rough: 0.38 },
  { id: 'pvc-grey', type: 'pvc', name: { ar: 'رمادي', en: 'Grey' }, color: '#8d9093', rough: 0.38 },
  { id: 'pvc-lightwood', type: 'pvc', name: { ar: 'خشبي فاتح', en: 'Light wood' }, color: '#d2b48c', grain: '#b39468', rough: 0.42 },
  { id: 'pvc-darkwood', type: 'pvc', name: { ar: 'خشبي غامق', en: 'Dark wood' }, color: '#5b4032', grain: '#3d2a20', rough: 0.42 },
  // Acrylic — high gloss
  { id: 'acr-white', type: 'acrylic', name: { ar: 'أبيض لامع', en: 'Gloss white' }, color: '#f7f7f7', rough: 0.08, clearcoat: 1 },
  { id: 'acr-black', type: 'acrylic', name: { ar: 'أسود لامع', en: 'Gloss black' }, color: '#141416', rough: 0.06, clearcoat: 1 },
  { id: 'acr-grey', type: 'acrylic', name: { ar: 'رمادي لامع', en: 'Gloss grey' }, color: '#7c8085', rough: 0.08, clearcoat: 1 },
  { id: 'acr-champagne', type: 'acrylic', name: { ar: 'شامبين', en: 'Champagne' }, color: '#d8c7a6', rough: 0.08, clearcoat: 1 },
  { id: 'acr-burgundy', type: 'acrylic', name: { ar: 'نبيتي', en: 'Burgundy' }, color: '#6d1f2b', rough: 0.08, clearcoat: 1 },
  { id: 'acr-petrol', type: 'acrylic', name: { ar: 'بترولي', en: 'Petrol blue' }, color: '#1f4e5a', rough: 0.08, clearcoat: 1 },
  // Wood veneer
  { id: 'wood-oak', type: 'wood', name: { ar: 'بلوط', en: 'Oak' }, color: '#c69c6d', grain: '#9c7445', rough: 0.6 },
  { id: 'wood-beech', type: 'wood', name: { ar: 'زان', en: 'Beech' }, color: '#d9b48a', grain: '#bd9566', rough: 0.6 },
  { id: 'wood-walnut', type: 'wood', name: { ar: 'جوز أمريكي', en: 'American walnut' }, color: '#70492f', grain: '#4a2d1c', rough: 0.58 },
  { id: 'wood-mahogany', type: 'wood', name: { ar: 'ماهوجني', en: 'Mahogany' }, color: '#7a3b2a', grain: '#52231a', rough: 0.56 },
];

export function doorFinish(id: string | null | undefined): DoorFinish {
  return DOOR_FINISHES.find((f) => f.id === id) ?? DOOR_FINISHES[0];
}

export interface SimpleFinish {
  id: string;
  name: LText;
  color: string;
  grain?: string;
}

export const CARCASS_FINISHES: SimpleFinish[] = [
  { id: 'c-white', name: { ar: 'أبيض', en: 'White' }, color: '#f1f1ee' },
  { id: 'c-grey', name: { ar: 'رمادي', en: 'Grey' }, color: '#b9bbbd' },
  { id: 'c-anthracite', name: { ar: 'أنثراسيت', en: 'Anthracite' }, color: '#45484b' },
  { id: 'c-beige', name: { ar: 'بيج', en: 'Beige' }, color: '#ddd2bd' },
  { id: 'c-oak', name: { ar: 'بلوط', en: 'Oak' }, color: '#c9a877', grain: '#a98452' },
];
export function carcassFinish(id: string): SimpleFinish {
  return CARCASS_FINISHES.find((f) => f.id === id) ?? CARCASS_FINISHES[0];
}

export type CtTexture = 'granite' | 'marble' | 'quartz' | 'wood' | 'plain';
export interface CountertopFinish {
  id: string;
  type: CountertopType;
  name: LText;
  color: string;
  c2: string;
  tex: CtTexture;
  rough: number;
}

export const COUNTERTOP_TYPES: { id: CountertopType; name: LText }[] = [
  { id: 'granite', name: { ar: 'جرانيت', en: 'Granite' } },
  { id: 'marble', name: { ar: 'رخام', en: 'Marble' } },
  { id: 'quartz', name: { ar: 'كوارتز', en: 'Quartz' } },
  { id: 'wood', name: { ar: 'خشب', en: 'Wood' } },
  { id: 'hpl', name: { ar: 'HPL بوست فورم', en: 'HPL postform' } },
];

export const COUNTERTOPS: CountertopFinish[] = [
  { id: 'gr-galaxy', type: 'granite', name: { ar: 'جرانيت أسود جلاكسي', en: 'Black galaxy granite' }, color: '#17181a', c2: '#c9b27a', tex: 'granite', rough: 0.18 },
  { id: 'gr-grey', type: 'granite', name: { ar: 'جرانيت رمادي', en: 'Grey granite' }, color: '#8b8b88', c2: '#2f2f2f', tex: 'granite', rough: 0.22 },
  { id: 'gr-red', type: 'granite', name: { ar: 'جرانيت أحمر أسواني', en: 'Aswan red granite' }, color: '#8a4a3f', c2: '#2a1f1d', tex: 'granite', rough: 0.2 },
  { id: 'gr-gandola', type: 'granite', name: { ar: 'جرانيت جندولا', en: 'Gandola granite' }, color: '#b8a999', c2: '#5c4f47', tex: 'granite', rough: 0.22 },
  { id: 'mb-carrara', type: 'marble', name: { ar: 'رخام كرارة أبيض', en: 'Carrara white marble' }, color: '#f1f0ec', c2: '#9a9c9f', tex: 'marble', rough: 0.16 },
  { id: 'mb-emperador', type: 'marble', name: { ar: 'رخام إمبرادور بني', en: 'Emperador brown marble' }, color: '#5c4030', c2: '#c9a982', tex: 'marble', rough: 0.16 },
  { id: 'mb-galala', type: 'marble', name: { ar: 'رخام جلالة كريمي', en: 'Galala cream marble' }, color: '#e6dcc6', c2: '#bfae8c', tex: 'marble', rough: 0.2 },
  { id: 'mb-nero', type: 'marble', name: { ar: 'رخام أسود معرّق', en: 'Nero marquina marble' }, color: '#1a1a1c', c2: '#e8e8e8', tex: 'marble', rough: 0.14 },
  { id: 'qz-white', type: 'quartz', name: { ar: 'كوارتز أبيض', en: 'White quartz' }, color: '#f3f3f1', c2: '#d9d9d6', tex: 'quartz', rough: 0.2 },
  { id: 'qz-grey', type: 'quartz', name: { ar: 'كوارتز رمادي', en: 'Grey quartz' }, color: '#9c9fa2', c2: '#84878a', tex: 'quartz', rough: 0.22 },
  { id: 'qz-calacatta', type: 'quartz', name: { ar: 'كوارتز كلكتا', en: 'Calacatta quartz' }, color: '#f5f3ee', c2: '#b79c6a', tex: 'marble', rough: 0.16 },
  { id: 'wd-butcher', type: 'wood', name: { ar: 'خشب زان مصمت', en: 'Beech butcher block' }, color: '#c99c68', c2: '#a87a49', tex: 'wood', rough: 0.5 },
  { id: 'wd-walnut', type: 'wood', name: { ar: 'خشب جوز', en: 'Walnut top' }, color: '#6b4630', c2: '#472c1c', tex: 'wood', rough: 0.5 },
  { id: 'hp-grey', type: 'hpl', name: { ar: 'HPL رمادي حجري', en: 'Stone grey HPL' }, color: '#a3a3a0', c2: '#8e8e8a', tex: 'quartz', rough: 0.6 },
  { id: 'hp-black', type: 'hpl', name: { ar: 'HPL أسود', en: 'Black HPL' }, color: '#232426', c2: '#333437', tex: 'quartz', rough: 0.55 },
];
export function countertopFinish(id: string): CountertopFinish {
  return COUNTERTOPS.find((f) => f.id === id) ?? COUNTERTOPS[0];
}

export type FloorTexture = 'tiles' | 'planks' | 'marble' | 'concrete';
export interface FloorFinish {
  id: string;
  name: LText;
  tex: FloorTexture;
  color: string;
  c2: string;
}
export const FLOORS: FloorFinish[] = [
  { id: 'fl-porcelain', name: { ar: 'بورسلين بيج', en: 'Beige porcelain' }, tex: 'tiles', color: '#d9cfbf', c2: '#bfb5a4' },
  { id: 'fl-grey', name: { ar: 'بورسلين رمادي', en: 'Grey porcelain' }, tex: 'tiles', color: '#b4b5b3', c2: '#9a9b99' },
  { id: 'fl-white', name: { ar: 'سيراميك أبيض', en: 'White ceramic' }, tex: 'tiles', color: '#ecebe7', c2: '#cfcec9' },
  { id: 'fl-dark', name: { ar: 'بورسلين غامق', en: 'Dark porcelain' }, tex: 'tiles', color: '#4a4b4d', c2: '#35363a' },
  { id: 'fl-oak', name: { ar: 'باركيه بلوط', en: 'Oak parquet' }, tex: 'planks', color: '#c39a6b', c2: '#a37c4f' },
  { id: 'fl-walnut', name: { ar: 'باركيه جوز', en: 'Walnut parquet' }, tex: 'planks', color: '#7a553a', c2: '#5a3c27' },
  { id: 'fl-marble', name: { ar: 'رخام فاتح', en: 'Light marble' }, tex: 'marble', color: '#ecebe6', c2: '#cfd0d1' },
  { id: 'fl-concrete', name: { ar: 'خرسانة مصقولة', en: 'Polished concrete' }, tex: 'concrete', color: '#a5a5a1', c2: '#8f8f8b' },
];
export function floorFinish(id: string): FloorFinish {
  return FLOORS.find((f) => f.id === id) ?? FLOORS[0];
}

export type SplashTexture = 'none' | 'subway' | 'mosaic' | 'slab' | 'glass';
export interface SplashFinish {
  id: string;
  name: LText;
  tex: SplashTexture;
  color: string;
  c2: string;
}
export const BACKSPLASHES: SplashFinish[] = [
  { id: 'bs-none', name: { ar: 'بدون (دهان الحائط)', en: 'None (wall paint)' }, tex: 'none', color: '#ffffff', c2: '#ffffff' },
  { id: 'bs-subway-white', name: { ar: 'سيراميك مترو أبيض', en: 'White subway tile' }, tex: 'subway', color: '#f4f4f1', c2: '#c8c8c4' },
  { id: 'bs-subway-green', name: { ar: 'سيراميك مترو أخضر', en: 'Green subway tile' }, tex: 'subway', color: '#6f8f7d', c2: '#e6e6e0' },
  { id: 'bs-subway-black', name: { ar: 'سيراميك مترو أسود', en: 'Black subway tile' }, tex: 'subway', color: '#26272a', c2: '#8a8a8a' },
  { id: 'bs-mosaic', name: { ar: 'موزاييك رمادي', en: 'Grey mosaic' }, tex: 'mosaic', color: '#aeb2b5', c2: '#ecece8' },
  { id: 'bs-mosaic-blue', name: { ar: 'موزاييك أزرق', en: 'Blue mosaic' }, tex: 'mosaic', color: '#5f87a3', c2: '#eef1f2' },
  { id: 'bs-slab', name: { ar: 'نفس خامة السطح', en: 'Same as countertop' }, tex: 'slab', color: '#ffffff', c2: '#ffffff' },
  { id: 'bs-glass', name: { ar: 'زجاج مطلي', en: 'Back-painted glass' }, tex: 'glass', color: '#dfe7e4', c2: '#dfe7e4' },
];
export function splashFinish(id: string): SplashFinish {
  return BACKSPLASHES.find((f) => f.id === id) ?? BACKSPLASHES[0];
}

export const HANDLE_TYPES: { id: HandleType; name: LText }[] = [
  { id: 'bar', name: { ar: 'مقبض عصا', en: 'Bar handle' } },
  { id: 'knob', name: { ar: 'مقبض زر', en: 'Knob' } },
  { id: 'cup', name: { ar: 'مقبض صدفة', en: 'Cup pull' } },
  { id: 'gola', name: { ar: 'بروفيل مخفي (جولا)', en: 'Handleless (Gola)' } },
  { id: 'none', name: { ar: 'بدون (ضغط للفتح)', en: 'None (push-open)' } },
];

export interface MetalFinish {
  id: string;
  name: LText;
  color: string;
  rough: number;
}
export const HANDLE_COLORS: MetalFinish[] = [
  { id: 'steel', name: { ar: 'ستانلس', en: 'Stainless' }, color: '#c4c7ca', rough: 0.32 },
  { id: 'black', name: { ar: 'أسود مطفي', en: 'Matt black' }, color: '#1c1c1e', rough: 0.5 },
  { id: 'gold', name: { ar: 'ذهبي', en: 'Gold' }, color: '#c9a24a', rough: 0.28 },
  { id: 'brass', name: { ar: 'نحاسي معتّق', en: 'Antique brass' }, color: '#8d6b3a', rough: 0.4 },
  { id: 'chrome', name: { ar: 'كروم', en: 'Chrome' }, color: '#e6e8ea', rough: 0.12 },
];
export function handleColor(id: string): MetalFinish {
  return HANDLE_COLORS.find((f) => f.id === id) ?? HANDLE_COLORS[0];
}

export const PLINTHS: SimpleFinish[] = [
  { id: 'pl-steel', name: { ar: 'ألومنيوم', en: 'Aluminium' }, color: '#b9bcbf' },
  { id: 'pl-black', name: { ar: 'أسود', en: 'Black' }, color: '#1f2022' },
  { id: 'pl-white', name: { ar: 'أبيض', en: 'White' }, color: '#eeeeea' },
  { id: 'pl-door', name: { ar: 'نفس لون الضلف', en: 'Same as doors' }, color: '#888888' },
];

export const WALL_COLORS: SimpleFinish[] = [
  { id: '#f3f1ec', name: { ar: 'أوف وايت', en: 'Off-white' }, color: '#f3f1ec' },
  { id: '#ffffff', name: { ar: 'أبيض', en: 'White' }, color: '#ffffff' },
  { id: '#e9e2d3', name: { ar: 'بيج فاتح', en: 'Light beige' }, color: '#e9e2d3' },
  { id: '#dcdfe1', name: { ar: 'رمادي فاتح', en: 'Light grey' }, color: '#dcdfe1' },
  { id: '#cfd9d2', name: { ar: 'أخضر باهت', en: 'Pale green' }, color: '#cfd9d2' },
  { id: '#d5dee8', name: { ar: 'أزرق باهت', en: 'Pale blue' }, color: '#d5dee8' },
  { id: '#ead9cf', name: { ar: 'وردي ترابي', en: 'Dusty pink' }, color: '#ead9cf' },
  { id: '#8f9a93', name: { ar: 'أخضر رمادي', en: 'Grey green' }, color: '#8f9a93' },
  { id: '#55595c', name: { ar: 'رمادي غامق', en: 'Dark grey' }, color: '#55595c' },
];

export const LED_TEMPS: { id: 'warm' | 'neutral' | 'cool'; name: LText; color: string }[] = [
  { id: 'warm', name: { ar: 'دافئ', en: 'Warm' }, color: '#ffd9a0' },
  { id: 'neutral', name: { ar: 'طبيعي', en: 'Neutral' }, color: '#fff4e2' },
  { id: 'cool', name: { ar: 'بارد', en: 'Cool' }, color: '#e4f0ff' },
];

export const DEFAULT_FINISHES: Finishes = {
  baseDoor: 'mdf-navy',
  wallDoor: 'mdf-white',
  tallDoor: 'mdf-navy',
  doorStyle: 'flat',
  carcass: 'c-white',
  countertop: 'mb-carrara',
  countertopT: 4,
  overhang: 2,
  handle: 'bar',
  handleColor: 'gold',
  plinth: 'pl-steel',
  wallColor: '#f3f1ec',
  floor: 'fl-porcelain',
  backsplash: 'bs-subway-white',
  led: true,
  ledTemp: 'warm',
  brightness: 1,
};

export interface StylePreset {
  id: string;
  name: LText;
  desc: LText;
  f: Partial<Finishes>;
}

/** Ready-made colour / material combinations suggested by the assistant. */
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'modern-white',
    name: { ar: 'مودرن أبيض', en: 'Modern white' },
    desc: { ar: 'أبيض لامع مع جرانيت أسود', en: 'Gloss white with black granite' },
    f: { baseDoor: 'acr-white', wallDoor: 'acr-white', tallDoor: 'acr-white', doorStyle: 'flat', countertop: 'gr-galaxy', handle: 'gola', handleColor: 'steel', plinth: 'pl-steel', wallColor: '#dcdfe1', floor: 'fl-grey', backsplash: 'bs-glass', carcass: 'c-white' },
  },
  {
    id: 'greige-black',
    name: { ar: 'بيج مودرن بأسود', en: 'Greige & black' },
    desc: { ar: 'كشمير مطفي بخطوط سوداء ورخام معرّق', en: 'Matt cashmere, black lines, veined top' },
    f: { baseDoor: 'mdf-cashmere', wallDoor: 'mdf-cashmere', tallDoor: 'mdf-cashmere', doorStyle: 'flat', countertop: 'qz-calacatta', handle: 'gola', handleColor: 'black', plinth: 'pl-black', wallColor: '#f3f1ec', floor: 'fl-marble', backsplash: 'bs-slab', carcass: 'c-oak' },
  },
  {
    id: 'navy-gold',
    name: { ar: 'كحلي وذهبي', en: 'Navy & gold' },
    desc: { ar: 'سفلي كحلي وعلوي أبيض ورخام كرارة', en: 'Navy base, white wall units, Carrara top' },
    f: { baseDoor: 'mdf-navy', wallDoor: 'mdf-white', tallDoor: 'mdf-navy', doorStyle: 'shaker', countertop: 'mb-carrara', handle: 'bar', handleColor: 'gold', plinth: 'pl-door', wallColor: '#f3f1ec', floor: 'fl-oak', backsplash: 'bs-subway-white', carcass: 'c-white' },
  },
  {
    id: 'warm-wood',
    name: { ar: 'خشبي دافئ', en: 'Warm wood' },
    desc: { ar: 'بلوط طبيعي مع كوارتز أبيض', en: 'Natural oak with white quartz' },
    f: { baseDoor: 'hpl-oak', wallDoor: 'mdf-white', tallDoor: 'hpl-oak', doorStyle: 'flat', countertop: 'qz-white', handle: 'bar', handleColor: 'black', plinth: 'pl-black', wallColor: '#f3f1ec', floor: 'fl-porcelain', backsplash: 'bs-subway-white', carcass: 'c-white' },
  },
  {
    id: 'dark-luxury',
    name: { ar: 'فخامة داكنة', en: 'Dark luxury' },
    desc: { ar: 'أنثراسيت وجوز مع رخام أسود معرّق', en: 'Anthracite & walnut with veined black marble' },
    f: { baseDoor: 'mdf-anthracite', wallDoor: 'hpl-walnut', tallDoor: 'mdf-anthracite', doorStyle: 'flat', countertop: 'mb-nero', handle: 'gola', handleColor: 'black', plinth: 'pl-black', wallColor: '#dcdfe1', floor: 'fl-concrete', backsplash: 'bs-slab', carcass: 'c-anthracite' },
  },
  {
    id: 'scandi',
    name: { ar: 'اسكندنافي', en: 'Scandinavian' },
    desc: { ar: 'أبيض مطفي مع خشب زان فاتح', en: 'Matt white with light beech' },
    f: { baseDoor: 'mdf-white', wallDoor: 'mdf-white', tallDoor: 'hpl-ash', doorStyle: 'flat', countertop: 'wd-butcher', handle: 'knob', handleColor: 'black', plinth: 'pl-white', wallColor: '#ffffff', floor: 'fl-oak', backsplash: 'bs-subway-white', carcass: 'c-white' },
  },
  {
    id: 'sage-classic',
    name: { ar: 'كلاسيك أخضر', en: 'Sage classic' },
    desc: { ar: 'أخضر ميرمية بإطار شيكر ورخام كريمي', en: 'Sage shaker doors with cream marble' },
    f: { baseDoor: 'mdf-sage', wallDoor: 'mdf-sage', tallDoor: 'mdf-sage', doorStyle: 'shaker', countertop: 'mb-galala', handle: 'cup', handleColor: 'brass', plinth: 'pl-door', wallColor: '#f3f1ec', floor: 'fl-walnut', backsplash: 'bs-subway-white', carcass: 'c-beige' },
  },
  {
    id: 'cappuccino',
    name: { ar: 'كابتشينو', en: 'Cappuccino' },
    desc: { ar: 'درجات البيج والبني مع جرانيت جندولا', en: 'Beige & brown tones with Gandola granite' },
    f: { baseDoor: 'pvc-cappuccino', wallDoor: 'pvc-cream', tallDoor: 'pvc-cappuccino', doorStyle: 'flat', countertop: 'gr-gandola', handle: 'bar', handleColor: 'steel', plinth: 'pl-steel', wallColor: '#e9e2d3', floor: 'fl-porcelain', backsplash: 'bs-mosaic', carcass: 'c-beige' },
  },
  {
    id: 'industrial',
    name: { ar: 'صناعي', en: 'Industrial' },
    desc: { ar: 'خرساني وأسود مع سطح خشبي', en: 'Concrete & black with a wooden top' },
    f: { baseDoor: 'hpl-concrete', wallDoor: 'mdf-black', tallDoor: 'mdf-black', doorStyle: 'flat', countertop: 'wd-walnut', handle: 'bar', handleColor: 'black', plinth: 'pl-black', wallColor: '#dcdfe1', floor: 'fl-concrete', backsplash: 'bs-subway-black', carcass: 'c-grey' },
  },
];

export const DEFAULT_PRICES: Prices = {
  currency: 'ج.م',
  carcassSheet: 1850,
  backSheet: 420,
  front: { mdf: 1900, hpl: 1500, pvc: 1700, acrylic: 2700, wood: 3200 },
  countertop: { granite: 2600, marble: 3400, quartz: 6500, wood: 3000, hpl: 1200 },
  backsplash: 850,
  edge: 12,
  hinge: 55,
  handle: 65,
  slide: 240,
  leg: 15,
  hanger: 35,
  flapLift: 380,
  shelfPin: 2,
  plinth: 130,
  led: 160,
  gola: 260,
  sinkSet: 0,
  laborPerM: 1300,
  install: 1500,
  transport: 800,
  margin: 15,
  tax: 0,
};

export const DEFAULT_RULES: Rules = {
  boardT: 18,
  backT: 3,
  frontT: 18,
  drawerT: 16,
  gap: 3,
  plinthH: 100,
  shelfSetback: 20,
  stretcherW: 100,
  slideClear: 26,
  sheetL: 2440,
  sheetW: 1220,
  kerf: 4,
  edgeWaste: 10,
};
