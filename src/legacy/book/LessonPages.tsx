import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BookNotation } from './BookNotation.tsx';
import type { BookNotationArtifact } from './BookNotation.tsx';
import type { PlaybackSnapshot } from '../../audio/AudioEngine.ts';
import { durationChoices, durationLabel, getScene } from '../../content/lesson.ts';
import type { MusicEvent, SceneId } from '../../content/types.ts';
import { eq, frac, sum } from '../../domain/index.ts';
import { currentAssessment, isSceneComplete, sceneEvents, sceneState } from '../../lesson/controller.ts';
import type { LessonCommand, LessonState } from '../../lesson/controller.ts';
import { lessonEditsAllowed, lessonPageNumber, lessonTempoTiming } from './lessonPresentation.ts';
import '../styles/lesson-pages.css';

export type LessonPageProps = {
  lesson: LessonState;
  sceneId: SceneId;
  interactive: boolean;
  playback: PlaybackSnapshot | null;
  playingLane: string | null;
  onCommand: (command: LessonCommand) => void;
  onPlay: (laneId: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onMute: () => void;
  onMode: () => void;
  mode: '2d' | '3d';
  /** Inner page width in CSS pixels, before the page projection transform. */
  pageWidth?: number;
  reducedMotion?: boolean;
  preparationEpoch?: number;
  onNotationReady?: (laneId: string, artifact: BookNotationArtifact) => void;
  onNotationError?: (message: string) => void;
  hints?: Readonly<Record<string, number>>;
  onHint?: (key: string, open: boolean) => void;
  progressTools?: ReactNode;
};

function hasPlayback(props: LessonPageProps) {
  return props.playback?.state === 'playing' || props.playback?.state === 'starting' || props.playback?.state === 'paused';
}

function useSelection(props: LessonPageProps) {
  const current = sceneState(props.lesson, props.sceneId);
  return (laneId: string, eventId: string) => {
    if (!props.interactive || hasPlayback(props)) return;
    if (current.activeLaneId !== laneId) props.onCommand({ type: 'selectLane', laneId });
    props.onCommand({ type: 'select', id: eventId });
  };
}

function Questions(props: LessonPageProps) {
  const scene = getScene(props.sceneId);
  const current = sceneState(props.lesson, props.sceneId);
  const prefix = useId();
  if (!scene.questions.length) return null;
  return <details className="lesson-flap" open={props.hints?.[`${props.sceneId}/questions`] === 1}
    onToggle={event => props.onHint?.(`${props.sceneId}/questions`, event.currentTarget.open)}>
    <summary>생각을 확인해요</summary>
    {scene.questions.map(question => <fieldset key={question.id} data-print-disabled="false" disabled={!props.interactive || hasPlayback(props)}>
      <legend>{question.prompt}</legend>
      {question.options.map(option => <label key={option.value}>
        <input type="radio" name={`${prefix}-${question.id}`} value={option.value}
          checked={current.answers[question.id] === option.value}
          onChange={() => props.onCommand({ type: 'answer', questionId: question.id, value: option.value })} />
        <span>{option.label}</span>
      </label>)}
    </fieldset>)}
  </details>;
}

function EventList(props: LessonPageProps & { events: readonly MusicEvent[]; laneId: string }) {
  const selectedId = sceneState(props.lesson, props.sceneId).selectedEventId;
  const select = useSelection(props);
  return <ol className="lesson-event-list" aria-label="음표 선택 목록" data-book-instrument="true">
    {props.events.map((event, index) => <li key={event.id}>
      <button type="button" data-event-select={event.id} data-print-disabled="false" disabled={!props.interactive || hasPlayback(props)}
        aria-pressed={selectedId === event.id}
        aria-label={`${index + 1}번째 ${durationLabel(event.duration, event.kind)}, 온음표의 ${event.duration.n}/${event.duration.d}, 시작 ${event.onset.n}/${event.onset.d}`}
        onClick={() => select(props.laneId, event.id)}>
        <span className="lesson-event-number">{index + 1}</span>
        <span>{durationLabel(event.duration, event.kind)}</span>
      </button>
    </li>)}
  </ol>;
}

export function LessonLeftPage(props: LessonPageProps) {
  const scene = getScene(props.sceneId);
  const current = sceneState(props.lesson, props.sceneId);
  const select = useSelection(props);
  const width = Math.max(120, props.pageWidth ?? 360);
  return <div className="lesson-page-content" data-lesson-revision={props.lesson.revision}>
    <p className="book-running-title">음악이론 교과서 · 음가</p>
    <h1 tabIndex={-1}>{scene.title}</h1>
    <p className="lesson-question">{scene.question}</p>
    <p className="lesson-meter">4/4 · 4분음표 = {current.tempo} · C4</p>
    {scene.lanes.map(lane => {
      const events = sceneEvents(props.lesson, props.sceneId, lane.laneId);
      const activeId = props.playingLane === lane.laneId ? props.playback?.activeEventId : null;
      return <section key={lane.laneId} className="lesson-score" aria-label={lane.label} data-book-instrument="true">
        <h2>{lane.label}</h2>
        <BookNotation events={events} width={width} label={lane.label} contentRevision={props.lesson.revision} preparationEpoch={props.preparationEpoch}
          selectedEventId={current.activeLaneId === lane.laneId ? current.selectedEventId : null}
          activeEventIds={activeId ? [activeId] : []} showEventList={false}
          onSelect={props.interactive && !hasPlayback(props) ? id => select(lane.laneId, id) : undefined}
          onReady={artifact => props.onNotationReady?.(lane.laneId, artifact)} onError={props.onNotationError} />
        {props.sceneId === 'scene-1' && <p className="lesson-score-caption">{lane.laneId === 'upper' ? '한 번 시작해서 길게 · 온음표 1개' : '네 번 시작해서 짧게 · 4분음표 4개'}</p>}
        {['scene-2', 'scene-3', 'scene-4', 'scene-6'].includes(props.sceneId) && <EventList {...props} events={events} laneId={lane.laneId} />}
        {(props.sceneId === 'scene-3' || props.sceneId === 'scene-6') && !events.length && <p className="lesson-draft-note">빈 초안 · 아직 음표나 쉼표를 넣지 않았어요.</p>}
      </section>;
    })}
    <Questions {...props} />
    <small className="lesson-page-number">{lessonPageNumber(props.sceneId, 'left')}</small>
  </div>;
}

function ProportionalLane(props: LessonPageProps & { laneId: string }) {
  const events = sceneEvents(props.lesson, props.sceneId, props.laneId);
  const current = sceneState(props.lesson, props.sceneId);
  const activeId = props.playingLane === props.laneId ? props.playback?.activeEventId : null;
  const position = props.playingLane === props.laneId ? Math.max(0, Math.min(1, props.playback?.relativePosition ?? 0)) : 0;
  return <div className="lesson-flat-lane" aria-hidden="true">
    <div className="lesson-flat-track">
      {events.map((event, index) => <div key={event.id} className="lesson-flat-note"
        data-kind={event.kind}
        data-selected={current.activeLaneId === props.laneId && current.selectedEventId === event.id}
        data-active={event.id === activeId}
        style={{ left: `${event.onset.n / event.onset.d * 100}%`, width: `${event.duration.n / event.duration.d * 100}%` }}>
        <span>{index + 1}{event.kind === 'rest' ? ' · 쉼' : ''}</span>
      </div>)}
      {props.sceneId === 'scene-3' && <span className="lesson-half-target" />}
      {!props.reducedMotion && position > 0 && <span className="lesson-flat-playhead" style={{ left: `${position * 100}%` }} />}
    </div>
    <div className="lesson-flat-axis"><span>0</span><span>1/2</span><span>1</span></div>
  </div>;
}

function Transport(props: LessonPageProps) {
  const state = props.playback?.state;
  const paused = state === 'paused';
  return <div className="lesson-transport" aria-label="소리 조절">
    <button type="button" className="book-text-button lesson-pause-button" data-testid="pause-resume-audio"
      data-print-disabled="true" data-print-text="일시정지" disabled={!props.interactive || state !== 'playing' && !paused}
      onClick={paused ? props.onResume : props.onPause}>{paused ? '이어 듣기' : '일시정지'}</button>
    <button type="button" className="book-text-button" data-testid="stop-audio" data-print-disabled="true" disabled={!props.interactive || !hasPlayback(props)} onClick={props.onStop}>정지</button>
    <button type="button" className="book-text-button" aria-pressed={props.playback?.muted ?? false}
      data-print-disabled="false" disabled={!props.interactive} onClick={props.onMute}>{props.playback?.muted ? '음소거 해제' : '음소거'}</button>
    <span className="lesson-play-status" data-print-text="정지 상태" role="status">{state === 'starting' ? '소리를 준비해요' : paused ? '일시정지' : state === 'playing' ? '재생 중' : '정지 상태'}</span>
  </div>;
}

function useEditGroup(props: LessonPageProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const submittedControl = useRef<HTMLButtonElement | null>(null);
  const edit = (command: LessonCommand) => {
    const focused = document.activeElement;
    submittedControl.current = focused instanceof HTMLButtonElement && controlsRef.current?.contains(focused)
      ? focused : null;
    props.onCommand(command);
  };
  useLayoutEffect(() => {
    const submitted = submittedControl.current;
    submittedControl.current = null;
    if (!submitted?.disabled || !controlsRef.current) return;
    // Native disabled buttons can drop keyboard focus to the document. Keep
    // editing in this control group, without stealing focus moved elsewhere.
    if (document.activeElement !== submitted && document.activeElement !== document.body) return;
    const buttons = [...controlsRef.current.querySelectorAll<HTMLButtonElement>('button')];
    const index = buttons.indexOf(submitted);
    for (let offset = 1; offset < buttons.length; offset++) {
      const next = buttons[(index + offset) % buttons.length];
      if (next && !next.disabled) {
        next.focus({ preventScroll: true });
        break;
      }
    }
  }, [props.lesson.revision]);
  return { controlsRef, edit };
}

function SplitControls(props: LessonPageProps) {
  const { controlsRef, edit } = useEditGroup(props);
  const current = sceneState(props.lesson, props.sceneId);
  const events = sceneEvents(props.lesson, props.sceneId);
  const index = events.findIndex(event => event.id === current.selectedEventId);
  const selected = events[index];
  const pattern = current.patterns[current.activeLaneId];
  const disabled = !props.interactive || hasPlayback(props);
  const compatible = (other: MusicEvent | undefined): other is MusicEvent => !!selected && !!other
    && selected.kind === 'note' && other.kind === 'note' && eq(selected.duration, other.duration)
    && selected.pitch.step === other.pitch.step && selected.pitch.alter === other.pitch.alter
    && selected.pitch.octave === other.pitch.octave;
  const before = events[index - 1];
  const after = events[index + 1];
  const canSplit = !!selected && !eq(selected.duration, frac(1, 16));
  const total = sum(events.map(event => event.duration));
  return <div className="lesson-edit" data-book-instrument="true">
    <p>{selected ? `${index + 1}번째 ${durationLabel(selected.duration, selected.kind)} 선택` : '왼쪽 목록에서 음표를 선택하세요.'}</p>
    <div className="lesson-edit-buttons" ref={controlsRef}>
      <button type="button" className="book-text-button" data-testid="split-note" data-print-disabled={!canSplit} disabled={disabled || !canSplit}
        onClick={() => edit({ type: 'split' })}>둘로 나누기</button>
      <button type="button" className="book-text-button" data-print-disabled={!compatible(before)} disabled={disabled || !compatible(before)}
        onClick={() => selected && before && edit({ type: 'merge', ids: [before.id, selected.id] })}>앞 음표와 합치기</button>
      <button type="button" className="book-text-button" data-print-disabled={!compatible(after)} disabled={disabled || !compatible(after)}
        onClick={() => selected && after && edit({ type: 'merge', ids: [selected.id, after.id] })}>뒤 음표와 합치기</button>
      <button type="button" className="book-text-button" data-print-disabled={!pattern?.past.length} disabled={disabled || !pattern?.past.length}
        onClick={() => edit({ type: 'undo' })}>되돌리기</button>
      <button type="button" className="book-text-button" data-print-disabled={!pattern?.future.length} disabled={disabled || !pattern?.future.length}
        onClick={() => edit({ type: 'redo' })}>다시 하기</button>
    </div>
    <p className="lesson-edit-summary">음표 {events.length}개 · 전체 {total.n}/{total.d}</p>
    <p className="lesson-edit-summary">같은 길이와 음높이의 이웃 음표만 합칠 수 있어요.</p>
    {!canSplit && selected && <p>16분음표까지 나눌 수 있어요. 다른 음표를 골라 보세요.</p>}
  </div>;
}

function CombinationControls(props: LessonPageProps) {
  const { controlsRef, edit } = useEditGroup(props);
  const current = sceneState(props.lesson, props.sceneId);
  const pattern = current.patterns[current.activeLaneId];
  const disabled = !lessonEditsAllowed(props.interactive, props.playback?.state);
  return <div className="lesson-edit" data-book-instrument="true">
    <div className="lesson-lane-choices" role="group" aria-label="조합 과제 선택">
      {getScene(props.sceneId).lanes.map(lane => <button key={lane.laneId} type="button" className="book-text-button"
        aria-pressed={current.activeLaneId === lane.laneId} disabled={disabled} data-print-disabled="false"
        onClick={() => props.onCommand({ type: 'selectLane', laneId: lane.laneId })}>과제 {lane.laneId}</button>)}
    </div>
    <p className="lesson-edit-summary">A는 4분음표만 · B는 8분음표만 · C는 서로 다른 길이 2종 이상</p>
    <div className="lesson-edit-buttons" ref={controlsRef}>
      {durationChoices.filter(choice => [4, 8, 16].includes(choice.duration.d)).map(choice => <button
        key={choice.type} type="button" className="book-text-button" data-testid={`add-${choice.type}`}
        disabled={disabled} data-print-disabled="false" onClick={() => edit({ type: 'add', kind: 'note', duration: choice.duration })}>
        {choice.name} 추가
      </button>)}
      <button type="button" className="book-text-button" disabled={disabled || !current.selectedEventId}
        data-print-disabled={!current.selectedEventId} onClick={() => edit({ type: 'remove' })}>선택 지우기</button>
      <button type="button" className="book-text-button" disabled={disabled || !pattern?.past.length}
        data-print-disabled={!pattern?.past.length} onClick={() => edit({ type: 'undo' })}>되돌리기</button>
      <button type="button" className="book-text-button" disabled={disabled || !pattern?.future.length}
        data-print-disabled={!pattern?.future.length} onClick={() => edit({ type: 'redo' })}>다시 하기</button>
    </div>
    <dl className="lesson-assessments">
      {getScene(props.sceneId).lanes.map(lane => {
        const assessment = currentAssessment(props.lesson, props.sceneId, lane.laneId);
        return <div key={lane.laneId} data-assessment-lane={lane.laneId} data-assessment-code={assessment.code}>
          <dt>과제 {lane.laneId} · 현재 {assessment.total.n}/{assessment.total.d} / 목표 1/2</dt>
          <dd>{assessment.message}</dd>
        </div>;
      })}
    </dl>
    <p className="lesson-edit-summary" data-scene-complete={isSceneComplete(props.lesson, props.sceneId)}>
      {isSceneComplete(props.lesson, props.sceneId) ? '세 과제의 현재 조건을 모두 만족했어요.' : '각 과제의 길이와 종류 조건을 확인해 보세요.'}
    </p>
  </div>;
}

const experimentTitles: Readonly<Record<SceneId, string>> = {
  'scene-1': '끝나는 순간을 비교해요', 'scene-2': '한 음표를 둘로', 'scene-3': '절반을 다르게 채워요',
  'scene-4': '소리 없는 시간도 이어져요', 'scene-5': '같은 음가, 다른 속도', 'scene-6': '한 마디를 만들어요',
};

function RestControls(props: LessonPageProps) {
  const { controlsRef, edit } = useEditGroup(props);
  const current = sceneState(props.lesson, props.sceneId);
  const events = sceneEvents(props.lesson, props.sceneId);
  const selected = events.find(event => event.id === current.selectedEventId);
  const pattern = current.patterns[current.activeLaneId];
  const disabled = !lessonEditsAllowed(props.interactive, props.playback?.state);
  const assessment = currentAssessment(props.lesson, props.sceneId);
  return <div className="lesson-edit" data-book-instrument="true">
    <p>{selected ? `${durationLabel(selected.duration, selected.kind)} 선택 · 길이 ${selected.duration.n}/${selected.duration.d}` : '왼쪽 목록에서 음표나 쉼표를 선택하세요.'}</p>
    <div className="lesson-edit-buttons" ref={controlsRef}>
      <button type="button" className="book-text-button" disabled={disabled || !selected} data-print-disabled={!selected}
        onClick={() => edit({ type: 'toggle' })}>{selected?.kind === 'rest' ? '같은 길이 음표로 바꾸기' : '같은 길이 쉼표로 바꾸기'}</button>
      <button type="button" className="book-text-button" disabled={disabled || !pattern?.past.length} data-print-disabled={!pattern?.past.length}
        onClick={() => edit({ type: 'undo' })}>되돌리기</button>
      <button type="button" className="book-text-button" disabled={disabled || !pattern?.future.length} data-print-disabled={!pattern?.future.length}
        onClick={() => edit({ type: 'redo' })}>다시 하기</button>
    </div>
    <p className="lesson-edit-summary" data-assessment-lane="main" data-assessment-code={assessment.code}>
      전체 {assessment.total.n}/{assessment.total.d} · 쉼표 {events.filter(event => event.kind === 'rest').length}개. {assessment.message}
    </p>
    <p className="lesson-edit-summary" data-scene-complete={isSceneComplete(props.lesson, props.sceneId)}>
      쉼표는 점선 빈칸으로 나타나요. 소리 없는 구간에도 시간과 다음 음표의 시작 위치는 유지돼요.
    </p>
  </div>;
}

function TempoControls(props: LessonPageProps) {
  const current = sceneState(props.lesson, props.sceneId);
  const disabled = !lessonEditsAllowed(props.interactive, props.playback?.state);
  // The domain accepts only these two presets in this scene.
  const timing = lessonTempoTiming(current.tempo === 120 ? 120 : 60);
  return <div className="lesson-edit" data-book-instrument="true">
    <div className="lesson-lane-choices" role="group" aria-label="템포 비교">
      {([60, 120] as const).map(bpm => <button key={bpm} type="button" className="book-text-button"
        aria-pressed={current.tempo === bpm} disabled={disabled} data-print-disabled="false"
        onClick={() => props.onCommand({ type: 'setTempo', bpm })}>템포 {bpm}</button>)}
    </div>
    <p className="lesson-edit-summary">정지 후 템포를 바꿔요. 음표 종류와 블록의 상대 길이는 그대로예요.</p>
    <div className="lesson-seconds-axis" aria-label={`한 마디 ${timing.barSeconds}초 눈금`} data-tempo={current.tempo}>
      {timing.ticks.map((tick, index) => <span key={index}>{tick}초</span>)}
    </div>
    <p className="lesson-edit-summary" data-testid="tempo-timing">
      템포 {current.tempo} · 한 마디(온음표) {timing.barSeconds}초 · 4분음표 {timing.quarterSeconds}초 · 비율 4:1
    </p>
    <p className="lesson-edit-summary" data-scene-complete={isSceneComplete(props.lesson, props.sceneId)}>
      60에서는 4초와 1초, 120에서는 2초와 0.5초예요. 왼쪽 질문에서 실제 시간과 비율을 구별해 보세요.
    </p>
  </div>;
}

function CompositionControls(props: LessonPageProps) {
  const { controlsRef, edit } = useEditGroup(props);
  const [kind, setKind] = useState<'note' | 'rest'>('note');
  const current = sceneState(props.lesson, props.sceneId);
  const selected = sceneEvents(props.lesson, props.sceneId).find(event => event.id === current.selectedEventId);
  const pattern = current.patterns[current.activeLaneId];
  const assessment = currentAssessment(props.lesson, props.sceneId);
  const disabled = !lessonEditsAllowed(props.interactive, props.playback?.state);
  const complete = isSceneComplete(props.lesson, props.sceneId);
  return <div className="lesson-edit" data-book-instrument="true">
    <div className="lesson-lane-choices" role="group" aria-label="추가할 종류">
      <button type="button" className="book-text-button" aria-pressed={kind === 'note'} disabled={disabled}
        data-print-disabled="false" onClick={() => setKind('note')}>음표</button>
      <button type="button" className="book-text-button" aria-pressed={kind === 'rest'} disabled={disabled}
        data-print-disabled="false" onClick={() => setKind('rest')}>쉼표</button>
    </div>
    <div className="lesson-edit-buttons" ref={controlsRef}>
      {durationChoices.map(choice => <button key={choice.type} type="button" className="book-text-button"
        data-testid={`compose-${kind}-${choice.type}`} data-print-disabled="false" disabled={disabled}
        onClick={() => edit({ type: 'add', kind, duration: choice.duration })}>{kind === 'rest' ? choice.restName : choice.name} 추가</button>)}
      <button type="button" className="book-text-button" disabled={disabled || !selected} data-print-disabled={!selected}
        onClick={() => edit({ type: 'toggle' })}>{selected?.kind === 'rest' ? '같은 길이 음표로 바꾸기' : '같은 길이 쉼표로 바꾸기'}</button>
      <button type="button" className="book-text-button" disabled={disabled || !selected} data-print-disabled={!selected}
        onClick={() => edit({ type: 'remove' })}>선택 지우기</button>
      <button type="button" className="book-text-button" disabled={disabled || !pattern?.past.length} data-print-disabled={!pattern?.past.length}
        onClick={() => edit({ type: 'undo' })}>되돌리기</button>
      <button type="button" className="book-text-button" disabled={disabled || !pattern?.future.length} data-print-disabled={!pattern?.future.length}
        onClick={() => edit({ type: 'redo' })}>다시 하기</button>
    </div>
    <ul className="lesson-composition-conditions" aria-label="한 마디 현재 조건">
      <li>합 {assessment.total.n}/{assessment.total.d} / 목표 1: {eq(assessment.total, frac(1, 1)) ? '충족' : '아직'}</li>
      <li>서로 다른 길이 {assessment.durationKinds}종 / 2종 이상: {assessment.durationKinds >= 2 ? '충족' : '아직'}</li>
      <li>쉼표 {assessment.rests}개 / 1개 이상: {assessment.rests >= 1 ? '충족' : '아직'}</li>
    </ul>
    <p className="lesson-edit-summary" data-assessment-lane="main" data-assessment-code={assessment.code}>{assessment.message}</p>
    <p className="lesson-edit-summary">같은 길이의 음표와 쉼표는 음가 한 종류로 세요. 만든 리듬은 책에 남고, 지우거나 되돌리면 현재 조건을 다시 확인해요.</p>
    <label className="lesson-explanation-check">
      <input type="checkbox" checked={current.explanationSelfCheck} disabled={disabled} data-print-disabled="false"
        onChange={event => props.onCommand({ type: 'explain', checked: event.currentTarget.checked })} />
      <span>길이와 쉼표의 시간을 설명했어요 (자기 확인)</span>
    </label>
    <p className="lesson-edit-summary">설명은 종이나 말로 해 보세요. 자유 문장을 자동 채점하지 않아요.</p>
    <p className="lesson-edit-summary" role="status" data-scene-complete={complete}>
      {complete ? '나의 한 마디 완성! 현재 세 조건과 설명 자기 확인을 만족했어요.' : assessment.success ? '음악 조건을 만족했어요. 이유를 설명하고 자기 확인해 보세요.' : '현재 리듬의 세 조건을 확인해 보세요. 빈 초안은 아직 정답이 아니에요.'}
    </p>
  </div>;
}

export function LessonRightPage(props: LessonPageProps) {
  const scene = getScene(props.sceneId);
  return <div className="lesson-page-content lesson-page-content--experiment" data-lesson-revision={props.lesson.revision}>
    <p className="book-running-title">들어 보고 · 나누어 보고</p>
    <div className="lesson-page-tools">
      <button type="button" className="lesson-reading-button" data-testid="reading-mode" data-print-disabled="false" disabled={!props.interactive}
        aria-label={props.mode === '3d' ? '크게 읽기, 2D 책으로 전환' : '3D 책으로 돌아가기'} onClick={props.onMode}>
        <span>{props.mode === '3d' ? '크게' : '3D로'}</span>{' '}<span>{props.mode === '3d' ? '읽기' : '보기'}</span>
      </button>
      <Transport {...props} />
    </div>
    <div className="lesson-listen-buttons">
      {scene.lanes.map(lane => <button key={lane.laneId} type="button" className="book-text-button"
        data-testid={`play-${lane.laneId}`} data-print-disabled={!sceneEvents(props.lesson, props.sceneId, lane.laneId).length}
        disabled={!props.interactive || !sceneEvents(props.lesson, props.sceneId, lane.laneId).length || props.playback?.state === 'paused' || hasPlayback(props) && props.playingLane === lane.laneId}
        onClick={() => props.onPlay(lane.laneId)}>
        {props.sceneId === 'scene-1' ? lane.laneId === 'upper' ? '위 줄 듣기' : '아래 줄 듣기' : props.sceneId === 'scene-3' ? `과제 ${lane.laneId} 듣기` : '내 리듬 듣기'}
      </button>)}
    </div>
    <p className="lesson-transport-help">일시정지 후 이어 들을 수 있어요. 음표 선택·수정은 정지 후 해 주세요.</p>
    <h2>{experimentTitles[props.sceneId]}</h2>
    <p className="lesson-axis-caption">가로 길이는 소리의 시간이에요.</p>
    {props.sceneId === 'scene-3' && <p className="lesson-axis-caption">가운데 가이드가 목표 1/2예요. 빈 과제는 아직 재생할 수 없어요.</p>}
    {props.mode === '2d' ? <div className="lesson-fallback-lanes">
      {scene.lanes.map(lane => <section key={lane.laneId} aria-label={lane.label}>
        <p>{lane.label}</p><ProportionalLane {...props} laneId={lane.laneId} />
      </section>)}
    </div> : <div className="book-popup-window" aria-label="종이에서 올라오는 음가 블록" />}
    {props.sceneId === 'scene-2' && <SplitControls {...props} />}
    {props.sceneId === 'scene-3' && <CombinationControls {...props} />}
    {props.sceneId === 'scene-4' && <RestControls {...props} />}
    {props.sceneId === 'scene-5' && <TempoControls {...props} />}
    {props.sceneId === 'scene-6' && <CompositionControls {...props} />}
    {props.playback?.error && <p role="status" className="lesson-feedback">{props.playback.error.message} 소리 없는 설명으로도 계속할 수 있어요.</p>}
    {props.lesson.feedback && <p role="status" className="lesson-feedback">{props.lesson.feedback}</p>}
    <details className="lesson-flap" open={props.hints?.[`${props.sceneId}/alternative`] === 1}
      onToggle={event => props.onHint?.(`${props.sceneId}/alternative`, event.currentTarget.open)}>
      <summary>소리 없이 살펴보기</summary>
      <p>{scene.alternative}</p>
      {props.sceneId === 'scene-1' && <button type="button" className="book-text-button" data-print-disabled="false" disabled={!props.interactive || hasPlayback(props)}
        onClick={() => { props.onCommand({ type: 'observeLane', laneId: 'upper', mode: 'text' }); props.onCommand({ type: 'observeLane', laneId: 'lower', mode: 'text' }); }}>두 줄 설명을 확인했어요</button>}
    </details>
    {props.progressTools}
    <small className="lesson-page-number">{lessonPageNumber(props.sceneId, 'right')}</small>
  </div>;
}
