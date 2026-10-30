import test from 'node:test';
import assert from 'node:assert/strict';
import { bookCanInteract, bookReducer, bookToken, createBookState } from '../src/book/controller.ts';
import type { BookEvent, BookState } from '../src/book/controller.ts';
import { BOOK_MANIFEST, BOOK_SPREADS, bookIndex, bookLeaf, bookLeaves, bookNeighbour, bookPrintIds, bookSpreads, bookTurnPrintIds, GO_TO_STAGGER_MS, goToFrame, goToLeafMs,
  goToSchedule, LEAF_POOL_SIZE, leafProgresses, spreadIndex } from '../src/book/manifest.ts';
import type { SpreadId } from '../src/book/manifest.ts';
import { stackHeights } from '../src/book/geometry.ts';

/** v3 R8-a (REFACTOR_PROMPTS_V3 R8-a 6): the whole book — contents, six lessons, closing — and GO_TO. */
type Completion = 'BOOT_READY' | 'COVER_COMPLETE' | 'CAMERA_COMPLETE' | 'SCENE_READY' | 'TURN_PREPARED' | 'TURN_COMPLETE' | 'SETTLED' | 'SCENE_EXITED';
const complete = (state: BookState, type: Completion): BookState => bookReducer(state, { type, token: bookToken(state) } as BookEvent);
function openBook(spreadId: SpreadId = 'spread-1'): BookState {
  let state = complete(createBookState({ reducedMotion: true }), 'BOOT_READY');
  state = bookReducer(state, { type: 'OPEN_BOOK', inputId: 1, spreadId });
  state = complete(complete(state, 'COVER_COMPLETE'), 'CAMERA_COMPLETE');
  return complete(state, 'SCENE_READY');
}
function finish(state: BookState): BookState {
  return complete(complete(complete(complete(state, 'TURN_PREPARED'), 'TURN_COMPLETE'), 'SETTLED'), 'SCENE_READY');
}

test('R8: the book is contents, six lessons and closing; lesson fixtures keep their prefixes', () => {
  assert.deepEqual(BOOK_SPREADS.map(spread => spread.spreadId), ['contents', 'spread-1', 'spread-2', 'spread-3', 'spread-4', 'spread-5', 'spread-6', 'closing']);
  assert.equal(BOOK_MANIFEST.length, 6, 'lessons only (the record schema and V13 fixtures)');
  assert.equal(bookSpreads().length, 8);
  assert.deepEqual(bookSpreads(2).map(spread => spread.spreadId), ['spread-1', 'spread-2'], 'G1 fixture: no matter');
  assert.equal(bookIndex('spread-1'), 1);
  assert.equal(spreadIndex('spread-1'), 0, 'the lesson-only helper keeps its contract');
  assert.equal(bookNeighbour('spread-1', 'prev')?.spreadId, 'contents');
  assert.equal(bookNeighbour('spread-6', 'next')?.spreadId, 'closing');
  assert.equal(bookNeighbour('closing', 'next'), undefined);
  // Every page ID is unique across the book; the matter pages carry no scene.
  const pages = BOOK_SPREADS.flatMap(spread => [spread.leftPageId, spread.rightPageId]);
  assert.equal(new Set(pages).size, 16);
  assert.deepEqual(BOOK_SPREADS.filter(spread => spread.sceneId === null).map(spread => spread.spreadId), ['contents', 'closing']);
  assert.deepEqual(bookPrintIds('contents'), ['page-13', 'page-14', 'page-1', 'page-2']);
  assert.deepEqual(bookPrintIds('closing'), ['page-11', 'page-12', 'page-15', 'page-16']);
  // One physical leaf between neighbours, the same both ways; GO_TO turns them in order.
  const leaf = bookLeaf('contents', 'spread-1')!;
  assert.deepEqual([leaf.frontPageId, leaf.backPageId, leaf.stationaryLeftPageId, leaf.stationaryRightPageId], ['page-14', 'page-1', 'page-13', 'page-2']);
  assert.equal(bookLeaf('spread-1', 'contents')!.leafId, leaf.leafId);
  assert.deepEqual(bookLeaves('contents', 'spread-4').map(item => [item.frontPageId, item.backPageId]),
    [['page-14', 'page-1'], ['page-2', 'page-3'], ['page-4', 'page-5'], ['page-6', 'page-7']]);
  assert.deepEqual(bookLeaves('spread-4', 'contents').map(item => item.direction), ['prev', 'prev', 'prev', 'prev']);
  assert.deepEqual(bookLeaves('spread-2', 'spread-2'), []);
});

test('R8: GO_TO turns n leaves in one turn (≤ 1.6 s) and lands on the target', () => {
  assert.equal(goToLeafMs(1, 1120), 1120, 'a single leaf is an ordinary turn');
  assert.equal(goToLeafMs(4, 1120), 400);
  assert.ok([2, 3, 4, 5, 6, 7].every(n => n * goToLeafMs(n, 1120) <= 1600 + 1e-9));
  const contents = finish(bookReducer(openBook('spread-1'), { type: 'PREV' }));
  assert.equal(contents.currentSpreadId, 'contents');
  const jump = bookReducer(contents, { type: 'GO_TO', spreadId: 'spread-4' });
  assert.equal(jump.phase, 'preparingTurn');
  assert.equal(jump.destinationSpreadId, 'spread-4');
  assert.equal(jump.direction, 'next');
  assert.equal(jump.navigationToken, contents.navigationToken + 1);
  const turning = complete(jump, 'TURN_PREPARED');
  assert.equal(turning.phase, 'turningForward');
  // NEXT during the jump is judged from the destination and waits in the single slot.
  const queued = bookReducer(turning, { type: 'NEXT' });
  assert.equal(queued.pendingIntent, 'next');
  const landed = complete(complete(complete(queued, 'TURN_COMPLETE'), 'SETTLED'), 'SCENE_READY');
  assert.equal(landed.phase, 'preparingTurn', 'the queued NEXT runs after arrival');
  assert.equal(landed.currentSpreadId, 'spread-4');
  assert.equal(landed.destinationSpreadId, 'spread-5');
  // Backwards, to the closing and back to the contents.
  const closing = finish(bookReducer(openBook('spread-6'), { type: 'GO_TO', spreadId: 'closing' }));
  assert.equal(closing.currentSpreadId, 'closing');
  assert.equal(bookReducer(closing, { type: 'NEXT' }), closing, 'nothing after the closing');
  const back = bookReducer(closing, { type: 'GO_TO', spreadId: 'contents' });
  assert.equal(back.direction, 'prev');
  assert.equal(finish(back).currentSpreadId, 'contents');
});

test('R8: GO_TO guards — same spread, unknown spread, held drag, closing book; PREV on contents closes', () => {
  const open = openBook('spread-2');
  assert.equal(bookReducer(open, { type: 'GO_TO', spreadId: 'spread-2' }), open);
  assert.equal(bookReducer(open, { type: 'GO_TO', spreadId: 'spread-9' as SpreadId }), open);
  const contents = finish(bookReducer(openBook('spread-1'), { type: 'PREV' }));
  assert.equal(bookReducer(contents, { type: 'PREV' }).phase, 'closing', 'the first spread of the book is the contents');
  const closingBook = bookReducer(contents, { type: 'PREV' });
  assert.equal(bookReducer(closingBook, { type: 'GO_TO', spreadId: 'spread-3' }), closingBook);
  // During a shot GO_TO waits like NEXT.
  const shot = bookReducer(open, { type: 'SHOT_START', token: bookToken(open) });
  const waiting = bookReducer(shot, { type: 'GO_TO', spreadId: 'spread-5' });
  assert.deepEqual(waiting.pendingIntent, { goTo: 'spread-5' });
  const returned = bookReducer(waiting, { type: 'SHOT_END', token: bookToken(waiting) });
  assert.equal(returned.destinationSpreadId, 'spread-5');
});

test('R8: hiding the page mid-jump recovers on the departed spread; the reader can interact again after it enters', () => {
  const jump = complete(bookReducer(openBook('spread-1'), { type: 'GO_TO', spreadId: 'spread-5' }), 'TURN_PREPARED');
  const hidden = bookReducer(jump, { type: 'HIDE_DOCUMENT' });
  assert.equal(hidden.destinationSpreadId, null);
  assert.equal(hidden.currentSpreadId, 'spread-1');
  assert.equal(hidden.phase, 'spreadIdle');
  const shown = complete(bookReducer(hidden, { type: 'SHOW_DOCUMENT' }), 'SCENE_READY');
  assert.equal(bookCanInteract(shown), true);
});

test('R8: stack heights stay monotonic over eight spreads', () => {
  for (const count of [6, 8]) {
    let previous = Infinity;
    for (let index = 0; index < count; index += 1) {
      const heights = stackHeights(index, count);
      assert.ok(heights.right <= previous + 1e-12, `right stack shrinks as the book advances (${count})`);
      assert.ok(heights.left >= 0 && heights.right >= 0);
      previous = heights.right;
    }
  }
});

test('R8: the GO_TO schedule staggers leaves by 45 ms, never flies more than three, and ends within 1.6 s', () => {
  const single = goToSchedule(1, 1120);
  assert.deepEqual([single.starts, single.totalMs, leafProgresses(single, 0.4)], [[0], 1120, [0.4]], 'one leaf is the ordinary turn');
  for (let n = 2; n <= 7; n += 1) {
    const schedule = goToSchedule(n, 1120);
    assert.equal(schedule.leafMs, goToLeafMs(n, 1120));
    assert.ok(schedule.totalMs <= 1600 + 1e-9, `${n} leaves end within 1.6 s (${schedule.totalMs})`);
    schedule.starts.forEach((start, index) => {
      if (index > 0) assert.ok(start >= schedule.starts[index - 1]! + GO_TO_STAGGER_MS - 1e-9, `${n}: leaf ${index} leaves 45 ms after the one before`);
      if (index >= LEAF_POOL_SIZE) assert.ok(start >= schedule.starts[index - LEAF_POOL_SIZE]! + schedule.leafMs - 1e-9, `${n}: leaf ${index} waits for its pool slot`);
    });
    // At no moment are more than three leaves in the air.
    for (let step = 0; step <= 400; step += 1) {
      const progress = leafProgresses(schedule, step / 400);
      assert.ok(progress.filter(value => value > 0 && value < 1).length <= LEAF_POOL_SIZE, `${n} leaves at ${step / 400}`);
      assert.ok(progress.every((value, index) => index === 0 || value <= progress[index - 1]! + 1e-12), 'a later leaf never overtakes');
    }
    assert.ok(leafProgresses(schedule, 0).every(value => value === 0));
    assert.ok(leafProgresses(schedule, 1).every(value => value === 1));
  }
  // Contents → lesson 4: four leaves of 400 ms; the fourth waits for the first to land.
  const four = goToSchedule(4, 1120);
  assert.deepEqual([four.leafMs, four.starts, four.totalMs], [400, [0, 45, 90, 400], 800]);
});

test('R8: a GO_TO frame shows the stacks under its flying leaves and uses one pool slot per leaf', () => {
  const at = (progresses: number[]) => goToFrame('contents', 'spread-4', progresses)!;
  const start = at([0, 0, 0, 0]);
  assert.deepEqual([start.staticLeftPageId, start.staticRightPageId, start.slots.every(slot => slot === null)], ['page-13', 'page-14', true]);
  const fanned = at([0.6, 0.4, 0.2, 0]);
  assert.deepEqual([fanned.staticLeftPageId, fanned.staticRightPageId], ['page-13', 'page-6'], 'right stack: the spread after the last leaf that left');
  assert.deepEqual(fanned.slots.map(slot => slot && [slot.index, slot.leaf.frontPageId, slot.leaf.backPageId]), [[0, 'page-14', 'page-1'], [1, 'page-2', 'page-3'], [2, 'page-4', 'page-5']]);
  const reused = at([1, 0.9, 0.8, 0.1]);
  assert.deepEqual([reused.staticLeftPageId, reused.staticRightPageId], ['page-1', 'page-8']);
  assert.deepEqual(reused.slots.map(slot => slot?.index ?? null), [3, 1, 2], 'leaf 3 reuses slot 0 once leaf 0 has landed');
  const landed = at([1, 1, 1, 1]);
  assert.deepEqual([landed.staticLeftPageId, landed.staticRightPageId, landed.slots.every(slot => slot === null)], ['page-7', 'page-8', true]);
  // Backward: leaves leave the left stack and land on the right.
  const back = goToFrame('closing', 'spread-4', [0.5, 0.2, 0])!;
  assert.deepEqual([back.staticLeftPageId, back.staticRightPageId], ['page-9', 'page-16']);
  assert.deepEqual(back.slots.map(slot => slot && [slot.leaf.backPageId, slot.leaf.frontPageId]), [['page-15', 'page-12'], ['page-11', 'page-10'], null]);
  assert.equal(goToFrame('contents', 'spread-4', [0.5]), null, 'one progress per leaf');
});

test('R8: a GO_TO prints its far end before it starts, still six pages; a neighbour turn keeps current ± 1', () => {
  assert.deepEqual(bookTurnPrintIds('spread-2', 'spread-3'), bookPrintIds('spread-2'));
  assert.deepEqual(bookTurnPrintIds('spread-2', null), bookPrintIds('spread-2'));
  const forward = bookTurnPrintIds('contents', 'spread-4');
  assert.deepEqual(forward, ['page-13', 'page-14', 'page-1', 'page-6', 'page-7', 'page-8']);
  const backward = bookTurnPrintIds('closing', 'spread-1');
  assert.deepEqual(backward, ['page-15', 'page-16', 'page-12', 'page-3', 'page-1', 'page-2']);
  for (const [from, to] of [['contents', 'closing'], ['closing', 'contents'], ['spread-1', 'spread-6'], ['spread-5', 'spread-2']] as const) {
    assert.ok(bookTurnPrintIds(from, to).length <= 6, `${from} → ${to} stays inside the six-page print budget`);
  }
});
