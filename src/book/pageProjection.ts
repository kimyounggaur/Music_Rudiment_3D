import type { CSSProperties } from 'react';
import type { StageQuad } from './stage.ts';
import { cssMatrix3d, homographyFromUnitSquare } from './render/homography.ts';

/**
 * Transitional (R1–R2) DOM page placement. A perspective camera projects the flat page to a
 * general convex quad, so the page element is mapped with a 4-point homography (CSS matrix3d).
 * R3 replaces live DOM pages with printed textures; this then serves only the cover controls.
 */
export function quadSize(quad: StageQuad): { width: number; height: number } {
  const edge = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
  return { width: Math.max(edge(quad.tl, quad.tr), edge(quad.bl, quad.br)), height: Math.max(edge(quad.tl, quad.bl), edge(quad.tr, quad.br)) };
}

/** Edge-on, folded, self-crossing or non-finite quads have no usable DOM hit surface. */
export function pageStyle(quad: StageQuad, size = quadSize(quad)): CSSProperties {
  const matrix = homographyFromUnitSquare(quad);
  const { width, height } = size;
  if (!matrix || !Number.isFinite(width) || !Number.isFinite(height) || width < 1e-6 || height < 1e-6) {
    return { width: 0, height: 0, visibility: 'hidden', pointerEvents: 'none' };
  }
  const values = cssMatrix3d(matrix, width, height);
  if (!values.every(Number.isFinite)) return { width: 0, height: 0, visibility: 'hidden', pointerEvents: 'none' };
  return { width, height, transformOrigin: '0 0', transform: `matrix3d(${values.map(value => Number(value.toPrecision(12))).join(',')})` };
}
