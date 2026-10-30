import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { add, frac } from '../src/domain/index.ts';
import type { DurationEvent } from '../src/scenes/DurationScene2D.tsx';
import { BAR_WIDTH, BLOCK_DEPTH, BLOCK_HEIGHT, clampedPosition, durationBounds, frameDurationCamera } from '../src/scenes/durationWorld.ts';
import { createDurationFigure, DURATION_FIGURE, durationBoundaries, durationFrontZ } from '../src/book/figures/music/durationFigure.ts';
import { createSpreadDecor, DECOR_BUDGET, DECOR_KIND, decorExtent, fractionSummary } from '../src/book/figures/music/decor.ts';
import { BOOK_MOTION } from '../src/book/motion.ts';
import { LESSON_FIGURE_LAYOUT, LESSON_FIGURE_RAISE_PER_HEIGHT } from '../src/book/lessonPresentation.ts';

/** v3 R4: the six durationWorld meaning cases, moved to the ink figure API (tests/duration-world.test.ts keeps the legacy world). */
function pattern(denominators: readonly number[], restIndices: readonly number[] = []): DurationEvent[] {
  let onset = frac(0);
  const names: Record<number, string> = { 1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth', 16: 'sixteenth' };
  return denominators.map((denominator, index) => {
    const duration = frac(1, denominator);
    const common = { id: `geometry-${index}`, onset, duration, notation: { type: names[denominator], dots: 0 } };
    onset = add(onset, duration);
    return restIndices.includes(index) ? { ...common, kind: 'rest' } : { ...common, kind: 'note', pitch: { step: 'C', alter: 0, octave: 4 } };
  });
}
function near(actual: number, expected: number, message: string, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, got ${actual}`);
}
const boxOf = (mesh: THREE.Object3D) => new THREE.Box3().setFromObject(mesh, true);
/** Collect a figure's geometry/material resources (lines are meshes too). */
function resources(group: THREE.Object3D) {
  const set = new Set<THREE.BufferGeometry | THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    set.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) set.add(material);
  });
  return set;
}

test('ink blocks keep total time, every boundary, and constant height/depth through a sixteen-way split', () => {
  for (const count of [1, 2, 4, 8, 16]) {
    const events = pattern(Array.from({ length: count }, () => count), count > 1 ? [1] : []);
    const before = structuredClone(events);
    const figure = createDurationFigure(events);
    try {
      assert.equal(figure.views.size, count);
      assert.equal(new Set([...figure.views.values()].map(view => view.hit.geometry)).size, 1, 'all pick boxes share one unit geometry');
      let previousEnd = 0;
      for (const event of events) {
        const box = boxOf(figure.views.get(event.id)!.hit);
        const size = box.getSize(new THREE.Vector3());
        near(box.min.x, previousEnd, `${count}-way split must have neither gap nor overlap`);
        near(size.x, BAR_WIDTH / count, `${event.id} width`);
        near(size.y, BLOCK_HEIGHT, `${event.id} height`);
        near(size.z, BLOCK_DEPTH, `${event.id} depth`);
        near(box.min.y, 0, `${event.id} baseline`);
        near(box.min.z, -BLOCK_DEPTH / 2, `${event.id} depth origin`);
        previousEnd = box.max.x;
      }
      near(previousEnd, BAR_WIDTH, 'last block ends at one whole note');
      // The drawn solids match the meaning: fill spans the bar at constant height.
      const fill = new THREE.Box3().setFromBufferAttribute(figure.figure.fill.geometry.getAttribute('position') as THREE.BufferAttribute);
      near(fill.max.y, BLOCK_HEIGHT, 'fill height');
      assert.deepEqual(events, before, 'drawing must not mutate music meaning');
    } finally { figure.dispose(); }
  }
});

test('rests stay dashed outlines with no paper face and a transparent pick box, in every selection state', () => {
  const events = pattern([2, 4, 8, 8], [1]);
  const figure = createDurationFigure(events);
  try {
    const rest = figure.views.get(events[1]!.id)!;
    const material = rest.hit.material as THREE.MeshBasicMaterial;
    assert.equal(material.opacity, 0);
    assert.equal(material.colorWrite, false);
    assert.equal(material.depthWrite, false);
    const fills = figure.figure.stats().fills;
    assert.equal(fills, 3, 'only the three notes have paper faces');
    assert.equal(figure.figure.lines.dashed.count, 12, 'the rest is twelve dashed edges');
    for (const [selected, active] of [[null, null], [events[1]!.id, null], [null, events[1]!.id]] as const) {
      figure.setHighlight(selected, active);
      assert.equal(figure.figure.stats().fills, fills, 'selecting a rest never gives it a face');
      if (selected) assert.equal(figure.figure.lines.accentDashed.count, 12, 'a selected rest is outlined in dashed accent ink');
      if (active) assert.equal(figure.figure.glowKey, null, 'a playing rest has no face to light');
      const bounds = boxOf(rest.hit);
      near(bounds.min.x, BAR_WIDTH / 2, 'rest begins after the half note');
      near(bounds.max.x, BAR_WIDTH * 3 / 4, 'rest time remains present');
    }
  } finally { figure.dispose(); }
});

test('projection and raycasting select all sixteen event IDs at both fixed views, including a rest; lift never moves a pick box', () => {
  const events = pattern(Array.from({ length: 16 }, () => 16), [7]);
  const figure = createDurationFigure(events);
  const camera = new THREE.OrthographicCamera(-6, 6, 3, -3, 0.1, 100);
  const raycaster = new THREE.Raycaster();
  try {
    for (const lift of [1, 0]) {
      figure.setLift(lift);
      for (const [width, height] of [[844, 220], [390, 164], [320, 220]]) {
        for (const view of ['default', 'shallow'] as const) {
          frameDurationCamera(camera, width, height, view);
          figure.group.updateMatrixWorld(true);
          for (const event of events) {
            const mesh = figure.views.get(event.id)!.hit;
            const center = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).project(camera);
            raycaster.setFromCamera(new THREE.Vector2(center.x, center.y), camera);
            const firstHit = raycaster.intersectObjects(figure.pickTargets, false)[0];
            assert.equal(firstHit?.object.userData.eventId, event.id, `lift ${lift} ${width}x${height} ${view}: ${event.id} selectable`);
          }
          const xAt = (x: number) => new THREE.Vector3(x, 0, 0).project(camera).x;
          near((xAt(BAR_WIDTH / 2) - xAt(0)) / (xAt(BAR_WIDTH / 4) - xAt(0)), 2, 'projection keeps the half/quarter ratio');
        }
      }
    }
    figure.setLift(1);
    const standing = figure.pickTargets.map(boxOf);
    figure.setLift(0);
    const flat = figure.pickTargets.map(boxOf);
    standing.forEach((box, index) => assert.ok(box.equals(flat[index]!), 'hit boxes are identical at lift 0 and 1'));
  } finally { figure.dispose(); }
});

test('selection and replacement keep the pick array; a rejected replacement keeps the valid figure', () => {
  const events = pattern([2, 4, 8, 8], [1]);
  const figure = createDurationFigure(events);
  try {
    const stable = figure.pickTargets;
    const first = figure.views.get(events[0]!.id)!.hit;
    figure.setHighlight(events[0]!.id, events[2]!.id);
    assert.equal(figure.views.get(events[0]!.id)!.hit, first, 'selection redraws accent ink without rebuilding pick boxes');
    assert.equal(figure.figure.lines.accent.count, 12, 'the selected note gets a solid accent outline');
    assert.equal(figure.figure.glowKey, events[2]!.id, 'the playing note glows');
    figure.setEvents(pattern(Array.from({ length: 16 }, () => 16), [3]));
    assert.equal(figure.pickTargets, stable);
    assert.equal(figure.pickTargets.length, 16);
    const idsBefore = [...figure.views.keys()];
    const targetsBefore = [...figure.pickTargets];
    const invalid: DurationEvent = { ...events[0]!, duration: { n: 0, d: 1 } };
    assert.throws(() => figure.setEvents([invalid]), RangeError);
    assert.deepEqual([...figure.views.keys()], idsBefore);
    assert.deepEqual(figure.pickTargets, targetsBefore);
    figure.setEvents([]);
    assert.equal(figure.views.size, 0);
    assert.equal(figure.pickTargets.length, 0);
    figure.setEvents(events);
    assert.equal(figure.views.size, 4);
  } finally { figure.dispose(); }
});

test('resources are disposed exactly once and stay alive through fifty edits, selections and positions', () => {
  const events = pattern([2, 4, 8, 8], [1]);
  const figure = createDurationFigure(events, { requestFrame: () => 0, cancelFrame: () => {} });
  const observed = resources(figure.group);
  observed.add(figure.figure.fill.customDepthMaterial!);
  const counts = new Map<object, number>();
  for (const resource of observed) { counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1)); }
  for (let index = 0; index < 50; index += 1) {
    figure.setEvents(index % 2 ? events : pattern([4, 4, 4, 4], [1]));
    figure.setHighlight('geometry-0', 'geometry-1');
    figure.setPosition(index / 49, index % 2 === 0);
  }
  // The fill geometry is replaced per edit (its predecessor is disposed once, as it goes).
  const fillGeometry = [...observed].find(resource => resource instanceof THREE.BufferGeometry && counts.get(resource) === 1);
  assert.ok(fillGeometry, 'the first fill geometry was released by the first rebuild');
  for (const [resource, count] of counts) if (resource !== fillGeometry) assert.equal(count, 0, `${resource.constructor.name} stays alive`);
  figure.dispose();
  for (const [resource, count] of counts) assert.equal(count, 1, `${resource.constructor.name} disposed once`);
  assert.equal(figure.group.children.length, 0);
  assert.equal(figure.views.size, 0);
  assert.equal(figure.pickTargets.length, 0);
  figure.dispose();
  for (const count of counts.values()) assert.equal(count, 1, 'repeated cleanup is idempotent');
});

test('playhead clamps invalid numbers, follows the paper, and reduced motion hides it', () => {
  const events = pattern([4, 4, 4, 4]);
  const before = structuredClone(events);
  const surface = (x: number) => 0.01 * x;
  const figure = createDurationFigure(events, { surface });
  const { playhead } = figure;
  try {
    for (const input of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) assert.equal(clampedPosition(input), 0);
    assert.equal(clampedPosition(2), 1);
    figure.setPosition(0.25, false);
    assert.equal(playhead.object.visible, true);
    near(playhead.object.position.x, BAR_WIDTH / 4, 'playhead maps the whole-note fraction to x');
    near(playhead.object.position.y, surface(BAR_WIDTH / 4), 'playhead stands on the curved paper');
    figure.setPosition(0.75, true);
    assert.equal(playhead.object.visible, false);
    figure.setPosition(Number.NaN, false);
    assert.equal(playhead.object.visible, false);
    assert.equal(playhead.object.position.x, 0);
    assert.deepEqual(events, before);
    assert.throws(() => durationBounds({ ...events[0]!, onset: { n: -1, d: 4 } }), RangeError);
    assert.throws(() => durationBounds({ ...events[0]!, duration: { n: 1, d: 0 } }), RangeError);
  } finally { figure.dispose(); }
});

test('split draws the new boundary and merge erases the old one over splitMerge ms; data never waits for the drawing', () => {
  let clock = 1000;
  const frames: ((time: number) => void)[] = [];
  let invalidated = 0;
  const figure = createDurationFigure(pattern([2, 2]), { now: () => clock, requestFrame: callback => frames.push(callback), cancelFrame: () => {}, invalidate: () => { invalidated += 1; } });
  try {
    assert.deepEqual(durationBoundaries(pattern([2, 4, 4])), [5, 7.5]);
    figure.setEvents(pattern([2, 4, 4]));
    assert.equal(figure.views.size, 3, 'the data changed at once');
    assert.deepEqual(figure.transition, { kind: 'draw', boundaries: [7.5] });
    clock += BOOK_MOTION.splitMerge / 2;
    frames.shift()!(clock);
    assert.ok(figure.transition, 'still drawing half way');
    assert.ok(invalidated > 0, 'the stage is asked for frames while the stroke moves');
    clock += BOOK_MOTION.splitMerge;
    frames.shift()!(clock);
    assert.equal(figure.transition, null, 'the stroke finishes after splitMerge');
    figure.setEvents(pattern([2, 2]));
    assert.deepEqual(figure.transition, { kind: 'erase', boundaries: [7.5] });
    figure.hold(120);
    assert.deepEqual(figure.transition, { kind: 'erase', boundaries: [7.5] }, 'a held stroke stays');
    clock += 10_000;
    figure.advance(clock);
    assert.ok(figure.transition, 'held strokes ignore the clock');
    figure.hold(null);
    assert.equal(figure.transition, null, 'released after its time has passed');
    // Before the figure has fully appeared there is nothing to animate.
    figure.setReveal(0.5);
    figure.setEvents(pattern([2, 4, 4]));
    assert.equal(figure.transition, null);
  } finally { figure.dispose(); }
  const reduced = createDurationFigure(pattern([2, 2]), { reducedMotion: () => true, requestFrame: () => 0, cancelFrame: () => {} });
  try {
    reduced.setEvents(pattern([2, 4, 4]));
    assert.equal(reduced.transition, null, 'reduced motion cuts the stroke');
    assert.equal(reduced.views.size, 3);
  } finally { reduced.dispose(); }
});

test('axis, ticks and labels are printed on the paper; the layout mirror used for the page window matches', () => {
  const labelled = createDurationFigure(pattern([4, 4, 4, 4]));
  const plain = createDurationFigure(pattern([4, 4, 4, 4]), { labels: false });
  try {
    assert.equal(labelled.figure.stats().labels, 3, "'0', '1/2', '1'");
    assert.equal(plain.figure.stats().labels, 0);
    const axis = labelled.figure.lines.ink.segment(0)!;
    assert.deepEqual(axis.flatStart, axis.start, 'the axis is ink on the paper');
    near(axis.start[2], DURATION_FIGURE.axisZ, 'axis z');
    assert.ok(axis.color[0] > labelled.figure.lines.ink.segment(labelled.figure.lines.ink.count - 1)!.color[0], 'the axis is lighter ink than the notes');
    const layout = LESSON_FIGURE_LAYOUT;
    near(layout.blockHeight, BLOCK_HEIGHT, 'block height');
    near(layout.laneBack, DURATION_FIGURE.backZ, 'lane back');
    near(layout.laneFront, durationFrontZ(false), 'lane front');
    near(layout.laneFrontLabelled, durationFrontZ(true), 'labelled lane front');
    for (const [sceneId, kind] of Object.entries(DECOR_KIND)) {
      const extent = decorExtent(kind, LESSON_FIGURE_RAISE_PER_HEIGHT);
      const mirror = layout.decor[sceneId as keyof typeof layout.decor]!;
      near(mirror.back, extent.back, `${sceneId} decor back`, 0.005);
      near(mirror.front, extent.front, `${sceneId} decor front`, 0.005);
    }
  } finally { labelled.dispose(); plain.dispose(); }
});

test('decor: sound bands and a pop-up metronome, scissor cuts that follow the boundaries, fractions, all within budget', () => {
  const sound = createSpreadDecor('sound', []);
  const halves = pattern([2, 2]);
  const scissors = createSpreadDecor('scissors', [halves]);
  try {
    assert.ok(sound.stats().segments > 50 && sound.stats().segments <= DECOR_BUDGET, `sound decor ${sound.stats().segments} segments`);
    // The metronome stands up from its plan, like the blocks (flat = the same x, z on the paper).
    const { ink } = sound.figure.lines;
    const standing = Array.from({ length: ink.count }, (_, index) => ink.segment(index)!).filter(segment => segment.end[1] > 0.3);
    assert.ok(standing.length > 0);
    for (const segment of standing) {
      assert.ok(Math.abs(segment.flatEnd[2] - segment.end[2]) < 1e-6 && Math.abs(segment.flatEnd[0] - segment.end[0]) < 1e-6, 'plan keeps x and z');
      assert.ok(segment.flatEnd[1] < 0.01, 'and lies on the paper');
    }
    assert.ok(Math.max(...standing.map(segment => segment.end[1])) > 1.2, 'a metronome tall enough to read');
    assert.equal(scissors.figure.lines.dashed.count, 1, 'one cut at the half');
    assert.equal(fractionSummary(halves), '1 = 1/2 × 2');
    const sixteen = pattern(Array.from({ length: 16 }, () => 16));
    scissors.update([sixteen]);
    assert.equal(scissors.figure.lines.dashed.count, 15, 'a cut at every boundary');
    assert.equal(fractionSummary(sixteen), '1 = 1/16 × 16');
    assert.equal(fractionSummary(pattern([2, 4, 8, 8])), '1 = 1/2 + 1/4 + 1/8 × 2');
    assert.equal(fractionSummary(pattern([1])), '', 'nothing is written before the first cut');
    assert.ok(scissors.stats().segments <= DECOR_BUDGET);
    assert.equal(scissors.figure.hitTargets.length, 0, 'decor is never a pick target (not the learning record)');
  } finally { sound.dispose(); scissors.dispose(); }
});

test('v3 R8 decor: the seconds ruler follows the tempo (blocks keep their length); the free bar fills as far as the notes reach', () => {
  const quarters = pattern([4, 4, 4, 4]);
  const tempo = createSpreadDecor('tempo', [quarters], { bpm: 60 });
  const bar = createSpreadDecor('bar', [pattern([4, 8])]);
  try {
    assert.deepEqual(tempo.figure.labelTexts(), ['0초', '1초', '2초', '3초', '4초'], 'tempo 60: a quarter is a second');
    const ink = tempo.figure.lines.ink.count;
    tempo.update([quarters], 120);
    assert.deepEqual(tempo.figure.labelTexts(), ['0초', '0.5초', '1초', '1.5초', '2초'], 'tempo 120: the same ruler, half the seconds');
    assert.equal(tempo.figure.lines.ink.count, ink, 'the ruler itself does not move');
    tempo.update([pattern([2, 2])], 120);
    assert.deepEqual(tempo.figure.labelTexts(), ['0초', '0.5초', '1초', '1.5초', '2초'], 'edits do not touch the ruler');
    assert.ok(tempo.stats().segments <= DECOR_BUDGET && bar.stats().segments <= DECOR_BUDGET);
    // 1/4 + 1/8 = 3/8 of the bar is filled; the remaining 5/8 is dashed, open for the reader.
    assert.equal(bar.figure.lines.dashed.count, 3, 'the open rest of the bar is dashed (its left side is the filled strip\'s edge)');
    assert.deepEqual(bar.figure.labelTexts(), ['3/8 = 1/4 + 1/8']);
    bar.update([pattern([4, 4, 4, 4])]);
    assert.equal(bar.figure.lines.dashed.count, 0, 'a full bar has nothing left open');
    assert.deepEqual(bar.figure.labelTexts(), ['1 = 1/4 × 4']);
    bar.update([[]]);
    assert.deepEqual([bar.figure.lines.dashed.count, bar.figure.labelTexts().length], [4, 0], 'an empty draft: the whole bar open, nothing written');
    for (const decor of [tempo, bar]) assert.equal(decor.figure.hitTargets.length, 0, 'decor is never a pick target');
  } finally { tempo.dispose(); bar.dispose(); }
});
