import type { PageId } from '../../book/manifest.ts';
import type { PageSpec } from '../../book/print/pageSpec.ts';
import { LESSON_PAGE_SPECS } from './lessonPages.ts';

/** Printed page DSL for every page in the book manifest. */
export function pageSpecFor(pageId: PageId): PageSpec {
  const spec = LESSON_PAGE_SPECS.get(pageId);
  if (!spec) throw new RangeError(`No printed page for ${pageId}`);
  return spec;
}
