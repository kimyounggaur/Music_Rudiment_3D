import {
  BoxGeometry, BufferGeometry, CanvasTexture, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, SRGBColorSpace, Uint32BufferAttribute,
} from 'three';
import type { Object3D } from 'three';
import { createInkUniforms, createPen, INK, InkLines } from './inkLines.ts';
import type { InkSegment, InkUniforms, PenSlot, Vec3 } from './inkLines.ts';
import { createPaperFillDepthMaterial, createPaperFillMaterial, PAPER_FILL } from './paperFill.ts';
import type { PaperFillMaterial } from './paperFill.ts';

/**
 * v3 R4 ink figure builder (REFACTOR_DESIGN_V3 §6 R4 (3)). A figure is drawn on the page: every
 * shape has a standing position and a flat position on the paper (by default its plan, (x, paper,
 * z)), ink edges scheduled by a pen, paper-filled faces that follow the lift, and invisible pick
 * boxes fixed at the standing position.
 *
 * Coordinates are figure-local. `surface(x)` is the paper height under x (the curved page), so flat
 * drawings lie on the paper and solids stand on it, bending with the page.
 */
export type FigureSurface = (x: number) => number;
export type FigureOptions = Readonly<{
  hatch?: boolean;
  surface?: FigureSurface;
  /** Flat drawing: z shift toward the far edge (−z) per unit of height. 0 = plan view (design default). */
  fold?: number;
  /** Flat ink height above the paper (figure units). */
  floor?: number;
  /** Longest straight piece along x before a curved page needs a subdivision (figure units). */
  step?: number;
  /** Initial ink segment capacity. */
  capacity?: number;
  /** Dash pattern scale (dash and gap are INK sizes in figure units; a world-unit figure scales them down). */
  dash?: number;
}>;
export type BoxSpec = Readonly<{ x0: number; x1: number; z0: number; z1: number; height: number; y0?: number }>;
export type BoxOptions = Readonly<{
  fill?: boolean; edges?: 'solid' | 'dashed' | 'none'; key?: string;
  /** Ink density bias toward the paper for all edges, and extra for the far (z0) edges. */
  tone?: number; backTone?: number;
}>;
export type LineOptions = Readonly<{
  closed?: boolean; dashed?: boolean;
  /** Printed on the paper: drawn flat and stays there when the figure lifts. */
  onPaper?: boolean;
  /** Per-line flat fold (negative folds toward the reader, like a pop-up card hinged at its base). */
  fold?: number;
  tone?: number;
}>;
export type LabelOptions = Readonly<{ size?: number; align?: 'left' | 'center' | 'right' }>;
export type HitBox = Readonly<{ x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }>;

export interface FigureBuilder {
  /** A polyline in pen order. */
  line(points: readonly Vec3[], options?: LineOptions): void;
  /** Paper-filled box with its 12 ink edges (bottom outline, then verticals, then top). */
  box(spec: BoxSpec, options?: BoxOptions): void;
  /** Ink text printed on the paper (stays flat). */
  label(text: string, position: Vec3, options?: LabelOptions): void;
  /** Invisible pick box at the standing position (never moves with the lift). */
  hit(id: string, box: HitBox, userData?: Record<string, unknown>): Mesh;
  /** A breath in the pen schedule between groups of strokes. */
  pause(amount?: number): void;
}

export type FigureStats = Readonly<{ segments: number; ink: number; dashed: number; accent: number; fills: number; hits: number; labels: number }>;

/** What the stage drives on a borrowed scene group (lift/reveal from BookApp's timeline, ink width from the viewport). */
export interface FigureControls {
  setLift(t: number): void;
  setReveal(t: number): void;
  setResolution(width: number, height: number): void;
  stats(): FigureStats;
}
const CONTROLS = new WeakMap<Object3D, FigureControls>();
export function attachFigureControls(object: Object3D, controls: FigureControls): void { CONTROLS.set(object, controls); }
export function figureControlsOf(object: Object3D | null | undefined): FigureControls | null { return object ? CONTROLS.get(object) ?? null : null; }
export function sumFigureStats(list: readonly FigureStats[]): FigureStats {
  const keys = ['segments', 'ink', 'dashed', 'accent', 'fills', 'hits', 'labels'] as const;
  return Object.fromEntries(keys.map(key => [key, list.reduce((total, stats) => total + stats[key], 0)])) as FigureStats;
}

export interface InkFigure extends FigureControls {
  readonly figureId: string;
  readonly group: Group;
  /** Stable array of pick meshes (updated in place by rebuild). */
  readonly hitTargets: Mesh[];
  readonly uniforms: InkUniforms;
  readonly fill: Mesh;
  readonly lines: Readonly<{ ink: InkLines; dashed: InkLines; accent: InkLines; accentDashed: InkLines }>;
  /** Replace the drawn content; materials and line buffers are reused. */
  rebuild(build: (builder: FigureBuilder) => void): void;
  /** Accent overlay (selection): always fully drawn, lifts with the figure. */
  setAccent(build: ((builder: FigureBuilder) => void) | null): void;
  /** Light one keyed box (the playing note); null clears. */
  setGlow(key: string | null, amount?: number): void;
  readonly lift: number;
  readonly reveal: number;
  readonly glowKey: string | null;
  dispose(): void;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (edge0: number, edge1: number, value: number) => { const t = clamp01((value - edge0) / (edge1 - edge0)); return t * t * (3 - 2 * t); };
const distance = (a: Vec3, b: Vec3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

type RawSegment = { start: Vec3; end: Vec3; flatStart: Vec3; flatEnd: Vec3; t0: number; dur: number; tone: number };
type FillRange = { start: number; end: number; slot: PenSlot | null };
type FillData = { positions: number[]; flats: number[]; normals: number[]; glow: number[]; index: number[]; keys: Map<string, [number, number]>; ranges: FillRange[] };
type LabelSpec = { text: string; position: Vec3; size: number; align: 'left' | 'center' | 'right' };
type Collected = { ink: RawSegment[]; dashed: RawSegment[]; fill: FillData; labels: LabelSpec[]; hits: Mesh[] };
const collected = (): Collected => ({ ink: [], dashed: [], fill: { positions: [], flats: [], normals: [], glow: [], index: [], keys: new Map(), ranges: [] }, labels: [], hits: [] });

export const LABEL_PX_PER_UNIT = 96;

export function createInkFigure(figureId: string, options: FigureOptions = {}): InkFigure {
  const surface = options.surface ?? (() => 0);
  const curved = !!options.surface;
  const defaultFold = options.fold ?? 0;
  const floor = options.floor ?? INK.floor;
  const step = options.step ?? 0.5;
  const uniforms = createInkUniforms(1, 1);
  const accentUniforms = createInkUniforms(1, 1);
  const group = new Group();
  group.name = `ink-figure-${figureId}`;
  const ink = new InkLines(uniforms, { capacity: options.capacity ?? INK.capacity, name: `${figureId}-ink` });
  const dash = options.dash ?? 1;
  const dashes = { dashed: true, dashSize: INK.dashSize * dash, gapSize: INK.gapSize * dash } as const;
  const dashed = new InkLines(uniforms, { ...dashes, capacity: 64, name: `${figureId}-ink-dashed` });
  const accent = new InkLines(accentUniforms, { color: INK.accent, width: INK.accentWidth, capacity: 32, name: `${figureId}-accent` });
  const accentDashed = new InkLines(accentUniforms, { ...dashes, color: INK.accent, width: INK.accentWidth, capacity: 32, name: `${figureId}-accent-dashed` });
  const allLines = [ink, dashed, accent, accentDashed];
  const fillMaterial: PaperFillMaterial = createPaperFillMaterial({ hatch: options.hatch ?? true, reveal: uniforms.uReveal });
  const fillDepth = createPaperFillDepthMaterial(uniforms.uReveal);
  const fill = new Mesh(new BufferGeometry(), fillMaterial);
  fill.name = `${figureId}-fill`;
  fill.customDepthMaterial = fillDepth;
  fill.receiveShadow = true;
  fill.visible = false;
  const hitGeometry = new BoxGeometry(1, 1, 1);
  const hitMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  hitMaterial.name = 'ink-figure-hit';
  const labelMaterial = new MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  labelMaterial.name = 'ink-figure-labels';
  let labelMesh: Mesh | null = null;
  let labelTexture: CanvasTexture | null = null;
  let labelSpecs: LabelSpec[] = [];
  const hitTargets: Mesh[] = [];
  let fillKeys = new Map<string, [number, number]>();
  let glowKey: string | null = null;
  let glowAmount: number = PAPER_FILL.glowAmount;
  let lift = 1, reveal = 1;
  let disposed = false;
  group.add(fill, ...allLines.map(lines => lines.object));

  const flatPoint = (x: number, y: number, z: number, base: number, fold: number): Vec3 => [x, surface(x) + floor, z - Math.max(0, y - base) * fold];
  const stand = (x: number, y: number, z: number): Vec3 => [x, surface(x) + y, z];
  /** x stations of a straight run, so long runs follow the curved page. */
  const stations = (x0: number, x1: number) => {
    const count = curved ? Math.max(1, Math.ceil(Math.abs(x1 - x0) / step)) : 1;
    return Array.from({ length: count + 1 }, (_, index) => x0 + (x1 - x0) * index / count);
  };

  function collector(target: Collected, pen: ReturnType<typeof createPen> | null): FigureBuilder {
    const schedule = (length: number): PenSlot => pen ? pen.next(length) : { t0: 0, dur: 0 };
    type Station = { stand: Vec3; flat: Vec3 };
    /** One pen stroke over the whole run: each piece gets its share of the stroke's time. */
    const pushRun = (list: RawSegment[], points: readonly Station[], slot: PenSlot, tone: number) => {
      const lengths = points.slice(1).map((point, index) => distance(points[index]!.stand, point.stand));
      const total = lengths.reduce((sum, value) => sum + value, 0);
      let cursor = slot.t0;
      points.slice(1).forEach((point, index) => {
        const dur = total > 0 ? slot.dur * lengths[index]! / total : slot.dur / lengths.length;
        list.push({ start: points[index]!.stand, end: point.stand, flatStart: points[index]!.flat, flatEnd: point.flat, t0: cursor, dur, tone });
        cursor += dur;
      });
    };
    /** Straight piece from a to b, subdivided along x on a curved page. */
    const run = (a: Vec3, b: Vec3, base: number, fold: number, onPaper: boolean): Station[] => {
      const xs = a[0] !== b[0] ? stations(a[0], b[0]) : [a[0], b[0]];
      return xs.map((x, index) => {
        const t = xs.length > 1 ? index / (xs.length - 1) : 0;
        const y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
        if (onPaper) { const p: Vec3 = [x, surface(x) + floor + y, z]; return { stand: p, flat: p }; }
        return { stand: stand(x, y, z), flat: flatPoint(x, y, z, base, fold) };
      });
    };
    return {
      line(points, lineOptions = {}) {
        if (points.length < 2) return;
        const list = lineOptions.dashed ? target.dashed : target.ink;
        const path = lineOptions.closed && points.length > 2 ? [...points, points[0]!] : points;
        const fold = lineOptions.fold ?? defaultFold;
        const stationsList: Station[] = [];
        path.slice(1).forEach((point, index) => {
          const piece = run(path[index]!, point, 0, fold, !!lineOptions.onPaper);
          stationsList.push(...(index === 0 ? piece : piece.slice(1)));
        });
        const length = path.slice(1).reduce((sum, point, index) => sum + distance(path[index]!, point), 0);
        pushRun(list, stationsList, schedule(length), Math.max(0, lineOptions.tone ?? 0));
      },
      box(spec, boxOptions = {}) {
        const { x0, x1, z0, z1, height } = spec;
        const y0 = spec.y0 ?? 0, y1 = y0 + height;
        const edgeList = boxOptions.edges === 'dashed' ? target.dashed : boxOptions.edges === 'none' ? null : target.ink;
        const tone = Math.max(0, boxOptions.tone ?? 0);
        const backTone = Math.min(1, tone + Math.max(0, boxOptions.backTone ?? 0));
        let lastSlot: PenSlot | null = null;
        if (edgeList) {
          const edge = (a: Vec3, b: Vec3) => {
            lastSlot = schedule(distance(a, b));
            pushRun(edgeList, run(a, b, y0, defaultFold, false), lastSlot, a[2] === z0 && b[2] === z0 ? backTone : tone);
          };
          // Bottom outline, verticals, then the top: the order a hand draws a box.
          edge([x0, y0, z1], [x1, y0, z1]); edge([x1, y0, z1], [x1, y0, z0]); edge([x1, y0, z0], [x0, y0, z0]); edge([x0, y0, z0], [x0, y0, z1]);
          edge([x0, y0, z1], [x0, y1, z1]); edge([x1, y0, z1], [x1, y1, z1]); edge([x1, y0, z0], [x1, y1, z0]); edge([x0, y0, z0], [x0, y1, z0]);
          edge([x0, y1, z1], [x1, y1, z1]); edge([x1, y1, z1], [x1, y1, z0]); edge([x1, y1, z0], [x0, y1, z0]); edge([x0, y1, z0], [x0, y1, z1]);
        }
        if (boxOptions.fill === false) return;
        const f = target.fill;
        const startVertex = f.positions.length / 3;
        const face = (corner: (u: number, v: number) => Vec3, normal: Vec3, columns: number) => {
          const base = f.positions.length / 3;
          for (let row = 0; row <= 1; row += 1) for (let column = 0; column <= columns; column += 1) {
            const [x, y, z] = corner(column / columns, row);
            f.positions.push(...stand(x, y, z));
            f.flats.push(...flatPoint(x, y, z, y0, defaultFold));
            f.normals.push(...normal);
            f.glow.push(0);
          }
          for (let column = 0; column < columns; column += 1) {
            const a = base + column, b = a + 1, c = a + columns + 1, d = c + 1;
            // Counter-clockwise seen from the side the normal points to.
            f.index.push(a, b, c, b, d, c);
          }
        };
        const columns = stations(x0, x1).length - 1;
        const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
        face((u, v) => [x0 + dx * u, y1, z1 - dz * v], [0, 1, 0], columns);
        face((u, v) => [x0 + dx * u, y0 + dy * v, z1], [0, 0, 1], columns);
        face((u, v) => [x1 - dx * u, y0 + dy * v, z0], [0, 0, -1], columns);
        face((u, v) => [x0, y0 + dy * v, z0 + dz * u], [-1, 0, 0], 1);
        face((u, v) => [x1, y0 + dy * v, z1 - dz * u], [1, 0, 0], 1);
        // A closed solid: the default (back-face) shadow pass needs the bottom too.
        face((u, v) => [x0 + dx * u, y0, z0 + dz * v], [0, -1, 0], columns);
        if (boxOptions.key) f.keys.set(boxOptions.key, [startVertex, f.positions.length / 3]);
        // The faces appear when the pen finishes this box's outline.
        f.ranges.push({ start: startVertex, end: f.positions.length / 3, slot: lastSlot });
      },
      label(text, position, labelOptions = {}) {
        target.labels.push({ text, position, size: labelOptions.size ?? 0.3, align: labelOptions.align ?? 'center' });
      },
      hit(id, box, userData = {}) {
        const mesh = new Mesh(hitGeometry, hitMaterial);
        mesh.name = `${figureId}-hit-${id}`;
        // Pick boxes stand at the standing position on the paper, whatever the lift.
        const mid = (box.x0 + box.x1) / 2;
        const paper = (surface(box.x0) + surface(mid) + surface(box.x1)) / 3;
        mesh.scale.set(Math.max(1e-6, box.x1 - box.x0), Math.max(1e-6, box.y1 - box.y0), Math.max(1e-6, box.z1 - box.z0));
        mesh.position.set(mid, paper + (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2);
        mesh.visible = false;
        Object.assign(mesh.userData, userData, { hitId: id });
        target.hits.push(mesh);
        return mesh;
      },
      pause(amount = 0.15) { pen?.pause(amount); },
    };
  }

  const toSegments = (raw: readonly RawSegment[], total: number): InkSegment[] =>
    raw.map(segment => ({ ...segment, t0: segment.t0 / total, dur: segment.dur / total }));

  function writeFill(data: FillData): void {
    const geometry = new BufferGeometry();
    const thresholds = new Float32Array(data.positions.length / 3);
    // Slots were normalised in place by the pen.
    for (const range of data.ranges) thresholds.fill(range.slot ? Math.min(1, range.slot.t0 + range.slot.dur) : 0, range.start, range.end);
    geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('inkGlow', new Float32BufferAttribute(data.glow, 1));
    geometry.setAttribute('inkReveal', new Float32BufferAttribute(thresholds, 1));
    geometry.setIndex(new Uint32BufferAttribute(data.index, 1));
    // Absolute morph target 0 = the flat drawing; influence = 1 − lift.
    geometry.morphAttributes.position = [new Float32BufferAttribute(data.flats, 3)];
    geometry.computeBoundingSphere();
    fill.geometry.dispose();
    fill.geometry = geometry;
    fill.updateMorphTargets();
    fillKeys = data.keys;
  }

  function writeLabels(labels: LabelSpec[]): void {
    labelSpecs = labels;
    labelMesh?.removeFromParent();
    labelMesh?.geometry.dispose();
    labelTexture?.dispose();
    labelMesh = null; labelTexture = null;
    if (!labels.length || typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    const font = (label: LabelSpec) => `600 ${Math.round(label.size * LABEL_PX_PER_UNIT)}px "Book Sans", sans-serif`;
    // The strip spans the measured text (left/centre/right aligned), plus a margin.
    const margin = 0.4;
    const spans = labels.map(label => {
      context.font = font(label);
      const width = context.measureText(label.text).width / LABEL_PX_PER_UNIT;
      const left = label.position[0] - (label.align === 'center' ? width / 2 : label.align === 'right' ? width : 0);
      return [left, left + width] as const;
    });
    const minX = Math.min(...spans.map(span => span[0])) - margin, maxX = Math.max(...spans.map(span => span[1])) + margin;
    const minZ = Math.min(...labels.map(label => label.position[2])) - margin, maxZ = Math.max(...labels.map(label => label.position[2])) + margin;
    canvas.width = Math.min(4096, Math.ceil((maxX - minX) * LABEL_PX_PER_UNIT));
    canvas.height = Math.min(1024, Math.ceil((maxZ - minZ) * LABEL_PX_PER_UNIT));
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    const paint = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = INK.color;
      context.textBaseline = 'middle';
      for (const label of labels) {
        context.font = font(label);
        context.textAlign = label.align;
        context.fillText(label.text, (label.position[0] - minX) / (maxX - minX) * canvas.width, (label.position[2] - minZ) / (maxZ - minZ) * canvas.height);
      }
      texture.needsUpdate = true;
    };
    paint();
    // Book Sans is normally loaded with the prints; repaint once if a cold start raced it.
    void document.fonts?.ready.then(() => { if (!disposed && labelTexture === texture) paint(); });
    labelTexture = texture;
    labelMaterial.map = texture;
    labelMaterial.needsUpdate = true;
    // A strip on the paper, subdivided along x to follow the curved page.
    const xs = stations(minX, maxX);
    const columns = xs.length - 1;
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], index: number[] = [];
    for (let row = 0; row <= 1; row += 1) xs.forEach((x, column) => {
      positions.push(x, surface(x) + floor * 1.5, row ? maxZ : minZ);
      // A real normal: the AO pass draws this strip with its normal material (none = black band).
      normals.push(0, 1, 0);
      uvs.push(column / columns, 1 - row);
    });
    for (let column = 0; column < columns; column += 1) {
      const a = column, b = a + 1, c = a + columns + 1, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    labelMesh = new Mesh(geometry, labelMaterial);
    labelMesh.name = `${figureId}-labels`;
    labelMesh.renderOrder = 1;
    group.add(labelMesh);
  }

  function applyLift(): void {
    uniforms.uLift.value = lift;
    accentUniforms.uLift.value = lift;
    if (fill.morphTargetInfluences) fill.morphTargetInfluences[0] = 1 - lift;
    // The flat drawing is pure ink; faces join as the figure stands up.
    fill.visible = lift > 0.02 && reveal > 0 && (fill.geometry.index?.count ?? 0) > 0;
    // Shadows only once the figure clearly stands (design: lift ≥ 0.3).
    fill.castShadow = lift >= 0.3;
  }
  function applyReveal(): void {
    uniforms.uReveal.value = reveal;
    // The selection is marked on a finished drawing, not ahead of the pen.
    accentUniforms.uReveal.value = reveal >= 1 ? 1 : 0;
    labelMaterial.opacity = smooth(0.1, 0.45, reveal);
    if (labelMesh) labelMesh.visible = reveal > 0;
    applyLift();
  }

  const figure: InkFigure = {
    figureId, group, hitTargets, uniforms, fill,
    lines: { ink, dashed, accent, accentDashed },
    get lift() { return lift; },
    get reveal() { return reveal; },
    get glowKey() { return glowKey; },
    rebuild(build) {
      if (disposed) throw new Error(`Figure ${figureId} was disposed.`);
      const target = collected();
      const pen = createPen();
      build(collector(target, pen));
      const total = pen.finalize();
      ink.set(toSegments(target.ink, total));
      dashed.set(toSegments(target.dashed, total));
      writeFill(target.fill);
      for (const mesh of hitTargets) mesh.removeFromParent();
      hitTargets.length = 0;
      for (const mesh of target.hits) { group.add(mesh); hitTargets.push(mesh); }
      writeLabels(target.labels);
      if (glowKey) figure.setGlow(glowKey, glowAmount);
      applyReveal();
      group.updateMatrixWorld(true);
    },
    setAccent(build) {
      if (disposed) return;
      const target = collected();
      if (build) build(collector(target, null));
      accent.set(toSegments(target.ink, 1));
      accentDashed.set(toSegments(target.dashed, 1));
    },
    setLift(value) { if (disposed) return; lift = clamp01(value); applyLift(); },
    setReveal(value) { if (disposed) return; reveal = clamp01(value); applyReveal(); },
    setResolution(width, height) { for (const lines of allLines) lines.setResolution(width, height); },
    setGlow(key, amount = PAPER_FILL.glowAmount) {
      if (disposed) return;
      const glow = fill.geometry.getAttribute('inkGlow');
      glowKey = key;
      glowAmount = amount;
      if (!glow) return;
      const array = glow.array as Float32Array;
      array.fill(0);
      const range = key ? fillKeys.get(key) : undefined;
      if (range) array.fill(amount, range[0], range[1]);
      glow.needsUpdate = true;
    },
    stats: () => ({ segments: ink.count + dashed.count + accent.count + accentDashed.count, ink: ink.count, dashed: dashed.count,
      accent: accent.count + accentDashed.count, fills: fillKeys.size, hits: hitTargets.length, labels: labelSpecs.length }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const lines of allLines) lines.dispose();
      fill.geometry.dispose();
      fillMaterial.dispose();
      fillDepth.dispose();
      hitGeometry.dispose();
      hitMaterial.dispose();
      labelMesh?.geometry.dispose();
      labelTexture?.dispose();
      labelMaterial.dispose();
      hitTargets.length = 0;
      group.removeFromParent();
      group.clear();
    },
  };
  return figure;
}
