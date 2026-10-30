import test from 'node:test';
import assert from 'node:assert/strict';
import { pageStyle, quadSize } from '../src/book/pageProjection.ts';
import { applyHomography, homographyFromUnitSquare, invertHomography, quadUv } from '../src/book/render/homography.ts';

const parse = (transform: unknown) => String(transform).replace(/^matrix3d\(|\)$/g, '').split(',').map(Number);
/** Apply a column-major CSS matrix3d to an element-local point (z = 0). */
function css(matrix: number[], x: number, y: number) {
  const X = matrix[0] * x + matrix[4] * y + matrix[12];
  const Y = matrix[1] * x + matrix[5] * y + matrix[13];
  const W = matrix[3] * x + matrix[7] * y + matrix[15];
  return { x: X / W, y: Y / W };
}

test('page DOM maps all four corners exactly for affine, perspective and reversed quads (v3 homography)', () => {
  const quads = [
    { tl: { x: 70, y: 35 }, tr: { x: 410, y: 60 }, bl: { x: 58, y: 535 }, br: { x: 398, y: 560 } },
    { tl: { x: 520, y: 120 }, tr: { x: 880, y: 120 }, br: { x: 920, y: 640 }, bl: { x: 500, y: 640 } },
    { tl: { x: 400, y: 50 }, tr: { x: 160, y: 85 }, bl: { x: 420, y: 350 }, br: { x: 180, y: 385 } },
  ];
  for (const quad of quads) {
    const style = pageStyle(quad);
    const matrix = parse(style.transform);
    const { width, height } = quadSize(quad);
    assert.equal(style.width, width);
    assert.equal(style.height, height);
    for (const [u, v, target] of [[0, 0, quad.tl], [1, 0, quad.tr], [0, 1, quad.bl], [1, 1, quad.br]] as const) {
      const point = css(matrix, u * width, v * height);
      assert.ok(Math.hypot(point.x - target.x, point.y - target.y) < 1e-6, JSON.stringify({ point, target }));
    }
  }
});

test('a perspective interior point follows projective, not bilinear, interpolation', () => {
  const quad = { tl: { x: 520, y: 120 }, tr: { x: 880, y: 120 }, br: { x: 920, y: 640 }, bl: { x: 500, y: 640 } };
  const map = homographyFromUnitSquare(quad)!;
  const center = applyHomography(map, 0.5, 0.5);
  // The projective centre is the intersection of the diagonals.
  const t = ((quad.bl.x - quad.tl.x) * (quad.bl.y - quad.tr.y) - (quad.bl.y - quad.tl.y) * (quad.bl.x - quad.tr.x))
    / ((quad.br.x - quad.tl.x) * (quad.bl.y - quad.tr.y) - (quad.br.y - quad.tl.y) * (quad.bl.x - quad.tr.x));
  const diagonal = { x: quad.tl.x + t * (quad.br.x - quad.tl.x), y: quad.tl.y + t * (quad.br.y - quad.tl.y) };
  assert.ok(Math.hypot(center.x - diagonal.x, center.y - diagonal.y) < 1e-6);
  const bilinear = { x: (quad.tl.x + quad.tr.x + quad.br.x + quad.bl.x) / 4, y: (quad.tl.y + quad.tr.y + quad.br.y + quad.bl.y) / 4 };
  assert.ok(Math.hypot(center.x - bilinear.x, center.y - bilinear.y) > 1);
  const inverse = invertHomography(map)!;
  assert.ok(inverse);
  const uv = quadUv(quad, center)!;
  assert.ok(Math.abs(uv.x - 0.5) < 1e-9 && Math.abs(uv.y - 0.5) < 1e-9);
});

test('edge-on, non-finite, folded and degenerate quads never publish NaN transforms or hit areas', () => {
  const quad = { tl: { x: 0, y: 0 }, tr: { x: 10, y: 0 }, bl: { x: 0, y: 20 }, br: { x: 10, y: 20 } };
  for (const changed of [{ ...quad, tr: quad.tl }, { ...quad, tr: { x: NaN, y: 0 } },
    { ...quad, bl: { x: 20, y: 0 }, br: { x: 30, y: 0 } }, { ...quad, br: quad.bl, bl: quad.br }]) {
    const style = pageStyle(changed);
    assert.equal(style.visibility, 'hidden');
    assert.equal(style.pointerEvents, 'none');
    assert.equal(style.transform, undefined);
  }
});
