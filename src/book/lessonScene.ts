import * as Three from 'three';
import type { Mesh, Object3D } from 'three';
import { getScene } from '../content/lesson.ts';
import type { MusicEvent, SceneId } from '../content/types.ts';
import { sceneEvents, sceneState } from '../lesson/controller.ts';
import type { LessonState } from '../lesson/controller.ts';
import { BAR_WIDTH, createDurationWorld } from '../scenes/durationWorld.ts';
import { BOOK_DIMENSIONS } from './geometry.ts';
import type { PreparedScene } from './SceneHost.ts';
import { LESSON_LANE_Z } from './lessonPresentation.ts';

export type BookLessonSceneId = SceneId;
export type LessonScenePick = Readonly<{ laneId: string; eventId: string }>;
export type LessonScenePlayback = Readonly<{
  laneId: string;
  activeId: string | null;
  position: number;
  reducedMotion: boolean;
}>;
export type LessonSceneSnapshot = Readonly<{
  sceneId: BookLessonSceneId;
  revision: number;
  disposed: boolean;
  activeLaneId: string;
  selectedEventId: string | null;
  playbackLaneId: string | null;
  lanes: readonly Readonly<{
    laneId: string;
    eventIds: readonly string[];
    /** Coordinates relative to the stage's right-page scene anchor. */
    origin: Readonly<{ x: number; y: number; z: number }>;
    width: number;
    scale: number;
  }>[];
}>;
export interface LessonScene extends PreparedScene {
  readonly sceneId: BookLessonSceneId;
  /** Stable array, updated in place after edits. The stage raycasts these actual meshes. */
  readonly pickTargets: Mesh[];
  updateLesson(lesson: LessonState): void;
  setPlayback(playback: LessonScenePlayback | null): void;
  pickEvent(object: Object3D): LessonScenePick | null;
  getSnapshot(): LessonSceneSnapshot;
}

const INSET_X = 0.2;
const WIDTH = BOOK_DIMENSIONS.pageWidth - INSET_X * 2;
const SCALE = WIDTH / BAR_WIDTH;
// The axes lie -0.03 local units below the blocks; this lift keeps them above the paper.
const PAPER_LIFT = 0.008;
type LaneWorld = {
  laneId: string;
  events: readonly MusicEvent[];
  world: ReturnType<typeof createDurationWorld>;
};

/** Adapts the existing time-axis world to a page, without owning a renderer or audio. */
export function createLessonScene(sceneId: BookLessonSceneId, initialLesson: LessonState): LessonScene {
  const group = new Three.Group();
  group.name = `book-${sceneId}`;
  const pickTargets: Mesh[] = [];
  const picks = new Map<Object3D, LessonScenePick>();
  const lanes: LaneWorld[] = [];
  let lesson = initialLesson;
  let playback: LessonScenePlayback | null = null;
  let disposed = false;
  const guideGeometry = sceneId === 'scene-3' ? new Three.BufferGeometry().setFromPoints([
    new Three.Vector3(INSET_X + WIDTH / 2, PAPER_LIFT, -0.12),
    new Three.Vector3(INSET_X + WIDTH / 2, PAPER_LIFT, 1.22),
  ]) : null;
  const guideMaterial = guideGeometry ? new Three.LineBasicMaterial({ color: 0x8d6534 }) : null;

  function refreshPicks(): void {
    pickTargets.length = 0;
    picks.clear();
    for (const { laneId, world } of lanes) {
      for (const mesh of world.pickTargets) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        pickTargets.push(mesh);
        picks.set(mesh, Object.freeze({ laneId, eventId: String(mesh.userData.eventId) }));
      }
    }
  }

  function refreshHighlights(): void {
    const state = sceneState(lesson, sceneId);
    for (const { laneId, world } of lanes) {
      world.setHighlight(state.activeLaneId === laneId ? state.selectedEventId : null,
        playback?.laneId === laneId ? playback.activeId : null);
      world.setPosition(playback?.laneId === laneId ? playback.position : 0,
        playback?.reducedMotion ?? false);
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    playback = null;
    group.removeFromParent();
    group.clear();
    picks.clear();
    pickTargets.length = 0;
    for (const { world } of lanes) world.dispose();
    guideGeometry?.dispose();
    guideMaterial?.dispose();
  }

  try {
    for (const [index, lane] of getScene(sceneId).lanes.entries()) {
      const events = sceneEvents(initialLesson, sceneId, lane.laneId);
      const world = createDurationWorld(Three, events);
      // Register ownership before any further preparation that could throw.
      lanes.push({ laneId: lane.laneId, events, world });
      world.group.name = `${sceneId}-${lane.laneId}`;
      world.group.scale.setScalar(SCALE);
      world.group.position.set(INSET_X, PAPER_LIFT, LESSON_LANE_Z[sceneId][index]);
      // durationWorld's standalone playhead draws over its own canvas. In the book,
      // all world-owned materials must respect the turning paper's depth buffer.
      world.group.traverse((object) => {
        if (object instanceof Three.Mesh || object instanceof Three.LineSegments) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.depthTest = true;
        }
      });
      group.add(world.group);
    }
    refreshPicks();
    refreshHighlights();
    if (guideGeometry && guideMaterial) {
      const guide = new Three.LineSegments(guideGeometry, guideMaterial);
      guide.name = 'half-duration-target';
      group.add(guide);
    }
    group.updateMatrixWorld(true);
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    sceneId, group, pickTargets, dispose,
    updateLesson(next: LessonState): void {
      if (disposed) return;
      let changedEvents = false;
      for (const lane of lanes) {
        const events = sceneEvents(next, sceneId, lane.laneId);
        if (events !== lane.events) {
          lane.world.setEvents(events);
          lane.events = events;
          changedEvents = true;
        }
      }
      lesson = next;
      if (changedEvents) {
        // Edits invalidate a playback display just as the coordinator stops its audio.
        playback = null;
        refreshPicks();
      }
      refreshHighlights();
      group.updateMatrixWorld(true);
    },
    setPlayback(next: LessonScenePlayback | null): void {
      if (disposed) return;
      if (next && !lanes.some((lane) => lane.laneId === next.laneId)) {
        throw new RangeError(`Unknown lane ${next.laneId} for ${sceneId}.`);
      }
      playback = next ? Object.freeze({ ...next }) : null;
      refreshHighlights();
    },
    pickEvent(object: Object3D): LessonScenePick | null {
      return disposed ? null : picks.get(object) ?? null;
    },
    getSnapshot(): LessonSceneSnapshot {
      const state = sceneState(lesson, sceneId);
      return Object.freeze({
        sceneId, revision: lesson.revision, disposed,
        activeLaneId: state.activeLaneId, selectedEventId: state.selectedEventId,
        playbackLaneId: playback?.laneId ?? null,
        lanes: Object.freeze(lanes.map(({ laneId, events, world }) => Object.freeze({
          laneId, eventIds: Object.freeze(events.map((event) => event.id)),
          origin: Object.freeze({ x: world.group.position.x, y: world.group.position.y, z: world.group.position.z }),
          width: WIDTH, scale: SCALE,
        }))),
      });
    },
  };
}
