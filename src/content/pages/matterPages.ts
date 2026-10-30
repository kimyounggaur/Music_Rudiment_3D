import { lessonContent } from '../lesson.ts';
import type { SceneId } from '../types.ts';
import { isSceneComplete } from '../../lesson/controller.ts';
import { lessonPageNumber } from '../../book/lessonPresentation.ts';
import { CLOSING_SPREAD, CONTENTS_SPREAD } from '../../book/manifest.ts';
import type { LessonSpreadId, PageId } from '../../book/manifest.ts';
import type { ContentsEntry, PageContext, PageSpec } from '../../book/print/pageSpec.ts';
import { folioLabel, PAGE_TEXT, RUNNING_HEADS } from './pageText.ts';

/**
 * v3 R8 front and back matter (REFACTOR_DESIGN_V3 §6 R8): the contents spread before the lessons
 * and the closing spread after them. Lesson titles and goals come from content/lesson.ts as they
 * are; the only new words are the labels in pageText.ts. Completion marks and the closing stamp are
 * derived from the lesson state (isSceneComplete), never stored.
 */
const scenes = lessonContent.scenes;
const spreadOf = (sceneId: SceneId) => `spread-${sceneId.slice(6)}` as LessonSpreadId;
const allComplete = (context: PageContext) => scenes.every(scene => isSceneComplete(context.lesson, scene.sceneId));

const entry = (index: number): ContentsEntry => {
  const scene = scenes[index]!;
  return {
    id: spreadOf(scene.sceneId), number: String(index + 1), title: scene.title, detail: scene.goal,
    folio: folioLabel(lessonPageNumber(scene.sceneId, 'left')),
    command: { type: 'goto', spreadId: spreadOf(scene.sceneId) },
    done: context => isSceneComplete(context.lesson, scene.sceneId),
    testId: `contents-${spreadOf(scene.sceneId)}`,
  };
};

const contentsLeft: PageSpec = {
  pageId: CONTENTS_SPREAD.leftPageId, side: 'left', runningHead: RUNNING_HEADS.left, folio: null,
  blocks: [
    { kind: 'heading', level: 1, text: PAGE_TEXT.contentsTitle, focusTarget: true },
    { kind: 'paragraph', style: 'lead', text: lessonContent.title },
    { kind: 'paragraph', style: 'caption', text: PAGE_TEXT.contentsHint },
    { kind: 'rule' },
    { kind: 'contents', id: 'toc', label: PAGE_TEXT.contentsTitle, entries: [0, 1, 2].map(entry) },
  ],
};
const contentsRight: PageSpec = {
  pageId: CONTENTS_SPREAD.rightPageId, side: 'right', runningHead: PAGE_TEXT.contentsTitle, folio: null,
  blocks: [
    { kind: 'spacer', size: 1.2 },
    { kind: 'contents', id: 'toc', label: PAGE_TEXT.contentsTitle, entries: [
      ...[3, 4, 5].map(entry),
      { id: 'closing', number: '', title: PAGE_TEXT.closingEntry, folio: '', command: { type: 'goto', spreadId: 'closing' },
        done: allComplete, testId: 'contents-closing' },
    ] },
  ],
};

const closingLeft: PageSpec = {
  pageId: CLOSING_SPREAD.leftPageId, side: 'left', runningHead: RUNNING_HEADS.left, folio: null,
  blocks: [
    { kind: 'heading', level: 1, text: PAGE_TEXT.closingTitle, focusTarget: true },
    { kind: 'paragraph', style: 'lead', text: lessonContent.title },
    { kind: 'rule' },
    { kind: 'checklist', id: 'done', label: PAGE_TEXT.closingDone,
      items: context => scenes.map((scene, index) => ({ label: `${index + 1}. ${scene.title}`, done: isSceneComplete(context.lesson, scene.sceneId) })) },
  ],
};
const closingRight: PageSpec = {
  pageId: CLOSING_SPREAD.rightPageId, side: 'right', runningHead: PAGE_TEXT.closingTitle, folio: null,
  blocks: [
    { kind: 'heading', level: 2, text: PAGE_TEXT.closingReview },
    ...scenes.flatMap(scene => [{ kind: 'heading' as const, level: 3 as const, text: scene.title }, { kind: 'paragraph' as const, style: 'body' as const, text: scene.goal }]),
    { kind: 'stampSlot', id: 'book', label: PAGE_TEXT.bookStamp, stamped: allComplete },
    { kind: 'buttons', id: 'closing', label: PAGE_TEXT.closingTitle, compact: true, buttons: [
      { id: 'contents', label: PAGE_TEXT.backToContents, icon: 'look', command: { type: 'goto', spreadId: 'contents' }, testId: 'closing-contents' },
    ] },
  ],
};

export const MATTER_PAGE_SPECS: ReadonlyMap<PageId, PageSpec> = new Map([contentsLeft, contentsRight, closingLeft, closingRight].map(spec => [spec.pageId, spec]));
