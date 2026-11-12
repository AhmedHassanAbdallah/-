// Kitchen Studio data model.
// All linear dimensions are centimetres unless a name says otherwise (manufacturing rules and cut list use mm).

export type Lang = 'ar' | 'en';
export interface LText {
  ar: string;
  en: string;
}

export interface Vec2 {
  x: number;
  y: number;
}

// ---------- Room ----------
export type OpeningType = 'door' | 'window';
export interface Opening {
  id: string;
  type: OpeningType;
  /** index of the wall (edge from points[i] to points[i+1]) */
  wall: number;
  /** distance from the wall start to the opening's near edge */
  offset: number;
  width: number;
  height: number;
  /** bottom of the opening above the floor (0 for doors) */
  sill: number;
  /** door hinge side seen from inside the room, and swing direction */
  hinge?: 'L' | 'R';
  swing?: 'in' | 'out';
}

export type UtilityType = 'water' | 'drain' | 'electric' | 'gas';
export interface Utility {
  id: string;
  type: UtilityType;
  wall: number;
  offset: number;
  height: number;
}

export interface Column {
  id: string;
  /** centre of the column */
  x: number;
  y: number;
  w: number;
  d: number;
}

export interface Room {
  /** room outline, clockwise in plan coordinates (x → right, y → down) */
  points: Vec2[];
  height: number;
  wallThickness: number;
  openings: Opening[];
  utilities: Utility[];
  columns: Column[];
}

// ---------- Items (cabinets and appliances) ----------
export type Category = 'base' | 'wall' | 'tall' | 'appliance';

/** A cabinet front is a vertical stack of sections, listed top → bottom. */
export type SectionKind = 'door' | 'drawer' | 'open' | 'glass' | 'flap' | 'oven' | 'micro' | 'panel';
export interface Section {
  kind: SectionKind;
  /** section height in cm; 0 = share the remaining height equally */
  h: number;
  /** number of door leaves (door / glass sections) */
  n?: number;
}

export type ApplianceKind =
  | 'fridge'
  | 'fridge_sbs'
  | 'cooker'
  | 'hood'
  | 'dishwasher'
  | 'washer'
  | 'microwave'
  | 'freezer'
  | 'chest_freezer'
  | 'dryer'
  | 'dispenser'
  | 'heater'
  | 'wine'
  | 'coffee'
  | 'washer_top'
  | 'pendant';

export interface ItemOptions {
  sections?: Section[];
  /** adjustable shelves */
  shelves?: number;
  hinge?: 'L' | 'R';
  /** blind-corner side (the part hidden behind the perpendicular run) */
  blind?: 'L' | 'R' | null;
  blindW?: number;
  sink?: 'single' | 'double' | null;
  cooktop?: 'gas' | 'induction' | null;
  /** built-in extractor in a wall cabinet */
  hood?: boolean;
  /** LED profile inside the unit (shows through glass / open sections) */
  ledInside?: boolean;
  /** LED profile under a wall unit; undefined follows the project setting */
  ledUnder?: boolean;
  /** display unit: black metal frame with glass sides */
  vitrine?: boolean;
  /** countertop runs down to the floor at the unit's end(s) */
  waterfall?: 'L' | 'R' | 'both' | null;
  /** decorative slatted (fluted) wood panel */
  slat?: boolean;
  /** rotated by hand: do not turn it back to face the nearest wall while dragging */
  freeRot?: boolean;
  /** carries a countertop slab */
  countertop?: boolean;
  /** free-standing island: finished back and overhang all round */
  island?: boolean;
  /** filler strip only (no carcass) */
  filler?: boolean;
}

export interface Item {
  id: string;
  /** catalog key (or custom module key) */
  type: string;
  cat: Category;
  appliance?: ApplianceKind;
  /** user label overriding the catalog name */
  label?: string;
  /** centre of the footprint in plan coordinates */
  x: number;
  y: number;
  /** degrees; width axis = (cos, sin), front faces (-sin, cos) */
  rot: number;
  w: number;
  d: number;
  h: number;
  /** bottom elevation above the floor */
  elev: number;
  opts: ItemOptions;
  /** door finish override (finish id) */
  finish?: string | null;
  /** price for appliances / bought-in items */
  price?: number;
}

export interface ModuleDef {
  key: string;
  cat: Category;
  group: string;
  name: LText;
  w: number;
  d: number;
  h: number;
  elev: number;
  minW: number;
  maxW: number;
  appliance?: ApplianceKind;
  opts: ItemOptions;
  price?: number;
  custom?: boolean;
}

// ---------- Finishes ----------
export type DoorMaterialType = 'mdf' | 'hpl' | 'pvc' | 'acrylic' | 'wood';
export type CountertopType = 'granite' | 'marble' | 'quartz' | 'wood' | 'hpl';
export type HandleType = 'bar' | 'knob' | 'cup' | 'gola' | 'none';
export type DoorStyle = 'flat' | 'shaker' | 'fluted';

export interface Finishes {
  baseDoor: string;
  wallDoor: string;
  tallDoor: string;
  doorStyle: DoorStyle;
  carcass: string;
  countertop: string;
  /** countertop thickness, cm */
  countertopT: number;
  /** countertop front overhang, cm */
  overhang: number;
  handle: HandleType;
  handleColor: string;
  plinth: string;
  wallColor: string;
  floor: string;
  backsplash: string;
  led: boolean;
  ledTemp: 'warm' | 'neutral' | 'cool';
  brightness: number;
}

// ---------- Costing ----------
export interface Prices {
  currency: string;
  carcassSheet: number;
  backSheet: number;
  front: Record<DoorMaterialType, number>;
  countertop: Record<CountertopType, number>;
  backsplash: number;
  edge: number;
  hinge: number;
  handle: number;
  slide: number;
  leg: number;
  hanger: number;
  flapLift: number;
  shelfPin: number;
  plinth: number;
  led: number;
  gola: number;
  sinkSet: number;
  laborPerM: number;
  install: number;
  transport: number;
  margin: number;
  tax: number;
}

/** Manufacturing rules, millimetres. */
export interface Rules {
  boardT: number;
  backT: number;
  frontT: number;
  drawerT: number;
  gap: number;
  plinthH: number;
  shelfSetback: number;
  stretcherW: number;
  slideClear: number;
  sheetL: number;
  sheetW: number;
  kerf: number;
  edgeWaste: number;
}

export interface Project {
  id: string;
  name: string;
  client?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
  room: Room;
  items: Item[];
  finishes: Finishes;
  prices: Prices;
  rules: Rules;
  /** small JPEG data URL preview */
  thumb?: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  thumb?: string;
  itemCount: number;
  roomLabel: string;
}
