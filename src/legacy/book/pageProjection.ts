import type { CSSProperties } from 'react';
import type { StageQuad } from './stage.ts';

/** Orthographic projection is affine. Match all four page-local corners; an
 * edge-on or invalid plane has no usable DOM hit surface. */
export function pageStyle(quad: StageQuad): CSSProperties {
  const x = { x: quad.tr.x - quad.tl.x, y: quad.tr.y - quad.tl.y };
  const y = { x: quad.bl.x - quad.tl.x, y: quad.bl.y - quad.tl.y };
  const width = Math.hypot(x.x, x.y);
  const height = Math.hypot(y.x, y.y);
  const fourthError = Math.hypot(quad.tl.x + x.x + y.x - quad.br.x, quad.tl.y + x.y + y.y - quad.br.y);
  if (![...Object.values(quad).flatMap(p => [p.x, p.y]), width, height].every(Number.isFinite)
    || width < 1e-6 || height < 1e-6 || Math.abs(x.x * y.y - x.y * y.x) < 1e-6 || fourthError > 0.5) {
    return { width: 0, height: 0, visibility: 'hidden', pointerEvents: 'none' };
  }
  return { width, height, transformOrigin: '0 0',
    transform: `matrix(${x.x / width},${x.y / width},${y.x / height},${y.y / height},${quad.tl.x},${quad.tl.y})` };
}
