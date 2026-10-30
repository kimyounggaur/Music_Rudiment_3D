import { BOOK_MANIFEST, adjacentSpread, spreadIndex } from './manifest.ts';
import type { NavigationDirection, SpreadId } from './manifest.ts';

export type BookPhase = 'bootLoading' | 'introReady' | 'introMoving' | 'coverIdle' | 'opening'
  | 'spreadIdle' | 'preparingTurn' | 'turningForward' | 'turningBack' | 'settling'
  | 'cancelSettling' | 'closing' | 'fallback2D' | 'recoverableError';
export type CameraState = 'loading' | 'intro' | 'settled' | 'reframing' | 'suspended';
export type SceneState = 'unmounted' | 'loading' | 'entering' | 'ready' | 'playing' | 'paused' | 'exiting' | 'disposed';
export type TransportState = 'locked' | 'stopped' | 'starting' | 'playing' | 'paused' | 'unavailable';
export type NavigationSource = 'button' | 'keyboard' | 'drag';
export type BookToken = Readonly<{ bookEpoch: number; navigationToken: number; sceneInstanceId: number }>;
export type PointerSample = Readonly<{ x: number; y: number; time: number; velocity: number }>;
export type TurnGesture = Readonly<{
  id: number;
  pointerId: number;
  corner: 'top' | 'bottom';
  pointerActive: boolean;
  activated: boolean;
  latest: PointerSample;
  releaseDecision: 'commit' | 'cancel' | null;
}>;

export type BookState = BookToken & Readonly<{
  phase: BookPhase;
  camera: CameraState;
  scene: SceneState;
  transport: TransportState;
  transportSessionId: number | null;
  mode: '3d' | '2d';
  reducedMotion: boolean;
  hidden: boolean;
  isOpen: boolean;
  currentSpreadId: SpreadId;
  /** Immutable curriculum prefix; permits the preserved two-spread G1 fixture. */
  spreadCount: number;
  destinationSpreadId: SpreadId | null;
  direction: NavigationDirection | null;
  progress: number;
  pendingIntent: NavigationDirection | null;
  gesture: TurnGesture | null;
  coverComplete: boolean;
  cameraComplete: boolean;
  firstSpreadReady: boolean;
  consumedIntroInputId: number | null;
  error: string | null;
}>;

type WithToken = Readonly<{ token: BookToken }>;
export type BookEvent =
  | (WithToken & Readonly<{ type: 'BOOT_READY'; firstSpreadReady?: boolean }>)
  | Readonly<{ type: 'START_INTRO' }>
  | (WithToken & Readonly<{ type: 'INTRO_SETTLED' }>)
  | Readonly<{ type: 'SKIP_INTRO'; inputId: number }>
  | Readonly<{ type: 'OPEN_BOOK'; inputId: number; spreadId?: SpreadId }>
  | Readonly<{ type: 'RESTORE_CLOSED'; mode: '3d' | '2d'; reducedMotion: boolean }>
  | (WithToken & Readonly<{ type: 'COVER_COMPLETE' | 'CAMERA_COMPLETE' | 'SCENE_READY' | 'SCENE_EXITED' | 'TURN_PREPARED' | 'TURN_COMPLETE' | 'SETTLED' }>)
  | Readonly<{ type: 'NEXT' | 'PREV'; source?: NavigationSource }>
  | (WithToken & Readonly<{ type: 'TURN_PROGRESS'; progress: number }>)
  | Readonly<{ type: 'TURN_DRAG_START'; direction: NavigationDirection; gestureId: number; pointerId: number; corner: 'top' | 'bottom'; sample: PointerSample; surfacesReady: boolean }>
  | (WithToken & Readonly<{ type: 'TURN_DRAG_MOVE'; gestureId: number; sample: PointerSample; progress: number; activated: boolean }>)
  | (WithToken & Readonly<{ type: 'TURN_RELEASE'; gestureId: number; sample: PointerSample; decision: 'commit' | 'cancel' }>)
  | Readonly<{ type: 'TURN_CANCEL'; gestureId?: number }>
  | Readonly<{ type: 'CLOSE_BOOK' | 'HIDE_DOCUMENT' | 'SHOW_DOCUMENT' | 'WEBGL_LOST' | 'USE_2D' | 'RETRY_3D' }>
  | (WithToken & Readonly<{ type: 'LOAD_FAIL'; reason: string }>)
  | Readonly<{ type: 'SET_REDUCED_MOTION'; value: boolean }>
  | (WithToken & Readonly<{ type: 'TRANSPORT_STARTING' | 'TRANSPORT_PAUSED' | 'TRANSPORT_STOPPED' | 'TRANSPORT_UNAVAILABLE' }>)
  | (WithToken & Readonly<{ type: 'TRANSPORT_PLAYING'; sessionId: number }>);

export function createBookState(options: Readonly<{ reducedMotion?: boolean; mode?: '3d' | '2d'; spreadCount?: number }> = {}): BookState {
  const spreadCount = options.spreadCount ?? BOOK_MANIFEST.length;
  if (!Number.isInteger(spreadCount) || spreadCount < 1 || spreadCount > BOOK_MANIFEST.length) throw new RangeError('Invalid supported spread count');
  return {
    phase: 'bootLoading', camera: 'loading', scene: 'unmounted', transport: 'locked', transportSessionId: null,
    mode: options.mode ?? '3d', reducedMotion: options.reducedMotion ?? false, hidden: false, isOpen: false,
    currentSpreadId: 'spread-1', spreadCount, destinationSpreadId: null, direction: null, progress: 0, pendingIntent: null,
    gesture: null, coverComplete: false, cameraComplete: false, firstSpreadReady: false,
    consumedIntroInputId: null, error: null, bookEpoch: 0, navigationToken: 0, sceneInstanceId: 0,
  };
}

export function bookToken(state: BookState): BookToken {
  return { bookEpoch: state.bookEpoch, navigationToken: state.navigationToken, sceneInstanceId: state.sceneInstanceId };
}

export function tokenMatches(state: BookState, token: BookToken): boolean {
  return state.bookEpoch === token.bookEpoch && state.navigationToken === token.navigationToken && state.sceneInstanceId === token.sceneInstanceId;
}

export function bookCanInteract(state: BookState): boolean {
  return !state.hidden && state.isOpen && (state.phase === 'spreadIdle' || state.phase === 'fallback2D')
    && state.camera === 'settled' && ['ready', 'playing', 'paused'].includes(state.scene);
}

const idlePhase = (state: BookState): BookPhase => state.mode === '2d' ? 'fallback2D' : 'spreadIdle';
const stopTransport = (state: BookState): TransportState => state.transport === 'locked' || state.transport === 'unavailable' ? state.transport : 'stopped';
const turning = (state: BookState) => state.phase === 'turningForward' || state.phase === 'turningBack';
const activeTurn = (state: BookState) => state.phase === 'preparingTurn' || turning(state) || state.phase === 'settling' || state.phase === 'cancelSettling';
const validSample = (sample: PointerSample) => [sample.x, sample.y, sample.time, sample.velocity].every(Number.isFinite);
const clampProgress = (progress: number) => Math.max(0, Math.min(1, progress));

function beginNavigation(state: BookState, direction: NavigationDirection): BookState {
  const destination = adjacentSpread(state.currentSpreadId, direction, state.spreadCount);
  if (!destination) return direction === 'prev' && spreadIndex(state.currentSpreadId) === 0 ? beginClose(state) : state;
  return {
    ...state, phase: 'preparingTurn', scene: 'exiting', transport: stopTransport(state), transportSessionId: null,
    destinationSpreadId: destination.spreadId, direction, progress: 0, pendingIntent: null, gesture: null,
    navigationToken: state.navigationToken + 1, error: null,
  };
}

function beginClose(state: BookState): BookState {
  if (!state.isOpen || state.phase === 'closing' || state.hidden) return state;
  return {
    ...state, phase: 'closing', camera: 'reframing', scene: 'exiting', transport: stopTransport(state), transportSessionId: null,
    destinationSpreadId: null, direction: null, progress: 0, pendingIntent: null, gesture: null,
    coverComplete: false, cameraComplete: false, navigationToken: state.navigationToken + 1,
  };
}

function acceptNavigation(state: BookState, direction: NavigationDirection): BookState {
  if (state.gesture?.pointerActive) return state;
  if (bookCanInteract(state)) return beginNavigation(state, direction);
  if (state.hidden || !state.isOpen || state.phase === 'closing' || state.phase === 'recoverableError') return state;
  // Cancellation lands back on the current spread; a committed turn lands on
  // its destination. Guard the pending intent again after that actual landing.
  // An impossible last-page NEXT must not overwrite a previously valid PREV.
  const after = state.phase === 'cancelSettling' ? state.currentSpreadId : state.destinationSpreadId ?? state.currentSpreadId;
  const valid = adjacentSpread(after, direction, state.spreadCount) || direction === 'prev' && spreadIndex(after, state.spreadCount) === 0;
  return valid && (activeTurn(state) || state.scene === 'entering') ? { ...state, pendingIntent: direction } : state;
}

function completeCoverBarrier(state: BookState): BookState {
  if (!state.coverComplete || !state.cameraComplete) return state;
  if (state.phase === 'opening') return {
    ...state, phase: idlePhase(state), isOpen: true, camera: 'settled', scene: 'entering', progress: 0,
    sceneInstanceId: state.sceneInstanceId + 1,
  };
  if (state.phase === 'closing' && state.scene === 'disposed') return {
    ...state, phase: 'coverIdle', isOpen: false, camera: 'settled', scene: 'unmounted', progress: 0,
    sceneInstanceId: state.sceneInstanceId + 1,
  };
  return state;
}

function cancelTurn(state: BookState): BookState {
  if (!activeTurn(state) || state.phase === 'cancelSettling') return state;
  return {
    ...state, phase: 'cancelSettling', pendingIntent: null, transport: stopTransport(state), transportSessionId: null,
    navigationToken: state.navigationToken + 1,
    gesture: state.gesture ? { ...state.gesture, pointerActive: false, releaseDecision: 'cancel' } : null,
  };
}

function stableRecovery(state: BookState, mode: '3d' | '2d', hidden: boolean): BookState {
  return {
    ...state, mode, hidden, phase: mode === '2d' ? 'fallback2D' : state.isOpen ? 'spreadIdle' : 'coverIdle',
    // Recovery replaces the scene owner. Keep learning input blocked until the
    // new owner has prepared/entered and acknowledges this fresh token.
    camera: hidden ? 'suspended' : 'settled', scene: state.isOpen ? 'entering' : 'unmounted',
    transport: stopTransport(state), transportSessionId: null, destinationSpreadId: null, direction: null,
    progress: 0, pendingIntent: null, gesture: null, coverComplete: true, cameraComplete: !hidden,
    bookEpoch: state.bookEpoch + 1, navigationToken: state.navigationToken + 1, sceneInstanceId: state.sceneInstanceId + 1,
  };
}

/** Pure coordination only. Callers own RAF/timers, snapshots, AbortControllers and actual audio stop/disposal. */
export function bookReducer(state: BookState, event: BookEvent): BookState {
  if ('token' in event && !tokenMatches(state, event.token)) return state;
  switch (event.type) {
    case 'BOOT_READY': {
      if (state.phase !== 'bootLoading') return state;
      const firstSpreadReady = event.firstSpreadReady ?? true;
      if (state.isOpen) return { ...state, firstSpreadReady, phase: idlePhase(state), camera: state.hidden ? 'suspended' : 'settled', scene: 'entering', sceneInstanceId: state.sceneInstanceId + 1 };
      const skipMotion = state.hidden || state.reducedMotion || state.mode === '2d';
      return { ...state, firstSpreadReady, phase: skipMotion ? 'coverIdle' : 'introReady', camera: state.hidden ? 'suspended' : skipMotion ? 'settled' : 'intro', error: null };
    }
    case 'START_INTRO':
      return state.phase === 'introReady' && !state.hidden ? { ...state, phase: 'introMoving', camera: 'intro' } : state;
    case 'INTRO_SETTLED':
      return state.phase === 'introReady' || state.phase === 'introMoving' ? { ...state, phase: 'coverIdle', camera: 'settled' } : state;
    case 'SKIP_INTRO':
      return state.phase === 'introReady' || state.phase === 'introMoving' ? { ...state, phase: 'coverIdle', camera: 'settled', consumedIntroInputId: event.inputId } : state;
    case 'OPEN_BOOK':
      if (state.hidden || state.isOpen || !(state.phase === 'coverIdle' || state.phase === 'fallback2D') || state.camera !== 'settled'
        || !state.firstSpreadReady || event.inputId === state.consumedIntroInputId || spreadIndex(event.spreadId ?? state.currentSpreadId, state.spreadCount) < 0) return state;
      return { ...state, phase: 'opening', camera: 'reframing', scene: 'unmounted', coverComplete: false, cameraComplete: false,
        currentSpreadId: event.spreadId ?? state.currentSpreadId,
        navigationToken: state.navigationToken + 1, consumedIntroInputId: null, error: null };
    case 'RESTORE_CLOSED':
      return { ...createBookState({ mode: event.mode, reducedMotion: event.reducedMotion, spreadCount: state.spreadCount }), hidden: state.hidden,
        bookEpoch: state.bookEpoch + 1, navigationToken: state.navigationToken + 1, sceneInstanceId: state.sceneInstanceId + 1 };
    case 'COVER_COMPLETE':
      return state.phase === 'opening' || state.phase === 'closing' ? completeCoverBarrier({ ...state, coverComplete: true }) : state;
    case 'CAMERA_COMPLETE':
      return state.phase === 'opening' || state.phase === 'closing' ? completeCoverBarrier({ ...state, cameraComplete: true }) : state;
    case 'SCENE_EXITED':
      return state.phase === 'closing' ? completeCoverBarrier({ ...state, scene: 'disposed' }) : state;
    case 'SCENE_READY': {
      if (!state.isOpen || state.scene !== 'entering' || state.hidden) return state;
      const ready = { ...state, scene: 'ready' as const };
      return ready.pendingIntent ? beginNavigation({ ...ready, pendingIntent: null }, ready.pendingIntent) : ready;
    }
    case 'NEXT': return acceptNavigation(state, 'next');
    case 'PREV': return acceptNavigation(state, 'prev');
    case 'TURN_PREPARED':
      if (state.phase !== 'preparingTurn') return state;
      return { ...state, scene: 'disposed', phase: state.gesture?.releaseDecision === 'commit' ? 'settling' : state.direction === 'next' ? 'turningForward' : 'turningBack' };
    case 'TURN_PROGRESS':
      return (turning(state) || state.phase === 'settling' || state.phase === 'cancelSettling') && !state.gesture?.pointerActive && Number.isFinite(event.progress)
        ? { ...state, progress: clampProgress(event.progress) } : state;
    case 'TURN_COMPLETE':
      // A held direct gesture never auto-completes, even at p=1.
      return turning(state) && !state.gesture?.pointerActive ? { ...state, phase: 'settling', progress: 1 } : state;
    case 'SETTLED': {
      if (state.phase !== 'settling' && state.phase !== 'cancelSettling') return state;
      const destination = state.phase === 'settling' ? state.destinationSpreadId : state.currentSpreadId;
      if (!destination) return state;
      return { ...state, phase: idlePhase(state), currentSpreadId: destination, destinationSpreadId: null,
        direction: null, progress: 0, gesture: null, scene: 'entering', sceneInstanceId: state.sceneInstanceId + 1 };
    }
    case 'TURN_DRAG_START': {
      if (!bookCanInteract(state) || !event.surfacesReady || !validSample(event.sample) || !adjacentSpread(state.currentSpreadId, event.direction, state.spreadCount)) return state;
      const navigating = beginNavigation(state, event.direction);
      return { ...navigating, gesture: { id: event.gestureId, pointerId: event.pointerId, corner: event.corner,
        pointerActive: true, activated: false, latest: { ...event.sample }, releaseDecision: null } };
    }
    case 'TURN_DRAG_MOVE': {
      const gesture = state.gesture;
      if (!gesture || gesture.id !== event.gestureId || !gesture.pointerActive || !(state.phase === 'preparingTurn' || turning(state)) || !validSample(event.sample) || !Number.isFinite(event.progress)) return state;
      return { ...state, progress: clampProgress(event.progress), gesture: { ...gesture, activated: gesture.activated || event.activated, latest: { ...event.sample } } };
    }
    case 'TURN_RELEASE': {
      const gesture = state.gesture;
      if (!gesture || gesture.id !== event.gestureId || !gesture.pointerActive || !(state.phase === 'preparingTurn' || turning(state)) || !validSample(event.sample)) return state;
      const decision = gesture.activated ? event.decision : 'cancel';
      const released = { ...state, gesture: { ...gesture, pointerActive: false, latest: { ...event.sample }, releaseDecision: decision } };
      return decision === 'cancel' ? cancelTurn(released) : state.phase === 'preparingTurn' ? released : { ...released, phase: 'settling' };
    }
    case 'TURN_CANCEL':
      return state.gesture && (event.gestureId === undefined || state.gesture.id === event.gestureId) ? cancelTurn(state) : state;
    case 'CLOSE_BOOK': return beginClose(state);
    case 'HIDE_DOCUMENT': {
      if (state.hidden) return state;
      const recovered = stableRecovery(state, state.mode, true);
      // Keep the bootstrap phase: the runtime restarts preparation for this new
      // epoch, and its new BOOT_READY remains admissible after visibility resumes.
      return state.phase === 'bootLoading' ? { ...recovered, phase: 'bootLoading', scene: state.isOpen ? 'loading' : 'unmounted' } : recovered;
    }
    case 'SHOW_DOCUMENT':
      return state.hidden ? { ...state, hidden: false, camera: state.phase === 'bootLoading' ? 'loading' : 'settled', cameraComplete: state.phase !== 'bootLoading' } : state;
    case 'WEBGL_LOST':
    case 'USE_2D':
      return { ...stableRecovery(state, '2d', state.hidden), firstSpreadReady: true, error: event.type === 'WEBGL_LOST' ? 'webgl-context-lost' : null };
    case 'RETRY_3D':
      return { ...stableRecovery(state, '3d', state.hidden), phase: 'bootLoading', camera: 'loading', scene: state.isOpen ? 'loading' : 'unmounted', firstSpreadReady: false, error: null };
    case 'LOAD_FAIL':
      return { ...stableRecovery(state, state.mode, state.hidden), phase: 'recoverableError', scene: 'disposed', error: event.reason };
    case 'SET_REDUCED_MOTION': return { ...state, reducedMotion: event.value };
    case 'TRANSPORT_STARTING':
      return bookCanInteract(state) && (state.scene === 'ready' || state.scene === 'paused') && state.transport !== 'unavailable'
        ? { ...state, transport: 'starting', transportSessionId: state.transport === 'paused' ? state.transportSessionId : null } : state;
    case 'TRANSPORT_PLAYING':
      return bookCanInteract(state) && state.transport === 'starting' && Number.isSafeInteger(event.sessionId) && event.sessionId > 0
        && (state.transportSessionId === null || state.transportSessionId === event.sessionId)
        ? { ...state, transport: 'playing', scene: 'playing', transportSessionId: event.sessionId } : state;
    case 'TRANSPORT_PAUSED':
      return bookCanInteract(state) && state.transport === 'playing' ? { ...state, transport: 'paused', scene: 'paused' } : state;
    case 'TRANSPORT_STOPPED':
      return { ...state, transport: 'stopped', transportSessionId: null, scene: state.scene === 'playing' || state.scene === 'paused' ? 'ready' : state.scene };
    case 'TRANSPORT_UNAVAILABLE':
      return { ...state, transport: 'unavailable', transportSessionId: null, scene: state.scene === 'playing' || state.scene === 'paused' ? 'ready' : state.scene };
  }
}
