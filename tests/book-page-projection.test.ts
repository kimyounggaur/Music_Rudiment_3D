import test from 'node:test';
import assert from 'node:assert/strict';
import { pageStyle } from '../src/book/pageProjection.ts';

test('orthographic page DOM maps all four corners, including skew and reverse orientation', () => {
  for (const basis of [[340, 25, -12, 500], [-240, 35, 20, 300], [25, -80, 180, 40]]) {
    const [ax, ay, bx, by] = basis;
    const quad = { tl: { x: 70, y: 35 }, tr: { x: 70 + ax, y: 35 + ay },
      bl: { x: 70 + bx, y: 35 + by }, br: { x: 70 + ax + bx, y: 35 + ay + by } };
    const style = pageStyle(quad);
    const matrix = String(style.transform).slice(7, -1).split(',').map(Number);
    for (const [u, v, target] of [[0, 0, quad.tl], [1, 0, quad.tr], [0, 1, quad.bl], [1, 1, quad.br]] as const) {
      const x = u * Number(style.width), y = v * Number(style.height);
      assert.ok(Math.abs(matrix[0] * x + matrix[2] * y + matrix[4] - target.x) < 1e-9);
      assert.ok(Math.abs(matrix[1] * x + matrix[3] * y + matrix[5] - target.y) < 1e-9);
    }
  }
});

test('edge-on, non-finite and non-affine quads never publish NaN transforms or hit areas', () => {
  const quad = { tl: { x: 0, y: 0 }, tr: { x: 10, y: 0 }, bl: { x: 0, y: 20 }, br: { x: 10, y: 20 } };
  for (const changed of [{ ...quad, tr: quad.tl }, { ...quad, tr: { x: NaN, y: 0 } },
    { ...quad, bl: { x: 20, y: 0 }, br: { x: 30, y: 0 } }, { ...quad, br: { x: 12, y: 20 } }]) {
    const style = pageStyle(changed);
    assert.equal(style.visibility, 'hidden');
    assert.equal(style.pointerEvents, 'none');
    assert.equal(style.transform, undefined);
  }
});
