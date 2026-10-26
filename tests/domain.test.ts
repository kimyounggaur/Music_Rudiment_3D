import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DomainError, frac, normalize, add, sub, mul, div, cmp, eq, sum,
  seconds, measureDuration, midi, frequency, intervalName, durationForNotation,
  MAX_FRACTION_COMPONENT, MAX_SUM_TERMS,
} from '../src/domain/index.ts';
import type { DomainErrorCode, Fraction, Meter, Notation, Pitch, Tempo } from '../src/domain/index.ts';

function fails(code: DomainErrorCode, action: () => unknown): void {
  assert.throws(action, (error: unknown) => error instanceof DomainError && error.code === code);
}

const p = (step: Pitch['step'], alter = 0, octave = 4): Pitch => ({ step, alter, octave });
const q90: Tempo = { bpm: 90, unit: frac(1, 4) };

test('M01: 1/2 + 1/4 + 1/8 + 1/8 is canonical 1/1', () => {
  assert.deepEqual(sum([frac(1, 2), frac(1, 4), frac(1, 8), frac(1, 8)]), { n: 1, d: 1 });
});

test('M02: three thirds equal exactly one, without epsilon comparison', () => {
  assert.deepEqual(sum([frac(1, 3), frac(1, 3), frac(1, 3)]), frac(1));
  assert.equal(eq(add(frac(1, 3), frac(2, 3)), frac(1)), true);
});

test('M03: 4/4 measure has whole-note-relative duration 1', () => {
  assert.deepEqual(measureDuration({ numerator: 4, denominator: 4, groups: [1, 1, 1, 1] }), frac(1));
});

test('M04: 3/4 and 6/8 share a duration but retain different groups', () => {
  const simple: Meter = { numerator: 3, denominator: 4, groups: [1, 1, 1] };
  const compound: Meter = { numerator: 6, denominator: 8, groups: [3, 3] };
  assert.deepEqual(measureDuration(simple), frac(3, 4));
  assert.deepEqual(measureDuration(compound), frac(3, 4));
  assert.notDeepEqual(simple.groups, compound.groups);
  assert.deepEqual(compound.groups, [3, 3]);
});

test('M05: a dotted quarter is 3/8', () => {
  assert.deepEqual(durationForNotation({ type: 'quarter', dots: 1 }), frac(3, 8));
});

test('M06: each triplet eighth is 1/12 and three total 1/4', () => {
  const eighth = durationForNotation({ type: 'eighth', tuplet: { actual: 3, normal: 2 } });
  assert.deepEqual(eighth, frac(1, 12));
  assert.deepEqual(sum([eighth, eighth, eighth]), frac(1, 4));
});

test('M07: enharmonic D-sharp and E-flat retain augmented-second/minor-third names', () => {
  assert.equal(midi(p('D', 1)), midi(p('E', -1)));
  assert.equal(intervalName(p('C'), p('D', 1)), '증2도');
  assert.equal(intervalName(p('C'), p('E', -1)), '단3도');
});

test('M08: C4 is MIDI60; F-sharp effective alter=1 is applied once', () => {
  assert.equal(midi(p('C')), 60);
  assert.equal(midi(p('F', 1)), 66);
  assert.equal(midi(p('F', 0)), 65);
  assert.equal(frequency(p('A')), 440);
  assert.ok(Math.abs(frequency(p('C')) - 261.6255653005986) < 1e-10);
});

test('M09: at quarter=90, an eighth lasts 1/3 seconds', () => {
  assert.equal(seconds(frac(1, 8), q90), 1 / 3);
  assert.equal(seconds(frac(1), q90), 8 / 3);
  assert.deepEqual([0, 1, 2, 3].map(i => seconds(frac(i, 4), q90)), [0, 2 / 3, 4 / 3, 2]);
});

test('M10 domain boundary: silent spans retain time; source exclusion belongs to audio integration', () => {
  const rest = { kind: 'rest', onset: frac(1, 4), duration: frac(1, 4) } as const;
  assert.equal(seconds(rest.onset, q90), 2 / 3);
  assert.equal(seconds(rest.duration, q90), 2 / 3);
  assert.equal(seconds(add(rest.onset, rest.duration), q90), 4 / 3);
  assert.equal(Object.hasOwn(rest, 'pitch'), false);
  // No synth, source or AudioContext is constructed by this dependency-free domain.
});

test('M11: denominator zero is a structured error', () => {
  fails('INVALID_DENOMINATOR', () => frac(1, 0));
  fails('INVALID_DENOMINATOR', () => add({ n: 1, d: 0 }, frac(1)));
});

test('normalization preserves negative differences and canonical zero', () => {
  assert.deepEqual(frac(6, 8), { n: 3, d: 4 });
  assert.deepEqual(frac(-6, 8), { n: -3, d: 4 });
  assert.deepEqual(frac(-0, 37), { n: 0, d: 1 });
  assert.deepEqual(sub(frac(1, 4), frac(1, 2)), frac(-1, 4));
  assert.deepEqual(normalize(normalize({ n: 12, d: 18 })), frac(2, 3));
  assert.deepEqual(sum([]), frac(0));
  fails('INVALID_DENOMINATOR', () => frac(1, -2));
});

test('algebraic invariants across signed small rational inputs', () => {
  const samples = [frac(-3, 7), frac(-1, 3), frac(0), frac(1, 16), frac(1, 3), frac(3, 4), frac(7, 5)];
  for (const a of samples) {
    assert.deepEqual(normalize(normalize(a)), a);
    assert.equal(cmp(a, a), 0);
    for (const b of samples) {
      assert.deepEqual(add(a, b), add(b, a));
      assert.deepEqual(mul(a, b), mul(b, a));
      assert.deepEqual(sub(add(a, b), b), a);
      assert.equal(cmp(a, b), -cmp(b, a) || 0);
      assert.equal(eq(a, b), cmp(a, b) === 0);
      if (b.n !== 0) assert.deepEqual(div(mul(a, b), b), a);
      for (const c of samples) {
        assert.deepEqual(add(add(a, b), c), add(a, add(b, c)));
        assert.deepEqual(mul(mul(a, b), c), mul(a, mul(b, c)));
      }
    }
  }
});

test('split and merge preserve exact totals through sixteen subdivisions', () => {
  let blocks = [frac(1)];
  for (let level = 0; level < 4; level += 1) {
    blocks = blocks.flatMap(value => [div(value, frac(2)), div(value, frac(2))]);
    assert.deepEqual(sum(blocks), frac(1));
  }
  assert.equal(blocks.length, 16);
  assert.ok(blocks.every(value => eq(value, frac(1, 16))));
  while (blocks.length > 1) {
    blocks = Array.from({ length: blocks.length / 2 }, (_, i) => add(blocks[i * 2], blocks[i * 2 + 1]));
    assert.deepEqual(sum(blocks), frac(1));
  }
});

test('fraction input rejects non-finite, fractional, non-number and unsafe integers', () => {
  for (const invalid of [NaN, Infinity, -Infinity, 0.5, '1', undefined, null]) {
    fails('INVALID_INTEGER', () => frac(invalid as number, 4));
    fails('INVALID_INTEGER', () => frac(1, invalid as number));
  }
  fails('INTEGER_RANGE', () => frac(Number.MAX_SAFE_INTEGER + 1, 1));
  fails('INTEGER_RANGE', () => frac(1, Number.MAX_SAFE_INTEGER + 1));
  fails('INVALID_FRACTION', () => add(null as unknown as Fraction, frac(1)));
  fails('INVALID_FRACTION', () => sum(null as unknown as Fraction[]));
});

test('BigInt intermediate products remain exact and only reduced JSON overflow is rejected', () => {
  const largest = frac(MAX_FRACTION_COMPONENT);
  assert.deepEqual(mul(frac(MAX_FRACTION_COMPONENT, 2), frac(2, MAX_FRACTION_COMPONENT)), frac(1));
  assert.deepEqual(add(frac(1, MAX_FRACTION_COMPONENT), frac(MAX_FRACTION_COMPONENT - 1, MAX_FRACTION_COMPONENT)), frac(1));
  assert.equal(cmp(frac(MAX_FRACTION_COMPONENT - 1, MAX_FRACTION_COMPONENT), frac(1)), -1);
  assert.deepEqual(sum([largest, largest, frac(-MAX_FRACTION_COMPONENT), frac(-MAX_FRACTION_COMPONENT)]), frac(0));
  fails('OVERFLOW', () => add(largest, frac(1)));
  fails('OVERFLOW', () => mul(largest, frac(2)));
  fails('OVERFLOW', () => mul(frac(1, MAX_FRACTION_COMPONENT), frac(1, 2)));
});

test('division sign is canonical and division by zero is rejected', () => {
  assert.deepEqual(div(frac(1, 2), frac(-3, 4)), frac(-2, 3));
  fails('DIVISION_BY_ZERO', () => div(frac(1), frac(0)));
});

test('sum enforces the engine safety bound without conflating it with a valid bar', () => {
  assert.deepEqual(sum(Array.from({ length: MAX_SUM_TERMS }, () => frac(1, MAX_SUM_TERMS))), frac(1));
  fails('COLLECTION_LIMIT', () => sum(Array.from({ length: MAX_SUM_TERMS + 1 }, () => frac(1, 16))));
});

test('meter validation rejects invalid group semantics and unsupported ranges', () => {
  const invalid: Meter[] = [
    { numerator: 4, denominator: 4, groups: [3] },
    { numerator: 4, denominator: 4, groups: [0, 4] },
    { numerator: 4, denominator: 4, groups: [] },
    { numerator: 0, denominator: 4, groups: [1] },
    { numerator: 65, denominator: 4, groups: [65] },
    { numerator: 4, denominator: 3, groups: [4] },
    { numerator: 4, denominator: 128, groups: [4] },
  ];
  for (const meter of invalid) fails('INVALID_METER', () => measureDuration(meter));
  fails('INVALID_INTEGER', () => measureDuration({ numerator: 4, denominator: 4, groups: [1.5, 2.5] }));
});

test('tempo changes real seconds without changing the original rational duration', () => {
  const duration = frac(1, 4);
  const before = JSON.stringify(duration);
  assert.equal(seconds(duration, { bpm: 60, unit: frac(1, 4) }), 1);
  assert.equal(seconds(duration, { bpm: 120, unit: frac(1, 4) }), 0.5);
  assert.equal(seconds(frac(1), { bpm: 60, unit: frac(1, 4) }), 4);
  assert.equal(seconds(frac(1), { bpm: 120, unit: frac(1, 4) }), 2);
  assert.equal(seconds(frac(3, 4), { bpm: 60, unit: frac(3, 8) }), 2);
  assert.equal(JSON.stringify(duration), before);
  assert.equal(seconds(frac(0), q90), 0);
});

test('invalid tempo and negative musical time are rejected', () => {
  for (const bpm of [0, -1, 401]) fails('INVALID_TEMPO', () => seconds(frac(1), { bpm, unit: frac(1, 4) }));
  fails('INVALID_INTEGER', () => seconds(frac(1), { bpm: 90.5, unit: frac(1, 4) }));
  fails('INVALID_TEMPO', () => seconds(frac(1), { bpm: 90, unit: frac(0) }));
  fails('INVALID_TEMPO', () => seconds(frac(1), { bpm: 90, unit: frac(-1, 4) }));
  fails('NEGATIVE_TIME', () => seconds(frac(-1, 4), q90));
});

test('pitch MIDI boundaries, alterations and invalid inputs are explicit', () => {
  assert.equal(midi(p('C', 0, -1)), 0);
  assert.equal(midi(p('G', 0, 9)), 127);
  assert.equal(midi(p('D', -2)), 60);
  fails('PITCH_RANGE', () => midi(p('C', -1, -1)));
  fails('PITCH_RANGE', () => midi(p('B', 0, 9)));
  fails('PITCH_RANGE', () => midi(p('C', 3)));
  fails('PITCH_RANGE', () => midi(p('C', 0, 10)));
  fails('INVALID_PITCH', () => midi({ step: 'H', alter: 0, octave: 4 } as unknown as Pitch));
  fails('INVALID_INTEGER', () => midi(p('C', 0.5)));
});

test('simple interval names include unison, octave and diminished classes', () => {
  assert.equal(intervalName(p('C'), p('C')), '완전1도');
  assert.equal(intervalName(p('C'), p('G')), '완전5도');
  assert.equal(intervalName(p('C'), p('C', 0, 5)), '완전8도');
  assert.equal(intervalName(p('C'), p('E')), '장3도');
  assert.equal(intervalName(p('C'), p('G', -1)), '감5도');
  assert.equal(intervalName(p('C', 1), p('D', -1)), '감2도');
  fails('UNSUPPORTED_INTERVAL', () => intervalName(p('C'), p('B', 0, 3)));
  fails('UNSUPPORTED_INTERVAL', () => intervalName(p('C'), p('D', 0, 5)));
  fails('UNSUPPORTED_INTERVAL', () => intervalName(p('C', -1), p('D', 1)));
});

test('all MVP notation lengths, multiple dots and tuplet ratios remain exact', () => {
  for (const [type, denominator] of [['whole', 1], ['half', 2], ['quarter', 4], ['eighth', 8], ['sixteenth', 16]] as const) {
    assert.deepEqual(durationForNotation({ type }), frac(1, denominator));
  }
  assert.deepEqual(durationForNotation({ type: 'quarter', dots: 2 }), frac(7, 16));
  assert.deepEqual(durationForNotation({ type: 'quarter', dots: 3 }), frac(15, 32));
  assert.deepEqual(durationForNotation({ type: 'sixteenth', tuplet: { actual: 5, normal: 4 } }), frac(1, 20));
});

test('notation rejects unknown types, unsafe dots and invalid tuplet counts', () => {
  fails('INVALID_NOTATION', () => durationForNotation({ type: 'emoji' } as unknown as Notation));
  fails('INVALID_NOTATION', () => durationForNotation({ type: 'quarter', dots: -1 }));
  fails('INVALID_NOTATION', () => durationForNotation({ type: 'quarter', dots: 4 }));
  fails('INVALID_INTEGER', () => durationForNotation({ type: 'quarter', dots: NaN }));
  fails('INVALID_INTEGER', () => durationForNotation({ type: 'quarter', dots: null } as unknown as Notation));
  for (const counts of [{ actual: 0, normal: 2 }, { actual: 3, normal: 0 }, { actual: 65, normal: 2 }]) {
    fails('INVALID_NOTATION', () => durationForNotation({ type: 'eighth', tuplet: counts }));
  }
});
