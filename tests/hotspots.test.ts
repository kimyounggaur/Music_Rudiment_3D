import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonState, reduceLesson, sceneEvents } from '../src/lesson/controller.ts';
import { BOOK_MANIFEST } from '../src/book/manifest.ts';
import { getScene } from '../src/content/lesson.ts';
import { pageSpecFor } from '../src/content/pages/index.ts';
import { layoutPage } from '../src/book/print/pageLayout.ts';
import type { MirrorNode, PageLayout } from '../src/book/print/pageLayout.ts';
import { interactionKey, mirrorControls, NO_INTERACTION, paintState } from '../src/book/print/hotspots.ts';
import { contextFor, recordingContext, stubServices } from './support/print.ts';

const scene2 = () => reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-2' });

test('state keys ignore interaction that belongs to another page', () => {
  const lesson = scene2();
  const left = layoutPage(pageSpecFor('page-3'), contextFor('page-3', lesson), stubServices);
  const right = layoutPage(pageSpecFor('page-4'), contextFor('page-4', lesson), stubServices);
  const split = right.hotspots.find(hotspot => hotspot.testId === 'split-note')!;
  const focus = { ...NO_INTERACTION, focusId: split.id };
  assert.notEqual(interactionKey(right, focus), interactionKey(right, NO_INTERACTION));
  assert.equal(interactionKey(left, focus), interactionKey(left, NO_INTERACTION), 'two pages keep independent state');
  // The selected note highlights only on a page that prints that lane.
  const selected = { ...NO_INTERACTION, selected: { laneId: 'main', eventId: sceneEvents(lesson, 'scene-2')[0]!.id } };
  assert.notEqual(interactionKey(left, selected), interactionKey(left, NO_INTERACTION));
  assert.equal(interactionKey(right, selected), interactionKey(right, NO_INTERACTION));
});

test('the state layer clears, then draws pressed, selection, playback and focus marks', () => {
  const lesson = scene2();
  const left = layoutPage(pageSpecFor('page-3'), contextFor('page-3', lesson), stubServices);
  const right = layoutPage(pageSpecFor('page-4'), contextFor('page-4', lesson), stubServices);
  const split = right.hotspots.find(hotspot => hotspot.testId === 'split-note')!;
  const pressed = recordingContext(512, 753);
  paintState(pressed.context, right, { ...NO_INTERACTION, pressedId: split.id });
  assert.equal(pressed.calls[0]?.name === 'save' ? pressed.calls.find(call => call.name === 'clearRect')?.name : '', 'clearRect');
  assert.ok(pressed.calls.some(call => call.name === 'fill' && call.fillStyle === 'rgba(37,39,33,0.14)'), 'pressed ink at 0.14 alpha');
  const empty = recordingContext(512, 753);
  paintState(empty.context, right, NO_INTERACTION);
  assert.deepEqual(empty.calls.map(call => call.name).filter(name => name !== 'save' && name !== 'restore' && name !== 'setTransform'), ['clearRect']);
  const event = sceneEvents(lesson, 'scene-2')[0]!;
  const marks = recordingContext(512, 753);
  paintState(marks.context, left, { ...NO_INTERACTION, selected: { laneId: 'main', eventId: event.id }, activeEventId: event.id, activeLaneId: 'main' });
  // Notation box + event-list cell, each selected (fill + stroke) and active (dashed stroke).
  assert.equal(marks.calls.filter(call => call.name === 'fill').length, 2);
  assert.equal(marks.calls.filter(call => call.name === 'setLineDash' && (call.args[0] as number[]).length).length, 2);
  // A disabled hotspot shows no press feedback.
  const disabled = right.hotspots.find(hotspot => !hotspot.enabled)!;
  const none = recordingContext(512, 753);
  paintState(none.context, right, { ...NO_INTERACTION, pressedId: disabled.id });
  assert.equal(none.calls.filter(call => call.name === 'fill').length, 0);
});

test('the accessible mirror lists every printed control once, with the 2D test ids', () => {
  for (const spread of BOOK_MANIFEST) {
    const lesson = reduceLesson(createLessonState(), { type: 'navigate', sceneId: spread.sceneId });
    for (const pageId of [spread.leftPageId, spread.rightPageId]) {
      const hints = { [`${spread.sceneId}/questions`]: 1, [`${spread.sceneId}/alternative`]: 1 };
      const layout = layoutPage(pageSpecFor(pageId), contextFor(pageId, lesson, { hints }), stubServices);
      const listed = mirrorControls(layout);
      assert.equal(new Set(listed.map(hotspot => hotspot.id)).size, listed.length, `${pageId}: duplicate mirror control`);
      const expected = layout.hotspots.filter(hotspot => hotspot.mirror !== false).map(hotspot => hotspot.id).sort();
      assert.deepEqual(listed.map(hotspot => hotspot.id).sort(), expected, `${pageId}: printed control missing from the mirror`);
    }
    const right = layoutPage(pageSpecFor(spread.rightPageId), contextFor(spread.rightPageId, lesson), stubServices);
    const ids = new Set(mirrorControls(right).map(hotspot => hotspot.testId).filter(Boolean));
    for (const lane of getScene(spread.sceneId).lanes) assert.ok(ids.has(`play-${lane.laneId}`), `${spread.rightPageId}: play-${lane.laneId}`);
    assert.ok(ids.has('pause-resume-audio') && ids.has('stop-audio'));
  }
  const split = mirrorControls(layoutPage(pageSpecFor('page-4'), contextFor('page-4', scene2()), stubServices));
  assert.ok(split.some(hotspot => hotspot.testId === 'split-note' && hotspot.enabled));
});

test('mirror headings, live text and instrument groups follow the 2D page structure', () => {
  const layout: PageLayout = layoutPage(pageSpecFor('page-3'), contextFor('page-3', scene2()), stubServices);
  const flat: MirrorNode[] = [];
  const visit = (nodes: readonly MirrorNode[]) => nodes.forEach(node => { flat.push(node); if (node.kind === 'group') visit(node.children); });
  visit(layout.mirror);
  const first = flat[0];
  assert.ok(first && first.kind === 'heading' && first.level === 1 && first.focusTarget, 'the page opens on its focusable h1');
  const list = flat.find(node => node.kind === 'group' && node.role === 'list');
  assert.ok(list && list.kind === 'group' && list.instrument, 'the note list owns arrow keys (data-book-instrument)');
  const right = layoutPage(pageSpecFor('page-10'), contextFor('page-10', reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-5' })), stubServices);
  const texts: MirrorNode[] = [];
  const collect = (nodes: readonly MirrorNode[]) => nodes.forEach(node => { if (node.kind === 'text') texts.push(node); if (node.kind === 'group') collect(node.children); });
  collect(right.mirror);
  assert.ok(texts.some(node => node.kind === 'text' && node.id === 'tempo-timing' && node.text.includes('템포 60')), 'tempo timing keeps its test id');
  const listen = right.mirror.find(node => node.kind === 'group' && node.label === '듣기');
  assert.ok(listen && listen.kind === 'group' && !listen.instrument, 'listening buttons keep arrow-key page navigation, as in 2D');
});
