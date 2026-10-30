import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonState, reduceLesson, sceneEvents } from '../src/lesson/controller.ts';
import { getScene } from '../src/content/lesson.ts';
import { BOOK_MANIFEST, BOOK_SPREADS } from '../src/book/manifest.ts';
import { pageSpecFor } from '../src/content/pages/index.ts';
import { hitTest, layoutPage, PAGE_LOGICAL, PRINT_MARGINS, READING_HINT, wrapText } from '../src/book/print/pageLayout.ts';
import type { FontSpec, PageLayout } from '../src/book/print/pageLayout.ts';
import { paintPage } from '../src/book/print/pagePainter.ts';
import type { PageSpec } from '../src/book/print/pageSpec.ts';
import { contextFor, recordingContext, sceneFor, sixteenSixteenths, stubMeasure, stubServices } from './support/print.ts';

// v3 R8: the whole book — contents, six lessons and closing.
const allPages = BOOK_SPREADS.flatMap(spread => [spread.leftPageId, spread.rightPageId]);
const within = (value: number, min: number, max: number) => value >= min - 1e-6 && value <= max + 1e-6;

test('Korean keep-all wrapping breaks between words and splits only an over-long word', () => {
  const font: FontSpec = { family: 'Book Sans', weight: 400, size: 26 };
  const text = '같은 길이와 음높이의 이웃 음표만 합칠 수 있어요. 소리 없는 구간에도 시간과 다음 음표의 시작 위치는 유지돼요.';
  const lines = wrapText(text, 300, font, stubMeasure);
  assert.ok(lines.length > 2);
  for (const line of lines) assert.ok(stubMeasure(line, font) <= 300 + 1e-6, `${line} exceeds the measure`);
  // Words stay whole (keep-all): rejoining with spaces gives the source text back.
  assert.equal(lines.join(' '), text);
  const long = wrapText('가'.repeat(30), 200, font, stubMeasure);
  assert.ok(long.length > 1 && long.every(line => stubMeasure(line, font) <= 200 + 1e-6));
  assert.deepEqual(wrapText('', 200, font, stubMeasure), ['']);
});

test('every printed page lays out inside its margins with hotspots on the paper', () => {
  for (const pageId of allPages) {
    const spec = pageSpecFor(pageId);
    // Open every flap: the fullest version of each page.
    const scene = sceneFor(pageId);
    const layout = layoutPage(spec, contextFor(pageId, createLessonState(), { hints: { [`${scene}/questions`]: 1, [`${scene}/alternative`]: 1 } }), stubServices);
    const left = spec.side === 'right' ? PRINT_MARGINS.inner : PRINT_MARGINS.outer;
    const right = PAGE_LOGICAL.width - (spec.side === 'right' ? PRINT_MARGINS.outer : PRINT_MARGINS.inner);
    for (const item of layout.items) {
      if (item.kind !== 'text') continue;
      for (const line of item.lines) {
        assert.ok(within(line.x, left, right), `${pageId}: "${line.text}" starts outside the margins`);
        assert.ok(line.x + stubMeasure(line.text, line.font) <= right + 0.5, `${pageId}: "${line.text}" runs into the margin`);
      }
    }
    for (const hotspot of layout.hotspots) {
      assert.ok(within(hotspot.rect.x, left, right) && within(hotspot.rect.x + hotspot.rect.w, left, right), `${pageId}: ${hotspot.id} outside x margins`);
      assert.ok(hotspot.rect.y >= PRINT_MARGINS.top - 1e-6, `${pageId}: ${hotspot.id} above the top margin`);
      assert.ok(hotspot.rect.y + hotspot.rect.h <= PAGE_LOGICAL.height, `${pageId}: ${hotspot.id} below the page`);
      assert.ok(hotspot.rect.w > 0 && hotspot.rect.h > 0);
    }
    assert.ok(layout.scale >= 0.8 && layout.scale <= 1);
    // The reading-mode hint is printed in the margin of every left page (R3 x-height fallback).
    const texts = layout.items.flatMap(item => item.kind === 'text' ? item.lines.map(line => line.text) : []);
    assert.equal(texts.includes(READING_HINT), spec.side === 'left', pageId);
  }
});

test('right pages reserve a figure rect whose height is the spec ratio of the page', () => {
  for (const spread of BOOK_MANIFEST) {
    const spec = pageSpecFor(spread.rightPageId);
    const figure = spec.blocks.find(block => block.kind === 'figure');
    assert.ok(figure && figure.kind === 'figure');
    const layout = layoutPage(spec, contextFor(spread.rightPageId), stubServices);
    const rect = layout.figureRects[`${spread.sceneId}-lanes`];
    assert.ok(rect, `${spread.rightPageId} has no figure rect`);
    assert.ok(Math.abs(rect.h - figure.height * PAGE_LOGICAL.height) < 1e-6);
    // Nothing is printed and no control sits inside the figure window.
    for (const hotspot of layout.hotspots) {
      const overlap = hotspot.rect.x < rect.x + rect.w && hotspot.rect.x + hotspot.rect.w > rect.x && hotspot.rect.y < rect.y + rect.h && hotspot.rect.y + hotspot.rect.h > rect.y;
      assert.equal(overlap, false, `${hotspot.id} overlaps the figure`);
    }
  }
});

test('v3 R5: questions print one radio per option; answers wait under a covered flap whose paper never moves; all-correct answers stamp', () => {
  const words = (layout: ReturnType<typeof layoutPage>) => layout.items.flatMap(item => item.kind === 'text' ? item.lines.map(line => line.text) : []).join(' ');
  for (const spread of BOOK_MANIFEST) {
    const scene = getScene(spread.sceneId);
    if (!scene.questions.length) continue;
    const spec = pageSpecFor(spread.leftPageId);
    const closed = layoutPage(spec, contextFor(spread.leftPageId), stubServices);
    const radios = closed.hotspots.filter(hotspot => hotspot.role === 'radio');
    assert.equal(radios.length, scene.questions.reduce((total, question) => total + question.options.length, 0));
    for (const question of scene.questions) assert.equal(radios.filter(radio => radio.group === question.id).length, question.options.length);
    // Answers follow the same playback rule as the 2D fieldset.
    const playing = layoutPage(spec, contextFor(spread.leftPageId, createLessonState(), {
      playback: { state: 'playing', laneId: scene.lanes[0]!.laneId, activeEventId: null, error: null } }), stubServices);
    assert.ok(playing.hotspots.filter(hotspot => hotspot.role === 'radio').every(hotspot => !hotspot.enabled));
    // The answer flap: closed it prints its paper over the reserved space; open, the explanations.
    const flap = closed.flaps.find(item => item.id === 'answer');
    assert.ok(flap && !flap.open, spread.leftPageId);
    // The sheet carries its own words: how to lift it (front) and how to fold it down (back).
    assert.ok(flap.hint.includes('들어 올려') && flap.foldHint.includes('덮기'), `${flap.hint} / ${flap.foldHint}`);
    assert.ok(closed.items.some(item => item.kind === 'flapCover'));
    const open = layoutPage(spec, contextFor(spread.leftPageId, createLessonState(), { hints: { [`${spread.sceneId}/answer`]: 1 } }), stubServices);
    const opened = open.flaps.find(item => item.id === 'answer');
    assert.ok(opened?.open);
    assert.deepEqual(opened.rect, flap.rect, 'the flap paper keeps its place');
    assert.deepEqual(open.stamps.map(stamp => stamp.rect), closed.stamps.map(stamp => stamp.rect), 'nothing below the flap moves');
    // The explanation's longest word: distinctive on the page and never split by wrapping.
    const fragment = scene.questions[0]!.explanation.split(' ').reduce((longest, word) => word.length > longest.length ? word : longest, '');
    assert.ok(!words(closed).includes(fragment) && words(open).includes(fragment), `${spread.leftPageId}: explanations only under an open flap`);
    assert.equal(open.hotspots.find(hotspot => hotspot.role === 'flap' && hotspot.id === flap.hotspotId)?.expanded, true);
    // The stamp is derived from the saved answers (no new field): all correct → stamped.
    assert.equal(closed.stamps.length, 1);
    assert.equal(closed.stamps[0]!.stamped, false);
    let lesson = reduceLesson(createLessonState(), { type: 'navigate', sceneId: spread.sceneId });
    for (const question of scene.questions) lesson = reduceLesson(lesson, { type: 'answer', questionId: question.id, value: question.correctValue });
    assert.equal(layoutPage(spec, contextFor(spread.leftPageId, lesson), stubServices).stamps[0]!.stamped, true);
  }
});

test('the event list prints sixteen 1/16 notes in a grid, every note a selectable hotspot', () => {
  const lesson = sixteenSixteenths();
  const events = sceneEvents(lesson, 'scene-2');
  assert.equal(events.length, 16);
  const layout = layoutPage(pageSpecFor('page-3'), contextFor('page-3', lesson), stubServices);
  const cells = layout.items.filter(item => item.kind === 'cell');
  assert.equal(cells.length, 16);
  const notes = layout.hotspots.filter(hotspot => hotspot.role === 'note' && hotspot.mirror !== false);
  assert.deepEqual(notes.map(note => note.eventId), events.map(event => event.id));
  const rows = new Set(cells.map(cell => cell.kind === 'cell' ? Math.round(cell.rect.y) : 0));
  assert.equal(rows.size, 4);
  assert.equal(layout.overflow, 0);
  // Selecting a note in the active lane does not reset the lane (selectLane would select its first event).
  const command = notes[5]!.command;
  assert.deepEqual(command, { type: 'lesson', commands: [{ type: 'select', id: events[5]!.id }] });
});

test('layout is deterministic and reports overflow instead of printing past the margin', () => {
  const first = layoutPage(pageSpecFor('page-11'), contextFor('page-11'), stubServices);
  const second = layoutPage(pageSpecFor('page-11'), contextFor('page-11'), stubServices);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
  const crowded: PageSpec = { pageId: 'page-1', side: 'left', runningHead: '시험', folio: 1,
    blocks: Array.from({ length: 40 }, () => ({ kind: 'paragraph', text: '긴 문단이 페이지 아래 여백을 넘어갑니다. '.repeat(4) })) };
  const overflowing = layoutPage(crowded, contextFor('page-1'), stubServices);
  assert.ok(overflowing.overflow > 0);
  assert.equal(overflowing.scale, 0.8);
  assert.ok(overflowing.items.some(item => item.kind === 'overflow'));
});

test('hitTest finds the topmost hotspot, inclusive of its edges', () => {
  const layout = layoutPage(pageSpecFor('page-4'), contextFor('page-4', reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-2' })), stubServices);
  const split = layout.hotspots.find(hotspot => hotspot.testId === 'split-note')!;
  assert.ok(split);
  const { x, y, w, h } = split.rect;
  assert.equal(hitTest(layout, x + w / 2, y + h / 2)?.id, split.id);
  assert.equal(hitTest(layout, x, y)?.id, split.id);
  assert.equal(hitTest(layout, x + w, y + h)?.id, split.id);
  assert.notEqual(hitTest(layout, x - 0.5, y + h / 2)?.id, split.id);
  assert.equal(hitTest(layout, 5, 5), null);
});

test('the painter starts with a white sheet and leaves the figure window unprinted', () => {
  const layout: PageLayout = layoutPage(pageSpecFor('page-2'), contextFor('page-2'), stubServices);
  const { context, calls } = recordingContext(768, 1130);
  const drawn: string[] = [];
  paintPage(context, layout, { draw: (_context, key) => { drawn.push(key); } });
  const first = calls.find(call => call.name === 'fillRect');
  assert.ok(first);
  assert.equal(first.fillStyle, '#ffffff');
  assert.deepEqual(first.args, [0, 0, 768, 1130]);
  const k = 768 / PAGE_LOGICAL.width;
  const rect = layout.figureRects['scene-1-lanes']!;
  const inside = (x: number, y: number) => x > rect.x * k + 0.5 && x < (rect.x + rect.w) * k - 0.5 && y > rect.y * k + 0.5 && y < (rect.y + rect.h) * k - 0.5;
  for (const call of calls) {
    if (call.name !== 'fillText' && call.name !== 'fillRect' && call.name !== 'moveTo' && call.name !== 'lineTo') continue;
    if (call === first) continue;
    const [a, b] = call.args.slice(call.name === 'fillText' ? 1 : 0) as number[];
    assert.equal(inside(a!, b!), false, `${call.name} draws inside the figure window`);
  }
  // Left pages print notation through the injected engraver.
  const left = layoutPage(pageSpecFor('page-1'), contextFor('page-1'), stubServices);
  paintPage(recordingContext(768, 1130).context, left, { draw: (_context, key) => { drawn.push(key); } });
  assert.equal(drawn.length, getScene('scene-1').lanes.length);
});

test('every printed character is covered by the bundled page-font subsets', async () => {
  const { PAGE_FONT_CHARACTERS } = await import('../src/book/print/pageFonts.generated.ts');
  const covered = new Set([...PAGE_FONT_CHARACTERS]);
  const missing = new Set<string>();
  const check = (layout: PageLayout) => {
    for (const item of layout.items) {
      const lines = item.kind === 'text' ? item.lines : item.kind === 'cell' ? [item.number, item.label]
        : item.kind === 'entry' ? [item.number, ...item.title, ...item.detail, item.folio]
        : item.kind === 'button' || item.kind === 'radio' || item.kind === 'checkbox' || item.kind === 'flapTab' || item.kind === 'stampSlot' || item.kind === 'overflow' ? item.label
          : item.kind === 'axis' ? item.ticks : [];
      for (const line of lines) for (const character of line.text) if (!covered.has(character)) missing.add(character);
    }
  };
  const states = [createLessonState(), sixteenSixteenths()];
  // Scene 6 with notes and rests added, explanation checked, and an error line.
  let composed = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-6' });
  for (const kind of ['note', 'rest'] as const) composed = reduceLesson(composed, { type: 'add', kind, duration: { n: 1, d: 4 } });
  states.push(reduceLesson(composed, { type: 'explain', checked: true }));
  for (const lesson of states) for (const pageId of allPages) {
    const scene = sceneFor(pageId);
    for (const composeKind of ['note', 'rest'] as const) {
      check(layoutPage(pageSpecFor(pageId), contextFor(pageId, lesson, { hints: { [`${scene}/questions`]: 1, [`${scene}/alternative`]: 1 }, ui: { composeKind },
        playback: { state: 'paused', laneId: scene ? getScene(scene).lanes[0]!.laneId : null, activeEventId: null, error: '소리를 시작하지 못했습니다.' } }), stubServices));
    }
  }
  assert.deepEqual([...missing], [], `rerun scripts/extract-page-fonts.mjs for: ${[...missing].join('')}`);
});

test('print, assessment and sound read the same lesson revision after an edit', async () => {
  const { currentAssessment } = await import('../src/lesson/controller.ts');
  const { printKey } = await import('../src/book/print/pageCompositor.ts');
  const before = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-2' });
  const after = reduceLesson(before, { type: 'split' });
  assert.equal(after.revision, before.revision + 1);
  const spec = pageSpecFor('page-3');
  assert.notEqual(printKey(spec, contextFor('page-3', after)), printKey(spec, contextFor('page-3', before)));
  const layout = layoutPage(spec, contextFor('page-3', after), stubServices);
  const printed = layout.hotspots.filter(hotspot => hotspot.role === 'note' && hotspot.mirror !== false).map(hotspot => hotspot.eventId);
  // The audio engine schedules sceneEvents(...) and the assessment sums the same list.
  const events = sceneEvents(after, 'scene-2');
  assert.deepEqual(printed, events.map(event => event.id));
  const total = currentAssessment(after, 'scene-2').total;
  assert.deepEqual([total.n, total.d], [1, 1]);
  const caption = layoutPage(pageSpecFor('page-4'), contextFor('page-4', after), stubServices).items
    .flatMap(item => item.kind === 'text' ? item.lines.map(line => line.text) : []).join(' ');
  assert.match(caption, new RegExp(`음표 ${events.length}개`));
});

test('v3 R8: the contents print a row per lesson (plus the closing) that jumps there; rows are 44 units or taller and wrap inside the page', async () => {
  const { isSceneComplete } = await import('../src/lesson/controller.ts');
  const rows = (['page-13', 'page-14'] as const).flatMap(pageId => {
    const layout = layoutPage(pageSpecFor(pageId), contextFor(pageId), stubServices);
    assert.equal(layout.overflow, 0, `${pageId} fits its page`);
    return layout.hotspots.map(hotspot => ({ pageId, hotspot, item: layout.items.find(item => item.kind === 'entry' && item.hotspotId === hotspot.id) }));
  });
  assert.deepEqual(rows.map(row => row.hotspot.command), [1, 2, 3, 4, 5, 6].map(n => ({ type: 'goto', spreadId: `spread-${n}` })).concat([{ type: 'goto', spreadId: 'closing' }]));
  assert.deepEqual(rows.map(row => row.hotspot.testId), ['spread-1', 'spread-2', 'spread-3', 'spread-4', 'spread-5', 'spread-6', 'closing'].map(id => `contents-${id}`));
  for (const row of rows) {
    assert.ok(row.item && row.item.kind === 'entry', `${row.hotspot.id} is printed as a contents row`);
    assert.ok(row.hotspot.rect.h >= 44, `${row.hotspot.id} is at least 44 units tall`);
    assert.equal(row.hotspot.role, 'button');
  }
  // Lesson titles and first pages (folios 1, 3, … 11) come from the lesson content.
  assert.deepEqual(rows.slice(0, 6).map(row => row.item?.kind === 'entry' ? [row.item.title.map(line => line.text).join(' '), row.item.folio.text] : null),
    [1, 2, 3, 4, 5, 6].map(n => [getScene(`scene-${n}` as 'scene-1').title, `${2 * n - 1}쪽`]));
  // Completion marks follow the lesson state; nothing is stored.
  assert.ok(rows.every(row => row.item?.kind === 'entry' && !row.item.done));
  assert.equal(isSceneComplete(createLessonState(), 'scene-1'), false);
});

test('v3 R8: the closing lists the six experiments, stamps only when all are complete, and leads back to the contents', () => {
  const left = layoutPage(pageSpecFor('page-15'), contextFor('page-15'), stubServices);
  const right = layoutPage(pageSpecFor('page-16'), contextFor('page-16'), stubServices);
  for (const layout of [left, right]) assert.equal(layout.overflow, 0, `${layout.pageId} fits its page`);
  const checks = left.items.filter(item => item.kind === 'checkbox');
  assert.equal(checks.length, 6);
  assert.ok(checks.every(item => item.kind === 'checkbox' && !item.checked && !item.hotspotId), 'printed checks, not controls');
  assert.deepEqual(right.stamps.map(stamp => [stamp.id, stamp.stamped]), [['book', false]]);
  assert.deepEqual(right.hotspots.map(hotspot => [hotspot.testId, hotspot.command]), [['closing-contents', { type: 'goto', spreadId: 'contents' }]]);
  // Unnumbered matter: no folio in the bottom margin.
  const folioBand = (layout: PageLayout) => layout.items.flatMap(item => item.kind === 'text' ? item.lines : []).filter(line => line.baseline > PAGE_LOGICAL.height - PRINT_MARGINS.bottom && line.text !== READING_HINT);
  assert.deepEqual(folioBand(left), []);
  assert.deepEqual(folioBand(right), []);
});
