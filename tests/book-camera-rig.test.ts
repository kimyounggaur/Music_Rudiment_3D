import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import {
  balancedAnchor, COVER_POSE, createCameraRig, fitDistance, fitRig, POSE_LIMITS, placeRig, poseBasis, projectWithRig, READING_POSE,
} from '../src/book/render/cameraRig.ts';
import type { RigRect, RigViewport } from '../src/book/render/cameraRig.ts';
import { CLOSED_ANCHOR, closedFramePoints, OPEN_ANCHOR, openFramePoints, SCENE_EXTENT } from '../src/book/render/bookFraming.ts';

const viewports: RigViewport[] = [
  { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 568, height: 320 },
  { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 1280, height: 720 },
];
const insets = [{ left: 0, right: 0, top: 0, bottom: 0 }, { left: 44, right: 0, top: 0, bottom: 34 }];
const safeFor = (viewport: RigViewport, inset: typeof insets[number]): RigRect => ({
  left: 12 + inset.left, top: 12 + inset.top, right: viewport.width - 12 - inset.right, bottom: viewport.height - 12 - inset.bottom,
});
const center = (viewport: RigViewport) => ({ x: viewport.width / 2, y: viewport.height / 2 });

function project(points: readonly Vector3[], anchor: Vector3, viewport: RigViewport, distance: number) {
  const basis = poseBasis(READING_POSE);
  return points.map(point => projectWithRig(point, anchor, basis, center(viewport), viewport, distance, READING_POSE.fovDeg));
}

function inside(point: { x: number; y: number } | null, safe: RigRect, tolerance = 1e-6) {
  return !!point && point.x >= safe.left - tolerance && point.x <= safe.right + tolerance
    && point.y >= safe.top - tolerance && point.y <= safe.bottom + tolerance;
}

test('v3 pose is perspective within the amended FOV and elevation range; cover and spread share it', () => {
  assert.ok(READING_POSE.fovDeg >= POSE_LIMITS.fov[0] && READING_POSE.fovDeg <= POSE_LIMITS.fov[1]);
  assert.ok(READING_POSE.elevationDeg >= POSE_LIMITS.elevation[0] && READING_POSE.elevationDeg <= POSE_LIMITS.elevation[1]);
  assert.equal(COVER_POSE, READING_POSE);
  const rig = createCameraRig();
  assert.equal(rig.camera.type, 'PerspectiveCamera');
  const basis = poseBasis(READING_POSE);
  // The camera sits on the reader's side (+z) above the desk, looking down toward the far (top) edge.
  assert.ok(basis.direction.y > 0.8 && basis.direction.z > 0.4);
  assert.ok(Math.abs(basis.right.dot(basis.up)) < 1e-12 && Math.abs(basis.right.dot(basis.direction)) < 1e-12);
});

test('closed cover: the UV centre lands on the viewport centre and the whole book stays in the safe area', () => {
  const points = closedFramePoints();
  for (const viewport of viewports) for (const inset of insets) {
    const safe = safeFor(viewport, inset);
    const { distance, unfittable } = fitDistance({ points, anchor: CLOSED_ANCHOR, target: center(viewport), safe, viewport, pose: READING_POSE });
    assert.equal(unfittable, 0);
    const placed = placeRig({ anchor: CLOSED_ANCHOR, target: center(viewport), safe, viewport, pose: READING_POSE, distance, sceneExtent: SCENE_EXTENT });
    assert.ok(placed.anchorErrorPx <= 0.5, `${viewport.width}x${viewport.height} anchor ${placed.anchorErrorPx}`);
    assert.ok(project(points, CLOSED_ANCHOR, viewport, distance).every(point => inside(point, safe)), `${viewport.width}x${viewport.height}`);
    assert.ok(placed.near > 0 && placed.near < placed.far);
  }
});

test('the closed-form fit is the minimal distance (a 1% closer camera crops the book)', () => {
  const points = closedFramePoints();
  for (const viewport of viewports) {
    const safe = safeFor(viewport, insets[0]);
    const { distance } = fitDistance({ points, anchor: CLOSED_ANCHOR, target: center(viewport), safe, viewport, pose: READING_POSE, margin: 1 });
    assert.ok(project(points, CLOSED_ANCHOR, viewport, distance).every(point => inside(point, safe, 1e-6)));
    assert.ok(!project(points, CLOSED_ANCHOR, viewport, distance * 0.99).every(point => inside(point, safe)));
  }
});

test('open spread: every turn pose (25/50/75%) stays inside the safe rectangle after balanced framing', () => {
  const points = openFramePoints();
  for (const viewport of viewports) for (const inset of insets) {
    const safe = safeFor(viewport, inset);
    const framed = balancedAnchor({ points, anchor: OPEN_ANCHOR, target: center(viewport), safe, viewport, pose: READING_POSE }, 1.6);
    const result = fitRig({ points, anchor: framed.anchor, target: center(viewport), safe, viewport, pose: READING_POSE, sceneExtent: SCENE_EXTENT });
    assert.equal(result.unfittable, 0);
    assert.ok(Math.abs(result.distance - framed.distance) < 1e-9);
    assert.ok(result.anchorErrorPx <= 0.5);
    const projected = project(points, framed.anchor, viewport, result.distance);
    assert.ok(projected.every(point => inside(point, safe)), `${viewport.width}x${viewport.height}`);
    // Balancing never frames worse than the unshifted spine anchor.
    const plain = fitDistance({ points, anchor: OPEN_ANCHOR, target: center(viewport), safe, viewport, pose: READING_POSE });
    assert.ok(framed.distance <= plain.distance + 1e-9);
  }
});

test('perspective foreshortening: the far page edge projects narrower than the near edge', () => {
  const viewport = { width: 1280, height: 720 };
  const safe = safeFor(viewport, insets[0]);
  const points = openFramePoints();
  const framed = balancedAnchor({ points, anchor: OPEN_ANCHOR, target: center(viewport), safe, viewport, pose: READING_POSE }, 1.6);
  const y = 0.075 + 0.19;
  const [farLeft, farRight, nearLeft, nearRight] = project([
    new Vector3(-2.64, y, -1.94), new Vector3(2.64, y, -1.94), new Vector3(-2.64, y, 1.94), new Vector3(2.64, y, 1.94),
  ], framed.anchor, viewport, framed.distance);
  const far = farRight!.x - farLeft!.x, near = nearRight!.x - nearLeft!.x;
  assert.ok(far / near > 0.8 && far / near < 0.95, `far/near ${far / near}`);
});

test('the rig camera reproduces the analytic projection exactly', () => {
  const viewport = { width: 844, height: 390 };
  const safe = safeFor(viewport, insets[1]);
  const points = closedFramePoints();
  const result = fitRig({ points, anchor: CLOSED_ANCHOR, target: center(viewport), safe, viewport, pose: READING_POSE, sceneExtent: SCENE_EXTENT });
  const rig = createCameraRig();
  rig.apply(result, viewport);
  const analytic = project(points, CLOSED_ANCHOR, viewport, result.distance);
  points.forEach((point, index) => {
    const ndc = point.clone().project(rig.camera);
    const x = (ndc.x + 1) / 2 * viewport.width, y = (1 - ndc.y) / 2 * viewport.height;
    assert.ok(Math.hypot(x - analytic[index]!.x, y - analytic[index]!.y) < 1e-6);
  });
  const anchor = CLOSED_ANCHOR.clone().project(rig.camera);
  assert.ok(Math.hypot((anchor.x + 1) / 2 * viewport.width - viewport.width / 2, (1 - anchor.y) / 2 * viewport.height - viewport.height / 2) < 0.5);
});

test('a target outside the safe rectangle is reported instead of producing a negative distance', () => {
  const viewport = { width: 400, height: 300 };
  const fitted = fitDistance({ points: closedFramePoints(), anchor: CLOSED_ANCHOR, target: { x: 5, y: 150 },
    safe: { left: 12, top: 12, right: 388, bottom: 288 }, viewport, pose: READING_POSE });
  assert.ok(fitted.unfittable > 0);
  assert.ok(fitted.distance > 0 && Number.isFinite(fitted.distance));
});
