import { Box3, Vector3 } from 'three';
import type { PageId, SpreadId } from '../manifest.ts';
import { fitRig } from './cameraRig.ts';
import type { FitResult, RigPose, RigRect, RigViewport } from './cameraRig.ts';

/**
 * v3 R6 lesson camera shots (REFACTOR_DESIGN_V3 §6 R6, CONTRACT_V3 C4, decision 5).
 *
 * A shot is a region plus a viewing angle, never an absolute camera: the region's world points go
 * through the same rig fitter as the reading pose, so every viewport gets its own camera. The
 * reader starts a shot (the printed '가까이 보기'); it ends on the same button, Escape, any
 * navigation, a drag, closing or hiding, and always lands back on the reading pose itself.
 */
export type UvRect = Readonly<{ u0: number; v0: number; u1: number; v1: number }>;
export type ShotRegion = Readonly<{ pageId: PageId; rect: UvRect }> | 'figure:duration-lanes' | 'figure:duration-strip';
export type ShotSpec = Readonly<{
  id: string;
  region: ShotRegion;
  /** Viewing angle for the shot (lower and turned compared with the 62° reading pose). */
  pose: RigPose;
  /** Extra room around the region: the fitted distance is multiplied by 1 + margin. */
  margin: number;
  /** Entry time in ms (the return takes SHOT_RETURN_MS). */
  duration: number;
  holdMs?: number;
}>;

/** Back to the reading pose (design: returnToReading(600)). */
export const SHOT_RETURN_MS = 600;

const shot = (spec: ShotSpec): ShotSpec => Object.freeze({ ...spec, pose: Object.freeze({ ...spec.pose }) });
export const SPREAD_SHOTS: Readonly<Record<SpreadId, readonly ShotSpec[]>> = Object.freeze({
  'spread-1': Object.freeze([shot({ id: 'lanes-close', region: 'figure:duration-lanes', pose: { elevationDeg: 36, azimuthDeg: -14, fovDeg: 32 }, margin: 0.14, duration: 900 })]),
  'spread-2': Object.freeze([shot({ id: 'strip-close', region: 'figure:duration-strip', pose: { elevationDeg: 34, azimuthDeg: 10, fovDeg: 32 }, margin: 0.14, duration: 900 })]),
  'spread-3': Object.freeze([]),
  'spread-4': Object.freeze([]),
  'spread-5': Object.freeze([]),
  'spread-6': Object.freeze([]),
});

export function findShot(spreadId: SpreadId, shotId: string): ShotSpec | null {
  return SPREAD_SHOTS[spreadId]?.find(item => item.id === shotId) ?? null;
}

/** Shot camera: the region's world points fitted with the shot's pose around the region's centre. */
export function resolveShot(spec: ShotSpec, points: readonly Vector3[], viewport: RigViewport, safe: RigRect, sceneExtent: number): FitResult {
  if (!points.length) throw new RangeError(`Shot ${spec.id} has no region points.`);
  const anchor = new Box3().setFromPoints([...points]).getCenter(new Vector3());
  const target = { x: (safe.left + safe.right) / 2, y: (safe.top + safe.bottom) / 2 };
  return fitRig({ points, anchor, target, safe, viewport, pose: spec.pose, margin: 1 + spec.margin, sceneExtent });
}

/** Where a shot is on its own timeline: entering (0 → 1 over `duration`) or returning (1 → 0 over SHOT_RETURN_MS). */
export function shotProgress(phase: 'enter' | 'return', elapsedMs: number, spec: ShotSpec, from = phase === 'enter' ? 0 : 1, reducedMotion = false): number {
  const to = phase === 'enter' ? 1 : 0;
  const duration = reducedMotion ? 0 : phase === 'enter' ? spec.duration : SHOT_RETURN_MS;
  if (duration <= 0 || elapsedMs >= duration) return to;
  const t = Math.max(0, elapsedMs) / duration;
  return from + (to - from) * t;
}
