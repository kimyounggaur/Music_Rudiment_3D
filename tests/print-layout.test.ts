import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonState, reduceLesson, sceneEvents } from '../src/lesson/controller.ts';
import { getScene } from '../src/content/lesson.ts';
import { BOOK_MANIFEST } from '../src/book/manifest.ts';
import { pageSpecFor } from '../src/content/pages/index.ts';
import { hitTest, layoutPage, PAGE_LOGICAL, PRINT_MARGINS, READING_HINT, wrapText } from '../src/book/print/pageLayout.ts';
import type { FontSpec, PageLayout } from '../src/book/print/pageLayout.ts';
import { paintPage } from '../src/book/print/pagePainter.ts';
import type { PageSpec } from '../src/book/print/pageSpec.ts';
import { contextFor, recordingContext, sceneFor, sixteenSixteenths, stubMeasure, stubServices } from './support/print.ts';

const allPages = BOOK_MANIFEST.flatMap(spread => [spread.leftPageId, spread.rightPageId]);
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

test('questions print one radio hotspot per option, and only while the flap is open', () => {
  for (const spread of BOOK_MANIFEST) {
    const scene = getScene(spread.sceneId);
    if (!scene.questions.length) continue;
    const spec = pageSpecFor(spread.leftPageId);
    const closed = layoutPage(spec, contextFor(spread.leftPageId), stubServices);
    assert.equal(closed.hotspots.filter(hotspot => hotspot.role === 'radio').length, 0);
    const open = layoutPage(spec, contextFor(spread.leftPageId, createLessonState(), { hints: { [`${spread.sceneId}/questions`]: 1 } }), stubServices);
    const radios = open.hotspots.filter(hotspot => hotspot.role === 'radio');
    assert.equal(radios.length, scene.questions.reduce((total, question) => total + question.options.length, 0));
    for (const question of scene.questions) assert.equal(radios.filter(radio => radio.group === question.id).length, question.options.length);
    // Answers follow the same playback rule as the 2D fieldset.
    const playing = layoutPage(spec, contextFor(spread.leftPageId, createLessonState(), { hints: { [`${spread.sceneId}/questions`]: 1 },
      playback: { state: 'playing', laneId: scene.lanes[0]!.laneId, activeEventId: null, error: null } }), stubServices);
    assert.ok(playing.hotspots.filter(hotspot => hotspot.role === 'radio').every(hotspot => !hotspot.enabled));
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
        playback: { state: 'paused', laneId: getScene(scene).lanes[0]!.laneId, activeEventId: null, error: '소리를 시작하지 못했습니다.' } }), stubServices));
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
