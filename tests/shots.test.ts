import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { balancedAnchor, blendTo, placeRig, projectWithRig, poseBasis, READING_POSE } from '../src/book/render/cameraRig.ts';
import type { FitResult, RigRect, RigViewport } from '../src/book/render/cameraRig.ts';
import { OPEN_ANCHOR, openFramePoints, SCENE_EXTENT, boxCorners } from '../src/book/render/bookFraming.ts';
import { findShot, resolveShot, SHOT_RETURN_MS, shotProgress, SPREAD_SHOTS } from '../src/book/render/shots.ts';
import type { ShotSpec } from '../src/book/render/shots.ts';
import { BOOK_DIMENSIONS as D } from '../src/book/geometry.ts';
import { BOOK_MANIFEST } from '../src/book/manifest.ts';
import { lessonFigureExtent } from '../src/book/lessonPresentation.ts';
import { CLOSE_LOOK_SHOTS } from '../src/content/pages/lessonPages.ts';

/** REFACTOR_PROMPTS_V3 R6-5: the five unit-test viewports, each with the R5 toolbar (52 px) under the book. */
const VIEWPORTS: readonly RigViewport[] = [{ width: 844, height: 390 }, { width: 667, height: 375 }, { width: 568, height: 320 },
  { width: 390, height: 844 }, { width: 360, height: 640 }];
const TOOLBAR = 52;
const safeFor = (viewport: RigViewport): RigRect => ({ left: 0, top: 0, right: viewport.width, bottom: viewport.height - TOOLBAR });

/** The reading pose exactly as the stage fits the open book (balanced anchor, then placeRig). */
function readingFit(viewport: RigViewport, safe: RigRect): FitResult {
  const target = { x: viewport.width / 2, y: viewport.height / 2 };
  const open = balancedAnchor({ points: openFramePoints(), anchor: OPEN_ANCHOR, target, safe, viewport, pose: READING_POSE }, 1.6);
  return placeRig({ anchor: open.anchor, target, safe, viewport, pose: READING_POSE, distance: open.distance, sceneExtent: SCENE_EXTENT });
}

/** A standing figure on the right page's figure window: lanes across the page, its printed depth, block height. */
function figureRegion(spec: ShotSpec): Vector3[] {
  const sceneId = spec.region === 'figure:duration-lanes' ? 'scene-1' : 'scene-2';
  const extent = lessonFigureExtent(sceneId);
  const surface = D.coverThickness + D.totalStackHeight / 2;
  const centre = -D.pageHeight / 2 + (sceneId === 'scene-1' ? 0.42 : 0.34) * D.pageHeight;
  const half = (extent.maxZ - extent.minZ) / 2;
  return boxCorners(new Box3(new Vector3(0.2, surface, centre - half), new Vector3(D.pageWidth - 0.2, surface + 0.38 * 0.224, centre + half)));
}

/** Pinhole projection through the fitted camera (principal point at the viewport centre, as the rig sets it). */
function project(fit: FitResult, point: Vector3, viewport: RigViewport) {
  const view = point.clone().sub(fit.position).applyQuaternion(fit.quaternion.clone().invert());
  if (view.z >= 0) return null;
  const k = 2 * Math.tan(fit.fovDeg * Math.PI / 360) / viewport.height;
  return { x: viewport.width / 2 + view.x / (-view.z * k), y: viewport.height / 2 - view.y / (-view.z * k) };
}

const inside = (point: { x: number; y: number } | null, rect: RigRect, slack = 0.5) => !!point
  && point.x >= rect.left - slack && point.x <= rect.right + slack && point.y >= rect.top - slack && point.y <= rect.bottom + slack;

test('R6 shots: two reader-started shots as designed, each printed on its own spread', () => {
  assert.deepEqual(SPREAD_SHOTS['spread-1'].map(shot => [shot.id, shot.region, shot.pose, shot.margin, shot.duration]),
    [['lanes-close', 'figure:duration-lanes', { elevationDeg: 36, azimuthDeg: -14, fovDeg: 32 }, 0.14, 900]]);
  assert.deepEqual(SPREAD_SHOTS['spread-2'].map(shot => [shot.id, shot.region, shot.pose, shot.margin, shot.duration]),
    [['strip-close', 'figure:duration-strip', { elevationDeg: 34, azimuthDeg: 10, fovDeg: 32 }, 0.14, 900]]);
  // Every printed '가까이 보기' names a shot of its own spread; no shot is left without a button.
  for (const spread of BOOK_MANIFEST) {
    const printed = CLOSE_LOOK_SHOTS[spread.sceneId];
    assert.equal(printed ? findShot(spread.spreadId, printed)?.id : undefined, SPREAD_SHOTS[spread.spreadId][0]?.id, spread.spreadId);
  }
  assert.equal(findShot('spread-1', 'strip-close'), null, 'shots belong to their spread');
  assert.equal(SHOT_RETURN_MS, 600);
});

test('R6 shots: both shots fit at five viewports; the region is framed, the book is not a safe-area target', () => {
  for (const viewport of VIEWPORTS) {
    const safe = safeFor(viewport);
    for (const spec of [SPREAD_SHOTS['spread-1'][0]!, SPREAD_SHOTS['spread-2'][0]!]) {
      const region = figureRegion(spec);
      const fit = resolveShot(spec, region, viewport, safe, SCENE_EXTENT);
      const name = `${spec.id} ${viewport.width}x${viewport.height}`;
      assert.equal(fit.unfittable, 0, name);
      assert.ok(fit.anchorErrorPx < 1e-6, `${name}: region centre on the safe centre`);
      assert.ok(fit.near > 0 && fit.far > fit.distance, name);
      for (const point of region) assert.ok(inside(project(fit, point, viewport), safe), `${name}: region inside the safe area`);
      // Intentional closeness: parts of the book leave the screen during the shot.
      const book = openFramePoints().slice(0, 8);
      assert.ok(book.some(point => !inside(project(fit, point, viewport), safe)), `${name}: the book is not fitted`);
      // The shot is a real move: lower and closer than reading.
      const reading = readingFit(viewport, safe);
      assert.ok(fit.position.distanceTo(reading.position) > 0.5, name);
      assert.ok(fit.position.y < reading.position.y, `${name}: the shot camera is lower than reading`);
      // The rig's own projection agrees with the camera: the region centre sits on the safe centre.
      const centre = new Box3().setFromPoints(region).getCenter(new Vector3());
      const onScreen = projectWithRig(centre, centre, poseBasis(spec.pose), { x: (safe.left + safe.right) / 2, y: (safe.top + safe.bottom) / 2 }, viewport, fit.distance, spec.pose.fovDeg)!;
      const camera = project(fit, centre, viewport)!;
      assert.ok(Math.hypot(onScreen.x - camera.x, onScreen.y - camera.y) < 1e-6, name);
    }
  }
});

test('R6 shots: the return lands on the reading fit result itself (≤ 1e-6), whatever the path', () => {
  for (const viewport of VIEWPORTS) {
    const safe = safeFor(viewport);
    const spec = SPREAD_SHOTS['spread-1'][0]!;
    const reading = readingFit(viewport, safe);
    const shot = resolveShot(spec, figureRegion(spec), viewport, safe, SCENE_EXTENT);
    assert.equal(blendTo(reading, shot, 0), reading, 't = 0 is the reading frame object');
    assert.equal(blendTo(reading, shot, 1), shot);
    // Enter fully, hold, then return over SHOT_RETURN_MS: the last frame is the reading pose exactly.
    const entered = shotProgress('enter', spec.duration, spec);
    assert.equal(entered, 1);
    const frames: number[] = [];
    for (let ms = 0; ms <= SHOT_RETURN_MS + 16; ms += 16) frames.push(shotProgress('return', ms, spec, entered));
    assert.ok(frames.every((value, index) => index === 0 || value <= frames[index - 1]!), 'the return never goes back in');
    const back = blendTo(reading, shot, frames.at(-1)!);
    assert.equal(back, reading);
    assert.ok(back.position.distanceTo(reading.position) <= 1e-6 && back.cameraTarget.distanceTo(reading.cameraTarget) <= 1e-6);
    assert.ok(Math.abs(back.quaternion.angleTo(reading.quaternion)) <= 1e-6 && Math.abs(back.fovDeg - reading.fovDeg) <= 1e-6);
    // A return started halfway in (the reader changed their mind) lands the same way.
    const half = shotProgress('enter', spec.duration / 2, spec);
    assert.ok(half > 0 && half < 1);
    const early = blendTo(reading, shot, shotProgress('return', SHOT_RETURN_MS, spec, half));
    assert.equal(early, reading);
    // In between, the camera eases: position and orientation move monotonically toward the shot.
    const quarter = blendTo(reading, shot, 0.25), threeQuarters = blendTo(reading, shot, 0.75);
    assert.ok(quarter.position.distanceTo(reading.position) < threeQuarters.position.distanceTo(reading.position));
    assert.ok(quarter.quaternion.angleTo(reading.quaternion) < threeQuarters.quaternion.angleTo(reading.quaternion));
  }
});

test('R6 shots: timelines — 900 ms in, 600 ms back, reduced motion cuts', () => {
  const spec = SPREAD_SHOTS['spread-2'][0]!;
  assert.equal(shotProgress('enter', 0, spec), 0);
  assert.equal(shotProgress('enter', 450, spec), 0.5);
  assert.equal(shotProgress('enter', 900, spec), 1);
  assert.equal(shotProgress('return', 300, spec, 1), 0.5);
  assert.equal(shotProgress('return', 600, spec, 1), 0);
  assert.equal(shotProgress('enter', 0, spec, 0, true), 1, 'reduced motion: straight in');
  assert.equal(shotProgress('return', 0, spec, 1, true), 0, 'reduced motion: straight back');
  assert.throws(() => resolveShot(spec, [], VIEWPORTS[0]!, safeFor(VIEWPORTS[0]!), SCENE_EXTENT), /no region points/);
});
