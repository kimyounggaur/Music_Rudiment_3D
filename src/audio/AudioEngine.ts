import { add, cmp, frac, frequency, seconds } from '../domain/index.ts';
import type { Fraction, Pitch } from '../domain/index.ts';
import { renderBarBuffer } from './renderBarBuffer.ts';
import type { AudioBufferLike } from './renderBarBuffer.ts';
export type { AudioBufferLike } from './renderBarBuffer.ts';

export type AudioState = 'unavailable' | 'locked' | 'ready' | 'starting' | 'playing' | 'paused' | 'stopping' | 'error';
export type AudioEvent = Readonly<{ id: string; kind: 'note' | 'rest'; onset: Fraction; duration: Fraction; pitch?: Pitch }>;
export type AudioSnapshot = Readonly<{ events: readonly AudioEvent[]; tempo: Readonly<{ bpm: number; unit: Fraction }>; logicalDuration?: Fraction }>;
export type PlaybackSnapshot = Readonly<{
  state: AudioState; sessionId: number | null; startTime: number | null; logicalDuration: number;
  currentPosition: number; relativePosition: number; activeEventId: string | null; loop: boolean; muted: boolean;
  error: Readonly<{ code: string; message: string }> | null; lastStopReason: string | null;
  lastCompletedSessionId: number | null; completedSessionId: number | null; activeSourceCount: number;
  /** Seconds into the frozen musical bar, not animation progress or beats. */
  logicalOffset: number; snapshotRevision: number | null; uninterrupted: boolean;
  lastUninterruptedCompletedSessionId: number | null;
}>;

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  cancelScheduledValues(time: number): unknown;
}
export interface GainNodeLike { gain: AudioParamLike; connect(target: unknown): unknown; disconnect(): unknown }
export interface ScheduledSourceLike {
  onended: (() => void) | null;
  connect(target: unknown): unknown; disconnect(): unknown; start(time: number): unknown; stop(time?: number): unknown;
}
export interface OscillatorLike extends ScheduledSourceLike { type: string; frequency: AudioParamLike }
export interface BufferSourceLike extends ScheduledSourceLike {
  buffer: AudioBufferLike | null; loop: boolean; loopStart: number; loopEnd: number;
  start(time: number, offset?: number, duration?: number): unknown;
}
export interface AudioContextLike {
  readonly currentTime: number; readonly state: string; readonly destination: unknown;
  resume(): Promise<void>; close?(): Promise<void>;
  createGain(): GainNodeLike; createOscillator(): OscillatorLike;
  readonly sampleRate?: number;
  createBuffer?(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource?(): BufferSourceLike;
  addEventListener?(name: string, callback: () => void): void;
  removeEventListener?(name: string, callback: () => void): void;
}
export interface AudioEngineOptions {
  contextFactory?: () => AudioContextLike;
  setTimer?: (callback: () => void, milliseconds: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  startLeadSeconds?: number;
  /** Keep the baseline scheduler available; the book explicitly selects buffer. */
  rendering?: 'oscillator' | 'buffer';
  /**
   * v3 R7: builds one named sound effect into `destination` at `when` and returns how many nodes it
   * made. The engine only supplies its context and the effects gain; the synthesis lives with the book.
   */
  sfx?: (name: string, context: AudioContextLike, destination: GainNodeLike, when: number) => number;
}
type SourceHandle = { source: ScheduledSourceLike; gain: GainNodeLike; cycle: number; start: number; end: number; started: boolean };
type Session = {
  id: number; startTime: number; logicalDuration: number; relativeDuration: number;
  snapshot: AudioSnapshot; nodes: Set<SourceHandle>; nextCycle: number;
  revision: number | null; pausedOffset: number | null; uninterrupted: boolean; buffer: AudioBufferLike | null;
  segmentStart: number; segmentOffset: number;
};

export class AudioPlaybackError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = 'AudioPlaybackError'; this.code = code; }
}

function browserContext(): AudioContextLike {
  const scope = globalThis as unknown as { AudioContext?: new () => AudioContextLike; webkitAudioContext?: new () => AudioContextLike };
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Context) throw new AudioPlaybackError('UNAVAILABLE', '이 브라우저에서 소리를 사용할 수 없습니다. 소리 없이 계속할 수 있어요.');
  return new Context();
}

function immutableSnapshot(input: AudioSnapshot): AudioSnapshot {
  if (!input || !Array.isArray(input.events) || input.events.length < 1 || input.events.length > 64) {
    throw new AudioPlaybackError('INVALID_EVENTS', '재생할 이벤트는 1~64개여야 합니다.');
  }
  const ids = new Set<string>();
  let end = frac(0, 1);
  const events = input.events.map((event) => {
    if (!event || typeof event.id !== 'string' || event.id.length < 1 || event.id.length > 80 || ids.has(event.id)) {
      throw new AudioPlaybackError('INVALID_ID', '재생 이벤트 ID가 없거나 중복되었습니다.');
    }
    ids.add(event.id);
    const onset = frac(event.onset.n, event.onset.d);
    const duration = frac(event.duration.n, event.duration.d);
    if (cmp(onset, end) !== 0 || cmp(duration, frac(0, 1)) <= 0) {
      throw new AudioPlaybackError('INVALID_TIMELINE', '재생 이벤트는 유효한 음가로 연속되어야 합니다.');
    }
    if (event.kind !== 'note' && event.kind !== 'rest') throw new AudioPlaybackError('INVALID_KIND', '음표 또는 쉼표가 필요합니다.');
    if (event.kind === 'rest' && event.pitch !== undefined) throw new AudioPlaybackError('REST_PITCH', '쉼표에는 음높이가 없습니다.');
    if (event.kind === 'note') {
      if (!event.pitch) throw new AudioPlaybackError('NOTE_PITCH', '음표의 음높이가 필요합니다.');
      frequency(event.pitch);
    }
    end = add(onset, duration);
    return Object.freeze({ id: event.id, kind: event.kind, onset: Object.freeze(onset), duration: Object.freeze(duration),
      ...(event.kind === 'note' ? { pitch: Object.freeze({ ...event.pitch! }) } : {}) });
  });
  if (cmp(end, frac(1, 1)) > 0) throw new AudioPlaybackError('BAR_RANGE', '첫 단원의 재생 범위는 한 마디 이내입니다.');
  const logicalDuration = input.logicalDuration ? frac(input.logicalDuration.n, input.logicalDuration.d) : end;
  if (cmp(logicalDuration, end) < 0 || cmp(logicalDuration, frac(1, 1)) > 0) {
    throw new AudioPlaybackError('LOGICAL_RANGE', '재생 종료 시각은 이벤트를 포함하고 한 마디 이내여야 합니다.');
  }
  const tempo = Object.freeze({ bpm: input.tempo.bpm, unit: Object.freeze(frac(input.tempo.unit.n, input.tempo.unit.d)) });
  const length = seconds(logicalDuration, tempo);
  if (!Number.isFinite(length) || length <= 0 || length > 120) throw new AudioPlaybackError('DURATION_RANGE', '재생 길이를 확인해 주세요.');
  return Object.freeze({ events: Object.freeze(events), tempo, logicalDuration: Object.freeze(logicalDuration) });
}

/** Prototype synth; one context per engine, no sound/context creation at construction. */
export class AudioEngine {
  private options: Required<AudioEngineOptions>;
  private context: AudioContextLike | null = null;
  private master: GainNodeLike | null = null;
  private learning: GainNodeLike | null = null;
  /** v3 R7 effects channel: its own gain under master, made on the first effect (never at construction). */
  private effects: GainNodeLike | null = null;
  private effectsEnabled = true;
  private state: AudioState = 'locked';
  private session: Session | null = null;
  private request = 0;
  private sequence = 0;
  private pending: Promise<PlaybackSnapshot> | null = null;
  private resumePending: Promise<void> | null = null;
  private timer: unknown = null;
  private disposed = false;
  private loop = false;
  private muted = false;
  private masterVolume = 0.6;
  private learningVolume = 0.25;
  private error: { code: string; message: string } | null = null;
  private lastStopReason: string | null = null;
  private lastCompletedSessionId: number | null = null;
  private lastUninterruptedCompletedSessionId: number | null = null;
  private listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  private stateChange = () => {
    if (!this.disposed && this.context && this.context.state !== 'running') {
      this.stop('audio-interrupted');
      const snapshot = this.getPlaybackSnapshot();
      for (const listener of this.listeners) {
        try { listener(snapshot); } catch { /* one consumer cannot block interruption cleanup */ }
      }
    }
  };

  constructor(options: AudioEngineOptions = {}) {
    this.options = {
      contextFactory: options.contextFactory ?? browserContext,
      setTimer: options.setTimer ?? ((callback, ms) => globalThis.setTimeout(callback, ms)),
      clearTimer: options.clearTimer ?? ((handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>)),
      startLeadSeconds: options.startLeadSeconds ?? 0.035,
      rendering: options.rendering ?? 'oscillator',
      sfx: options.sfx ?? (() => 0),
    };
    if (!Number.isFinite(this.options.startLeadSeconds) || this.options.startLeadSeconds < 0 || this.options.startLeadSeconds > 0.25) {
      throw new AudioPlaybackError('LEAD_RANGE', '시작 여유 시간 범위가 올바르지 않습니다.');
    }
  }

  private ensureContext(): AudioContextLike {
    if (this.disposed) throw new AudioPlaybackError('DISPOSED', '종료된 오디오 엔진입니다.');
    if (this.context?.state === 'closed') throw new AudioPlaybackError('CONTEXT_CLOSED', '소리 장치가 닫혔습니다. 소리 없이 계속할 수 있어요.');
    if (!this.context) {
      this.context = this.options.contextFactory();
      this.master = this.context.createGain(); this.learning = this.context.createGain();
      this.learning.connect(this.master); this.master.connect(this.context.destination);
      this.master.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.context.currentTime);
      this.learning.gain.setValueAtTime(this.learningVolume, this.context.currentTime);
      this.context.addEventListener?.('statechange', this.stateChange);
    }
    return this.context;
  }

  private async resumeContext(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === 'running') return;
    if (!this.resumePending) {
      const promise = context.resume();
      this.resumePending = Promise.resolve(promise).finally(() => { this.resumePending = null; });
    }
    await this.resumePending;
    if (context.state !== 'running') throw new AudioPlaybackError('RESUME_FAILED', '소리 장치를 시작하지 못했습니다. 소리 없이 계속하거나 다시 시도하세요.');
  }

  async unlockFromGesture(): Promise<void> {
    const token = this.request;
    try {
      await this.resumeContext();
      if (token === this.request && !this.disposed && !this.session && this.state !== 'starting') {
        this.state = 'ready'; this.error = null;
      }
    } catch (error) { if (token === this.request) this.recordError(error); throw error; }
  }

  /** External context interruptions only; snapshots/RAF reads never emit. */
  subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  play(input: AudioSnapshot, options: { loop?: boolean; revision?: number } = {}): Promise<PlaybackSnapshot> {
    if (this.state === 'starting' && this.pending) return this.pending;
    if (this.state === 'playing') return Promise.resolve(this.getPlaybackSnapshot());
    this.cancelSession();
    const token = ++this.request;
    this.state = 'starting'; this.error = null; this.lastStopReason = null;
    const operation = (async () => {
      try {
        const snapshot = immutableSnapshot(input);
        const revision = options.revision ?? null;
        if (options.revision !== undefined && (!Number.isSafeInteger(options.revision) || options.revision < 0)) {
          throw new AudioPlaybackError('INVALID_REVISION', '재생 데이터 버전이 올바르지 않습니다.');
        }
        await this.resumeContext();
        if (token !== this.request || this.disposed) return this.getPlaybackSnapshot();
        const context = this.context!;
        this.loop = options.loop ?? this.loop;
        const buffer = this.options.rendering === 'buffer' ? this.renderBuffer(snapshot) : null;
        this.session = { id: ++this.sequence, startTime: context.currentTime + this.options.startLeadSeconds,
          logicalDuration: seconds(snapshot.logicalDuration!, snapshot.tempo),
          relativeDuration: snapshot.logicalDuration!.n / snapshot.logicalDuration!.d,
          snapshot, nodes: new Set(), nextCycle: 0, revision, pausedOffset: null, uninterrupted: true, buffer,
          segmentStart: context.currentTime + this.options.startLeadSeconds, segmentOffset: 0 };
        if (buffer) this.scheduleBuffer(this.session, 0);
        else {
          this.scheduleCycle(this.session, 0);
          if (this.loop) this.scheduleCycle(this.session, 1);
        }
        this.state = 'playing'; this.armTimer();
        return this.getPlaybackSnapshot();
      } catch (error) {
        if (token === this.request) { this.cancelSession(); this.recordError(error); }
        return this.getPlaybackSnapshot();
      } finally { if (token === this.request) this.pending = null; }
    })();
    this.pending = operation;
    return operation;
  }

  private renderBuffer(snapshot: AudioSnapshot): AudioBufferLike {
    const context = this.context!;
    if (!context.createBuffer || !context.createBufferSource || context.sampleRate === undefined) {
      throw new AudioPlaybackError('BUFFER_UNAVAILABLE', '이 브라우저에서 이어 듣기를 사용할 수 없습니다. 소리 없이 계속할 수 있어요.');
    }
    return renderBarBuffer(snapshot, {
      sampleRate: context.sampleRate,
      createBuffer: (channels, length, rate) => context.createBuffer!(channels, length, rate),
    });
  }

  private scheduleBuffer(session: Session, offset: number): void {
    const context = this.context!;
    const when = context.currentTime + this.options.startLeadSeconds;
    session.startTime = when - offset;
    session.segmentStart = when; session.segmentOffset = offset;
    const source = context.createBufferSource!();
    const gain = context.createGain();
    const end = session.startTime + session.logicalDuration;
    const handle: SourceHandle = { source, gain, cycle: 0, start: when, end, started: false };
    session.nodes.add(handle);
    source.buffer = session.buffer;
    source.loop = this.loop; source.loopStart = 0; source.loopEnd = session.logicalDuration;
    source.connect(gain); gain.connect(this.learning);
    // A resumed sustained note keeps its waveform phase. This short output ramp
    // avoids a discontinuity but creates no new musical event or duration.
    gain.gain.setValueAtTime(offset > 0 ? 0 : 1, when);
    if (offset > 0) gain.gain.linearRampToValueAtTime(1, when + Math.min(0.008, (session.logicalDuration - offset) / 4));
    source.onended = () => { this.releaseHandle(session, handle); };
    source.start(when, offset); handle.started = true;
    // The PCM naturally ends within one sample of logicalDuration. Do not set
    // an irrevocable stop appointment here: explicit loop changes must remain
    // possible. Completion is independently checked against the musical clock.
  }

  pause(): PlaybackSnapshot {
    this.refresh();
    const session = this.session;
    if (this.options.rendering !== 'buffer') return this.getPlaybackSnapshot();
    if (this.state === 'starting' && !session) { this.stop('pause-before-start'); return this.getPlaybackSnapshot(); }
    if (!session || (this.state !== 'playing' && this.state !== 'starting')) return this.getPlaybackSnapshot();
    const offset = session.pausedOffset ?? this.position(session);
    ++this.request; this.pending = null;
    this.cancelTimer(); this.cancelNodes(session);
    session.pausedOffset = offset; session.uninterrupted = false;
    this.state = 'paused'; this.lastStopReason = 'user-pause';
    return this.getPlaybackSnapshot();
  }

  resume(expectedRevision: number): Promise<PlaybackSnapshot> {
    const session = this.session;
    if (!session || this.options.rendering !== 'buffer') return Promise.resolve(this.getPlaybackSnapshot());
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || session.revision !== expectedRevision) {
      this.stop('revision-mismatch');
      this.recordError(new AudioPlaybackError('REVISION_MISMATCH', '학습 내용이 바뀌었습니다. 처음부터 다시 들어 주세요.'));
      return Promise.resolve(this.getPlaybackSnapshot());
    }
    if (this.state === 'starting' && this.pending) return this.pending;
    if (this.state !== 'paused') return Promise.resolve(this.getPlaybackSnapshot());
    const token = ++this.request;
    this.state = 'starting'; this.error = null; this.lastStopReason = null;
    const operation = (async () => {
      try {
        await this.resumeContext();
        if (token !== this.request || this.disposed || this.session !== session) return this.getPlaybackSnapshot();
        this.scheduleBuffer(session, session.pausedOffset!);
        session.pausedOffset = null;
        this.state = 'playing'; this.armTimer();
        return this.getPlaybackSnapshot();
      } catch (error) {
        if (token === this.request) { this.cancelSession(); this.recordError(error); }
        return this.getPlaybackSnapshot();
      } finally { if (token === this.request) this.pending = null; }
    })();
    this.pending = operation;
    return operation;
  }

  private scheduleCycle(session: Session, cycle: number): void {
    const context = this.context!;
    const cycleStart = session.startTime + cycle * session.logicalDuration;
    for (const event of session.snapshot.events) {
      if (event.kind === 'rest') continue;
      const start = cycleStart + seconds(event.onset, session.snapshot.tempo);
      const length = seconds(event.duration, session.snapshot.tempo);
      const end = start + length;
      const source = context.createOscillator(); const gain = context.createGain();
      const handle: SourceHandle = { source, gain, cycle, start, end, started: false };
      session.nodes.add(handle);
      source.type = 'sine'; source.frequency.setValueAtTime(frequency(event.pitch!), start);
      source.connect(gain); gain.connect(this.learning);
      const ramp = Math.min(0.008, length / 4);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(1, start + ramp);
      gain.gain.setValueAtTime(1, Math.max(start + ramp, end - ramp));
      gain.gain.linearRampToValueAtTime(0, end);
      source.onended = () => { this.releaseHandle(session, handle); };
      source.start(start); handle.started = true; source.stop(end);
    }
    session.nextCycle = cycle + 1;
  }

  private releaseHandle(session: Session, handle: SourceHandle): void {
    if (!session.nodes.delete(handle)) return;
    handle.source.onended = null;
    try { handle.source.disconnect(); } catch { /* already disconnected */ }
    try { handle.gain.disconnect(); } catch { /* already disconnected */ }
  }

  private cancelHandle(session: Session, handle: SourceHandle, now: number): void {
    handle.source.onended = null;
    try {
      handle.gain.gain.cancelScheduledValues(now);
      handle.gain.gain.setValueAtTime(0, now);
      if (handle.started) handle.source.stop(now);
    } catch { /* a naturally ended source can already be stopped */ }
    this.releaseHandle(session, handle);
  }

  private cancelSession(): void {
    this.cancelTimer();
    const session = this.session; this.session = null;
    if (!session) return;
    this.cancelNodes(session);
    session.buffer = null;
  }

  private cancelNodes(session: Session): void {
    const now = this.context?.currentTime ?? 0;
    for (const handle of [...session.nodes]) this.cancelHandle(session, handle, now);
  }

  private cancelTimer(): void {
    if (this.timer !== null) { this.options.clearTimer(this.timer); this.timer = null; }
  }

  private armTimer(): void {
    this.cancelTimer();
    if (!this.session) return;
    const id = this.session.id;
    this.timer = this.options.setTimer(() => {
      this.timer = null;
      if (this.session?.id !== id) return;
      this.refresh();
      if (this.session?.id === id) this.armTimer();
    }, 25);
  }

  private refresh(): void {
    const session = this.session; const context = this.context;
    if (!session || !context) return;
    if (this.state === 'starting' && session.pausedOffset !== null) return;
    // A cancelled, pending explicit resume can leave a retained paused session
    // on a suspended context. Native interruption events separately discard it.
    if (this.state === 'paused' && context.state !== 'closed') return;
    if (context.state !== 'running') { this.stop('audio-interrupted'); return; }
    const elapsed = context.currentTime - session.startTime;
    const firstLogicalEnd = session.startTime + session.logicalDuration;
    if (context.currentTime >= firstLogicalEnd) {
      this.lastCompletedSessionId = session.id;
      if (session.uninterrupted) this.lastUninterruptedCompletedSessionId = session.id;
    }
    if (!this.loop && context.currentTime >= firstLogicalEnd) {
      this.lastCompletedSessionId = session.id; this.cancelSession(); this.state = 'ready'; this.lastStopReason = 'natural-end'; return;
    }
    if (this.loop && elapsed >= 0 && !session.buffer) {
      const currentCycle = this.cycleAt(session, context.currentTime);
      if (session.nextCycle <= currentCycle) {
        this.cancelSession(); this.recordError(new AudioPlaybackError('SCHEDULER_LATE', '재생 예약이 늦어 안전하게 정지했습니다. 다시 재생해 주세요.')); return;
      }
      while (session.nextCycle <= currentCycle + 1) this.scheduleCycle(session, session.nextCycle);
    }
  }

  private cycleAt(session: Session, time: number): number {
    let cycle = Math.max(0, Math.floor((time - session.startTime) / session.logicalDuration));
    // Compare absolute appointments so subtraction rounding cannot postpone a boundary.
    if (time >= session.startTime + (cycle + 1) * session.logicalDuration) cycle++;
    if (cycle > 0 && time < session.startTime + cycle * session.logicalDuration) cycle--;
    return cycle;
  }

  stop(reason = 'user-stop'): void {
    ++this.request; this.pending = null;
    this.state = 'stopping'; this.cancelSession();
    this.state = this.disposed || this.context?.state === 'closed' ? 'unavailable' : this.context?.state === 'running' ? 'ready' : 'locked';
    if (this.options.rendering === 'buffer') this.loop = false;
    this.lastStopReason = reason;
  }

  setLoop(enabled: boolean): void {
    this.refresh();
    this.loop = Boolean(enabled);
    const session = this.session; const context = this.context;
    if (!session || !context) return;
    if (session.buffer) {
      if (session.pausedOffset !== null) return;
      if (!this.loop) session.startTime += this.cycleAt(session, context.currentTime) * session.logicalDuration;
      for (const handle of session.nodes) {
        const source = handle.source as BufferSourceLike;
        source.loop = this.loop;
      }
      return;
    }
    const cycle = this.cycleAt(session, context.currentTime);
    if (this.loop) {
      if (session.nextCycle <= cycle + 1) this.scheduleCycle(session, session.nextCycle);
    } else {
      for (const handle of [...session.nodes]) if (handle.cycle > cycle) this.cancelHandle(session, handle, context.currentTime);
      // The remaining current cycle becomes the final cycle and keeps its audio-clock origin.
      session.startTime += cycle * session.logicalDuration;
      for (const handle of session.nodes) handle.cycle -= cycle;
      session.nextCycle = 1;
    }
  }

  /**
   * v3 R7: play a procedural effect on the effects channel. It never creates or resumes the context,
   * so nothing sounds before the reader's first gesture; muted, disabled or interrupted → no nodes.
   */
  playSfx(name: string, when?: number): boolean {
    const context = this.context;
    if (this.disposed || !context || !this.master || this.muted || !this.effectsEnabled) return false;
    if (context.state !== 'running' && !this.resumePending) return false;
    if (!this.effects) {
      this.effects = context.createGain();
      this.effects.gain.setValueAtTime(1, context.currentTime);
      this.effects.connect(this.master);
    }
    try { return this.options.sfx(name, context, this.effects, Math.max(when ?? context.currentTime, context.currentTime)) > 0; }
    catch { return false; }
  }

  /** v3 R7: the reader's effects setting (the toolbar '소리' mutes music and effects together). */
  setSfxEnabled(enabled: boolean): void {
    this.effectsEnabled = Boolean(enabled);
  }

  setMuted(muted: boolean): void {
    this.muted = Boolean(muted);
    if (this.context && this.master) this.master.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.context.currentTime);
  }

  setChannelGain(channel: 'master' | 'learning', value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new AudioPlaybackError('GAIN_RANGE', '음량은 0에서 1 사이입니다.');
    if (channel === 'master') this.masterVolume = value;
    else if (channel === 'learning') this.learningVolume = value;
    else throw new AudioPlaybackError('CHANNEL', '내레이션·배경음악·효과음 자산이 없어 해당 채널은 사용할 수 없습니다.');
    const node = channel === 'master' ? this.master : this.learning;
    if (this.context && node) node.gain.setValueAtTime(channel === 'master' && this.muted ? 0 : value, this.context.currentTime);
  }

  getPlaybackSnapshot(): PlaybackSnapshot {
    this.refresh();
    const session = this.session;
    const position = session ? this.position(session) : 0;
    const relativePosition = session ? position / session.logicalDuration * session.relativeDuration : 0;
    const active = session && (session.pausedOffset !== null || session.segmentOffset > 0 || (this.context?.currentTime ?? 0) >= session.segmentStart) ? session.snapshot.events.find((event) => {
      const onset = seconds(event.onset, session.snapshot.tempo);
      return position >= onset && position < onset + seconds(event.duration, session.snapshot.tempo);
    }) : undefined;
    return Object.freeze({ state: this.state, sessionId: session?.id ?? null, startTime: session?.startTime ?? null,
      logicalDuration: session?.logicalDuration ?? 0, currentPosition: position, relativePosition,
      activeEventId: active?.id ?? null, loop: this.loop, muted: this.muted, error: this.error ? Object.freeze({ ...this.error }) : null,
      lastStopReason: this.lastStopReason, lastCompletedSessionId: this.lastCompletedSessionId,
      completedSessionId: this.lastCompletedSessionId, activeSourceCount: session?.nodes.size ?? 0,
      logicalOffset: position, snapshotRevision: session?.revision ?? null, uninterrupted: session?.uninterrupted ?? false,
      lastUninterruptedCompletedSessionId: this.lastUninterruptedCompletedSessionId });
  }

  private position(session: Session): number {
    if (session.pausedOffset !== null) return session.pausedOffset;
    const now = this.context?.currentTime ?? session.segmentStart;
    const elapsed = now < session.segmentStart ? session.segmentOffset : Math.max(0, now - session.startTime);
    const cycle = this.loop ? this.cycleAt(session, now) : 0;
    let position = this.loop ? elapsed % session.logicalDuration : elapsed;
    // Subtracting large AudioContext times can put an exact boundary just below
    // its event. Compare the same absolute appointments used by the scheduler.
    if (now >= session.segmentStart) {
      const origin = session.startTime + cycle * session.logicalDuration;
      for (const event of session.snapshot.events) {
        const onset = seconds(event.onset, session.snapshot.tempo);
        if (now >= origin + onset && position < onset) position = onset;
      }
    }
    return Math.min(session.logicalDuration, position);
  }

  private recordError(error: unknown): void {
    const failure = error instanceof AudioPlaybackError ? error : new AudioPlaybackError('AUDIO_FAILURE', error instanceof Error ? error.message : '소리를 시작하지 못했습니다.');
    this.error = { code: failure.code, message: failure.message };
    this.state = failure.code === 'UNAVAILABLE' || failure.code === 'DISPOSED' || failure.code === 'CONTEXT_CLOSED' ? 'unavailable' : 'error';
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop('dispose'); this.disposed = true;
    this.listeners.clear();
    this.context?.removeEventListener?.('statechange', this.stateChange);
    try { this.learning?.disconnect(); this.effects?.disconnect(); this.master?.disconnect(); } catch { /* already disconnected */ }
    const closing = this.context?.close?.(); closing?.catch(() => undefined);
    this.context = null; this.master = null; this.learning = null; this.effects = null; this.state = 'unavailable';
  }
}
