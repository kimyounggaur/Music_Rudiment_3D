import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOK_DIMENSIONS, createSpreadPageGeometry, createStackGeometry, curvedLeafPoint, leafPoint, SPREAD_PROFILE,
  spreadAmplitude, spreadHeight, stackHeights,
} from '../src/book/geometry.ts';
import { pickQualityTier, resolveProfile } from '../src/book/profile.ts';
import { tierPasses, tierPixelRatio } from '../src/book/render/postPipeline.ts';
import { createFibreData } from '../src/book/render/paperMaterial.ts';
import { createLinenData } from '../src/book/render/environment.ts';

const W = BOOK_DIMENSIONS.pageWidth;
const H = BOOK_DIMENSIONS.pageHeight;
const close = (actual: number, expected: number, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const vertexAt = (geometry: ReturnType<typeof createSpreadPageGeometry>, u: number, v: number) => {
  const columns = SPREAD_PROFILE.columns, rows = SPREAD_PROFILE.rows;
  const index = Math.round(v * rows) * (columns + 1) + Math.round(u * columns);
  const position = geometry.getAttribute('position');
  return { x: position.getX(index), y: position.getY(index), z: position.getZ(index) };
};

test('the spread profile dips at the gutter, bulges across the page and droops at the fore-edge', () => {
  assert.ok(spreadHeight(0) < -0.05);
  assert.ok(spreadHeight(0.45) > 0.04);
  assert.ok(spreadHeight(1) < 0 && spreadHeight(1) > -0.02);
  // Smooth: no slope jump anywhere across the page.
  for (let s = 0.01; s < 0.99; s += 0.01) {
    const left = (spreadHeight(s) - spreadHeight(s - 0.005)) / 0.005;
    const right = (spreadHeight(s + 0.005) - spreadHeight(s)) / 0.005;
    assert.ok(Math.abs(left - right) < 0.08, `kink at ${s}`);
  }
});

test('page curvature never digs deeper than 60% of its bundle, so thin stacks lie nearly flat', () => {
  for (let index = 0; index < 6; index += 1) {
    const heights = stackHeights(index, 6);
    for (const thickness of [heights.left, heights.right]) {
      const amplitude = spreadAmplitude(thickness);
      assert.ok(amplitude >= 0 && amplitude <= 1);
      assert.ok(-amplitude * spreadHeight(0) <= thickness * SPREAD_PROFILE.dipShare + 1e-12);
    }
  }
  assert.ok(spreadAmplitude(0.018) < spreadAmplitude(0.08));
  assert.equal(spreadAmplitude(0.5), 1);
  assert.equal(spreadAmplitude(Number.NaN), 0);
});

test('turning leaf meets the curved source page at p=0 and the curved destination page at p=1 exactly', () => {
  const sourceAmplitude = spreadAmplitude(0.172), destinationAmplitude = spreadAmplitude(0.049);
  const right = createSpreadPageGeometry(W, H, 'start', sourceAmplitude);
  const left = createSpreadPageGeometry(W, H, 'end', destinationAmplitude);
  const curvature = { source: sourceAmplitude, destination: destinationAmplitude };
  for (const corner of ['top', 'bottom'] as const) {
    // 25×5 grid shared by the 24-column leaf and the 40-column page: multiples of 1/8 and 1/4.
    for (const u of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const start = curvedLeafPoint(W, H, u, v, 0, corner, 'forward', curvature);
      const page = vertexAt(right, u, v);
      close(start.x, page.x); close(start.y, page.y); close(start.z, page.z);
      const end = curvedLeafPoint(W, H, u, v, 1, corner, 'forward', curvature);
      // The left page is built in its own frame (spine at the far end) and translated by -W.
      const landed = vertexAt(left, 1 - u, v);
      close(end.x, landed.x - W); close(end.y, landed.y); close(end.z, landed.z);
    }
  }
  // Mid-turn the leaf follows the uncurved path (the blend window is only at the ends).
  for (const p of [0.25, 0.5, 0.75]) {
    const curved = curvedLeafPoint(W, H, 0.6, 0.3, p, 'bottom', 'forward', curvature);
    const plain = leafPoint(W, H, 0.6, 0.3, p, 'bottom', 'forward');
    assert.deepEqual(curved, plain);
  }
  right.dispose(); left.dispose();
});

test('curved pages keep the flat page UV contract and every normal faces the reader (+Y)', () => {
  for (const spine of ['start', 'end'] as const) {
    const geometry = createSpreadPageGeometry(W, H, spine, 1);
    const uv = geometry.getAttribute('uv');
    const normal = geometry.getAttribute('normal');
    const columns = SPREAD_PROFILE.columns;
    close(uv.getX(0), 0); close(uv.getY(0), 1);
    close(uv.getX(columns), 1); close(uv.getY(columns), 1);
    for (let index = 0; index < normal.count; index += 1) {
      assert.ok(normal.getY(index) > 0.9);
      close(Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index)), 1);
    }
    geometry.dispose();
  }
});

test('stack tops follow the page profile, staying one page-lift below the printed sheet', () => {
  for (const thickness of [0.018, 0.08, 0.172]) {
    const amplitude = spreadAmplitude(thickness);
    const stack = createStackGeometry(W, H, 'start', thickness, amplitude);
    const page = createSpreadPageGeometry(W, H, 'start', amplitude);
    const position = stack.getAttribute('position');
    const columns = SPREAD_PROFILE.columns;
    for (let column = 0; column <= columns; column += 1) {
      close(position.getY(column), thickness + vertexAt(page, column / columns, 0).y);
      assert.ok(position.getY(column) > 0);
    }
    assert.equal(stack.groups.length, 2);
    stack.dispose(); page.dispose();
  }
});

test('quality tiers: high adds AO, medium drops AO, low renders directly; pixel ratio is capped', () => {
  assert.deepEqual(tierPasses('high'), ['render', 'gtao', 'smaa', 'vignette', 'output']);
  assert.deepEqual(tierPasses('medium'), ['render', 'smaa', 'vignette', 'output']);
  assert.deepEqual(tierPasses('low'), []);
  assert.equal(tierPixelRatio('high', 3), 2);
  assert.equal(tierPixelRatio('medium', 3), 1.5);
  assert.equal(tierPixelRatio('low', 3), 1.25);
  assert.equal(tierPixelRatio('high', Number.NaN), 1);
  const desktop = { hardwareConcurrency: 8, userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' };
  assert.equal(pickQualityTier(desktop, 1, 1280 * 720), 'high');
  assert.equal(pickQualityTier(desktop, 2, 1920 * 1080), 'medium');
  assert.equal(pickQualityTier({ ...desktop, hardwareConcurrency: 4 }, 1, 1280 * 720), 'medium');
  assert.equal(pickQualityTier({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' }, 3, 390 * 844), 'low');
  assert.deepEqual(resolveProfile('?renderer=legacy&quality=low', desktop, 1, 1), { renderer: 'legacy', quality: 'low', qualitySource: 'url' });
  assert.deepEqual(resolveProfile('', desktop, 1, 1280 * 720, 'medium'), { renderer: 'ink', quality: 'medium', qualitySource: 'stored' });
  assert.deepEqual(resolveProfile('?quality=ultra', desktop, 1, 1280 * 720, 'bogus'), { renderer: 'ink', quality: 'high', qualitySource: 'auto' });
});

test('procedural paper fibre and linen are deterministic, tileable byte data (no image assets)', () => {
  const fibre = createFibreData(64, 3);
  assert.deepEqual(fibre, createFibreData(64, 3));
  assert.notDeepEqual(fibre, createFibreData(64, 4));
  const spread = Math.max(...fibre) - Math.min(...fibre);
  assert.ok(spread > 40 && spread < 255);
  const linen = createLinenData(64, 5);
  assert.equal(linen.length, 64 * 64 * 4);
  assert.deepEqual(linen, createLinenData(64, 5));
});
