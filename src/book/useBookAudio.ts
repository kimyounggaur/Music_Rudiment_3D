import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { AudioEngine, PlaybackSnapshot } from '../audio/AudioEngine.ts';
import { TransportAdapter } from '../audio/TransportAdapter.ts';
import { frac } from '../domain/index.ts';
import { sceneEvents } from '../lesson/controller.ts';
import type { LessonState } from '../lesson/controller.ts';
import { bookCanInteract, bookToken } from './controller.ts';
import type { BookState } from './controller.ts';
import { BOOK_MANIFEST } from './manifest.ts';
import { audioOwnerIsCurrent, sameAudioOwner } from './audioOwnership.ts';
import { lessonPlaybackDuration } from './lessonPresentation.ts';
import type { BookAudioOwner } from './audioOwnership.ts';

export interface BookAudioOptions {
  book: BookState;
  lesson: LessonState;
  onFrame?(snapshot: PlaybackSnapshot | null, laneId: string | null): void;
}

export interface BookAudio {
  /** One engine per mounted book. Prefer stop() so UI and frame ownership also reset. */
  audioRef: RefObject<AudioEngine | null>;
  playback: PlaybackSnapshot | null;
  playingLane: string | null;
  play(laneId: string): Promise<PlaybackSnapshot | null>;
  pause(): PlaybackSnapshot | null;
  resume(): Promise<PlaybackSnapshot | null>;
  stop(reason?: string): void;
  toggleMute(): void;
  setPreferences(preferences: Readonly<{ muted: boolean; volume: number }>): void;
}

const running = (snapshot: PlaybackSnapshot) => snapshot.state === 'starting' || snapshot.state === 'playing';
const retained = (snapshot: PlaybackSnapshot) => running(snapshot) || snapshot.state === 'paused';
const visible = () => typeof document === 'undefined' || !document.hidden;

/** Book transport: explicit play/resume gestures, never autoplay or inferred listening. */
export function useBookAudio(options: BookAudioOptions): BookAudio {
  const audioRef = useRef<AudioEngine | null>(null);
  const latest = useRef(options);
  const mounted = useRef(false);
  const owner = useRef<BookAudioOwner | null>(null);
  const operationSequence = useRef(0);
  const pending = useRef<{ owner: BookAudioOwner; id: number; promise: Promise<PlaybackSnapshot | null> } | null>(null);
  const frame = useRef<number | null>(null);
  const [playback, setPlayback] = useState<PlaybackSnapshot | null>(null);
  const [playingLane, setPlayingLane] = useState<string | null>(null);

  const cancelFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const publish = useCallback((snapshot: PlaybackSnapshot, laneId: string | null) => {
    if (!mounted.current) return;
    const activeLane = retained(snapshot) ? laneId : null;
    setPlayback(snapshot);
    setPlayingLane(activeLane);
    latest.current.onFrame?.(snapshot, activeLane);
  }, []);

  const stop = useCallback((reason = 'user-stop') => {
    operationSequence.current += 1;
    pending.current = null;
    owner.current = null;
    cancelFrame();
    const engine = audioRef.current;
    if (!engine) return;
    // Engine.stop invalidates a pending AudioContext.resume as well as scheduled
    // future sources, so a late promise cannot restart the departed scene.
    engine.stop(reason);
    publish(engine.getPlaybackSnapshot(), null);
  }, [cancelFrame, publish]);

  const isCurrent = useCallback((candidate: BookAudioOwner) => {
    const { book, lesson } = latest.current;
    return mounted.current && visible() && audioOwnerIsCurrent(candidate, book, lesson);
  }, []);

  const startFrames = useCallback((candidate: BookAudioOwner, engine: AudioEngine) => {
    cancelFrame();
    const tick = () => {
      frame.current = null;
      if (owner.current !== candidate || audioRef.current !== engine || !mounted.current) return;
      if (!isCurrent(candidate)) { stop('book-owner-changed'); return; }
      const snapshot = engine.getPlaybackSnapshot();
      if (!retained(snapshot)) owner.current = null;
      publish(snapshot, candidate.laneId);
      if (running(snapshot) && owner.current === candidate) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [cancelFrame, isCurrent, publish, stop]);

  const trackOperation = useCallback((candidate: BookAudioOwner, engine: AudioEngine,
    operation: Promise<PlaybackSnapshot>): Promise<PlaybackSnapshot | null> => {
    const id = ++operationSequence.current;
    const initial = engine.getPlaybackSnapshot();
    publish(initial, candidate.laneId);
    if (running(initial)) startFrames(candidate, engine);
    const promise = operation.then(() => {
      // Pause may retain the owner but invalidate this starting operation. A late
      // resolution must not replace its frozen position or a newer resume.
      if (id !== operationSequence.current || owner.current !== candidate || audioRef.current !== engine || !mounted.current) return null;
      if (!isCurrent(candidate)) { stop('stale-play'); return null; }
      const snapshot = engine.getPlaybackSnapshot();
      if (!retained(snapshot)) { owner.current = null; cancelFrame(); }
      publish(snapshot, candidate.laneId);
      return snapshot;
    }).finally(() => { if (pending.current?.id === id) pending.current = null; });
    pending.current = { owner: candidate, id, promise };
    return promise;
  }, [cancelFrame, isCurrent, publish, startFrames, stop]);

  const play = useCallback((laneId: string): Promise<PlaybackSnapshot | null> => {
    const engine = audioRef.current;
    const { book, lesson } = latest.current;
    if (!engine || !mounted.current || !visible() || !bookCanInteract(book)) return Promise.resolve(null);
    const spread = BOOK_MANIFEST.find(item => item.spreadId === book.currentSpreadId);
    if (!spread || !Object.hasOwn(lesson.scenes[spread.sceneId].patterns, laneId)) return Promise.resolve(null);
    const events = sceneEvents(lesson, spread.sceneId, laneId);
    if (events.length === 0) return Promise.resolve(null);
    const candidate: BookAudioOwner = {
      token: bookToken(book), revision: lesson.revision,
      spreadId: book.currentSpreadId, mode: book.mode, laneId, tempo: lesson.scenes[spread.sceneId].tempo,
    };
    const current = engine.getPlaybackSnapshot();
    // Preserve the engine's one-request guarantee at the UI boundary, before
    // stopping anything. A paused attempt resumes only through its own button.
    if (owner.current && isCurrent(owner.current) && retained(current)) {
      if (current.state === 'paused') return Promise.resolve(current);
      if (sameAudioOwner(owner.current, candidate)) return pending.current?.promise ?? Promise.resolve(current);
    }
    stop('lane-change');
    owner.current = candidate;
    // Invoke directly in the click/key handler; do not defer gesture unlock to
    // an effect. AudioEngine makes its own immutable validated event snapshot.
    const operation = engine.play({ events, tempo: { bpm: candidate.tempo, unit: frac(1, 4) }, logicalDuration: lessonPlaybackDuration(lesson, spread.sceneId, laneId) }, { loop: false, revision: candidate.revision });
    return trackOperation(candidate, engine, operation);
  }, [isCurrent, stop, trackOperation]);

  const pause = useCallback((): PlaybackSnapshot | null => {
    const candidate = owner.current;
    const engine = audioRef.current;
    if (!candidate || !engine) return null;
    if (!isCurrent(candidate)) { stop('stale-pause'); return null; }
    if (engine.getPlaybackSnapshot().state !== 'playing') return engine.getPlaybackSnapshot();
    operationSequence.current += 1;
    pending.current = null;
    cancelFrame();
    const snapshot = engine.pause();
    if (!retained(snapshot)) owner.current = null;
    publish(snapshot, candidate.laneId);
    return snapshot;
  }, [cancelFrame, isCurrent, publish, stop]);

  const resume = useCallback((): Promise<PlaybackSnapshot | null> => {
    const candidate = owner.current;
    const engine = audioRef.current;
    if (!candidate || !engine) return Promise.resolve(null);
    if (!isCurrent(candidate)) { stop('stale-resume'); return Promise.resolve(null); }
    if (pending.current?.owner === candidate) return pending.current.promise;
    const snapshot = engine.getPlaybackSnapshot();
    if (snapshot.state !== 'paused') {
      if (!retained(snapshot)) { owner.current = null; publish(snapshot, null); }
      return Promise.resolve(snapshot);
    }
    // The engine resumes its retained immutable snapshot, never current drafts.
    return trackOperation(candidate, engine, engine.resume(candidate.revision));
  }, [isCurrent, publish, stop, trackOperation]);

  const toggleMute = useCallback(() => {
    const engine = audioRef.current;
    if (!engine) return;
    engine.setMuted(!engine.getPlaybackSnapshot().muted);
    publish(engine.getPlaybackSnapshot(), owner.current?.laneId ?? null);
  }, [publish]);

  const setPreferences = useCallback((preferences: Readonly<{ muted: boolean; volume: number }>) => {
    const engine = audioRef.current;
    if (!engine) return;
    // These setters store values without creating/unlocking an AudioContext.
    engine.setMuted(preferences.muted);
    engine.setChannelGain('master', preferences.volume);
    publish(engine.getPlaybackSnapshot(), owner.current?.laneId ?? null);
  }, [publish]);

  useLayoutEffect(() => {
    latest.current = options;
    const candidate = owner.current;
    if (candidate && !isCurrent(candidate)) stop(options.book.hidden ? 'document-hidden' : 'book-owner-changed');
  }, [options, isCurrent, stop]);

  useEffect(() => {
    const engine = new TransportAdapter();
    audioRef.current = engine;
    mounted.current = true;
    // A paused book has no RAF. Native audio interruption must still reset its
    // frozen position immediately; restoring focus never restarts that session.
    const unsubscribe = engine.subscribe(snapshot => {
      if (!mounted.current || audioRef.current !== engine) return;
      if (!retained(snapshot)) {
        operationSequence.current += 1;
        pending.current = null;
        owner.current = null;
        cancelFrame();
      }
      publish(snapshot, owner.current?.laneId ?? null);
    });
    publish(engine.getPlaybackSnapshot(), null);
    const onVisibility = () => { if (document.hidden) stop('document-hidden'); };
    const onPageHide = () => stop('page-hidden');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      mounted.current = false;
      operationSequence.current += 1;
      pending.current = null;
      owner.current = null;
      cancelFrame();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      unsubscribe();
      engine.dispose();
      if (audioRef.current === engine) audioRef.current = null;
    };
  }, [cancelFrame, publish, stop]);

  return { audioRef, playback, playingLane, play, pause, resume, stop, toggleMute, setPreferences };
}
