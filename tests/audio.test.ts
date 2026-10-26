import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio/AudioEngine.ts';
import type { AudioContextLike, AudioEngineOptions, AudioParamLike, AudioSnapshot, GainNodeLike, OscillatorLike } from '../src/audio/AudioEngine.ts';

class Param implements AudioParamLike {
  value = 1;
  calls: { action: string; value?: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) { this.value = value; this.calls.push({ action: 'set', value, time }); }
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.calls.push({ action: 'ramp', value, time }); }
  cancelScheduledValues(time: number) { this.calls.push({ action: 'cancel', time }); }
}
class Gain implements GainNodeLike {
  gain = new Param(); disconnected = false; target: unknown;
  connect(target: unknown) { this.target = target; }
  disconnect() { this.disconnected = true; }
}
class Oscillator implements OscillatorLike {
  frequency = new Param(); type = ''; onended: (() => void) | null = null;
  starts: number[] = []; stops: number[] = []; disconnected = false; target: unknown;
  connect(target: unknown) { this.target = target; }
  disconnect() { this.disconnected = true; }
  start(time: number) { this.starts.push(time); }
  stop(time = 0) { this.stops.push(time); }
}
class Context implements AudioContextLike {
  currentTime = 10; state = 'running'; destination = {};
  sources: Oscillator[] = []; gains: Gain[] = []; listeners = new Set<() => void>();
  resumeCalls = 0; closed = false; resumeGate: Promise<void> | null = null;
  createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
  createOscillator() { const oscillator = new Oscillator(); this.sources.push(oscillator); return oscillator; }
  async resume() { this.resumeCalls++; if (this.resumeGate) await this.resumeGate; this.state = 'running'; }
  async close() { this.state = 'closed'; this.closed = true; }
  addEventListener(_name: string, callback: () => void) { this.listeners.add(callback); }
  removeEventListener(_name: string, callback: () => void) { this.listeners.delete(callback); }
  interrupt() { this.state = 'suspended'; for (const listener of this.listeners) listener(); }
}
function setup(context = new Context()) {
  const callbacks = new Map<number, () => void>(); let next = 0; let creations = 0;
  const options: AudioEngineOptions = { contextFactory: () => { creations++; return context; },
    setTimer: callback => { const id = ++next; callbacks.set(id, callback); return id; },
    clearTimer: handle => { callbacks.delete(handle as number); }, startLeadSeconds: 0.035 };
  const engine = new AudioEngine(options);
  return { context, engine, callbacks, creations: () => creations, tick: () => {
    const copy = [...callbacks]; callbacks.clear(); for (const [, callback] of copy) callback();
  } };
}
const f = (n: number, d = 1) => ({ n, d });
const pitch = { step: 'C' as const, alter: 0, octave: 4 };
function quarters(rests = false): AudioSnapshot {
  return { tempo: { bpm: 90, unit: f(1, 4) }, events: Array.from({ length: 4 }, (_, i) => ({
    id: `event-${i}`, kind: rests && i % 2 ? 'rest' as const : 'note' as const,
    onset: f(i, 4), duration: f(1, 4), ...(rests && i % 2 ? {} : { pitch }),
  })) };
}
function near(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`); }

test('A01: construction and initial snapshots create no context or sound', () => {
  const { engine, creations } = setup();
  assert.equal(engine.getPlaybackSnapshot().state, 'locked');
  assert.equal(creations(), 0);
  engine.dispose();
});

test('L01/L02: 90 BPM absolute appointments are 0,2/3,4/3,2 and duration8/3', async () => {
  const { engine, context } = setup();
  const result = await engine.play(quarters());
  near(result.logicalDuration, 8 / 3);
  assert.equal(context.sources.length, 4);
  context.sources.forEach((source, i) => { near(source.starts[0], result.startTime! + i * 2 / 3); near(source.stops[0], result.startTime! + (i + 1) * 2 / 3); });
  near(context.sources[0].frequency.calls[0].value!, 261.6255653005986);
  assert.equal(engine.getPlaybackSnapshot().activeEventId, null, 'future onset is not yet active');
  context.currentTime = result.startTime! + 1;
  near(engine.getPlaybackSnapshot().relativePosition, 3 / 8);
  assert.equal(engine.getPlaybackSnapshot().activeEventId, 'event-1');
  engine.dispose();
});

test('M10/L05: rests retain time, generate zero sources and note release ends before silence', async () => {
  const { engine, context } = setup();
  const result = await engine.play(quarters(true));
  assert.equal(context.sources.length, 2);
  near(context.sources[1].starts[0], result.startTime! + 4 / 3);
  near(context.sources[0].stops[0], result.startTime! + 2 / 3);
  const envelope = (context.sources[0].target as Gain).gain.calls;
  assert.ok(envelope.every(call => call.time <= context.sources[0].stops[0]));
  assert.deepEqual(envelope.at(-1), { action: 'ramp', value: 0, time: context.sources[0].stops[0] });
  context.currentTime = result.startTime! + 2.2;
  assert.equal(engine.getPlaybackSnapshot().activeEventId, 'event-3');
  assert.equal(engine.getPlaybackSnapshot().state, 'playing', 'trailing rest is part of logical duration');
  context.currentTime = result.startTime! + 8 / 3;
  const end = engine.getPlaybackSnapshot();
  assert.equal(end.state, 'ready'); assert.equal(end.currentPosition, 0);
  assert.equal(end.completedSessionId, result.sessionId);
  engine.dispose();
});

test('A02: repeated rapid Play shares pending request and active session', async () => {
  const { engine, context, creations } = setup();
  const first = engine.play(quarters()); const second = engine.play(quarters());
  assert.equal(first, second);
  const initial = await first;
  assert.equal((await engine.play(quarters())).sessionId, initial.sessionId);
  assert.equal(context.sources.length, 4); assert.equal(creations(), 1);
  engine.dispose();
});

test('A03: Stop before start really cancels every future source, clears timer, never completes', async () => {
  const { engine, context, callbacks } = setup();
  await engine.play(quarters());
  engine.stop('scene-change');
  assert.ok(context.sources.every(source => source.stops.at(-1)! < source.starts[0]));
  assert.ok(context.sources.every(source => source.disconnected && source.onended === null));
  assert.equal(callbacks.size, 0);
  context.currentTime += 10;
  const result = engine.getPlaybackSnapshot();
  assert.equal(result.currentPosition, 0); assert.equal(result.activeSourceCount, 0);
  assert.equal(result.completedSessionId, null); assert.equal(result.lastStopReason, 'scene-change');
  engine.dispose();
});

test('A04: pending resume cancelled by Stop never produces late sound', async () => {
  const context = new Context(); context.state = 'suspended';
  let resume!: () => void; context.resumeGate = new Promise(resolve => { resume = resolve; });
  const { engine } = setup(context);
  const playing = engine.play(quarters());
  assert.equal(engine.getPlaybackSnapshot().state, 'starting');
  engine.stop('scene-change'); resume();
  await playing;
  assert.equal(context.sources.length, 0); assert.notEqual(engine.getPlaybackSnapshot().state, 'playing');
  engine.dispose();
});

test('unlock cancellation does not restore an obsolete ready state', async () => {
  const context = new Context(); context.state = 'suspended';
  let resume!: () => void; context.resumeGate = new Promise(resolve => { resume = resolve; });
  const { engine } = setup(context);
  const unlocking = engine.unlockFromGesture(); engine.stop('hidden'); resume(); await unlocking;
  assert.equal(engine.getPlaybackSnapshot().state, 'locked'); assert.equal(context.sources.length, 0);
  engine.dispose();
});

test('cancelled old resume cannot overwrite a newer play request sharing the context', async () => {
  const context = new Context(); context.state = 'suspended';
  let resume!: () => void; context.resumeGate = new Promise(resolve => { resume = resolve; });
  const { engine, creations } = setup(context);
  const old = engine.play(quarters()); engine.stop('scene-change');
  const next = engine.play(quarters(true)); resume();
  await old; const result = await next;
  assert.equal(result.state, 'playing'); assert.equal(context.sources.length, 2);
  assert.equal(creations(), 1); assert.equal(context.resumeCalls, 1);
  assert.equal(engine.getPlaybackSnapshot().sessionId, result.sessionId);
  engine.dispose();
});

test('L06: 60 and120 change seconds, preserve duration ratio and relative playhead', async () => {
  for (const bpm of [60, 120, 60]) {
    const { engine, context } = setup(); const input = quarters(); const before = JSON.stringify(input.events);
    const result = await engine.play({ ...input, tempo: { ...input.tempo, bpm } });
    near(result.logicalDuration, bpm === 60 ? 4 : 2);
    context.currentTime = result.startTime! + (bpm === 60 ? 1 : 0.5);
    near(engine.getPlaybackSnapshot().relativePosition, 1 / 4);
    assert.equal(JSON.stringify(input.events), before); engine.dispose();
  }
});

test('loop pre-schedules next bar on same audio clock, reports first logical completion and Stop cancels all', async () => {
  const { engine, context } = setup(); const result = await engine.play(quarters(), { loop: true });
  assert.equal(context.sources.length, 8);
  near(context.sources[4].starts[0], result.startTime! + 8 / 3);
  assert.equal(result.completedSessionId, null);
  context.currentTime = result.startTime! + 8 / 3 + 0.1;
  const repeating = engine.getPlaybackSnapshot();
  assert.equal(repeating.completedSessionId, result.sessionId); assert.equal(repeating.state, 'playing');
  assert.equal(context.sources.length, 12);
  near(context.sources[8].starts[0], result.startTime! + 16 / 3);
  engine.stop(); assert.ok(context.sources.every(source => source.disconnected));
  assert.equal(engine.getPlaybackSnapshot().activeSourceCount, 0); engine.dispose();
});

test('turning Loop off cancels future bars while current bar finishes; no hidden replay', async () => {
  const { engine, context } = setup(); const result = await engine.play(quarters(), { loop: true });
  context.currentTime = result.startTime! + 1;
  engine.setLoop(false);
  assert.ok(context.sources.slice(4).every(source => source.disconnected && source.stops.at(-1) === context.currentTime));
  context.currentTime = result.startTime! + 8 / 3;
  assert.equal(engine.getPlaybackSnapshot().state, 'ready');
  assert.equal(context.sources.length, 8); engine.dispose();
});

test('missed loop replenishment safely stops rather than scheduling stale bursts', async () => {
  const { engine, context } = setup(); const result = await engine.play(quarters(), { loop: true });
  context.currentTime = result.startTime! + 20;
  const state = engine.getPlaybackSnapshot();
  assert.equal(state.state, 'error'); assert.equal(state.error?.code, 'SCHEDULER_LATE');
  assert.equal(context.sources.length, 8); assert.ok(context.sources.every(source => source.disconnected)); engine.dispose();
});

test('audio interruption stops and never automatically restarts', async () => {
  const { engine, context } = setup(); await engine.play(quarters()); context.interrupt();
  assert.equal(engine.getPlaybackSnapshot().state, 'locked');
  context.state = 'running';
  assert.notEqual(engine.getPlaybackSnapshot().state, 'playing');
  assert.equal(engine.getPlaybackSnapshot().lastStopReason, 'audio-interrupted'); engine.dispose();
});

test('immutable snapshot protects scheduled music from caller edits', async () => {
  const { engine, context } = setup(); const original = quarters();
  await engine.play(original);
  (original.events[0].duration as { n: number }).n = 100;
  engine.stop();
  assert.ok(context.sources[0].stops[0] < context.currentTime + 1);
  engine.dispose();
});

test('invalid rest.pitch, overlapping events, duplicate IDs, and missing note.pitch do not produce audio', async () => {
  const invalid = [
    { ...quarters(true), events: [{ id: 'x', kind: 'rest', onset: f(0), duration: f(1), pitch }] },
    { ...quarters(), events: [{ id: 'x', kind: 'note', onset: f(1, 4), duration: f(1, 4), pitch }] },
    { ...quarters(), events: [{ id: 'x', kind: 'note', onset: f(0), duration: f(1, 2), pitch }, { id: 'x', kind: 'note', onset: f(1, 2), duration: f(1, 2), pitch }] },
    { ...quarters(), events: [{ id: 'x', kind: 'note', onset: f(0), duration: f(1) }] },
  ];
  for (const input of invalid) {
    const { engine, context, creations } = setup();
    const state = await engine.play(input as AudioSnapshot);
    assert.equal(state.state, 'error'); assert.equal(context.sources.length, 0); assert.equal(creations(), 0); engine.dispose();
  }
});

test('50 start/stop cycles leave zero active sources, timer cleanup and no stale onended state writes', async () => {
  const { engine, context, callbacks } = setup(); let obsolete: (() => void) | null = null;
  for (let i = 0; i < 50; i++) {
    const result = await engine.play(quarters());
    if (i === 0) obsolete = context.sources[0].onended;
    obsolete?.();
    assert.equal(engine.getPlaybackSnapshot().sessionId, result.sessionId);
    engine.stop(); assert.equal(callbacks.size, 0); assert.equal(engine.getPlaybackSnapshot().activeSourceCount, 0);
  }
  assert.ok(context.sources.every(source => source.disconnected));
  assert.ok(context.gains.slice(2).every(gain => gain.disconnected));
  engine.dispose(); assert.equal(context.listeners.size, 0); assert.equal(context.closed, true);
});

test('resume failure is recoverable error and unsupported environment stays usable to caller', async () => {
  const context = new Context(); context.state = 'suspended'; context.resume = async () => { throw new Error('resume denied'); };
  const { engine } = setup(context);
  const result = await engine.play(quarters()); assert.equal(result.state, 'error'); assert.equal(context.sources.length, 0);
  engine.dispose();
  const unavailable = new AudioEngine({ contextFactory: () => { throw new Error('not supported'); } });
  assert.equal((await unavailable.play(quarters())).state, 'error'); unavailable.dispose();
});

test('master mute and separate learning gain validate ranges without changing pitch', async () => {
  const { engine, context } = setup();
  engine.setMuted(true); engine.setChannelGain('learning', 0.1); await engine.play(quarters());
  assert.equal(context.gains[0].gain.value, 0); assert.equal(context.gains[1].gain.value, 0.1);
  engine.setChannelGain('master', 0.4); assert.equal(context.gains[0].gain.value, 0);
  engine.setMuted(false); assert.equal(context.gains[0].gain.value, 0.4);
  assert.throws(() => engine.setChannelGain('master', NaN)); engine.dispose();
});
