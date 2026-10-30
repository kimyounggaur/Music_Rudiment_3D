import { Box3, Vector3 } from 'three';
import { BOOK_DIMENSIONS, leafPoint } from '../geometry.ts';

/**
 * Pure world-space framing sets shared by the stage and its tests (CI01/CI02).
 * The closed anchor is the cover's UV centre on its top face; the open anchor sits on the spine.
 */
const D = BOOK_DIMENSIONS;

export const CLOSED_BOUNDS = Object.freeze(new Box3(
  new Vector3(-0.09, 0, -D.coverHeight / 2),
  new Vector3(D.coverWidth, D.totalStackHeight + 2 * D.coverThickness + 0.002, D.coverHeight / 2),
));
export const CLOSED_ANCHOR = Object.freeze(new Vector3(D.coverWidth / 2, D.totalStackHeight + 2 * D.coverThickness + 0.001, 0));
export const OPEN_ANCHOR = Object.freeze(new Vector3(0, D.coverThickness + D.totalStackHeight / 2, 0));

export function boxCorners(bounds: Box3): Vector3[] {
  const result: Vector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) result.push(new Vector3(x, y, z));
  return result;
}

export function closedFramePoints(): Vector3[] {
  return boxCorners(CLOSED_BOUNDS);
}

/** Open book bounds plus outer samples of every direct-turn pose (both directions and corners). */
export function openFramePoints(): Vector3[] {
  const points = boxCorners(new Box3(
    new Vector3(-D.coverWidth - 0.10, 0, -D.coverHeight / 2 - 0.04),
    new Vector3(D.coverWidth + 0.10, D.totalStackHeight + 2 * D.coverThickness, D.coverHeight / 2 + 0.04),
  ));
  for (const direction of ['forward', 'backward'] as const) for (const corner of ['top', 'bottom'] as const) {
    for (let step = 0; step <= 64; step += 1) for (const row of [0, 2, 4]) for (const column of [0, 6, 12, 18, 24]) {
      const point = leafPoint(D.pageWidth, D.pageHeight, column / 24, row / 4, step / 64, corner, direction);
      points.push(new Vector3(point.x, point.y + D.coverThickness + D.totalStackHeight + 0.015, point.z));
    }
  }
  return points;
}

/** Book diagonal used for near/far planes; generous enough for an open book plus a standing leaf. */
export const SCENE_EXTENT = Math.hypot(2 * D.coverWidth + 0.4, D.coverHeight + 0.4, D.pageWidth + 0.4);
