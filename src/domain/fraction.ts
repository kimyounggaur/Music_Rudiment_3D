import { DomainError, safeInteger } from './errors.ts';

/** Canonical serialized boundary: safe integers, positive denominator, lowest terms. */
export type Fraction = Readonly<{ n: number; d: number }>;

export const MAX_FRACTION_COMPONENT = Number.MAX_SAFE_INTEGER;
export const MAX_SUM_TERMS = 64;
const MAX_COMPONENT = BigInt(MAX_FRACTION_COMPONENT);

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** Intermediate products stay exact; range is checked after reducing the result. */
function fromBig(n: bigint, d: bigint): Fraction {
  if (d === 0n) {
    throw new DomainError('INVALID_DENOMINATOR', 'The denominator cannot be zero.');
  }
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n === 0n) return Object.freeze({ n: 0, d: 1 });
  const divisor = gcd(n, d);
  n /= divisor;
  d /= divisor;
  if (abs(n) > MAX_COMPONENT || d > MAX_COMPONENT) {
    throw new DomainError('OVERFLOW', 'The reduced fraction exceeds the safe JSON integer range.');
  }
  return Object.freeze({ n: Number(n), d: Number(d) });
}

/** Input denominators must already be positive; signed differences use n. */
export function frac(n: number, d?: number): Fraction {
  safeInteger(n, 'numerator');
  // Omitted denominator is convenient for whole values; an explicitly missing
  // JSON field must not silently become a denominator of 1.
  const denominator = safeInteger(arguments.length < 2 ? 1 : d, 'denominator');
  if (denominator <= 0) {
    throw new DomainError('INVALID_DENOMINATOR', 'The denominator must be positive.');
  }
  return fromBig(BigInt(n), BigInt(denominator));
}

function read(value: Fraction): readonly [bigint, bigint] {
  if (value === null || typeof value !== 'object') {
    throw new DomainError('INVALID_FRACTION', 'A fraction object with n and d is required.');
  }
  const canonical = frac(value.n, value.d);
  return [BigInt(canonical.n), BigInt(canonical.d)];
}

export function normalize(value: Fraction): Fraction {
  const [n, d] = read(value);
  return fromBig(n, d);
}

export function add(a: Fraction, b: Fraction): Fraction {
  const [an, ad] = read(a);
  const [bn, bd] = read(b);
  return fromBig(an * bd + bn * ad, ad * bd);
}

export function sub(a: Fraction, b: Fraction): Fraction {
  const [an, ad] = read(a);
  const [bn, bd] = read(b);
  return fromBig(an * bd - bn * ad, ad * bd);
}

export function mul(a: Fraction, b: Fraction): Fraction {
  const [an, ad] = read(a);
  const [bn, bd] = read(b);
  return fromBig(an * bn, ad * bd);
}

export function div(a: Fraction, b: Fraction): Fraction {
  const [an, ad] = read(a);
  const [bn, bd] = read(b);
  if (bn === 0n) throw new DomainError('DIVISION_BY_ZERO', 'Cannot divide by a zero fraction.');
  return fromBig(an * bd, ad * bn);
}

export function cmp(a: Fraction, b: Fraction): -1 | 0 | 1 {
  const [an, ad] = read(a);
  const [bn, bd] = read(b);
  const delta = an * bd - bn * ad;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}

export function eq(a: Fraction, b: Fraction): boolean {
  return cmp(a, b) === 0;
}

/** The pilot's engine safety limit is 64 terms; a valid 4/4 bar has at most 16. */
export function sum(values: Iterable<Fraction>): Fraction {
  if (values === null || values === undefined || typeof values[Symbol.iterator] !== 'function') {
    throw new DomainError('INVALID_FRACTION', 'sum requires an iterable of fractions.');
  }
  let count = 0;
  let n = 0n;
  let d = 1n;
  for (const value of values) {
    count += 1;
    if (count > MAX_SUM_TERMS) {
      throw new DomainError('COLLECTION_LIMIT', `At most ${MAX_SUM_TERMS} fractions may be summed.`);
    }
    const [vn, vd] = read(value);
    n = n * vd + vn * d;
    d *= vd;
    const divisor = gcd(n, d);
    n /= divisor;
    d /= divisor;
  }
  return fromBig(n, d);
}
