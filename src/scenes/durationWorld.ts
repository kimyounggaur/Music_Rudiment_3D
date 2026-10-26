import type { LineSegments, Mesh, OrthographicCamera } from 'three';
import type { DurationEvent } from './DurationScene2D.tsx';

type ThreeApi = typeof import('three');
export type DurationView = 'default' | 'shallow';
export const BAR_WIDTH = 10;
export const BLOCK_HEIGHT = 0.38;
export const BLOCK_DEPTH = 0.9;

export function clampedPosition(position: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(position) ? position : 0));
}

export function durationBounds(event: DurationEvent) {
  const onset = event.onset.n / event.onset.d;
  const duration = event.duration.n / event.duration.d;
  if (!Number.isFinite(onset) || !Number.isFinite(duration) || onset < 0 || duration <= 0) {
    throw new RangeError('3D 시간 좌표에 유효한 시작점과 양의 길이가 필요합니다.');
  }
  return { x: onset * BAR_WIDTH, width: duration * BAR_WIDTH, height: BLOCK_HEIGHT, depth: BLOCK_DEPTH };
}

/** Looking straight along the X centre preserves the duration ratio at both fixed views. */
export function frameDurationCamera(camera: OrthographicCamera, width: number, height: number, view: DurationView) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const frameHeight = Math.max(3.15, (BAR_WIDTH + 1.2) / aspect);
  const frameWidth = frameHeight * aspect;
  camera.left = -frameWidth / 2;
  camera.right = frameWidth / 2;
  camera.top = frameHeight / 2;
  camera.bottom = -frameHeight / 2;
  camera.position.set(BAR_WIDTH / 2, view === 'default' ? 7 : 3.6, view === 'default' ? 8 : 10);
  camera.lookAt(BAR_WIDTH / 2, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

export type EventView = { kind: 'note' | 'rest'; box: Mesh; outline: LineSegments };

/** One unit box and edge geometry serve every duration; selection never reallocates geometry. */
export function createDurationWorld(three: ThreeApi, initialEvents: readonly DurationEvent[]) {
  const group = new three.Group();
  const unitBox = new three.BoxGeometry(1, 1, 1);
  const unitEdges = new three.EdgesGeometry(unitBox);
  const axisGeometry = new three.BufferGeometry().setFromPoints([
    new three.Vector3(0, -0.03, 0.64), new three.Vector3(BAR_WIDTH, -0.03, 0.64),
    ...[0, 0.25, 0.5, 0.75, 1].flatMap((tick) => [
      new three.Vector3(tick * BAR_WIDTH, -0.03, 0.61), new three.Vector3(tick * BAR_WIDTH, -0.03, 0.86),
    ]),
  ]);
  const playheadGeometry = new three.BufferGeometry().setFromPoints([
    new three.Vector3(0, 0, 0.57), new three.Vector3(0, 0.72, 0.57),
    new three.Vector3(0, 0.72, 0.57), new three.Vector3(0, 0.72, -0.57),
  ]);
  const noteMaterials = [0x4a8088, 0xbd8039, 0x9dcfc9].map((color) => new three.MeshLambertMaterial({ color }));
  const noteEdges = [0x244a53, 0x603a12, 0x214d49].map((color) => new three.LineBasicMaterial({ color }));
  const restEdges = [0x526e78, 0x8d4c12, 0x214d49].map((color) => new three.LineDashedMaterial({ color, dashSize: 0.09, gapSize: 0.055 }));
  const pickMaterial = new three.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const axisMaterial = new three.LineBasicMaterial({ color: 0x607d83 });
  const playheadMaterial = new three.LineBasicMaterial({ color: 0xb34d20, depthTest: false });
  const eventGroup = new three.Group();
  const axis = new three.LineSegments(axisGeometry, axisMaterial);
  const playhead = new three.LineSegments(playheadGeometry, playheadMaterial);
  playhead.visible = false;
  playhead.renderOrder = 2;
  group.add(axis, eventGroup, playhead);
  const views = new Map<string, EventView>();
  const pickTargets: Mesh[] = [];
  let selectedId: string | null | undefined;
  let activeId: string | null | undefined;
  let disposed = false;

  function setHighlight(selected: string | null | undefined, active: string | null | undefined) {
    selectedId = selected;
    activeId = active;
    for (const [id, item] of views) {
      const state = id === selectedId ? 1 : id === activeId ? 2 : 0;
      item.box.material = item.kind === 'rest' ? pickMaterial : noteMaterials[state];
      item.outline.material = item.kind === 'rest' ? restEdges[state] : noteEdges[state];
    }
  }

  function setEvents(events: readonly DurationEvent[]) {
    const bounds = events.map((event) => ({ event, bounds: durationBounds(event) }));
    eventGroup.clear();
    views.clear();
    pickTargets.length = 0;
    for (const { event, bounds: size } of bounds) {
      const box = new three.Mesh(unitBox, event.kind === 'rest' ? pickMaterial : noteMaterials[0]);
      box.scale.set(size.width, size.height, size.depth);
      box.position.set(size.x + size.width / 2, size.height / 2, 0);
      box.userData.eventId = event.id;
      box.userData.kind = event.kind;
      const outline = new three.LineSegments(unitEdges, event.kind === 'rest' ? restEdges[0] : noteEdges[0]);
      outline.scale.copy(box.scale);
      outline.position.copy(box.position);
      if (event.kind === 'rest') outline.computeLineDistances();
      eventGroup.add(box, outline);
      views.set(event.id, { kind: event.kind, box, outline });
      pickTargets.push(box);
    }
    setHighlight(selectedId, activeId);
    group.updateMatrixWorld(true);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.clear();
    views.clear();
    pickTargets.length = 0;
    for (const geometry of [unitBox, unitEdges, axisGeometry, playheadGeometry]) geometry.dispose();
    for (const material of [...noteMaterials, ...noteEdges, ...restEdges, pickMaterial, axisMaterial, playheadMaterial]) material.dispose();
  }

  try { setEvents(initialEvents); } catch (error) { dispose(); throw error; }
  return {
    group, views, pickTargets, setEvents, setHighlight, dispose,
    setPosition(position: number, reducedMotion: boolean) {
      const value = clampedPosition(position);
      playhead.position.x = value * BAR_WIDTH;
      playhead.visible = !reducedMotion && value > 0;
    },
  };
}
