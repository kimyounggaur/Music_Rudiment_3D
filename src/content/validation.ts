import { frac, add, sub, cmp, eq, sum, durationForNotation, measureDuration } from '../domain/index.ts';
import type { Fraction } from '../domain/index.ts';
import { durationChoices, notationForDuration } from './lesson.ts';
import type { LessonContent, MusicEvent, Task } from './types.ts';

export { notationForDuration } from './lesson.ts';
export type ValidationIssue = Readonly<{ path: string; code: string; message: string }>;
export type ValidationResult<T> = Readonly<{ valid: boolean; errors: readonly ValidationIssue[]; value?: T }>;
export type EventsResult = ValidationResult<readonly MusicEvent[]> & Readonly<{ events?: readonly MusicEvent[] }>;
const dangerous = new Set(['__proto__', 'constructor', 'prototype']);
const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
function issue(errors: ValidationIssue[], path: string, code: string, message: string): void { if (errors.length < 64) errors.push({ path, code, message }); }
function keys(v: Record<string, unknown>, allowed: readonly string[], path: string, errors: ValidationIssue[]): void {
  for (const name of Object.keys(v)) if (dangerous.has(name) || !allowed.includes(name)) issue(errors, `${path}.${name}`, 'unknown-key', '허용하지 않는 필드입니다.');
}
function boundedText(v: unknown, max: number): v is string { return typeof v === 'string' && v.length > 0 && v.length <= max; }
function fraction(v: unknown, path: string, errors: ValidationIssue[], positive = false): Fraction | undefined {
  if (!plain(v)) { issue(errors, path, 'fraction', '분수는 정수 n과 양수 d가 필요합니다.'); return; }
  keys(v, ['n', 'd'], path, errors);
  if (!Number.isSafeInteger(v.n) || !Number.isSafeInteger(v.d) || Math.abs(v.n as number) > 1_000_000 || (v.d as number) <= 0 || (v.d as number) > 1_000_000 || (positive ? (v.n as number) <= 0 : (v.n as number) < 0)) {
    issue(errors, path, 'fraction-range', '분수의 정수 범위 또는 부호가 올바르지 않습니다.'); return;
  }
  const result = frac(v.n as number, v.d as number);
  if (result.n !== v.n || result.d !== v.d) issue(errors, path, 'fraction-normalization', '기약분수로 저장해야 합니다.');
  return result;
}

export function validateEvents(input: unknown, options: Readonly<{ mode?: 'draft' | 'playable'; maxDuration?: Fraction; path?: string }> = {}): EventsResult {
  const errors: ValidationIssue[] = [];
  const path = options.path ?? 'events';
  if (!Array.isArray(input) || input.length > 64) return { valid: false, errors: [{ path, code: 'event-count', message: '이벤트 배열은64개 이하여야 합니다.' }] };
  if (options.mode === 'playable' && input.length === 0) issue(errors, path, 'empty-playback', '빈 초안은 재생할 수 없습니다.');
  const ids = new Set<string>();
  const events: MusicEvent[] = [];
  let cursor = frac(0, 1);
  input.forEach((raw, index) => {
    const p = `${path}[${index}]`;
    const before = errors.length;
    if (!plain(raw)) { issue(errors, p, 'event', '이벤트 객체가 필요합니다.'); return; }
    keys(raw, ['id', 'kind', 'onset', 'duration', 'pitch', 'notation'], p, errors);
    if (!boundedText(raw.id, 80) || !/^[A-Za-z0-9_-]+$/.test(raw.id as string)) issue(errors, `${p}.id`, 'id', 'ID는80자 이하 영문·숫자·밑줄·하이픈이어야 합니다.');
    else if (ids.has(raw.id)) issue(errors, `${p}.id`, 'duplicate-id', '이벤트 ID가 중복되었습니다.');
    else ids.add(raw.id);
    if (raw.kind !== 'note' && raw.kind !== 'rest') issue(errors, `${p}.kind`, 'kind', 'note 또는 rest가 필요합니다.');
    const onset = fraction(raw.onset, `${p}.onset`, errors);
    const duration = fraction(raw.duration, `${p}.duration`, errors, true);
    if (duration && !durationChoices.some(x => eq(x.duration, duration))) issue(errors, `${p}.duration`, 'unsupported-duration', '이 단원은온음표부터16분음표까지 지원합니다.');
    if (!plain(raw.notation)) issue(errors, `${p}.notation`, 'notation', '음표 표기가 필요합니다.');
    else {
      keys(raw.notation, ['type', 'dots', 'tuplet'], `${p}.notation`, errors);
      if (raw.notation.dots !== undefined && raw.notation.dots !== 0 || raw.notation.tuplet !== undefined && raw.notation.tuplet !== null) issue(errors, `${p}.notation`, 'pilot-notation', '이 파일럿의 점·셋잇단 표기는 지원하지 않습니다.');
      try {
        const written = durationForNotation(raw.notation as Parameters<typeof durationForNotation>[0]);
        if (duration && !eq(written, duration)) issue(errors, `${p}.notation`, 'notation-duration', '표기와 음가가 다릅니다.');
      } catch { issue(errors, `${p}.notation`, 'notation', '지원하지 않는 표기입니다.'); }
    }
    if (raw.kind === 'rest' && Object.hasOwn(raw, 'pitch')) issue(errors, `${p}.pitch`, 'rest-pitch', '쉼표에는음높이를 저장하지 않습니다.');
    if (raw.kind === 'note') {
      if (!plain(raw.pitch)) issue(errors, `${p}.pitch`, 'note-pitch', '음표에는음높이가 필요합니다.');
      else {
        keys(raw.pitch, ['step', 'alter', 'octave'], `${p}.pitch`, errors);
        if (raw.pitch.step !== 'C' || raw.pitch.alter !== 0 || raw.pitch.octave !== 4) issue(errors, `${p}.pitch`, 'pilot-pitch', '첫 단원의음높이는C4로 고정합니다.');
      }
    }
    if (onset && duration) {
      if (!eq(onset, cursor)) issue(errors, `${p}.onset`, cmp(onset, cursor) < 0 ? 'overlap' : 'gap', '이벤트는순서대로이어져야 하며 무음은쉼표로 표현합니다.');
      cursor = add(onset, duration);
      if (cmp(cursor, options.maxDuration ?? frac(1, 1)) > 0) issue(errors, `${p}.duration`, 'bar-overflow', '한 마디범위를넘었습니다.');
    }
    if (before === errors.length && onset && duration) {
      const base = { id: raw.id as string, onset, duration, notation: notationForDuration(duration) };
      events.push(Object.freeze(raw.kind === 'rest' ? { ...base, kind: 'rest' as const } : { ...base, kind: 'note' as const, pitch: Object.freeze({ step: 'C' as const, alter: 0, octave: 4 }) }));
    }
  });
  const result = Object.freeze(events);
  return errors.length ? { valid: false, errors } : { valid: true, errors: [], value: result, events: result };
}

export type Assessment = Readonly<{ valid: boolean; success: boolean; total: Fraction; difference: Fraction; durationKinds: number; rests: number; code: 'invalid' | 'under' | 'over' | 'rests' | 'kinds' | 'only-duration' | 'success'; message: string }>;
export function assessPattern(input: unknown, task: Task): Assessment {
  const validation = validateEvents(input);
  if (!validation.valid) return { valid: false, success: false, total: frac(0, 1), difference: task.target, durationKinds: 0, rests: 0, code: 'invalid', message: validation.errors[0]?.message ?? '데이터를확인하세요.' };
  const events = validation.events!;
  const total = sum(events.map(x => x.duration));
  const difference = sub(task.target, total);
  const durationKinds = new Set(events.map(x => `${x.duration.n}/${x.duration.d}`)).size;
  const rests = events.filter(x => x.kind === 'rest').length;
  const base = { valid: true, success: false, total, difference, durationKinds, rests };
  const relation = cmp(total, task.target);
  if (relation !== 0) {
    const amount = relation < 0 ? difference : sub(total, task.target);
    return { ...base, code: relation < 0 ? 'under' : 'over', message: `온음표 기준${amount.n}/${amount.d}만큼 ${relation < 0 ? '부족합니다' : '초과합니다'}.` };
  }
  if (rests < (task.minimumRests ?? 0)) return { ...base, code: 'rests', message: '총 길이는맞아요. 쉼표를하나이상넣어보세요.' };
  if (task.onlyDuration && events.some(x => !eq(x.duration, task.onlyDuration!))) return { ...base, code: 'only-duration', message: `이 과제는${task.onlyDuration.n}/${task.onlyDuration.d} 길이만사용해요.` };
  if (durationKinds < (task.minimumDurationKinds ?? 1)) return { ...base, code: 'kinds', message: '총 길이는맞지만두종류이상의음가를사용해야해요. 같은길이의음표와쉼표는한종류예요.' };
  return { ...base, success: true, code: 'success', message: '현재 리듬이조건을모두만족합니다.' };
}

export function validateLessonContent(input: unknown): ValidationResult<LessonContent> {
  const errors: ValidationIssue[] = [];
  if (!plain(input)) return { valid: false, errors: [{ path: 'lesson', code: 'object', message: '단원객체가필요합니다.' }] };
  keys(input, ['schemaVersion', 'contentVersion', 'lessonId', 'locale', 'title', 'pitchConvention', 'scenes'], 'lesson', errors);
  if (input.schemaVersion !== '2.0.0' || input.contentVersion !== '1.0.0' || input.lessonId !== 'duration-basics' || input.locale !== 'ko-KR' || input.pitchConvention !== 'C4=MIDI60') issue(errors, 'lesson', 'version', '지원하지않는단원·버전·언어입니다.');
  if (!boundedText(input.title, 200)) issue(errors, 'lesson.title', 'text', '단원제목을확인하세요.');
  if (!Array.isArray(input.scenes) || input.scenes.length !== 6) return { valid: false, errors: [...errors, { path: 'lesson.scenes', code: 'scenes', message: '파일럿은여섯장면입니다.' }] };
  const sceneIds = new Set<string>();
  const globalIds = new Set<string>();
  input.scenes.forEach((raw, index) => {
    const p = `lesson.scenes[${index}]`;
    if (!plain(raw)) { issue(errors, p, 'scene', '장면객체가필요합니다.'); return; }
    keys(raw, ['sceneId', 'title', 'goal', 'question', 'instructions', 'meter', 'tempo', 'lanes', 'task', 'questions', 'teacherGuide', 'alternative', 'completion', 'audio'], p, errors);
    if (raw.sceneId !== `scene-${index + 1}` || sceneIds.has(raw.sceneId as string)) issue(errors, `${p}.sceneId`, 'scene-id', '장면ID나순서를확인하세요.');
    sceneIds.add(raw.sceneId as string);
    for (const key of ['title', 'goal', 'question', 'instructions', 'alternative', 'completion']) if (!boundedText(raw[key], 4000)) issue(errors, `${p}.${key}`, 'text', '설명은1~4000자여야합니다.');
    try {
      if (!plain(raw.meter)) throw new Error();
      keys(raw.meter, ['numerator', 'denominator', 'groups'], `${p}.meter`, errors);
      measureDuration(raw.meter as Parameters<typeof measureDuration>[0]);
      if (raw.meter.numerator !== 4 || raw.meter.denominator !== 4 || JSON.stringify(raw.meter.groups) !== '[1,1,1,1]') throw new Error();
    } catch { issue(errors, `${p}.meter`, 'meter', '첫단원은4/4와묶음[1,1,1,1]입니다.'); }
    if (!plain(raw.tempo)) issue(errors, `${p}.tempo`, 'tempo', '템포객체가필요합니다.');
    else {
      keys(raw.tempo, ['bpm', 'unit'], `${p}.tempo`, errors);
      const unit = fraction(raw.tempo.unit, `${p}.tempo.unit`, errors, true);
      if (!Number.isSafeInteger(raw.tempo.bpm) || (raw.tempo.bpm as number) < 30 || (raw.tempo.bpm as number) > 240 || !unit || !eq(unit, frac(1, 4))) issue(errors, `${p}.tempo`, 'tempo', '4분음표기준정수템포30~240이필요합니다.');
    }
    if (!plain(raw.task)) issue(errors, `${p}.task`, 'task', '과제조건이필요합니다.');
    else {
      keys(raw.task, ['target', 'minimumDurationKinds', 'minimumRests', 'onlyDuration'], `${p}.task`, errors);
      const target = fraction(raw.task.target, `${p}.task.target`, errors, true);
      if (target && cmp(target, frac(1, 1)) > 0) issue(errors, `${p}.task.target`, 'target', '목표는한마디이하여야합니다.');
      for (const key of ['minimumDurationKinds', 'minimumRests']) if (raw.task[key] !== undefined && (!Number.isSafeInteger(raw.task[key]) || (raw.task[key] as number) < 0 || (raw.task[key] as number) > 16)) issue(errors, `${p}.task.${key}`, 'task-range', '조건범위를확인하세요.');
      if (raw.task.onlyDuration !== undefined) fraction(raw.task.onlyDuration, `${p}.task.onlyDuration`, errors, true);
    }
    if (!Array.isArray(raw.lanes) || raw.lanes.length < 1 || raw.lanes.length > 3) issue(errors, `${p}.lanes`, 'lanes', '1~3개레인이필요합니다.');
    else {
      const laneIds = new Set<string>();
      raw.lanes.forEach((lane, laneIndex) => {
        const lp = `${p}.lanes[${laneIndex}]`;
        if (!plain(lane)) { issue(errors, lp, 'lane', '레인객체가필요합니다.'); return; }
        keys(lane, ['laneId', 'label', 'role', 'events'], lp, errors);
        if (!boundedText(lane.laneId, 40) || laneIds.has(lane.laneId as string)) issue(errors, `${lp}.laneId`, 'lane-id', '레인ID를확인하세요.');
        laneIds.add(lane.laneId as string);
        if (!boundedText(lane.label, 200) || !['reference', 'draft'].includes(lane.role as string)) issue(errors, lp, 'lane-fields', '레인이름과역할을확인하세요.');
        const result = validateEvents(lane.events, { path: `${lp}.events` });
        errors.push(...result.errors);
        for (const event of result.events ?? []) {
          if (globalIds.has(event.id)) issue(errors, `${lp}.events`, 'duplicate-id', '단원내이벤트ID가중복되었습니다.');
          globalIds.add(event.id);
        }
      });
    }
    if (!Array.isArray(raw.questions) || raw.questions.length > 10) issue(errors, `${p}.questions`, 'questions', '문항은10개이하여야합니다.');
    else {
      const questionIds = new Set<string>();
      raw.questions.forEach((question, qi) => {
        const qp = `${p}.questions[${qi}]`;
        if (!plain(question)) { issue(errors, qp, 'question', '문항객체가필요합니다.'); return; }
        keys(question, ['id', 'prompt', 'options', 'correctValue', 'explanation'], qp, errors);
        if (!boundedText(question.id, 80) || questionIds.has(question.id as string)) issue(errors, `${qp}.id`, 'question-id', '문항ID를확인하세요.');
        questionIds.add(question.id as string);
        if (!boundedText(question.prompt, 2000) || !boundedText(question.explanation, 4000)) issue(errors, qp, 'question-text', '질문과설명을확인하세요.');
        if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 8) issue(errors, `${qp}.options`, 'options', '2~8개선택지가필요합니다.');
        else {
          const values = new Set<string>();
          question.options.forEach((option, oi) => {
            if (!plain(option)) { issue(errors, `${qp}.options[${oi}]`, 'option', '선택지객체가필요합니다.'); return; }
            keys(option, ['value', 'label'], `${qp}.options[${oi}]`, errors);
            if (!boundedText(option.value, 80) || !boundedText(option.label, 500) || values.has(option.value as string)) issue(errors, `${qp}.options[${oi}]`, 'option-fields', '선택지값이나문장을확인하세요.');
            values.add(option.value as string);
          });
          if (!values.has(question.correctValue as string)) issue(errors, `${qp}.correctValue`, 'answer-reference', '정답은선택지에있어야합니다.');
        }
      });
    }
    if (!plain(raw.teacherGuide)) issue(errors, `${p}.teacherGuide`, 'teacher', '교사안내가필요합니다.');
    else {
      keys(raw.teacherGuide, ['misconception', 'answer', 'demonstration', 'extension4', 'extension5'], `${p}.teacherGuide`, errors);
      for (const key of ['misconception', 'answer', 'demonstration', 'extension4', 'extension5']) if (!boundedText(raw.teacherGuide[key], 4000)) issue(errors, `${p}.teacherGuide.${key}`, 'teacher-text', '교사안내를확인하세요.');
    }
    if (!plain(raw.audio)) issue(errors, `${p}.audio`, 'audio', '오디오계약이필요합니다.');
    else {
      keys(raw.audio, ['instrument', 'narrationAssetId', 'backgroundMusicAssetId'], `${p}.audio`, errors);
      if (raw.audio.instrument !== 'prototype-synth' || raw.audio.narrationAssetId !== null || raw.audio.backgroundMusicAssetId !== null) issue(errors, `${p}.audio`, 'audio-assets', '이단원은합성학습음이며내레이션과BGM은없습니다.');
    }
  });
  return errors.length ? { valid: false, errors } : { valid: true, errors: [], value: input as unknown as LessonContent };
}
