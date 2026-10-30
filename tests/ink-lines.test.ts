import assert from 'node:assert/strict';
import test from 'node:test';
import { Color } from 'three';
import { createInkMaterial, createInkUniforms, createPen, INK, InkLines, patchInkShader } from '../src/book/figures/inkLines.ts';
import type { InkSegment, ShaderSource } from '../src/book/figures/inkLines.ts';

const close = (actual: number, expected: number, message: string, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);

test('pen schedule: starts follow stroke order, longer strokes take longer, the last stroke ends the drawing at 1', () => {
  const pen = createPen();
  const lengths = [0.2, 3, 0.1, 1, 0.05, 2.5];
  const slots = lengths.map((length, index) => { if (index === 3) pen.pause(0.2); return pen.next(length); });
  const total = pen.finalize();
  assert.ok(total > 0);
  for (let index = 1; index < slots.length; index += 1) {
    assert.ok(slots[index]!.t0 > slots[index - 1]!.t0, 'pen starts are strictly increasing in add order');
    assert.ok(slots[index]!.t0 + slots[index]!.dur >= slots[index - 1]!.t0 + slots[index - 1]!.dur - 1e-12, 'stroke ends never go backwards');
  }
  close(slots.at(-1)!.t0 + slots.at(-1)!.dur, 1, 'the last stroke finishes the drawing');
  assert.ok(slots.every(slot => slot.t0 >= 0 && slot.t0 + slot.dur <= 1 + 1e-12));
  const fresh = createPen();
  const short = fresh.next(0.1), long = fresh.next(5);
  assert.ok(long.dur > short.dur, 'longer strokes take longer');
  // The pause starts the next group after everything before it has ended.
  const grouped = createPen();
  const first = grouped.next(4);
  grouped.pause(0.1);
  const second = grouped.next(1);
  assert.ok(second.t0 >= first.t0 + first.dur + 0.1 - 1e-12);
  const empty = createPen();
  assert.equal(empty.finalize(), 1e-6, 'an empty pen finalizes without dividing by zero');
});

test('ink segments keep standing, flat, schedule and tone; unscheduled segments are always drawn', () => {
  const lines = new InkLines(createInkUniforms(), { capacity: 4, name: 'test-ink' });
  try {
    const segments: InkSegment[] = [
      { start: [0, 0.38, 0.45], end: [10, 0.38, 0.45], flatStart: [0, 0.004, 0.45], flatEnd: [10, 0.004, 0.45], t0: 0.25, dur: 0.5 },
      { start: [0, 0, 0.64], end: [10, 0, 0.64], tone: 0.5 },
    ];
    lines.set(segments);
    assert.equal(lines.count, 2);
    assert.equal(lines.geometry.instanceCount, 2);
    assert.equal(lines.object.visible, true);
    const lifted = lines.segment(0)!;
    assert.deepEqual([...lifted.start], [0, 0.38, 0.45].map(Math.fround));
    assert.deepEqual([...lifted.flatEnd], [10, 0.004, 0.45].map(Math.fround));
    close(lifted.t0, 0.25, 'pen start'); close(lifted.dur, 0.5, 'pen duration');
    const printed = lines.segment(1)!;
    assert.deepEqual(printed.flatStart, printed.start, 'ink on the paper stays where it is drawn');
    assert.equal(printed.t0, 0); assert.equal(printed.dur, 0);
    const ink = new Color(INK.color), paper = new Color(INK.paper);
    close(lifted.color[0], ink.r, 'full ink tone', 1e-6);
    close(printed.color[1], (ink.g + paper.g) / 2, 'tone 0.5 is halfway to the paper', 1e-6);
    // Continuous dash phase along the set, measured on the standing drawing.
    const distances = lines.geometry.getAttribute('instanceDistanceEnd');
    close(distances.getX(1), 20, 'second segment ends at the summed length');
    lines.set([]);
    assert.equal(lines.object.visible, false, 'an empty set is not drawn');
    assert.equal(lines.segment(0), null);
  } finally { lines.dispose(); }
});

test('a larger set moves to a bigger geometry, keeps every segment and disposes the old buffers once', () => {
  const lines = new InkLines(createInkUniforms(), { capacity: 4 });
  const first = lines.geometry;
  let firstDisposed = 0;
  first.addEventListener('dispose', () => { firstDisposed += 1; });
  const many: InkSegment[] = Array.from({ length: 37 }, (_, index) => ({ start: [index, 0, 0], end: [index + 1, 0, 0], t0: index / 37, dur: 1 / 37 }));
  lines.set(many);
  assert.notEqual(lines.geometry, first);
  assert.equal(lines.object.geometry, lines.geometry);
  assert.equal(firstDisposed, 1);
  assert.equal(lines.count, 37);
  assert.ok(lines.capacity >= 37);
  for (const index of [0, 18, 36]) assert.deepEqual([...lines.segment(index)!.start], [index, 0, 0]);
  let geometryDisposed = 0, materialDisposed = 0;
  lines.geometry.addEventListener('dispose', () => { geometryDisposed += 1; });
  lines.material.addEventListener('dispose', () => { materialDisposed += 1; });
  lines.dispose();
  lines.dispose();
  assert.equal(geometryDisposed, 1);
  assert.equal(materialDisposed, 1);
  assert.equal(firstDisposed, 1);
  assert.throws(() => lines.set(many), /disposed/);
});

test('the patched line shader declares lift and reveal and mixes flat to standing positions', () => {
  const uniforms = createInkUniforms(0.25, 0.5);
  const material = createInkMaterial(uniforms, { dashed: true });
  try {
    const shader: ShaderSource = { uniforms: { ...material.uniforms }, vertexShader: material.vertexShader, fragmentShader: material.fragmentShader };
    material.onBeforeCompile(shader as never, undefined as never);
    assert.match(shader.vertexShader, /uniform float uLift;/);
    assert.match(shader.vertexShader, /attribute vec3 instanceFlatStart;/);
    assert.match(shader.vertexShader, /mix\( instanceFlatStart, instanceStart, uLift \)/);
    assert.match(shader.vertexShader, /mix\( instanceFlatEnd, instanceEnd, uLift \)/);
    assert.match(shader.vertexShader, /start\.xyz \*= 0\.9985;/, 'ink is pulled toward the eye, never re-projected');
    assert.match(shader.fragmentShader, /uniform float uReveal;/);
    assert.match(shader.fragmentShader, /inkLocal < vSegmentT \) discard;/);
    assert.match(shader.fragmentShader, /alpha \*= inkCoverage;\s*#endif\s*gl_FragColor = vec4\( diffuseColor\.rgb, alpha \);/, 'anti-aliased ink coverage before the colour is written');
    assert.equal(shader.uniforms.uInkWidth, material.userData.inkWidth);
    assert.equal((shader.uniforms.uInkWidth as { value: number }).value, INK.width, 'the ink is the design width');
    assert.equal(shader.uniforms.uLift, uniforms.uLift, 'uniform objects are shared, not copied');
    assert.equal(shader.uniforms.uReveal, uniforms.uReveal);
    assert.equal(material.dashed, true);
    assert.equal(material.worldUnits, false, 'width is in screen pixels at any distance');
    assert.equal(material.linewidth, INK.width + INK.aaPad, 'the quad carries the anti-aliased edge');
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false, 'ink never hides other ink');
    assert.equal(material.vertexColors, true);
    assert.equal(material.depthTest, true, 'turning paper occludes ink');
    assert.throws(() => patchInkShader({ uniforms: {}, vertexShader: 'void main() {}', fragmentShader: 'void main() {}' }, uniforms), /anchors missing/);
  } finally { material.dispose(); }
});

test('fat ink lines are hidden from the AO normal pass and are never frustum culled', () => {
  const lines = new InkLines(createInkUniforms());
  try {
    assert.equal((lines.object as unknown as { isLine2?: boolean }).isLine2, true);
    assert.equal(lines.object.frustumCulled, false);
    lines.setResolution(1280, 720);
    assert.deepEqual(lines.material.resolution.toArray(), [1280, 720]);
    lines.setResolution(0, 0);
    assert.deepEqual(lines.material.resolution.toArray(), [1280, 720], 'an empty viewport keeps the last resolution');
  } finally { lines.dispose(); }
});
