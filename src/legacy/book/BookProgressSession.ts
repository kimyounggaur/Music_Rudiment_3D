import { saveBookProgress } from '../../persistence/bookProgress.ts';
import type { BookProgressEnvelope, BookSaveResult } from '../../persistence/bookProgress.ts';
import type { Result, StorageLike } from '../../persistence/progress.ts';
import { captureBookProgress } from './learningProgress.ts';
import type { CaptureBookProgressOptions } from './learningProgress.ts';

/** Live achievement history and the last confirmed disk baseline have distinct lifetimes. */
export class BookProgressSession {
  private memoryPrevious: BookProgressEnvelope | null;
  private savedRaw: string | null;

  constructor(progress: BookProgressEnvelope | null, raw: string | null) {
    this.memoryPrevious = progress;
    this.savedRaw = raw;
  }

  get previous(): BookProgressEnvelope | null { return this.memoryPrevious; }
  get raw(): string | null { return this.savedRaw; }

  capture(options: Omit<CaptureBookProgressOptions, 'previous'>): Result<BookProgressEnvelope> {
    const result = captureBookProgress({ ...options, previous: this.memoryPrevious });
    // Reaching a learning goal counts in this session even when storage is full
    // or blocked. Subsequent edits/exports must retain that historical success.
    if (result.ok) this.memoryPrevious = result.value;
    return result;
  }

  save(input: BookProgressEnvelope, storage: StorageLike): Result<BookSaveResult> {
    const result = saveBookProgress(input, storage, this.savedRaw);
    if (result.ok) {
      this.savedRaw = result.value.raw;
      this.memoryPrevious = result.value.progress;
    }
    return result;
  }

  /** Call only after the parent confirms an import or completes app-record deletion. */
  adopt(progress: BookProgressEnvelope | null, raw: string | null): void {
    this.memoryPrevious = progress;
    this.savedRaw = raw;
  }
}
