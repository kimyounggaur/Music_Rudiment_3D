import { AudioEngine } from './AudioEngine.ts';
import type { AudioEngineOptions } from './AudioEngine.ts';

/** One engine/context with the book's reusable-buffer pause/resume policy. */
export class TransportAdapter extends AudioEngine {
  constructor(options: Omit<AudioEngineOptions, 'rendering'> = {}) {
    super({ ...options, rendering: 'buffer' });
  }
}
