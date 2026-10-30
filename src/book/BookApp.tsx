import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { bookCanInteract, bookReducer, bookToken, createBookState, tokenMatches } from './controller.ts';
import type { BookEvent, BookState, BookToken } from './controller.ts';
import { findShot, shotProgress, SPREAD_SHOTS } from './render/shots.ts';
import type { ShotSpec } from './render/shots.ts';
import { BOOK_MOTION, tween } from './motion.ts';
import type { BookStage, StageLayout, StageUpdate } from './stage.ts';
import type { StageFlap } from './render/flaps.ts';
import { pageStyle } from './pageProjection.ts';
import { BOOK_MANIFEST, BOOK_SPREADS, bookIndex, bookLeaves, bookSpread, bookTurnPrintIds, goToFrame, goToSchedule, leafProgresses } from './manifest.ts';
import type { PageId, SpreadId } from './manifest.ts';
import { arrowNavigationDirection, createTurnDrag, turnReleaseDecision, updateTurnDrag } from './gesture.ts';
import type { TurnDragState } from './gesture.ts';
import { turnCornerAtPoint, turnCornerRegion, turnInputAvailability, turnTargetOwnsInput } from './turnHit.ts';
import { lessonFigureExtent } from './lessonPresentation.ts';
import { FIGURE_ENTRY_MS, figureEntryFrame, inverseSmoothStep } from './figures/choreography.ts';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { SceneHost } from './SceneHost.ts';
import { reduceLesson, sceneState } from '../lesson/controller.ts';
import type { LessonCommand, LessonState } from '../lesson/controller.ts';
import type { LessonScene } from './lessonScene.ts';
import { LessonLeftPage, LessonRightPage } from './LessonPages.tsx';
import { useBookAudio } from './useBookAudio.ts';
import type { PlaybackSnapshot } from '../audio/AudioEngine.ts';
import { usePageCompositor } from './print/usePageCompositor.ts';
import type { PageSurface } from './print/pageCompositor.ts';
import { AccessibleMirror } from './print/AccessibleMirror.tsx';
import type { MirrorPage } from './print/AccessibleMirror.tsx';
import { hitTest, PAGE_LOGICAL } from './print/pageLayout.ts';
import type { PageHotspot } from './print/pageLayout.ts';
import type { PageInteraction } from './print/hotspots.ts';
import type { HotspotCommand, PagePlayback, PageUiState } from './print/pageSpec.ts';
import { MatterPage } from './MatterPages.tsx';
import { pageSpecFor } from '../content/pages/index.ts';
import { loadInitialBookProgress, supportsStoredSpread, useBookProgress } from './useBookProgress.ts';
import { Toolbar } from './ui/Toolbar.tsx';
import { RecordsDialog } from './ui/RecordsDialog.tsx';
import { lessonPageNumber } from './lessonPresentation.ts';
import { currentProfile } from './profile.ts';
import type { BookPreferences } from './useBookProgress.ts';
import { useBookSfx } from './sfx/useBookSfx.ts';
import { PAGE_TEXT } from '../content/pages/pageText.ts';

/** A pointer on a printed page of the committed spread (logical page units, origin top-left). */
type PageHit = Readonly<{ pageId: PageId; side: 'left' | 'right'; x: number; y: number; hotspot: PageHotspot | null; figure: boolean }>;
/** v3 R7 cover loading line: how far each preload step has come (the cover itself is the first step). */
const COVER_PRELOAD = Object.freeze({ waiting: 0.25, fonts: 0.4, notation: 0.65, printing: 0.85, ready: 1 });
const PRESS_SLOP = 8;
const playingState = (state: string | undefined) => state === 'starting' || state === 'playing' || state === 'paused';

export default function BookApp() {
  const [initialProgress] = useState(loadInitialBookProgress);
  const [book, dispatch] = useReducer(bookReducer, undefined, () => createBookState({ mode: initialProgress.preferences.mode,
    reducedMotion: initialProgress.preferences.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches }));
  const bookRef = useRef(book);
  bookRef.current = book;
  const [lesson, setLesson] = useState(initialProgress.lesson);
  const lessonRef = useRef(lesson);
  lessonRef.current = lesson;
  const musicSceneRef = useRef<LessonScene | null>(null);
  const audioStatus = useRef('');
  const onAudioFrame = useCallback((snapshot: PlaybackSnapshot | null) => {
    if (!snapshot) return;
    const status = `${snapshot.state}:${snapshot.sessionId}`;
    if (audioStatus.current === status) return;
    audioStatus.current = status;
    const token = bookToken(bookRef.current);
    if (snapshot.state === 'starting') dispatch({ type: 'TRANSPORT_STARTING', token });
    else if (snapshot.state === 'playing' && snapshot.sessionId) dispatch({ type: 'TRANSPORT_PLAYING', token, sessionId: snapshot.sessionId });
    else if (snapshot.state === 'paused') dispatch({ type: 'TRANSPORT_PAUSED', token });
    else if (snapshot.state === 'error' || snapshot.state === 'unavailable') dispatch({ type: 'TRANSPORT_UNAVAILABLE', token });
    else if (snapshot.state !== 'locked' || snapshot.lastStopReason) dispatch({ type: 'TRANSPORT_STOPPED', token });
  }, []);
  const { audioRef, playback, playingLane, play, pause, resume, stop, setPreferences: setAudioPreferences } = useBookAudio({ book, lesson, onFrame: onAudioFrame });
  // v3 R7: procedural effects on the shared context — silent until the cover is opened.
  const sfx = useBookSfx({ book, audioRef, musicPlaying: playback?.state === 'playing' || playback?.state === 'starting' });
  const sfxRef = useRef(sfx);
  sfxRef.current = sfx;
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<BookStage | null>(null);
  const printsRef = useRef<ReadonlyMap<PageId, PageSurface>>(new Map());
  const sceneHostRef = useRef<SceneHost | null>(null);
  const [hostReady, setHostReady] = useState(false);
  const [preparedScene, setPreparedScene] = useState('');
  const visited = useRef(new Set<string>());
  const restoringCancel = useRef(false);
  const restoredOpening = useRef(false);
  const visual = useRef<StageUpdate>({ coverProgress: 0, introProgress: book.reducedMotion ? 1 : 0, currentSpreadIndex: bookIndex('spread-1'), spreadCount: BOOK_SPREADS.length, turn: null, sceneProgress: 0 });
  const [layout, setLayout] = useState<StageLayout | null>(null);
  const [stageReady, setStageReady] = useState(false);
  const [error, setError] = useState('');
  const reportError = useCallback((source: 'render' | 'print' | 'scene', reason: unknown, message: string) => {
    setError(message);
    // Keep diagnostic details available to local QA without printing browser or
    // renderer internals in the learner's page.
    if (import.meta.env.DEV && rootRef.current) rootRef.current.dataset.lastBookError = JSON.stringify({
      source, name: reason instanceof Error ? reason.name : 'Error',
      message: reason instanceof Error ? reason.message : String(reason), time: performance.now(),
    });
  }, []);
  const inputId = useRef(0);
  const pointerOwner = useRef<{ id: number; gestureId: number; drag: TurnDragState; offsetX: number; direction: 'next' | 'prev'; corner: 'top' | 'bottom'; element: HTMLElement } | null>(null);
  const [dragHover, setDragHover] = useState(false);
  const scenePointer = useRef<{ id: number; x: number; y: number } | null>(null);
  // v3 R3 printed controls: a press is owned until release (8 px slop), like a button.
  const hotspotPointer = useRef<{ id: number; x: number; y: number; pageId: PageId; hotspotId: string; element: HTMLElement } | null>(null);
  const pendingHit = useRef<{ pointerId: number; hit: PageHit | null } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pageUi, setPageUi] = useState<PageUiState>({ composeKind: 'note' });
  // v3 R5: the toolbar (always laid out so the book's safe area never jumps) and its records dialog.
  const toolbarRef = useRef<HTMLElement>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [holdPrintUpgrades, setHoldPrintUpgrades] = useState(false);
  const focusedBookTarget = useRef('');
  const hasOpenedBook = useRef(false);
  const send = useCallback((event: BookEvent) => dispatch(event), []);
  const draw = useCallback((patch: Partial<StageUpdate>) => {
    visual.current = { ...visual.current, ...patch };
    if (rootRef.current) rootRef.current.dataset.visual = JSON.stringify(visual.current);
    stageRef.current?.update(visual.current);
  }, []);
  const applyProgress = useCallback((nextLesson: LessonState, preferences: BookPreferences) => {
    stop('progress-restore');
    setLesson(previous => Object.freeze({ ...nextLesson, revision: previous.revision + 1 }));
    visited.current.clear();
    restoringCancel.current = false;
    restoredOpening.current = false;
    setError('');
    draw({ coverProgress: 0, introProgress: 1, currentSpreadIndex: 0, turn: null, sceneProgress: 0 });
    send({ type: 'RESTORE_CLOSED', mode: preferences.mode,
      reducedMotion: preferences.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches });
  }, [draw, send, stop]);
  const progress = useBookProgress({ initial: initialProgress, book, lesson, onApply: applyProgress });
  const storePreferences = progress.updatePreferences;
  useEffect(() => { setAudioPreferences(progress.preferences); }, [progress.preferences, setAudioPreferences]);
  const updatePreferences = useCallback((patch: Partial<BookPreferences>) => {
    storePreferences(patch);
    if (patch.mode && patch.mode !== bookRef.current.mode) {
      stop('reading-mode');
      setError('');
      send({ type: patch.mode === '2d' ? 'USE_2D' : 'RETRY_3D' });
    }
    if (patch.reducedMotion !== undefined) send({ type: 'SET_REDUCED_MOTION',
      value: patch.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches });
  }, [storePreferences, send, stop]);

  const printError = useCallback((reason: Error) => {
    reportError('print', reason, '페이지 그림을 준비하지 못해 2D 책으로 전환했어요. 만든 리듬과 답은 그대로예요.');
    // A failed surface cannot hold the reader behind an invisible preparing UI.
    // Recover the committed spread using the same lesson data.
    dispatch({ type: 'USE_2D' });
  }, [reportError]);
  const audioErrorMessage = playback?.error?.message ?? null;
  // v3 R8: a GO_TO prints its far end before it starts (still a six-page window); a neighbour turn keeps current ± 1.
  const turnTarget = book.phase === 'cancelSettling' ? null : book.destinationSpreadId;
  const printPageIds = useMemo(() => bookTurnPrintIds(book.currentSpreadId, turnTarget), [book.currentSpreadId, turnTarget]);
  // v3 R8: a spread of the whole book; the contents and closing carry no lesson scene.
  const currentSpread = bookSpread(book.currentSpreadId);
  const currentPageIds = useMemo(() => [currentSpread.leftPageId, currentSpread.rightPageId] as const, [currentSpread]);
  const playbackState = playback ? playback.state === 'stopping' ? 'stopped' : playback.state : 'ready';
  // The print shows transport state, never the moving playhead (that is the state layer).
  const pagePlayback = useMemo<PagePlayback>(() => ({ state: playbackState, laneId: playingState(playbackState) ? playingLane : null,
    activeEventId: null, error: audioErrorMessage }), [playbackState, playingLane, audioErrorMessage]);
  const idlePlayback = useMemo<PagePlayback>(() => ({ state: 'ready', laneId: null, activeEventId: null, error: audioErrorMessage }), [audioErrorMessage]);
  const interactive = bookCanInteract(book);
  const currentScene = currentSpread.sceneId ? sceneState(lesson, currentSpread.sceneId) : null;
  const activeEventId = playingState(playbackState) && playingLane ? playback?.activeEventId ?? null : null;
  const interaction = useMemo<PageInteraction>(() => ({
    focusId: interactive ? focusId : null, pressedId: interactive ? pressedId : null, hoverId: interactive ? hoverId : null,
    selected: currentScene?.selectedEventId ? { laneId: currentScene.activeLaneId, eventId: currentScene.selectedEventId } : null,
    activeEventId, activeLaneId: activeEventId ? playingLane : null,
  }), [interactive, focusId, pressedId, hoverId, currentScene?.selectedEventId, currentScene?.activeLaneId, activeEventId, playingLane]);
  const prints = usePageCompositor({ enabled: stageReady && book.mode === '3d', tier: currentProfile().quality, lesson, hints: progress.hints, ui: pageUi,
    pageIds: printPageIds, currentPageIds, playback: pagePlayback, idlePlayback, interaction, onError: printError, holdUpgrades: holdPrintUpgrades });
  printsRef.current = prints.surfaces;
  // A button navigation keeps its stopped page visible (and inert) while a fresh
  // print is prepared. Direct dragging uses the already-warm stopped print.
  const waitingForPrint = (book.phase === 'preparingTurn' && !book.gesture || book.phase === 'closing') && !prints.ready;
  // 2D reading pages are DOM; the 3D book shows prints and keeps only the hidden mirror (none mid-turn, BK12).
  const livePagesVisible = book.isOpen && (['spreadIdle', 'fallback2D'].includes(book.phase) || waitingForPrint);
  const mirrorVisible = book.mode === '3d' && book.isOpen && book.phase === 'spreadIdle';
  const printMotionReady = book.phase === 'preparingTurn' || book.phase === 'closing' ? prints.ready : true;
  const recovered3D = book.mode === '3d' && stageReady && prints.ready && (book.phase === 'coverIdle'
    || bookCanInteract(book) && preparedScene === `${book.bookEpoch}:${book.sceneInstanceId}:${book.currentSpreadId}`);
  useEffect(() => { if (recovered3D && error) setError(''); }, [recovered3D, error]);
  const retry3D = useCallback(() => {
    stop('retry-3d');
    setError('');
    storePreferences({ mode: '3d' });
    send({ type: 'RETRY_3D' });
  }, [send, stop, storePreferences]);
  // Opening the records stops playback, as the page tools did; closing returns focus to the toolbar.
  const openRecords = useCallback(() => stop('record-tools'), [stop]);
  // v3 R6: lesson shots. The reader starts one from a printed '가까이 보기'; the camera goes into the
  // figure and comes back to the reading pose itself before any turn, close or drag (SHOT_END).
  type ActiveShot = { spec: ShotSpec; side: 'left' | 'right' | null; phase: 'enter' | 'hold' | 'return'; start: number; from: number; t: number; token: BookToken };
  const shotRef = useRef<ActiveShot | null>(null);
  /** DEV: a pinned shot clock (ms since the current phase began) for captures under a slow renderer. */
  const shotClock = useRef<number | null>(null);
  const shotFrame = useRef<number | null>(null);
  /** DEV: a pinned turn progress (inspector.holdTurn) for GO_TO captures under a slow renderer. */
  const [turnHold, setTurnHold] = useState<number | null>(null);
  const stepShot = useRef<() => void>(() => undefined);
  stepShot.current = () => {
    if (shotFrame.current !== null) { cancelAnimationFrame(shotFrame.current); shotFrame.current = null; }
    const active = shotRef.current;
    if (!active) return;
    const elapsed = shotClock.current ?? performance.now() - active.start;
    // A held shot stays at the shot camera whatever the (pinned) clock says; only entering and returning move.
    const t = active.phase === 'hold' ? 1 : shotProgress(active.phase, elapsed, active.spec, active.from, bookRef.current.reducedMotion);
    active.t = t;
    draw({ shot: t > 0 ? { spec: active.spec, side: active.side, t } : null });
    if (active.phase === 'enter' && t >= 1) active.phase = 'hold';
    if (active.phase === 'return' && t <= 0) {
      shotRef.current = null;
      setPageUi(previous => ({ ...previous, shotId: null }));
      send({ type: 'SHOT_END', token: active.token });
      return;
    }
    if (active.phase !== 'hold' && shotClock.current === null) shotFrame.current = requestAnimationFrame(() => stepShot.current());
  };
  const startShot = (spec: ShotSpec) => {
    const before = bookRef.current;
    const event: BookEvent = { type: 'SHOT_START', token: bookToken(before) };
    if (bookReducer(before, event) === before) return;
    const spread = bookSpread(before.currentSpreadId);
    const side = typeof spec.region === 'string' ? null : spec.region.pageId === spread.leftPageId ? 'left' : spec.region.pageId === spread.rightPageId ? 'right' : null;
    send(event);
    shotRef.current = { spec, side, phase: 'enter', start: performance.now(), from: 0, t: 0, token: bookToken(before) };
    setPageUi(previous => ({ ...previous, shotId: spec.id }));
    stepShot.current();
  };
  /** Back to the reading pose (SHOT_RETURN_MS), then SHOT_END runs any queued turn or close. */
  const returnToReading = useCallback(() => {
    const active = shotRef.current;
    if (!active || active.phase === 'return') return;
    active.phase = 'return';
    active.from = active.t;
    active.start = performance.now();
    stepShot.current();
  }, []);
  // A turn, close or the closing book queued during a shot: return first (the reducer holds the intent).
  useEffect(() => { if (book.camera === 'shot' && book.pendingIntent) returnToReading(); }, [book.camera, book.pendingIntent, returnToReading]);
  // Hidden page, 2D, lost context: the reducer already released the shot; drop it without a tween.
  useEffect(() => {
    if (book.camera === 'shot' || !shotRef.current) return;
    if (shotFrame.current !== null) { cancelAnimationFrame(shotFrame.current); shotFrame.current = null; }
    shotRef.current = null;
    setPageUi(previous => ({ ...previous, shotId: null }));
    draw({ shot: null });
  }, [book.camera, draw]);
  useEffect(() => () => { if (shotFrame.current !== null) cancelAnimationFrame(shotFrame.current); }, []);
  // v3 R6/R7 (decision 5): optionally go into the spread's shot when playback starts (off by default).
  const startShotRef = useRef(startShot);
  startShotRef.current = startShot;
  const transportWas = useRef(book.transport);
  useEffect(() => {
    const started = book.transport === 'playing' && transportWas.current !== 'playing';
    transportWas.current = book.transport;
    if (!started || !progress.preferences.autoShot || book.camera !== 'settled' || shotRef.current) return;
    const spec = SPREAD_SHOTS[book.currentSpreadId]?.[0];
    if (spec) startShotRef.current(spec);
  }, [book.transport, book.camera, book.currentSpreadId, progress.preferences.autoShot]);
  const closeRecords = useCallback(() => {
    setRecordsOpen(false);
    toolbarRef.current?.querySelector<HTMLButtonElement>('[data-testid="records"]')?.focus({ preventScroll: true });
  }, []);
  // v3 R5: the book's safe area ends above the toolbar (the stage reads --book-safe-bottom; 2D uses the height).
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current, host = hostRef.current;
    if (!toolbar || !host) return;
    const apply = () => {
      const height = Math.ceil(toolbar.getBoundingClientRect().height);
      host.style.setProperty('--book-safe-bottom', `${height}px`);
      rootRef.current?.style.setProperty('--book-toolbar-height', `${height}px`);
      stageRef.current?.invalidate();
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [book.mode, stageReady]);
  const changeReadingMode = () => {
    if (bookRef.current.mode === '2d') { retry3D(); return; }
    stop('reading-mode');
    setError('');
    progress.updatePreferences({ mode: '2d' });
    send({ type: 'USE_2D' });
  };

  useEffect(() => {
    const sceneId = bookSpread(book.currentSpreadId).sceneId;
    if (!sceneId) return;
    setLesson(previous => previous.currentSceneId === sceneId ? previous : reduceLesson(previous, { type: 'navigate', sceneId }));
  }, [book.currentSpreadId]);
  useEffect(() => {
    musicSceneRef.current?.updateLesson(lesson);
    stageRef.current?.invalidate();
  }, [lesson, preparedScene]);
  useEffect(() => {
    const retainPosition = playback && ['playing', 'paused', 'starting'].includes(playback.state);
    musicSceneRef.current?.setPlayback(retainPosition && playingLane ? { laneId: playingLane, activeId: playback.activeEventId, position: playback.relativePosition, reducedMotion: book.reducedMotion } : null);
    stageRef.current?.invalidate();
    if (rootRef.current) rootRef.current.dataset.audio = JSON.stringify({ ...playback, laneId: playingLane, revision: lesson.revision });
  }, [playback, playingLane, book.reducedMotion, lesson.revision]);
  // v3 R3: the figure's window is the printed page's reserved figure rect (no DOM measurement).
  const pageWorldHeight = layout?.pageWorld.height ?? 0;
  const figureRect = book.mode === '3d' ? Object.values(prints.surfaces.get(currentSpread.rightPageId)?.layout.figureRects ?? {})[0] : undefined;
  useEffect(() => {
    if (!figureRect || !pageWorldHeight || !currentSpread.sceneId) return;
    const toZ = (y: number) => (y / PAGE_LOGICAL.height - 0.5) * pageWorldHeight;
    // v3 R4: centre the figure's visual extent at the reading pose — raised block tops, the printed
    // axis labels and the spread's decor — in the printed window.
    const extent = lessonFigureExtent(currentSpread.sceneId);
    stageRef.current?.setSceneWindow({ offsetZ: toZ(figureRect.y + figureRect.h / 2) - (extent.minZ + extent.maxZ) / 2,
      minZ: toZ(figureRect.y), maxZ: toZ(figureRect.y + figureRect.h), visible: true });
  }, [figureRect, pageWorldHeight, preparedScene, currentSpread]);
  const command = (event: LessonCommand) => {
    if (bookRef.current.scene !== 'ready' || !bookRef.current.isOpen || bookRef.current.hidden) return;
    setLesson(previous => reduceLesson(previous, event, { playing: playback?.state === 'playing' || playback?.state === 'starting' || playback?.state === 'paused' }));
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let alive = true;
    let cleanup: (() => void) | undefined;
    void import('./inspector.ts').then(({ attachBookInspector }) => {
      if (alive) cleanup = attachBookInspector({ getStage: () => stageRef.current, getVisual: () => visual.current, draw, getRoot: () => rootRef.current,
        getScene: () => musicSceneRef.current,
        getPrintStats: () => printStatsRef.current(),
        holdPrintUpgrades: setHoldPrintUpgrades,
        getShot: () => { const active = shotRef.current; return active ? { id: active.spec.id, phase: active.phase, t: Number(active.t.toFixed(4)) } : null; },
        holdShot: ms => { shotClock.current = ms; stepShot.current(); },
        holdTurn: progress => setTurnHold(progress),
        getSfxLog: () => sfxRef.current.log(),
        getPrintImage: (pageId, layer) => {
          const surface = printsRef.current.get(pageId as PageId);
          const image = (layer === 'state' ? surface?.state?.image : surface?.print.image) as HTMLCanvasElement | undefined;
          return image?.toDataURL?.('image/png') ?? null;
        },
        getPages: () => {
          const stage = stageRef.current;
          const spread = bookSpread(bookRef.current.currentSpreadId);
          return [...printsRef.current.values()].map(surface => {
            const side = surface.pageId === spread.leftPageId ? 'left' as const : surface.pageId === spread.rightPageId ? 'right' as const : null;
            return { pageId: surface.pageId, side, resolution: surface.resolution, upgrading: surface.upgrading, printVersion: surface.printVersion,
              stateVersion: surface.stateVersion, scale: surface.layout.scale, overflow: surface.layout.overflow, figureRects: surface.layout.figureRects,
              figures: Object.entries(surface.layout.figureRects).map(([id, rect]) => ({ id, rect,
                center: side && stage ? stage.pagePoint(side, (rect.x + rect.w / 2) / PAGE_LOGICAL.width, (rect.y + rect.h / 2) / PAGE_LOGICAL.height) : null })),
              flaps: surface.layout.flaps.map(flap => ({ id: flap.id, hotspotId: flap.hotspotId, open: flap.open, rect: flap.rect })),
              stamps: surface.layout.stamps.map(stamp => ({ id: stamp.id, stamped: stamp.stamped, rect: stamp.rect,
                center: side && stage ? stage.pagePoint(side, (stamp.rect.x + stamp.rect.w / 2) / PAGE_LOGICAL.width, (stamp.rect.y + stamp.rect.h / 2) / PAGE_LOGICAL.height) : null })),
              hotspots: surface.layout.hotspots.map(hotspot => ({ id: hotspot.id, role: hotspot.role, label: hotspot.label, enabled: hotspot.enabled,
                testId: hotspot.testId ?? null, rect: hotspot.rect,
                center: side && stage ? stage.pagePoint(side, (hotspot.rect.x + hotspot.rect.w / 2) / PAGE_LOGICAL.width, (hotspot.rect.y + hotspot.rect.h / 2) / PAGE_LOGICAL.height) : null })) };
          });
        } });
    });
    return () => { alive = false; cleanup?.(); };
  }, [draw]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || book.mode === '2d') return;
    let alive = true;
    let owned: BookStage | null = null;
    setStageReady(false);
    void import('./stage.ts').then(({ createBookStage }) => {
      if (!alive) return;
      owned = createBookStage(host, { quality: currentProfile().quality,
        onLayout(next) {
          if (!alive) return;
          setLayout(next);
          if (rootRef.current) rootRef.current.dataset.layout = JSON.stringify(next);
        },
        onFailure(reason) {
          if (!alive) return;
          reportError('render', reason, '입체 화면을 표시할 수 없어 2D 책으로 전환했어요. 만든 리듬과 답은 그대로예요.');
          send({ type: 'WEBGL_LOST' });
        },
        onMetrics(metrics) {
          if (!alive) return;
          const root = rootRef.current;
          if (root) {
            root.dataset.threeReady = String(metrics.coverReady && !metrics.contextLost);
            root.dataset.frames = String(metrics.renderedFrames);
            root.dataset.geometries = String(metrics.geometries);
            root.dataset.textures = String(metrics.textures);
            root.dataset.drawCalls = String(metrics.drawCalls);
            root.dataset.quality = metrics.quality;
          }
          if (metrics.coverReady && !metrics.contextLost) setStageReady(true);
        },
      });
      stageRef.current = owned;
      owned?.update(visual.current);
      const spread = bookSpread(bookRef.current.currentSpreadId);
      const surface = (id: PageId) => printsRef.current.get(id);
      owned?.setPageTextures({ staticLeft: surface(spread.leftPageId)?.print ?? null, staticRight: surface(spread.rightPageId)?.print ?? null,
        staticLeftState: surface(spread.leftPageId)?.state ?? null, staticRightState: surface(spread.rightPageId)?.state ?? null });
    }).catch((reason: unknown) => {
      if (!alive) return;
      reportError('render', reason, '입체 화면을 준비하지 못해 2D 책으로 전환했어요. 만든 리듬과 답은 그대로예요.');
      send({ type: 'USE_2D' });
    });
    return () => {
      alive = false; owned?.dispose();
      if (stageRef.current === owned) stageRef.current = null;
    };
  }, [book.mode, send, reportError]);

  // v3 R3: the static pages always show their prints (no HTML overlay). A page and the leaf face that
  // carries it share one texture object, so a turn never swaps or re-prints a surface.
  // v3 R8: a GO_TO flies its leaves from the stage's pool of three (goToFrame); the pages between
  // its ends are outside the print window and pass as plain paper. Returns the stage turn to draw.
  const showTurn = useCallback((state: BookState, progress: number, leafVisible: boolean): StageUpdate['turn'] => {
    const print = (id: PageId | null | undefined) => id ? printsRef.current.get(id)?.print ?? null : null;
    const layer = (id: PageId | null | undefined) => id ? printsRef.current.get(id)?.state ?? null : null;
    const current = bookSpread(state.currentSpreadId);
    const leaves = state.destinationSpreadId ? bookLeaves(state.currentSpreadId, state.destinationSpreadId) : [];
    const first = leaves[0] ?? null;
    const direction = first?.direction === 'prev' ? 'backward' as const : 'forward' as const;
    const corner = state.gesture?.corner ?? 'bottom';
    const pool = { turnFront1: null, turnBack1: null, turnFront2: null, turnBack2: null };
    let turn: StageUpdate['turn'] = null;
    if (leaves.length > 1 && leafVisible) {
      const progresses = leafProgresses(goToSchedule(leaves.length, BOOK_MOTION.turn), progress);
      const frame = goToFrame(state.currentSpreadId, state.destinationSpreadId!, progresses)!;
      const slot = (index: number) => frame.slots[index]?.leaf ?? null;
      stageRef.current?.setPageTextures({
        staticLeft: print(frame.staticLeftPageId), staticRight: print(frame.staticRightPageId),
        staticLeftState: layer(frame.staticLeftPageId), staticRightState: layer(frame.staticRightPageId),
        turnFront: print(slot(0)?.frontPageId), turnBack: print(slot(0)?.backPageId),
        turnFrontState: layer(slot(0)?.frontPageId), turnBackState: layer(slot(0)?.backPageId),
        turnFront1: print(slot(1)?.frontPageId), turnBack1: print(slot(1)?.backPageId),
        turnFront2: print(slot(2)?.frontPageId), turnBack2: print(slot(2)?.backPageId) });
      turn = { direction, progress, corner, leaves: progresses };
    } else {
      const visible = !!first && leafVisible;
      stageRef.current?.setPageTextures(visible ? { ...pool,
        staticLeft: print(first.stationaryLeftPageId), staticRight: print(first.stationaryRightPageId),
        turnFront: print(first.frontPageId), turnBack: print(first.backPageId),
        staticLeftState: layer(first.stationaryLeftPageId), staticRightState: layer(first.stationaryRightPageId),
        turnFrontState: layer(first.frontPageId), turnBackState: layer(first.backPageId),
      } : { ...pool, staticLeft: print(current.leftPageId), staticRight: print(current.rightPageId),
        turnFront: print(first?.frontPageId), turnBack: print(first?.backPageId),
        staticLeftState: layer(current.leftPageId), staticRightState: layer(current.rightPageId),
        turnFrontState: layer(first?.frontPageId), turnBackState: layer(first?.backPageId) });
      if (visible) turn = { direction, progress, corner };
    }
    // Same texture objects with new content (needsUpdate) still need a frame.
    stageRef.current?.invalidate();
    return turn;
  }, []);
  useLayoutEffect(() => {
    const leafVisible = !!book.destinationSpreadId && !book.reducedMotion && (book.phase !== 'preparingTurn' || !!bookRef.current.gesture);
    const turn = showTurn(bookRef.current, bookRef.current.progress, leafVisible);
    if (turn) draw({ turn });
    if (!book.destinationSpreadId || book.reducedMotion) draw({ currentSpreadIndex: bookIndex(book.currentSpreadId), turn: null,
      ...(book.reducedMotion && book.gesture?.pointerActive ? { sceneProgress: 1 } : {}) });
  }, [book.currentSpreadId, book.destinationSpreadId, book.phase, book.isOpen, book.reducedMotion, book.gesture?.pointerActive, stageReady, prints.generation, draw, showTurn]);

  useEffect(() => {
    if (!stageReady || book.mode === '2d') return;
    let alive = true;
    let host: SceneHost | null = null;
    setHostReady(false);
    void import('./SceneHost.ts').then(({ SceneHost: Host }) => {
      if (!alive) return;
      host = new Host({
        attach(group) {
          // A new figure starts lying flat: undrawn on a first visit, already drawn on a revisit.
          const drawn = visited.current.has(bookRef.current.currentSpreadId) || restoringCancel.current;
          draw({ sceneProgress: 0, sceneReveal: drawn ? 1 : 0 });
          stageRef.current?.setSceneGroup(group);
        },
        invalidate() { stageRef.current?.invalidate(); },
        stopAudio(reason) { stop(reason); },
        isCurrent(token) { return alive && tokenMatches(bookRef.current, token); },
        report(event) { if (rootRef.current) rootRef.current.dataset.sceneLifecycle = JSON.stringify(event); },
      });
      sceneHostRef.current = host;
      setHostReady(true);
    });
    return () => { alive = false; host?.dispose(); if (sceneHostRef.current === host) sceneHostRef.current = null; };
  }, [stageReady, book.mode, draw, stop]);

  useEffect(() => {
    const current = bookRef.current;
    const key = `${current.bookEpoch}:${current.sceneInstanceId}:${current.currentSpreadId}`;
    const host = sceneHostRef.current;
    if (!current.isOpen || current.hidden) { host?.clear(current.hidden ? 'document-hidden' : 'book-closed'); setPreparedScene(''); return; }
    if (current.mode === '2d') { setPreparedScene(key); return; }
    if (!host || !hostReady) return;
    let alive = true;
    setPreparedScene('');
    const token = bookToken(current);
    let prepared: LessonScene | null = null;
    const sceneId = bookSpread(current.currentSpreadId).sceneId;
    // v3 R8: the contents and closing are printed pages only — no lesson scene to prepare.
    if (!sceneId) {
      host.clear('no-scene');
      musicSceneRef.current = null;
      setPreparedScene(key);
      return () => { alive = false; };
    }
    void import('./lessonScene.ts').then(({ createLessonScene }) => host.replace({ sceneId, load(signal) {
      if (signal.aborted || !tokenMatches(bookRef.current, token)) throw new DOMException('Scene preparation cancelled', 'AbortError');
      prepared = createLessonScene(sceneId, lessonRef.current, { spread: { index: bookIndex(current.currentSpreadId), count: BOOK_SPREADS.length },
        hatch: currentProfile().quality !== 'low', reducedMotion: () => bookRef.current.reducedMotion, invalidate: () => stageRef.current?.invalidate() });
      return prepared;
    } }, token)).then(result => {
      if (!alive || result !== 'ready' || !tokenMatches(bookRef.current, token)) return;
      musicSceneRef.current = prepared;
      setPreparedScene(key);
      if (bookRef.current.scene !== 'entering') { draw({ sceneProgress: 1, sceneReveal: 1 }); host.markReady(token); }
    }).catch((reason: unknown) => {
      if (!alive || !tokenMatches(bookRef.current, token)) return;
      reportError('scene', reason, '입체 장면을 준비하지 못해 2D 책으로 전환했어요. 만든 리듬과 답은 그대로예요.');
      send({ type: 'USE_2D' });
    });
    return () => { alive = false; };
  }, [book.isOpen, book.hidden, book.currentSpreadId, book.sceneInstanceId, book.bookEpoch, book.mode, hostReady, draw, send, reportError]);

  useEffect(() => {
    if (book.scene === 'exiting' || book.hidden || book.mode === '2d') sceneHostRef.current?.exit(book.hidden ? 'document-hidden' : book.mode === '2d' ? 'reading-fallback' : 'page-exit');
  }, [book.scene, book.hidden, book.mode]);

  useEffect(() => {
    if (book.phase === 'bootLoading' && !book.hidden && (stageReady && prints.ready || book.mode === '2d')) {
      send({ type: 'BOOT_READY', token: bookToken(book), firstSpreadReady: true });
    }
  }, [book, stageReady, prints.ready, send]);

  useEffect(() => {
    const current = bookRef.current;
    const token = bookToken(current);
    const duration = (ms: number) => current.reducedMotion || current.mode === '2d' ? 0 : ms;
    if (current.hidden) {
      draw({ coverProgress: current.isOpen ? 1 : 0, introProgress: 1, sceneProgress: current.isOpen ? 1 : 0, sceneReveal: 1, turn: null });
      return;
    }
    if (current.phase === 'introReady') { send({ type: 'START_INTRO' }); return; }
    if (current.phase === 'introMoving') return tween(visual.current.introProgress, 1, duration(BOOK_MOTION.intro), value => draw({ introProgress: value }), () => send({ type: 'INTRO_SETTLED', token }));
    if (current.phase === 'coverIdle') { draw({ coverProgress: 0, introProgress: 1, sceneProgress: 0, turn: null }); return; }
    if (current.phase === 'opening') return tween(visual.current.coverProgress, 1, duration(BOOK_MOTION.cover * (restoredOpening.current ? 0.45 : 1)), value => draw({ coverProgress: value, introProgress: 1 }), () => {
      send({ type: 'COVER_COMPLETE', token });
      send({ type: 'CAMERA_COMPLETE', token });
    });
    if (current.phase === 'closing') {
      if (!printMotionReady && current.mode === '3d') return;
      if (current.scene === 'exiting') return tween(visual.current.sceneProgress ?? 0, 0, duration(BOOK_MOTION.exit), value => draw({ sceneProgress: value }), () => send({ type: 'SCENE_EXITED', token }));
      if (current.scene === 'disposed') return tween(visual.current.coverProgress, 0, duration(BOOK_MOTION.cover), value => draw({ coverProgress: value }), () => {
        send({ type: 'COVER_COMPLETE', token }); send({ type: 'CAMERA_COMPLETE', token });
      });
    }
    // v3 R8: a GO_TO's leaves leave 45 ms apart, at most three in the air, each min(turn, 1600 / n) ms.
    const leafCount = current.destinationSpreadId ? bookLeaves(current.currentSpreadId, current.destinationSpreadId).length : 1;
    const turnMs = goToSchedule(Math.max(1, leafCount), BOOK_MOTION.turn).totalMs;
    const turn = (progress: number) => {
      draw(current.reducedMotion ? { turn: null, sceneProgress: current.gesture ? 1 : 0 }
        : { turn: leafCount > 1 ? showTurn(current, progress, true)
          : { direction: current.direction === 'next' ? 'forward' : 'backward', progress, corner: current.gesture?.corner ?? 'bottom' },
          sceneProgress: current.phase === 'cancelSettling' ? Math.max(0, 1 - progress / 0.16) : 0 });
      send({ type: 'TURN_PROGRESS', token, progress });
    };
    if (current.phase === 'preparingTurn') {
      if (!printMotionReady && current.mode === '3d') return;
      if (current.gesture) { send({ type: 'TURN_PREPARED', token }); return; }
      return tween(visual.current.sceneProgress ?? 0, 0, duration(BOOK_MOTION.exit), value => draw({ sceneProgress: value }), () => send({ type: 'TURN_PREPARED', token }));
    }
    if (current.phase === 'turningForward' || current.phase === 'turningBack') {
      if (current.gesture?.pointerActive) return;
      // DEV captures (inspector.holdTurn): a pinned turn shows that progress and waits; release resumes from it.
      if (turnHold !== null && current.mode === '3d' && !current.reducedMotion) { turn(turnHold); return; }
      return tween(current.progress, 1, duration(turnMs * (1 - current.progress)), turn, () => send({ type: 'TURN_COMPLETE', token }));
    }
    if (current.phase === 'settling' || current.phase === 'cancelSettling') {
      const target = current.phase === 'settling' ? 1 : 0;
      return tween(current.progress, target, duration(Math.max(BOOK_MOTION.settle, BOOK_MOTION.turn * Math.abs(target - current.progress))), turn, () => {
        restoringCancel.current = current.phase === 'cancelSettling';
        send({ type: 'SETTLED', token });
      });
    }
    if (current.isOpen && current.scene === 'entering') {
      if (preparedScene !== `${current.bookEpoch}:${current.sceneInstanceId}:${current.currentSpreadId}`) return;
      const restoring = restoringCancel.current;
      const revisit = visited.current.has(current.currentSpreadId);
      restoringCancel.current = false;
      const ready = () => {
        sceneHostRef.current?.markReady(token);
        visited.current.add(current.currentSpreadId);
        send({ type: 'SCENE_READY', token });
      };
      // v3 R4: a drawn figure only stands up again; a first visit is drawn by the pen while it rises.
      if (restoring || revisit) return tween(0, 1, duration(restoring ? 0 : BOOK_MOTION.revisit), value => draw({ sceneProgress: value, sceneReveal: 1 }), ready);
      return tween(0, 1, duration(FIGURE_ENTRY_MS), value => {
        const frame = figureEntryFrame(inverseSmoothStep(value) * FIGURE_ENTRY_MS);
        draw({ sceneProgress: frame.lift, sceneReveal: frame.reveal });
      }, ready);
    }
  }, [book.phase, book.scene, book.hidden, book.navigationToken, book.bookEpoch, book.sceneInstanceId, book.reducedMotion, book.mode, book.gesture?.pointerActive, preparedScene, printMotionReady, draw, send, showTurn, turnHold]);

  useEffect(() => {
    const visibility = () => send({ type: document.hidden ? 'HIDE_DOCUMENT' : 'SHOW_DOCUMENT' });
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => send({ type: 'SET_REDUCED_MOTION', value: motion.matches || progress.preferences.reducedMotion });
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', change);
    return () => { document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', change); };
  }, [send, progress.preferences.reducedMotion]);

  const pageFocusReady = bookCanInteract(book);
  const focusInstance = `${book.mode}:${book.bookEpoch}:${book.sceneInstanceId}`;
  useEffect(() => {
    if (book.isOpen) hasOpenedBook.current = true;
    if (book.hidden) return;
    const destination = pageFocusReady ? 'page'
      : hasOpenedBook.current && !book.isOpen && book.phase === 'coverIdle' && book.camera === 'settled' ? 'cover' : null;
    if (!destination) return;
    const key = `${destination}:${focusInstance}`;
    if (focusedBookTarget.current === key) return;
    const target = rootRef.current?.querySelector<HTMLElement>(destination === 'page'
      ? '[data-active-page="true"] h1' : '.book-cover-primary:not(:disabled)');
    if (!target || target.closest('[inert]')) return;
    target.focus({ preventScroll: true });
    // An entering page may still be inert. Claim focus only after it succeeds,
    // and do not move it again when audio returns from playing to ready.
    if (document.activeElement === target) focusedBookTarget.current = key;
  }, [pageFocusReady, focusInstance, book.isOpen, book.hidden, book.phase, book.camera]);

  const cancelPointer = useCallback(() => {
    setDragHover(false);
    scenePointer.current = null;
    const press = hotspotPointer.current;
    hotspotPointer.current = null;
    setPressedId(null);
    if (press?.element.hasPointerCapture(press.id)) press.element.releasePointerCapture(press.id);
    const owner = pointerOwner.current;
    if (!owner) return;
    pointerOwner.current = null;
    send({ type: 'TURN_CANCEL', gestureId: owner.gestureId });
    if (owner.element.hasPointerCapture(owner.id)) owner.element.releasePointerCapture(owner.id);
  }, [send]);
  useEffect(() => {
    window.addEventListener('resize', cancelPointer);
    window.addEventListener('blur', cancelPointer);
    return () => { window.removeEventListener('resize', cancelPointer); window.removeEventListener('blur', cancelPointer); cancelPointer(); };
  }, [cancelPointer]);
  useEffect(() => { if (book.hidden || book.mode === '2d') cancelPointer(); }, [book.hidden, book.mode, cancelPointer]);

  const dragReadiness = { book, layout, stageReady, printsReady: prints.ready,
    textureCount: prints.surfaces.size, requiredTextureCount: printPageIds.length, preparedScene, pointerOwned: !!pointerOwner.current || !!hotspotPointer.current };
  const dragAvailability = turnInputAvailability(dragReadiness);
  /** The 3D page is the WebGL canvas: only a pointer on the stage (not a toolbar/navigation control) reaches the paper. */
  const onPaper = (event: ReactPointerEvent<HTMLElement>) => {
    if (bookRef.current.mode !== '3d' || !(event.target instanceof Element) || !event.target.closest('.book-stage')) return false;
    const path = event.nativeEvent.composedPath();
    return !turnTargetOwnsInput(event.target) && !path.some(turnTargetOwnsInput);
  };
  const pageHit = (clientX: number, clientY: number): PageHit | null => {
    const spread = bookSpread(bookRef.current.currentSpreadId);
    // v3 R5: a standing paper flap is in front of the page; pressing it folds it down (its tab's command).
    const flapKey = stageRef.current?.flapAt(clientX, clientY) ?? null;
    if (flapKey) {
      for (const [side, pageId] of [['left', spread.leftPageId], ['right', spread.rightPageId]] as const) {
        const flapLayout = printsRef.current.get(pageId)?.layout;
        const flap = flapLayout?.flaps.find(item => `${pageId}:${item.id}` === flapKey);
        const tab = flap && flapLayout?.hotspots.find(item => item.id === flap.hotspotId);
        if (tab) return { pageId, side, x: tab.rect.x + tab.rect.w / 2, y: tab.rect.y + tab.rect.h / 2, hotspot: tab, figure: false };
      }
    }
    const point = stageRef.current?.pagePointer(clientX, clientY);
    if (!point) return null;
    const pageId = point.side === 'left' ? spread.leftPageId : spread.rightPageId;
    const surfaceLayout = printsRef.current.get(pageId)?.layout;
    if (!surfaceLayout) return null;
    const x = point.u * PAGE_LOGICAL.width, y = point.v * PAGE_LOGICAL.height;
    const figure = Object.values(surfaceLayout.figureRects).some(rect => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h);
    return { pageId, side: point.side, x, y, hotspot: hitTest(surfaceLayout, x, y), figure };
  };
  const pointerCorner = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.defaultPrevented || !layout || !hostRef.current || !onPaper(event)) return null;
    const point = { x: event.clientX, y: event.clientY };
    const rect = hostRef.current.getBoundingClientRect();
    // Read the print getter now: a scroll/refresh can invalidate it before React commits.
    const available = turnInputAvailability({ ...dragReadiness, book: bookRef.current,
      printsReady: prints.ready, pointerOwned: !!pointerOwner.current || !!hotspotPointer.current });
    return turnCornerAtPoint(layout, { x: point.x - rect.left, y: point.y - rect.top }, available);
  };
  const pointerDown = (event: ReactPointerEvent<HTMLElement>, direction: 'next' | 'prev', corner: 'top' | 'bottom') => {
    if (pointerOwner.current) { cancelPointer(); return; }
    if (event.button !== 0 || !event.isPrimary || !layout || !turnInputAvailability({ ...dragReadiness,
      book: bookRef.current, printsReady: prints.ready, pointerOwned: !!pointerOwner.current })[direction]) return;
    const quad = direction === 'next' ? layout.right : layout.left;
    const point = direction === 'next' ? corner === 'top' ? quad.tr : quad.br : corner === 'top' ? quad.tl : quad.bl;
    const rect = hostRef.current!.getBoundingClientRect();
    const drag = createTurnDrag({ clientX: event.clientX, clientY: event.clientY, time: event.timeStamp }, direction, Math.hypot(quad.tr.x - quad.tl.x, quad.tr.y - quad.tl.y));
    const gestureId = ++inputId.current;
    stop('page-drag');
    const element = event.currentTarget;
    pointerOwner.current = { id: event.pointerId, gestureId, drag, offsetX: rect.left + point.x - event.clientX, direction, corner, element };
    element.setPointerCapture(event.pointerId);
    setDragHover(false);
    event.preventDefault();
    draw(book.reducedMotion ? { turn: null, sceneProgress: 1 }
      : { turn: { direction: direction === 'next' ? 'forward' : 'backward', progress: 0, corner } });
    send({ type: 'TURN_DRAG_START', direction, gestureId, pointerId: event.pointerId, corner, surfacesReady: prints.ready && printPageIds.every(id => printsRef.current.has(id)),
      sample: { x: event.clientX, y: event.clientY, time: event.timeStamp, velocity: 0 } });
  };
  const pointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const owner = pointerOwner.current;
    if (!owner || event.pointerId !== owner.id) return;
    event.preventDefault();
    owner.drag = updateTurnDrag(owner.drag, { clientX: event.clientX, clientY: event.clientY, time: event.timeStamp });
    const projection = stageRef.current?.pointerProjection(event.clientX + owner.offsetX, event.clientY);
    const progress = owner.drag.activated ? projection?.turnProgress ?? owner.drag.progress : 0;
    owner.drag = { ...owner.drag, progress };
    draw(bookRef.current.reducedMotion ? { turn: null, sceneProgress: 1 }
      : { turn: { direction: owner.direction === 'next' ? 'forward' : 'backward', progress, corner: owner.corner }, sceneProgress: Math.max(0, 1 - progress / 0.16) });
    send({ type: 'TURN_DRAG_MOVE', token: bookToken(bookRef.current), gestureId: owner.gestureId, activated: owner.drag.activated, progress,
      sample: { x: event.clientX, y: event.clientY, time: event.timeStamp, velocity: owner.drag.directionalVelocity } });
  };
  const pointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const owner = pointerOwner.current;
    if (!owner || event.pointerId !== owner.id) return;
    pointerMove(event);
    pointerOwner.current = null;
    send({ type: 'TURN_RELEASE', token: bookToken(bookRef.current), gestureId: owner.gestureId,
      sample: { x: event.clientX, y: event.clientY, time: event.timeStamp, velocity: owner.drag.directionalVelocity }, decision: turnReleaseDecision(owner.drag, event.timeStamp) });
    if (owner.element.hasPointerCapture(owner.id)) owner.element.releasePointerCapture(owner.id);
  };

  /** One command path for printed hotspots and their mirror controls: the same LessonCommand / audio calls as 2D. */
  const runHotspot = (hotspot: PageHotspot) => {
    const action = hotspot.command;
    if (!hotspot.enabled || !action || !bookCanInteract(bookRef.current)) return;
    // v3 R7: a printed control is a pen tap; the answer flap is paper (both gated by the effects hook).
    sfx.play(action.type === 'flap' ? 'flap' : 'pen');
    switch (action.type) {
      case 'lesson': action.commands.forEach(item => command(item)); break;
      case 'play': play(action.laneId); break;
      case 'pause': pause(); break;
      case 'resume': resume(); break;
      case 'stop': stop('user-stop'); break;
      case 'flap': progress.setHint(action.key, progress.hints[action.key] !== 1); break;
      case 'ui': setPageUi(previous => ({ ...previous, ...action.patch })); break;
      // Shots (R6) and contents jumps (R8) are printed later; keep a trace while they are inert.
      case 'shot': {
        // The same button (or another shot's) first brings the camera back to reading.
        if (shotRef.current) { returnToReading(); break; }
        const spec = findShot(bookRef.current.currentSpreadId, action.shotId);
        if (spec) startShot(spec);
        break;
      }
      // Contents jumps (R8) are printed later; keep a trace while they are inert.
      case 'goto': goToRef.current(action.spreadId); break;
    }
  };
  const runHotspotRef = useRef(runHotspot);
  runHotspotRef.current = runHotspot;
  // v3 R8: GO_TO is declared with the navigation below; printed rows reach it through this ref.
  const goToRef = useRef<(spreadId: SpreadId) => boolean>(() => false);
  // The 2D contents and closing run the same commands as their printed rows (only GO_TO there).
  const matterCommand = (action: HotspotCommand) => { if (action.type === 'goto' && bookCanInteract(bookRef.current)) goToRef.current(action.spreadId); };
  const activateMirror = useCallback((hotspot: PageHotspot) => runHotspotRef.current(hotspot), []);
  const focusMirror = useCallback((id: string | null) => setFocusId(id), []);
  // The mirror follows page layouts only; hover/focus/press repaint the state layer without touching it.
  const leftLayout = prints.surfaces.get(currentSpread.leftPageId)?.layout;
  const rightLayout = prints.surfaces.get(currentSpread.rightPageId)?.layout;
  const mirrorPages = useMemo<readonly MirrorPage[]>(() => leftLayout && rightLayout
    ? [{ pageId: currentSpread.leftPageId, side: 'left', layout: leftLayout }, { pageId: currentSpread.rightPageId, side: 'right', layout: rightLayout }] : [],
  [leftLayout, rightLayout, currentSpread]);
  // v3 R7: a newly earned stamp on the open spread thuds once (not on arrival at an already stamped page).
  const stampedBefore = useRef<{ spread: string; stamped: Set<string> } | null>(null);
  useEffect(() => {
    const stamped = new Set(mirrorPages.flatMap(page => page.layout.stamps.filter(stamp => stamp.stamped).map(stamp => `${page.pageId}:${stamp.id}`)));
    const before = stampedBefore.current;
    stampedBefore.current = { spread: currentSpread.spreadId, stamped };
    if (before?.spread === currentSpread.spreadId && [...stamped].some(key => !before.stamped.has(key))) sfx.play('stamp');
  }, [mirrorPages, currentSpread.spreadId, sfx]);
  // v3 R5: each covered answer area has a paper flap that lifts in 3D over its printed place.
  const stageFlaps = useMemo<readonly StageFlap[]>(() => book.mode !== '3d' ? [] : mirrorPages.flatMap(page => page.layout.flaps.map(flap => ({
    key: `${page.pageId}:${flap.id}`, side: page.side, open: flap.open, hint: flap.hint, foldHint: flap.foldHint,
    rect: { u0: flap.rect.x / PAGE_LOGICAL.width, v0: flap.rect.y / PAGE_LOGICAL.height,
      u1: (flap.rect.x + flap.rect.w) / PAGE_LOGICAL.width, v1: (flap.rect.y + flap.rect.h) / PAGE_LOGICAL.height },
  }))), [mirrorPages, book.mode]);
  useEffect(() => { stageRef.current?.setPageFlaps(stageFlaps, book.reducedMotion); }, [stageFlaps, book.reducedMotion, stageReady]);
  const printStatsRef = useRef(prints.stats);
  printStatsRef.current = prints.stats;
  const beginPress = (event: ReactPointerEvent<HTMLElement>, hit: PageHit, hotspot: PageHotspot) => {
    const element = event.currentTarget;
    hotspotPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, pageId: hit.pageId, hotspotId: hotspot.id, element };
    element.setPointerCapture(event.pointerId);
    setPressedId(hotspot.id);
    setDragHover(false);
    event.preventDefault();
  };
  const finishPress = (event: ReactPointerEvent<HTMLElement>) => {
    const press = hotspotPointer.current;
    if (!press || press.id !== event.pointerId) return false;
    hotspotPointer.current = null;
    setPressedId(null);
    if (press.element.hasPointerCapture(press.id)) press.element.releasePointerCapture(press.id);
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) >= PRESS_SLOP) return true;
    // Re-read the hotspot: its command and enabled state follow the latest print.
    const hotspot = printsRef.current.get(press.pageId)?.layout.hotspots.find(item => item.id === press.hotspotId);
    if (hotspot) runHotspot(hotspot);
    return true;
  };
  const playbackStatus = playbackState === 'starting' ? '소리를 준비해요' : playbackState === 'paused' ? '잠깐 멈춤' : playbackState === 'playing' ? '재생 중' : '정지 상태';
  const toolbarVisible = book.isOpen && book.phase !== 'closing';
  const lastSpread = bookIndex(book.phase === 'cancelSettling' ? book.currentSpreadId : book.destinationSpreadId ?? book.currentSpreadId) + 1 >= BOOK_SPREADS.length;
  // v3 R8: lesson pages keep their numbers (1–12); the contents and closing are named.
  const folio = currentSpread.sceneId ? `${lessonPageNumber(currentSpread.sceneId, 'left')}–${lessonPageNumber(currentSpread.sceneId, 'right')}쪽 / ${BOOK_MANIFEST.length * 2}`
    : currentSpread.spreadId === 'contents' ? PAGE_TEXT.contentsFolio : PAGE_TEXT.closingFolio;

  const intro = book.phase === 'introReady' || book.phase === 'introMoving';
  const coverVisible = !book.isOpen && book.phase !== 'opening';
  const open = (spreadId: SpreadId = 'spread-1', resumeSaved = false) => {
    const id = ++inputId.current;
    const event: BookEvent = intro ? { type: 'SKIP_INTRO', inputId: id } : { type: 'OPEN_BOOK', inputId: id, spreadId };
    if (bookReducer(bookRef.current, event) === bookRef.current) return;
    // The reader's first gesture: effects may sound from here on (cover-open follows the transition).
    sfx.unlock();
    if (!intro) {
      progress.activate();
      restoredOpening.current = resumeSaved;
      if (resumeSaved) visited.current.add(spreadId);
    }
    send(event);
  };
  /** v3 R8: GO_TO (contents rows, the toolbar's 목차, the closing's 차례로) — the same guards as navigate. */
  const goTo = (spreadId: SpreadId): boolean => {
    const current = bookRef.current;
    const event: BookEvent = { type: 'GO_TO', spreadId, source: 'button' };
    const predicted = bookReducer(current, event);
    if (pointerOwner.current || predicted === current) return false;
    stop('page-navigation');
    send(event);
    return true;
  };
  goToRef.current = goTo;
  const navigate = (direction: 'next' | 'prev', source: 'keyboard' | 'button'): boolean => {
    const current = bookRef.current;
    const event: BookEvent = { type: direction === 'next' ? 'NEXT' : 'PREV', source };
    // The pure reducer is also the acceptance guard: ignored boundaries and
    // competing gestures must not stop audio or invalidate a prepared print.
    const predicted = bookReducer(current, event);
    if (pointerOwner.current || predicted === current) return false;
    stop('page-navigation');
    send(event);
    return true;
  };
  return <main ref={rootRef} className={`book-app ${book.mode === '2d' ? 'book-app--2d' : ''}`} data-phase={book.phase} data-camera={book.camera} data-scene={book.scene} data-transport={book.transport} data-session-id={book.transportSessionId ?? ''} data-spread={book.currentSpreadId} data-book-epoch={book.bookEpoch} data-lesson-revision={lesson.revision} data-prints-ready={prints.ready} data-print-count={prints.surfaces.size} data-print-pages={printPageIds.join(',')}
    data-renderer="ink" data-print-generation={prints.generation} data-focus-hotspot={interaction.focusId ?? ''} data-pressed-hotspot={interaction.pressedId ?? ''}
    data-drag-hover={dragHover && (dragAvailability.next || dragAvailability.prev)} data-drag-active={!!book.gesture?.pointerActive} data-hotspot-hover={!!interaction.hoverId}
    onPointerDown={event => {
      const pending = pendingHit.current?.pointerId === event.pointerId ? pendingHit.current.hit : null;
      pendingHit.current = null;
      if (pending?.hotspot && event.button === 0 && event.isPrimary && !pointerOwner.current) {
        // A printed control owns its paper, enabled or not: it never starts a page drag (as DOM controls in v2).
        if (pending.hotspot.enabled && bookCanInteract(bookRef.current)) beginPress(event, pending, pending.hotspot);
        return;
      }
      const hit = pointerCorner(event);
      // v3 R6: no drag from a shot (the reducer refuses it); the press brings the reading pose back.
      if (hit && bookRef.current.camera === 'shot') { returnToReading(); return; }
      if (hit) pointerDown(event, hit.direction, hit.corner);
    }}
    onPointerMove={event => {
      const press = hotspotPointer.current;
      if (press) {
        if (event.pointerId === press.id && Math.hypot(event.clientX - press.x, event.clientY - press.y) >= PRESS_SLOP) cancelPointer();
        return;
      }
      if (pointerOwner.current) { pointerMove(event); return; }
      const hit = onPaper(event) && bookCanInteract(bookRef.current) ? pageHit(event.clientX, event.clientY) : null;
      const hover = hit?.hotspot?.enabled ? hit.hotspot.id : null;
      setHoverId(hover);
      setDragHover(!hover && !!pointerCorner(event));
    }}
    onPointerUp={event => { if (!finishPress(event)) pointerUp(event); }} onPointerCancel={cancelPointer}
    onPointerLeave={() => { if (!pointerOwner.current) { setDragHover(false); setHoverId(null); } }} onKeyDown={event => {
    if (event.key === 'Escape' && intro) { event.preventDefault(); send({ type: 'SKIP_INTRO', inputId: ++inputId.current }); }
    else if (event.key === 'Escape' && pointerOwner.current) { event.preventDefault(); cancelPointer(); }
    // v3 R5: the records dialog is modal; the book does not take its keys (EN02).
    else if (recordsOpen) return;
    // v3 R6: Escape ends a lesson shot (back to the reading pose).
    else if (event.key === 'Escape' && shotRef.current) { event.preventDefault(); returnToReading(); }
    else {
      const direction = arrowNavigationDirection({ ...event,
        // React's synthetic keyboard interface does not copy composition state
        // or the shadow-DOM path from the native event.
        isComposing: event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229,
        composedPath: () => event.nativeEvent.composedPath(),
      });
      if (direction && navigate(direction, 'keyboard')) event.preventDefault();
    }
  }} onPointerDownCapture={event => {
    if ((pointerOwner.current && pointerOwner.current.id !== event.pointerId)
      || (scenePointer.current && scenePointer.current.id !== event.pointerId)
      || (hotspotPointer.current && hotspotPointer.current.id !== event.pointerId)) {
      cancelPointer();
      // Do not let a different primary pointer type start a new drag from the
      // still-current React render. Leave browser pan/pinch defaults untouched.
      event.stopPropagation();
      return;
    }
    scenePointer.current = null;
    // One raycast per press: the bubble handler reads the same page hit.
    const paper = onPaper(event);
    const hit = paper ? pageHit(event.clientX, event.clientY) : null;
    pendingHit.current = { pointerId: event.pointerId, hit };
    // The figure is the printed window plus whatever of the standing figure the eye sees above it.
    const scene = musicSceneRef.current;
    const figure = !hit?.hotspot && (hit?.figure || paper && !!scene && !!stageRef.current?.pickScene(event.clientX, event.clientY, scene.pickTargets));
    if (book.scene === 'ready' && !pointerOwner.current && figure && event.button === 0 && event.isPrimary) scenePointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }} onPointerUpCapture={event => {
    const owner = scenePointer.current;
    scenePointer.current = null;
    if (!owner || event.pointerId !== owner.id || Math.hypot(event.clientX - owner.x, event.clientY - owner.y) >= 8 || book.scene !== 'ready') return;
    const scene = musicSceneRef.current;
    const object = scene && stageRef.current?.pickScene(event.clientX, event.clientY, scene.pickTargets);
    const pick = object && scene?.pickEvent(object);
    if (pick) { command({ type: 'selectLane', laneId: pick.laneId }); command({ type: 'select', id: pick.eventId }); }
  }} onPointerCancelCapture={() => { scenePointer.current = null; }} onLostPointerCapture={event => {
    if (scenePointer.current?.id === event.pointerId) scenePointer.current = null;
    if (pointerOwner.current?.id === event.pointerId || hotspotPointer.current?.id === event.pointerId) cancelPointer();
  }}>
    <div ref={hostRef} className="book-stage" aria-hidden="true" />
    {(!stageReady || book.mode === '2d') && !book.isOpen && <div className="book-first-paint"><img src="/book/front-cover-preview.png" alt="" /><span>{book.phase === 'bootLoading' ? '책을 준비하고 있어요' : ''}</span></div>}
    {coverVisible && <div className={`book-cover-controls ${!layout || book.mode === '2d' ? 'book-cover-controls--flat' : ''}`} style={layout && book.mode === '3d' ? pageStyle(layout.cover) : undefined}>
      {!(progress.savedSpread && book.phase === 'coverIdle') && <button className="book-open book-cover-primary" aria-label={intro ? '카메라 이동 건너뛰기' : '음악이론 교과서 펼치기'} disabled={book.phase === 'bootLoading'} onClick={() => open()}><span className="book-sr-only">{intro ? '바로 보기' : '책 펼치기'}</span></button>}
      {intro && <button className="book-cover-caption" onClick={() => open()}>바로 보기</button>}
      {book.phase === 'coverIdle' && (progress.savedSpread ? <div className="book-cover-choices">
        <button className="book-cover-primary book-text-button" disabled={!supportsStoredSpread(progress.savedSpread)} onClick={() => {
          if (progress.savedSpread && supportsStoredSpread(progress.savedSpread)) open(progress.savedSpread, true);
        }}>이어서 펼치기 {progress.savedSpread.replace('spread-', '')}</button>
        <button className="book-cover-primary book-text-button" onClick={() => open('spread-1')}>처음부터 둘러보기</button>
      </div> : <span className="book-cover-caption" aria-hidden="true">표지를 눌러 펼쳐 보세요</span>)}
      {/* v3 R7: loading drawn as an ink line in the hint area (cover → body fonts → notation → first prints); the text stays. */}
      {book.mode === '3d' && !prints.ready && <svg className="book-cover-progress" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true" data-preload={stageReady ? prints.preload : 'cover'}>
        <line className="book-cover-progress-track" x1="2" y1="2" x2="98" y2="2" />
        <line className="book-cover-progress-ink" x1="2" y1="2" x2={2 + 96 * (stageReady ? COVER_PRELOAD[prints.preload] : 0.12)} y2="2" />
      </svg>}
      {book.phase === 'coverIdle' && !progress.canSave && <p className="book-cover-storage-notice" role="status">{progress.notice} 책을 펼친 뒤 아래 조작바의 ‘기록’에서 원문을 내보낼 수 있어요.</p>}
      {error && book.mode === '2d' && <div className="book-cover-message" role="status">{error}<button onClick={retry3D}>3D 다시 시도</button></div>}
    </div>}
    {book.mode === '2d' && BOOK_SPREADS.filter(spread => livePagesVisible && book.currentSpreadId === spread.spreadId).map(spread => {
      // v3 R8: the contents and closing read the same page DSL as their prints.
      if (!spread.sceneId) {
        const context = { lesson, sceneId: null, playback: idlePlayback, hints: progress.hints, ui: pageUi, interactive: bookCanInteract(book) };
        return <div key={spread.spreadId} className="book-paper-dom" data-book-surface="true" inert={!bookCanInteract(book)}>
          {(['left', 'right'] as const).map(side => <section key={side} className={`book-page book-page--${side}`} data-active-page="true">
            <div className="book-page-scroll" data-print-page={side === 'left' ? spread.leftPageId : spread.rightPageId}>
              <MatterPage spec={pageSpecFor(side === 'left' ? spread.leftPageId : spread.rightPageId)} context={context}
                onCommand={matterCommand} />
              {side === 'right' && error && <p className="book-page-error" role="status" data-snapshot-exclude="true">
                {error}<button onClick={retry3D}>3D 다시 시도</button>
              </p>}
            </div>
          </section>)}
        </div>;
      }
      // v3 R3: DOM pages are the 2D reading book only. The 3D book is printed (no .book-page in 3D).
      // v3 R5: the record tools live in the toolbar's records dialog in both modes.
      const progressTools = !progress.canSave ? <p className="book-page-error" role="status">자동 저장을 멈췄어요. {progress.notice}</p> : null;
      const props = { lesson, sceneId: spread.sceneId, interactive: true,
        playback, playingLane, onCommand: command, onPlay: play, onPause: pause, onResume: resume, onStop: () => stop('user-stop'), onMute: () => updatePreferences({ muted: !progress.preferences.muted }),
        onMode: changeReadingMode, mode: book.mode, reducedMotion: book.reducedMotion,
        hints: progress.hints, onHint: progress.setHint, preparationEpoch: book.bookEpoch, progressTools };
      return <div key={spread.spreadId} className="book-paper-dom" data-book-surface="true" inert={!bookCanInteract(book)}>
        {(['left', 'right'] as const).map(side => <section key={side} className={`book-page book-page--${side}`} data-active-page="true">
          <div className="book-page-scroll" data-print-page={side === 'left' ? spread.leftPageId : spread.rightPageId}>
            {side === 'left' ? <LessonLeftPage {...props} /> : <LessonRightPage {...props} />}
            {side === 'right' && error && <p className="book-page-error" role="status" data-snapshot-exclude="true">
              {error}<button onClick={retry3D}>3D 다시 시도</button>
            </p>}
          </div>
        </section>)}
      </div>;
    })}
    {mirrorVisible && mirrorPages.length === 2 && <AccessibleMirror key={`${book.bookEpoch}:${book.sceneInstanceId}`} spreadId={book.currentSpreadId} pages={mirrorPages}
      inert={!interactive} onActivate={activateMirror} onFocusHotspot={focusMirror} />}
    {/* v3 R5 (C1·C9): global controls in one row outside the book; the edge bookmarks are gone. */}
    <Toolbar ref={toolbarRef} visible={toolbarVisible} first={bookIndex(book.currentSpreadId) === 0} last={lastSpread} folio={folio}
      muted={progress.preferences.muted} reducedMotion={progress.preferences.reducedMotion} mode={book.mode} contentsEnabled={book.currentSpreadId !== 'contents'}
      onPrev={() => navigate('prev', 'button')} onNext={() => navigate('next', 'button')} onContents={() => goTo('contents')}
      onSound={() => updatePreferences({ muted: !progress.preferences.muted })}
      onStill={() => updatePreferences({ reducedMotion: !progress.preferences.reducedMotion })}
      onReadingMode={changeReadingMode} onRecords={() => setRecordsOpen(true)} />
    <span className="book-sr-only" role="status">{book.isOpen ? playbackStatus : ''}</span>
    <RecordsDialog key={book.bookEpoch} open={recordsOpen} onClose={closeRecords} storageNotice={progress.canSave ? null : progress.notice}
      busy={!interactive || playingState(playback?.state)} notice={progress.notice} protectedRaw={progress.protectedRaw} backups={progress.backups}
      exportedText={progress.exportedText} preview={progress.preview} preferences={progress.preferences} onPreferences={updatePreferences}
      onOpen={openRecords} onExport={progress.exportCurrent} onPreviewImport={progress.previewImport}
      onConfirmImport={progress.confirmImport} onCancelImport={progress.cancelImport} onDelete={progress.deleteAll} />
    {book.isOpen && book.phase !== 'closing' && <>
      {layout && book.mode === '3d' && (['next', 'prev'] as const).flatMap(direction => (['top', 'bottom'] as const).map(corner => {
        const quad = direction === 'next' ? layout.right : layout.left;
        const region = turnCornerRegion(quad, direction, corner);
        if (!region) return null;
        // The marker never intercepts a lesson control. Start is delegated from
        // the real page target to the stable root, which owns pointer capture.
        return <div key={`${direction}-${corner}`} className="book-corner" data-page-corner={`${direction}-${corner}`} aria-hidden="true"
          data-drag-enabled={dragAvailability[direction]} style={pageStyle(region)} />;
      }))}
    </>}
  </main>;
}
