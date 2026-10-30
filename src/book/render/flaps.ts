import {
  BackSide, BufferGeometry, CanvasTexture, Float32BufferAttribute, FrontSide, Mesh, MeshStandardMaterial, SRGBColorSpace,
} from 'three';
import type { Object3D } from 'three';
import { BOOK_MOTION, smoothStep } from '../motion.ts';

/**
 * v3 R5 paper flaps (REFACTOR_DESIGN_V3 §6 R5 (3)). A small sheet of paper lies over a page's
 * answer area, hinged on its top edge, and lifts 0 → 110° over BOOK_MOTION.flap ms when the flap's
 * hint opens. The print already shows the closed flap (or the uncovered content), so a closed flap
 * at rest is not drawn; the sheet appears while it moves and stands while the flap is open.
 * Geometry lives in the page mesh's own frame: x = u·width, y = the page's curve, z = (v − ½)·height.
 */
export const FLAP = Object.freeze({ openDeg: 110, lift: 0.0015, columns: 12, canvasWidth: 512 });

export type StageFlap = Readonly<{
  key: string;
  side: 'left' | 'right';
  /** Page-local rect: u from the left edge, v from the top edge (print orientation), 0..1. */
  rect: Readonly<{ u0: number; v0: number; u1: number; v1: number }>;
  open: boolean;
  /** Printed on the closed sheet (the same words as the print's closed flap). */
  hint: string;
  /** Printed on the sheet's back, which faces the reader while the flap stands open. */
  foldHint: string;
}>;
export type FlapPage = Readonly<{ mesh: Object3D; width: number; height: number; surface: (u: number) => number }>;

type Entry = {
  spec: StageFlap;
  front: Mesh;
  back: Mesh;
  geometry: BufferGeometry;
  texture: CanvasTexture | null;
  backTexture: CanvasTexture | null;
  angle: number;
  from: number;
  to: number;
  start: number;
};

export interface FlapLayer {
  /** Replace the spread's flaps; a flap whose `open` changed animates from where it is (`instant`: reduced motion). */
  set(flaps: readonly StageFlap[], pages: Readonly<{ left: FlapPage; right: FlapPage }>, instant?: boolean): void;
  /** Advance to `time`; true while a flap is still moving. */
  update(time: number, pages: Readonly<{ left: FlapPage; right: FlapPage }>): boolean;
  setVisible(visible: boolean): void;
  /** key → current angle in degrees (inspection, tests). */
  angles(): Readonly<Record<string, number>>;
  /** DEV: pin moving flaps `ms` after their start (captures under a slow renderer); null resumes real time. */
  hold(ms: number | null): void;
  /** Sheets the reader can see (a raycast on them presses the flap). */
  targets(): Object3D[];
  /** The flap key of a sheet mesh from `targets()`. */
  keyOf(object: Object3D): string | null;
  dispose(): void;
}

const OPEN = FLAP.openDeg * Math.PI / 180;

function sheetTexture(spec: StageFlap, page: FlapPage, side: 'front' | 'back'): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const aspect = ((spec.rect.v1 - spec.rect.v0) * page.height) / Math.max(1e-6, (spec.rect.u1 - spec.rect.u0) * page.width);
  canvas.width = FLAP.canvasWidth;
  canvas.height = Math.max(16, Math.round(FLAP.canvasWidth * aspect));
  const context = canvas.getContext('2d');
  if (!context) return null;
  if (side === 'back') {
    // Seen from behind and standing up, the sheet shows its texture turned by 180°.
    context.translate(canvas.width, canvas.height);
    context.rotate(Math.PI);
  }
  // Front: the same look as the printed closed flap (warm paper, a fold line along the hinge, the hint).
  // Back: the plain back of the sheet with how to fold it down again.
  context.fillStyle = side === 'front' ? '#f4eee0' : '#e9e0cc';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = side === 'front' ? '#c9c1ad' : '#bfb59d';
  context.lineWidth = 2;
  context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  context.setLineDash([7, 6]);
  context.beginPath(); context.moveTo(8, 6); context.lineTo(canvas.width - 8, 6); context.stroke();
  context.setLineDash([]);
  context.fillStyle = side === 'front' ? '#6a6f6b' : '#5d5547';
  context.font = `600 ${Math.max(10, Math.round(canvas.height * 0.18))}px "Book Sans", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(side === 'front' ? spec.hint : spec.foldHint, canvas.width / 2, canvas.height / 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function writeGeometry(entry: Entry, page: FlapPage): void {
  const { u0, v0, u1, v1 } = entry.spec.rect;
  const columns = FLAP.columns;
  const position = entry.geometry.getAttribute('position');
  const normal = entry.geometry.getAttribute('normal');
  const depth = (v1 - v0) * page.height;
  const zHinge = (v0 - 0.5) * page.height;
  const sin = Math.sin(entry.angle), cos = Math.cos(entry.angle);
  for (let column = 0; column <= columns; column += 1) {
    const u = u0 + (u1 - u0) * column / columns;
    const x = u * page.width, y = page.surface(u) + FLAP.lift;
    // Row 0 is the hinge; row 1 the free edge, swung up about the hinge (toward −z past 90°).
    position.setXYZ(column, x, y, zHinge);
    position.setXYZ(columns + 1 + column, x, y + depth * sin, zHinge + depth * cos);
    for (const row of [0, 1]) normal.setXYZ(row * (columns + 1) + column, 0, cos, -sin);
  }
  position.needsUpdate = true;
  normal.needsUpdate = true;
  // Both bounds: the raycast tests the box when one exists, and the stage's fit reads boxes.
  entry.geometry.computeBoundingBox();
  entry.geometry.computeBoundingSphere();
}

export function createFlapLayer(): FlapLayer {
  const entries = new Map<string, Entry>();
  let visible = false;
  let disposed = false;
  let held: number | null = null;

  const pageOf = (pages: Readonly<{ left: FlapPage; right: FlapPage }>, side: 'left' | 'right') => side === 'left' ? pages.left : pages.right;
  const show = (entry: Entry, moving: boolean) => {
    const on = visible && (moving || entry.angle > 1e-3);
    entry.front.visible = on;
    entry.back.visible = on;
    entry.front.castShadow = on && entry.angle > 0.2;
  };

  function create(spec: StageFlap, page: FlapPage): Entry {
    const columns = FLAP.columns;
    const geometry = new BufferGeometry();
    const count = (columns + 1) * 2;
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(new Float32Array(count * 3), 3));
    const uv: number[] = [], index: number[] = [];
    for (let row = 0; row <= 1; row += 1) for (let column = 0; column <= columns; column += 1) uv.push(column / columns, 1 - row);
    for (let column = 0; column < columns; column += 1) {
      const a = column, b = a + 1, c = a + columns + 1, d = c + 1;
      // Counter-clockwise seen from +y while closed: the printed side faces up.
      index.push(a, c, b, b, c, d);
    }
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    geometry.setIndex(index);
    const texture = sheetTexture(spec, page, 'front');
    const backTexture = sheetTexture(spec, page, 'back');
    const frontMaterial = new MeshStandardMaterial({ color: texture ? '#ffffff' : '#f4eee0', map: texture, roughness: 0.9, metalness: 0, side: FrontSide });
    frontMaterial.name = 'flap-front';
    const backMaterial = new MeshStandardMaterial({ color: backTexture ? '#ffffff' : '#e9e0cc', map: backTexture, roughness: 0.94, metalness: 0, side: BackSide });
    backMaterial.name = 'flap-back';
    const front = new Mesh(geometry, frontMaterial);
    const back = new Mesh(geometry, backMaterial);
    front.name = `flap-${spec.key}`;
    back.name = `flap-${spec.key}-back`;
    front.receiveShadow = true;
    back.receiveShadow = true;
    const angle = spec.open ? OPEN : 0;
    const entry: Entry = { spec, front, back, geometry, texture, backTexture, angle, from: angle, to: angle, start: 0 };
    page.mesh.add(front, back);
    writeGeometry(entry, page);
    return entry;
  }

  function release(entry: Entry): void {
    entry.front.removeFromParent();
    entry.back.removeFromParent();
    entry.geometry.dispose();
    (entry.front.material as MeshStandardMaterial).dispose();
    (entry.back.material as MeshStandardMaterial).dispose();
    entry.texture?.dispose();
    entry.backTexture?.dispose();
  }

  return {
    set(flaps, pages, instant = false) {
      if (disposed) return;
      const keep = new Set(flaps.map(flap => flap.key));
      for (const [key, entry] of entries) if (!keep.has(key)) { release(entry); entries.delete(key); }
      const now = performance.now();
      for (const spec of flaps) {
        const page = pageOf(pages, spec.side);
        const current = entries.get(spec.key);
        if (!current || current.spec.side !== spec.side || JSON.stringify(current.spec.rect) !== JSON.stringify(spec.rect)
          || current.spec.hint !== spec.hint || current.spec.foldHint !== spec.foldHint) {
          if (current) release(current);
          const entry = create(spec, page);
          entries.set(spec.key, entry);
          show(entry, false);
          continue;
        }
        if (current.spec.open !== spec.open) {
          current.from = current.angle;
          current.to = spec.open ? OPEN : 0;
          current.start = now;
          if (instant) { current.angle = current.to; writeGeometry(current, page); show(current, false); }
        }
        current.spec = spec;
      }
    },
    update(time, pages) {
      let moving = false;
      for (const entry of entries.values()) {
        const target = entry.to;
        if (entry.angle !== target) {
          const elapsed = held === null ? time - entry.start : held;
          const t = BOOK_MOTION.flap > 0 ? Math.min(1, Math.max(0, elapsed / BOOK_MOTION.flap)) : 1;
          entry.angle = entry.from + (target - entry.from) * smoothStep(t);
          if (t >= 1) entry.angle = target;
          writeGeometry(entry, pageOf(pages, entry.spec.side));
        }
        const still = entry.angle === target;
        moving ||= !still;
        show(entry, !still);
      }
      return moving;
    },
    setVisible(next) {
      visible = next;
      for (const entry of entries.values()) show(entry, entry.angle !== entry.to);
    },
    angles: () => Object.fromEntries([...entries].map(([key, entry]) => [key, Number((entry.angle * 180 / Math.PI).toFixed(2))])),
    hold(ms) { held = ms === null ? null : Math.max(0, ms); },
    targets: () => [...entries.values()].flatMap(entry => entry.front.visible ? [entry.front, entry.back] : []),
    keyOf(object) {
      for (const [key, entry] of entries) if (object === entry.front || object === entry.back) return key;
      return null;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) release(entry);
      entries.clear();
    },
  };
}
