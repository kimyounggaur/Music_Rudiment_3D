import type { PageId } from './manifest.ts';

export class PageNotationError extends Error {
  readonly pageId: PageId;
  readonly revision: number;
  constructor(pageId: PageId, revision: number, message: string) {
    super(message || '악보를 준비하지 못했습니다.');
    this.name = 'PageNotationError';
    this.pageId = pageId;
    this.revision = revision;
  }
}

/** A superseded error is pending, never a failure of the current print batch. */
export function pageNotationReady(score: Pick<Element, 'getAttribute'>,
  pageId: PageId, revision: number, preparationEpoch: number): boolean {
  if (score.getAttribute('data-notation-revision') !== String(revision)
    || score.getAttribute('data-notation-epoch') !== String(preparationEpoch)) return false;
  const status = score.getAttribute('data-notation-status');
  if (status === 'error') throw new PageNotationError(pageId, revision, score.getAttribute('data-notation-error') ?? '');
  return status === 'ready' && score.getAttribute('data-notation-ready') === 'true';
}
