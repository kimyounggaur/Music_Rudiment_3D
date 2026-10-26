import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { frac, seconds, sum } from './domain/index.ts';
import { lessonContent, durationChoices, durationLabel } from './content/lesson.ts';
import type { SceneId } from './content/types.ts';
import { createLessonState, reduceLesson, sceneState, sceneEvents, currentAssessment, isSceneComplete, tryRestoreLessonState, serializeLearning } from './lesson/controller.ts';
import type { LessonCommand as Command, LessonState } from './lesson/controller.ts';
import { AudioEngine } from './audio/AudioEngine.ts';
import { createProgress, loadProgress, saveProgress, parseImport, commitImport, exportProgress, deleteProgress } from './persistence/progress.ts';
import type { ImportPreview } from './persistence/progress.ts';
import { NotationView } from './notation/NotationView.tsx';
import { DurationScene2D } from './scenes/DurationScene2D.tsx';
import { ConceptQuiz } from './components/ConceptQuiz.tsx';
import { SceneBoundary } from './components/SceneBoundary.tsx';

const DurationScene3D = lazy(() => import('./scenes/DurationScene3D.tsx'));
const fractionText = (f: {n:number;d:number}) => f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;
const storage = () => { try { return window.localStorage; } catch { return null; } };
function trapDialogFocus(event:ReactKeyboardEvent<HTMLDialogElement>) {
  if(event.key!=='Tab') return;
  const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([hidden]):not([type=file]),select,summary,a[href],[tabindex]:not([tabindex="-1"])')).filter(element=>element.getClientRects().length>0);
  if(!items.length) {event.preventDefault();event.currentTarget.focus();return;}
  const first=items[0],last=items[items.length-1];
  if(event.shiftKey&&(document.activeElement===first||!event.currentTarget.contains(document.activeElement))) {event.preventDefault();last.focus();}
  if(!event.shiftKey&&(document.activeElement===last||!event.currentTarget.contains(document.activeElement))) {event.preventDefault();first.focus();}
}
const defaults = () => ({ mode: '2d' as '2d'|'3d', reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches, muted:false, volume:0.3, currentSceneId:'scene-1' });
function initialSession() {
  const fresh=(message='',saveBlocked=false)=>({state:createLessonState(),preferences:defaults(),message,saveBlocked,attempts:{} as Record<string,number>,hints:{} as Record<string,number>});
  const saved = storage();
  if (!saved) return fresh('저장소를 사용할 수 없습니다. 학습과 JSON 원문 보기는 계속할 수 있어요.');
  const result = loadProgress(saved);
  if (!result.ok) return fresh(`${result.error.message} 기존 저장 원문을 보존합니다. 임시 학습은 계속할 수 있고 설정에서 새 학습자 시작이나 JSON 가져오기를 선택할 수 있어요.`,true);
  if (!result.value) return fresh();
  const restored=tryRestoreLessonState(result.value);
  if(!restored.ok) return fresh(`저장 내용을 복구하지 못했습니다. ${restored.message} 기존 저장 원문을 보존하며 임시 학습으로 계속합니다.`,true);
  return { state:restored.state, preferences:{...defaults(),...result.value.preferences}, attempts:result.value.attempts,hints:result.value.hints,saveBlocked:false,message:'이 기기에 저장된 이전 학습을 복구했습니다. 소리는 자동 재생하지 않습니다.' };
}

export default function App() {
  const initial = useMemo(initialSession, []);
  const [state, dispatch] = useReducer((value:LessonState,action:Command)=>reduceLesson(value,action), initial.state);
  const [preferences, setPreferences] = useState(initial.preferences);
  const [notice, setNotice] = useState(initial.message);
  const [attempts,setAttempts]=useState(initial.attempts);
  const [hints,setHints]=useState(initial.hints);
  const [exportText,setExportText]=useState('');
  const [saveBlocked,setSaveBlocked]=useState(initial.saveBlocked);
  const [learnerEpoch,setLearnerEpoch]=useState(0);
  const exportRef=useRef<HTMLTextAreaElement>(null);
  const [teacher, setTeacher] = useState(false);
  const [answersVisible, setAnswersVisible] = useState(false);
  const [projector, setProjector] = useState(false);
  const [loop, setLoop] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [portraitHint, setPortraitHint] = useState(true);
  const [preview, setPreview] = useState<ImportPreview|null>(null);
  const [confirm, setConfirm] = useState<'reset'|'delete'|'print'|null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const settingsRef = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const sceneTitle = useRef<HTMLHeadingElement>(null);
  const request = useRef(0);
  const listenTarget = useRef<{sessionId:number;sceneId:SceneId;laneId:string}|null>(null);
  const engine = useMemo(() => new AudioEngine(), []);
  const [playback, setPlayback] = useState(engine.getPlaybackSnapshot());
  const scene = lessonContent.scenes.find(s => s.sceneId === state.currentSceneId)!;
  const current = sceneState(state, scene.sceneId);
  const tempo = { bpm: current.tempo, unit: frac(1,4) };
  const events = sceneEvents(state);
  const total = sum(events.map(e => e.duration));
  const assessment = currentAssessment(state);
  const selected = events.find(e => e.id === current.selectedEventId);
  const busy = playback.state === 'starting' || playback.state === 'playing';
  const sceneIndex = lessonContent.scenes.findIndex(s => s.sceneId === scene.sceneId);
  const completed = isSceneComplete(state, scene.sceneId);
  const mode = preferences.mode;
  const [mergeFirst, setMergeFirst] = useState<string|null>(null);

  const stop = useCallback((reason='user') => { request.current++; listenTarget.current=null; engine.stop(reason); setPlayback(engine.getPlaybackSnapshot()); },[engine]);
  function command(cmd:Command) { if (busy && !['select','answer','explain','observeLane'].includes(cmd.type)) { setNotice('재생을 정지한 뒤 수정하세요.'); return; } if(cmd.type==='answer'){const id=state.currentSceneId+'/'+cmd.questionId;setAttempts(old=>({...old,[id]:(old[id]||0)+1}));} dispatch(cmd); }
  function navigate(id:SceneId) { stop('scene'); dispatch({type:'navigate',sceneId:id}); setTextOpen(false); setMergeFirst(null); }
  function changeMode(value:'2d'|'3d') { stop('mode'); setPreferences(p=>({...p,mode:value})); setNotice(value==='2d'?'2D 모드입니다. 리듬과 학습 진행은 유지됩니다.':'같은 리듬을 입체 블록으로 표시합니다.'); }
  function fail3D(reason:string) { stop('webgl-failure'); setPreferences(p=>({...p,mode:'2d'})); setNotice(`3D를 사용할 수 없어 2D로 전환했습니다. ${reason}`); }
  function observeText() { setTextOpen(true); const id=state.currentSceneId+'/text';setHints(old=>({...old,[id]:(old[id]||0)+1})); dispatch({type:'observeLane',laneId:current.activeLaneId,mode:'text'}); }
  async function play() {
    const token=++request.current;
    try {
      await engine.unlockFromGesture();
      if(token!==request.current) return;
      const snapshot=await engine.play({events,tempo,logicalDuration:total},{loop});
      if(token!==request.current) { engine.stop('cancelled-request'); return; }
      listenTarget.current=!preferences.muted&&preferences.volume>0?{sessionId:snapshot.sessionId!,sceneId:scene.sceneId,laneId:current.activeLaneId}:null;
      setPlayback(snapshot);
      if(snapshot.error) setNotice(snapshot.error.message);
    } catch(error) { setNotice(`소리를 시작하지 못했습니다. 소리 없는 설명으로 계속할 수 있어요. ${error instanceof Error?error.message:''}`); }
  }
  function prepareExport(download:boolean) {
    const value=createProgress({...serializeLearning(state),attempts,hints,preferences:{...preferences,currentSceneId:state.currentSceneId}});
    const result=exportProgress(value);
    if(!result.ok) { setNotice(result.error.message); return; }
    setExportText(result.value); settingsRef.current?.showModal();
    if(!download) {setNotice('검증된 JSON 원문을 준비했습니다. 원문을 선택해 보관할 수 있습니다.');return;}
    const url=URL.createObjectURL(new Blob([result.value],{type:'application/json'}));
    const a=document.createElement('a'); a.href=url; a.download='duration-basics-progress.json'; document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),2500); setNotice('JSON 다운로드를 요청했습니다. 시작되지 않으면 JSON 원문을 선택해 보관하세요. 내보낸 파일은 앱 기록 삭제와 별개로 남습니다.');
  }
  const doExport=()=>prepareExport(true);
  async function importFile(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0]; event.target.value=''; if(!file) return;
    if(file.size>1024*1024) { setNotice('JSON은 1MiB 이하여야 합니다. 기존 기록은 유지됩니다.'); return; }
    const result=parseImport(await file.text());
    if(!result.ok) { setNotice(`가져오기 거부: ${result.error.message} 기존 기록은 유지됩니다.`); return; }
    stop('import-preview'); setPreview(result.value);
  }
  function confirmImport() {
    if(!preview) return;
    const restored=tryRestoreLessonState(preview.progress,state);
    if(!restored.ok) { setNotice(`가져오기 거부: ${restored.message} 기존 기록은 유지됩니다.`); setPreview(null); return; }
    const target=storage(); if(!target) { setNotice('저장소가 차단되어 가져오기를 적용하지 않았습니다.'); setPreview(null); return; }
    const result=commitImport(preview,target);
    if(!result.ok) { setNotice(result.error.message); setPreview(null); return; }
    dispatch({type:'restore',state:restored.state});
    setAttempts(result.value.attempts);setHints(result.value.hints);setExportText('');
    setPreferences(p=>({...p,...result.value.preferences})); setSaveBlocked(false);setLearnerEpoch(value=>value+1);setPreview(null); setNotice('확인한 학습 기록을 가져왔습니다. 소리는 재생하지 않습니다.');
  }
  function confirmedAction() {
    if(confirm==='reset') { stop('reset'); dispatch({type:'resetScene'}); setNotice('현재 장면을 처음 상태로 돌렸습니다.'); }
    if(confirm==='delete') {
      stop('new-learner'); const target=storage();
      if(!target) { setNotice('저장소에 접근할 수 없어 기존 기록과 백업 삭제를 확인하지 못했습니다. 현재 학습을 유지합니다.'); setConfirm(null); return; }
      const result=deleteProgress(target);
      if(result && !result.ok) { setNotice(result.error.message); setConfirm(null); return; }
      dispatch({type:'restore',state:createLessonState()}); setPreferences(defaults());setAttempts({});setHints({});setExportText('');setSaveBlocked(false);setLearnerEpoch(value=>value+1); setNotice('이 앱의 기록과 백업을 삭제했습니다. 새 학습자로 시작합니다.');
    }
    if(confirm==='print') { dialogRef.current?.close(); setConfirm(null); window.setTimeout(()=>window.print(),50); return; }
    setConfirm(null);
  }

  useEffect(()=>{ const tick=()=>{const next=engine.getPlaybackSnapshot();setPlayback(old=>old.state===next.state&&old.sessionId===next.sessionId&&old.currentPosition===next.currentPosition&&old.completedSessionId===next.completedSessionId&&old.error?.code===next.error?.code?old:next);}; const timer=window.setInterval(tick,32); const dispose=()=>{request.current++;engine.dispose();}; return()=>{clearInterval(timer);dispose();}; },[engine]);
  useEffect(()=>{ engine.setMuted(preferences.muted); engine.setChannelGain('master',preferences.volume); },[engine,preferences.muted,preferences.volume]);
  useEffect(()=>{if(preferences.muted||preferences.volume<=0)listenTarget.current=null;},[preferences.muted,preferences.volume]);
  useEffect(()=>{ engine.setLoop(loop); },[engine,loop]);
  useEffect(()=>{
    const target=listenTarget.current;
    if(target && playback.completedSessionId===target.sessionId) {
      if(state.currentSceneId===target.sceneId) dispatch({type:'observeLane',laneId:target.laneId,mode:'listened'});
      listenTarget.current=null;
    }
  },[playback.completedSessionId,state.currentSceneId]);
  useEffect(()=>{
    const hide=()=>{if(document.hidden) stop('hidden');}; const pagehide=()=>stop('pagehide');
    document.addEventListener('visibilitychange',hide); window.addEventListener('pagehide',pagehide);
    return()=>{document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',pagehide);};
  },[stop]);
  useEffect(()=>{ sceneTitle.current?.focus(); },[scene.sceneId]);
  useEffect(()=>{
    if(saveBlocked) return;
    const timer=window.setTimeout(()=>{
      const target=storage(); if(!target) return;
      const result=saveProgress(createProgress({...serializeLearning(state),attempts,hints,preferences:{...preferences,currentSceneId:state.currentSceneId}}),target);
      if(!result.ok) setNotice(`저장 실패: ${result.error.message} 학습은 계속할 수 있고 JSON으로 내보낼 수 있습니다.`);
    },250);
    return()=>clearTimeout(timer);
  },[state,preferences,attempts,hints,saveBlocked]);
  useEffect(()=>{ if(confirm||preview) dialogRef.current?.showModal(); else dialogRef.current?.close(); },[confirm,preview]);
  useEffect(()=>{ if(!teacher) setAnswersVisible(false); },[teacher]);

  const editScene=['scene-2','scene-3','scene-4','scene-6'].includes(scene.sceneId);
  const addScene=scene.sceneId==='scene-3'||scene.sceneId==='scene-6';
  const canSplit=scene.sceneId==='scene-2'&&selected&&selected.duration.d<16;
  const choices=durationChoices.filter(x=>scene.sceneId!=='scene-3'||x.duration.d>=4);

  return <div className={projector?'app projector':'app'}>
    <a className="skip-link" href="#question">질문으로 바로 가기</a>
    <header className="header">
      <a className="brand" href="#question"><span className="brand-mark" aria-hidden="true">◫</span><span>음가 블록 <strong>실험실</strong></span></a>
      <span className="chapter">온음표부터 16분음표까지</span>
      <div className="header-actions"><button onClick={()=>setTeacher(v=>!v)} aria-pressed={teacher}>교사 보기</button><button onClick={()=>settingsRef.current?.showModal()}>설정·기록</button></div>
    </header>
    <nav className="steps" aria-label="학습 장면">
      {lessonContent.scenes.map((s,index)=><button key={s.sceneId} aria-current={s.sceneId===scene.sceneId?'step':undefined} onClick={()=>navigate(s.sceneId)}><span>{index+1}</span><span className="step-title">{s.title}</span>{isSceneComplete(state,s.sceneId)&&<span aria-label="완료"> ✓</span>}</button>)}
    </nav>
    {portraitHint&&<aside className="portrait-hint"><span>가로로 보면 실험과 악보를 함께 보기 좋아요. 세로로도 끝까지 학습할 수 있어요.</span><button aria-label="가로 권장 안내 닫기" onClick={()=>setPortraitHint(false)}>닫기</button></aside>}
    <div className="lesson-grid">
      <aside className="question-panel" id="question">
        <p className="eyebrow">음가 실험 · {sceneIndex+1} / 6</p>
        <h1 tabIndex={-1} ref={sceneTitle}>{scene.title}</h1>
        <p className="lead">{scene.question}</p><p>{scene.instructions}</p>
        <label className="level-label">도움 수준 <select value={state.supportLevel} onChange={e=>command({type:'setSupport',level:Number(e.target.value) as 1|2|3})}><option value="1">1 · 관찰</option><option value="2">2 · 따라 하기</option><option value="3">3 · 독립 적용</option></select></label>
        {state.supportLevel<3&&<details open={state.supportLevel===1}><summary>힌트와 학습 목표</summary><p>{scene.goal}</p><p>{scene.completion}</p></details>}
        <p className="axis-note">가로 길이 = 시간<br/>높이·깊이는 음높이·음량을 뜻하지 않아요.</p>
        <button className="text-alternative" onClick={observeText}>소리 없이 설명 확인</button>
        {textOpen&&<div className="alternative"><strong>텍스트 대체 설명</strong><p>{scene.alternative}</p><small>개념 확인으로 기록하며 청취 완료와 구분합니다.</small></div>}
        {teacher&&<section className="teacher-panel" aria-label="교사 안내"><h2>교사 안내</h2><p><strong>시연</strong> {scene.teacherGuide.demonstration}</p><p><strong>오개념</strong> {scene.teacherGuide.misconception}</p><button onClick={()=>setAnswersVisible(v=>!v)} aria-expanded={answersVisible}>{answersVisible?'정답 숨기기':'정답 공개하기'}</button>{answersVisible&&<p className="teacher-answer">정답 공개 중: {scene.teacherGuide.answer}</p>}<details><summary>수준 4·5 확장 활동</summary><p>4: {scene.teacherGuide.extension4}</p><p>5: {scene.teacherGuide.extension5}</p><p>앱 편집기는 한 마디 범위입니다.</p></details><button onClick={()=>setProjector(v=>!v)} aria-pressed={projector}>프로젝터 보기</button><button onClick={()=>setConfirm('print')}>활동지 인쇄</button><small>교사 보기는 로컬 표시 기능이며 인증·시험 보안 기능이 아닙니다.</small></section>}
      </aside>
      <main className="workspace">
        <section className="experiment" aria-label="음가 실험">
          <div className="section-bar"><div><p className="eyebrow">TIME BLOCKS</p><h2>시간을 나누어 보세요</h2></div><div className="mode-switch" role="group" aria-label="표시 방식"><button aria-pressed={mode==='2d'} onClick={()=>changeMode('2d')}>2D</button><button aria-pressed={mode==='3d'} onClick={()=>changeMode('3d')}>3D</button></div></div>
          {scene.lanes.length>1&&<div className="lane-tabs" role="group" aria-label="실험 레인">{scene.lanes.map(l=><button key={l.laneId} aria-pressed={l.laneId===current.activeLaneId} onClick={()=>{stop('lane');dispatch({type:'selectLane',laneId:l.laneId});setMergeFirst(null);}}>{l.label}</button>)}</div>}
          <div className="measure-caption"><span>4/4 · 온음표 기준</span><strong>총 길이 {fractionText(total)} / {fractionText(scene.task.target)}</strong><span>C4 · 같은 음량 설정</span></div>
          {mode==='3d'?<SceneBoundary onFailure={fail3D} fallback={<DurationScene2D events={events} selectedId={current.selectedEventId} onSelect={id=>command({type:'select',id})}/>}><Suspense fallback={<p>3D를 준비하는 동안 2D 버튼으로 계속 조작할 수 있어요.</p>}><DurationScene3D events={events} selectedId={current.selectedEventId} activeId={playback.activeEventId} position={playback.relativePosition} onSelect={id=>command({type:'select',id})} reducedMotion={preferences.reducedMotion} onFailure={fail3D}/></Suspense></SceneBoundary>:null}
          {mode==='2d'&&<DurationScene2D events={events} selectedId={current.selectedEventId} activeId={playback.activeEventId} position={playback.relativePosition} onSelect={id=>command({type:'select',id})} reducedMotion={preferences.reducedMotion}/>}
          <p className="selection-summary">선택: {selected?`${durationLabel(selected.duration,selected.kind)} · 온음표의 ${fractionText(selected.duration)} · 시작 ${fractionText(selected.onset)}`:'블록 또는 아래 순서 목록에서 선택하세요.'}</p>
          {editScene&&<div className="edit-controls" role="group" aria-label="블록 조작">
            {scene.sceneId==='scene-2'&&<><button className="primary" disabled={busy||!canSplit} onClick={()=>command({type:'split'})}>둘로 나누기</button><button disabled={busy||!selected} onClick={()=>{if(!selected)return;if(mergeFirst){command({type:'merge',ids:[mergeFirst,selected.id]});setMergeFirst(null);}else setMergeFirst(selected.id);}}>{mergeFirst?'선택한 두 블록 합치기':'합칠 첫 블록 정하기'}</button>{selected?.duration.d===16&&<small>16분음표가 가장 작은 단위입니다.</small>}{mergeFirst&&<small>이웃한 같은 길이 블록을 선택한 뒤 합치세요.</small>}</>}
            {(scene.sceneId==='scene-4'||scene.sceneId==='scene-6')&&<button disabled={busy||!selected} onClick={()=>command({type:'toggle'})}>음표 ↔ 쉼표</button>}
            {addScene&&<button disabled={busy||!selected} onClick={()=>command({type:'remove'})}>선택 삭제</button>}
            <button disabled={busy||current.patterns[current.activeLaneId].past.length===0} onClick={()=>command({type:'undo'})}>되돌리기</button><button disabled={busy||current.patterns[current.activeLaneId].future.length===0} onClick={()=>command({type:'redo'})}>다시 하기</button>
            <button disabled={busy} onClick={()=>setConfirm('reset')}>장면 초기화</button>
          </div>}
          {addScene&&<div className="palette" aria-label="음가 카드">{choices.map(choice=><div className="palette-pair" key={choice.type}><button disabled={busy} onClick={()=>command({type:'add',duration:choice.duration,kind:'note'})}>{choice.name}<small>{fractionText(choice.duration)}</small></button>{scene.sceneId==='scene-6'&&<button className="rest-card" disabled={busy} onClick={()=>command({type:'add',duration:choice.duration,kind:'rest'})}>{choice.restName}<small>{fractionText(choice.duration)} · 무음</small></button>}</div>)}</div>}
          {scene.sceneId==='scene-5'&&<div className="tempo-comparison"><div><strong>4분음표 = 60</strong><span>온음표 4초 / 4분음표 1초</span></div><div><strong>4분음표 = 120</strong><span>온음표 2초 / 4분음표 0.5초</span></div><p>두 템포 모두 길이 비율은 <strong>4 : 1</strong></p><label>비교 템포 <select value={current.tempo} disabled={busy} onChange={e=>command({type:'setTempo',bpm:Number(e.target.value) as 60|120})}><option value="60">4분음표 = 60회/분</option><option value="120">4분음표 = 120회/분</option></select></label>{busy&&<small>정지한 뒤 템포를 바꿀 수 있습니다.</small>}</div>}
          <div className={assessment.success?'feedback success':'feedback'} role="status">{state.feedback||assessment.message}</div>
        </section>
        <section className="notation-region" aria-label="정확한 2D 악보"><div className="section-bar"><h2>블록을 악보로 읽기</h2><span>높은음자리표 · C4</span></div><NotationView events={events} selectedId={current.selectedEventId} activeId={playback.activeEventId} onSelect={id=>command({type:'select',id})}/></section>
        <section className="questions" aria-label="개념 확인"><h2>관찰한 것을 확인해요</h2>{scene.questions.length===0&&<p>{scene.completion}</p>}{scene.questions.map(question=><fieldset key={question.id}><legend>{question.prompt}</legend>{question.options.map(option=><label className="answer-option" key={option.value}><input type="radio" name={question.id} value={option.value} checked={current.answers[question.id]===option.value} onChange={()=>command({type:'answer',questionId:question.id,value:option.value})}/>{option.label}</label>)}{current.answers[question.id]&&<p className="answer-feedback">{current.answers[question.id]===question.correctValue?`✓ ${question.explanation}`:'다시 비교해 보세요. 힌트나 텍스트 설명을 확인할 수 있어요.'}</p>}</fieldset>)}
          {scene.sceneId==='scene-6'&&<><p>“쉼표가 있어도 한 마디 길이를 어떻게 맞췄나요?” 말이나 글로 설명해 보세요. 자유 설명은 자동으로 채점하거나 저장하지 않습니다.</p><label className="answer-option"><input type="checkbox" checked={current.explanationSelfCheck} onChange={e=>command({type:'explain',checked:e.target.checked})}/>쉼표도 시간을 차지한다는 점과 길이의 합을 설명했어요.</label></>}
          <p className={completed?'completion complete':'completion'}>{completed?'✓ 이 장면의 현재 완료 조건을 만족했습니다.':`완료 조건: ${scene.completion}`}</p>
        </section>
      </main>
    </div>
    {scene.sceneId==='scene-6'&&completed&&<section className="course-summary"><h2>나의 한 마디를 완성했어요</h2><p>음가의 비율, 같은 길이의 다른 조합, 쉼표의 시간, 템포와 실제 시간, 길이와 음높이·음량의 차이를 확인했습니다.</p><p>완료는 이 활동의 응답 기록이며 청음 능력이나 교육 효과의 인증이 아닙니다. 만든 리듬을 재생하고 다른 조합도 만들어 보세요.</p><button onClick={doExport}>만든 리듬과 진행 내보내기</button></section>}
    <footer className="transport" aria-label="재생과 장면 이동">
      <button className="play primary" disabled={busy||events.length===0} onClick={()=>void play()}>▶ 소리 켜고 재생</button><button onClick={()=>stop()} className="stop">■ 정지</button><label className="loop"><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/>반복</label><span className="play-status" aria-live="off">{busy?`재생 중 · ${playback.currentPosition.toFixed(1)}초`:`${seconds(total,tempo).toFixed(2)}초 · 4분음표 = ${current.tempo}`}</span><div className="nav-actions"><button disabled={sceneIndex===0} onClick={()=>navigate(lessonContent.scenes[sceneIndex-1].sceneId)}>이전</button><button className="primary" disabled={!completed||sceneIndex===5} onClick={()=>navigate(lessonContent.scenes[sceneIndex+1].sceneId)}>다음 →</button></div>
    </footer>
    <section className="concept-quiz-region"><ConceptQuiz key={learnerEpoch} onRecord={id=>setAttempts(old=>({...old,[id]:(old[id]||0)+1}))}/></section>
    <div className="notices" role="status">{notice}</div>
    {saveBlocked&&<p className="privacy-note" role="status">기존 저장 원문을 보호하고 있어 현재 학습은 자동 저장하지 않습니다. JSON으로 내보내거나 설정에서 새 학습자를 시작할 수 있어요.</p>}
    <p className="privacy-note">이 기기의 브라우저에 저장됩니다. 공용 기기에서는 다음 사람에게 보일 수 있어요. 기기 변경이나 브라우저 데이터 삭제로 잃을 수 있습니다. prototype-synth 합성 학습음 · 원본 녹음 아님.</p>
    <dialog ref={settingsRef} onKeyDown={trapDialogFocus} aria-labelledby="settings-title"><div className="dialog-heading"><h2 id="settings-title">설정과 학습 기록</h2><button onClick={()=>settingsRef.current?.close()} aria-label="설정 닫기">닫기</button></div><label className="answer-option"><input type="checkbox" checked={preferences.reducedMotion} onChange={e=>setPreferences(p=>({...p,reducedMotion:e.target.checked}))}/>모션 줄이기</label><label className="answer-option"><input type="checkbox" checked={preferences.muted} onChange={e=>setPreferences(p=>({...p,muted:e.target.checked}))}/>음소거</label><label className="volume-label">학습음/마스터 음량<input type="range" min="0" max="0.6" step="0.02" value={preferences.volume} onChange={e=>setPreferences(p=>({...p,volume:Number(e.target.value)}))}/></label><p>내레이션·배경음악·효과음은 연결하지 않았습니다. 텍스트 설명으로 학습할 수 있습니다.</p><div className="settings-actions"><button onClick={()=>changeMode('2d')}>저사양 · 2D로 전환</button><button onClick={doExport}>JSON 내보내기</button><button onClick={()=>prepareExport(false)}>JSON 원문 보기</button><button onClick={()=>importRef.current?.click()}>JSON 가져오기</button><button onClick={()=>{settingsRef.current?.close();setConfirm('delete');}}>새 학습자 시작 · 전체 기록 삭제</button></div>{exportText&&<details open><summary>내보내기 JSON 원문</summary><textarea ref={exportRef} aria-label="내보내기 JSON 원문" readOnly value={exportText} rows={12} style={{width:"100%",fontFamily:"monospace"}}/><button onClick={()=>exportRef.current?.select()}>JSON 모두 선택</button></details>}<input ref={importRef} type="file" accept=".json,application/json" onChange={e=>void importFile(e)} hidden/><p>내보낸 JSON은 로컬 삭제와 별개로 남습니다. 이름·이메일·녹음·광고 추적은 수집하지 않습니다.</p></dialog>
    <dialog ref={dialogRef} onKeyDown={trapDialogFocus} onCancel={()=>{setConfirm(null);setPreview(null);}} aria-labelledby="confirm-title"><h2 id="confirm-title">{preview?'가져오기 미리보기':confirm==='delete'?'새 학습자로 시작할까요?':confirm==='print'?'활동지 인쇄':'현재 장면을 초기화할까요?'}</h2>{preview?<><p>단원: {preview.summary.lessonId} · 콘텐츠 {preview.summary.contentVersion}</p><p>패턴 {preview.summary.patternCount}개 · 저장 {preview.summary.savedAt}</p><p>확인하면 이 앱의 학습 기록을 교체합니다. 취소하면 기존 기록을 유지합니다.</p></>:<p>{confirm==='delete'?'이 앱의 학습 기록과 백업을 지웁니다. 다른 앱의 저장값이나 내보낸 파일은 삭제하지 않습니다.':confirm==='print'?'여섯 장면의 2D 악보·질문·활동지를 인쇄합니다. 교사 정답 공개 상태에 따라 정답 포함 여부가 달라집니다.': '현재 장면의 조작 이력과 응답을 처음 상태로 되돌립니다. 다른 장면은 유지합니다.'}</p>}<div className="dialog-actions"><button onClick={()=>{setConfirm(null);setPreview(null);}}>취소</button><button className="primary" onClick={preview?confirmImport:confirmedAction}>{preview?'확인 후 가져오기':confirm==='print'?'인쇄':'확인'}</button></div></dialog>
    <article className="print-sheet"><h1>음가 블록 실험실 · 활동지</h1><p>4/4 · 4분음표 한 박 · C4. 음가 분수는 온음표 기준입니다. 정답 {teacher&&answersVisible?'포함':'미포함'}.</p>{lessonContent.scenes.map(s=><section className="print-scene" key={s.sceneId}><h2>{s.title}</h2><p>{s.question}</p>{s.lanes.map(l=><div className="print-lane" key={l.laneId}><h3>{l.label}</h3><NotationView events={sceneEvents(state,s.sceneId,l.laneId)} onSelect={()=>{}}/></div>)}<p>{s.completion}</p>{teacher&&answersVisible&&<p>정답: {s.teacherGuide.answer}</p>}<p className="writing-lines">나의 설명: _______________________________________________<br/>다른 조합: _______________________________________________</p></section>)}</article>
  </div>;
}

