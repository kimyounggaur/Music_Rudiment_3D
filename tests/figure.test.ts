import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, BufferGeometry, Material, Mesh, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';
import { attachFigureControls, createInkFigure, figureControlsOf, sumFigureStats } from '../src/book/figures/figure.ts';
import { INK } from '../src/book/figures/inkLines.ts';
import { createPaperFillDepthMaterial, createPaperFillMaterial, patchPaperFillDepthShader, patchPaperFillShader } from '../src/book/figures/paperFill.ts';

const close = (actual: number, expected: number, message: string, tolerance = 1e-5) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
const box = { x0: 1, x1: 3, z0: -0.45, z1: 0.45, height: 0.38 };

test('a box is twelve pen-ordered ink edges over a closed paper solid that stands on the paper', () => {
  const figure = createInkFigure('box-test', { hatch: false });
  try {
    figure.rebuild(builder => builder.box(box, { key: 'a' }));
    const { ink } = figure.lines;
    assert.equal(ink.count, 12, 'flat page: one segment per edge');
    for (let index = 1; index < 12; index += 1) assert.ok(ink.segment(index)!.t0 > ink.segment(index - 1)!.t0, 'edges are drawn in order');
    const last = ink.segment(11)!;
    close(last.t0 + last.dur, 1, 'the last edge completes the drawing');
    // Bottom outline first, then verticals, then the top.
    for (let index = 0; index < 4; index += 1) { close(ink.segment(index)!.start[1], 0, 'bottom edge height'); close(ink.segment(index)!.end[1], 0, 'bottom edge height'); }
    for (let index = 4; index < 8; index += 1) close(ink.segment(index)!.end[1] - ink.segment(index)!.start[1], 0.38, 'vertical edge rises one block height');
    for (let index = 8; index < 12; index += 1) close(ink.segment(index)!.start[1], 0.38, 'top edge height');
    // The flat drawing is the plan (design default): every edge lies on the paper at the floor height.
    for (let index = 0; index < 12; index += 1) {
      const segment = ink.segment(index)!;
      close(segment.flatStart[1], INK.floor, 'flat ink floor'); close(segment.flatEnd[1], INK.floor, 'flat ink floor');
      close(segment.flatStart[2], segment.start[2], 'plan keeps z'); close(segment.flatStart[0], segment.start[0], 'plan keeps x');
    }
    const geometry = figure.fill.geometry;
    assert.equal(geometry.getIndex()!.count, 6 * 6, 'six faces, two triangles each');
    const bounds = new Box3().setFromBufferAttribute(geometry.getAttribute('position') as never);
    close(bounds.min.x, 1, 'fill x0'); close(bounds.max.x, 3, 'fill x1'); close(bounds.max.y, 0.38, 'fill height'); close(bounds.min.z, -0.45, 'fill depth');
    const flat = geometry.morphAttributes.position![0]!;
    for (let index = 0; index < flat.count; index += 1) close(flat.getY(index), INK.floor, 'the morph target is the flat plan');
    const reveal = geometry.getAttribute('inkReveal');
    for (let index = 0; index < reveal.count; index += 1) close(reveal.getX(index), 1, 'faces appear when the outline is finished');
  } finally { figure.dispose(); }
});

test('figures conform to the curved page: subdivided runs, flat ink on the surface, solids standing on it', () => {
  const surface = (x: number) => 0.1 * Math.sin(x / 3);
  const figure = createInkFigure('curved', { surface, step: 0.5 });
  try {
    figure.rebuild(builder => {
      builder.line([[0, 0, 0.64], [10, 0, 0.64]], { onPaper: true });
      builder.box({ x0: 0, x1: 10, z0: -0.45, z1: 0.45, height: 0.38 });
    });
    const { ink } = figure.lines;
    // The 10-unit axis splits into 20 pieces that each follow the page.
    for (let index = 0; index < 20; index += 1) {
      const segment = ink.segment(index)!;
      close(segment.start[1], surface(segment.start[0]) + INK.floor, 'on-paper ink rides the surface');
      assert.deepEqual(segment.flatStart, segment.start, 'printed ink does not lift');
    }
    const first = ink.segment(0)!, twentieth = ink.segment(19)!;
    close(first.start[0], 0, 'axis start'); close(twentieth.end[0], 10, 'axis end');
    for (let index = 1; index < 20; index += 1) {
      const previous = ink.segment(index - 1)!;
      close(ink.segment(index)!.t0, previous.t0 + previous.dur, 'one stroke: each piece starts where the last one ends', 1e-6);
    }
    assert.ok(twentieth.t0 + twentieth.dur > first.t0);
    const positions = figure.fill.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1) {
      const y = positions.getY(index) - surface(positions.getX(index));
      assert.ok(Math.abs(y) < 1e-5 || Math.abs(y - 0.38) < 1e-5, 'faces keep the block height above the local paper');
    }
  } finally { figure.dispose(); }
});

test('pick boxes are invisible, raycastable, and fixed at the standing position whatever the lift', () => {
  const figure = createInkFigure('hits', { surface: x => 0.02 * x });
  try {
    figure.rebuild(builder => {
      builder.box(box, { key: 'a' });
      builder.hit('a', { x0: 1, x1: 3, y0: 0, y1: 0.38, z0: -0.45, z1: 0.45 }, { eventId: 'a' });
    });
    const [hit] = figure.hitTargets;
    assert.ok(hit);
    assert.equal(hit.visible, false);
    assert.equal(hit.userData.eventId, 'a');
    const material = hit.material as Material & { opacity: number; colorWrite: boolean };
    assert.equal(material.opacity, 0);
    assert.equal(material.colorWrite, false);
    figure.group.updateMatrixWorld(true);
    const lifted = new Box3().setFromObject(hit, true);
    figure.setLift(0);
    figure.setReveal(0.3);
    figure.group.updateMatrixWorld(true);
    const flat = new Box3().setFromObject(hit, true);
    assert.ok(lifted.equals(flat), 'picking uses the standing solid at lift 0 and 1');
    close(lifted.min.x, 1, 'hit x0'); close(lifted.max.x, 3, 'hit x1'); close(lifted.max.y - lifted.min.y, 0.38, 'hit height');
    const camera = new PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(2, 6, 4);
    camera.lookAt(2, 0, 0);
    camera.updateMatrixWorld(true);
    const centre = new Vector3(2, 0.2, 0).project(camera);
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(centre.x, centre.y), camera);
    assert.equal(raycaster.intersectObjects(figure.hitTargets, false)[0]?.object, hit, 'invisible pick boxes still answer rays');
  } finally { figure.dispose(); }
});

test('lift and reveal drive the shader uniforms, morph influence, face visibility and shadows', () => {
  const figure = createInkFigure('motion');
  try {
    figure.rebuild(builder => { builder.box(box, { key: 'a' }); builder.label('1/2', [5, 0, 1.04]); });
    assert.equal(figure.fill.visible, true);
    figure.setLift(0);
    assert.equal(figure.uniforms.uLift.value, 0);
    assert.equal(figure.fill.morphTargetInfluences![0], 1);
    assert.equal(figure.fill.visible, false, 'the flat drawing is pure ink');
    assert.equal(figure.fill.castShadow, false);
    figure.setLift(0.29);
    assert.equal(figure.fill.visible, true);
    assert.equal(figure.fill.castShadow, false, 'no shadow until the figure clearly stands');
    figure.setLift(0.3);
    assert.equal(figure.fill.castShadow, true);
    close(figure.fill.morphTargetInfluences![0]!, 0.7, 'influence = 1 − lift');
    figure.setReveal(0);
    assert.equal(figure.uniforms.uReveal.value, 0);
    assert.equal(figure.fill.visible, false, 'nothing is shown before the pen starts');
    figure.setReveal(Number.NaN);
    assert.equal(figure.reveal, 0, 'invalid input clamps');
    figure.setLift(7);
    assert.equal(figure.lift, 1);
    assert.equal(figure.stats().labels, 1, 'labels are recorded even without a canvas (Node)');
  } finally { figure.dispose(); }
});

test('glow lights only the keyed box; accent overlays are fully drawn; stats add up', () => {
  const figure = createInkFigure('glow');
  try {
    figure.rebuild(builder => { builder.box(box, { key: 'a' }); builder.box({ ...box, x0: 3, x1: 5 }, { key: 'b' }); });
    figure.setGlow('b');
    const glow = figure.fill.geometry.getAttribute('inkGlow');
    const values = Array.from({ length: glow.count }, (_, index) => glow.getX(index));
    const half = values.length / 2;
    assert.ok(values.slice(0, half).every(value => value === 0));
    assert.ok(values.slice(half).every(value => Math.abs(value - 0.35) < 1e-6));
    figure.rebuild(builder => { builder.box(box, { key: 'a' }); builder.box({ ...box, x0: 3, x1: 5 }, { key: 'b' }); });
    assert.ok(Math.abs(figure.fill.geometry.getAttribute('inkGlow').getX(glow.count - 1) - 0.35) < 1e-6, 'glow survives a rebuild');
    figure.setGlow(null);
    assert.ok(Array.from({ length: glow.count }, (_, index) => figure.fill.geometry.getAttribute('inkGlow').getX(index)).every(value => value === 0));
    figure.setAccent(builder => builder.box({ ...box, x0: 0.99, x1: 3.01 }, { fill: false }));
    assert.equal(figure.lines.accent.count, 12);
    assert.equal(figure.lines.accent.segment(11)!.dur, 0, 'accent ink is not scheduled: always drawn');
    figure.setAccent(null);
    assert.equal(figure.lines.accent.count, 0);
    const stats = figure.stats();
    assert.equal(stats.ink, 24); assert.equal(stats.fills, 2);
    assert.deepEqual(sumFigureStats([stats, stats]).ink, 48);
  } finally { figure.dispose(); }
});

test('the stage finds a group\'s figure controls; dispose empties the group and releases each resource once', () => {
  const figure = createInkFigure('dispose');
  figure.rebuild(builder => {
    builder.box(box, { key: 'a' });
    builder.box({ ...box, x0: 4, x1: 5 }, { fill: false, edges: 'dashed' });
    builder.hit('a', { x0: 1, x1: 3, y0: 0, y1: 0.38, z0: -0.45, z1: 0.45 });
    builder.hit('b', { x0: 4, x1: 5, y0: 0, y1: 0.38, z0: -0.45, z1: 0.45 });
  });
  figure.setAccent(builder => builder.box(box, { fill: false }));
  attachFigureControls(figure.group, figure);
  assert.equal(figureControlsOf(figure.group), figure);
  assert.equal(figureControlsOf(null), null);
  const resources = new Set<BufferGeometry | Material>();
  figure.group.traverse(object => {
    if (!(object instanceof Mesh)) return;
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
  });
  resources.add(figure.fill.customDepthMaterial!);
  const counts = new Map<object, number>();
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
  figure.dispose();
  figure.dispose();
  assert.equal(figure.group.children.length, 0);
  assert.equal(figure.hitTargets.length, 0);
  for (const resource of resources) assert.equal(counts.get(resource), 1, `${resource.constructor.name} disposed once`);
  assert.throws(() => figure.rebuild(() => {}), /disposed/);
});

test('paper fill patches hatching, reveal and glow into the standard shader, and reveal into the shadow pass', () => {
  const reveal = { value: 0.5 };
  const material = createPaperFillMaterial({ reveal });
  const depth = createPaperFillDepthMaterial(reveal);
  try {
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main() {\n#include <normal_fragment_maps>\n#include <emissivemap_fragment>\n}',
    };
    patchPaperFillShader(shader, { uReveal: reveal }, true);
    assert.match(shader.fragmentShader, /^#define INK_HATCH/);
    assert.match(shader.fragmentShader, /if \( uReveal < vInkReveal \) discard;/);
    assert.match(shader.fragmentShader, /totalEmissiveRadiance \+= uGlowColor \* vInkGlow;/);
    assert.match(shader.vertexShader, /vInkPos = position;/);
    assert.equal(shader.uniforms.uReveal, reveal);
    const plain = { ...shader, uniforms: {}, fragmentShader: '#include <common>\nvoid main() {\n#include <normal_fragment_maps>\n#include <emissivemap_fragment>\n}' };
    patchPaperFillShader(plain, {}, false);
    assert.doesNotMatch(plain.fragmentShader, /#define INK_HATCH/, 'low tier: no hatching');
    assert.throws(() => patchPaperFillShader({ uniforms: {}, vertexShader: '', fragmentShader: '' }, {}, true), /shader changed/);
    const depthShader = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}', fragmentShader: 'void main() {\n}' };
    patchPaperFillDepthShader(depthShader, reveal);
    assert.match(depthShader.fragmentShader, /discard/);
    assert.equal(depthShader.uniforms.uReveal, reveal);
    assert.equal(material.hatch, true);
    assert.equal(material.color.getHexString(), 'fbf6ec');
    assert.notEqual(material.customProgramCacheKey(), createPaperFillMaterial({ hatch: false }).customProgramCacheKey());
    assert.equal(depth.customProgramCacheKey(), 'v3-paper-fill-depth-1');
  } finally { material.dispose(); depth.dispose(); }
});
