import { MathUtils, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';

/**
 * v3 perspective camera rig (REFACTOR_DESIGN_V3 §6 R1, CONTRACT_V3 C5).
 *
 * The view direction is a fixed pose (elevation/azimuth/FOV); only distance and target move.
 * `fit` places a chosen world anchor exactly on a chosen screen pixel and returns the smallest
 * distance at which every given point projects inside the safe rectangle. With a fixed direction
 * the projected offset of each point from the anchor pixel is |n| / (k (d - c)), which decreases
 * monotonically in d, so the minimal distance has a closed form (no iterative search needed).
 */
export type RigPose = Readonly<{ elevationDeg: number; azimuthDeg: number; fovDeg: number }>;
export type RigPoint = Readonly<{ x: number; y: number }>;
export type RigRect = Readonly<{ left: number; top: number; right: number; bottom: number }>;
export type RigViewport = Readonly<{ width: number; height: number }>;

export const READING_POSE: RigPose = Object.freeze({ elevationDeg: 62, azimuthDeg: 0, fovDeg: 30 });
/** v2.1 6-A: the cover and the open spread use the same camera direction. */
export const COVER_POSE: RigPose = READING_POSE;
export const POSE_LIMITS = Object.freeze({ fov: [30, 34] as const, elevation: [52, 62] as const });
export const FIT_MARGIN = 1.018;
/** Points must stay this far in front of the camera (world units) to count as visible. */
export const NEAR_CLEARANCE = 0.25;

export type FitInput = Readonly<{
  points: readonly Vector3[];
  anchor: Vector3;
  target: RigPoint;
  safe: RigRect;
  viewport: RigViewport;
  pose: RigPose;
  margin?: number;
  minimumDistance?: number;
}>;

export type FitResult = Readonly<{
  distance: number;
  position: Vector3;
  cameraTarget: Vector3;
  quaternion: Quaternion;
  fovDeg: number;
  near: number;
  far: number;
  worldPerPixelAtAnchor: number;
  /** Distance from the requested pixel to the projected anchor. Analytically zero. */
  anchorErrorPx: number;
  /** Points that could not be fitted because the target pixel itself lies outside the safe rectangle. */
  unfittable: number;
}>;

export type PoseBasis = Readonly<{ direction: Vector3; right: Vector3; up: Vector3; quaternion: Quaternion }>;

const ORIGIN = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);

/** Unit vector from the looked-at point toward the camera. */
export function poseBasis(pose: RigPose): PoseBasis {
  const elevation = MathUtils.degToRad(pose.elevationDeg);
  const azimuth = MathUtils.degToRad(pose.azimuthDeg);
  const direction = new Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)).normalize();
  const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(direction, ORIGIN, WORLD_UP));
  return { direction, quaternion, right: new Vector3(1, 0, 0).applyQuaternion(quaternion), up: new Vector3(0, 1, 0).applyQuaternion(quaternion) };
}

/** Pixels per radian factor: worldPerPixel(d) = k · d. */
export function pixelSlope(fovDeg: number, viewportHeight: number): number {
  return 2 * Math.tan(MathUtils.degToRad(fovDeg) / 2) / Math.max(1, viewportHeight);
}

export function cameraTargetFor(anchor: Vector3, basis: PoseBasis, target: RigPoint, viewport: RigViewport, distance: number, fovDeg: number): Vector3 {
  const worldPerPixel = pixelSlope(fovDeg, viewport.height) * distance;
  return anchor.clone()
    .addScaledVector(basis.right, -(target.x - viewport.width / 2) * worldPerPixel)
    .addScaledVector(basis.up, (target.y - viewport.height / 2) * worldPerPixel);
}

/** Exact screen position of a world point for a rig at this distance (no camera object needed). */
export function projectWithRig(point: Vector3, anchor: Vector3, basis: PoseBasis, target: RigPoint, viewport: RigViewport,
  distance: number, fovDeg: number): RigPoint | null {
  const k = pixelSlope(fovDeg, viewport.height);
  const relative = point.clone().sub(anchor);
  const depth = distance - relative.dot(basis.direction);
  if (depth <= 1e-9) return null;
  return {
    x: target.x + (relative.dot(basis.right) + (target.x - viewport.width / 2) * k * relative.dot(basis.direction)) / (k * depth),
    y: target.y - (relative.dot(basis.up) - (target.y - viewport.height / 2) * k * relative.dot(basis.direction)) / (k * depth),
  };
}

/** Smallest distance that keeps every point inside `safe`, with the anchor on `target`. */
export function fitDistance(input: FitInput): { distance: number; unfittable: number } {
  const basis = poseBasis(input.pose);
  const k = pixelSlope(input.pose.fovDeg, input.viewport.height);
  const { target, safe, viewport } = input;
  const available = { left: target.x - safe.left, right: safe.right - target.x, top: target.y - safe.top, bottom: safe.bottom - target.y };
  let distance = Math.max(0, input.minimumDistance ?? 0);
  let unfittable = 0;
  const relative = new Vector3();
  for (const point of input.points) {
    relative.copy(point).sub(input.anchor);
    const a = relative.dot(basis.right), b = relative.dot(basis.up), c = relative.dot(basis.direction);
    distance = Math.max(distance, c + NEAR_CLEARANCE);
    // Screen offset from the target pixel is numerator / (k (d - c)).
    const horizontal = a + (target.x - viewport.width / 2) * k * c;
    const vertical = -(b - (target.y - viewport.height / 2) * k * c);
    for (const [numerator, positiveRoom, negativeRoom] of [[horizontal, available.right, available.left], [vertical, available.bottom, available.top]] as const) {
      if (Math.abs(numerator) < 1e-12) continue;
      const room = numerator > 0 ? positiveRoom : negativeRoom;
      if (!(room > 0)) { unfittable += 1; continue; }
      distance = Math.max(distance, c + Math.abs(numerator) / (k * room));
    }
  }
  return { distance: distance * (input.margin ?? FIT_MARGIN), unfittable };
}

export function placeRig(input: Omit<FitInput, 'points'> & Readonly<{ distance: number; sceneExtent: number }>): FitResult {
  const basis = poseBasis(input.pose);
  const cameraTarget = cameraTargetFor(input.anchor, basis, input.target, input.viewport, input.distance, input.pose.fovDeg);
  const position = cameraTarget.clone().addScaledVector(basis.direction, input.distance);
  const projected = projectWithRig(input.anchor, input.anchor, basis, input.target, input.viewport, input.distance, input.pose.fovDeg);
  return {
    distance: input.distance, position, cameraTarget, quaternion: basis.quaternion.clone(), fovDeg: input.pose.fovDeg,
    near: Math.max(0.05, input.distance - input.sceneExtent * 1.25),
    far: input.distance + input.sceneExtent * 2 + 40,
    worldPerPixelAtAnchor: pixelSlope(input.pose.fovDeg, input.viewport.height) * input.distance,
    anchorErrorPx: projected ? Math.hypot(projected.x - input.target.x, projected.y - input.target.y) : Infinity,
    unfittable: 0,
  };
}

export function fitRig(input: FitInput & Readonly<{ sceneExtent: number; distanceScale?: number }>): FitResult {
  const fitted = fitDistance(input);
  const distance = fitted.distance * (input.distanceScale ?? 1);
  return { ...placeRig({ ...input, distance }), unfittable: fitted.unfittable };
}

/**
 * Vertical framing for the open book: slide the anchor along the camera's up axis so the projected
 * bounds sit balanced in the safe rectangle, which minimises the fitted distance (largest book).
 * The distance is quasi-convex in the offset, so a golden-section search converges.
 */
export function balancedAnchor(input: FitInput, range: number, iterations = 32): { anchor: Vector3; distance: number } {
  const basis = poseBasis(input.pose);
  const evaluate = (offset: number) => {
    const anchor = input.anchor.clone().addScaledVector(basis.up, offset);
    return { anchor, distance: fitDistance({ ...input, anchor }).distance };
  };
  let low = -range, high = range;
  const ratio = (Math.sqrt(5) - 1) / 2;
  let x1 = high - ratio * (high - low), x2 = low + ratio * (high - low);
  let f1 = evaluate(x1).distance, f2 = evaluate(x2).distance;
  for (let index = 0; index < iterations; index += 1) {
    if (f1 > f2) { low = x1; x1 = x2; f1 = f2; x2 = low + ratio * (high - low); f2 = evaluate(x2).distance; }
    else { high = x2; x2 = x1; f2 = f1; x1 = high - ratio * (high - low); f1 = evaluate(x1).distance; }
  }
  return evaluate((low + high) / 2);
}

export interface CameraRig {
  readonly camera: PerspectiveCamera;
  apply(result: FitResult, viewport: RigViewport): void;
}

export function createCameraRig(): CameraRig {
  const camera = new PerspectiveCamera(READING_POSE.fovDeg, 16 / 9, 0.1, 100);
  return {
    camera,
    apply(result, viewport) {
      camera.fov = result.fovDeg;
      camera.aspect = Math.max(1, viewport.width) / Math.max(1, viewport.height);
      camera.near = result.near;
      camera.far = result.far;
      camera.position.copy(result.position);
      camera.quaternion.copy(result.quaternion);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    },
  };
}
