import type { AudioBufferLike, BufferSourceLike, GainNodeLike, OscillatorLike } from '../../audio/AudioEngine.ts';

/**
 * v3 R7 procedural sound effects (REFACTOR_DESIGN_V3 §6 R7, CONTRACT_V3 C8, decision 2). No sound
 * files: every effect is a small node graph built at `when` that releases itself when its last
 * source ends. Noise is filtered here in code (band-pass sweeps, low-pass) and then normalised to a
 * ±1 peak, and tones are sines, so every source peaks at exactly 1 and an effect's output can never
 * exceed the sum of its fixed component gains (`peakBound` ≤ 0.5 = −6 dBFS) — no output compressor.
 */
export type SfxName = 'page-turn' | 'page-settle' | 'cover-open' | 'cover-close' | 'pen' | 'flap' | 'stamp';
export const SFX_NAMES: readonly SfxName[] = Object.freeze(['page-turn', 'page-settle', 'cover-open', 'cover-close', 'pen', 'flap', 'stamp']);

/** The part of an (Offline)AudioContext the effects use. */
export interface SfxContext {
  readonly currentTime: number;
  readonly sampleRate: number;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorLike;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): BufferSourceLike;
}

/** Design lengths (s) and the fixed sum of component gains (a hard linear peak bound). */
export const SFX_SPECS: Readonly<Record<SfxName, Readonly<{ duration: number; peakBound: number }>>> = Object.freeze({
  'page-turn': Object.freeze({ duration: 0.35, peakBound: 0.45 }),
  'page-settle': Object.freeze({ duration: 0.06, peakBound: 0.4 }),
  'cover-open': Object.freeze({ duration: 0.25, peakBound: 0.45 }),
  'cover-close': Object.freeze({ duration: 0.25, peakBound: 0.45 }),
  pen: Object.freeze({ duration: 0.043, peakBound: 0.36 }),
  flap: Object.freeze({ duration: 0.15, peakBound: 0.4 }),
  stamp: Object.freeze({ duration: 0.12, peakBound: 0.45 }),
});
/** −6 dBFS. */
export const SFX_PEAK_LIMIT = 0.5;

/** Deterministic noise so every rendering of an effect is the same (mulberry32). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type NoiseFilter = Readonly<{ type: 'bandpass' | 'lowpass'; from: number; to?: number; q: number }>;

/**
 * Filtered noise samples, normalised to a ±1 peak. White or pink (Paul Kellet's economy filter),
 * then an RBJ biquad — band-pass with a constant 0 dB peak, or low-pass — whose centre/cutoff moves
 * linearly from `from` to `to` over the clip (coefficients refreshed every 32 samples).
 */
export function noiseSamples(sampleRate: number, seconds: number, colour: 'white' | 'pink', seed: number, filter?: NoiseFilter): Float32Array {
  const length = Math.max(1, Math.round(seconds * sampleRate));
  const data = new Float32Array(length);
  const next = random(seed);
  let p0 = 0, p1 = 0, p2 = 0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  const coefficients = (index: number) => {
    if (!filter) return;
    const f = filter.from + ((filter.to ?? filter.from) - filter.from) * index / Math.max(1, length - 1);
    const w = 2 * Math.PI * Math.min(f, sampleRate * 0.45) / sampleRate;
    const alpha = Math.sin(w) / (2 * filter.q), cos = Math.cos(w), a0 = 1 + alpha;
    if (filter.type === 'bandpass') { b0 = alpha / a0; b1 = 0; b2 = -alpha / a0; }
    else { b0 = (1 - cos) / 2 / a0; b1 = (1 - cos) / a0; b2 = (1 - cos) / 2 / a0; }
    a1 = -2 * cos / a0; a2 = (1 - alpha) / a0;
  };
  let peak = 0;
  for (let index = 0; index < length; index += 1) {
    if (index % 32 === 0) coefficients(index);
    const white = next() * 2 - 1;
    let x = white;
    if (colour === 'pink') {
      p0 = 0.99765 * p0 + white * 0.099046;
      p1 = 0.963 * p1 + white * 0.2965164;
      p2 = 0.57 * p2 + white * 1.0526913;
      x = p0 + p1 + p2 + white * 0.1848;
    }
    let y = x;
    if (filter) {
      y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
    }
    data[index] = y;
    peak = Math.max(peak, Math.abs(y));
  }
  if (peak > 0) for (let index = 0; index < length; index += 1) data[index]! /= peak;
  return data;
}

type Graph = { nodes: { disconnect(): unknown }[]; sources: { onended: (() => void) | null }[] };
function release(graph: Graph): void {
  let remaining = graph.sources.length;
  for (const source of graph.sources) {
    source.onended = () => {
      remaining -= 1;
      if (remaining > 0) return;
      for (const node of graph.nodes) { try { node.disconnect(); } catch { /* already gone */ } }
    };
  }
}

/** Attack / hold / decay envelope on a gain (never above `peak`); returns when it reaches silence. */
function envelope(gain: GainNodeLike, when: number, peak: number, attack: number, hold: number, decay: number): number {
  gain.gain.cancelScheduledValues(when);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(peak, when + attack);
  gain.gain.setValueAtTime(peak, when + attack + hold);
  gain.gain.linearRampToValueAtTime(0, when + attack + hold + decay);
  return when + attack + hold + decay;
}

type Shape = Readonly<{ peak: number; attack: number; hold: number; decay: number }>;
function noise(context: SfxContext, graph: Graph, destination: unknown, when: number,
  options: Shape & Readonly<{ seconds: number; colour: 'white' | 'pink'; seed: number; filter?: NoiseFilter }>): void {
  const buffer = context.createBuffer(1, Math.max(1, Math.round(options.seconds * context.sampleRate)), context.sampleRate);
  buffer.getChannelData(0).set(noiseSamples(context.sampleRate, options.seconds, options.colour, options.seed, options.filter));
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  source.connect(gain);
  gain.connect(destination);
  const end = envelope(gain, when, options.peak, options.attack, options.hold, options.decay);
  source.start(when);
  source.stop(Math.min(when + options.seconds, end) + 0.002);
  graph.nodes.push(source, gain);
  graph.sources.push(source);
}

function tone(context: SfxContext, graph: Graph, destination: unknown, when: number, options: Shape & Readonly<{ frequency: number; to?: number }>): void {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(options.frequency, when);
  const gain = context.createGain();
  const end = envelope(gain, when, options.peak, options.attack, options.hold, options.decay);
  if (options.to !== undefined) oscillator.frequency.linearRampToValueAtTime(options.to, end);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(when);
  oscillator.stop(end + 0.002);
  graph.nodes.push(oscillator, gain);
  graph.sources.push(oscillator);
}

/**
 * Build one effect at `when` into `destination`. Returns the number of nodes it made (0 for an
 * unknown name) and when it ends; the graph disconnects itself once its sources have ended.
 */
export function playSynthSfx(name: SfxName, context: SfxContext, destination: unknown, when = context.currentTime): Readonly<{ nodes: number; end: number }> {
  const graph: Graph = { nodes: [], sources: [] };
  const at = Math.max(when, context.currentTime);
  switch (name) {
    case 'page-turn':
      // 0.35 s pink noise through a band-pass sweeping up to 2.2 kHz; envelope 10 / 120 / 200 ms.
      noise(context, graph, destination, at, { seconds: 0.35, colour: 'pink', seed: 11, peak: 0.45, attack: 0.01, hold: 0.12, decay: 0.2,
        filter: { type: 'bandpass', from: 1300, to: 2200, q: 0.9 } });
      break;
    case 'page-settle':
      // A short low tap: 60 ms.
      tone(context, graph, destination, at, { frequency: 140, to: 90, peak: 0.28, attack: 0.002, hold: 0.008, decay: 0.05 });
      noise(context, graph, destination, at, { seconds: 0.06, colour: 'pink', seed: 23, peak: 0.12, attack: 0.002, hold: 0.004, decay: 0.054,
        filter: { type: 'lowpass', from: 900, q: Math.SQRT1_2 } });
      break;
    case 'cover-open':
    case 'cover-close':
      // 80 Hz sine with a noise burst, 0.25 s (closing lands a little lower and quicker).
      tone(context, graph, destination, at, { frequency: name === 'cover-open' ? 80 : 70, peak: 0.3, attack: 0.012, hold: 0.04, decay: 0.198 });
      noise(context, graph, destination, at, { seconds: 0.25, colour: 'pink', seed: name === 'cover-open' ? 31 : 37, peak: 0.15,
        attack: name === 'cover-open' ? 0.02 : 0.006, hold: 0.03, decay: name === 'cover-open' ? 0.2 : 0.214, filter: { type: 'lowpass', from: 1600, q: Math.SQRT1_2 } });
      break;
    case 'pen':
      // A 3 ms click and a 1.8 kHz ping decaying over 40 ms.
      noise(context, graph, destination, at, { seconds: 0.004, colour: 'white', seed: 41, peak: 0.22, attack: 0.0005, hold: 0.0015, decay: 0.001 });
      tone(context, graph, destination, at, { frequency: 1800, peak: 0.14, attack: 0.001, hold: 0.002, decay: 0.04 });
      break;
    case 'flap':
      // Paper lifting: 0.15 s of band-passed pink noise.
      noise(context, graph, destination, at, { seconds: 0.15, colour: 'pink', seed: 53, peak: 0.4, attack: 0.015, hold: 0.035, decay: 0.1,
        filter: { type: 'bandpass', from: 900, to: 1500, q: 1.2 } });
      break;
    case 'stamp':
      // A low tap with a short noise thump: 0.12 s.
      tone(context, graph, destination, at, { frequency: 110, to: 70, peak: 0.3, attack: 0.002, hold: 0.01, decay: 0.108 });
      noise(context, graph, destination, at, { seconds: 0.12, colour: 'pink', seed: 61, peak: 0.15, attack: 0.002, hold: 0.008, decay: 0.11,
        filter: { type: 'lowpass', from: 1200, q: Math.SQRT1_2 } });
      break;
    default:
      return { nodes: 0, end: at };
  }
  release(graph);
  return { nodes: graph.nodes.length, end: at + SFX_SPECS[name].duration };
}
