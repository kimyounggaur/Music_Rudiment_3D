import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute } from 'three';

const coverWidth = 3;
const coverHeight = coverWidth * 841.89 / 595.276;
const marginX = coverWidth * 0.06;
const marginZ = coverWidth * 0.06;

/** A4 is the verified source artwork ratio, not a viewport-dependent stretch. */
export const BOOK_DIMENSIONS = Object.freeze({
  coverWidth,
  coverHeight,
  marginX,
  marginZ,
  pageWidth: coverWidth - 2 * marginX,
  pageHeight: coverHeight - 2 * marginZ,
  coverThickness: 0.065,
  totalStackHeight: 0.19,
  minimumStackHeight: 0.018,
  pageLift: 0.003,
});

export type BookCorner = 'top' | 'bottom';
export type BookTurnDirection = 'forward' | 'backward';
export type LeafPoint = { x: number; y: number; z: number };
export const LEAF_COLUMNS = 24;
export const LEAF_ROWS = 4;
export const LEAF_THICKNESS = 0.004;

export function unitProgress(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** +Y-facing page, hinge at x=0, top of the printed page at z=-height/2. */
export function createFlatPageGeometry(width: number, height: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    0, 0, -height / 2, width, 0, -height / 2,
    width, 0, height / 2, 0, 0, height / 2,
  ], 3));
  geometry.setAttribute('normal', new Float32BufferAttribute([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ], 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  geometry.setIndex([0, 2, 1, 0, 3, 2]);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * v3 R2 spread profile. Spine distance s (0 = spine, 1 = outer edge): a gutter dip at the spine,
 * a gentle bulge across the page and a droop at the fore-edge. Heights are world units at full
 * amplitude; thin stacks curve less (a two-sheet stack cannot dip below the board).
 */
export const SPREAD_PROFILE = Object.freeze({
  spineDip: 0.08, spineWidth: 0.012, bulge: 0.055, bulgeTaper: 0.35, edgeDroop: 0.01,
  columns: 40, rows: 8, dipShare: 0.6,
});

export function spreadHeight(spineDistance: number): number {
  const s = unitProgress(spineDistance);
  const p = SPREAD_PROFILE;
  return -p.spineDip * Math.exp(-s * s / p.spineWidth) + p.bulge * Math.sin(Math.PI * s) * (1 - p.bulgeTaper * s) - p.edgeDroop * s * s;
}

/**
 * Curvature amplitude for a page lying on a stack of this thickness: the gutter dip never takes
 * more than `dipShare` of the bundle, so a nearly empty side lies almost flat (as a real book does).
 */
export function spreadAmplitude(stackHeight: number): number {
  const p = SPREAD_PROFILE;
  const thickness = Number.isFinite(stackHeight) ? Math.max(0, stackHeight) : 0;
  return Math.min(1, thickness * p.dipShare / p.spineDip);
}

export type SpineSide = 'start' | 'end';
const spineDistanceAt = (u: number, spine: SpineSide) => spine === 'start' ? u : 1 - u;

/** Curved +Y page grid with the same UV/orientation contract as createFlatPageGeometry. */
export function createSpreadPageGeometry(width: number, height: number, spine: SpineSide, amplitude = 1): BufferGeometry {
  const { columns, rows } = SPREAD_PROFILE;
  const geometry = new BufferGeometry();
  const count = (columns + 1) * (rows + 1);
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('normal', new Float32BufferAttribute(new Float32Array(count * 3), 3).setUsage(DynamicDrawUsage));
  const uv = new Float32Array(count * 2);
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) for (let column = 0; column <= columns; column += 1) {
    uv.set([column / columns, 1 - row / rows], (row * (columns + 1) + column) * 2);
  }
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  updateSpreadPageGeometry(geometry, width, height, spine, amplitude);
  return geometry;
}

export function updateSpreadPageGeometry(geometry: BufferGeometry, width: number, height: number, spine: SpineSide, amplitude: number): void {
  const { columns, rows } = SPREAD_PROFILE;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const step = 1e-3;
  for (let row = 0; row <= rows; row += 1) for (let column = 0; column <= columns; column += 1) {
    const index = row * (columns + 1) + column;
    const u = column / columns;
    const s = spineDistanceAt(u, spine);
    const y = amplitude * spreadHeight(s);
    // dy/dx through the spine-distance chain rule; the page is flat along z.
    const slope = amplitude * (spreadHeight(Math.min(1, s + step)) - spreadHeight(Math.max(0, s - step)))
      / ((Math.min(1, s + step) - Math.max(0, s - step)) * width) * (spine === 'start' ? 1 : -1);
    const length = Math.hypot(slope, 1);
    position.setXYZ(index, u * width, y, (row / rows - 0.5) * height);
    normal.setXYZ(index, -slope / length, 1 / length, 0);
  }
  position.needsUpdate = true;
  normal.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/**
 * A curved paper bundle: printed-side top that follows the page profile, flat bottom on the board,
 * and four side strips (group 1) whose V coordinate is the height in sheets for a fore-edge texture.
 */
export const STACK_SHEET_HEIGHT = 0.004;
export function createStackGeometry(width: number, height: number, spine: SpineSide, thickness: number, amplitude: number): BufferGeometry {
  const { columns, rows } = SPREAD_PROFILE;
  const geometry = new BufferGeometry();
  const top = (columns + 1) * (rows + 1);
  const sideColumns = (columns + 1) * 2 * 2; // front + back strips
  const sideRows = (rows + 1) * 2 * 2; // outer + spine strips
  const count = top + sideColumns + sideRows;
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('normal', new Float32BufferAttribute(new Float32Array(count * 3), 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(count * 2), 2).setUsage(DynamicDrawUsage));
  const indices: number[] = [];
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const topCount = indices.length;
  geometry.addGroup(0, topCount, 0);
  // Strip helpers: pairs of (top, bottom) vertices along an edge.
  const strip = (start: number, segments: number, flip: boolean) => {
    for (let i = 0; i < segments; i += 1) {
      const a = start + i * 2, b = a + 1, c = a + 2, d = a + 3;
      if (flip) indices.push(a, c, b, b, c, d); else indices.push(a, b, c, b, d, c);
    }
  };
  let cursor = top;
  strip(cursor, columns, false); cursor += (columns + 1) * 2; // front (z = +h/2)
  strip(cursor, columns, true); cursor += (columns + 1) * 2; // back (z = -h/2)
  strip(cursor, rows, true); cursor += (rows + 1) * 2; // x = 0 edge
  strip(cursor, rows, false); // x = width edge
  geometry.addGroup(topCount, indices.length - topCount, 1);
  geometry.setIndex(indices);
  updateStackGeometry(geometry, width, height, spine, thickness, amplitude);
  return geometry;
}

export function updateStackGeometry(geometry: BufferGeometry, width: number, height: number, spine: SpineSide, thickness: number, amplitude: number): void {
  const { columns, rows } = SPREAD_PROFILE;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const topY = (u: number) => Math.max(thickness * 0.25, thickness + amplitude * spreadHeight(spineDistanceAt(u, spine)));
  for (let row = 0; row <= rows; row += 1) for (let column = 0; column <= columns; column += 1) {
    const index = row * (columns + 1) + column;
    const u = column / columns;
    position.setXYZ(index, u * width, topY(u), (row / rows - 0.5) * height);
    normal.setXYZ(index, 0, 1, 0);
    uv.setXY(index, u, 1 - row / rows);
  }
  let cursor = (columns + 1) * (rows + 1);
  for (const z of [height / 2, -height / 2]) {
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns, y = topY(u);
      position.setXYZ(cursor, u * width, y, z); normal.setXYZ(cursor, 0, 0, Math.sign(z)); uv.setXY(cursor, u * width / STACK_SHEET_HEIGHT / 40, y / STACK_SHEET_HEIGHT);
      position.setXYZ(cursor + 1, u * width, 0, z); normal.setXYZ(cursor + 1, 0, 0, Math.sign(z)); uv.setXY(cursor + 1, u * width / STACK_SHEET_HEIGHT / 40, 0);
      cursor += 2;
    }
  }
  for (const u of [0, 1]) {
    const y = topY(u);
    for (let row = 0; row <= rows; row += 1) {
      const z = (row / rows - 0.5) * height;
      const nx = u === 0 ? -1 : 1;
      position.setXYZ(cursor, u * width, y, z); normal.setXYZ(cursor, nx, 0, 0); uv.setXY(cursor, row / rows * height / STACK_SHEET_HEIGHT / 40, y / STACK_SHEET_HEIGHT);
      position.setXYZ(cursor + 1, u * width, 0, z); normal.setXYZ(cursor + 1, nx, 0, 0); uv.setXY(cursor + 1, row / rows * height / STACK_SHEET_HEIGHT / 40, 0);
      cursor += 2;
    }
  }
  position.needsUpdate = true;
  normal.needsUpdate = true;
  uv.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/** The thickness distribution is a visual binding model, not a literal six-sheet book. */
export function stackHeights(spreadIndex: number, spreadCount: number): { left: number; right: number } {
  const fraction = unitProgress(spreadIndex / Math.max(1, spreadCount - 1));
  const left = BOOK_DIMENSIONS.minimumStackHeight
    + fraction * (BOOK_DIMENSIONS.totalStackHeight - 2 * BOOK_DIMENSIONS.minimumStackHeight);
  return { left, right: BOOK_DIMENSIONS.totalStackHeight - left };
}

/**
 * v3 R4: height of the open right page's paper above its flat base at page-local x (world units)
 * for a spread at rest — the same curve the stage gives that page, so ink figures lie on it.
 */
export function rightPagePaper(spreadIndex: number, spreadCount: number): (pageX: number) => number {
  const amplitude = spreadAmplitude(stackHeights(spreadIndex, spreadCount).right);
  return (pageX: number) => amplitude * spreadHeight(pageX / BOOK_DIMENSIONS.pageWidth);
}

/**
 * Integrate a linearly varying tangent angle, retaining width-direction arc
 * length exactly. The corner changes the tangent gradient across the height.
 * No clock is involved: holding p holds the same surface, and reversing p
 * follows the identical path. The source and destination are exactly flat.
 */
export function leafPoint(
  width: number, height: number, u: number, v: number, progress: number,
  corner: BookCorner, direction: BookTurnDirection,
): LeafPoint {
  const p = unitProgress(progress);
  const horizontalSign = direction === 'forward' ? 1 : -1;
  const z = (v - 0.5) * height;
  if (p === 0) return { x: horizontalSign * width * u, y: 0, z };
  if (p === 1) return { x: -horizontalSign * width * u, y: 0, z };
  const cornerSign = corner === 'top' ? -1 : 1;
  const curl = 0.68 * Math.sin(Math.PI * p) * (1 + 0.3 * cornerSign * (2 * v - 1));
  const halfSweep = curl * u / 2;
  const sinc = Math.abs(halfSweep) < 1e-7 ? 1 - halfSweep * halfSweep / 6 : Math.sin(halfSweep) / halfSweep;
  const radius = width * u * sinc;
  const angle = Math.PI * p + halfSweep;
  return { x: horizontalSign * radius * Math.cos(angle), y: radius * Math.sin(angle), z };
}

export type LeafCurvature = Readonly<{ source: number; destination: number }>;
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * leafPoint plus the resting spread profile near both ends, so the turning leaf meets the curved
 * source page at p=0 and the curved destination page at p=1 exactly. Mid-turn the leaf is free.
 */
export function curvedLeafPoint(width: number, height: number, u: number, v: number, progress: number,
  corner: BookCorner, direction: BookTurnDirection, curvature: LeafCurvature): LeafPoint {
  const point = leafPoint(width, height, u, v, progress, corner, direction);
  const p = unitProgress(progress);
  const weight = curvature.source * (1 - smooth(0, 0.06, p)) + curvature.destination * smooth(0.94, 1, p);
  return weight === 0 ? point : { ...point, y: point.y + weight * spreadHeight(u) };
}

/** Invert the visible corner X path for direct pointer tracking. */
export function leafProgressFromX(width: number, height: number, x: number, corner: BookCorner, direction: BookTurnDirection): number {
  const sign = direction === 'forward' ? 1 : -1;
  const target = sign * x;
  if (target >= width) return 0;
  if (target <= -width) return 1;
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const middle = (low + high) / 2;
    const point = leafPoint(width, height, 1, corner === 'top' ? 0 : 1, middle, corner, direction);
    if (sign * point.x > target) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

const LEAF_FACE_VERTICES = (LEAF_COLUMNS + 1) * (LEAF_ROWS + 1);
const leafVertex = (column: number, row: number): number => row * (LEAF_COLUMNS + 1) + column;
const LEAF_PERIMETER: number[] = [];
for (let column = 0; column < LEAF_COLUMNS; column += 1) LEAF_PERIMETER.push(leafVertex(column, 0));
for (let row = 0; row < LEAF_ROWS; row += 1) LEAF_PERIMETER.push(leafVertex(LEAF_COLUMNS, row));
for (let column = LEAF_COLUMNS; column > 0; column -= 1) LEAF_PERIMETER.push(leafVertex(column, LEAF_ROWS));
for (let row = LEAF_ROWS; row > 0; row -= 1) LEAF_PERIMETER.push(leafVertex(0, row));

/** Separate physical front/back printing and a thin, opaque connecting edge. */
export function createTurningLeafGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  const vertexCount = 2 * LEAF_FACE_VERTICES + 4 * LEAF_PERIMETER.length;
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(vertexCount * 3), 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('normal', new Float32BufferAttribute(new Float32Array(vertexCount * 3), 3).setUsage(DynamicDrawUsage));
  const uv = new Float32Array(vertexCount * 2);
  for (let row = 0; row <= LEAF_ROWS; row += 1) {
    for (let column = 0; column <= LEAF_COLUMNS; column += 1) {
      const index = leafVertex(column, row);
      const u = column / LEAF_COLUMNS;
      const v = row / LEAF_ROWS;
      uv.set([u, 1 - v], index * 2);
      // The physical back reads left-to-right after the leaf lands on the left.
      uv.set([1 - u, 1 - v], (index + LEAF_FACE_VERTICES) * 2);
    }
  }
  const indices: number[] = [];
  for (let row = 0; row < LEAF_ROWS; row += 1) for (let column = 0; column < LEAF_COLUMNS; column += 1) {
    const a = leafVertex(column, row), b = a + 1, c = leafVertex(column, row + 1), d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const faceIndices = indices.length;
  geometry.addGroup(0, faceIndices, 0);
  for (let index = 0; index < faceIndices; index += 3) indices.push(indices[index] + LEAF_FACE_VERTICES, indices[index + 2] + LEAF_FACE_VERTICES, indices[index + 1] + LEAF_FACE_VERTICES);
  geometry.addGroup(faceIndices, faceIndices, 1);
  const edgeStart = indices.length;
  LEAF_PERIMETER.forEach((_point, edge) => {
    const base = 2 * LEAF_FACE_VERTICES + edge * 4;
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    uv.set([0, 0, 1, 0, 1, 1, 0, 1], base * 2);
  });
  geometry.addGroup(edgeStart, indices.length - edgeStart, 2);
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  updateTurningLeafGeometry(geometry, BOOK_DIMENSIONS.pageWidth, BOOK_DIMENSIONS.pageHeight, 0, 'bottom', 'forward');
  return geometry;
}

export function updateTurningLeafGeometry(
  geometry: BufferGeometry, width: number, height: number, progress: number,
  corner: BookCorner, direction: BookTurnDirection, curvature: LeafCurvature = { source: 0, destination: 0 },
): void {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const surface: LeafPoint[] = [];
  for (let row = 0; row <= LEAF_ROWS; row += 1) for (let column = 0; column <= LEAF_COLUMNS; column += 1) {
    surface.push(curvedLeafPoint(width, height, column / LEAF_COLUMNS, row / LEAF_ROWS, progress, corner, direction, curvature));
  }
  for (let row = 0; row <= LEAF_ROWS; row += 1) for (let column = 0; column <= LEAF_COLUMNS; column += 1) {
    const index = leafVertex(column, row);
    const point = surface[index];
    const before = surface[leafVertex(Math.max(0, column - 1), row)];
    const after = surface[leafVertex(Math.min(LEAF_COLUMNS, column + 1), row)];
    const upper = surface[leafVertex(column, Math.max(0, row - 1))];
    const lower = surface[leafVertex(column, Math.min(LEAF_ROWS, row + 1))];
    const ux = after.x - before.x, uy = after.y - before.y, uz = after.z - before.z;
    const vx = lower.x - upper.x, vy = lower.y - upper.y, vz = lower.z - upper.z;
    let nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length; ny /= length; nz /= length;
    const half = LEAF_THICKNESS / 2;
    position.setXYZ(index, point.x + nx * half, point.y + ny * half, point.z + nz * half);
    position.setXYZ(index + LEAF_FACE_VERTICES, point.x - nx * half, point.y - ny * half, point.z - nz * half);
    normal.setXYZ(index, nx, ny, nz);
    normal.setXYZ(index + LEAF_FACE_VERTICES, -nx, -ny, -nz);
  }
  LEAF_PERIMETER.forEach((a, edge) => {
    const b = LEAF_PERIMETER[(edge + 1) % LEAF_PERIMETER.length];
    const base = 2 * LEAF_FACE_VERTICES + edge * 4;
    const source = [a, b, b + LEAF_FACE_VERTICES, a + LEAF_FACE_VERTICES];
    const tx = surface[b].x - surface[a].x, ty = surface[b].y - surface[a].y, tz = surface[b].z - surface[a].z;
    const nx = normal.getX(a), ny = normal.getY(a), nz = normal.getZ(a);
    let ex = ny * tz - nz * ty, ey = nz * tx - nx * tz, ez = nx * ty - ny * tx;
    const length = Math.hypot(ex, ey, ez) || 1;
    ex /= length; ey /= length; ez /= length;
    source.forEach((from, offset) => {
      position.setXYZ(base + offset, position.getX(from), position.getY(from), position.getZ(from));
      normal.setXYZ(base + offset, ex, ey, ez);
    });
  });
  position.needsUpdate = true;
  normal.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
