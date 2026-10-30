import type { LessonState } from '../../lesson/controller.ts';
import { bookCanInteract, tokenMatches } from './controller.ts';
import type { BookState, BookToken } from './controller.ts';
import { BOOK_MANIFEST } from './manifest.ts';

/** Identity retained across pause/resume, independent of an individual source node. */
export type BookAudioOwner = Readonly<{
  token: BookToken;
  revision: number;
  spreadId: BookState['currentSpreadId'];
  mode: BookState['mode'];
  laneId: string;
  tempo: number;
}>;

/** Absent owners never identify a reusable pending or paused request. */
export function sameAudioOwner(a: BookAudioOwner | null, b: BookAudioOwner | null): boolean {
  return a !== null && b !== null
    && a.token.bookEpoch === b.token.bookEpoch
    && a.token.navigationToken === b.token.navigationToken
    && a.token.sceneInstanceId === b.token.sceneInstanceId
    && a.revision === b.revision && a.spreadId === b.spreadId
    && a.mode === b.mode && a.laneId === b.laneId && a.tempo === b.tempo;
}

/** Paused pages remain eligible; page departure or changed music revokes ownership. */
export function audioOwnerIsCurrent(owner: BookAudioOwner, book: BookState, lesson: LessonState): boolean {
  if (!bookCanInteract(book) || !tokenMatches(book, owner.token)
    || book.currentSpreadId !== owner.spreadId || book.mode !== owner.mode
    || lesson.revision !== owner.revision) return false;
  // The committed book spread owns audio even while the lesson cursor is being
  // synchronized. Never resolve a lane through an unrelated scene's cursor.
  const spread = BOOK_MANIFEST.find(item => item.spreadId === book.currentSpreadId);
  const scene = spread && lesson.scenes[spread.sceneId];
  return !!scene && scene.tempo === owner.tempo && Object.hasOwn(scene.patterns, owner.laneId);
}
