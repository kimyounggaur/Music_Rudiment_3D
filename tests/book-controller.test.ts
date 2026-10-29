import test from 'node:test';
import assert from 'node:assert/strict';
import { G1_MANIFEST as BOOK_MANIFEST, adjacentSpread as fullAdjacentSpread, spreadAt as fullSpreadAt, spreadIndex as fullSpreadIndex, turningLeaf as fullTurningLeaf } from '../src/book/manifest.ts';
import type { NavigationDirection, SpreadId } from '../src/book/manifest.ts';
import { bookCanInteract, bookReducer, bookToken, createBookState as fullBookState } from '../src/book/controller.ts';
import type { BookEvent, BookState, PointerSample } from '../src/book/controller.ts';

// Keep every original G1 assertion, including its two-spread boundary. V13's
// expanded curriculum is covered independently, not by relaxing these checks.
const createBookState = (options: Parameters<typeof fullBookState>[0] = {}) => fullBookState({ ...options, spreadCount: BOOK_MANIFEST.length });
const adjacentSpread = (id: SpreadId, direction: NavigationDirection) => fullAdjacentSpread(id, direction, BOOK_MANIFEST.length);
const spreadAt = (index: number) => fullSpreadAt(index, BOOK_MANIFEST.length);
const spreadIndex = (id: SpreadId) => fullSpreadIndex(id, BOOK_MANIFEST.length);
const turningLeaf = (from: SpreadId, to: SpreadId) => fullTurningLeaf(from, to, BOOK_MANIFEST.length);

const sample = (x = 0, time = 0, velocity = 0): PointerSample => ({ x, y: 25, time, velocity });
type Completion = 'BOOT_READY' | 'INTRO_SETTLED' | 'COVER_COMPLETE' | 'CAMERA_COMPLETE' | 'SCENE_EXITED'
  | 'SCENE_READY' | 'TURN_PREPARED' | 'TURN_COMPLETE' | 'SETTLED' | 'TRANSPORT_STARTING' | 'TRANSPORT_PAUSED' | 'TRANSPORT_STOPPED';
const complete = (state: BookState, type: Completion): BookState => bookReducer(state, { type, token: bookToken(state) });
function idleCover(options: Parameters<typeof createBookState>[0] = {}): BookState {
  let state = complete(createBookState(options), 'BOOT_READY');
  if (state.phase === 'introReady') {
    state = bookReducer(state, { type: 'START_INTRO' });
    state = complete(state, 'INTRO_SETTLED');
  }
  return state;
}
function openBook(options: Parameters<typeof createBookState>[0] = {}): BookState {
  let state = bookReducer(idleCover(options), { type: 'OPEN_BOOK', inputId: 1 });
  state = complete(complete(state, 'COVER_COMPLETE'), 'CAMERA_COMPLETE');
  return complete(state, 'SCENE_READY');
}
function finishTurn(state: BookState): BookState {
  state = complete(state, 'TURN_PREPARED');
  state = complete(state, 'TURN_COMPLETE');
  state = complete(state, 'SETTLED');
  return complete(state, 'SCENE_READY');
}
function dragStart(state = openBook()): BookState {
  return bookReducer(state, { type: 'TURN_DRAG_START', direction: 'next', gestureId: 7, pointerId: 13,
    corner: 'bottom', sample: sample(), surfacesReady: true });
}

test('saved cover choice opens the supported target directly and browsing first is a separate choice', () => {
  const cover = idleCover();
  let resumed = bookReducer(cover, { type: 'OPEN_BOOK', inputId: 61, spreadId: 'spread-2' });
  assert.equal(resumed.phase, 'opening');
  assert.equal(resumed.isOpen, false);
  assert.equal(resumed.currentSpreadId, 'spread-2');
  assert.equal(resumed.destinationSpreadId, null, 'resuming does not replay intervening page turns');
  resumed = complete(complete(resumed, 'COVER_COMPLETE'), 'CAMERA_COMPLETE');
  assert.equal(resumed.scene, 'entering');
  assert.equal(resumed.transportSessionId, null);
  assert.equal(resumed.transport, 'locked');
  const browsing = bookReducer(cover, { type: 'OPEN_BOOK', inputId: 62, spreadId: 'spread-1' });
  assert.equal(browsing.currentSpreadId, 'spread-1');
  assert.equal(bookReducer(cover, { type: 'OPEN_BOOK', inputId: 63, spreadId: 'spread-6' as 'spread-2' }), cover);
});

test('applying imported/deleted records resets to a closed preparation barrier and rejects old owners', () => {
  let state = complete(openBook(), 'TRANSPORT_STARTING');
  const stale = bookToken(state);
  state = bookReducer(state, { type: 'TRANSPORT_PLAYING', token: stale, sessionId: 71 });
  state = bookReducer(state, { type: 'RESTORE_CLOSED', mode: '2d', reducedMotion: true });
  assert.equal(state.isOpen, false);
  assert.equal(state.phase, 'bootLoading');
  assert.equal(state.firstSpreadReady, false);
  assert.equal(state.currentSpreadId, 'spread-1');
  assert.equal(state.transportSessionId, null);
  assert.equal(state.mode, '2d');
  assert.equal(state.reducedMotion, true);
  assert.equal(bookReducer(state, { type: 'TRANSPORT_PLAYING', token: stale, sessionId: 71 }), state);
  assert.equal(bookReducer(state, { type: 'SCENE_READY', token: stale }), state);
  state = complete(state, 'BOOT_READY');
  assert.equal(state.phase, 'coverIdle');
  assert.equal(state.isOpen, false, 'import never auto-opens or starts audio');
});
function dragMove(state: BookState, progress: number, activated = true): BookState {
  return bookReducer(state, { type: 'TURN_DRAG_MOVE', token: bookToken(state), gestureId: 7,
    sample: sample(progress * 200, progress * 1000, 0.2), progress, activated });
}
function release(state: BookState, decision: 'commit' | 'cancel'): BookState {
  return bookReducer(state, { type: 'TURN_RELEASE', token: bookToken(state), gestureId: 7, sample: sample(100, 600, 0.1), decision });
}

test('G1 manifest maps exactly two spreads and both directions to the same physical printed leaf', () => {
  assert.equal(BOOK_MANIFEST.length, 2);
  assert.equal(spreadIndex('spread-1'), 0);
  assert.equal(spreadAt(1)?.sceneId, 'scene-2');
  assert.equal(spreadAt(-1), undefined);
  assert.equal(spreadAt(0.5), undefined);
  assert.equal(adjacentSpread('spread-1', 'prev'), undefined);
  assert.equal(adjacentSpread('spread-2', 'next'), undefined);
  const forward = turningLeaf('spread-1', 'spread-2')!;
  const backward = turningLeaf('spread-2', 'spread-1')!;
  assert.deepEqual([forward.frontPageId, forward.backPageId, forward.stationaryLeftPageId, forward.stationaryRightPageId], ['page-2', 'page-3', 'page-1', 'page-4']);
  assert.equal(backward.leafId, forward.leafId);
  assert.equal(backward.frontPageId, forward.frontPageId);
  assert.equal(backward.backPageId, forward.backPageId);
  assert.equal(backward.direction, 'prev');
  assert.equal(turningLeaf('spread-1', 'spread-1'), null);
});

test('closed next is ignored; skip consumes its input without opening and open is accepted only once', () => {
  let state = complete(createBookState(), 'BOOT_READY');
  state = bookReducer(state, { type: 'START_INTRO' });
  assert.equal(bookReducer(state, { type: 'NEXT' }), state);
  state = bookReducer(state, { type: 'SKIP_INTRO', inputId: 42 });
  assert.equal(state.phase, 'coverIdle');
  assert.equal(state.isOpen, false);
  assert.equal(bookReducer(state, { type: 'OPEN_BOOK', inputId: 42 }), state);
  state = bookReducer(state, { type: 'OPEN_BOOK', inputId: 43 });
  assert.equal(state.phase, 'opening');
  assert.equal(bookReducer(state, { type: 'OPEN_BOOK', inputId: 44 }), state);
  const notReady = { ...idleCover(), firstSpreadReady: false };
  assert.equal(bookReducer(notReady, { type: 'OPEN_BOOK', inputId: 1 }), notReady);
});

test('cover and camera form a join barrier in either completion order; scene readiness separately enables input', () => {
  for (const first of ['COVER_COMPLETE', 'CAMERA_COMPLETE'] as const) {
    let state = bookReducer(idleCover(), { type: 'OPEN_BOOK', inputId: 1 });
    state = complete(state, first);
    assert.equal(state.phase, 'opening');
    assert.equal(state.scene, 'unmounted');
    assert.equal(bookCanInteract(state), false);
    state = complete(state, first === 'COVER_COMPLETE' ? 'CAMERA_COMPLETE' : 'COVER_COMPLETE');
    assert.equal(state.phase, 'spreadIdle');
    assert.equal(state.scene, 'entering');
    assert.equal(bookCanInteract(state), false);
    state = complete(state, 'SCENE_READY');
    assert.equal(bookCanInteract(state), true);
  }
});

test('button next commits only at settle and stale completion can never commit twice', () => {
  let state = bookReducer(openBook(), { type: 'NEXT', source: 'keyboard' });
  const token = bookToken(state);
  assert.equal(state.phase, 'preparingTurn');
  assert.equal(state.currentSpreadId, 'spread-1');
  assert.equal(state.destinationSpreadId, 'spread-2');
  state = complete(state, 'TURN_PREPARED');
  state = bookReducer(state, { type: 'TURN_PROGRESS', token, progress: 0.5 });
  assert.equal(state.currentSpreadId, 'spread-1');
  state = complete(state, 'TURN_COMPLETE');
  assert.equal(state.currentSpreadId, 'spread-1');
  state = complete(state, 'SETTLED');
  assert.equal(state.currentSpreadId, 'spread-2');
  assert.equal(state.scene, 'entering');
  assert.equal(bookReducer(state, { type: 'SETTLED', token }), state);
  assert.equal(bookReducer(state, { type: 'SCENE_READY', token }), state);
});

test('ten next presses have bounded pending intent and never leave the G1 manifest', () => {
  let state = openBook();
  for (let i = 0; i < 10; i++) state = bookReducer(state, { type: 'NEXT' });
  assert.equal(state.destinationSpreadId, 'spread-2');
  assert.equal(state.pendingIntent, null);
  state = finishTurn(state);
  assert.equal(state.currentSpreadId, 'spread-2');
  assert.equal(bookReducer(state, { type: 'NEXT' }), state);
});

test('forward then prev waits for current commit and returns exactly once; invalid next cannot replace valid pending prev', () => {
  let state = bookReducer(openBook(), { type: 'NEXT' });
  state = bookReducer(state, { type: 'PREV' });
  state = bookReducer(state, { type: 'NEXT' });
  assert.equal(state.pendingIntent, 'prev');
  state = finishTurn(state);
  assert.equal(state.currentSpreadId, 'spread-2');
  assert.equal(state.phase, 'preparingTurn');
  assert.equal(state.direction, 'prev');
  state = finishTurn(state);
  assert.equal(state.currentSpreadId, 'spread-1');
  assert.equal(state.pendingIntent, null);
  assert.equal(state.phase, 'spreadIdle');
});

test('held drag follows position immediately, reverses, and cannot be completed by a clock callback', () => {
  let state = dragStart();
  state = dragMove(state, 0.4);
  assert.equal(state.phase, 'preparingTurn');
  assert.equal(state.progress, 0.4);
  state = complete(state, 'TURN_PREPARED');
  state = dragMove(state, 0.75);
  const held = state;
  assert.equal(complete(state, 'TURN_COMPLETE'), held);
  assert.equal(bookReducer(state, { type: 'TURN_PROGRESS', token: bookToken(state), progress: 1 }), held);
  state = dragMove(state, 0.2);
  assert.equal(state.progress, 0.2);
  assert.equal(state.gesture?.corner, 'bottom');
  assert.equal(state.currentSpreadId, 'spread-1');
});

test('cancel-settling queues against the restored first spread, then navigates only after its ready barrier', () => {
  let state = release(dragMove(complete(dragStart(), 'TURN_PREPARED'), 0.3), 'cancel');
  assert.equal(state.phase, 'cancelSettling');
  assert.equal(state.currentSpreadId, 'spread-1');
  assert.equal(state.destinationSpreadId, 'spread-2');
  state = bookReducer(state, { type: 'NEXT', source: 'keyboard' });
  assert.equal(state.pendingIntent, 'next');
  state = complete(state, 'SETTLED');
  assert.equal(state.currentSpreadId, 'spread-1');
  assert.equal(state.scene, 'entering');
  state = complete(state, 'SCENE_READY');
  assert.equal(state.phase, 'preparingTurn');
  assert.equal(state.destinationSpreadId, 'spread-2');
  state = finishTurn(state);
  assert.equal(state.currentSpreadId, 'spread-2');
  assert.equal(state.pendingIntent, null);
});

test('cancelled backward drag retains the final-spread boundary and permits the latest valid previous intent', () => {
  let state = finishTurn(bookReducer(openBook(), { type: 'NEXT' }));
  state = bookReducer(state, { type: 'TURN_DRAG_START', direction: 'prev', gestureId: 7, pointerId: 13,
    corner: 'bottom', sample: sample(), surfacesReady: true });
  state = release(dragMove(complete(state, 'TURN_PREPARED'), 0.3), 'cancel');
  assert.equal(state.currentSpreadId, 'spread-2');
  assert.equal(state.destinationSpreadId, 'spread-1');
  assert.equal(bookReducer(state, { type: 'NEXT', source: 'button' }), state);
  state = bookReducer(state, { type: 'PREV', source: 'button' });
  assert.equal(state.pendingIntent, 'prev');
  assert.equal(bookReducer(state, { type: 'NEXT', source: 'keyboard' }), state);
  state = complete(complete(state, 'SETTLED'), 'SCENE_READY');
  assert.equal(state.currentSpreadId, 'spread-2');
  assert.equal(state.destinationSpreadId, 'spread-1');
  assert.equal(finishTurn(state).currentSpreadId, 'spread-1');
});

test('navigation prediction is an identity no-op at a playing boundary and while another gesture owns the page', () => {
  let last = finishTurn(bookReducer(openBook(), { type: 'NEXT' }));
  last = complete(last, 'TRANSPORT_STARTING');
  last = bookReducer(last, { type: 'TRANSPORT_PLAYING', token: bookToken(last), sessionId: 91 });
  for (const source of ['keyboard', 'button'] as const) {
    const predicted = bookReducer(last, { type: 'NEXT', source });
    assert.equal(predicted, last, 'caller can reject without stopping the playing session');
    assert.equal(predicted.transport, 'playing');
    assert.equal(predicted.transportSessionId, 91);
  }
  const held = dragMove(complete(dragStart(), 'TURN_PREPARED'), 0.6);
  for (const type of ['NEXT', 'PREV'] as const) {
    assert.equal(bookReducer(held, { type, source: 'button' }), held);
    assert.equal(bookReducer(held, { type, source: 'keyboard' }), held);
  }
  assert.equal(held.gesture?.pointerActive, true);
  assert.equal(held.pendingIntent, null);
});

test('release before preparation remembers one accepted settle and never resurrects pointer tracking', () => {
  let state = dragMove(dragStart(), 0.4);
  state = release(state, 'commit');
  assert.equal(state.phase, 'preparingTurn');
  assert.equal(state.gesture?.pointerActive, false);
  const released = state;
  assert.equal(dragMove(state, 0.7), released);
  state = complete(state, 'TURN_PREPARED');
  assert.equal(state.phase, 'settling');
  state = complete(state, 'SETTLED');
  assert.equal(state.currentSpreadId, 'spread-2');
  assert.equal(state.gesture, null);
});

test('early tap and cancel invalidate preparation callbacks, preserving the committed page', () => {
  for (const activated of [false, true]) {
    let state = dragMove(dragStart(), activated ? 0.1 : 0, activated);
    const stale = bookToken(state);
    state = release(state, activated ? 'cancel' : 'commit');
    assert.equal(state.phase, 'cancelSettling');
    assert.equal(state.gesture?.releaseDecision, 'cancel');
    assert.equal(bookReducer(state, { type: 'TURN_PREPARED', token: stale }), state);
    state = complete(state, 'SETTLED');
    assert.equal(state.currentSpreadId, 'spread-1');
    assert.equal(state.destinationSpreadId, null);
    assert.equal(bookCanInteract(complete(state, 'SCENE_READY')), true);
  }
});

test('lost capture/cancel ignores another gesture and releases the correct owner once', () => {
  let state = dragMove(complete(dragStart(), 'TURN_PREPARED'), 0.6);
  assert.equal(bookReducer(state, { type: 'TURN_CANCEL', gestureId: 999 }), state);
  state = bookReducer(state, { type: 'TURN_CANCEL', gestureId: 7 });
  assert.equal(state.gesture?.pointerActive, false);
  const cancelled = state;
  assert.equal(bookReducer(state, { type: 'TURN_CANCEL', gestureId: 7 }), cancelled);
  state = complete(state, 'SETTLED');
  assert.equal(state.currentSpreadId, 'spread-1');
  assert.equal(state.gesture, null);
});

test('unprepared surfaces reject direct drag and invalid samples cannot poison progress', () => {
  const state = openBook();
  assert.equal(bookReducer(state, { type: 'TURN_DRAG_START', direction: 'next', gestureId: 7, pointerId: 13, corner: 'top', sample: sample(), surfacesReady: false }), state);
  const drag = dragStart(state);
  assert.equal(bookReducer(drag, { type: 'TURN_DRAG_MOVE', token: bookToken(drag), gestureId: 7, sample: sample(NaN), progress: 0.5, activated: true }), drag);
});

test('hide and fallback roll back pending movement and wait for the restored scene readiness barrier', () => {
  for (const event of [{ type: 'HIDE_DOCUMENT' }, { type: 'WEBGL_LOST' }, { type: 'USE_2D' }] as const) {
    let state = complete(dragMove(dragStart(), 0.5), 'TURN_PREPARED');
    const stale = bookToken(state);
    state = bookReducer(state, event);
    assert.equal(state.currentSpreadId, 'spread-1');
    assert.equal(state.destinationSpreadId, null);
    assert.equal(state.gesture, null);
    assert.equal(state.transportSessionId, null);
    assert.equal(bookReducer(state, { type: 'SETTLED', token: stale }), state);
    if (event.type === 'HIDE_DOCUMENT') {
      assert.equal(bookCanInteract(state), false);
      state = bookReducer(state, { type: 'SHOW_DOCUMENT' });
    } else {
      assert.equal(state.phase, 'fallback2D');
      assert.equal(state.mode, '2d');
    }
    assert.equal(state.scene, 'entering');
    assert.equal(bookCanInteract(state), false);
    assert.equal(bookReducer(state, { type: 'SCENE_READY', token: stale }), state);
    assert.equal(bookCanInteract(complete(state, 'SCENE_READY')), true);
  }
});

test('showing a previously playing book blocks input and old audio until its new scene is ready', () => {
  for (const options of [{}, { mode: '2d' as const }, { reducedMotion: true }]) {
    let state = complete(openBook(options), 'TRANSPORT_STARTING');
    const oldToken = bookToken(state);
    state = bookReducer(state, { type: 'TRANSPORT_PLAYING', token: oldToken, sessionId: 17 });
    state = bookReducer(state, { type: 'HIDE_DOCUMENT' });
    const recoveryToken = bookToken(state);
    assert.notDeepEqual(recoveryToken, oldToken);
    assert.equal(state.scene, 'entering');
    assert.equal(state.camera, 'suspended');
    assert.equal(state.transport, 'stopped');
    assert.equal(state.transportSessionId, null);
    assert.equal(bookReducer(state, { type: 'SCENE_READY', token: recoveryToken }), state);

    state = bookReducer(state, { type: 'SHOW_DOCUMENT' });
    assert.equal(state.phase, options.mode === '2d' ? 'fallback2D' : 'spreadIdle');
    assert.equal(state.camera, 'settled');
    assert.equal(state.currentSpreadId, 'spread-1');
    assert.equal(state.isOpen, true);
    assert.equal(state.scene, 'entering');
    assert.equal(bookCanInteract(state), false);
    assert.equal(complete(state, 'TRANSPORT_STARTING'), state);
    assert.equal(dragStart(state), state);
    assert.equal(bookReducer(state, { type: 'TRANSPORT_PLAYING', token: oldToken, sessionId: 18 }), state);
    assert.equal(bookReducer(state, { type: 'SCENE_READY', token: oldToken }), state);
    state = complete(state, 'SCENE_READY');
    assert.equal(bookCanInteract(state), true);
    assert.equal(state.scene, 'ready');
    assert.equal(state.transport, 'stopped');
    assert.equal(state.transportSessionId, null);
  }
});

test('re-hiding invalidates a pending recovery and only the latest scene-ready releases one valid navigation', () => {
  let state = finishTurn(bookReducer(openBook(), { type: 'NEXT' }));
  state = bookReducer(state, { type: 'PREV' });
  state = bookReducer(state, { type: 'NEXT' });
  assert.equal(state.pendingIntent, 'next');
  const oldTurnToken = bookToken(state);
  state = bookReducer(state, { type: 'HIDE_DOCUMENT' });
  assert.equal(state.pendingIntent, null);
  assert.equal(state.currentSpreadId, 'spread-2');
  state = bookReducer(state, { type: 'SHOW_DOCUMENT' });
  const firstRecoveryToken = bookToken(state);
  state = bookReducer(state, { type: 'PREV' });
  assert.equal(state.pendingIntent, 'prev');
  assert.equal(state.destinationSpreadId, null);
  assert.equal(bookReducer(state, { type: 'NEXT' }), state, 'invalid last-page intent does not erase the pending previous');
  assert.equal(bookReducer(state, { type: 'SCENE_READY', token: oldTurnToken }), state);

  state = bookReducer(state, { type: 'HIDE_DOCUMENT' });
  assert.equal(state.pendingIntent, null);
  state = bookReducer(state, { type: 'SHOW_DOCUMENT' });
  const latestToken = bookToken(state);
  assert.equal(bookReducer(state, { type: 'SCENE_READY', token: firstRecoveryToken }), state);
  state = bookReducer(state, { type: 'PREV' });
  assert.deepEqual(bookToken(state), latestToken, 'queueing does not invalidate the scene being prepared');
  assert.equal(state.scene, 'entering');
  assert.equal(state.phase, 'spreadIdle');
  state = complete(state, 'SCENE_READY');
  assert.equal(state.phase, 'preparingTurn');
  assert.equal(state.currentSpreadId, 'spread-2');
  assert.equal(state.destinationSpreadId, 'spread-1');
  assert.equal(state.pendingIntent, null);
  assert.equal(state.navigationToken, latestToken.navigationToken + 1);
  assert.equal(bookReducer(state, { type: 'SCENE_READY', token: latestToken }), state);
  assert.equal(finishTurn(state).currentSpreadId, 'spread-1');
});

test('hiding the intro returns to its endpoint without auto-open; closed context loss stays a closed fallback', () => {
  let state = complete(createBookState(), 'BOOT_READY');
  state = bookReducer(state, { type: 'START_INTRO' });
  state = bookReducer(state, { type: 'HIDE_DOCUMENT' });
  state = bookReducer(state, { type: 'SHOW_DOCUMENT' });
  assert.equal(state.phase, 'coverIdle');
  assert.equal(state.camera, 'settled');
  assert.equal(state.isOpen, false);
  state = bookReducer(state, { type: 'WEBGL_LOST' });
  assert.equal(state.isOpen, false);
  assert.equal(state.phase, 'fallback2D');
  assert.equal(bookCanInteract(state), false);
});

test('hide during bootstrap accepts only the restarted epoch and never strands first-spread readiness', () => {
  let state = createBookState();
  const stale = bookToken(state);
  state = bookReducer(state, { type: 'HIDE_DOCUMENT' });
  assert.equal(state.phase, 'bootLoading');
  state = bookReducer(state, { type: 'SHOW_DOCUMENT' });
  assert.equal(state.camera, 'loading');
  assert.equal(bookReducer(state, { type: 'BOOT_READY', token: stale }), state);
  state = complete(state, 'BOOT_READY');
  state = complete(state, 'INTRO_SETTLED');
  assert.equal(state.firstSpreadReady, true);
  state = bookReducer(state, { type: 'OPEN_BOOK', inputId: 9 });
  assert.equal(state.phase, 'opening');
});

test('reduced-motion change during turn or reverse settling preserves owners until the same completion path cleans up', () => {
  for (const cancel of [false, true]) {
    let state = complete(dragMove(dragStart(), 0.4), 'TURN_PREPARED');
    state = release(state, cancel ? 'cancel' : 'commit');
    const token = bookToken(state);
    const phase = state.phase;
    state = bookReducer(state, { type: 'SET_REDUCED_MOTION', value: true });
    assert.deepEqual(bookToken(state), token);
    assert.equal(state.phase, phase);
    assert.equal(state.gesture?.pointerActive, false);
    state = complete(state, 'SETTLED');
    state = complete(state, 'SCENE_READY');
    assert.equal(state.currentSpreadId, cancel ? 'spread-1' : 'spread-2');
    assert.equal(state.gesture, null);
    assert.equal(state.destinationSpreadId, null);
    assert.equal(bookCanInteract(state), true);
  }
});

test('close takes priority over queued navigation, waits for scene exit and both cover/camera completions', () => {
  let state = bookReducer(openBook(), { type: 'NEXT' });
  state = bookReducer(state, { type: 'PREV' });
  const stale = bookToken(state);
  state = bookReducer(state, { type: 'CLOSE_BOOK' });
  assert.equal(state.phase, 'closing');
  assert.equal(state.pendingIntent, null);
  assert.equal(state.currentSpreadId, 'spread-1');
  assert.equal(bookReducer(state, { type: 'TURN_PREPARED', token: stale }), state);
  state = complete(complete(state, 'COVER_COMPLETE'), 'CAMERA_COMPLETE');
  assert.equal(state.phase, 'closing');
  state = complete(state, 'SCENE_EXITED');
  assert.equal(state.phase, 'coverIdle');
  assert.equal(state.isOpen, false);
  assert.equal(state.scene, 'unmounted');
  assert.equal(bookReducer(state, { type: 'NEXT' }), state);
});

test('first previous closes; entering next queues at most one intent until scene ready', () => {
  assert.equal(bookReducer(openBook(), { type: 'PREV' }).phase, 'closing');
  let state = bookReducer(idleCover(), { type: 'OPEN_BOOK', inputId: 1 });
  state = complete(complete(state, 'COVER_COMPLETE'), 'CAMERA_COMPLETE');
  state = bookReducer(state, { type: 'NEXT' });
  assert.equal(state.scene, 'entering');
  assert.equal(state.pendingIntent, 'next');
  state = complete(state, 'SCENE_READY');
  assert.equal(state.phase, 'preparingTurn');
  assert.equal(state.pendingIntent, null);
});

test('late resume and old scene ready cannot restore a prior audio/scene owner', () => {
  let state = complete(openBook(), 'TRANSPORT_STARTING');
  const stale = bookToken(state);
  state = bookReducer(state, { type: 'TRANSPORT_PLAYING', token: stale, sessionId: 1 });
  assert.equal(state.transportSessionId, 1);
  assert.equal(state.scene, 'playing');
  state = bookReducer(state, { type: 'NEXT' });
  assert.equal(state.transport, 'stopped');
  assert.equal(state.transportSessionId, null);
  assert.equal(bookReducer(state, { type: 'TRANSPORT_PLAYING', token: stale, sessionId: 2 }), state);
  state = finishTurn(state);
  assert.equal(bookReducer(state, { type: 'SCENE_READY', token: stale }), state);
  assert.equal(state.scene, 'ready');
  assert.equal(state.transportSessionId, null);
});

test('pause/resume retains the logical audio session and does not rerun scene entry', () => {
  let state = complete(openBook(), 'TRANSPORT_STARTING');
  const token = bookToken(state);
  state = bookReducer(state, { type: 'TRANSPORT_PLAYING', token, sessionId: 17 });
  state = complete(state, 'TRANSPORT_PAUSED');
  assert.equal(state.transport, 'paused');
  assert.equal(state.scene, 'paused');
  assert.equal(state.transportSessionId, 17);
  assert.equal(bookCanInteract(state), true, 'page navigation remains available while paused');
  assert.deepEqual(bookToken(state), token);
  state = complete(state, 'TRANSPORT_STARTING');
  assert.equal(state.transportSessionId, 17);
  assert.equal(bookReducer(state, { type: 'TRANSPORT_PLAYING', token, sessionId: 18 }), state,
    'resume cannot substitute a different logical session');
  state = bookReducer(state, { type: 'TRANSPORT_PLAYING', token, sessionId: 17 });
  assert.equal(state.scene, 'playing');
  assert.deepEqual(bookToken(state), token, 'musical resume is independent of the entry animation');
  state = complete(state, 'TRANSPORT_STOPPED');
  assert.equal(state.scene, 'ready');
  assert.equal(state.transportSessionId, null);
  state = complete(state, 'TRANSPORT_STARTING');
  state = bookReducer(state, { type: 'TRANSPORT_PLAYING', token, sessionId: 18 });
  assert.equal(state.transportSessionId, 18, 'explicit play after stop creates a new logical session');
});

test('interruption or failed resume releases a paused session before a new explicit play', () => {
  for (const unavailable of [false, true]) {
    let state = complete(openBook(), 'TRANSPORT_STARTING');
    const token = bookToken(state);
    state = bookReducer(state, { type: 'TRANSPORT_PLAYING', token, sessionId: 31 });
    state = complete(state, 'TRANSPORT_PAUSED');
    if (unavailable) state = bookReducer(state, { type: 'TRANSPORT_UNAVAILABLE', token });
    // A locked engine snapshot with a stop reason maps to STOPPED, unlike its
    // untouched initial lock. This removes the old paused session identity.
    state = complete(state, 'TRANSPORT_STOPPED');
    assert.equal(state.scene, 'ready');
    assert.equal(state.transportSessionId, null);
    state = complete(state, 'TRANSPORT_STARTING');
    state = bookReducer(state, { type: 'TRANSPORT_PLAYING', token, sessionId: 32 });
    assert.equal(state.transport, 'playing');
    assert.equal(state.transportSessionId, 32);
  }
});

test('paused session is revoked by next, close, hide and reading-mode recovery', () => {
  let paused = complete(openBook(), 'TRANSPORT_STARTING');
  paused = bookReducer(paused, { type: 'TRANSPORT_PLAYING', token: bookToken(paused), sessionId: 23 });
  paused = complete(paused, 'TRANSPORT_PAUSED');
  const token = bookToken(paused);
  for (const event of [{ type: 'NEXT' }, { type: 'CLOSE_BOOK' }, { type: 'HIDE_DOCUMENT' }, { type: 'USE_2D' }] as const) {
    const state = bookReducer(paused, event);
    assert.equal(state.transport, 'stopped', event.type);
    assert.equal(state.transportSessionId, null, event.type);
    assert.equal(bookReducer(state, { type: 'TRANSPORT_PLAYING', token, sessionId: 23 }), state);
    assert.equal(bookReducer(state, { type: 'TRANSPORT_PAUSED', token }), state);
  }
});

test('error/retry invalidates old boot callbacks while preserving the committed open spread', () => {
  let state = finishTurn(bookReducer(openBook(), { type: 'NEXT' }));
  state = bookReducer(state, { type: 'LOAD_FAIL', token: bookToken(state), reason: 'texture unavailable' });
  assert.equal(state.phase, 'recoverableError');
  assert.equal(state.currentSpreadId, 'spread-2');
  state = bookReducer(state, { type: 'RETRY_3D' });
  const stale = bookToken(state);
  state = bookReducer(state, { type: 'RETRY_3D' });
  assert.equal(bookReducer(state, { type: 'BOOT_READY', token: stale }), state);
  state = complete(state, 'BOOT_READY');
  state = complete(state, 'SCENE_READY');
  assert.equal(state.currentSpreadId, 'spread-2');
  assert.equal(bookCanInteract(state), true);
  assert.equal(state.transportSessionId, null);
});

test('2D and reduced motion use the same explicit commit events without automatic navigation or sound', () => {
  for (const options of [{ mode: '2d' as const }, { reducedMotion: true }]) {
    let state = openBook(options);
    assert.equal(state.currentSpreadId, 'spread-1');
    assert.equal(state.transport, 'locked');
    state = bookReducer(state, { type: 'NEXT' });
    const before = state.currentSpreadId;
    state = complete(state, 'TURN_PREPARED');
    assert.equal(state.currentSpreadId, before);
    state = complete(state, 'TURN_COMPLETE');
    assert.equal(state.currentSpreadId, before);
    state = complete(state, 'SETTLED');
    state = complete(state, 'SCENE_READY');
    assert.equal(state.currentSpreadId, 'spread-2');
    assert.equal(state.phase, options.mode === '2d' ? 'fallback2D' : 'spreadIdle');
    assert.equal(state.transportSessionId, null);
  }
});

test('reducer does not mutate a retained lesson-independent input snapshot', () => {
  const state = openBook();
  const serialized = JSON.stringify(state);
  const actions: BookEvent[] = [{ type: 'NEXT' }, { type: 'CLOSE_BOOK' }, { type: 'WEBGL_LOST' }, { type: 'HIDE_DOCUMENT' }];
  for (const action of actions) bookReducer(state, action);
  assert.equal(JSON.stringify(state), serialized);
  assert.equal(Object.hasOwn(state, 'lesson'), false);
  assert.equal(Object.hasOwn(state, 'audioContext'), false);
});
