import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOK_DIMENSIONS, createFlatPageGeometry, createTurningLeafGeometry,
  leafPoint, leafProgressFromX, LEAF_COLUMNS, LEAF_ROWS, LEAF_THICKNESS,
  stackHeights, updateTurningLeafGeometry,
} from '../src/book/geometry.ts';

const W = BOOK_DIMENSIONS.pageWidth;
const H = BOOK_DIMENSIONS.pageHeight;
const close = (actual: number, expected: number, tolerance = 1e-9): void => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('A4 artwork ratio is independent of page margins and static printing faces +Y', () => {
  close(BOOK_DIMENSIONS.coverHeight / BOOK_DIMENSIONS.coverWidth, 841.89 / 595.276);
  close(W, BOOK_DIMENSIONS.coverWidth - 2 * BOOK_DIMENSIONS.marginX);
  close(H, BOOK_DIMENSIONS.coverHeight - 2 * BOOK_DIMENSIONS.marginZ);
  const geometry = createFlatPageGeometry(W, H);
  assert.deepEqual(Array.from(geometry.getAttribute('uv').array), [0, 1, 1, 1, 1, 0, 0, 0]);
  for (let index = 0; index < 4; index += 1) close(geometry.getAttribute('normal').getY(index), 1);
  geometry.dispose();
});

test('both directions and corners have exact flat endpoints and a fixed hinge for every progress', () => {
  for (const direction of ['forward', 'backward'] as const) for (const corner of ['top', 'bottom'] as const) {
    const sign = direction === 'forward' ? 1 : -1;
    for (const v of [0, 0.25, 0.5, 0.75, 1]) for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      assert.deepEqual(leafPoint(W, H, u, v, 0, corner, direction), { x: sign * W * u, y: 0, z: (v - 0.5) * H });
      assert.deepEqual(leafPoint(W, H, u, v, 1, corner, direction), { x: -sign * W * u, y: 0, z: (v - 0.5) * H });
    }
    for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) for (const v of [0, 0.5, 1]) {
      const point = leafPoint(W, H, 0, v, p, corner, direction);
      close(point.x, 0); close(point.y, 0); close(point.z, (v - 0.5) * H);
    }
  }
});

test('intermediate leaf has non-rigid curvature, preserves width arc length, and does not sink below the hinge', () => {
  for (const p of [0.25, 0.5, 0.75]) for (const v of [0, 0.5, 1]) {
    let length = 0;
    let previous = leafPoint(W, H, 0, v, p, 'top', 'forward');
    for (let column = 1; column <= LEAF_COLUMNS; column += 1) {
      const point = leafPoint(W, H, column / LEAF_COLUMNS, v, p, 'top', 'forward');
      length += Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z);
      assert.ok(point.y >= 0);
      previous = point;
    }
    close(length, W, 0.001);
    const middle = leafPoint(W, H, 0.5, v, p, 'top', 'forward');
    const tip = leafPoint(W, H, 1, v, p, 'top', 'forward');
    assert.ok(Math.hypot(middle.x - tip.x / 2, middle.y - tip.y / 2) > 0.025);
  }
});

test('top/bottom grabs mirror the cross-page curl and backward motion mirrors X only', () => {
  for (const p of [0.25, 0.5, 0.75]) {
    const top = leafPoint(W, H, 1, 0, p, 'top', 'forward');
    const opposite = leafPoint(W, H, 1, 1, p, 'bottom', 'forward');
    close(top.x, opposite.x); close(top.y, opposite.y); close(top.z, -opposite.z);
    const ungrabbed = leafPoint(W, H, 1, 1, p, 'top', 'forward');
    assert.ok(Math.abs(top.x - ungrabbed.x) > 0.02);
    const backward = leafPoint(W, H, 1, 0, p, 'top', 'backward');
    close(top.x, -backward.x); close(top.y, backward.y); close(top.z, backward.z);
  }
});

test('pointer X inversion returns the same progress, including reverse drag and clamping', () => {
  for (const direction of ['forward', 'backward'] as const) for (const corner of ['top', 'bottom'] as const) {
    for (const p of [0, 0.03, 0.25, 0.5, 0.75, 0.95, 1, 0.75, 0.25]) {
      const point = leafPoint(W, H, 1, corner === 'top' ? 0 : 1, p, corner, direction);
      close(leafProgressFromX(W, H, point.x, corner, direction), p, 1e-7);
    }
  }
  close(leafProgressFromX(W, H, W + 20, 'top', 'forward'), 0);
  close(leafProgressFromX(W, H, -W - 20, 'top', 'forward'), 1);
});

test('reused geometry has separate physical faces, readable reverse UV, thin edges and refreshed bounds/normals', () => {
  const geometry = createTurningLeafGeometry();
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const faceVertices = (LEAF_COLUMNS + 1) * (LEAF_ROWS + 1);
  assert.equal(geometry.groups.length, 3);
  assert.equal(geometry.groups[0].materialIndex, 0);
  assert.equal(geometry.groups[1].materialIndex, 1);
  assert.equal(geometry.groups[2].materialIndex, 2);
  close(uv.getX(0), 0); close(uv.getX(LEAF_COLUMNS), 1);
  close(uv.getX(faceVertices), 1); close(uv.getX(faceVertices + LEAF_COLUMNS), 0);
  for (const direction of ['forward', 'backward'] as const) for (const p of [0, 0.25, 0.5, 0.75, 1, 0.5, 0]) {
    updateTurningLeafGeometry(geometry, W, H, p, 'bottom', direction);
    assert.equal(geometry.getAttribute('position'), position);
    assert.equal(geometry.getAttribute('normal'), normal);
    assert.ok(geometry.boundingBox && geometry.boundingSphere);
    for (let index = 0; index < faceVertices; index += 1) {
      close(Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index)), 1, 1e-6);
      close(normal.getX(index), -normal.getX(index + faceVertices), 1e-6);
      close(normal.getY(index), -normal.getY(index + faceVertices), 1e-6);
      close(Math.hypot(position.getX(index) - position.getX(index + faceVertices), position.getY(index) - position.getY(index + faceVertices), position.getZ(index) - position.getZ(index + faceVertices)), LEAF_THICKNESS, 1e-6);
    }
    if (p === 0 || p === 1) {
      const expected = (direction === 'forward' ? 1 : -1) * (p === 0 ? 1 : -1);
      close(normal.getY(0), expected);
    } else assert.ok(geometry.boundingBox.max.y > 0.5);
  }
  geometry.dispose();
});

test('fractional sheet transfers conserve the bundle thickness without a discontinuous height step', () => {
  for (let index = 0; index <= 50; index += 1) {
    const heights = stackHeights(index / 50, 2);
    close(heights.left + heights.right, BOOK_DIMENSIONS.totalStackHeight);
    assert.ok(heights.left >= BOOK_DIMENSIONS.minimumStackHeight - 1e-10);
    assert.ok(heights.right >= BOOK_DIMENSIONS.minimumStackHeight - 1e-10);
  }
});
