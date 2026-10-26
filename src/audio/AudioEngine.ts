import { add, cmp, frac, frequency, seconds } from '../domain/index.ts';
import type { Fraction, Pitch } from '../domain/index.ts';

export type AudioState = 'unavailable' | 'locked' | 'ready' | 'starting' | 'playing' | 'stopping' | 'error';
export type AudioEvent = Readonly<{ id: string; kind: 'note' | 'rest'; onset: Fraction; duration: Fraction; pitch?: Pitch }>;
export type AudioSnapshot = Readonly<{ events: readonly AudioEvent[]; tempo: Readonly<{ bpm: number; unit: Fraction }>; logicalDuration?: Fraction }>;
export type PlaybackSnapshot = Readonly<{
  state: AudioState; sessionId: number | null; startTime: number | null; logicalDuration: number;
  currentPosition: number; relativePosition: number; activeEventId: string | null; loop: boolean; muted: boolean;
  error: Readonly<{ code: string; message: string }> | null; lastStopReason: string | null;
  lastCompletedSessionId: number | null; completedSessionId: number | null; activeSourceCount: number;
}>;

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  cancelScheduledValues(time: number): unknown;
}
export interface GainNodeLike { gain: AudioParamLike; connect(target: unknown): unknown; disconnect(): unknown }
export interface OscillatorLike {
  type: string; frequency: AudioParamLike; onended: (() => void) | null;
  connect(target: unknown): unknown; disconnect(): unknown; start(time: number): unknown; stop(time?: number): unknown;
}
export interface AudioContextLike {
  readonly currentTime: number; readonly state: string; readonly destination: unknown;
  resume(): Promise<void>; close?(): Promise<void>;
  createGain(): GainNodeLike; createOscillator(): OscillatorLike;
  addEventListener?(name: string, callback: () => void): void;
  removeEventListener?(name: string, callback: () => void): void;
}
export interface AudioEngineOptions {
  contextFactory?: () => AudioContextLike;
  setTimer?: (callback: () => void, milliseconds: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  startLeadSeconds?: number;
}
type SourceHandle = { source: OscillatorLike; gain: GainNodeLike; cycle: number; start: number; end: number };
type Session = {
  id: number; startTime: number; logicalDuration: number; relativeDuration: number;
  snapshot: AudioSnapshot; nodes: Set<SourceHandle>; nextCycle: number;
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
  private stateChange = () => {
    if (this.session && this.context?.state !== 'running') this.stop('audio-interrupted');
  };

  constructor(options: AudioEngineOptions = {}) {
    this.options = {
      contextFactory: options.contextFactory ?? browserContext,
      setTimer: options.setTimer ?? ((callback, ms) => globalThis.setTimeout(callback, ms)),
      clearTimer: options.clearTimer ?? ((handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>)),
      startLeadSeconds: options.startLeadSeconds ?? 0.035,
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

  play(input: AudioSnapshot, options: { loop?: boolean } = {}): Promise<PlaybackSnapshot> {
    if (this.state === 'starting' && this.pending) return this.pending;
    if (this.state === 'playing') return Promise.resolve(this.getPlaybackSnapshot());
    const token = ++this.request;
    this.state = 'starting'; this.error = null; this.lastStopReason = null;
    const operation = (async () => {
      try {
        const snapshot = immutableSnapshot(input);
        await this.resumeContext();
        if (token !== this.request || this.disposed) return this.getPlaybackSnapshot();
        const context = this.context!;
        this.loop = options.loop ?? this.loop;
        this.session = { id: ++this.sequence, startTime: context.currentTime + this.options.startLeadSeconds,
          logicalDuration: seconds(snapshot.logicalDuration!, snapshot.tempo),
          relativeDuration: snapshot.logicalDuration!.n / snapshot.logicalDuration!.d,
          snapshot, nodes: new Set(), nextCycle: 0 };
        this.scheduleCycle(this.session, 0);
        if (this.loop) this.scheduleCycle(this.session, 1);
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
      const handle: SourceHandle = { source, gain, cycle, start, end };
      session.nodes.add(handle);
      source.type = 'sine'; source.frequency.setValueAtTime(frequency(event.pitch!), start);
      source.connect(gain); gain.connect(this.learning);
      const ramp = Math.min(0.008, length / 4);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(1, start + ramp);
      gain.gain.setValueAtTime(1, Math.max(start + ramp, end - ramp));
      gain.gain.linearRampToValueAtTime(0, end);
      source.onended = () => { this.releaseHandle(session, handle); };
      source.start(start); source.stop(end);
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
      handle.source.stop(now);
    } catch { /* a naturally ended source can already be stopped */ }
    this.releaseHandle(session, handle);
  }

  private cancelSession(): void {
    this.cancelTimer();
    const session = this.session; this.session = null;
    if (!session) return;
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
    if (context.state !== 'running') { this.stop('audio-interrupted'); return; }
    const elapsed = context.currentTime - session.startTime;
    const firstLogicalEnd = session.startTime + session.logicalDuration;
    if (context.currentTime >= firstLogicalEnd) this.lastCompletedSessionId = session.id;
    if (!this.loop && context.currentTime >= firstLogicalEnd) {
      this.lastCompletedSessionId = session.id; this.cancelSession(); this.state = 'ready'; this.lastStopReason = 'natural-end'; return;
    }
    if (this.loop && elapsed >= 0) {
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
    this.lastStopReason = reason;
  }

  setLoop(enabled: boolean): void {
    this.refresh();
    this.loop = Boolean(enabled);
    const session = this.session; const context = this.context;
    if (!session || !context) return;
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
    const elapsed = session ? Math.max(0, (this.context?.currentTime ?? session.startTime) - session.startTime) : 0;
    const position = session ? Math.min(session.logicalDuration, this.loop ? elapsed % session.logicalDuration : elapsed) : 0;
    const relativePosition = session ? position / session.logicalDuration * session.relativeDuration : 0;
    const active = session && (this.context?.currentTime ?? 0) >= session.startTime ? session.snapshot.events.find((event) => {
      const onset = event.onset.n / event.onset.d;
      return relativePosition >= onset && relativePosition < onset + event.duration.n / event.duration.d;
    }) : undefined;
    return Object.freeze({ state: this.state, sessionId: session?.id ?? null, startTime: session?.startTime ?? null,
      logicalDuration: session?.logicalDuration ?? 0, currentPosition: position, relativePosition,
      activeEventId: active?.id ?? null, loop: this.loop, muted: this.muted, error: this.error ? Object.freeze({ ...this.error }) : null,
      lastStopReason: this.lastStopReason, lastCompletedSessionId: this.lastCompletedSessionId,
      completedSessionId: this.lastCompletedSessionId, activeSourceCount: session?.nodes.size ?? 0 });
  }

  private recordError(error: unknown): void {
    const failure = error instanceof AudioPlaybackError ? error : new AudioPlaybackError('AUDIO_FAILURE', error instanceof Error ? error.message : '소리를 시작하지 못했습니다.');
    this.error = { code: failure.code, message: failure.message };
    this.state = failure.code === 'UNAVAILABLE' || failure.code === 'DISPOSED' || failure.code === 'CONTEXT_CLOSED' ? 'unavailable' : 'error';
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop('dispose'); this.disposed = true;
    this.context?.removeEventListener?.('statechange', this.stateChange);
    try { this.learning?.disconnect(); this.master?.disconnect(); } catch { /* already disconnected */ }
    const closing = this.context?.close?.(); closing?.catch(() => undefined);
    this.context = null; this.master = null; this.learning = null; this.state = 'unavailable';
  }
}
