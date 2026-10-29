import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { bookCanInteract, bookReducer, bookToken, createBookState, tokenMatches } from './controller.ts';
import type { BookEvent } from './controller.ts';
import { BOOK_MOTION, tween } from './motion.ts';
import type { BookStage, StageLayout, StageUpdate } from './stage.ts';
import { pageStyle } from './pageProjection.ts';
import { BOOK_MANIFEST, pagePrintIds, spreadIndex, turningLeaf } from './manifest.ts';
import type { PageId, SpreadId } from './manifest.ts';
import type { Texture } from 'three';
import { arrowNavigationDirection, createTurnDrag, turnReleaseDecision, updateTurnDrag } from './gesture.ts';
import type { TurnDragState } from './gesture.ts';
import { pointOnScrollbar, turnCornerAtPoint, turnCornerRegion, turnInputAvailability, turnTargetOwnsInput } from './turnHit.ts';
import { navigationButtonPosition } from './navigationPlacement.ts';
import { lessonSceneCenter } from './lessonPresentation.ts';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { SceneHost } from './SceneHost.ts';
import { reduceLesson } from '../lesson/controller.ts';
import type { LessonCommand, LessonState } from '../lesson/controller.ts';
import type { LessonScene } from './lessonScene.ts';
import { LessonLeftPage, LessonRightPage } from './LessonPages.tsx';
import { useBookAudio } from './useBookAudio.ts';
import { usePagePrints } from './usePagePrints.ts';
import type { PlaybackSnapshot } from '../audio/AudioEngine.ts';
import { loadInitialBookProgress, supportsStoredSpread, useBookProgress } from './useBookProgress.ts';
import { BookProgressTools } from './BookProgressTools.tsx';
import type { BookPreferences } from '../persistence/bookProgress.ts';

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
  const { playback, playingLane, play, pause, resume, stop, setPreferences: setAudioPreferences } = useBookAudio({ book, lesson, onFrame: onAudioFrame });
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<BookStage | null>(null);
  const printsRef = useRef<Map<PageId, Texture>>(new Map());
  const sceneHostRef = useRef<SceneHost | null>(null);
  const [hostReady, setHostReady] = useState(false);
  const [preparedScene, setPreparedScene] = useState('');
  const visited = useRef(new Set<string>());
  const restoringCancel = useRef(false);
  const restoredOpening = useRef(false);
  const visual = useRef<StageUpdate>({ coverProgress: 0, introProgress: book.reducedMotion ? 1 : 0, currentSpreadIndex: 0, spreadCount: BOOK_MANIFEST.length, turn: null, sceneProgress: 0 });
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

  // Semantic layout and print resolution change only at a settled book pose.
  // Camera reframing still uses the live projected quads, but must not trigger
  // notation/capture work every frame and repeatedly cancel its own barrier.
  const printSize = useRef({ width: 400, height: 588 });
  if (layout && ['bootLoading', 'coverIdle', 'spreadIdle', 'fallback2D'].includes(book.phase)) {
    printSize.current = {
      width: Math.hypot(layout.right.tr.x - layout.right.tl.x, layout.right.tr.y - layout.right.tl.y),
      height: Math.hypot(layout.right.bl.x - layout.right.tl.x, layout.right.bl.y - layout.right.tl.y),
    };
  }
  const pageWidth = printSize.current.width;
  const pageHeight = printSize.current.height;
  const printError = useCallback((reason: Error) => {
    reportError('print', reason, '페이지 그림을 준비하지 못해 2D 책으로 전환했어요. 만든 리듬과 답은 그대로예요.');
    // A failed surface cannot hold the reader behind an invisible preparing UI.
    // Recover the committed spread using the same lesson data.
    dispatch({ type: 'USE_2D' });
  }, [reportError]);
  const audioMuted = playback?.muted ?? false;
  const audioError = playback?.error ?? null;
  const stoppedPlayback = useMemo<PlaybackSnapshot>(() => ({ state: 'ready', sessionId: null, startTime: null,
    logicalDuration: 0, currentPosition: 0, relativePosition: 0, activeEventId: null, loop: false,
    muted: audioMuted, error: audioError, lastStopReason: null, lastCompletedSessionId: null,
    completedSessionId: null, activeSourceCount: 0, logicalOffset: 0, snapshotRevision: null,
    uninterrupted: false, lastUninterruptedCompletedSessionId: null }), [audioMuted, audioError]);
  const printPageIds = useMemo(() => pagePrintIds(book.currentSpreadId), [book.currentSpreadId]);
  const prints = usePagePrints({ root: rootRef, revision: lesson.revision, width: pageWidth, height: pageHeight, pageIds: printPageIds,
    enabled: stageReady && book.mode === '3d', preparationEpoch: book.bookEpoch, presentationKey: JSON.stringify([audioMuted, audioError,
      progress.preferences, progress.hints, progress.canSave, progress.notice, progress.backups, progress.protectedRaw,
      progress.exportedText, progress.preview]), onError: printError });
  printsRef.current = prints.textures;
  // A button navigation keeps its stopped page visible (and inert) while a fresh
  // print is prepared. Direct dragging uses the already-warm stopped print.
  const waitingForPrint = (book.phase === 'preparingTurn' && !book.gesture || book.phase === 'closing') && !prints.ready;
  const livePagesVisible = book.isOpen && (['spreadIdle', 'fallback2D'].includes(book.phase) || waitingForPrint);
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
  const changeReadingMode = () => {
    if (bookRef.current.mode === '2d') { retry3D(); return; }
    stop('reading-mode');
    setError('');
    progress.updatePreferences({ mode: '2d' });
    send({ type: 'USE_2D' });
  };

  useEffect(() => {
    const sceneId = BOOK_MANIFEST[spreadIndex(book.currentSpreadId)].sceneId;
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
  useEffect(() => {
    const root = rootRef.current;
    if (!root || book.mode !== '3d') return;
    const align = () => {
      const page = root.querySelector<HTMLElement>('.book-page--right[data-active-page="true"]');
      const window = page?.querySelector<HTMLElement>('.book-popup-window');
      if (!page || !window || !layout) return;
      const paper = page.getBoundingClientRect();
      const area = window.getBoundingClientRect();
      const height = layout.pageWorld.height;
      const toZ = (y: number) => ((y - paper.top) / paper.height - 0.5) * height;
      const laneCenter = lessonSceneCenter(BOOK_MANIFEST[spreadIndex(book.currentSpreadId)].sceneId);
      stageRef.current?.setSceneWindow({ offsetZ: toZ((area.top + area.bottom) / 2) - laneCenter,
        minZ: toZ(Math.max(paper.top, area.top)), maxZ: toZ(Math.min(paper.bottom, area.bottom)),
        visible: area.bottom > paper.top && area.top < paper.bottom });
    };
    align();
    root.addEventListener('scroll', align, true);
    return () => root.removeEventListener('scroll', align, true);
  }, [layout, preparedScene, book.currentSpreadId, book.phase, book.mode, lesson.revision]);
  const command = (event: LessonCommand) => {
    if (bookRef.current.scene !== 'ready' || !bookRef.current.isOpen || bookRef.current.hidden) return;
    setLesson(previous => reduceLesson(previous, event, { playing: playback?.state === 'playing' || playback?.state === 'starting' || playback?.state === 'paused' }));
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let alive = true;
    let cleanup: (() => void) | undefined;
    void import('./inspector.ts').then(({ attachBookInspector }) => {
      if (alive) cleanup = attachBookInspector({ getStage: () => stageRef.current, getVisual: () => visual.current, draw, getRoot: () => rootRef.current });
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
      owned = createBookStage(host, {
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
          }
          if (metrics.coverReady && !metrics.contextLost) setStageReady(true);
        },
      });
      stageRef.current = owned;
      owned?.update(visual.current);
      const spread = BOOK_MANIFEST[spreadIndex(bookRef.current.currentSpreadId)];
      owned?.setPageTextures({ staticLeft: printsRef.current.get(spread.leftPageId) ?? null, staticRight: printsRef.current.get(spread.rightPageId) ?? null });
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

  useLayoutEffect(() => {
    const current = BOOK_MANIFEST[spreadIndex(book.currentSpreadId)];
    const leaf = book.destinationSpreadId ? turningLeaf(book.currentSpreadId, book.destinationSpreadId) : null;
    const leafVisible = leaf && !book.reducedMotion && (book.phase !== 'preparingTurn' || !!bookRef.current.gesture);
    const texture = (id: PageId) => printsRef.current.get(id) ?? null;
    const live = livePagesVisible;
    stageRef.current?.setPageTextures(leafVisible ? {
      staticLeft: texture(leaf.stationaryLeftPageId), staticRight: texture(leaf.stationaryRightPageId),
      turnFront: texture(leaf.frontPageId), turnBack: texture(leaf.backPageId),
    } : { staticLeft: live ? null : texture(current.leftPageId), staticRight: live ? null : texture(current.rightPageId),
      turnFront: leaf ? texture(leaf.frontPageId) : null, turnBack: leaf ? texture(leaf.backPageId) : null });
    if (leafVisible) draw({ turn: { direction: leaf.direction === 'next' ? 'forward' : 'backward', progress: bookRef.current.progress, corner: bookRef.current.gesture?.corner ?? 'bottom' } });
    if (!leaf || book.reducedMotion) draw({ currentSpreadIndex: spreadIndex(book.currentSpreadId), turn: null,
      ...(book.reducedMotion && book.gesture?.pointerActive ? { sceneProgress: 1 } : {}) });
  }, [book.currentSpreadId, book.destinationSpreadId, book.phase, book.isOpen, book.reducedMotion, book.gesture?.pointerActive, stageReady, prints.generation, livePagesVisible, draw]);

  useEffect(() => {
    if (!stageReady || book.mode === '2d') return;
    let alive = true;
    let host: SceneHost | null = null;
    setHostReady(false);
    void import('./SceneHost.ts').then(({ SceneHost: Host }) => {
      if (!alive) return;
      host = new Host({
        attach(group) { draw({ sceneProgress: 0 }); stageRef.current?.setSceneGroup(group); },
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
    const sceneId = BOOK_MANIFEST[spreadIndex(current.currentSpreadId)].sceneId;
    void import('./lessonScene.ts').then(({ createLessonScene }) => host.replace({ sceneId, load(signal) {
      if (signal.aborted || !tokenMatches(bookRef.current, token)) throw new DOMException('Scene preparation cancelled', 'AbortError');
      prepared = createLessonScene(sceneId, lessonRef.current);
      return prepared;
    } }, token)).then(result => {
      if (!alive || result !== 'ready' || !tokenMatches(bookRef.current, token)) return;
      musicSceneRef.current = prepared;
      setPreparedScene(key);
      if (bookRef.current.scene !== 'entering') { draw({ sceneProgress: 1 }); host.markReady(token); }
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
      draw({ coverProgress: current.isOpen ? 1 : 0, introProgress: 1, sceneProgress: current.isOpen ? 1 : 0, turn: null });
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
    const turn = (progress: number) => {
      draw(current.reducedMotion ? { turn: null, sceneProgress: current.gesture ? 1 : 0 }
        : { turn: { direction: current.direction === 'next' ? 'forward' : 'backward', progress, corner: current.gesture?.corner ?? 'bottom' }, sceneProgress: current.phase === 'cancelSettling' ? Math.max(0, 1 - progress / 0.16) : 0 });
      send({ type: 'TURN_PROGRESS', token, progress });
    };
    if (current.phase === 'preparingTurn') {
      if (!printMotionReady && current.mode === '3d') return;
      if (current.gesture) { send({ type: 'TURN_PREPARED', token }); return; }
      return tween(visual.current.sceneProgress ?? 0, 0, duration(BOOK_MOTION.exit), value => draw({ sceneProgress: value }), () => send({ type: 'TURN_PREPARED', token }));
    }
    if (current.phase === 'turningForward' || current.phase === 'turningBack') {
      if (current.gesture?.pointerActive) return;
      return tween(current.progress, 1, duration(BOOK_MOTION.turn * (1 - current.progress)), turn, () => send({ type: 'TURN_COMPLETE', token }));
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
      const entryDuration = restoringCancel.current ? 0 : visited.current.has(current.currentSpreadId) ? BOOK_MOTION.revisit : BOOK_MOTION.enter;
      restoringCancel.current = false;
      return tween(0, 1, duration(entryDuration), value => draw({ sceneProgress: value }), () => {
        sceneHostRef.current?.markReady(token);
        visited.current.add(current.currentSpreadId);
        send({ type: 'SCENE_READY', token });
      });
    }
  }, [book.phase, book.scene, book.hidden, book.navigationToken, book.bookEpoch, book.sceneInstanceId, book.reducedMotion, book.mode, book.gesture?.pointerActive, preparedScene, printMotionReady, draw, send]);

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
    textureCount: prints.textures.size, requiredTextureCount: printPageIds.length, preparedScene, pointerOwned: !!pointerOwner.current };
  const dragAvailability = turnInputAvailability(dragReadiness);
  const pointerCorner = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.defaultPrevented || !layout || !hostRef.current) return null;
    if (!(event.target instanceof Element) || !event.target.closest('.book-page[data-active-page="true"]')) return null;
    const path = event.nativeEvent.composedPath();
    if (turnTargetOwnsInput(event.target) || path.some(turnTargetOwnsInput)) return null;
    const point = { x: event.clientX, y: event.clientY };
    if (path.some(node => node instanceof HTMLElement && node.matches('.book-page-scroll')
      && pointOnScrollbar(point, { rect: node.getBoundingClientRect(), offsetWidth: node.offsetWidth,
        offsetHeight: node.offsetHeight, clientWidth: node.clientWidth, clientHeight: node.clientHeight,
        clientLeft: node.clientLeft, clientTop: node.clientTop }))) return null;
    const rect = hostRef.current.getBoundingClientRect();
    // Read the print getter now: a scroll/refresh can invalidate it before React commits.
    const available = turnInputAvailability({ ...dragReadiness, book: bookRef.current,
      printsReady: prints.ready, pointerOwned: !!pointerOwner.current });
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

  const intro = book.phase === 'introReady' || book.phase === 'introMoving';
  const coverVisible = !book.isOpen && book.phase !== 'opening';
  const open = (spreadId: SpreadId = 'spread-1', resumeSaved = false) => {
    const id = ++inputId.current;
    const event: BookEvent = intro ? { type: 'SKIP_INTRO', inputId: id } : { type: 'OPEN_BOOK', inputId: id, spreadId };
    if (bookReducer(bookRef.current, event) === bookRef.current) return;
    if (!intro) {
      progress.activate();
      restoredOpening.current = resumeSaved;
      if (resumeSaved) visited.current.add(spreadId);
    }
    send(event);
  };
  const navigate = (direction: 'next' | 'prev', source: 'keyboard' | 'button'): boolean => {
    const current = bookRef.current;
    const event: BookEvent = { type: direction === 'next' ? 'NEXT' : 'PREV', source };
    // The pure reducer is also the acceptance guard: ignored boundaries and
    // competing gestures must not stop audio or invalidate a prepared print.
    const predicted = bookReducer(current, event);
    if (pointerOwner.current || predicted === current) return false;
    stop('page-navigation');
    // Only a new turn/close advances this token. Updating the pending intent
    // must keep the in-flight capture; repeated taps otherwise restart it.
    if (predicted.navigationToken !== current.navigationToken) prints.refresh();
    send(event);
    return true;
  };
  return <main ref={rootRef} className={`book-app ${book.mode === '2d' ? 'book-app--2d' : ''}`} data-phase={book.phase} data-camera={book.camera} data-scene={book.scene} data-transport={book.transport} data-session-id={book.transportSessionId ?? ''} data-spread={book.currentSpreadId} data-book-epoch={book.bookEpoch} data-lesson-revision={lesson.revision} data-prints-ready={prints.ready} data-print-count={prints.textures.size} data-print-pages={printPageIds.join(',')}
    data-drag-hover={dragHover && (dragAvailability.next || dragAvailability.prev)} data-drag-active={!!book.gesture?.pointerActive}
    onPointerDown={event => { const hit = pointerCorner(event); if (hit) pointerDown(event, hit.direction, hit.corner); }}
    onPointerMove={event => { if (pointerOwner.current) pointerMove(event); else setDragHover(!!pointerCorner(event)); }}
    onPointerUp={pointerUp} onPointerCancel={cancelPointer}
    onPointerLeave={() => { if (!pointerOwner.current) setDragHover(false); }} onKeyDown={event => {
    if (event.key === 'Escape' && intro) { event.preventDefault(); send({ type: 'SKIP_INTRO', inputId: ++inputId.current }); }
    else if (event.key === 'Escape' && pointerOwner.current) { event.preventDefault(); cancelPointer(); }
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
      || (scenePointer.current && scenePointer.current.id !== event.pointerId)) {
      cancelPointer();
      // Do not let a different primary pointer type start a new drag from the
      // still-current React render. Leave browser pan/pinch defaults untouched.
      event.stopPropagation();
      return;
    }
    scenePointer.current = null;
    const target = event.target as HTMLElement;
    if (book.scene === 'ready' && !pointerOwner.current && target.closest('.book-popup-window') && event.button === 0 && event.isPrimary) scenePointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
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
    if (pointerOwner.current?.id === event.pointerId) cancelPointer();
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
      {book.phase === 'coverIdle' && !progress.canSave && <p className="book-cover-storage-notice" role="status">{progress.notice} 책 안의 ‘기록과 설정’에서 원문을 내보낼 수 있어요.</p>}
      {error && book.mode === '2d' && <div className="book-cover-message" role="status">{error}<button onClick={retry3D}>3D 다시 시도</button></div>}
    </div>}
    {BOOK_MANIFEST.map(spread => {
      const active = livePagesVisible && book.currentSpreadId === spread.spreadId;
      // Lifecycle input ownership belongs to the inert page wrapper. Keeping the
      // ready appearance avoids a disabled-style flash when DOM becomes print.
      const props = { lesson, sceneId: spread.sceneId, interactive: true,
        playback: active ? playback : stoppedPlayback, playingLane: active ? playingLane : null, onCommand: command, onPlay: play, onPause: pause, onResume: resume, onStop: () => stop('user-stop'), onMute: () => updatePreferences({ muted: !progress.preferences.muted }),
        onMode: changeReadingMode, mode: book.mode, pageWidth: book.mode === '2d' ? undefined : Math.max(120, pageWidth - 34), reducedMotion: book.reducedMotion,
        hints: progress.hints, onHint: progress.setHint, preparationEpoch: book.bookEpoch,
        progressTools: <>
          {!progress.canSave && <p className="book-page-error" role="status">자동 저장을 멈췄어요. {progress.notice}</p>}
          <BookProgressTools key={`${book.bookEpoch}:${spread.spreadId}`} busy={!active || !bookCanInteract(book) || !!playback && ['starting', 'playing', 'paused'].includes(playback.state)}
            notice={progress.notice} protectedRaw={progress.protectedRaw} backups={progress.backups} exportedText={progress.exportedText}
            preview={progress.preview} preferences={progress.preferences} onPreferences={updatePreferences}
            onOpen={() => stop('record-tools')} onExport={progress.exportCurrent} onPreviewImport={progress.previewImport}
            onConfirmImport={progress.confirmImport} onCancelImport={progress.cancelImport} onDelete={progress.deleteAll} />
        </> };
      return <div key={spread.spreadId} className={`book-paper-dom${active ? '' : ' book-paper-dom--preparing'}`} data-book-surface="true" inert={!active || !bookCanInteract(book)} aria-hidden={!active}>
        {(['left', 'right'] as const).map(side => <section key={side} className={`book-page book-page--${side}`} data-active-page={active} style={active && layout && book.mode === '3d' ? pageStyle(layout[side]) : active && book.mode === '2d' ? undefined : { width: pageWidth, height: pageHeight }}>
          <div className="book-page-scroll" data-print-page={side === 'left' ? spread.leftPageId : spread.rightPageId}>
            {side === 'left' ? <LessonLeftPage {...props} /> : <LessonRightPage {...props} />}
            {active && side === 'right' && error && book.mode === '2d' && <p className="book-page-error" role="status" data-snapshot-exclude="true">
              {error}<button onClick={retry3D}>3D 다시 시도</button>
            </p>}
          </div>
        </section>)}
      </div>;
    })}
    {book.isOpen && book.phase !== 'closing' && <>
      <div className="book-navigation book-navigation--prev" style={layout && book.mode === '3d' ? navigationButtonPosition(layout, 'prev') : undefined}>
        <button data-testid="book-prev" className="book-text-button" aria-label={book.currentSpreadId === 'spread-1' ? '표지로' : '이전 펼침면'} onClick={() => navigate('prev', 'button')}>←</button>
      </div>
      <div className="book-navigation book-navigation--next" style={layout && book.mode === '3d' ? navigationButtonPosition(layout, 'next') : undefined}>
        <button data-testid="book-next" className="book-text-button" aria-label="다음 펼침면" disabled={spreadIndex(book.phase === 'cancelSettling' ? book.currentSpreadId : book.destinationSpreadId ?? book.currentSpreadId) + 1 >= BOOK_MANIFEST.length} onClick={() => navigate('next', 'button')}>→</button>
      </div>
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
