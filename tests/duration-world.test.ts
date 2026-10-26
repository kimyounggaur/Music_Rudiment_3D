import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { add, frac } from '../src/domain/index.ts';
import type { DurationEvent } from '../src/scenes/DurationScene2D.tsx';
import {
  BAR_WIDTH, BLOCK_DEPTH, BLOCK_HEIGHT, clampedPosition, createDurationWorld,
  durationBounds, frameDurationCamera,
} from '../src/scenes/durationWorld.ts';

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

function near(actual: number, expected: number, message: string) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${message}: expected ${expected}, got ${actual}`);
}

function resources(world: ReturnType<typeof createDurationWorld>) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  world.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  return { geometries, materials };
}

test('real Three boxes preserve total time, every adjacent boundary, and constant height/depth through sixteen-way split', () => {
  for (const count of [1, 2, 4, 8, 16]) {
    const events = pattern(Array.from({ length: count }, () => count), count > 1 ? [1] : []);
    const before = structuredClone(events);
    const world = createDurationWorld(THREE, events);
    try {
      assert.equal(world.views.size, count);
      const unitBoxes = new Set([...world.views.values()].map((view) => view.box.geometry));
      const unitEdges = new Set([...world.views.values()].map((view) => view.outline.geometry));
      assert.equal(unitBoxes.size, 1, 'all note and rest proxies share the same unit-box geometry');
      assert.equal(unitEdges.size, 1, 'all outlines share the same edge geometry');
      let previousEnd = 0;
      for (const event of events) {
        const view = world.views.get(event.id)!;
        const box = new THREE.Box3().setFromObject(view.box);
        const size = box.getSize(new THREE.Vector3());
        near(box.min.x, previousEnd, `${count}-way split must have neither gap nor overlap`);
        near(size.x, BAR_WIDTH / count, `${event.id} world width`);
        near(size.y, BLOCK_HEIGHT, `${event.id} world height`);
        near(size.z, BLOCK_DEPTH, `${event.id} world depth`);
        near(box.min.y, 0, `${event.id} sits on the same baseline`);
        near(box.min.z, -BLOCK_DEPTH / 2, `${event.id} shares the same depth origin`);
        previousEnd = box.max.x;
      }
      near(previousEnd, BAR_WIDTH, 'last block must end at one whole note');
      assert.deepEqual(events, before, 'visual construction must not mutate music meaning');
    } finally { world.dispose(); }
  }
});

test('mixed note/rest durations keep real world extents and outline-only rests across every selection state', () => {
  const events = pattern([2, 4, 8, 8], [1]);
  const world = createDurationWorld(THREE, events);
  try {
    const rest = world.views.get(events[1].id)!;
    const restMaterial = rest.box.material;
    assert.ok(restMaterial instanceof THREE.MeshBasicMaterial);
    assert.equal(restMaterial.opacity, 0);
    assert.equal(restMaterial.colorWrite, false);
    assert.equal(restMaterial.depthWrite, false);
    const originalBoxGeometry = rest.box.geometry;
    const originalOutlineGeometry = rest.outline.geometry;
    for (const [selected, active] of [[null, null], [rest.box.userData.eventId, null], [null, rest.box.userData.eventId]]) {
      world.setHighlight(selected, active);
      assert.equal(rest.box.material, restMaterial, 'selecting a rest must never turn it into a solid note');
      assert.ok(rest.outline.material instanceof THREE.LineDashedMaterial);
      assert.equal(rest.box.geometry, originalBoxGeometry);
      assert.equal(rest.outline.geometry, originalOutlineGeometry);
      const restBounds = new THREE.Box3().setFromObject(rest.box);
      near(restBounds.min.x, BAR_WIDTH / 2, 'rest begins after the half note');
      near(restBounds.max.x, BAR_WIDTH * 3 / 4, 'rest time remains present');
    }
  } finally { world.dispose(); }
});

test('actual orthographic projection and raycaster select all sixteen event IDs, including an invisible rest proxy, at both fixed views', () => {
  const events = pattern(Array.from({ length: 16 }, () => 16), [7]);
  const world = createDurationWorld(THREE, events);
  const camera = new THREE.OrthographicCamera(-6, 6, 3, -3, 0.1, 100);
  const raycaster = new THREE.Raycaster();
  try {
    for (const [width, height] of [[844, 220], [390, 164], [320, 220]]) {
      for (const view of ['default', 'shallow'] as const) {
        frameDurationCamera(camera, width, height, view);
        world.group.updateMatrixWorld(true);
        const visibleBounds = new THREE.Box3().setFromObject(world.group);
        for (const x of [visibleBounds.min.x, visibleBounds.max.x]) {
          for (const y of [visibleBounds.min.y, visibleBounds.max.y]) {
            for (const z of [visibleBounds.min.z, visibleBounds.max.z]) {
              const projected = new THREE.Vector3(x, y, z).project(camera);
              assert.ok(Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1, `${width}x${height} ${view}: scene extent must fit in the viewport`);
            }
          }
        }
        for (const event of events) {
          const mesh = world.views.get(event.id)!.box;
          const center = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).project(camera);
          raycaster.setFromCamera(new THREE.Vector2(center.x, center.y), camera);
          const firstHit = raycaster.intersectObjects(world.pickTargets, false)[0];
          assert.equal(firstHit?.object.userData.eventId, event.id, `${width}x${height} ${view}: ${event.id} must remain independently selectable`);
        }
        const xAt = (x: number) => new THREE.Vector3(x, 0, 0).project(camera).x;
        near((xAt(BAR_WIDTH / 2) - xAt(0)) / (xAt(BAR_WIDTH / 4) - xAt(0)), 2, 'camera projection preserves the half/quarter width ratio');
      }
    }
  } finally { world.dispose(); }
});

test('selection and pattern replacement reuse owned resources; a rejected replacement preserves the existing valid world', () => {
  const events = pattern([2, 4, 8, 8], [1]);
  const world = createDurationWorld(THREE, events);
  try {
    const first = world.views.get(events[0].id)!;
    const sharedBox = first.box.geometry;
    const sharedEdges = first.outline.geometry;
    const initialBox = first.box;
    world.setHighlight(events[0].id, events[1].id);
    assert.equal(world.views.get(events[0].id)!.box, initialBox, 'selection updates material without rebuilding meshes');
    world.setEvents(pattern(Array.from({ length: 16 }, () => 16), [3]));
    assert.ok([...world.views.values()].every((view) => view.box.geometry === sharedBox && view.outline.geometry === sharedEdges));
    const idsBeforeFailure = [...world.views.keys()];
    const targetsBeforeFailure = [...world.pickTargets];
    const invalid: DurationEvent = { ...events[0], duration: { n: 0, d: 1 } };
    assert.throws(() => world.setEvents([invalid]), RangeError);
    assert.deepEqual([...world.views.keys()], idsBeforeFailure);
    assert.deepEqual(world.pickTargets, targetsBeforeFailure);
    world.setEvents([]);
    assert.equal(world.views.size, 0);
    assert.equal(world.pickTargets.length, 0);
    world.setEvents(events);
    assert.equal(world.views.get(events[0].id)!.box.geometry, sharedBox);
  } finally { world.dispose(); }
});

test('actual geometry/material dispose events fire once and remain silent through fifty data/selection changes', () => {
  const events = pattern([2, 4, 8, 8], [1]);
  const world = createDurationWorld(THREE, events);
  const observed = resources(world);
  for (const [selected, active] of [[events[0].id, events[1].id], [events[1].id, events[0].id]]) {
    world.setHighlight(selected, active);
    const more = resources(world);
    more.geometries.forEach((geometry) => observed.geometries.add(geometry));
    more.materials.forEach((material) => observed.materials.add(material));
  }
  const counts = new Map<object, number>();
  for (const resource of [...observed.geometries, ...observed.materials]) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1));
  }
  for (let index = 0; index < 50; index++) {
    world.setEvents(index % 2 ? events : pattern([4, 4, 4, 4], [1]));
    world.setHighlight('geometry-0', 'geometry-1');
    world.setPosition(index / 49, index % 2 === 0);
  }
  assert.ok([...counts.values()].every((count) => count === 0), 'shared resources stay alive during ordinary updates');
  world.dispose();
  assert.ok([...counts.values()].every((count) => count === 1), 'every observed owned geometry/material is disposed exactly once');
  assert.equal(world.group.children.length, 0);
  assert.equal(world.views.size, 0);
  assert.equal(world.pickTargets.length, 0);
  world.dispose();
  assert.ok([...counts.values()].every((count) => count === 1), 'repeated cleanup is idempotent');
});

test('playhead clamps invalid numbers and reduced motion hides the moving marker without changing music events', () => {
  const events = pattern([4, 4, 4, 4]);
  const before = structuredClone(events);
  const world = createDurationWorld(THREE, events);
  const playhead = world.group.children[2];
  try {
    for (const input of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) assert.equal(clampedPosition(input), 0);
    assert.equal(clampedPosition(2), 1);
    world.setPosition(0.25, false);
    assert.equal(playhead.visible, true);
    near(playhead.position.x, BAR_WIDTH / 4, 'playhead maps whole-note fraction into world X');
    world.setPosition(0.75, true);
    assert.equal(playhead.visible, false);
    world.setPosition(Number.NaN, false);
    assert.equal(playhead.visible, false);
    assert.equal(playhead.position.x, 0);
    assert.deepEqual(events, before);
    assert.throws(() => durationBounds({ ...events[0], onset: { n: -1, d: 4 } }), RangeError);
    assert.throws(() => durationBounds({ ...events[0], duration: { n: 1, d: 0 } }), RangeError);
  } finally { world.dispose(); }
});
