import { useId, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { BookNotation } from './BookNotation.tsx';
import type { BookNotationArtifact } from './BookNotation.tsx';
import type { PlaybackSnapshot } from '../audio/AudioEngine.ts';
import { durationLabel, getScene } from '../content/lesson.ts';
import type { MusicEvent } from '../content/types.ts';
import { eq, frac, sum } from '../domain/index.ts';
import { sceneEvents, sceneState } from '../lesson/controller.ts';
import type { LessonCommand, LessonState } from '../lesson/controller.ts';
import '../styles/lesson-pages.css';

export type LessonPageProps = {
  lesson: LessonState;
  sceneId: 'scene-1' | 'scene-2';
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
    <p className="lesson-meter">4/4 · 4분음표 = 90 · C4</p>
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
        {props.sceneId === 'scene-2' && <EventList {...props} events={events} laneId={lane.laneId} />}
      </section>;
    })}
    <Questions {...props} />
    <small className="lesson-page-number">{props.sceneId === 'scene-1' ? '1' : '3'}</small>
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
        data-selected={current.activeLaneId === props.laneId && current.selectedEventId === event.id}
        data-active={event.id === activeId}
        style={{ left: `${event.onset.n / event.onset.d * 100}%`, width: `${event.duration.n / event.duration.d * 100}%` }}>
        <span>{index + 1}</span>
      </div>)}
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

function SplitControls(props: LessonPageProps) {
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
        data-testid={`play-${lane.laneId}`} data-print-disabled="false" disabled={!props.interactive || props.playback?.state === 'paused' || hasPlayback(props) && props.playingLane === lane.laneId}
        onClick={() => props.onPlay(lane.laneId)}>
        {props.sceneId === 'scene-1' ? lane.laneId === 'upper' ? '위 줄 듣기' : '아래 줄 듣기' : '내 리듬 듣기'}
      </button>)}
    </div>
    <p className="lesson-transport-help">일시정지 후 이어 들을 수 있어요. 음표 선택·수정은 정지 후 해 주세요.</p>
    <h2>{props.sceneId === 'scene-1' ? '끝나는 순간을 비교해요' : '한 음표를 둘로'}</h2>
    <p className="lesson-axis-caption">가로 길이는 소리의 시간이에요.</p>
    {props.mode === '2d' ? <div className="lesson-fallback-lanes">
      {scene.lanes.map(lane => <section key={lane.laneId} aria-label={lane.label}>
        <p>{lane.label}</p><ProportionalLane {...props} laneId={lane.laneId} />
      </section>)}
    </div> : <div className="book-popup-window" aria-label="종이에서 올라오는 음가 블록" />}
    {props.sceneId === 'scene-2' && <SplitControls {...props} />}
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
    <small className="lesson-page-number">{props.sceneId === 'scene-1' ? '2' : '4'}</small>
  </div>;
}
