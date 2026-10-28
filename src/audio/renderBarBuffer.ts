import { frequency, seconds } from '../domain/index.ts';
import type { AudioSnapshot } from './AudioEngine.ts';

export interface AudioBufferLike {
  readonly duration: number;
  readonly length: number;
  readonly sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface BufferRenderContext {
  readonly sampleRate: number;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
}

/** Render one already-validated, frozen bar; musical appointments stay in seconds.
 * A sample is filled only at/after its onset and before its end (at most one
 * sample of quantization). The remaining logical bar, including rests, is zero.
 */
export function renderBarBuffer(snapshot: AudioSnapshot, context: BufferRenderContext): AudioBufferLike {
  const rate = context.sampleRate;
  if (!Number.isFinite(rate) || rate <= 0 || rate > 384_000) throw new Error('Invalid audio sample rate');
  const duration = seconds(snapshot.logicalDuration!, snapshot.tempo);
  const buffer = context.createBuffer(1, Math.ceil(duration * rate), rate);
  const data = buffer.getChannelData(0);
  for (const event of snapshot.events) {
    if (event.kind === 'rest') continue;
    const onset = seconds(event.onset, snapshot.tempo);
    const length = seconds(event.duration, snapshot.tempo);
    const end = onset + length;
    const ramp = Math.min(0.008, length / 4);
    const hz = frequency(event.pitch!);
    const first = Math.ceil(onset * rate);
    const afterLast = Math.min(data.length, Math.ceil(end * rate));
    for (let index = first; index < afterLast; index++) {
      const elapsed = index / rate - onset;
      const envelope = Math.max(0, Math.min(1, elapsed / ramp, (length - elapsed) / ramp));
      data[index] = Math.sin(2 * Math.PI * hz * elapsed) * envelope;
    }
  }
  return buffer;
}
