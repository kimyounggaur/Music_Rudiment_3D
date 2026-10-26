# Three.js 구현·검수 기록

이 문서는 실제 Three.js 전환 이후의 상태를 기록한다. 이전 CSS3D 대체 구현에 관한 기록은 이전 빌드의 이력이다. 악보 검수 문서는 변경하지 않았다.

## 구현 범위

- [DurationScene3D.tsx](../../src/scenes/DurationScene3D.tsx)는 `three`를 화면 진입 시 불러온다. 설치된 실제 버전은 Three.js `0.186.1`, 타입은 `@types/three 0.186.0`이다. `WebGLRenderer`의 실제 WebGL2 Canvas를 사용한다.
- [durationWorld.ts](../../src/scenes/durationWorld.ts)의 온음표 너비는 10이다. `x = onset × 10`, `width = duration × 10`이며 높이 `0.38`, 깊이 `0.9`는 모든 음가에서 같다. 음악 이벤트의 시간·음높이·음량·진행을 변경하지 않는다.
- 음표는 입체 상자, 쉼표는 속이 빈 점선 윤곽이다. 쉼표의 같은 시간 영역에는 색을 쓰지 않는 투명 선택 Mesh를 두어 Raycaster로 선택할 수 있다. 선택·재생 강조가 쉼표를 채워진 음표로 바꾸지 않는다.
- 기본·낮은 각도는 사용자가 누르는 고정 직교 카메라 시점이다. 자동 회전은 없다. X축에 기울기를 주지 않아 두 시점에서 음가 길이 비율을 유지한다.
- 실제 Canvas의 누른 위치와 뗀 위치가 같은 이벤트이고 이동이 8px 미만일 때 선택한다. 이동 후 제자리로 돌아오는 드래그, pointercancel·pointerleave는 선택하지 않는다. 별도의 순서 목록과 각도 버튼은 최소 44px이다.
- DPR은 최대 1.5이다. 데이터·선택·재생 위치·크기·수동 시점 변경이 있을 때 한 번 예약하여 그리며 유휴 애니메이션 루프는 없다. 모션 감소 시 이동 재생선과 그 위치의 연속 그리기를 생략하고 이벤트 강조는 유지한다.
- WebGL 초기화·그리기 실패와 실제 context loss는 2D 대체 콜백으로 연결된다. 부모는 재생을 정지하고 같은 리듬·학습 진행을 유지한다. 화면 해제 시 예약 프레임, ResizeObserver, 리스너, Geometry·Material, renderer, context, Canvas를 정리한다. 초기화 도중 실패한 부분 자원도 정리한다.
- MIT 고지는 [Three-MIT.txt](../../public/licenses/Three-MIT.txt)에 보존한다. 외부 텍스처·글꼴·OrbitControls·유료 서비스는 이 장면에 사용하지 않는다.

## 실행하여 확인한 검사

[duration-world.test.ts](../../tests/duration-world.test.ts)의 실제 Three 객체를 사용한 Node 검사 **6/6 통과**:

1. Box3로 1·2·4·8·16분할의 전체 길이, 인접 경계, 고정 높이·깊이, 원본 불변성 확인.
2. 혼합 음표·쉼표의 실제 경계와 모든 강조 상태의 투명 쉼표 선택 영역·점선 유지 확인.
3. 두 시점·세 화면 크기에서 실제 OrthographicCamera 투영과 Raycaster로 16개 이벤트 각각 선택, 장면 범위·길이 비율 확인.
4. 선택 시 Mesh 유지, 패턴 교체 시 Geometry 공유, 잘못된 교체 거절 시 기존 유효 장면 유지 확인.
5. 데이터·선택 50회 변경 동안 공유 자원 유지, 실제 dispose 이벤트 각 1회, 반복 정리의 멱등성 확인.
6. 재생선의 잘못된 수치 제한과 모션 감소, 음악 이벤트 불변성 확인.

구현 소스와 단위 테스트의 ESLint·엄격한 TypeScript 검사를 통과했다. 병행 작성되던 별도 HTTP 검사 스크립트의 implicit `this` 오류는 부모가 수정한 뒤 실행 성공을 확인했다.

부모가 승인된 로컬 production HTTP 환경에서 실행한 [three-http-e2e.ts](../../scripts/three-http-e2e.ts)는 **9/9 통과**했다. 실제 결과는 [results.json](../../output/http/three/results.json)이다.

| 확인 항목 | 실제 결과 |
| --- | --- |
| 실제 Three revision 186·WebGL2 Canvas, 2분음표 경계, DPR | x/width = 0/5, 5/5; 높이 0.38·깊이 0.9; DPR 1.5 |
| 유휴 그리기 | 안정화 후 600ms 동안 render-count 2에서 증가 없음 |
| Canvas Raycaster | 실제 탭 선택 성공; 바깥으로 이동 후 돌아온 드래그는 선택하지 않음 |
| 키보드·회전 | 44px 순서 버튼의 Enter 선택; 가로·세로 전환 뒤 패턴·학습 진행 유지 |
| 쉼표 | 시간·DOM 이름 유지; 실제 쉼표 장면 렌더와 단위 테스트의 점선·빈 내부 계약 확인 |
| 실제 context loss | `WEBGL_lose_context`로 문맥 손실 발생; 재생 정지·Canvas 제거·같은 패턴의 2D 전환 |
| 반복 진입·취소 | 6회 mount/unmount와 빠른 모드 취소 뒤 Canvas 0개 |
| WebGL 부재 장애 주입 | 사용 가능한 2D로 자동 전환; 편집 리듬 유지 |
| 지연 모듈 로딩 실패 주입 | 오류 경계가 처리하여 사용 가능한 2D 유지 |

결과의 브라우저는 Chromium `148.0.7778.96`이며 추가 보안 해제 플래그는 사용하지 않았다. 최종 재실행 9/9 통과의 대상 `dist/index.html` SHA-256은 `6d4ca09b0288cdd5bdf376fbdc7168e13e432bdb919f6b6151d7f348ad08383d`이다. 초기 검수 이후 App의 준비 안내 문구와 snapshot 확인 간격 32ms가 반영된 빌드에서도 다시 통과했다. 전체 회귀 검사는 부모의 최종 결과를 따른다. 단위 검사는 GPU나 브라우저 실행을 대신하지 않으며, 장애 주입 검사는 성공 경로의 실제 WebGL 실행과 구분한다.

## 화면 직접 검토

검수 담당 하위 에이전트가 브라우저를 새로 실행하지 않고 생성된 실제 PNG를 `view_image`로 열어 확인했다.

- [가로 화면](../../output/http/three/actual-three-landscape.png): 같은 길이의 두 입체 블록, 선택 색·순서 목록, 낮은 각도 선택, 시간 축·정확 악보의 동시 표시를 확인했다.
- [세로 화면](../../output/http/three/actual-three-portrait.png): 한 열 대체 배치, 각도·선택 버튼, 리듬·악보·문항의 순서를 확인했다. 긴 페이지 전체 캡처에는 sticky 재생 막대가 당시 화면 위치에 함께 찍혔다.
- [쉼표 전체 페이지](../../output/http/three/actual-three-rest-outline.png): 처음에는 sticky 재생 막대가 3D 블록을 가려 쉼표 윤곽 검토를 보류했다. 이 가림은 전체 페이지 캡처의 이력이며 아래 추가 검수로 해소했다.
- [가림 없는 쉼표 Canvas](../../output/http/three/actual-three-rest-canvas.png): 검수 담당자가 추가 PNG를 직접 열었다. 네 개의 같은 4분 길이 영역 중 첫째·셋째는 색이 채워진 음표이고 둘째·넷째는 속이 빈 점선 쉼표임을 확인했다. 윗면·옆면의 윤곽과 공통 기준선이 보이고 재생 막대가 장면을 가리지 않는다. 쉼표가 시간을 계속 차지하면서 음표의 채움과 구별되는 시각 검토를 완료했다.

## 재현 방법과 남은 한계

```powershell
node --test tests/duration-world.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/scenes tests/duration-world.test.ts
```

HTTP 검사는 `dist/`가 승인된 `http://127.0.0.1:4174/`에서 제공 중인 상태에서 부모가 기존에 검증한 headless-shell 1223 실행 파일을 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`로 지정하고 `node scripts/three-http-e2e.ts`를 실행했다. 이전에 접근 거부된 Chromium 1248을 하위 에이전트가 재시도하지 않았다. 이 검수 담당 에이전트는 이번 Three 작업에서 브라우저를 실행하지 않았다.

실제 모바일 기기·iOS Safari·저가형 GPU·15분 지속 사용·발열·지속 FPS·입력 지연은 검증하지 않았다. 600ms 유휴 그리기 검사는 그 조건의 불필요한 프레임이 없음을 뜻하며 일반 성능 보장은 아니다. 스피커 청취와 음악 교육자의 최종 수업 적합성 승인은 남아 있다.
