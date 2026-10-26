/** Stable codes let adapters translate errors without matching message text. */
export type DomainErrorCode =
  | 'INVALID_INTEGER'
  | 'INTEGER_RANGE'
  | 'INVALID_FRACTION'
  | 'INVALID_DENOMINATOR'
  | 'DIVISION_BY_ZERO'
  | 'OVERFLOW'
  | 'COLLECTION_LIMIT'
  | 'INVALID_TEMPO'
  | 'NEGATIVE_TIME'
  | 'INVALID_METER'
  | 'INVALID_PITCH'
  | 'PITCH_RANGE'
  | 'UNSUPPORTED_INTERVAL'
  | 'INVALID_NOTATION';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function safeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new DomainError('INVALID_INTEGER', `${label} must be a finite integer.`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new DomainError('INTEGER_RANGE', `${label} exceeds the safe JSON integer range.`);
  }
  return value;
}
