import type { PageId } from '../../book/manifest.ts';
import type { PageSpec } from '../../book/print/pageSpec.ts';
import { LESSON_PAGE_SPECS } from './lessonPages.ts';
import { MATTER_PAGE_SPECS } from './matterPages.ts';

/** Printed page DSL for every page of the book: the six lesson spreads plus the contents and closing (v3 R8). */
export function pageSpecFor(pageId: PageId): PageSpec {
  const spec = LESSON_PAGE_SPECS.get(pageId) ?? MATTER_PAGE_SPECS.get(pageId);
  if (!spec) throw new RangeError(`No printed page for ${pageId}`);
  return spec;
}
