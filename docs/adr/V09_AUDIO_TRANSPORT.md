# V09 — 같은 음악 snapshot의 실제 일시정지와 이어 듣기

2026-10-28 UTC. G1-A/B 객관적 통과 후 진행한 V09 구현 선택이다. 기준은 상세 설계서13절 및 프롬프트 V09다. 실제 브라우저 회귀와 실제 청취는 별도 검증이며, 이 ADR 자체는 청취 완료 증거가 아니다.

## 선택과 대안

책은 `TransportAdapter`를 사용한다. 이는 `AudioEngine`의 buffer 모드를 선택하는 얇은 하위 클래스이며 다른 엔진이나 AudioContext를 만들지 않는다. 기존 `new AudioEngine()`의 oscillator 예약 경로와 그18개 회귀 검사는 유지한다.

| 방법 | 이 한 마디 합성음에서의 판단 |
|---|---|
| 남은 oscillator 이벤트 재예약 | 기존 절대 예약을 재사용하지만 지속음 중간의 위상·envelope·새 어택 의미를 별도 복원해야 한다. 기본 baseline에 유지하되 책의 pause 경로로 선택하지 않았다. |
| OfflineAudioContext로 한 마디 렌더 | 버퍼 재사용에 적합하다. 현재의 단순 sine/envelope를 위해 추가 비동기 렌더 수명과 취소 경로를 도입할 이득은 작다. 복잡한 악기 합성으로 확장할 때 다시 비교한다. |
| 같은 realtime context의 AudioBuffer에 PCM 렌더 | **선택.** 검증된 분수의 domain `seconds`와 `frequency`로 한 번 합성한다. 중간 재개는 같은 버퍼의 같은 초 위치를 읽으므로 음악 이벤트를 다시 생성하지 않는다. 추가 context나 장식음이 없다. |

`renderBarBuffer`는 기존과 같은 sine 및 최대8ms attack/release envelope를 계산한다. 이벤트 onset/end를 초로 유지하고 해당 구간의 샘플만 채운다. 경계의 샘플 양자화는1 sample 미만이며 버퍼 길이는 `ceil(logicalDuration * sampleRate)`다. 버퍼의 자연 길이와 논리 마디 길이 차이는1 sample 미만이다. 쉼표와 끝의 여백은0이다. 한 번에 현재/paused session의 한 버퍼만 보유하고 stop·자연종료·오류·dispose에서 그 참조를 버린다. 전체 페이지 버퍼 캐시는 없다. 기존 검증이 이벤트1–64개, 한 마디 이내, 논리 길이120초 이하로 입력을 제한한다.

## 호출 계약

```ts
new TransportAdapter(options?) // 단일 엔진, constructor에서는 context를 만들지 않음
play(snapshot: AudioSnapshot, { loop?: boolean, revision?: number }): Promise<PlaybackSnapshot>
pause(): PlaybackSnapshot
resume(expectedRevision: number): Promise<PlaybackSnapshot>
stop(reason?: string): void
subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void
```

- 책의 `play`는 현재 lesson revision을 전달한다. 제공 revision은0 이상의 safe integer여야 한다. events·tempo·logicalDuration·revision은 재생 요청 시 복사/검증하고 고정한다. Caller가 원본을 바꿔도 이미 시작한 마디가 바뀌지 않는다.
- `logicalOffset`과 `currentPosition`은 **초**이고 `relativePosition`은 원래 음악의 온음표 비율이다. entry/turn 애니메이션 시간과 무관하다.
- pause는 오디오 시계에서 offset을 저장하고 예약/현재 source를 stop·disconnect한다. timer도 중지하며 sessionId·snapshot·buffer를 보존한다. paused UI는 RAF를 돌릴 필요가 없다.
- resume는 새 AudioBufferSource를 만들고 `start(when, offset)`으로 같은 버퍼를 읽는다. 한 source를 두 번 start하지 않는다. 35ms 시작 여유 동안도 보존한 offset이 뒤로 움직이지 않는다. 출력에 최대8ms의 짧은 fade를 적용할 수 있지만 musical onset·duration·이벤트 수를 바꾸지 않는다.
- expectedRevision 불일치는 offset을 버리고 `REVISION_MISMATCH`로 돌아간다. 책 UI는 playing/starting/paused 동안 편집을 비활성화하고 ready 상태에서만 lesson command를 수락한다. 사용자가 명시적으로 Stop을 누른 뒤 편집하는 정책이며, 편집 요청이 자동 stop을 수행한다고 설명하지 않는다. 현재 첫 두 펼침에는 tempo 변경 UI가 없고 V13에서 추가한다. 다른 revision/tempo/lane의 소유자는 재개를 허용하지 않으며, paused snapshot 불변성·tempo identity 변경 거부는 단위 검사로 확인한다.
- 동일 시작 요청20회는 같은 promise와 한 source를 공유한다. stop·next·close·hide·mode 전환은 request token을 무효화하여 늦은 context resume가 소리를 만들지 못하게 한다. 아직 첫 play가 준비 중일 때 pause하면 시작을 취소한다. 이미 paused session의 resume 대기 중 pause하면 기존 offset을 유지하고 그 재개 요청만 취소한다.
- source의 `onended`는 자원 해제만 한다. 자연 완료는 `AudioContext.currentTime`이 끝의 쉼표까지 포함한 논리 종료에 도달했을 때만 표시한다. 종료 후 offset0/ready다.
- `lastCompletedSessionId`는 논리 종료 기록이다. `lastUninterruptedCompletedSessionId`는 pause 없이 끝난 session만 기록한다. 둘 다 실제 청취를 뜻하지 않는다. pause/resume한 지속음을 새 음악 어택으로 집계하지 않는다.
- buffer mode의 명시적 loop는 같은 source의 native loop와 정확한 `loopEnd`를 사용한다. loop 해제는 현재 마디를 마친다. 사전 `stop(end)` 예약을 남겨 loop가 첫 마디에서 끊기지 않도록 PCM 자연 끝과 논리 완료를 분리했다. stop은 loop 선택도 해제한다. 기존 oscillator baseline의 예약/late-scheduler 검사 계약은 유지한다.
- 외부 `statechange`에서 context가 running이 아니면 즉시 stop/reset하고 구독자에게 snapshot을 알린다. paused UI도 polling 없이 정지 상태를 받는다. getSnapshot/RAF 읽기는 알림을 만들지 않으며 구독 해제 및 dispose는 listener를 정리한다. `interrupted`를 앱 상태로 추가하지 않고 실제 context의 문자열을 보수적으로 처리한다. 자동 재개하지 않는다.

## API 근거와 브라우저 범위

2026-10-28에 확인한 [Web Audio API 규격](https://webaudio.github.io/web-audio-api/#AudioBufferSourceNode)은 source별 단일 start와 offset 기반 버퍼 재생을 정의한다. [MDN start 문서](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start)는 when/offset이 초 단위이며 offset이 원래 버퍼 sample rate를 기준으로 한다고 설명하고 이 API를 폭넓게 지원되는 기능으로 표시한다. [MDN context state 문서](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state)는 running/suspended/closed 및 브라우저에 따라 발생하는 interrupted와 statechange를 설명한다.

이 문서 확인은 현재 Windows IAB Chromium156에서의 실행 결과를 대신하지 않는다. 해당 브라우저에서 buffer identity·source start/stop·offset·정지·재개·전환·실제 context suspend/close를 별도로 검사한다. 다른 브라우저, 실제 interrupted 발생, 물리 출력장치와 클릭/중복 어택의 실제 청취는 수행 여부를 분리해 기록한다. 합성 파형이나 mock 테스트를 실제로 들었다는 증거로 쓰지 않는다.

## 구현 단계 검사

`node --test tests/audio.test.ts tests/audio-transport.test.ts`는 기존18개와 새28개, 총 **46/46** 통과했다. 새 경로는 음표 중간/경계/쉼표/끝의 쉼표, lead 중 offset 유지, source 재사용 금지,20회 요청 병합, 늦은 resume/onended, revision 불일치, loop 변경, native interruption 구독, 잘못된 입력과 샘플 경계를 검사한다. 오디오 소스/테스트 범위 ESLint 및 프로젝트 typecheck는 각각 exit0이다.

[V09 집중 검사 요약](../../output/qa-v2.1/v09-audio-focused-20261028-0646-summary.json)에 실행 로그와 소스 SHA256을 연결했다. 이는 mock 기반 엔진 계약 및 정적 검사이며 실제 브라우저 재생 또는 청취 통과로 승계하지 않는다. 실 브라우저의 sessionId·start/stop·logicalOffset·snapshotRevision은 별도 실행 증거에 기록한다.

책 UI 연결까지 동결한 뒤 `npm test` → `npm run lint` → `npm run build` → `npm run typecheck`를 새로 실행했고 모두 exit0이었다. 통합 테스트는 **210/210**, failed/skipped/cancelled0이다. build는157 modules, main chunk1045.89kB/gzip290.30kB이며500kB 초과 경고는 남아 있다. [V09 통합 검사 요약](../../output/qa-v2.1/v09-integrated-20261028-065009-summary.json)에 명령별 실제 로그와 오디오/책 소스 SHA256을 보존했다. 빈 출력도 파일에 명시적으로 쓰는 방식으로 로그를 저장했다. 기존 content validation의6 scenes/9 lanes는 책 구현의6개 펼침면 확장 완료를 뜻하지 않는다. 이 검사는 실제 청취·브라우저 검증을 대신하지 않는다.


## 2026-10-28T07:10:47.790Z 기술 검증 판정

[실제 실행과 검증 행렬](../qa/V09_TRANSPORT.md)에210/210 고정 코드 검사와 실제 mid-note 재개·20회재생·future stop·페이지/모드/닫기·native suspend/close·별도 쉼표API 실험을 연결했다. V09 기술 계약은 명시된 첫 두 펼침/Windows Chromium 환경에서 통과했으며 실제 청취는 미완료다. 정확경계는unit, near-boundary는실제API, 지연resume·hidden·latecallback은명시한에뮬레이션으로 구분한다. 이 문서 갱신으로 소스를 수정하거나 새runtime검사를 실행하지 않았다.
