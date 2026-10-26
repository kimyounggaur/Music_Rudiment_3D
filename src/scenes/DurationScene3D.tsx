import { useEffect, useRef, useState } from 'react';
import type { WebGLRenderer } from 'three';
import DurationScene2D, { durationNames, eventLabel, type DurationSceneProps } from './DurationScene2D.tsx';
import { BAR_WIDTH, createDurationWorld, durationBounds, frameDurationCamera, type DurationView } from './durationWorld.ts';

export type DurationScene3DProps = DurationSceneProps & { onFailure?: (reason: string) => void };
type World = ReturnType<typeof createDurationWorld>;
type Runtime = { world: World; render: () => void; resize: () => void; setView: (view: DurationView) => void; dispose: () => void };

/** Three is loaded only when this optional view mounts. Rendering follows input changes, never an idle loop. */
export function DurationScene3D(props: DurationScene3DProps) {
  const { events, selectedId, activeId, position = 0, onSelect, reducedMotion = false, onFailure } = props;
  const [angle, setAngle] = useState<DurationView>('default');
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [failure, setFailure] = useState('');
  const visualPosition = reducedMotion ? 0 : position;
  const hostRef = useRef<HTMLDivElement>(null);
  const axisLabelsRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const currentRef = useRef({ events, selectedId, activeId, position, reducedMotion, onSelect, onFailure, angle });
  useEffect(() => { currentRef.current = { events, selectedId, activeId, position, reducedMotion, onSelect, onFailure, angle }; });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let alive = true;
    let failed = false;
    let localRuntime: Runtime | null = null;
    let partialRenderer: WebGLRenderer | null = null;
    let partialWorld: World | null = null;
    let partialReleased = false;
    function release() {
      if (localRuntime) localRuntime.dispose();
      else if (partialRenderer && !partialReleased) {
        partialReleased = true;
        partialWorld?.dispose();
        partialRenderer.dispose();
        if (!partialRenderer.getContext().isContextLost()) partialRenderer.forceContextLoss();
        partialRenderer.domElement.remove();
      }
    }
    function fail(reason: string) {
      if (!alive || failed) return;
      failed = true;
      release();
      runtimeRef.current = null;
      setFailure(reason);
      setStatus('failed');
      currentRef.current.onFailure?.(reason);
    }

    void import('three').then((three) => {
      if (!alive) return;
      const renderer = new three.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
      partialRenderer = renderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0xeef3f3, 1);
      const canvas = renderer.domElement;
      canvas.dataset.threeCanvas = '';
      canvas.dataset.renderer = 'three-webgl';
      canvas.dataset.threeRevision = three.REVISION;
      canvas.dataset.renderCount = '0';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.touchAction = 'pan-y';
      const scene = new three.Scene();
      scene.add(new three.AmbientLight(0xffffff, 2));
      const light = new three.DirectionalLight(0xffffff, 2.3);
      light.position.set(-3, 8, 6);
      scene.add(light);
      const world = createDurationWorld(three, currentRef.current.events);
      partialWorld = world;
      scene.add(world.group);
      const camera = new three.OrthographicCamera(-6, 6, 3, -3, 0.1, 100);
      const raycaster = new three.Raycaster();
      const pointer = new three.Vector2();
      let width = 1;
      let height = 1;
      let view = currentRef.current.angle;
      let disposed = false;
      let frame: number | null = null;
      let renderCount = 0;
      let ready = false;
      let pointerStart: { pointerId: number; id: string; x: number; y: number; dragged: boolean } | null = null;

      function render() {
        if (disposed || failed || frame !== null) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          if (disposed || failed) return;
          try {
            renderer.render(scene, camera);
            canvas.dataset.renderCount = String(++renderCount);
            canvas.dataset.eventCount = String(world.views.size);
            canvas.dataset.dpr = String(renderer.getPixelRatio());
            canvas.dataset.geometryCount = String(renderer.info.memory.geometries);
            canvas.dataset.threeReady = 'true';
            if (!ready) { ready = true; setStatus('ready'); }
          } catch (error) { fail(`3D 화면을 그리지 못했습니다. ${error instanceof Error ? error.message : 'WebGL 오류'}`); }
        });
      }
      function resize() {
        if (disposed) return;
        width = Math.max(1, host!.clientWidth);
        height = Math.max(1, host!.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(width, height, false);
        frameDurationCamera(camera, width, height, view);
        const padding = (1 - BAR_WIDTH / (camera.right - camera.left)) * 50;
        if (axisLabelsRef.current) axisLabelsRef.current.style.paddingInline = `${padding}%`;
        render();
      }
      function hit(event: PointerEvent): string | null {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        world.group.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObjects(world.pickTargets, false)[0]?.object.userData.eventId ?? null;
      }
      function pointerDown(event: PointerEvent) {
        if (!event.isPrimary || event.button !== 0) return;
        const id = hit(event);
        pointerStart = id ? { pointerId: event.pointerId, id, x: event.clientX, y: event.clientY, dragged: false } : null;
      }
      function pointerMove(event: PointerEvent) {
        if (pointerStart?.pointerId === event.pointerId && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) >= 8) pointerStart.dragged = true;
      }
      function pointerUp(event: PointerEvent) {
        const start = pointerStart;
        pointerStart = null;
        if (start?.pointerId === event.pointerId && !start.dragged && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8 && hit(event) === start.id) {
          currentRef.current.onSelect(start.id);
        }
      }
      function cancelPointer() { pointerStart = null; }
      function contextLost(event: Event) {
        event.preventDefault();
        fail('WebGL 연결이 끊어져 같은 리듬을 2D로 표시합니다.');
      }
      const observer = new ResizeObserver(resize);
      function dispose() {
        if (disposed) return;
        disposed = true;
        if (frame !== null) cancelAnimationFrame(frame);
        observer.disconnect();
        window.removeEventListener('resize', resize);
        canvas.removeEventListener('pointerdown', pointerDown);
        canvas.removeEventListener('pointermove', pointerMove);
        canvas.removeEventListener('pointerup', pointerUp);
        canvas.removeEventListener('pointercancel', cancelPointer);
        canvas.removeEventListener('pointerleave', cancelPointer);
        canvas.removeEventListener('webglcontextlost', contextLost);
        world.dispose();
        scene.clear();
        renderer.dispose();
        if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
        canvas.remove();
      }
      localRuntime = { world, render, resize, setView(nextView) { view = nextView; frameDurationCamera(camera, width, height, view); render(); }, dispose };
      runtimeRef.current = localRuntime;
      canvas.addEventListener('pointerdown', pointerDown);
      canvas.addEventListener('pointermove', pointerMove);
      canvas.addEventListener('pointerup', pointerUp);
      canvas.addEventListener('pointercancel', cancelPointer);
      canvas.addEventListener('pointerleave', cancelPointer);
      canvas.addEventListener('webglcontextlost', contextLost);
      window.addEventListener('resize', resize);
      host!.append(canvas);
      observer.observe(host!);
      world.setHighlight(currentRef.current.selectedId, currentRef.current.activeId);
      world.setPosition(currentRef.current.position, currentRef.current.reducedMotion);
      resize();
    }).catch((error: unknown) => {
      fail(`3D를 시작할 수 없습니다. ${error instanceof Error ? error.message : 'WebGL2를 지원하는 환경이 필요합니다.'}`);
    });

    return () => {
      alive = false;
      release();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    try { runtime.world.setEvents(events); runtime.render(); }
    catch (error) {
      const reason = error instanceof Error ? error.message : '3D 시간 좌표를 만들지 못했습니다.';
      runtime.dispose();
      runtimeRef.current = null;
      setFailure(reason);
      setStatus('failed');
      currentRef.current.onFailure?.(reason);
    }
  }, [events]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.world.setHighlight(selectedId, activeId);
    runtime.render();
  }, [selectedId, activeId]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.world.setPosition(visualPosition, reducedMotion);
    runtime.render();
  }, [visualPosition, reducedMotion]);
  useEffect(() => { runtimeRef.current?.setView(angle); }, [angle]);

  if (failure) return <><p role="status" data-three-fallback>{failure}</p><DurationScene2D {...props} /></>;

  return <section className="duration-scene-3d" aria-label="음가 비교 입체 블록">
    <p className="axis-legend">가로 길이 = 시간 · 높이와 깊이는 고정 · 점선 윤곽 = 쉼표</p>
    <div ref={hostRef} className="three-viewport" data-three-viewport data-three-status={status} data-three-view={angle}
      role="img" aria-label="시간을 보여 주는 입체 블록. 아래 순서 목록에서도 선택할 수 있습니다." />
    {status === 'loading' && <p role="status">입체 화면을 준비하고 있어요. 아래 목록에서 먼저 선택할 수 있습니다.</p>}
    <div ref={axisLabelsRef} aria-hidden="true" className="three-axis-labels"><span>0</span><span>1/4</span><span>1/2</span><span>3/4</span><span>1</span></div>
    <div className="three-view-controls" role="group" aria-label="입체 화면 각도">
      <button type="button" onClick={() => setAngle('default')} aria-pressed={angle === 'default'}>기본 각도</button>
      <button type="button" onClick={() => setAngle('shallow')} aria-pressed={angle === 'shallow'}>낮은 각도</button>
    </div>
    <ol aria-label="입체 블록 순서 목록에서 선택" className="three-event-controls">
      {events.map((event, index) => {
        const bounds = durationBounds(event);
        return <li key={event.id} data-three-event={event.id} data-three-kind={event.kind}
          data-three-x={bounds.x} data-three-width={bounds.width} data-three-height={bounds.height} data-three-depth={bounds.depth}>
          <button type="button" data-event-select={event.id} onClick={() => onSelect(event.id)}
            aria-label={`${index + 1}번째 ${eventLabel(event)}, 시작 ${event.onset.n}/${event.onset.d}`}
            aria-pressed={selectedId === event.id} aria-current={activeId === event.id ? 'step' : undefined}>
            {index + 1}. {durationNames[event.notation.type] ?? event.notation.type}{event.kind === 'rest' ? '쉼표' : '음표'} <small>{event.duration.n}/{event.duration.d}</small>
          </button>
        </li>;
      })}
    </ol>
    {!events.length && <p>빈 마디입니다. 카드를 골라 음표나 쉼표를 넣어 보세요.</p>}
  </section>;
}

export default DurationScene3D;
