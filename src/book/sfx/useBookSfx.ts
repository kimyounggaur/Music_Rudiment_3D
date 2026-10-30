import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { AudioEngine } from '../../audio/AudioEngine.ts';
import type { BookState } from '../controller.ts';
import type { SfxName } from './synthSfx.ts';

/**
 * v3 R7 effect mapping (REFACTOR_DESIGN_V3 §6 R7, CONTRACT_V3 C8). Book transitions pick the
 * effect; the gate keeps the rules: nothing before the reader's first gesture (opening the cover),
 * and no pen click while music plays (it would read as a note attack, AU contract).
 */
type TransitionState = Pick<BookState, 'phase' | 'gesture'>;

/** The effect a book transition makes, or null. Drags sound their turn when the release commits. */
export function transitionSfx(previous: TransitionState | null, next: TransitionState): SfxName | null {
  if (!previous || previous.phase === next.phase) return null;
  if (next.phase === 'opening') return 'cover-open';
  if (next.phase === 'closing') return 'cover-close';
  // TURN_PREPARED of a button or key turn.
  if ((next.phase === 'turningForward' || next.phase === 'turningBack') && previous.phase === 'preparingTurn' && !next.gesture) return 'page-turn';
  // A direct drag turns when its release commits (from the held turn, or before the turn was prepared).
  if (next.phase === 'settling' && next.gesture?.releaseDecision === 'commit') return 'page-turn';
  if ((previous.phase === 'settling' || previous.phase === 'cancelSettling') && (next.phase === 'spreadIdle' || next.phase === 'fallback2D')) return 'page-settle';
  return null;
}

export type SfxGate = Readonly<{ unlocked: boolean; musicPlaying: boolean }>;
export function sfxAllowed(name: SfxName, gate: SfxGate): boolean {
  if (!gate.unlocked) return false;
  return !(name === 'pen' && gate.musicPlaying);
}

export type SfxLogEntry = Readonly<{ name: SfxName; allowed: boolean; played: boolean; at: number }>;
export interface BookSfx {
  /** Play an effect if the gate allows it (the engine adds its own muted / setting / context checks). */
  play(name: SfxName): boolean;
  /** The reader's first gesture (opening the cover): resume the shared context, then effects may sound. */
  unlock(): void;
  /** DEV inspection: the last effect requests, newest last (allowed by the gate, played by the engine). */
  log(): readonly SfxLogEntry[];
}

export function useBookSfx(options: Readonly<{ book: BookState; audioRef: RefObject<AudioEngine | null>; musicPlaying: boolean }>): BookSfx {
  const unlocked = useRef(false);
  const previous = useRef<TransitionState | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const history = useRef<SfxLogEntry[]>([]);
  const play = useCallback((name: SfxName) => {
    const { audioRef, musicPlaying } = latest.current;
    const allowed = sfxAllowed(name, { unlocked: unlocked.current, musicPlaying });
    const played = allowed && (audioRef.current?.playSfx(name) ?? false);
    history.current.push({ name, allowed, played, at: Math.round(performance.now()) });
    if (history.current.length > 64) history.current.splice(0, history.current.length - 64);
    return played;
  }, []);
  const log = useCallback(() => history.current.slice(), []);
  const unlock = useCallback(() => {
    unlocked.current = true;
    // Same single context and resume policy as playback: only ever from a gesture.
    void latest.current.audioRef.current?.unlockFromGesture().catch(() => undefined);
  }, []);
  const { phase, gesture } = options.book;
  useEffect(() => {
    const next = { phase, gesture };
    const name = transitionSfx(previous.current, next);
    previous.current = next;
    if (name) play(name);
  }, [phase, gesture, play]);
  return useMemo(() => ({ play, unlock, log }), [play, unlock, log]);
}
