import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonState, reduceLesson } from '../src/lesson/controller.ts';
import { pageSpecFor } from '../src/content/pages/index.ts';
import { layoutPage } from '../src/book/print/pageLayout.ts';
import type { PageLayout } from '../src/book/print/pageLayout.ts';
import {
  compositorPolicy, createPageCompositor, pageCanvasHeight, PRINT_BUDGET_BYTES, printKey, textureBytes, windowBytes,
} from '../src/book/print/pageCompositor.ts';
import type { CanvasLike, CompositorDeps } from '../src/book/print/pageCompositor.ts';
import { NO_INTERACTION } from '../src/book/print/hotspots.ts';
import type { PageInteraction } from '../src/book/print/hotspots.ts';
import { contextFor, stubServices } from './support/print.ts';

function harness() {
  const paints: { width: number; layout: PageLayout }[] = [];
  const states: { width: number; interaction: PageInteraction }[] = [];
  let clock = 0;
  const deps: CompositorDeps = {
    layout: (spec, context) => layoutPage(spec, context, stubServices),
    createCanvas: (width, height): CanvasLike => ({ width, height }),
    paintPrint: (canvas, layout) => { paints.push({ width: canvas.width, layout }); },
    paintState: (canvas, _layout, interaction) => { states.push({ width: canvas.width, interaction }); },
    now: () => (clock += 5),
  };
  return { compositor: createPageCompositor(deps, compositorPolicy('high')), paints, states };
}

test('print keys follow only the page’s own inputs, never its resolution', () => {
  const lesson = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-2' });
  const spec = pageSpecFor('page-3');
  const base = printKey(spec, contextFor('page-3', lesson));
  assert.equal(printKey(spec, contextFor('page-3', lesson)), base);
  // An edit in this scene replaces its scene state object.
  const split = reduceLesson(lesson, { type: 'split' });
  assert.notEqual(printKey(spec, contextFor('page-3', split)), base);
  // Another scene's flap or answer does not touch this page.
  assert.equal(printKey(spec, contextFor('page-3', lesson, { hints: { 'scene-1/questions': 1 } })), base);
  assert.notEqual(printKey(spec, contextFor('page-3', lesson, { hints: { 'scene-2/questions': 1 } })), base);
  // Transport state is printed (button enablement); the moving note is not (state layer).
  assert.notEqual(printKey(spec, contextFor('page-3', lesson, { playback: { state: 'playing', laneId: 'main', activeEventId: null, error: null } })), base);
  assert.equal(printKey(spec, contextFor('page-3', lesson, { playback: { state: 'ready', laneId: null, activeEventId: 'x', error: null } })), base);
});

test('a page prints once per input change; repeated requests are cache hits', () => {
  const { compositor, paints } = harness();
  const spec = pageSpecFor('page-1');
  // Lesson states are immutable: the same object means the same print.
  const lesson = createLessonState();
  const first = compositor.request(spec, contextFor('page-1', lesson), 'draft', null);
  assert.equal(paints.length, 1);
  const again = compositor.request(spec, contextFor('page-1', lesson), 'draft', null);
  assert.equal(paints.length, 1);
  assert.equal(again.print, first.print);
  assert.equal(again.printVersion, first.printVersion);
  const answered = reduceLesson(lesson, { type: 'answer', questionId: getFirstQuestion(), value: 'same' });
  assert.equal(answered.scenes['scene-1'].answers[getFirstQuestion()], 'same');
  const changed = compositor.request(spec, contextFor('page-1', answered), 'draft', null);
  assert.equal(paints.length, 2);
  assert.equal(changed.print, first.print, 'the texture object never changes for a page');
  assert.ok(changed.printVersion > first.printVersion);
});

function getFirstQuestion(): string {
  // v3 R5: questions are printed on the page (no longer inside a flap).
  const question = pageSpecFor('page-1').blocks.flatMap(block => block.kind === 'flap' ? block.blocks : [block]).find(block => block.kind === 'question');
  assert.ok(question && question.kind === 'question');
  return question.questionId;
}

test('settled pages print a draft synchronously, then upgrade in place with the same layout', () => {
  const { compositor, paints } = harness();
  const spec = pageSpecFor('page-2');
  const lesson = createLessonState();
  const draft = compositor.request(spec, contextFor('page-2', lesson), 'settled', NO_INTERACTION);
  assert.equal(draft.resolution, 'draft');
  assert.equal(draft.upgrading, true);
  assert.deepEqual(compositor.pending(), ['page-2']);
  assert.equal(paints.at(-1)!.width, 768);
  const texture = draft.print;
  const image = texture.image as CanvasLike;
  assert.equal(image.height, pageCanvasHeight(768));
  let disposed = 0;
  texture.addEventListener('dispose', () => { disposed += 1; });
  assert.equal(compositor.upgrade('page-2'), true);
  const settled = compositor.surface('page-2')!;
  assert.equal(settled.resolution, 'settled');
  assert.equal(settled.upgrading, false);
  assert.equal(settled.print, texture, 'draft → settled keeps the texture identity (no swap jump)');
  assert.equal((texture.image as CanvasLike).width, 1280);
  assert.equal(disposed, 1, 'a size change frees immutable GPU storage before re-upload');
  // Both resolutions painted the very same layout object: identical coordinates.
  assert.equal(paints.at(-1)!.layout, paints.at(-2)!.layout);
  assert.equal(paints.at(-1)!.width, 1280);
  assert.deepEqual(compositor.pending(), []);
  assert.equal(compositor.upgrade('page-2'), false);
  // An unchanged settled request is a cache hit.
  const count = paints.length;
  compositor.request(spec, contextFor('page-2', lesson), 'settled', NO_INTERACTION);
  assert.equal(paints.length, count);
});

test('neighbours keep only a draft and no state layer; pruning releases pages', () => {
  const { compositor } = harness();
  const lesson = createLessonState();
  compositor.request(pageSpecFor('page-2'), contextFor('page-2', lesson), 'settled', NO_INTERACTION);
  compositor.upgrade('page-2');
  const before = compositor.stats();
  assert.equal(before.settled, 1);
  assert.equal(before.states, 1);
  const neighbour = compositor.request(pageSpecFor('page-2'), contextFor('page-2', lesson), 'draft', null);
  assert.equal(neighbour.resolution, 'draft');
  assert.equal(neighbour.state, null);
  const after = compositor.stats();
  assert.equal(after.settled, 0);
  assert.equal(after.states, 0);
  assert.ok(after.bytes < before.bytes);
  compositor.prune(new Set());
  assert.equal(compositor.stats().pages, 0);
  assert.equal(compositor.surface('page-2'), null);
});

test('the state layer repaints for interaction changes without reprinting', () => {
  const { compositor, paints, states } = harness();
  const lesson = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-2' });
  const spec = pageSpecFor('page-4');
  const first = compositor.request(spec, contextFor('page-4', lesson), 'settled', NO_INTERACTION);
  const printed = paints.length;
  const split = first.layout.hotspots.find(hotspot => hotspot.testId === 'split-note')!;
  const pressed = compositor.request(spec, contextFor('page-4', lesson), 'settled', { ...NO_INTERACTION, pressedId: split.id });
  assert.equal(paints.length, printed, 'pressing does not reprint');
  assert.equal(states.length, 2);
  assert.ok(pressed.stateVersion > first.stateVersion);
  assert.equal(pressed.state, first.state);
  // A hotspot id on another page is invisible to this page's state layer.
  compositor.request(spec, contextFor('page-4', lesson), 'settled', { ...NO_INTERACTION, pressedId: 'page-3:note:main:x' });
  assert.equal(states.length, 3, 'clearing the press repaints once');
  compositor.request(spec, contextFor('page-4', lesson), 'settled', { ...NO_INTERACTION, focusId: 'page-3:note:main:x' });
  assert.equal(states.length, 3, 'foreign focus ids do not repaint');
});

test('the six-page print window fits the 48 MiB texture budget on every tier', () => {
  for (const tier of ['high', 'medium', 'low'] as const) {
    const policy = compositorPolicy(tier);
    assert.ok(windowBytes(policy) <= PRINT_BUDGET_BYTES, `${tier}: ${windowBytes(policy)} bytes`);
  }
  assert.equal(textureBytes(1280), 1280 * pageCanvasHeight(1280) * 4 * 4 / 3);
  const { compositor } = harness();
  const lesson = createLessonState();
  const ids = ['page-1', 'page-2', 'page-3', 'page-4', 'page-5', 'page-6'] as const;
  for (const pageId of ids) {
    const current = pageId === 'page-3' || pageId === 'page-4';
    compositor.request(pageSpecFor(pageId), contextFor(pageId, lesson), current ? 'settled' : 'draft', current ? NO_INTERACTION : null);
  }
  compositor.upgrade('page-3');
  compositor.upgrade('page-4');
  const stats = compositor.stats();
  assert.equal(stats.pages, 6);
  assert.equal(stats.settled, 2);
  assert.equal(stats.states, 2);
  assert.ok(stats.bytes <= stats.budgetBytes, `${stats.bytes} > ${stats.budgetBytes}`);
  // Twenty round trips between two spreads do not grow memory.
  for (let trip = 0; trip < 20; trip += 1) {
    const forward = trip % 2 === 0;
    const window = forward ? ['page-3', 'page-4', 'page-5', 'page-6', 'page-7', 'page-8'] as const : ids;
    const currentIds = forward ? ['page-5', 'page-6'] : ['page-3', 'page-4'];
    for (const pageId of window) {
      const current = currentIds.includes(pageId);
      compositor.request(pageSpecFor(pageId), contextFor(pageId, lesson), current ? 'settled' : 'draft', current ? NO_INTERACTION : null);
    }
    compositor.prune(new Set(window));
    for (const pageId of compositor.pending()) compositor.upgrade(pageId);
    assert.ok(compositor.stats().bytes <= stats.budgetBytes);
  }
  assert.equal(compositor.stats().bytes, stats.bytes);
  compositor.dispose();
  assert.throws(() => compositor.request(pageSpecFor('page-1'), contextFor('page-1'), 'draft', null));
});
