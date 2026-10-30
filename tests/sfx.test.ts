import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio/AudioEngine.ts';
import type { AudioBufferLike, AudioContextLike, AudioParamLike, BufferSourceLike, GainNodeLike, OscillatorLike } from '../src/audio/AudioEngine.ts';
import { noiseSamples, playSynthSfx, SFX_NAMES, SFX_PEAK_LIMIT, SFX_SPECS } from '../src/book/sfx/synthSfx.ts';
import type { SfxContext, SfxName } from '../src/book/sfx/synthSfx.ts';
import { sfxAllowed, transitionSfx } from '../src/book/sfx/useBookSfx.ts';

/**
 * Node has no (Offline)AudioContext, so this stub records the graph each effect builds and a small
 * renderer plays it back sample by sample with the same automation rules (setValueAtTime holds,
 * linearRampToValueAtTime ramps from the previous event). REFACTOR_PROMPTS_V3 R7-6.
 */
const RATE = 48_000;
class Param implements AudioParamLike {
  value = 0;
  events: { kind: 'set' | 'ramp'; value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) { this.events.push({ kind: 'set', value, time }); }
  linearRampToValueAtTime(value: number, time: number) { this.events.push({ kind: 'ramp', value, time }); }
  cancelScheduledValues(time: number) { this.events = this.events.filter(event => event.time < time); }
  at(time: number, fallback: number): number {
    let value = fallback, from = { value: fallback, time: -Infinity };
    for (const event of this.events) {
      if (event.time <= time) { value = event.value; from = event; continue; }
      if (event.kind === 'ramp') return from.time === -Infinity ? event.value : from.value + (event.value - from.value) * (time - from.time) / (event.time - from.time);
      break;
    }
    return value;
  }
}
type Node = { kind: string; disconnected: boolean; target: unknown };
class Gain implements GainNodeLike, Node {
  kind = 'gain'; gain = new Param(); disconnected = false; target: unknown = null;
  connect(target: unknown) { this.target = target; }
  disconnect() { this.disconnected = true; }
}
class Buffer implements AudioBufferLike {
  data: Float32Array; length: number; sampleRate: number;
  constructor(length: number, sampleRate: number) { this.length = length; this.sampleRate = sampleRate; this.data = new Float32Array(length); }
  get duration() { return this.length / this.sampleRate; }
  getChannelData() { return this.data; }
}
class Source implements BufferSourceLike, Node {
  kind = 'buffer'; buffer: AudioBufferLike | null = null; loop = false; loopStart = 0; loopEnd = 0; onended: (() => void) | null = null;
  disconnected = false; target: unknown = null; startAt = 0; stopAt = Infinity;
  connect(target: unknown) { this.target = target; }
  disconnect() { this.disconnected = true; }
  start(time: number) { this.startAt = time; }
  stop(time = 0) { this.stopAt = time; }
}
class Oscillator implements OscillatorLike, Node {
  kind = 'oscillator'; type = 'sine'; frequency = new Param(); onended: (() => void) | null = null;
  disconnected = false; target: unknown = null; startAt = 0; stopAt = Infinity;
  connect(target: unknown) { this.target = target; }
  disconnect() { this.disconnected = true; }
  start(time: number) { this.startAt = time; }
  stop(time = 0) { this.stopAt = time; }
}
class Stub implements SfxContext {
  currentTime = 0; sampleRate = RATE; nodes: Node[] = []; creations = 0;
  createGain() { this.creations += 1; const node = new Gain(); this.nodes.push(node); return node; }
  createOscillator() { this.creations += 1; const node = new Oscillator(); this.nodes.push(node); return node; }
  createBuffer(_channels: number, length: number, sampleRate: number) { return new Buffer(length, sampleRate); }
  createBufferSource() { this.creations += 1; const node = new Source(); this.nodes.push(node); return node; }
}

/** Render the recorded graph: every source through its gain into the destination. */
function render(stub: Stub, seconds: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (const node of stub.nodes) {
    if (!(node instanceof Source) && !(node instanceof Oscillator)) continue;
    const gain = node.target as Gain;
    let phase = 0;
    for (let index = 0; index < out.length; index += 1) {
      const t = index / RATE;
      if (t < node.startAt || t >= node.stopAt) continue;
      let sample: number;
      if (node instanceof Source) {
        const position = Math.floor((t - node.startAt) * RATE);
        sample = position < (node.buffer?.length ?? 0) ? node.buffer!.getChannelData(0)[position]! : 0;
      } else {
        phase += 2 * Math.PI * node.frequency.at(t, 440) / RATE;
        sample = Math.sin(phase);
      }
      out[index]! += sample * gain.gain.at(t, 1);
    }
  }
  return out;
}

test('R7 sfx: each effect has its design length (±10%) and renders under −6 dBFS', () => {
  const report: Record<string, unknown> = {};
  for (const name of SFX_NAMES) {
    const stub = new Stub();
    const destination = new Gain();
    const result = playSynthSfx(name, stub, destination, 0);
    assert.ok(result.nodes >= 2, name);
    const sources = stub.nodes.filter((node): node is Source | Oscillator => node instanceof Source || node instanceof Oscillator);
    const length = Math.max(...sources.map(source => source.stopAt));
    const spec = SFX_SPECS[name];
    assert.ok(Math.abs(length - spec.duration) <= spec.duration * 0.1, `${name}: ${length.toFixed(4)} s vs ${spec.duration} s`);
    // Every source peaks at exactly 1 and the envelopes never pass their fixed gains.
    const gains = stub.nodes.filter((node): node is Gain => node instanceof Gain);
    const bound = gains.reduce((sum, gain) => sum + Math.max(0, ...gain.gain.events.map(event => event.value)), 0);
    assert.ok(Math.abs(bound - spec.peakBound) < 1e-9 && bound <= SFX_PEAK_LIMIT, `${name}: bound ${bound}`);
    for (const source of sources) if (source instanceof Source) {
      const peak = Math.max(...source.buffer!.getChannelData(0).map(Math.abs));
      assert.ok(Math.abs(peak - 1) < 1e-6, `${name}: normalised noise`);
    }
    const samples = render(stub, spec.duration + 0.05);
    const peak = Math.max(...samples.map(Math.abs));
    const peakDb = 20 * Math.log10(peak);
    assert.ok(peak <= SFX_PEAK_LIMIT && peak > 0.05, `${name}: peak ${peakDb.toFixed(2)} dBFS`);
    let last = samples.length - 1;
    while (last > 0 && Math.abs(samples[last]!) <= 0.001) last -= 1;
    const audible = last / RATE;
    assert.ok(audible <= spec.duration * 1.1, `${name}: audible until ${audible.toFixed(4)} s`);
    report[name] = { lengthS: Number(length.toFixed(4)), peakDbfs: Number(peakDb.toFixed(2)), nodes: result.nodes };
  }
  // Recorded for the R7 evidence (the same numbers the browser render reports).
  assert.equal(Object.keys(report).length, 7);
});

test('R7 sfx: graphs release themselves; noise is deterministic and normalised', () => {
  const stub = new Stub();
  playSynthSfx('cover-open', stub, new Gain(), 0);
  const sources = stub.nodes.filter((node): node is Source | Oscillator => node instanceof Source || node instanceof Oscillator);
  sources[0]!.onended?.();
  assert.ok(stub.nodes.every(node => !node.disconnected), 'waits for the last source');
  for (const source of sources.slice(1)) source.onended?.();
  assert.ok(stub.nodes.every(node => node.disconnected), 'every node disconnected');
  assert.deepEqual(noiseSamples(RATE, 0.01, 'pink', 3, { type: 'bandpass', from: 1000, to: 2000, q: 1 }),
    noiseSamples(RATE, 0.01, 'pink', 3, { type: 'bandpass', from: 1000, to: 2000, q: 1 }));
  assert.equal(playSynthSfx('nothing' as SfxName, stub, new Gain(), 0).nodes, 0);
});

// --- The engine's effects channel.
class EngineContext extends Stub implements AudioContextLike {
  /** Browsers start a context suspended until a gesture resumes it. */
  state = 'suspended'; destination = {}; resumes = 0;
  async resume() { this.resumes += 1; this.state = 'running'; }
  async close() { this.state = 'closed'; }
}
function engine(context = new EngineContext()) {
  const audio = new AudioEngine({ contextFactory: () => context, setTimer: () => 0, clearTimer: () => undefined,
    sfx: (name, ctx, destination, when) => playSynthSfx(name as SfxName, ctx as unknown as SfxContext, destination, when).nodes });
  return { audio, context };
}

test('R7 sfx: no effect before the first gesture; the setting and mute create zero nodes', async () => {
  const { audio, context } = engine();
  assert.equal(audio.playSfx('pen'), false, 'no context before a gesture');
  assert.equal(context.creations, 0);
  await audio.unlockFromGesture();
  const base = context.creations;
  assert.equal(audio.playSfx('pen'), true);
  assert.ok(context.creations > base);
  audio.setSfxEnabled(false);
  const off = context.creations;
  for (const name of SFX_NAMES) assert.equal(audio.playSfx(name), false);
  assert.equal(context.creations, off, 'sfx = false: no nodes');
  audio.setSfxEnabled(true);
  audio.setMuted(true);
  assert.equal(audio.playSfx('flap'), false, 'the toolbar sound switch silences effects too');
  assert.equal(context.creations, off);
  audio.setMuted(false);
  context.state = 'suspended';
  assert.equal(audio.playSfx('flap'), false, 'an interrupted context is never resumed by an effect');
  assert.equal(context.resumes, 1, 'only the gesture resumed it');
  audio.dispose();
  assert.equal(audio.playSfx('flap'), false);
});

test('R7 sfx: transitions pick the effect; pen waits while music plays and nothing sounds before unlock', () => {
  const at = (phase: string, gesture: unknown = null) => ({ phase, gesture }) as Parameters<typeof transitionSfx>[1];
  assert.equal(transitionSfx(at('coverIdle'), at('opening')), 'cover-open');
  assert.equal(transitionSfx(at('spreadIdle'), at('closing')), 'cover-close');
  assert.equal(transitionSfx(at('preparingTurn'), at('turningForward')), 'page-turn', 'TURN_PREPARED of a button turn');
  assert.equal(transitionSfx(at('turningForward'), at('settling')), null, 'a completed button turn is not sounded twice');
  const held = { pointerActive: true, releaseDecision: null };
  assert.equal(transitionSfx(at('preparingTurn', held), at('turningForward', held)), null, 'a held drag is silent');
  assert.equal(transitionSfx(at('turningForward', held), at('settling', { pointerActive: false, releaseDecision: 'commit' })), 'page-turn', 'release commit');
  assert.equal(transitionSfx(at('turningForward', held), at('cancelSettling', { pointerActive: false, releaseDecision: 'cancel' })), null);
  assert.equal(transitionSfx(at('settling'), at('spreadIdle')), 'page-settle');
  assert.equal(transitionSfx(at('cancelSettling'), at('spreadIdle')), 'page-settle');
  assert.equal(transitionSfx(null, at('spreadIdle')), null);
  assert.equal(sfxAllowed('cover-open', { unlocked: false, musicPlaying: false }), false, 'before the first gesture');
  assert.equal(sfxAllowed('pen', { unlocked: true, musicPlaying: true }), false, 'no pen during music');
  assert.equal(sfxAllowed('page-turn', { unlocked: true, musicPlaying: true }), true);
  assert.equal(sfxAllowed('pen', { unlocked: true, musicPlaying: false }), true);
});
