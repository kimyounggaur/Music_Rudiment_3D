import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh } from 'three';
import { createFlapLayer, FLAP } from '../src/book/render/flaps.ts';
import type { FlapPage, StageFlap } from '../src/book/render/flaps.ts';
import { BOOK_MOTION } from '../src/book/motion.ts';

const page = (curve = 0): FlapPage => ({ mesh: new Group(), width: 2, height: 3, surface: (u: number) => curve * u });
const flap = (open: boolean, patch: Partial<StageFlap> = {}): StageFlap => ({
  key: 'left:answer', side: 'left', rect: { u0: 0.1, v0: 0.5, u1: 0.9, v1: 0.7 }, open, hint: '정답 보기', foldHint: '다시 덮기', ...patch,
});
const meshes = (pages: { left: FlapPage; right: FlapPage }) =>
  [...pages.left.mesh.children, ...pages.right.mesh.children].filter((child): child is Mesh => child instanceof Mesh);
const corners = (mesh: Mesh) => {
  const position = mesh.geometry.getAttribute('position');
  const columns = FLAP.columns;
  const at = (index: number) => ({ x: position.getX(index), y: position.getY(index), z: position.getZ(index) });
  return { hingeLeft: at(0), hingeRight: at(columns), freeLeft: at(columns + 1), freeRight: at(2 * columns + 1) };
};

test('R5 flap: a closed flap lies on its printed rect and is not drawn at rest', () => {
  const pages = { left: page(0.1), right: page() };
  const layer = createFlapLayer();
  layer.setVisible(true);
  layer.set([flap(false)], pages);
  layer.update(0, pages);
  const [front, back] = meshes(pages);
  assert.ok(front && back, 'front and back sheets are children of the page mesh');
  assert.equal(front.visible, false, 'the print already shows a closed flap');
  const c = corners(front);
  // Page-local frame: x = u·width, z = (v − ½)·height, y = the page curve + a hair of lift.
  assert.ok(Math.abs(c.hingeLeft.x - 0.2) < 1e-6 && Math.abs(c.hingeRight.x - 1.8) < 1e-6);
  assert.ok(Math.abs(c.hingeLeft.z - 0) < 1e-6 && Math.abs(c.freeLeft.z - 0.6) < 1e-6);
  assert.ok(Math.abs(c.hingeRight.y - (0.1 * 0.9 + FLAP.lift)) < 1e-6, 'follows the page curve');
  assert.deepEqual(layer.angles(), { 'left:answer': 0 });
  layer.dispose();
  assert.equal(meshes(pages).length, 0);
});

test('R5 flap: opening lifts the sheet on its top hinge to 110° over the flap duration', () => {
  const pages = { left: page(), right: page() };
  const layer = createFlapLayer();
  layer.setVisible(true);
  layer.set([flap(false)], pages);
  const start = performance.now();
  layer.set([flap(true)], pages);
  assert.equal(layer.update(start + BOOK_MOTION.flap / 2, pages), true, 'still moving halfway');
  const [front] = meshes(pages);
  assert.equal(front!.visible, true, 'the sheet is drawn while it moves');
  const half = layer.angles()['left:answer']!;
  assert.ok(half > 20 && half < 90, `halfway angle ${half}`);
  assert.equal(layer.update(start + BOOK_MOTION.flap + 1000, pages), false);
  assert.equal(layer.angles()['left:answer'], FLAP.openDeg);
  assert.equal(front!.visible, true, 'an open flap keeps standing');
  const c = corners(front!);
  const depth = 0.2 * 3;
  // Hinge stays; the free edge swings up and back past the hinge (110°).
  assert.ok(Math.abs(c.hingeLeft.z - 0) < 1e-6);
  assert.ok(c.freeLeft.z < c.hingeLeft.z, 'leans back past vertical');
  assert.ok(Math.abs(c.freeLeft.y - FLAP.lift - depth * Math.sin(FLAP.openDeg * Math.PI / 180)) < 1e-6);
  // The bounds follow the sheet (a stale box would make the raycast miss the standing paper).
  assert.ok(front!.geometry.boundingBox && front!.geometry.boundingBox.max.y > depth * 0.9, 'box covers the raised edge');
  // Closing lowers it again and hides it at rest.
  const close = performance.now();
  layer.set([flap(false)], pages);
  // The layer stamps its own start time; settle well past it.
  layer.update(close + BOOK_MOTION.flap + 1000, pages);
  assert.equal(layer.angles()['left:answer'], 0);
  assert.equal(front!.visible, false);
  layer.dispose();
});

test('R5 flap: reduced motion jumps, hidden layers stay hidden, removed flaps are released', () => {
  const pages = { left: page(), right: page() };
  const layer = createFlapLayer();
  layer.set([flap(false)], pages);
  layer.set([flap(true)], pages, true);
  assert.equal(layer.angles()['left:answer'], FLAP.openDeg, 'instant');
  assert.equal(layer.update(performance.now(), pages), false);
  const [front] = meshes(pages);
  assert.equal(front!.visible, false, 'not drawn while the layer is hidden (turns, closed book)');
  layer.setVisible(true);
  assert.equal(front!.visible, true);
  // A second flap on the right page; the first one leaves with its spread.
  layer.set([flap(false, { key: 'right:answer', side: 'right' })], pages);
  assert.equal(pages.left.mesh.children.length, 0);
  assert.equal(pages.right.mesh.children.length, 2);
  assert.deepEqual(Object.keys(layer.angles()), ['right:answer']);
  // A moved rect rebuilds the sheet at its state.
  layer.set([flap(true, { key: 'right:answer', side: 'right', rect: { u0: 0.2, v0: 0.4, u1: 0.8, v1: 0.6 } })], pages);
  assert.equal(pages.right.mesh.children.length, 2);
  assert.equal(layer.angles()['right:answer'], FLAP.openDeg);
  layer.dispose();
  assert.equal(pages.right.mesh.children.length, 0);
});

test('R5 flap: a held clock pins moving flaps for captures, then real time resumes', () => {
  const pages = { left: page(), right: page() };
  const layer = createFlapLayer();
  layer.setVisible(true);
  layer.set([flap(false)], pages);
  layer.hold(0);
  layer.set([flap(true)], pages);
  assert.equal(layer.update(performance.now() + 10_000, pages), true, 'held at its start');
  assert.equal(layer.angles()['left:answer'], 0);
  layer.hold(BOOK_MOTION.flap / 2);
  layer.update(0, pages);
  assert.equal(layer.angles()['left:answer'], FLAP.openDeg / 2, 'smoothStep(½) = ½');
  layer.hold(null);
  assert.equal(layer.update(performance.now() + 10_000, pages), false);
  assert.equal(layer.angles()['left:answer'], FLAP.openDeg);
  layer.dispose();
});

test('R5 flap: only drawn sheets are press targets, and each maps back to its flap key', () => {
  const pages = { left: page(), right: page() };
  const layer = createFlapLayer();
  layer.setVisible(true);
  layer.set([flap(false)], pages);
  layer.update(0, pages);
  assert.deepEqual(layer.targets(), [], 'a closed flap at rest is the print, not a mesh');
  layer.set([flap(true)], pages, true);
  const targets = layer.targets();
  assert.equal(targets.length, 2, 'front and back of the standing sheet');
  assert.deepEqual(targets.map(target => layer.keyOf(target)), ['left:answer', 'left:answer']);
  assert.equal(layer.keyOf(new Group()), null);
  layer.setVisible(false);
  assert.deepEqual(layer.targets(), [], 'hidden during turns');
  // A changed fold hint reprints the sheet without losing its state.
  layer.setVisible(true);
  layer.set([flap(true, { foldHint: '덮기' })], pages);
  assert.equal(layer.angles()['left:answer'], FLAP.openDeg);
  layer.dispose();
});
