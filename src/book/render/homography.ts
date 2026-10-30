/**
 * Projective maps between the unit square and a screen quad. A perspective camera projects a flat
 * page to a general convex quad, which an affine matrix cannot match; a 3×3 homography can.
 * Row-major [h0 h1 h2; h3 h4 h5; h6 h7 h8] maps (u, v, 1) to homogeneous screen coordinates.
 */
export type HomographyPoint = Readonly<{ x: number; y: number }>;
export type HomographyQuad = Readonly<{ tl: HomographyPoint; tr: HomographyPoint; br: HomographyPoint; bl: HomographyPoint }>;
export type Homography = readonly [number, number, number, number, number, number, number, number, number];

const finite = (quad: HomographyQuad) => [quad.tl, quad.tr, quad.br, quad.bl].every(point => Number.isFinite(point.x) && Number.isFinite(point.y));
const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

/** Strictly convex with a consistent winding; edge-on, folded and self-crossing quads are rejected. */
export function convexQuad(quad: HomographyQuad, minimumArea = 1e-6): boolean {
  if (!finite(quad)) return false;
  const points = [quad.tl, quad.tr, quad.br, quad.bl];
  let sign = 0;
  for (let index = 0; index < 4; index += 1) {
    const a = points[index], b = points[(index + 1) % 4], c = points[(index + 2) % 4];
    const turn = cross(b.x - a.x, b.y - a.y, c.x - b.x, c.y - b.y);
    if (Math.abs(turn) < minimumArea) return false;
    const current = Math.sign(turn);
    if (sign === 0) sign = current;
    else if (current !== sign) return false;
  }
  return true;
}

/** Heckbert's square→quad map: (0,0)→tl, (1,0)→tr, (1,1)→br, (0,1)→bl. Null when not a usable convex quad. */
export function homographyFromUnitSquare(quad: HomographyQuad): Homography | null {
  if (!convexQuad(quad)) return null;
  const { tl: p0, tr: p1, br: p2, bl: p3 } = quad;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  let g = 0, h = 0;
  if (Math.abs(sx) > 1e-12 || Math.abs(sy) > 1e-12) {
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
    const denominator = cross(dx1, dy1, dx2, dy2);
    if (Math.abs(denominator) < 1e-12) return null;
    g = cross(sx, sy, dx2, dy2) / denominator;
    h = cross(dx1, dy1, sx, sy) / denominator;
  }
  const result: Homography = [
    p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x,
    p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y,
    g, h, 1,
  ];
  return result.every(Number.isFinite) ? result : null;
}

export function applyHomography(matrix: Homography, u: number, v: number): HomographyPoint {
  const w = matrix[6] * u + matrix[7] * v + matrix[8];
  return { x: (matrix[0] * u + matrix[1] * v + matrix[2]) / w, y: (matrix[3] * u + matrix[4] * v + matrix[5]) / w };
}

export function invertHomography(matrix: Homography): Homography | null {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const determinant = a * A + b * B + c * C;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return null;
  const inverse: Homography = [
    A / determinant, -(b * i - c * h) / determinant, (b * f - c * e) / determinant,
    B / determinant, (a * i - c * g) / determinant, -(a * f - c * d) / determinant,
    C / determinant, -(a * h - b * g) / determinant, (a * e - b * d) / determinant,
  ];
  return inverse.every(Number.isFinite) ? inverse : null;
}

/** Screen point → page-local (u, v); null outside the projective domain. */
export function quadUv(quad: HomographyQuad, point: HomographyPoint): HomographyPoint | null {
  const forward = homographyFromUnitSquare(quad);
  const inverse = forward && invertHomography(forward);
  if (!inverse) return null;
  const w = inverse[6] * point.x + inverse[7] * point.y + inverse[8];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return null;
  return { x: (inverse[0] * point.x + inverse[1] * point.y + inverse[2]) / w, y: (inverse[3] * point.x + inverse[4] * point.y + inverse[5]) / w };
}

/** CSS matrix3d (column-major) mapping an element of size width×height, origin 0 0, onto the quad. */
export function cssMatrix3d(matrix: Homography, width: number, height: number): number[] {
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = matrix;
  const scale = 1 / h8;
  return [
    h0 / width * scale, h3 / width * scale, 0, h6 / width * scale,
    h1 / height * scale, h4 / height * scale, 0, h7 / height * scale,
    0, 0, 1, 0,
    h2 * scale, h5 * scale, 0, 1,
  ];
}
