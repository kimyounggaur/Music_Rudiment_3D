import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio/AudioEngine.ts';
import type { AudioContextLike, AudioParamLike, AudioSnapshot, GainNodeLike, PlaybackSnapshot } from '../src/audio/AudioEngine.ts';

class Param implements AudioParamLike {
  value = 1;
  calls: { action: string; value?: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) { this.value = value; this.calls.push({ action: 'set', value, time }); }
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.calls.push({ action: 'ramp', value, time }); }
  cancelScheduledValues(time: number) { this.calls.push({ action: 'cancel', time }); }
}

class Gain implements GainNodeLike {
  gain = new Param();
  target: unknown;
  disconnected = false;
  connect(target: unknown) { this.target = target; }
  disconnect() { this.disconnected = true; }
}

class Buffer {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  readonly duration: number;
  private readonly channels: Float32Array[];
  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels; this.length = length; this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: channels }, () => new Float32Array(length));
  }
  getChannelData(channel: number) { return this.channels[channel]; }
}

class BufferSource {
  buffer: Buffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  starts: { when: number; offset: number; duration?: number }[] = [];
  stops: number[] = [];
  target: unknown;
  disconnected = false;
  connect(target: unknown) { this.target = target; }
  disconnect() { this.disconnected = true; }
  start(when: number, offset = 0, duration?: number) {
    assert.equal(this.starts.length, 0, 'an AudioBufferSourceNode must never be started twice');
    this.starts.push({ when, offset, ...(duration === undefined ? {} : { duration }) });
  }
  stop(when = 0) { this.stops.push(when); }
}

class Context implements AudioContextLike {
  currentTime = 10;
  state = 'running';
  destination = {};
  sampleRate = 48_000;
  buffers: Buffer[] = [];
  sources: BufferSource[] = [];
  gains: Gain[] = [];
  listeners = new Set<() => void>();
  resumeCalls = 0;
  closed = false;
  resumeGate: Promise<void> | null = null;
  createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
  createOscillator(): never { throw new Error('buffer transport must not allocate real-time oscillators'); }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const buffer = new Buffer(channels, length, sampleRate); this.buffers.push(buffer); return buffer;
  }
  createBufferSource() { const source = new BufferSource(); this.sources.push(source); return source; }
  async resume() {
    this.resumeCalls++;
    if (this.resumeGate) await this.resumeGate;
    if (this.state === 'closed') throw new Error('context is closed');
    this.state = 'running';
  }
  async close() { this.state = 'closed'; this.closed = true; }
  addEventListener(_name: string, callback: () => void) { this.listeners.add(callback); }
  removeEventListener(_name: string, callback: () => void) { this.listeners.delete(callback); }
  interrupt() { this.state = 'suspended'; for (const listener of this.listeners) listener(); }
}

function setup(context = new Context()) {
  const callbacks = new Map<number, () => void>();
  let nextTimer = 0, creations = 0;
  const engine = new AudioEngine({ rendering: 'buffer', contextFactory: () => { creations++; return context; },
    startLeadSeconds: 0.035,
    setTimer: callback => { const id = ++nextTimer; callbacks.set(id, callback); return id; },
    clearTimer: handle => { callbacks.delete(handle as number); } });
  return { engine, context, callbacks, creations: () => creations };
}

const f = (n: number, d = 1) => ({ n, d });
const pitch = { step: 'C' as const, alter: 0, octave: 4 };
const duration = 8 / 3;
function quarters(rests = false): AudioSnapshot {
  return { tempo: { bpm: 90, unit: f(1, 4) }, logicalDuration: f(1),
    events: Array.from({ length: 4 }, (_, i) => ({ id: `event-${i}`,
      kind: rests && i % 2 ? 'rest' as const : 'note' as const,
      onset: f(i, 4), duration: f(1, 4), ...(rests && i % 2 ? {} : { pitch }) })) };
}
function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function assertReleased(source: BufferSource, time: number) {
  assert.equal(source.stops.at(-1), time);
  assert.equal(source.disconnected, true);
  assert.equal(source.onended, null);
}

test('buffer transport stays gesture-lazy and reuses one real-time context', async () => {
  const { engine, context, creations } = setup();
  assert.equal(engine.getPlaybackSnapshot().state, 'locked');
  assert.equal(creations(), 0);
  assert.equal(context.buffers.length, 0);
  const first = await engine.play(quarters(), { revision: 4 });
  engine.stop();
  const second = await engine.play(quarters(), { revision: 5 });
  assert.equal(creations(), 1);
  assert.notEqual(first.sessionId, second.sessionId);
  assert.equal(second.snapshotRevision, 5);
  engine.dispose();
  assert.equal(context.closed, true);
  assert.equal(context.listeners.size, 0);
});

test('buffer timeline keeps exact 90 BPM duration, musical onsets, pitch and silent rest samples', async () => {
  const { engine, context } = setup();
  const result = await engine.play(quarters(true), { revision: 7 });
  near(result.logicalDuration, duration);
  const buffer = context.buffers[0];
  assert.equal(buffer.numberOfChannels, 1);
  assert.equal(buffer.length, Math.ceil(duration * context.sampleRate));
  near(context.sources[0].starts[0].when, result.startTime!);
  assert.equal(context.sources[0].starts[0].offset, 0);
  const pcm = buffer.getChannelData(0);
  for (const [from, to] of [[2 / 3, 4 / 3], [2, duration]]) {
    assert.ok(pcm.slice(Math.ceil(from * context.sampleRate), Math.floor(to * context.sampleRate)).every(sample => sample === 0));
  }
  for (const from of [0, 4 / 3]) {
    assert.ok(pcm.slice(Math.ceil((from + 0.02) * context.sampleRate), Math.floor((from + 0.2) * context.sampleRate)).some(sample => Math.abs(sample) > 0.01));
  }
  const start = Math.ceil(0.05 * context.sampleRate), end = Math.floor(0.3 * context.sampleRate);
  let crossings = 0;
  for (let i = start + 1; i < end; i++) if (pcm[i - 1] < 0 && pcm[i] >= 0) crossings++;
  assert.ok(crossings >= 64 && crossings <= 67, `C4 expected about 65 positive crossings, got ${crossings}`);
  context.currentTime = result.startTime! + 2 / 3;
  assert.equal(engine.getPlaybackSnapshot().activeEventId, 'event-1');
  context.currentTime = result.startTime! + 4 / 3;
  assert.equal(engine.getPlaybackSnapshot().activeEventId, 'event-2');
  engine.dispose();
});

for (const [label, offset, activeEventId] of [['note middle', 0.3, 'event-0'], ['note boundary', 2 / 3, 'event-1'], ['rest middle', 1, 'event-1'], ['trailing rest', 2.4, 'event-3']] as const) {
  test(`pause/resume at ${label} holds logical time and uses a fresh source with the same buffer`, async () => {
    const { engine, context, callbacks, creations } = setup();
    const first = await engine.play(quarters(true), { revision: 12 });
    context.currentTime = first.startTime! + offset;
    const source = context.sources[0];
    const paused = engine.pause();
    assert.equal(paused.state, 'paused');
    near(paused.logicalOffset, offset);
    near(paused.currentPosition, offset);
    near(paused.relativePosition, offset / duration);
    assert.equal(paused.sessionId, first.sessionId);
    assert.equal(paused.snapshotRevision, 12);
    assert.equal(paused.uninterrupted, false);
    assert.equal(paused.activeSourceCount, 0);
    assert.equal(callbacks.size, 0);
    assertReleased(source, context.currentTime);
    context.currentTime += 20;
    near(engine.getPlaybackSnapshot().currentPosition, offset);
    assert.equal(engine.getPlaybackSnapshot().lastCompletedSessionId, null);
    const resumed = await engine.resume(12);
    const replacement = context.sources[1];
    assert.equal(resumed.state, 'playing');
    assert.equal(resumed.sessionId, first.sessionId);
    near(resumed.currentPosition, offset);
    near(resumed.logicalOffset, offset);
    assert.equal(resumed.activeEventId, activeEventId);
    assert.equal(replacement.buffer, source.buffer);
    assert.notEqual(replacement, source);
    near(replacement.starts[0].offset, offset);
    near(replacement.starts[0].when, context.currentTime + 0.035);
    assert.equal(context.buffers.length, 1);
    assert.equal(creations(), 1);
    context.currentTime = replacement.starts[0].when - 0.01;
    near(engine.getPlaybackSnapshot().currentPosition, offset);
    near(engine.getPlaybackSnapshot().logicalOffset, offset);
    assert.equal(engine.getPlaybackSnapshot().activeEventId, activeEventId);
    context.currentTime = replacement.starts[0].when + 0.1;
    near(engine.getPlaybackSnapshot().currentPosition, offset + 0.1);
    engine.dispose();
  });
}

test('pause before the scheduled onset preserves offset zero and cancels the future source', async () => {
  const { engine, context, callbacks } = setup();
  await engine.play(quarters(), { revision: 1 });
  const paused = engine.pause();
  assert.equal(paused.state, 'paused');
  assert.equal(paused.logicalOffset, 0);
  assert.equal(paused.currentPosition, 0);
  assertReleased(context.sources[0], context.currentTime);
  assert.ok(context.sources[0].stops.at(-1)! < context.sources[0].starts[0].when);
  assert.equal(callbacks.size, 0);
  engine.dispose();
});

test('twenty pending Play calls share one request and never allocate overlapping buffers or sources', async () => {
  const context = new Context(); context.state = 'suspended';
  const gate = deferred(); context.resumeGate = gate.promise;
  const { engine, creations } = setup(context);
  const operations = Array.from({ length: 20 }, () => engine.play(quarters(), { revision: 3 }));
  assert.ok(operations.every(operation => operation === operations[0]));
  gate.resolve();
  const results = await Promise.all(operations);
  assert.ok(results.every(result => result.sessionId === results[0].sessionId));
  assert.equal(context.resumeCalls, 1);
  assert.equal(creations(), 1);
  assert.equal(context.sources.length, 1);
  assert.equal(context.buffers.length, 1);
  engine.dispose();
});

test('twenty pause/resume cycles retain the immutable timeline but never reuse a started node', async () => {
  const { engine, context, callbacks, creations } = setup();
  const input = quarters();
  const first = await engine.play(input, { revision: 9 });
  (input.tempo as { bpm: number }).bpm = 60;
  (input.events[0].duration as { n: number }).n = 50;
  for (let i = 0; i < 20; i++) {
    const current = context.sources.at(-1)!;
    context.currentTime = current.starts[0].when + 0.02;
    const paused = engine.pause();
    near(paused.logicalOffset, (i + 1) * 0.02);
    near(paused.logicalDuration, duration);
    assertReleased(current, context.currentTime);
    assert.equal(callbacks.size, 0);
    const resumed = await engine.resume(9);
    assert.equal(resumed.sessionId, first.sessionId);
    assert.equal(resumed.snapshotRevision, 9);
    assert.equal(resumed.activeSourceCount, 1);
  }
  assert.equal(context.buffers.length, 1);
  assert.equal(context.sources.length, 21);
  assert.equal(creations(), 1);
  engine.stop('page-exit');
  const stopped = engine.getPlaybackSnapshot();
  assert.equal(stopped.logicalOffset, 0);
  assert.equal(stopped.currentPosition, 0);
  assert.equal(stopped.activeSourceCount, 0);
  assert.equal(callbacks.size, 0);
  assert.ok(context.sources.every(source => source.disconnected && source.starts.length === 1));
  engine.dispose();
});

test('Stop after scheduling cancels the future buffer source and never marks completion', async () => {
  const { engine, context, callbacks } = setup();
  await engine.play(quarters(), { revision: 1 });
  engine.stop('scene-change');
  assertReleased(context.sources[0], context.currentTime);
  assert.ok(context.sources[0].stops.at(-1)! < context.sources[0].starts[0].when);
  assert.equal(callbacks.size, 0);
  context.currentTime += 30;
  const stopped = engine.getPlaybackSnapshot();
  assert.equal(stopped.logicalOffset, 0);
  assert.equal(stopped.activeSourceCount, 0);
  assert.equal(stopped.lastCompletedSessionId, null);
  assert.equal(stopped.lastUninterruptedCompletedSessionId, null);
  engine.dispose();
});

test('pause while initial gesture resume is pending cancels startup without creating a paused owner', async () => {
  const context = new Context(); context.state = 'suspended';
  const gate = deferred(); context.resumeGate = gate.promise;
  const { engine } = setup(context);
  const starting = engine.play(quarters(), { revision: 2 });
  const paused = engine.pause();
  assert.notEqual(paused.state, 'paused');
  assert.equal(paused.lastStopReason, 'pause-before-start');
  assert.equal(paused.logicalOffset, 0);
  gate.resolve(); await starting;
  assert.equal(context.sources.length, 0);
  assert.notEqual(engine.getPlaybackSnapshot().state, 'playing');
  engine.dispose();
});

test('Stop or dispose during pending resume prevents late buffer playback', async () => {
  for (const action of ['stop', 'dispose'] as const) {
    const { engine, context } = setup();
    const first = await engine.play(quarters(), { revision: 8 });
    context.currentTime = first.startTime! + 0.5;
    engine.pause();
    context.state = 'suspended';
    const gate = deferred(); context.resumeGate = gate.promise;
    const resuming = engine.resume(8);
    if (action === 'stop') engine.stop('page-exit'); else engine.dispose();
    gate.resolve(); await resuming;
    assert.equal(context.sources.length, 1);
    const snapshot = engine.getPlaybackSnapshot();
    assert.notEqual(snapshot.state, 'playing');
    assert.equal(snapshot.logicalOffset, 0);
    assert.equal(snapshot.activeSourceCount, 0);
    engine.dispose();
  }
});

test('pause cancels a pending resume and preserves its previously paused offset', async () => {
  const { engine, context } = setup();
  const first = await engine.play(quarters(), { revision: 6 });
  context.currentTime = first.startTime! + 0.45;
  engine.pause();
  context.state = 'suspended';
  const gate = deferred(); context.resumeGate = gate.promise;
  const resuming = engine.resume(6);
  const paused = engine.pause();
  assert.equal(paused.state, 'paused');
  near(paused.logicalOffset, 0.45);
  gate.resolve(); await resuming;
  assert.equal(context.sources.length, 1);
  assert.equal(engine.getPlaybackSnapshot().state, 'paused');
  near(engine.getPlaybackSnapshot().logicalOffset, 0.45);
  await engine.resume(6);
  assert.equal(context.sources.length, 2);
  near(context.sources[1].starts[0].offset, 0.45);
  engine.dispose();
});

test('twenty pending Resume calls share one request and one replacement source', async () => {
  const { engine, context } = setup();
  const first = await engine.play(quarters(), { revision: 6 });
  context.currentTime = first.startTime! + 0.4;
  engine.pause();
  context.state = 'suspended';
  const gate = deferred(); context.resumeGate = gate.promise;
  const operations = Array.from({ length: 20 }, () => engine.resume(6));
  assert.ok(operations.every(operation => operation === operations[0]));
  gate.resolve();
  const results = await Promise.all(operations);
  assert.ok(results.every(result => result.sessionId === first.sessionId && result.state === 'playing'));
  assert.equal(context.resumeCalls, 1);
  assert.equal(context.sources.length, 2);
  assert.equal(context.buffers.length, 1);
  near(context.sources[1].starts[0].offset, 0.4);
  engine.dispose();
});

test('obsolete resume cannot overwrite a new lane sharing the same context resume promise', async () => {
  const { engine, context, creations } = setup();
  const first = await engine.play(quarters(), { revision: 10 });
  context.currentTime = first.startTime! + 0.2;
  engine.pause();
  context.state = 'suspended';
  const gate = deferred(); context.resumeGate = gate.promise;
  const obsolete = engine.resume(10);
  engine.stop('lane-change');
  const next = engine.play(quarters(true), { revision: 11 });
  gate.resolve(); await obsolete;
  const current = await next;
  assert.equal(current.state, 'playing');
  assert.equal(current.snapshotRevision, 11);
  assert.notEqual(current.sessionId, first.sessionId);
  assert.equal(engine.getPlaybackSnapshot().sessionId, current.sessionId);
  assert.equal(context.sources.length, 2);
  assert.equal(context.sources[1].starts[0].offset, 0);
  assert.equal(context.resumeCalls, 1);
  assert.equal(creations(), 1);
  engine.dispose();
});

test('resume rejects a different revision and discards the old offset without starting sound', async () => {
  const { engine, context } = setup();
  const first = await engine.play(quarters(), { revision: 14 });
  context.currentTime = first.startTime! + 1;
  engine.pause();
  const mismatch = await engine.resume(15);
  assert.equal(mismatch.error?.code, 'REVISION_MISMATCH');
  assert.equal(mismatch.lastStopReason, 'revision-mismatch');
  assert.equal(mismatch.logicalOffset, 0);
  assert.equal(mismatch.activeSourceCount, 0);
  assert.equal(context.sources.length, 1);
  const changed = await engine.play({ ...quarters(), tempo: { bpm: 60, unit: f(1, 4) } }, { revision: 15 });
  near(changed.logicalDuration, 4);
  assert.equal(context.sources[1].starts[0].offset, 0);
  assert.notEqual(context.sources[1].buffer, context.sources[0].buffer);
  engine.dispose();
});

test('stale onended only releases its source and cannot complete or stop a resumed session', async () => {
  const { engine, context } = setup();
  const first = await engine.play(quarters(), { revision: 2 });
  const obsoleteEnded = context.sources[0].onended;
  assert.ok(obsoleteEnded);
  context.currentTime = first.startTime! + 0.3;
  engine.pause();
  await engine.resume(2);
  obsoleteEnded();
  const resumed = engine.getPlaybackSnapshot();
  assert.equal(resumed.state, 'playing');
  assert.equal(resumed.sessionId, first.sessionId);
  assert.equal(resumed.activeSourceCount, 1);
  assert.equal(resumed.lastCompletedSessionId, null);
  assert.equal(context.sources[1].disconnected, false);
  engine.dispose();
});

test('natural completion waits through trailing silence and distinguishes interrupted listening', async () => {
  const { engine, context } = setup();
  const first = await engine.play(quarters(true), { revision: 3 });
  context.currentTime = first.startTime! + 2.1;
  engine.pause();
  await engine.resume(3);
  const source = context.sources[1];
  context.currentTime = source.starts[0].when + duration - source.starts[0].offset - 0.001;
  assert.equal(engine.getPlaybackSnapshot().state, 'playing');
  assert.equal(engine.getPlaybackSnapshot().lastCompletedSessionId, null);
  context.currentTime += 0.001;
  const complete = engine.getPlaybackSnapshot();
  assert.equal(complete.state, 'ready');
  assert.equal(complete.logicalOffset, 0);
  assert.equal(complete.currentPosition, 0);
  assert.equal(complete.lastCompletedSessionId, first.sessionId);
  assert.equal(complete.lastUninterruptedCompletedSessionId, null);
  engine.dispose();
});

test('a source-ended callback cannot claim completion before the logical bar ends', async () => {
  const { engine, context } = setup();
  const first = await engine.play(quarters(true), { revision: 3 });
  context.currentTime = first.startTime! + 2.1;
  context.sources[0].onended?.();
  const early = engine.getPlaybackSnapshot();
  assert.equal(early.state, 'playing');
  assert.equal(early.lastCompletedSessionId, null);
  assert.equal(early.lastUninterruptedCompletedSessionId, null);
  context.currentTime = first.startTime! + duration;
  assert.equal(engine.getPlaybackSnapshot().lastCompletedSessionId, first.sessionId);
  engine.dispose();
});

test('uninterrupted completion is recorded once at logical end, including pause requested at the end', async () => {
  const { engine, context } = setup();
  const first = await engine.play(quarters(true), { revision: 5 });
  assert.equal(first.uninterrupted, true);
  context.currentTime = first.startTime! + duration;
  const ended = engine.pause();
  assert.equal(ended.state, 'ready');
  assert.equal(ended.currentPosition, 0);
  assert.equal(ended.logicalOffset, 0);
  assert.equal(ended.lastCompletedSessionId, first.sessionId);
  assert.equal(ended.lastUninterruptedCompletedSessionId, first.sessionId);
  context.currentTime += 10;
  assert.equal(engine.getPlaybackSnapshot().lastUninterruptedCompletedSessionId, first.sessionId);
  assert.equal(context.sources.length, 1);
  engine.dispose();
});

test('buffer Loop can turn on then off and finishes the current cycle without another source or replay', async () => {
  const { engine, context, callbacks } = setup();
  const first = await engine.play(quarters(), { revision: 5 });
  const source = context.sources[0];
  context.currentTime = first.startTime! + 0.4;
  engine.setLoop(true);
  assert.equal(source.loop, true);
  assert.equal(source.loopStart, 0);
  near(source.loopEnd, duration);
  context.currentTime = first.startTime! + 2 * duration + 0.5;
  near(engine.getPlaybackSnapshot().currentPosition, 0.5);
  engine.setLoop(false);
  assert.equal(source.loop, false);
  const finalCycle = engine.getPlaybackSnapshot();
  assert.equal(finalCycle.state, 'playing');
  near(finalCycle.currentPosition, 0.5);
  context.currentTime = first.startTime! + 3 * duration - 0.001;
  assert.equal(engine.getPlaybackSnapshot().state, 'playing');
  context.currentTime = first.startTime! + 3 * duration;
  const complete = engine.getPlaybackSnapshot();
  assert.equal(complete.state, 'ready');
  assert.equal(complete.currentPosition, 0);
  assert.equal(complete.logicalOffset, 0);
  assert.equal(complete.lastCompletedSessionId, first.sessionId);
  assert.equal(complete.activeSourceCount, 0);
  assert.equal(callbacks.size, 0);
  assert.equal(context.sources.length, 1);
  assert.equal(context.buffers.length, 1);
  context.currentTime += duration;
  assert.equal(engine.getPlaybackSnapshot().state, 'ready');
  engine.dispose();
});

test('interrupted and closed real-time contexts cannot automatically resume a retained session', async () => {
  const { engine, context, creations } = setup();
  await engine.play(quarters(), { revision: 1 });
  context.interrupt();
  assert.equal(engine.getPlaybackSnapshot().state, 'locked');
  assert.equal(engine.getPlaybackSnapshot().logicalOffset, 0);
  assert.equal(engine.getPlaybackSnapshot().activeSourceCount, 0);
  context.state = 'running';
  assert.notEqual(engine.getPlaybackSnapshot().state, 'playing');
  const next = await engine.play(quarters(), { revision: 2 });
  context.currentTime = next.startTime! + 0.1;
  engine.pause();
  context.state = 'closed';
  const closed = await engine.resume(2);
  assert.equal(closed.state, 'unavailable');
  assert.equal(closed.error?.code, 'CONTEXT_CLOSED');
  assert.equal(closed.activeSourceCount, 0);
  assert.equal(context.sources.length, 2);
  assert.equal(creations(), 1);
  engine.dispose();
});

test('a suspended-context resume failure releases playback without creating another source or context', async () => {
  const { engine, context, creations } = setup();
  const first = await engine.play(quarters(), { revision: 8 });
  context.currentTime = first.startTime! + 0.25;
  engine.pause();
  context.state = 'suspended';
  context.resume = async () => { throw new Error('resume denied'); };
  const failed = await engine.resume(8);
  assert.equal(failed.state, 'error');
  assert.equal(failed.activeSourceCount, 0);
  assert.equal(context.sources.length, 1);
  assert.equal(creations(), 1);
  engine.dispose();
});

test('invalid music is rejected before context creation or buffer allocation', async () => {
  const { engine, context, creations } = setup();
  const input = quarters();
  const invalid = { ...input, events: [{ ...input.events[0], onset: f(1, 4) }] };
  const result = await engine.play(invalid, { revision: 1 });
  assert.equal(result.state, 'error');
  assert.equal(creations(), 0);
  assert.equal(context.buffers.length, 0);
  assert.equal(context.sources.length, 0);
  engine.dispose();
});

test('native interruption notifies a paused owner immediately with zero offset and no polling timer', async () => {
  const { engine, context, callbacks } = setup();
  const notices: PlaybackSnapshot[] = [];
  const unsubscribe = engine.subscribe(snapshot => notices.push(snapshot));
  const first = await engine.play(quarters(), { revision: 2 });
  context.currentTime = first.startTime! + 0.35;
  engine.pause();
  assert.equal(callbacks.size, 0);
  assert.equal(notices.length, 0);
  context.interrupt();
  assert.equal(notices.length, 1, 'native statechange delivers without a frame or timer tick');
  assert.equal(notices[0].state, 'locked');
  assert.equal(notices[0].logicalOffset, 0);
  assert.equal(notices[0].activeSourceCount, 0);
  assert.equal(notices[0].sessionId, null);
  assert.equal(notices[0].lastStopReason, 'audio-interrupted');
  for (let i = 0; i < 3; i++) engine.getPlaybackSnapshot();
  assert.equal(notices.length, 1, 'snapshot reads must not recursively notify');
  context.state = 'running';
  for (const listener of context.listeners) listener();
  assert.equal(notices.length, 1);
  assert.notEqual(engine.getPlaybackSnapshot().state, 'playing');
  assert.equal(context.sources.length, 1);
  unsubscribe();
  engine.dispose();
});

test('interruption subscriptions isolate a failing listener and unsubscribe/dispose are safe', async () => {
  const { engine, context, creations } = setup();
  const notices: PlaybackSnapshot[] = [];
  const unsubscribeBad = engine.subscribe(() => { throw new Error('consumer failed'); });
  const unsubscribe = engine.subscribe(snapshot => notices.push(snapshot));
  assert.equal(creations(), 0, 'subscriptions cannot unlock audio');
  await engine.play(quarters(), { revision: 1 });
  const obsoleteNativeListener = [...context.listeners][0];
  assert.doesNotThrow(() => context.interrupt());
  assert.equal(notices.length, 1);
  unsubscribe(); unsubscribe(); unsubscribeBad(); unsubscribeBad();
  context.interrupt();
  assert.equal(notices.length, 1);
  const unsubscribeBeforeDispose = engine.subscribe(snapshot => notices.push(snapshot));
  engine.dispose(); engine.dispose();
  assert.equal(context.listeners.size, 0);
  assert.doesNotThrow(() => obsoleteNativeListener());
  unsubscribeBeforeDispose(); unsubscribeBeforeDispose();
  const unsubscribeAfterDispose = engine.subscribe(snapshot => notices.push(snapshot));
  obsoleteNativeListener(); unsubscribeAfterDispose();
  assert.equal(notices.length, 1);
});

test('invalid supplied snapshot revisions fail before context creation or buffer allocation', async () => {
  for (const revision of [-1, 1.5, NaN]) {
    const { engine, context, creations } = setup();
    const result = await engine.play(quarters(), { revision });
    assert.equal(result.state, 'error');
    assert.equal(result.error?.code, 'INVALID_REVISION');
    assert.equal(creations(), 0);
    assert.equal(context.buffers.length, 0);
    assert.equal(context.sources.length, 0);
    engine.dispose();
  }
});

test('91 BPM PCM quantization preserves silent rest boundaries to within one sample', async () => {
  const context = new Context(); context.sampleRate = 44_100;
  const { engine } = setup(context);
  const result = await engine.play({ ...quarters(true), tempo: { bpm: 91, unit: f(1, 4) } }, { revision: 4 });
  const beat = 60 / 91, rate = context.sampleRate;
  const buffer = context.buffers[0], pcm = buffer.getChannelData(0);
  near(result.logicalDuration, 4 * beat);
  assert.equal(buffer.length, Math.ceil(4 * beat * rate));
  assert.ok(buffer.duration >= result.logicalDuration && buffer.duration - result.logicalDuration < 1 / rate);
  for (const restStart of [beat, 3 * beat]) {
    const firstSilent = Math.ceil(restStart * rate);
    const afterRest = Math.min(pcm.length, Math.ceil((restStart + beat) * rate));
    assert.ok(pcm.slice(firstSilent, afterRest).every(sample => sample === 0));
    assert.ok(firstSilent / rate >= restStart && firstSilent / rate - restStart < 1 / rate);
  }
  const secondOnset = 2 * beat;
  const firstNoteFrame = Math.ceil(secondOnset * rate);
  assert.equal(pcm[firstNoteFrame - 1], 0, 'the preceding rest cannot contain an early attack');
  assert.notEqual(pcm[firstNoteFrame], 0);
  assert.ok(firstNoteFrame / rate >= secondOnset && firstNoteFrame / rate - secondOnset < 1 / rate);
  engine.dispose();
});
