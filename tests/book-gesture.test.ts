import test from 'node:test';
import assert from 'node:assert/strict';
import { arrowNavigationDirection, createTurnDrag, turnReleaseDecision, updateTurnDrag } from '../src/book/gesture.ts';
import type { ArrowKeyInput, TurnDragSample } from '../src/book/gesture.ts';

const point = (clientX: number, time: number, clientY = 0): TurnDragSample => ({ clientX, clientY, time });
const start = () => createTurnDrag(point(400, 0), 'next', 200);

test('drag uses the projected full book width, holds its pose, reverses continuously, and clamps both ends', () => {
  const initial = start();
  const halfway = updateTurnDrag(initial, point(200, 100));
  assert.equal(halfway.progress, 0.5);
  const held = updateTurnDrag(halfway, point(200, 2000));
  assert.equal(held.progress, 0.5);
  assert.equal(held.directionalVelocity, 0);
  assert.equal(updateTurnDrag(held, point(300, 2100)).progress, 0.25);
  assert.equal(updateTurnDrag(held, point(600, 2100)).progress, 0);
  assert.equal(updateTurnDrag(held, point(-200, 2100)).progress, 1);
  assert.equal(initial.progress, 0);
  const backward = updateTurnDrag(createTurnDrag(point(0, 0), 'prev', 200), point(300, 100));
  assert.equal(backward.progress, 0.75);
  assert.equal(backward.directionalVelocity, 3);
});

test('activation has an eight CSS pixel boundary and gives vertical movement priority until horizontal dominance', () => {
  assert.equal(updateTurnDrag(start(), point(392.01, 10)).activated, false);
  assert.equal(updateTurnDrag(start(), point(392, 10)).activated, true);
  assert.equal(updateTurnDrag(start(), point(380, 10, 30)).activated, false);
  const active = updateTurnDrag(start(), point(380, 10));
  assert.equal(updateTurnDrag(active, point(400, 20, 60)).activated, true);
  assert.equal(turnReleaseDecision(updateTurnDrag(active, point(400, 20, 60))), 'cancel');
});

test('slow release commits exactly at half the book width and cancels below it', () => {
  assert.equal(turnReleaseDecision(updateTurnDrag(start(), point(200.1, 1000))), 'cancel');
  assert.equal(turnReleaseDecision(updateTurnDrag(start(), point(200, 1000))), 'commit');
});

test('flick requires both minimum travel and the directional speed threshold', () => {
  const early = updateTurnDrag(start(), point(352, 48));
  assert.equal(early.progress, 0.12);
  assert.equal(turnReleaseDecision(early), 'cancel');
  const boundary = updateTurnDrag(start(), point(350, 100));
  assert.equal(boundary.directionalVelocity, 0.5);
  assert.equal(turnReleaseDecision(boundary), 'commit');
  const slower = updateTurnDrag(updateTurnDrag(start(), point(375, 50)), point(350.1, 100));
  assert.equal(turnReleaseDecision(slower), 'cancel');
  assert.equal(turnReleaseDecision(updateTurnDrag(boundary, point(350, 110))), 'commit');
  assert.equal(turnReleaseDecision(boundary, 201), 'cancel');
  assert.equal(turnReleaseDecision(updateTurnDrag(boundary, point(350, 201))), 'cancel');
});

test('the most recent reversal replaces earlier forward speed; same-time and stale samples cannot invent momentum', () => {
  const forward = updateTurnDrag(start(), point(250, 50));
  const reverse = updateTurnDrag(forward, point(270, 60));
  assert.equal(reverse.directionalVelocity, -2);
  assert.equal(turnReleaseDecision(reverse), 'cancel');
  assert.equal(turnReleaseDecision(updateTurnDrag(reverse, point(270, 70))), 'cancel');
  assert.equal(updateTurnDrag(forward, point(300, 49)), forward);
  const sameTime = updateTurnDrag(forward, point(230, 50));
  assert.equal(sameTime.directionalVelocity, 0);
  assert.equal(turnReleaseDecision(sameTime), 'cancel');
  assert.equal(turnReleaseDecision(forward, 49), 'cancel');
});

test('sample snapshots do not alias caller objects and invalid geometry or samples cannot corrupt progress', () => {
  const source = { clientX: 400, clientY: 0, time: 0 };
  const initial = createTurnDrag(source, 'next', 200);
  source.clientX = 0;
  assert.equal(initial.initial.clientX, 400);
  const sample = { clientX: 200, clientY: 0, time: 100 };
  const moved = updateTurnDrag(initial, sample);
  sample.clientX = 0;
  assert.equal(moved.sample.clientX, 200);
  assert.equal(updateTurnDrag(moved, point(NaN, 200)), moved);
  assert.equal(updateTurnDrag(moved, point(0, Infinity)), moved);
  for (const width of [0, -1, NaN, Infinity]) assert.throws(() => createTurnDrag(point(0, 0), 'next', width), RangeError);
});

const element = (tagName = 'DIV', attributes: Record<string, string | undefined> = {}, parentElement?: unknown) => ({
  tagName, parentElement, getAttribute: (name: string) => attributes[name] ?? null,
});
const key = (overrides: Partial<ArrowKeyInput> = {}): ArrowKeyInput => ({ key: 'ArrowRight', target: element(), ...overrides });

test('only an unhandled, nonrepeating, unmodified arrow can navigate', () => {
  assert.equal(arrowNavigationDirection(key()), 'next');
  assert.equal(arrowNavigationDirection(key({ key: 'ArrowLeft' })), 'prev');
  assert.equal(arrowNavigationDirection(key({ key: 'ArrowDown' })), null);
  for (const flag of ['defaultPrevented', 'repeat', 'isComposing', 'altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    assert.equal(arrowNavigationDirection(key({ [flag]: true })), null, flag);
  }
});

test('editable controls and arrow-owning widgets retain arrows even when a descendant is the event target', () => {
  for (const tag of ['input', 'textarea', 'select', 'dialog']) {
    assert.equal(arrowNavigationDirection(key({ target: element('SPAN', {}, element(tag)) })), null, tag);
  }
  for (const attributes of [{ contenteditable: '' }, { contenteditable: 'plaintext-only' },
    { role: 'slider' }, { role: 'dialog' }, { role: 'radiogroup' },
    { 'data-book-instrument': '' }, { 'data-instrument': 'piano' }]) {
    assert.equal(arrowNavigationDirection(key({ target: element('SPAN', {}, element('DIV', attributes)) })), null);
  }
  assert.equal(arrowNavigationDirection(key({ target: element('DIV', { contenteditable: 'false' }) })), 'next');
  assert.equal(arrowNavigationDirection(key({ target: { ...element(), isContentEditable: true } })), null);
});

test('composed paths preserve a shadow-root instrument owner and non-element targets remain safe', () => {
  const instrument = element('DIV', { 'data-book-instrument': '' });
  assert.equal(arrowNavigationDirection(key({ composedPath: () => [element('SPAN'), instrument] })), null);
  assert.equal(arrowNavigationDirection(key({ target: { parentElement: element('INPUT') } })), null);
  assert.equal(arrowNavigationDirection(key({ target: null })), 'next');
});
