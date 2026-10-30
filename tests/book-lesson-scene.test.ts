import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BufferGeometry, Group, LineSegments, Material, Mesh, Vector3 } from 'three';
import { createLessonScene } from '../src/book/lessonScene.ts';
import { BOOK_DIMENSIONS } from '../src/book/geometry.ts';
import { createLessonState, reduceLesson, sceneEvents } from '../src/lesson/controller.ts';

const close = (actual: number, expected: number, tolerance = 1e-9): void =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const bounds = (mesh: Mesh) => new Box3().setFromObject(mesh);
const size = (mesh: Mesh) => bounds(mesh).getSize(new Vector3());

test('two comparison lanes preserve time ratios and constant height/depth on the right page', () => {
  const scene = createLessonScene('scene-1', createLessonState());
  try {
    assert.equal(scene.pickTargets.length, 5);
    const [whole, ...quarters] = scene.pickTargets;
    const wholeSize = size(whole!);
    const quarterSize = size(quarters[0]!);
    close(wholeSize.x, quarterSize.x * 4);
    close(wholeSize.y, quarterSize.y);
    close(wholeSize.z, quarterSize.z);
    for (const mesh of scene.pickTargets) {
      const box = bounds(mesh);
      assert.ok(box.min.x > 0 && box.max.x < BOOK_DIMENSIONS.pageWidth);
      assert.ok(box.min.y > 0);
      assert.ok(box.min.z > -BOOK_DIMENSIONS.pageHeight / 2 && box.max.z < BOOK_DIMENSIONS.pageHeight / 2);
      assert.equal(mesh.castShadow, true);
      assert.equal(mesh.receiveShadow, true);
      assert.ok(scene.pickEvent(mesh));
    }
    const snapshot = scene.getSnapshot();
    assert.deepEqual(snapshot.lanes.map((lane) => lane.laneId), ['upper', 'lower']);
    assert.ok(snapshot.lanes[0]!.origin.z < snapshot.lanes[1]!.origin.z);
    close(snapshot.lanes[0]!.origin.x, snapshot.lanes[1]!.origin.x);
    close(snapshot.lanes[0]!.width, snapshot.lanes[1]!.width);
    const upperBounds = bounds(whole!);
    const lowerBounds = quarters.reduce((result, mesh) => result.union(bounds(mesh)), new Box3());
    close(upperBounds.min.x, lowerBounds.min.x);
    close(upperBounds.max.x, lowerBounds.max.x);
    scene.group.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          assert.equal(material.depthTest, true, 'turning paper must occlude every scene material');
        }
      }
    });
    assert.equal(scene.pickEvent(new Mesh()), null, 'foreign meshes cannot select lesson events');
  } finally { scene.dispose(); }
});

test('splits update existing world resources and pick ownership, and preserved lesson data recreates the scene', () => {
  let lesson = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-2' });
  const scene = createLessonScene('scene-2', lesson);
  const initialMesh = scene.pickTargets[0]!;
  const initialGeometry = initialMesh.geometry;
  const initialSize = size(initialMesh);
  const stableTargets = scene.pickTargets;
  try {
    while (sceneEvents(lesson).some((event) => event.duration.d < 16)) {
      const next = sceneEvents(lesson).find((event) => event.duration.d < 16)!;
      lesson = reduceLesson(lesson, { type: 'split', id: next.id });
      scene.updateLesson(lesson);
    }
    assert.equal(scene.pickTargets, stableTargets);
    assert.equal(scene.pickTargets.length, 16);
    assert.equal(scene.pickEvent(initialMesh), null, 'removed mesh must lose selection ownership');
    close(scene.pickTargets.reduce((total, mesh) => total + size(mesh).x, 0), initialSize.x);
    for (const mesh of scene.pickTargets) {
      assert.equal(mesh.geometry, initialGeometry, 'duration edits reuse shared geometry');
      close(size(mesh).x, initialSize.x / 16);
      close(size(mesh).y, initialSize.y);
      close(size(mesh).z, initialSize.z);
      assert.equal(scene.pickEvent(mesh)?.laneId, 'main');
    }
    const events = sceneEvents(lesson);
    const limited = reduceLesson(lesson, { type: 'split', id: events[0]!.id });
    scene.updateLesson(limited);
    assert.equal(scene.pickTargets.length, 16);
    assert.equal(scene.getSnapshot().revision, limited.revision);
    const returned = createLessonScene('scene-2', limited);
    try {
      assert.deepEqual(returned.getSnapshot().lanes[0]!.eventIds, events.map((event) => event.id));
      assert.equal(returned.pickTargets.length, 16);
    } finally { returned.dispose(); }
    lesson = reduceLesson(lesson, { type: 'undo' });
    scene.updateLesson(lesson);
    assert.equal(scene.pickTargets.length, 15);
    lesson = reduceLesson(lesson, { type: 'redo' });
    scene.updateLesson(lesson);
    assert.equal(scene.pickTargets.length, 16);
  } finally { scene.dispose(); }
});

test('playback display is lane-exclusive, clears on stop, and respects reduced motion', () => {
  const lesson = createLessonState();
  const scene = createLessonScene('scene-1', lesson);
  try {
    const upper = scene.group.children[0] as Group;
    const lower = scene.group.children[1] as Group;
    const upperHead = upper.children[2]!;
    const lowerHead = lower.children[2]!;
    scene.setPlayback({ laneId: 'upper', activeId: sceneEvents(lesson, 'scene-1', 'upper')[0]!.id, position: 0.4, reducedMotion: false });
    assert.equal(upperHead.visible, true);
    assert.equal(lowerHead.visible, false);
    scene.setPlayback({ laneId: 'lower', activeId: sceneEvents(lesson, 'scene-1', 'lower')[2]!.id, position: 0.6, reducedMotion: false });
    assert.equal(upperHead.visible, false);
    assert.equal(lowerHead.visible, true);
    assert.equal(scene.getSnapshot().playbackLaneId, 'lower');
    scene.setPlayback({ laneId: 'lower', activeId: null, position: 0.8, reducedMotion: true });
    assert.equal(lowerHead.visible, false);
    scene.setPlayback(null);
    assert.equal(upperHead.visible, false);
    assert.equal(lowerHead.visible, false);
    assert.equal(scene.getSnapshot().playbackLaneId, null);
    assert.throws(() => scene.setPlayback({ laneId: 'missing', activeId: null, position: 0, reducedMotion: false }), RangeError);
  } finally { scene.dispose(); }
});

test('dispose releases scene resources once, detaches its group, and makes old callbacks inert', () => {
  const lesson = createLessonState();
  const scene = createLessonScene('scene-1', lesson);
  const parent = new Group();
  parent.add(scene.group);
  const resources = new Set<BufferGeometry | Material>();
  scene.group.traverse((object) => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
    }
  });
  const counts = new Map<BufferGeometry | Material, number>();
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
  const oldMesh = scene.pickTargets[0]!;
  scene.dispose();
  scene.dispose();
  scene.updateLesson(lesson);
  scene.setPlayback({ laneId: 'upper', activeId: null, position: 0.7, reducedMotion: false });
  assert.equal(parent.children.length, 0);
  assert.equal(scene.group.children.length, 0);
  assert.equal(scene.pickTargets.length, 0);
  assert.equal(scene.pickEvent(oldMesh), null);
  assert.equal(scene.getSnapshot().disposed, true);
  assert.equal(scene.getSnapshot().playbackLaneId, null);
  for (const resource of resources) assert.equal(counts.get(resource), 1);
});

test('v3 R3: the printed figure window allows for the raised block tops at the reading pose', async () => {
  const { LESSON_SCENE_SCALE } = await import('../src/book/lessonScene.ts');
  const { LESSON_FIGURE_RAISE_Z } = await import('../src/book/lessonPresentation.ts');
  const { BLOCK_HEIGHT } = await import('../src/scenes/durationWorld.ts');
  const { READING_POSE } = await import('../src/book/render/cameraRig.ts');
  const expected = BLOCK_HEIGHT * LESSON_SCENE_SCALE / Math.tan(READING_POSE.elevationDeg * Math.PI / 180);
  assert.ok(Math.abs(LESSON_FIGURE_RAISE_Z - expected) < 5e-4, `${LESSON_FIGURE_RAISE_Z} vs ${expected}`);
});
