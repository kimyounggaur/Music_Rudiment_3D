import { DomainError, safeInteger } from './errors.ts';
import { cmp, div, frac, mul } from './fraction.ts';
import type { Fraction } from './fraction.ts';

export type Tempo = Readonly<{ bpm: number; unit: Fraction }>;
export type Meter = Readonly<{ numerator: number; denominator: number; groups: readonly number[] }>;
export type Pitch = Readonly<{
  step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  /** Final effective alteration, including any key signature: never apply the key twice. */
  alter: number;
  octave: number;
}>;
export type NotationType = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';
export type Notation = Readonly<{
  type: NotationType;
  dots?: number;
  tuplet?: Readonly<{ actual: number; normal: number }> | null;
}>;

export const MAX_BPM = 400;
export const MAX_METER_NUMERATOR = 64;
export const MAX_NOTATION_DOTS = 3;
export const MAX_TUPLET_COUNT = 64;

/** Converts whole-note-relative time to seconds only at the presentation/audio boundary. */
export function seconds(duration: Fraction, tempo: Tempo): number {
  if (tempo === null || typeof tempo !== 'object') {
    throw new DomainError('INVALID_TEMPO', 'Tempo requires bpm and a unit fraction.');
  }
  safeInteger(tempo.bpm, 'bpm');
  if (tempo.bpm < 1 || tempo.bpm > MAX_BPM || cmp(tempo.unit, frac(0)) <= 0) {
    throw new DomainError('INVALID_TEMPO', `Tempo requires a positive unit and bpm from 1 through ${MAX_BPM}.`);
  }
  if (cmp(duration, frac(0)) < 0) {
    throw new DomainError('NEGATIVE_TIME', 'Musical time cannot be negative.');
  }
  const exact = mul(div(duration, tempo.unit), frac(60, tempo.bpm));
  return exact.n / exact.d;
}

export function measureDuration(meter: Meter): Fraction {
  if (meter === null || typeof meter !== 'object') {
    throw new DomainError('INVALID_METER', 'A meter with numerator, denominator and groups is required.');
  }
  safeInteger(meter.numerator, 'meter.numerator');
  safeInteger(meter.denominator, 'meter.denominator');
  if (meter.numerator < 1 || meter.numerator > MAX_METER_NUMERATOR ||
      ![1, 2, 4, 8, 16, 32, 64].includes(meter.denominator) ||
      !Array.isArray(meter.groups) || meter.groups.length < 1 || meter.groups.length > 64) {
    throw new DomainError('INVALID_METER', 'Unsupported meter range or grouping.');
  }
  let groupSum = 0;
  for (const group of meter.groups) {
    safeInteger(group, 'meter.groups item');
    if (group < 1 || group > meter.numerator) {
      throw new DomainError('INVALID_METER', 'Each group must be a positive part of the numerator.');
    }
    groupSum += group;
  }
  if (groupSum !== meter.numerator) {
    throw new DomainError('INVALID_METER', 'The sum of groups must equal the numerator.');
  }
  return frac(meter.numerator, meter.denominator);
}

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

function pitchParts(pitch: Pitch): { diatonic: number; midi: number } {
  if (pitch === null || typeof pitch !== 'object') {
    throw new DomainError('INVALID_PITCH', 'Pitch requires step, alter and octave.');
  }
  const index = STEPS.indexOf(pitch.step);
  safeInteger(pitch.alter, 'pitch.alter');
  safeInteger(pitch.octave, 'pitch.octave');
  if (index < 0) throw new DomainError('INVALID_PITCH', 'Pitch step must be an uppercase letter A through G.');
  if (pitch.alter < -2 || pitch.alter > 2 || pitch.octave < -1 || pitch.octave > 9) {
    throw new DomainError('PITCH_RANGE', 'Supported pitches use alterations -2 through 2 and octaves -1 through 9.');
  }
  const value = (pitch.octave + 1) * 12 + SEMITONES[index] + pitch.alter;
  if (value < 0 || value > 127) {
    throw new DomainError('PITCH_RANGE', 'Pitch is outside MIDI 0 through 127.');
  }
  return { diatonic: pitch.octave * 7 + index, midi: value };
}

export function midi(pitch: Pitch): number {
  return pitchParts(pitch).midi;
}

/** Prototype synth only: 12-tone equal temperament, A4 = 440 Hz, C4 = MIDI 60. */
export function frequency(pitch: Pitch): number {
  return 440 * 2 ** ((midi(pitch) - 69) / 12);
}

/** Ascending simple intervals (including unison and octave), through augmented/diminished. */
export function intervalName(from: Pitch, to: Pitch): string {
  const a = pitchParts(from);
  const b = pitchParts(to);
  const degree = b.diatonic - a.diatonic + 1;
  const semitones = b.midi - a.midi;
  if (degree < 1 || degree > 8 || semitones < 0) {
    throw new DomainError('UNSUPPORTED_INTERVAL', 'Only ascending simple intervals from unison through octave are supported.');
  }
  const baseline = [0, 2, 4, 5, 7, 9, 11, 12][degree - 1];
  const change = semitones - baseline;
  const perfectClass = [1, 4, 5, 8].includes(degree);
  let quality: string;
  if (perfectClass && change === 0) quality = '완전';
  else if (!perfectClass && change === 0) quality = '장';
  else if (!perfectClass && change === -1) quality = '단';
  else if (change === 1) quality = '증';
  else if ((perfectClass && change === -1) || (!perfectClass && change === -2)) quality = '감';
  else {
    throw new DomainError('UNSUPPORTED_INTERVAL', 'Doubly augmented or diminished interval qualities are not supported.');
  }
  return `${quality}${degree}도`;
}

const NOTATION_DENOMINATORS: Record<NotationType, number> = {
  whole: 1, half: 2, quarter: 4, eighth: 8, sixteenth: 16,
};

export function durationForNotation(notation: Notation): Fraction {
  if (notation === null || typeof notation !== 'object' ||
      !Object.hasOwn(NOTATION_DENOMINATORS, notation.type)) {
    throw new DomainError('INVALID_NOTATION', 'Unsupported notation type.');
  }
  const dots = notation.dots === undefined ? 0 : notation.dots;
  safeInteger(dots, 'notation.dots');
  if (dots < 0 || dots > MAX_NOTATION_DOTS) {
    throw new DomainError('INVALID_NOTATION', `Dots must be from 0 through ${MAX_NOTATION_DOTS}.`);
  }
  // 0, 1, 2 dots multiply the base duration by 1, 3/2, 7/4 respectively.
  let duration = mul(frac(1, NOTATION_DENOMINATORS[notation.type]), frac(2 ** (dots + 1) - 1, 2 ** dots));
  if (notation.tuplet !== null && notation.tuplet !== undefined) {
    if (typeof notation.tuplet !== 'object') {
      throw new DomainError('INVALID_NOTATION', 'Tuplet requires actual and normal counts.');
    }
    const { actual, normal } = notation.tuplet;
    safeInteger(actual, 'notation.tuplet.actual');
    safeInteger(normal, 'notation.tuplet.normal');
    if (actual < 1 || actual > MAX_TUPLET_COUNT || normal < 1 || normal > MAX_TUPLET_COUNT) {
      throw new DomainError('INVALID_NOTATION', `Tuplet counts must be from 1 through ${MAX_TUPLET_COUNT}.`);
    }
    duration = mul(duration, frac(normal, actual));
  }
  return duration;
}
