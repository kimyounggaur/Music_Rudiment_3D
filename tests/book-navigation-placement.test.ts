import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOK_NAVIGATION_TARGET, navigationButtonPosition } from '../src/book/navigationPlacement.ts';
import type { StageLayout } from '../src/book/stage.ts';

const layout = (width: number, height: number, left: number, right: number, top = 100, bottom = 650): StageLayout => ({
  width, height, left: { tl: { x: left, y: top }, tr: { x: width / 2, y: top },
    bl: { x: left, y: bottom }, br: { x: width / 2, y: bottom } },
  right: { tl: { x: width / 2, y: top }, tr: { x: right, y: top },
    bl: { x: width / 2, y: bottom }, br: { x: right, y: bottom } },
} as StageLayout);

test('390px portrait bookmarks retain their full 44px target instead of clipping by a fractional pixel', () => {
  const original = layout(390, 844, 43.135166, 346.864838);
  const prev = navigationButtonPosition(original, 'prev'), next = navigationButtonPosition(original, 'next');
  assert.equal(prev.left, 0);
  assert.equal(next.left, 346);
  for (const point of [prev, next]) {
    assert.ok(point.left >= 0 && point.left + BOOK_NAVIGATION_TARGET <= original.width);
    assert.ok(point.top >= 0 && point.top + BOOK_NAVIGATION_TARGET <= original.height);
  }
  assert.equal(original.left.tl.x, 43.135166);
  assert.equal(original.right.tr.x, 346.864838);
});

test('desktop bookmarks preserve the existing paper-relative position when no clipping exists', () => {
  const original = layout(1280, 720, 279.767242, 1000.232788);
  assert.deepEqual(navigationButtonPosition(original, 'prev'), { left: 235.767242, top: 375 });
  assert.deepEqual(navigationButtonPosition(original, 'next'), { left: 1000.232788, top: 375 });
});

test('short and panned viewport bounds clamp both axes without moving the page quad', () => {
  const original = layout(844, 390, -12, 860, 360, 500);
  assert.deepEqual(navigationButtonPosition(original, 'prev'), { left: 0, top: 346 });
  assert.deepEqual(navigationButtonPosition(original, 'next'), { left: 800, top: 346 });
  assert.equal(original.left.tl.y, 360);
  assert.equal(original.right.bl.y, 500);
});
