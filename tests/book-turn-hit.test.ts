import test from 'node:test';
import assert from 'node:assert/strict';
import { bookReducer, bookToken, createBookState } from '../src/book/controller.ts';
import type { BookState } from '../src/book/controller.ts';
import { createTurnDrag, turnReleaseDecision, updateTurnDrag } from '../src/book/gesture.ts';
import { pointOnScrollbar, turnCornerAtPoint, turnCornerRegion, turnInputAvailability, turnTargetOwnsInput } from '../src/book/turnHit.ts';
import type { StageLayout, StageQuad } from '../src/book/stage.ts';

const quad = (left: number, top: number, width: number, height: number): StageQuad => ({
  tl: { x: left, y: top }, tr: { x: left + width, y: top },
  bl: { x: left, y: top + height }, br: { x: left + width, y: top + height },
});
const layout: StageLayout = {
  width: 1280, height: 720, pageWidth: 2.64, pageHeight: 3.88, pageWorld: { width: 2.64, height: 3.88 },
  left: quad(100, 100, 400, 560), right: quad(500, 100, 400, 560), cover: quad(500, 100, 400, 560),
  safeRect: { left: 12, top: 12, right: 1268, bottom: 708 }, coverUvCenter: { x: 700, y: 380 },
  coverCenterErrorPx: 0, camera: { position: [], target: [], quaternion: [], span: 6 },
  bookBounds: { left: 100, right: 900, top: 100, bottom: 660 }, openWidthFraction: 0.625,
};
// Preserve the corrected first-release hit/guard regression as a two-spread fixture.
const openBook = (patch: Partial<BookState> = {}): BookState => ({ ...createBookState({ spreadCount: 2 }), isOpen: true,
  phase: 'spreadIdle', camera: 'settled', scene: 'ready', ...patch });
const availability = (patch: Partial<Parameters<typeof turnInputAvailability>[0]> = {}) => turnInputAvailability({
  book: openBook(), layout, stageReady: true, printsReady: true, textureCount: 4,
  preparedScene: '0:0:spread-1', ...patch,
});

test('visible paper interior is grabbable at both right corners; the old outside gutter is not required', () => {
  const available = availability();
  assert.deepEqual(turnCornerAtPoint(layout, { x: 880, y: 640 }, available), { direction: 'next', corner: 'bottom' });
  assert.deepEqual(turnCornerAtPoint(layout, { x: 880, y: 120 }, available), { direction: 'next', corner: 'top' });
  assert.deepEqual(turnCornerAtPoint(layout, layout.right.br, available), { direction: 'next', corner: 'bottom' });
  assert.equal(turnCornerAtPoint(layout, { x: 920, y: 640 }, available), null);
  assert.equal(turnCornerAtPoint(layout, { x: 880, y: 680 }, available), null);
  assert.equal(turnCornerAtPoint(layout, { x: 700, y: 400 }, available), null);
});

test('backward drag uses the left paper interior only on the second spread', () => {
  assert.equal(turnCornerAtPoint(layout, { x: 120, y: 640 }, availability()), null);
  const available = availability({ book: openBook({ currentSpreadId: 'spread-2' }), preparedScene: '0:0:spread-2' });
  assert.deepEqual(available, { next: false, prev: true });
  assert.deepEqual(turnCornerAtPoint(layout, { x: 120, y: 640 }, available), { direction: 'prev', corner: 'bottom' });
  assert.deepEqual(turnCornerAtPoint(layout, { x: 120, y: 120 }, available), { direction: 'prev', corner: 'top' });
  assert.equal(turnCornerAtPoint(layout, { x: 80, y: 640 }, available), null);
  assert.equal(turnCornerAtPoint(layout, { x: 880, y: 640 }, available), null);
});

test('corner marker and hit geometry agree on 44 CSS pixels inside all four paper corners', () => {
  assert.deepEqual(turnCornerRegion(layout.right, 'next', 'bottom'), quad(856, 616, 44, 44));
  assert.deepEqual(turnCornerRegion(layout.right, 'next', 'top'), quad(856, 100, 44, 44));
  assert.deepEqual(turnCornerRegion(layout.left, 'prev', 'bottom'), quad(100, 616, 44, 44));
  assert.deepEqual(turnCornerRegion(layout.left, 'prev', 'top'), quad(100, 100, 44, 44));
});

test('affine skew, reverse orientation and smaller viewports keep hits attached to the paper', () => {
  for (const [ax, ay, bx, by] of [[340, 25, -12, 500], [-240, 35, 20, 300], [25, -80, 180, 40], [120, 0, 0, 180]]) {
    const page = { tl: { x: 100, y: 100 }, tr: { x: 100 + ax, y: 100 + ay },
      bl: { x: 100 + bx, y: 100 + by }, br: { x: 100 + ax + bx, y: 100 + ay + by } };
    for (const direction of ['next', 'prev'] as const) for (const corner of ['top', 'bottom'] as const) {
      const region = turnCornerRegion(page, direction, corner)!;
      const center = { x: (region.tl.x + region.br.x) / 2, y: (region.tl.y + region.br.y) / 2 };
      const available = { next: direction === 'next', prev: direction === 'prev' };
      assert.deepEqual(turnCornerAtPoint({ ...layout, right: page, left: page }, center, available), { direction, corner });
      assert.ok(Math.abs(Math.hypot(region.tr.x - region.tl.x, region.tr.y - region.tl.y) - 44) < 1e-8);
      assert.ok(Math.abs(Math.hypot(region.bl.x - region.tl.x, region.bl.y - region.tl.y) - 44) < 1e-8);
    }
  }
});

test('invalid and edge-on paper cannot offer a cursor or a drag hit', () => {
  for (const page of [{ ...layout.right, tr: layout.right.tl }, { ...layout.right, br: { x: NaN, y: 0 } },
    { ...layout.right, br: { x: 920, y: 660 } }]) {
    assert.equal(turnCornerRegion(page, 'next', 'bottom'), null);
    assert.equal(availability({ layout: { ...layout, right: page } }).next, false);
    assert.equal(turnCornerAtPoint({ ...layout, right: page }, { x: 880, y: 640 }, { next: true, prev: false }), null);
  }
  assert.equal(turnCornerAtPoint(null, { x: 880, y: 640 }, availability()), null);
  assert.equal(turnCornerAtPoint(layout, { x: Infinity, y: 640 }, availability()), null);
});

test('every print, scene, lifecycle and pointer ownership guard disables the same hit availability', () => {
  const blocked: Partial<Parameters<typeof turnInputAvailability>[0]>[] = [
    { layout: null }, { stageReady: false }, { printsReady: false }, { textureCount: 0 }, { textureCount: 3 },
    { textureCount: 5 }, { preparedScene: '' }, { preparedScene: '0:1:spread-1' }, { pointerOwned: true },
    { book: openBook({ hidden: true }) }, { book: openBook({ isOpen: false }) },
    { book: openBook({ mode: '2d', phase: 'fallback2D' }) }, { book: openBook({ phase: 'preparingTurn' }) },
    { book: openBook({ phase: 'cancelSettling' }) }, { book: openBook({ scene: 'entering' }) },
    { book: openBook({ camera: 'suspended' }) }, { book: openBook({ bookEpoch: 1 }) },
  ];
  for (const patch of blocked) {
    const available = availability(patch);
    assert.deepEqual(available, { next: false, prev: false }, JSON.stringify(patch));
    assert.equal(turnCornerAtPoint(layout, { x: 880, y: 640 }, available), null);
  }
});

test('playing, paused and reduced-motion readers retain valid navigation ownership', () => {
  for (const scene of ['ready', 'playing', 'paused'] as const) {
    assert.deepEqual(availability({ book: openBook({ scene }) }), { next: true, prev: false });
  }
  assert.deepEqual(availability({ book: openBook({ reducedMotion: true }) }), { next: true, prev: false });
});

const element = (tagName = 'DIV', attributes: Record<string, string | undefined> = {}, parentElement?: unknown) => ({
  tagName, parentElement, getAttribute: (name: string) => attributes[name] ?? null,
  classList: { contains: (name: string) => (attributes.class ?? '').split(/\s+/).includes(name) },
});

test('lesson buttons, inputs, labels, settings and instruments own input even inside a corner', () => {
  for (const tag of ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL', 'SUMMARY', 'A', 'DIALOG']) {
    assert.equal(turnTargetOwnsInput(element('SPAN', {}, element(tag))), true, tag);
  }
  for (const attributes of [{ 'data-book-instrument': '' }, { 'data-instrument': '' }, { 'data-event-select': 'note-1' },
    { class: 'book-popup-window' }, { class: 'book-progress-tools' }, { contenteditable: 'plaintext-only' },
    { role: 'slider' }, { role: 'radiogroup' }, { role: 'button' }]) {
    assert.equal(turnTargetOwnsInput(element('SPAN', {}, element('DIV', attributes))), true, JSON.stringify(attributes));
  }
});

test('plain paper and non-editable text remain eligible and unknown/cyclic targets stay safe', () => {
  assert.equal(turnTargetOwnsInput(element('P')), false);
  assert.equal(turnTargetOwnsInput(element('DIV', { contenteditable: 'false' })), false);
  assert.equal(turnTargetOwnsInput({ isContentEditable: true }), true);
  assert.equal(turnTargetOwnsInput(null), false);
  const cycle: { parentElement?: unknown } = {};
  cycle.parentElement = cycle;
  assert.equal(turnTargetOwnsInput(cycle), false);
});

const scrollMetrics = { rect: { left: 500, top: 100, width: 400, height: 560 },
  offsetWidth: 400, offsetHeight: 560, clientWidth: 392, clientHeight: 552, clientLeft: 0, clientTop: 0 };
test('native vertical and horizontal scrollbars take precedence over corner dragging', () => {
  assert.equal(pointOnScrollbar({ x: 896, y: 640 }, scrollMetrics), true);
  assert.equal(pointOnScrollbar({ x: 880, y: 656 }, scrollMetrics), true);
  assert.equal(pointOnScrollbar({ x: 880, y: 640 }, scrollMetrics), false);
  assert.equal(pointOnScrollbar({ x: 910, y: 640 }, scrollMetrics), false);
  assert.equal(pointOnScrollbar({ x: 500, y: 120 }, { ...scrollMetrics, clientLeft: 8 }), true);
  assert.equal(pointOnScrollbar({ x: 896, y: 640 }, { ...scrollMetrics, clientWidth: 400, clientHeight: 560 }), false);
});

test('scrollbar ownership respects CSS scaling and rejects empty layout', () => {
  const scaled = { ...scrollMetrics, rect: { left: 500, top: 100, width: 200, height: 280 } };
  assert.equal(pointOnScrollbar({ x: 698, y: 370 }, scaled), true);
  assert.equal(pointOnScrollbar({ x: 690, y: 370 }, scaled), false);
  assert.equal(pointOnScrollbar({ x: 698, y: 370 }, { ...scaled, offsetWidth: 0 }), false);
});

test('a paper-interior hit enters the existing owner state and preserves hold, cancellation and commit rules', () => {
  const hit = turnCornerAtPoint(layout, { x: 880, y: 640 }, availability())!;
  assert.ok(hit);
  const sample = { x: 880, y: 640, time: 0, velocity: 0 };
  let book = bookReducer(openBook(), { type: 'TURN_DRAG_START', ...hit, gestureId: 1, pointerId: 7,
    surfacesReady: true, sample });
  assert.equal(book.phase, 'preparingTurn');
  book = bookReducer(book, { type: 'TURN_PREPARED', token: bookToken(book) });
  let drag = createTurnDrag({ clientX: 880, clientY: 640, time: 0 }, 'next', 400);
  drag = updateTurnDrag(drag, { clientX: 360, clientY: 640, time: 1000 });
  drag = updateTurnDrag(drag, { clientX: 360, clientY: 640, time: 3000 });
  assert.equal(drag.progress, 0.65);
  assert.equal(drag.directionalVelocity, 0);
  book = bookReducer(book, { type: 'TURN_DRAG_MOVE', token: bookToken(book), gestureId: 1,
    activated: drag.activated, progress: drag.progress, sample: { x: 360, y: 640, time: 3000, velocity: 0 } });
  assert.equal(book.gesture?.pointerActive, true);
  assert.equal(bookReducer(book, { type: 'TURN_COMPLETE', token: bookToken(book) }), book);
  const cancelled = bookReducer(book, { type: 'TURN_CANCEL', gestureId: 1 });
  assert.equal(cancelled.phase, 'cancelSettling');
  const released = bookReducer(book, { type: 'TURN_RELEASE', token: bookToken(book), gestureId: 1,
    sample: { x: 360, y: 640, time: 3000, velocity: 0 }, decision: turnReleaseDecision(drag, 3000) });
  assert.equal(released.phase, 'settling');
  assert.equal(released.gesture?.pointerActive, false);
});
