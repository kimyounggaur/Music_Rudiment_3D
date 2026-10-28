import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { BookToken } from './controller.ts';
import type { SpreadId } from './manifest.ts';

export interface PreparedScene {
  readonly group: Group;
  /** Owns all scene resources; the stage only borrows group. Must be idempotent. */
  dispose(): void;
}
export interface SceneDefinition {
  readonly sceneId: string;
  /** No input or audio. A rejecting loader must release its partial allocations. */
  load(signal: AbortSignal): PreparedScene | Promise<PreparedScene>;
}
export type SceneLoadResult = 'ready' | 'stale' | 'aborted';
export type SceneHostPhase = 'idle' | 'loading' | 'entering' | 'ready' | 'exiting' | 'error' | 'disposed';
export interface SceneHostSnapshot {
  readonly phase: SceneHostPhase;
  readonly inputBlocked: boolean;
  readonly activeSceneId: string | null;
  readonly activeToken: BookToken | null;
  readonly activeCount: number;
  readonly pendingCount: number;
  readonly loadsInFlight: number;
  readonly preparedCount: number;
  readonly disposedCount: number;
  readonly cleanupFailures: number;
}
export interface SceneHostEvent extends SceneHostSnapshot {
  readonly type: 'load' | 'attached' | 'ready' | 'exit' | 'abort' | 'released' | 'clear' | 'disposed' | 'stale' | 'error' | 'cleanup-error';
  readonly time: number;
  readonly sceneId: string | null;
  readonly token: BookToken | null;
  readonly reason?: string;
}
export interface SceneHostOptions {
  /** Set stage sceneProgress=0 when attaching a new group, before rendering it. */
  attach(group: Group | null): void;
  invalidate(): void;
  stopAudio(reason: string): void;
  isCurrent(token: BookToken): boolean;
  report?(event: SceneHostEvent): void;
}
type Owner = { sceneId: string; token: BookToken; generation: number; scene: PreparedScene; released: boolean };
type Pending = {
  sceneId: string; token: BookToken; generation: number; controller: AbortController;
  cancel(): void;
};
type LoadOutcome = { owner: Owner } | { result: 'stale' | 'aborted' };
const sameToken = (a: BookToken, b: BookToken) => a.bookEpoch === b.bookEpoch
  && a.navigationToken === b.navigationToken && a.sceneInstanceId === b.sceneInstanceId;

/** Owns preparation and cleanup. The book coordinator owns entry/exit motion and snapshots. */
export class SceneHost {
  private readonly options: SceneHostOptions;
  private phase: SceneHostPhase = 'idle';
  private generation = 0;
  private pending: Pending | null = null;
  private active: Owner | null = null;
  private disposed = false;
  private loadsInFlight = 0;
  private preparedCount = 0;
  private disposedCount = 0;
  private cleanupFailures = 0;

  constructor(options: SceneHostOptions) { this.options = options; }

  getSnapshot(): SceneHostSnapshot {
    return Object.freeze({
      phase: this.phase,
      inputBlocked: this.phase !== 'ready' || !this.active || this.active.generation !== this.generation
        || !this.options.isCurrent(this.active.token),
      activeSceneId: this.active?.sceneId ?? null,
      activeToken: this.active ? Object.freeze({ ...this.active.token }) : null,
      activeCount: this.active ? 1 : 0, pendingCount: this.pending ? 1 : 0,
      loadsInFlight: this.loadsInFlight, preparedCount: this.preparedCount,
      disposedCount: this.disposedCount, cleanupFailures: this.cleanupFailures,
    });
  }

  private report(type: SceneHostEvent['type'], owner: Pick<Owner, 'sceneId' | 'token'> | null, reason?: string): void {
    this.options.report?.(Object.freeze({ ...this.getSnapshot(), type, time: performance.now(),
      sceneId: owner?.sceneId ?? null, token: owner ? Object.freeze({ ...owner.token }) : null,
      ...(reason === undefined ? {} : { reason }),
    }));
  }

  private abortPending(reason: string): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    pending.controller.abort();
    pending.cancel();
    this.report('abort', pending, reason);
  }

  private release(owner: Owner, reason: string): void {
    if (owner.released) return;
    owner.released = true;
    try { owner.scene.dispose(); this.disposedCount += 1; }
    catch (error) {
      this.cleanupFailures += 1;
      this.report('cleanup-error', owner, error instanceof Error ? error.message : 'scene-cleanup-failed');
      throw error;
    }
    this.report('released', owner, reason);
  }

  private detachActive(reason: string): void {
    const active = this.active;
    if (!active) return;
    this.active = null;
    try { this.options.attach(null); }
    finally { this.release(active, reason); }
  }

  private invalidResult(pending: Pending): 'aborted' | 'stale' | null {
    if (this.disposed || pending.controller.signal.aborted) return 'aborted';
    return this.pending !== pending || this.generation !== pending.generation || !this.options.isCurrent(pending.token)
      ? 'stale' : null;
  }

  /** 'ready' means attached for entry, not interactive. Call markReady after the motion barrier. */
  async replace(definition: SceneDefinition, token: BookToken): Promise<SceneLoadResult> {
    if (this.disposed) return 'aborted';
    if (!this.options.isCurrent(token)) return 'stale';
    this.generation += 1;
    this.phase = 'loading';
    this.options.stopAudio('scene-replace');
    this.abortPending('replace');
    try { this.detachActive('replace'); }
    catch (error) { this.phase = 'error'; throw error; }
    let cancel = () => {};
    const cancelled = new Promise<LoadOutcome>((resolve) => { cancel = () => resolve({ result: 'aborted' }); });
    const pending: Pending = { sceneId: definition.sceneId, token: Object.freeze({ ...token }),
      generation: this.generation, controller: new AbortController(), cancel };
    this.pending = pending;
    this.loadsInFlight += 1;
    this.report('load', pending);
    const preparation = Promise.resolve().then(() => definition.load(pending.controller.signal)).then((scene): LoadOutcome => {
      this.loadsInFlight -= 1;
      this.preparedCount += 1;
      const owner: Owner = { sceneId: pending.sceneId, token: pending.token, generation: pending.generation, scene, released: false };
      const invalid = this.invalidResult(pending);
      if (invalid) { this.release(owner, invalid); return { result: invalid }; }
      return { owner };
    }, (error: unknown): LoadOutcome => {
      this.loadsInFlight -= 1;
      const invalid = this.invalidResult(pending);
      if (invalid) return { result: invalid };
      throw error;
    });
    try {
      // Abort settles the public operation even if an asset loader ignores its signal.
      // preparation still owns and releases any resource returned after that abort.
      const outcome = await Promise.race([preparation, cancelled]);
      if ('result' in outcome) {
        if (this.pending === pending) { this.pending = null; this.phase = 'idle'; }
        if (outcome.result === 'stale') this.report('stale', pending);
        return outcome.result;
      }
      const invalid = this.invalidResult(pending);
      if (invalid) {
        // The book can change after preparation resolves but before this await
        // resumes. Retire only this operation; a newer load owns its own phase.
        if (this.pending === pending) { this.pending = null; this.phase = 'idle'; }
        this.release(outcome.owner, invalid);
        if (invalid === 'stale') this.report('stale', pending);
        return invalid;
      }
      this.pending = null;
      this.active = outcome.owner;
      this.phase = 'entering';
      try { this.options.attach(outcome.owner.scene.group); }
      catch (error) { this.detachActive('attach-failed'); throw error; }
      this.options.invalidate();
      this.report('attached', outcome.owner);
      return 'ready';
    } catch (error) {
      if (this.pending === pending) { this.pending = null; this.phase = 'idle'; }
      if (!this.disposed && pending.generation === this.generation && this.options.isCurrent(pending.token)) {
        this.phase = 'error';
        this.report('error', pending, error instanceof Error ? error.message : 'scene-load-failed');
        throw error;
      }
      return pending.controller.signal.aborted || this.disposed ? 'aborted' : 'stale';
    }
  }

  markReady(token: BookToken): boolean {
    const active = this.active;
    if (this.disposed || this.phase !== 'entering' || !active || active.generation !== this.generation
      || !sameToken(active.token, token) || !this.options.isCurrent(token)) return false;
    this.phase = 'ready';
    this.report('ready', active);
    return true;
  }

  /** Call synchronously on accepted navigation; retain the source group for exit/cancel motion. */
  exit(reason: string): void {
    if (this.disposed) return;
    this.generation += 1;
    this.phase = 'exiting';
    this.options.stopAudio(reason);
    this.abortPending(reason);
    this.report('exit', this.active, reason);
  }

  /** Release a closed/hidden/failed scene without destroying this reusable host. */
  clear(reason: string): void {
    if (this.disposed) return;
    this.generation += 1;
    this.phase = 'idle';
    this.options.stopAudio(reason);
    this.abortPending(reason);
    try { this.detachActive(reason); }
    catch (error) { this.phase = 'error'; throw error; }
    this.options.invalidate();
    this.report('clear', null, reason);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.phase = 'disposed';
    const failures: unknown[] = [];
    // This is terminal: a failed audio callback must not strand a loader or GPU
    // owner, since subsequent dispose calls intentionally do nothing.
    for (const cleanup of [
      () => this.options.stopAudio('scene-host-dispose'),
      () => this.abortPending('dispose'),
      () => this.detachActive('dispose'),
    ]) {
      try { cleanup(); } catch (error) { failures.push(error); }
    }
    this.report('disposed', null);
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, 'scene-host-cleanup-failed');
  }
}

function paperPopup(sceneId: string, color: string): SceneDefinition {
  return Object.freeze({ sceneId, load(signal: AbortSignal): PreparedScene {
    signal.throwIfAborted();
    const group = new Group();
    group.name = `inspection-${sceneId}`;
    const geometry = new BoxGeometry(0.72, 0.016, 0.62);
    const material = new MeshStandardMaterial({ color, roughness: 0.94, metalness: 0 });
    const angle = 0.65, halfRun = 0.36 * Math.cos(angle), rise = 0.36 * Math.sin(angle);
    for (const direction of [-1, 1]) {
      const fold = new Mesh(geometry, material);
      fold.position.set(1.32 + direction * halfRun, rise + 0.012, 0);
      fold.rotation.z = -direction * angle;
      fold.castShadow = true;
      fold.receiveShadow = true;
      group.add(fold);
    }
    let disposed = false;
    return { group, dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      geometry.dispose();
      material.dispose();
    } };
  } });
}

/** V06 lifecycle inspection only; these are not music scenes or G1 evidence. */
export const PAPER_POPUP_SCENES: Readonly<Record<SpreadId, SceneDefinition>> = Object.freeze({
  'spread-1': paperPopup('scene-1', '#e8d7b1'),
  'spread-2': paperPopup('scene-2', '#bad4ce'),
});
