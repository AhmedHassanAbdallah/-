import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import type { Item, Project, Room } from '../types';
import { bounds, columnCorners, cornerIsConvex, distToPolygon, getWalls, itemCorners, itemWall, pointInPolygon, type Wall } from '../lib/geometry';
import { LED_TEMPS } from '../lib/materials';
import { Batch, buildItem, CM, disposeGroup, MatLib } from './builders';

export type ViewMode = 'orbit' | 'walk';
export type ViewPreset = 'iso' | 'top' | 'wall';

interface WallEntry {
  group: THREE.Group;
  mid: THREE.Vector3;
  n: THREE.Vector3;
}

const UTIL_COLORS: Record<string, string> = { water: '#2f80ed', drain: '#6b7280', electric: '#f2c230', gas: '#f2792b' };

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private mats = new MatLib();
  private world = new THREE.Group();
  private roomGroup = new THREE.Group();
  private itemsGroup = new THREE.Group();
  private ledGroup = new THREE.Group();
  private walls: WallEntry[] = [];
  private ceiling: THREE.Mesh | null = null;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.PointLight;
  private selection: THREE.LineSegments | null = null;
  private utilMats = new Map<string, THREE.Material>();
  private envTex: THREE.Texture | null = null;

  private project: Project | null = null;
  private roomRef: Room | null = null;
  private roomKey = '';
  private selectedId: string | null = null;
  private fitted = false;
  private dirty = true;
  private raf = 0;
  private last = 0;
  private ro: ResizeObserver | null = null;
  private disposed = false;

  /** how far each unit's doors / drawers are open (0…1) and where they are heading */
  private openNow = new Map<string, number>();
  private openAll = false;
  private openIds = new Set<string>();

  mode: ViewMode = 'orbit';
  private yaw = 0;
  private pitch = 0;
  private move = { x: 0, y: 0 };
  private keys = new Set<string>();
  private savedOrbit: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private wallCycle = -1;

  onSelect?: (id: string | null) => void;

  constructor(
    private container: HTMLElement,
    offscreen = false,
  ) {
    const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setClearColor(0x000000, 0);
    const el = this.renderer.domElement;
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.display = 'block';
    el.style.touchAction = 'none';
    container.appendChild(el);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    this.camera.position.set(4, 3.5, 6);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.32;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0xb9b0a2, 0.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3e0, 2.3);
    this.sun.castShadow = true;
    const ms = lowEnd ? 1024 : 2048;
    this.sun.shadow.mapSize.set(ms, ms);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.fill = new THREE.PointLight(0xfff8ee, 2, 0, 2);
    this.scene.add(this.fill);

    this.world.add(this.roomGroup, this.itemsGroup);
    this.scene.add(this.world, this.ledGroup);

    this.controls = new OrbitControls(this.camera, el);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 40;
    this.controls.zoomSpeed = 0.9;
    this.controls.addEventListener('change', () => (this.dirty = true));
    // leaving an elevation view by orbiting ends its section cut
    this.controls.addEventListener('start', () => this.setNear(0.05));

    if (!offscreen) {
      this.bindPointer(el);
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(container);
      window.addEventListener('keydown', this.onKey);
      window.addEventListener('keyup', this.onKey);
      this.resize();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  // ------------------------------------------------------------------ input
  private bindPointer(el: HTMLCanvasElement) {
    let down: { x: number; y: number; t: number; id: number } | null = null;
    let lookId: number | null = null;
    let lx = 0;
    let ly = 0;
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      if (this.mode === 'walk' && lookId === null) {
        lookId = e.pointerId;
        lx = e.clientX;
        ly = e.clientY;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (this.mode === 'walk' && lookId === e.pointerId) {
        this.yaw -= (e.clientX - lx) * 0.0052;
        this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - (e.clientY - ly) * 0.0052));
        lx = e.clientX;
        ly = e.clientY;
        this.applyWalkCamera();
      }
    });
    const up = (e: PointerEvent) => {
      if (lookId === e.pointerId) lookId = null;
      if (!down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 450;
      down = null;
      if (moved < 7 && quick && this.mode === 'orbit') this.pick(e.clientX, e.clientY);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', (e) => {
      if (lookId === e.pointerId) lookId = null;
      down = null;
    });
  }

  private onKey = (e: KeyboardEvent) => {
    if (this.mode !== 'walk') return;
    const k = e.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (e.type === 'keydown') this.keys.add(k);
    else this.keys.delete(k);
    e.preventDefault();
  };

  private pick(cx: number, cy: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(this.itemsGroup.children, true);
    let id: string | null = null;
    for (const h of hits) {
      if ((h.object as THREE.LineSegments).isLineSegments) continue;
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.itemId) o = o.parent;
      if (o) {
        id = o.userData.itemId as string;
        break;
      }
    }
    this.onSelect?.(id);
  }

  // ------------------------------------------------------------------ sizing / loop
  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private loop = (time: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (time - this.last) / 1000 || 0.016);
    this.last = time;
    if (this.mode === 'walk') {
      let mx = this.move.x;
      let my = this.move.y;
      if (this.keys.has('w') || this.keys.has('arrowup')) my += 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) my -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
      if (mx || my) this.walkStep(mx, my, dt);
    } else if (this.controls.update()) {
      this.dirty = true;
    }
    this.stepOpen(dt);
    if (this.dirty) this.render();
  };

  private render() {
    this.dirty = false;
    this.updateWallVisibility();
    this.renderer.render(this.scene, this.camera);
  }

  private updateWallVisibility() {
    const cam = this.camera.position;
    for (const w of this.walls) {
      const visible = this.mode === 'walk' || (cam.x - w.mid.x) * w.n.x + (cam.z - w.mid.z) * w.n.z > 0;
      w.group.visible = visible;
    }
    if (this.ceiling) this.ceiling.visible = this.mode === 'walk';
  }

  // ------------------------------------------------------------------ building
  setProject(p: Project, selectedId: string | null = null) {
    const prev = this.project;
    this.project = p;
    this.selectedId = selectedId;
    const key = [p.finishes.wallColor, p.finishes.floor, p.finishes.brightness, p.finishes.ledTemp].join('|');
    if (!prev || p.room !== this.roomRef || key !== this.roomKey) {
      const shapeChanged = !prev || prev.room.points !== p.room.points || prev.room.height !== p.room.height;
      this.roomRef = p.room;
      this.roomKey = key;
      this.buildRoom(p);
      if (!this.fitted || (shapeChanged && this.mode === 'orbit' && !prev)) this.fitCamera();
      else if (shapeChanged && this.mode === 'orbit') this.retarget();
    }
    this.buildItems(p);
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }

  setSelected(id: string | null) {
    if (id === this.selectedId) return;
    this.selectedId = id;
    this.updateSelection();
    this.dirty = true;
  }

  private clear(group: THREE.Group) {
    for (const c of [...group.children]) {
      disposeGroup(c);
      group.remove(c);
    }
  }

  private utilMat(type: string) {
    let m = this.utilMats.get(type);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: UTIL_COLORS[type] ?? '#888', roughness: 0.5 });
      this.utilMats.set(type, m);
    }
    return m;
  }

  private buildRoom(p: Project) {
    this.clear(this.roomGroup);
    this.walls = [];
    const room = p.room;
    const H = room.height;
    const T = room.wallThickness;
    const walls = getWalls(room);
    const fin = p.finishes;

    // floor
    const floorShape = new THREE.Shape(room.points.map((pt) => new THREE.Vector2(pt.x, -pt.y)));
    const fg = new THREE.ShapeGeometry(floorShape);
    const fuv = fg.getAttribute('uv');
    for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * CM, fuv.getY(i) * CM);
    fg.rotateX(-Math.PI / 2);
    fg.scale(CM, CM, CM);
    const floor = new THREE.Mesh(fg, this.mats.floor(fin.floor));
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    // ceiling (only shown while walking inside)
    const cg = new THREE.ShapeGeometry(new THREE.Shape(room.points.map((pt) => new THREE.Vector2(pt.x, pt.y))));
    cg.rotateX(Math.PI / 2);
    cg.scale(CM, CM, CM);
    this.ceiling = new THREE.Mesh(cg, this.mats.ceiling);
    this.ceiling.position.y = H * CM;
    this.ceiling.visible = false;
    this.roomGroup.add(this.ceiling);

    const wallMat = this.mats.wall(fin.wallColor);
    for (const w of walls) {
      if (w.len < 1) continue;
      const group = new THREE.Group();
      group.position.set(w.a.x * CM, 0, w.a.y * CM);
      group.rotation.y = (-w.angle * Math.PI) / 180;
      const ext = cornerIsConvex(room, (w.i + 1) % walls.length) ? T : 0;
      const L = w.len + ext;

      const ops = room.openings
        .filter((o) => o.wall === w.i)
        .map((o) => ({ ...o, x0: Math.max(0.5, o.offset), x1: Math.min(w.len - 0.5, o.offset + o.width) }))
        .filter((o) => o.x1 - o.x0 > 5)
        .sort((a, b) => a.x0 - b.x0);
      const used: { x0: number; x1: number }[] = [];
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      const batch = new Batch();
      const white = this.mats.white;
      for (const o of ops) {
        if (used.some((u) => o.x0 < u.x1 + 1 && o.x1 > u.x0 - 1)) continue;
        used.push({ x0: o.x0, x1: o.x1 });
        const ow = o.x1 - o.x0;
        const cx = (o.x0 + o.x1) / 2;
        if (o.type === 'door') {
          const dh = Math.min(o.height, H - 2);
          shape.lineTo(o.x0, 0);
          shape.lineTo(o.x0, dh);
          shape.lineTo(o.x1, dh);
          shape.lineTo(o.x1, 0);
          // frame + leaf
          batch.box(white, 5, dh, T + 2, o.x0 + 2.5, dh / 2, -T / 2);
          batch.box(white, 5, dh, T + 2, o.x1 - 2.5, dh / 2, -T / 2);
          batch.box(white, ow, 5, T + 2, cx, dh - 2.5, -T / 2);
          batch.box(this.mats.woodDoor, ow - 10, dh - 5, 4, cx, (dh - 5) / 2, -T + 3);
          batch.cyl(this.mats.steel, 1.2, 12, o.hinge === 'R' ? o.x0 + 12 : o.x1 - 12, dh * 0.48, o.swing === 'out' ? -T + 0.5 : -T + 6.5, 'x', 10);
        }
      }
      shape.lineTo(L, 0);
      shape.lineTo(L, H);
      shape.lineTo(0, H);
      shape.closePath();
      for (const o of ops) {
        if (o.type !== 'window') continue;
        if (used.some((u) => u.x0 === o.x0 && u.x1 === o.x1) === false) continue;
        const y0 = Math.max(1, o.sill);
        const y1 = Math.min(H - 1, o.sill + o.height);
        if (y1 - y0 < 5) continue;
        const hole = new THREE.Path();
        hole.moveTo(o.x0, y0);
        hole.lineTo(o.x0, y1);
        hole.lineTo(o.x1, y1);
        hole.lineTo(o.x1, y0);
        hole.closePath();
        shape.holes.push(hole);
        const ow = o.x1 - o.x0;
        const oh = y1 - y0;
        const cx = (o.x0 + o.x1) / 2;
        const cy = (y0 + y1) / 2;
        batch.box(white, ow, 4, T, cx, y0 + 2, -T / 2);
        batch.box(white, ow, 4, T, cx, y1 - 2, -T / 2);
        batch.box(white, 4, oh - 8, T, o.x0 + 2, cy, -T / 2);
        batch.box(white, 4, oh - 8, T, o.x1 - 2, cy, -T / 2);
        if (ow > 80) batch.box(white, 3.5, oh - 8, 4, cx, cy, -T / 2);
        batch.box(this.mats.glass, ow - 8, oh - 8, 0.6, cx, cy, -T / 2);
        batch.box(white, ow + 8, 2.5, 6, cx, y0 - 1.25, 2);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 1 });
      geo.translate(0, 0, -T);
      geo.scale(CM, CM, CM);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.receiveShadow = true;
      group.add(mesh);

      for (const u of room.utilities) {
        if (u.wall !== w.i) continue;
        const m = this.utilMat(u.type);
        if (u.type === 'electric') {
          batch.box(white, 9, 9, 1, u.offset, u.height, 0.5);
          batch.box(m, 5, 5, 0.6, u.offset, u.height, 1.2);
        } else {
          batch.cyl(m, u.type === 'drain' ? 3 : 1.8, 5, u.offset, u.height, 2.5, 'z', 14);
          batch.cyl(white, u.type === 'drain' ? 4.2 : 3, 0.6, u.offset, u.height, 0.3, 'z', 14);
        }
      }
      const fittings = batch.build();
      fittings.traverse((o) => ((o as THREE.Mesh).castShadow = false));
      group.add(fittings);

      this.roomGroup.add(group);
      const mid = new THREE.Vector3((w.a.x + w.b.x) / 2, 0, (w.a.y + w.b.y) / 2).multiplyScalar(CM);
      this.walls.push({ group, mid, n: new THREE.Vector3(w.n.x, 0, w.n.y) });
    }

    // columns
    if (room.columns.length) {
      const cb = new Batch();
      for (const c of room.columns) cb.box(wallMat, c.w, H, c.d, c.x, H / 2, c.y);
      this.roomGroup.add(cb.build());
    }

    // lights follow the room
    const b = bounds(room.points);
    const cx = b.cx * CM;
    const cz = b.cy * CM;
    const r = (Math.max(b.w, b.h) * CM) / 2 + 1.2;
    const k = fin.brightness;
    this.hemi.intensity = 0.55 * k;
    this.sun.intensity = 2.3 * k;
    this.sun.position.set(cx + r * 0.55, H * CM + 3.2, cz + r * 0.8);
    this.sun.target.position.set(cx, 0.4, cz);
    const sc = this.sun.shadow.camera;
    sc.left = -r;
    sc.right = r;
    sc.top = r;
    sc.bottom = -r;
    sc.near = 0.5;
    sc.far = H * CM + r * 3 + 6;
    sc.updateProjectionMatrix();
    this.fill.intensity = 2 * k;
    this.fill.position.set(cx, H * CM - 0.25, cz);
  }

  private buildItems(p: Project) {
    this.clear(this.itemsGroup);
    this.clear(this.ledGroup);
    this.selection = null;
    const walls = getWalls(p.room);
    const ledItems: Item[] = [];
    const insideItems: Item[] = [];
    const pendants: Item[] = [];
    for (const it of p.items) {
      const onWall = !!itemWall(it, walls);
      const g = buildItem(it, { rules: p.rules, fin: p.finishes, mats: this.mats, onWall, open: this.openNow.get(it.id) ?? 0 });
      if (it.appliance === 'pendant') pendants.push(it);
      this.itemsGroup.add(g);
      if ((it.opts.ledUnder ?? p.finishes.led) && it.cat === 'wall' && it.elev > 100) ledItems.push(it);
      if (it.opts.ledInside) insideItems.push(it);
    }
    // a few soft lights under the wall units (capped for mobile GPUs)
    const max = 5;
    const step = Math.max(1, Math.ceil(ledItems.length / max));
    const color = LED_TEMPS.find((l) => l.id === p.finishes.ledTemp)?.color ?? '#fff4e2';
    for (let i = 0; i < ledItems.length; i += step) {
      const it = ledItems[i];
      const r = (it.rot * Math.PI) / 180;
      const fx = -Math.sin(r);
      const fz = Math.cos(r);
      const light = new THREE.PointLight(color, 0.55 * p.finishes.brightness, 1.7, 2);
      light.position.set((it.x + fx * 4) * CM, (it.elev - 8) * CM, (it.y + fz * 4) * CM);
      this.ledGroup.add(light);
    }
    for (const it of pendants.slice(0, 4)) {
      const light = new THREE.PointLight(color, 1.6 * p.finishes.brightness, 3.2, 2);
      light.position.set(it.x * CM, (it.elev - 6) * CM, it.y * CM);
      this.ledGroup.add(light);
    }
    // glow inside lit display units
    const stepIn = Math.max(1, Math.ceil(insideItems.length / 3));
    for (let i = 0; i < insideItems.length; i += stepIn) {
      const it = insideItems[i];
      const light = new THREE.PointLight(color, 0.35 * p.finishes.brightness, 1.3, 2);
      light.position.set(it.x * CM, (it.elev + it.h * 0.62) * CM, it.y * CM);
      this.ledGroup.add(light);
    }
    this.updateSelection();
  }

  /** Open or close doors and drawers: everything, or only the listed units. */
  setOpen(all: boolean, ids: string[]) {
    this.openAll = all;
    this.openIds = new Set(ids);
    this.dirty = true;
  }

  private openTarget(id: string): number {
    return this.openAll || this.openIds.has(id) ? 1 : 0;
  }

  /** Advance the opening animation; rebuilds only the units that are moving. */
  private stepOpen(dt: number) {
    const p = this.project;
    if (!p) return;
    let changed = false;
    const walls = getWalls(p.room);
    for (const it of p.items) {
      if (it.cat === 'appliance') continue;
      const cur = this.openNow.get(it.id) ?? 0;
      const target = this.openTarget(it.id);
      if (cur === target) continue;
      const next = target > cur ? Math.min(target, cur + dt * 3.2) : Math.max(target, cur - dt * 3.2);
      this.openNow.set(it.id, next);
      const idx = this.itemsGroup.children.findIndex((c) => c.userData.itemId === it.id);
      if (idx < 0) continue;
      const old = this.itemsGroup.children[idx];
      const g = buildItem(it, { rules: p.rules, fin: p.finishes, mats: this.mats, onWall: !!itemWall(it, walls), open: next });
      disposeGroup(old);
      this.itemsGroup.remove(old);
      this.itemsGroup.add(g);
      changed = true;
    }
    if (changed) {
      this.selection = null;
      this.updateSelection();
      this.renderer.shadowMap.needsUpdate = true;
      this.dirty = true;
    }
  }

  private updateSelection() {
    if (this.selection) {
      this.selection.parent?.remove(this.selection);
      this.selection.geometry.dispose();
      this.selection = null;
    }
    if (!this.selectedId || !this.project) return;
    const it = this.project.items.find((i) => i.id === this.selectedId);
    const g = this.itemsGroup.children.find((c) => c.userData.itemId === this.selectedId);
    if (!it || !g) return;
    const extra = it.opts.countertop ? this.project.finishes.countertopT : 0;
    const box = new THREE.BoxGeometry((it.w + 2) * CM, (it.h + extra + 2) * CM, (it.d + 4) * CM);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    const sel = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x0ea5a4, depthTest: false, transparent: true }));
    sel.position.set(0, ((it.h + extra) / 2) * CM, 0);
    sel.renderOrder = 10;
    g.add(sel);
    this.selection = sel;
  }

  // ------------------------------------------------------------------ camera
  private roomCenter(): THREE.Vector3 {
    const b = bounds(this.project!.room.points);
    return new THREE.Vector3(b.cx * CM, Math.min(1.1, (this.project!.room.height * CM) / 2), b.cy * CM);
  }

  /** The wall carrying the most cabinets — the natural "front" of the kitchen. */
  private mainWall(): Wall {
    const p = this.project!;
    const walls = getWalls(p.room);
    const score = walls.map(() => 0);
    for (const it of p.items) {
      const att = itemWall(it, walls);
      if (att) score[att.wall.i] += it.w;
    }
    let best = 0;
    for (let i = 1; i < walls.length; i++) if (score[i] > score[best] || (score[i] === score[best] && walls[i].len > walls[best].len && score[best] === 0)) best = i;
    return walls[best];
  }

  /** Direction (plan coordinates) from the room centre towards its open side, i.e. away from the cabinets. */
  private openSide(): { x: number; y: number } {
    const p = this.project!;
    const b = bounds(p.room.points);
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (const it of p.items) {
      sx += it.x * it.w;
      sy += it.y * it.w;
      sw += it.w;
    }
    if (sw > 0) {
      const vx = b.cx - sx / sw;
      const vy = b.cy - sy / sw;
      const l = Math.hypot(vx, vy);
      if (l > Math.min(b.w, b.h) * 0.06) return { x: vx / l, y: vy / l };
    }
    const w = this.mainWall();
    return { x: w.n.x, y: w.n.y };
  }

  fitCamera() {
    if (!this.project) return;
    this.fitted = true;
    const b = bounds(this.project.room.points);
    const c = this.roomCenter();
    const H = this.project.room.height * CM;
    const radius = Math.hypot(b.w * CM, b.h * CM, H) / 2;
    // stand on the open side of the kitchen, turned a little for a 3/4 view
    const open = this.openSide();
    const ang = Math.atan2(open.y, open.x) + 0.42;
    const dir = new THREE.Vector3(Math.cos(ang), 0.58, Math.sin(ang)).normalize();
    const aspect = this.camera.aspect || 1;
    const fovV = (this.camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
    const dist = (radius / Math.sin(Math.min(fovV, fovH) / 2)) * (aspect < 1 ? 0.86 : 0.98);
    this.camera.position.copy(c).addScaledVector(dir, dist);
    this.controls.target.copy(c);
    this.controls.update();
    this.dirty = true;
  }

  private retarget() {
    this.controls.target.copy(this.roomCenter());
    this.controls.update();
  }

  private setNear(near: number) {
    if (this.camera.near === near) return;
    this.camera.near = near;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  setView(preset: ViewPreset) {
    if (!this.project) return;
    if (this.mode === 'walk') this.setMode('orbit');
    this.setNear(0.05);
    const c = this.roomCenter();
    const b = bounds(this.project.room.points);
    const size = Math.max(b.w, b.h) * CM;
    const aspect = this.camera.aspect || 1;
    if (preset === 'iso') {
      this.wallCycle = -1;
      this.fitCamera();
      return;
    }
    if (preset === 'top') {
      // same orientation as the 2D plan: first wall at the top of the screen
      this.controls.target.set(c.x, 0, c.z);
      this.camera.position.set(c.x, size * (aspect < 1 ? 2.6 : 1.7) + 1.5, c.z + 0.01);
    } else {
      const walls = getWalls(this.project.room);
      const withItems = walls.filter((w) => this.project!.items.some((it) => itemWall(it, [w])));
      const list = withItems.length ? withItems : walls;
      this.wallCycle = (this.wallCycle + 1) % list.length;
      const w = list[this.wallCycle];
      const mid = { x: ((w.a.x + w.b.x) / 2) * CM, z: ((w.a.y + w.b.y) / 2) * CM };
      const fovV = (this.camera.fov * Math.PI) / 180;
      const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
      const need = Math.max((w.len * CM) / 2 / Math.tan(fovH / 2), (this.project.room.height * CM) / 2 / Math.tan(fovV / 2)) * 1.12 + 0.3;
      this.controls.target.set(mid.x, (this.project.room.height * CM) / 2 - 0.15, mid.z);
      this.camera.position.set(mid.x + w.n.x * need, (this.project.room.height * CM) / 2, mid.z + w.n.y * need);
      // section cut: hide whatever stands between the viewer and this wall's units (e.g. the opposite run)
      this.setNear(Math.max(0.05, need - 1.25));
    }
    this.controls.update();
    this.dirty = true;
  }

  zoom(factor: number) {
    if (this.mode !== 'orbit') return;
    const t = this.controls.target;
    const v = this.camera.position.clone().sub(t).multiplyScalar(factor);
    const len = v.length();
    if (len < this.controls.minDistance || len > this.controls.maxDistance) return;
    this.camera.position.copy(t).add(v);
    this.controls.update();
    this.dirty = true;
  }

  // ------------------------------------------------------------------ walk mode
  setMode(mode: ViewMode) {
    if (mode === this.mode || !this.project) return;
    this.mode = mode;
    this.setNear(0.05);
    if (mode === 'walk') {
      this.savedOrbit = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
      this.controls.enabled = false;
      this.camera.fov = 68;
      this.camera.updateProjectionMatrix();
      // start on the open side of the kitchen, looking back at the cabinets
      const open = this.openSide();
      const start = this.findStandPoint(open);
      const eye = Math.min(160, this.project.room.height - 30) * CM;
      this.camera.position.set(start.x * CM, eye, start.y * CM);
      this.yaw = Math.atan2(open.x, open.y);
      this.pitch = -0.08;
      this.camera.rotation.order = 'YXZ';
      this.applyWalkCamera();
    } else {
      this.move = { x: 0, y: 0 };
      this.keys.clear();
      this.camera.fov = 45;
      this.camera.updateProjectionMatrix();
      this.controls.enabled = true;
      if (this.savedOrbit) {
        this.camera.position.copy(this.savedOrbit.pos);
        this.controls.target.copy(this.savedOrbit.target);
      }
      this.controls.update();
    }
    this.dirty = true;
  }

  setMove(x: number, y: number) {
    this.move.x = x;
    this.move.y = y;
  }

  private applyWalkCamera() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.dirty = true;
  }

  private canStand(x: number, y: number): boolean {
    const p = this.project!;
    const pt = { x, y };
    if (!pointInPolygon(pt, p.room.points)) return false;
    if (distToPolygon(pt, p.room.points) < 22) return false;
    for (const c of p.room.columns) {
      if (pointInPolygon(pt, columnCorners({ ...c, w: c.w + 36, d: c.d + 36 }))) return false;
    }
    for (const it of p.items) {
      if (it.elev > 150) continue;
      if (pointInPolygon(pt, itemCorners({ ...it, w: it.w + 30, d: it.d + 30 }))) return false;
    }
    return true;
  }

  private findStandPoint(open: { x: number; y: number }): { x: number; y: number } {
    const p = this.project!;
    const b = bounds(p.room.points);
    // walk out from the centre towards the open side and keep the farthest free spot
    const reach = Math.max(b.w, b.h) / 2;
    for (let t = reach; t >= 0; t -= 10) {
      const x = b.cx + open.x * t;
      const y = b.cy + open.y * t;
      if (this.canStand(x, y) && distToPolygon({ x, y }, p.room.points) > 45) return { x, y };
    }
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let i = 1; i < 14; i++)
      for (let j = 1; j < 14; j++) {
        const x = b.minX + (b.w * i) / 14;
        const y = b.minY + (b.h * j) / 14;
        if (!this.canStand(x, y)) continue;
        const d = Math.hypot(x - b.cx, y - b.cy);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    return best ?? { x: b.cx, y: b.cy };
  }

  private walkStep(mx: number, my: number, dt: number) {
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const speed = 170; // cm/s
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const dx = (fx * my + rx * mx) * speed * dt;
    const dz = (fz * my + rz * mx) * speed * dt;
    const x = this.camera.position.x / CM;
    const z = this.camera.position.z / CM;
    let nx = x;
    let nz = z;
    if (this.canStand(x + dx, z + dz)) {
      nx = x + dx;
      nz = z + dz;
    } else if (this.canStand(x + dx, z)) nx = x + dx;
    else if (this.canStand(x, z + dz)) nz = z + dz;
    if (nx !== x || nz !== z) {
      this.camera.position.x = nx * CM;
      this.camera.position.z = nz * CM;
      this.dirty = true;
    }
  }

  // ------------------------------------------------------------------ output
  /** Render the current view to an image (JPEG data URL). */
  snapshot(w = 1280, h = 800, quality = 0.9): string {
    const size = this.renderer.getSize(new THREE.Vector2());
    const pr = this.renderer.getPixelRatio();
    const aspect = this.camera.aspect;
    const bg = this.scene.background;
    const sel = this.selection;
    if (sel) sel.visible = false;
    this.scene.background = new THREE.Color('#eef1f4');
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.shadowMap.needsUpdate = true;
    this.updateWallVisibility();
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/jpeg', quality);
    this.scene.background = bg;
    if (sel) sel.visible = true;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(size.x, size.y, false);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
    return url;
  }

  /** Set an explicit size for off-screen use (no container layout). */
  setSize(w: number, h: number) {
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private prepareExport(): () => void {
    const hidden: THREE.Object3D[] = [];
    for (const w of this.walls)
      if (!w.group.visible) {
        w.group.visible = true;
        hidden.push(w.group);
      }
    const sel = this.selection;
    if (sel) sel.visible = false;
    return () => {
      hidden.forEach((h) => (h.visible = false));
      if (sel) sel.visible = true;
      this.dirty = true;
    };
  }

  async exportGLB(): Promise<ArrayBuffer> {
    const restore = this.prepareExport();
    try {
      const exporter = new GLTFExporter();
      const res = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          this.world,
          (out) => resolve(out as ArrayBuffer),
          (err) => reject(err),
          { binary: true, onlyVisible: true },
        );
      });
      return res;
    } finally {
      restore();
    }
  }

  exportOBJ(): string {
    const restore = this.prepareExport();
    try {
      this.world.updateMatrixWorld(true);
      return new OBJExporter().parse(this.world);
    } finally {
      restore();
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    this.controls.dispose();
    this.clear(this.roomGroup);
    this.clear(this.itemsGroup);
    this.mats.dispose();
    this.utilMats.forEach((m) => m.dispose());
    this.envTex?.dispose();
    this.renderer.dispose();
    try {
      this.renderer.forceContextLoss();
    } catch {
      /* ignore */
    }
    this.renderer.domElement.remove();
  }
}

/** Render a project off-screen (used for PDF covers and thumbnails). */
export function renderProjectImage(p: Project, w = 1600, h = 1000, preset: ViewPreset = 'iso'): string {
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:-99999px;top:0;width:${w}px;height:${h}px;`;
  document.body.appendChild(holder);
  const sm = new SceneManager(holder, true);
  try {
    sm.setSize(w, h);
    sm.setProject(p, null);
    if (preset !== 'iso') sm.setView(preset);
    return sm.snapshot(w, h, 0.9);
  } finally {
    sm.dispose();
    holder.remove();
  }
}

/** Export a project as a 3D file without needing the 3D tab to be open. */
export async function exportProject3D(p: Project, format: 'glb' | 'obj'): Promise<Blob> {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:640px;height:480px;';
  document.body.appendChild(holder);
  const sm = new SceneManager(holder, true);
  try {
    sm.setSize(640, 480);
    sm.setProject(p, null);
    if (format === 'glb') return new Blob([await sm.exportGLB()], { type: 'model/gltf-binary' });
    return new Blob([sm.exportOBJ()], { type: 'text/plain' });
  } finally {
    sm.dispose();
    holder.remove();
  }
}
