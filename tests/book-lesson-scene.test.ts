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
      assert.equal(mesh.visible, false, 'v3 R4: picking uses invisible boxes at the standing position');
      assert.ok(scene.pickEvent(mesh));
    }
    // v3 R4: the visible solids are the lanes' paper fills; they cast and receive shadows once standing.
    const fills: Mesh[] = [];
    scene.group.traverse((object) => { if (object instanceof Mesh && object.name.endsWith('-fill') && object.geometry.index?.count) fills.push(object); });
    assert.ok(fills.length >= 2);
    for (const fill of fills) { assert.equal(fill.castShadow, true); assert.equal(fill.receiveShadow, true); }
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
    const upperHead = upper.getObjectByName('duration-playhead')!;
    const lowerHead = lower.getObjectByName('duration-playhead')!;
    assert.ok(upperHead && lowerHead && upperHead !== lowerHead);
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

test('v3 R4: the stage drives lift and reveal through the group; lanes reveal in order with the stagger', async () => {
  const { figureControlsOf } = await import('../src/book/figures/figure.ts');
  const { staggeredReveal } = await import('../src/book/lessonScene.ts');
  const { BOOK_MOTION } = await import('../src/book/motion.ts');
  const scene = createLessonScene('scene-3', reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-3' }));
  try {
    const controls = figureControlsOf(scene.group);
    assert.equal(controls, scene.figure);
    controls!.setLift(0);
    controls!.setReveal(0.3);
    const snapshot = scene.getSnapshot();
    assert.equal(snapshot.lift, 0);
    assert.equal(snapshot.reveal, 0.3);
    const lanes = scene.group.children.filter((child) => child.name.startsWith('scene-3-')) as Group[];
    assert.equal(lanes.length, 3);
    const guide = scene.group.getObjectByName('half-duration-target');
    assert.ok(guide, 'the half target is drawn in ink');
    // Items: three lanes then the guide; each starts `stagger` ms after the previous one.
    const count = 4;
    const reveals = [0, 1, 2, 3].map((index) => staggeredReveal(0.3, index, count));
    for (let index = 1; index < count; index += 1) assert.ok(reveals[index]! < reveals[index - 1]!, 'later figures are drawn later');
    assert.equal(staggeredReveal(1, count - 1, count), 1, 'everything is drawn at the end of the reveal');
    assert.equal(staggeredReveal(BOOK_MOTION.stagger / BOOK_MOTION.reveal, 1, count), 0, 'the second figure waits one stagger');
    const stats = controls!.stats();
    assert.ok(stats.segments > 0 && stats.segments <= 6000, `scene budget: ${stats.segments} segments`);
    controls!.setResolution(1280, 720);
  } finally { scene.dispose(); }
});

test('v3 R4: every figure, with its decor, fits the printed figure window at the reading pose', async () => {
  const { lessonFigureExtent, LESSON_FIGURE_LAYOUT, LESSON_FIGURE_RAISE_PER_HEIGHT } = await import('../src/book/lessonPresentation.ts');
  const { LESSON_SCENE_SCALE } = await import('../src/book/lessonScene.ts');
  const { READING_POSE } = await import('../src/book/render/cameraRig.ts');
  const { LESSON_PAGE_SPECS } = await import('../src/content/pages/lessonPages.ts');
  assert.ok(Math.abs(LESSON_FIGURE_RAISE_PER_HEIGHT - 1 / Math.tan(READING_POSE.elevationDeg * Math.PI / 180)) < 5e-4);
  assert.ok(Math.abs(LESSON_FIGURE_LAYOUT.scale - LESSON_SCENE_SCALE) < 1e-9);
  for (const sceneId of ['scene-1', 'scene-2', 'scene-3', 'scene-4', 'scene-5', 'scene-6'] as const) {
    const page = [...LESSON_PAGE_SPECS.values()].find((spec) => spec.blocks.some((block) => block.kind === 'figure' && block.figureId === `${sceneId}-lanes`))!;
    const block = page.blocks.find((item) => item.kind === 'figure')! as Readonly<{ height: number }>;
    const windowHeight = block.height * BOOK_DIMENSIONS.pageHeight;
    const extent = lessonFigureExtent(sceneId);
    assert.ok(extent.maxZ - extent.minZ <= windowHeight, `${sceneId}: figure ${(extent.maxZ - extent.minZ).toFixed(3)} > window ${windowHeight.toFixed(3)}`);
    // The scene's actual geometry stays inside the visual extent (the raise only moves tops up on screen).
    const scene = createLessonScene(sceneId, reduceLesson(createLessonState(), { type: 'navigate', sceneId }));
    try {
      scene.group.updateMatrixWorld(true);
      const bounds = new Box3();
      scene.group.traverse((object) => {
        if (!(object instanceof Mesh) || !object.visible) return;
        const geometry = object.geometry as BufferGeometry;
        const start = geometry.getAttribute('instanceStart');
        if (start) {
          for (let index = 0; index < (geometry as unknown as { instanceCount: number }).instanceCount; index += 1) bounds.expandByPoint(new Vector3().fromBufferAttribute(start, index).applyMatrix4(object.matrixWorld));
        } else if (geometry.getAttribute('position') && object.name.endsWith('-fill')) bounds.union(new Box3().setFromObject(object));
      });
      assert.ok(bounds.min.z >= extent.minZ - 1e-6 && bounds.max.z <= extent.maxZ + 0.005, `${sceneId}: drawn ${bounds.min.z.toFixed(3)}..${bounds.max.z.toFixed(3)} outside ${extent.minZ.toFixed(3)}..${extent.maxZ.toFixed(3)}`);
    } finally { scene.dispose(); }
  }
});

test('v3 R4: on a curved page every block stands on the paper under it and flat ink lies on it', () => {
  const paper = (x: number) => 0.05 * Math.sin(Math.PI * x / BOOK_DIMENSIONS.pageWidth);
  const scene = createLessonScene('scene-2', reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-2' }), { paper });
  try {
    scene.group.updateMatrixWorld(true);
    const lane = scene.group.children[0] as Group;
    const fill = lane.getObjectByName('duration-fill') as Mesh;
    const position = fill.geometry.getAttribute('position');
    const point = new Vector3();
    let base = 0, top = 0;
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(fill.matrixWorld);
      const above = point.y - 0.008 - paper(point.x);
      if (Math.abs(above) < 1e-4) base += 1;
      else if (Math.abs(above - 0.38 * (scene.getSnapshot().lanes[0]!.scale)) < 1e-4) top += 1;
      else assert.fail(`vertex ${index} is ${above} above the paper`);
    }
    assert.ok(base > 0 && top > 0);
  } finally { scene.dispose(); }
});
