# V09 오디오 위치 보존과 경쟁 조건

판정: 2026-10-28T07:10:47.790Z. **V09 기술 계약 통과 — 첫 두 펼침면과 명시된 Windows IAB Chromium156 환경.** G1-A/B 이후의 frozen V09 소스에 대해210/210·lint·build·typecheck 및 아래 실제 Web Audio 증거를 연결했다. 실제 청취·물리 출력장치의 클릭/중복 어택 검수는 미실행이다. 이 판정은 전체 v2.1 완료나 commit/push 허용 시점이 아니다.

## 계약과 실제 편집 정책

pause는 오디오 시계의 logicalOffset을 저장하고 현재/예약 source를 stop·disconnect한다. resume는 같은 불변 snapshot·tempo·revision·buffer를 새 source의 해당 초 offset부터 재생한다. Stop·페이지 이탈·책 닫기·숨김·읽기 모드 전환은offset0이며 자동 재개하지 않는다. 자연 종료는 끝 쉼표를 포함한 logicalDuration에 따른다. source.onended는 자원 정리와 구분한다.

**책 UI는 사용자가 Stop을 누른 뒤 편집한다.** playing/starting/paused 동안 음표 선택·분할·병합·답안 조작은 비활성이고 lesson command는 ready 상태에서만 수락한다. paused 상태의 조작이 자동으로 stop/edit된다고 설명하지 않는다. 현재 첫 두 펼침에는 tempo 변경 UI가 없으며 V13의 해당 장면에서 제공한다. paused owner의 revision/tempo/lane 변경 거부와 snapshot 불변성은 단위 검사로 확인했다. tempo UI 실제 조작 완료라는 뜻은 아니다.

pause/resume를 거친 완료는 uninterrupted completion으로 집계하지 않는다. 모든 기술 완료·PCM 분석은 사람이 실제로 들었다는 증거가 아니다. 구현 선택은 [ADR](../adr/V09_AUDIO_TRANSPORT.md)에 있다.

## 코드 검사와 실행 환경

- [V09 통합 검사](../../output/qa-v2.1/v09-integrated-20261028-065009-summary.json):210/210, failed/skipped/cancelled0; lint·build·typecheck exit0. build157 modules, main1045.89kB/gzip290.30kB,500kB 초과 경고 유지. 기존 content6 scenes/9 lanes는 첫 두 펼침 범위와 구분한다.
- [집중 검사](../../output/qa-v2.1/v09-audio-focused-20261028-0646-summary.json): 기존 oscillator18+새 buffer28=46/46. [transport tests](../../tests/audio-transport.test.ts)는 정확한 경계·쉼표·future stop·late promise/onended·revision·context 상태·loop·PCM을, [owner tests](../../tests/book-audio-ownership.test.ts)는 page/mode/tempo/revision 소유권을 검사한다. 이들은 mock/순수 검사이며 실제 브라우저 증거와 구분한다.
- 감사 시 통합 요약의7개 소스 지문이 현재 파일과 모두 일치했다. 이후 V10 변경은 이210 결과로 자동 통과시키지 않는다.
- 실제 앱: 전용 IAB의localhost4183, Windows Chromium156,1280×720·DPR1, 사용자 제스처/CUA/CDP 입력, 실제 realtime context44100Hz. 별도 rest API 실험은 전용localhost 탭의 실제48000Hz context이며 화면의 학습 장면을 조작한 검사는 아니다. 임시 probe는 제거했고 앱을 reload했으며 실험 탭은 닫았다는 실행자 보고를 기록한다.

## 요구별 증거와 한계

아래 짧은 파일명은 output/qa-v2.1/v09-1793170091718- 접두사를 생략했다.

| 계약 | 확인 결과 | 증거 / 한계 |
|---|---|---|
| 음표 중간 pause→대기→resume | offset0.8763832199546485 고정, source1 stop, buffer1을 새source2가 같은offset으로start; session1/revision0 유지. 자연 종료 후offset0/source0, uninterrupted 완료 아님 | [midnote-resume](../../output/qa-v2.1/v09-1793170091718-midnote-resume.json). 실제 앱+native AudioBufferSourceNode 기록; 초기context0→사용자재생 뒤1 |
| 경계·쉼표·끝 쉼표 | 실제 near-boundary .677, 내부쉼표 .9036667, 끝쉼표2.205에서 pause/held/resume offset 보존, 같은buffer·새node, 각session/revision42 유지. 쉼표 PCM peak0, logical end 뒤ready/offset0 | [real-context-rests](../../output/qa-v2.1/v09-1793170091718-real-context-rests.json). 별도 실제API 실험. exact2/3보다10.333ms 뒤인 첫 표본을 정확경계라고 부르지 않음; 정확경계는 unit clock 검사. Runtime.evaluate 응답timeout 뒤 완료 결과를 복구했으며 재실행 성공으로 꾸미지 않음 |
| 재생20회 |20 native click 뒤context1, 추가source1, active source1. Stop 후source0/offset0 | [play20](../../output/qa-v2.1/v09-1793170091718-play20.json). 기존 누적source 수와 동시active 수를 혼동하지 않음 |
| pending resume→next | starting 중next에서offset0/source0; promise 해제 후에도 추가start 없음 | [delayed-resume-next](../../output/qa-v2.1/v09-1793170091718-delayed-resume-next.json). 실제 앱/context에 suspended getter와 지연promise를 명시적으로 에뮬레이션했다. native 지연 발생 관측은 아님 |
| 예약 직후Stop | audioTime27.952에서stop, 예약start27.987보다35ms 빠름. source0/offset0·새 완료 없음 | [real-context-rests immediateStop](../../output/qa-v2.1/v09-1793170091718-real-context-rests.json), future-source 단위 회귀. start 전에 실제stop 호출 확인 |
| paused 편집·tempo 요청 정책 | paused edit/play 비활성, resume 활성; UI는Stop 후 편집. 변경된revision/tempo/lane owner는 거부하고 이미paused buffer는 caller변경으로 변하지 않음 | [paused-edit-mode](../../output/qa-v2.1/v09-1793170091718-paused-edit-mode.json), owner/immutable tests. 이 파일은 편집으로revision을 바꾼 기록이 아니며 tempo UI는 현재 없음 |
| next·2D·drag/cancel | paused→next와mode 전환에서offset0/source0. paused print drag도page-exit로정지하고 cancel 후ready/sceneProgress1 | [paused-next](../../output/qa-v2.1/v09-1793170091718-paused-next.json), [paused-edit-mode](../../output/qa-v2.1/v09-1793170091718-paused-edit-mode.json), [paused-print-drag](../../output/qa-v2.1/v09-1793170091718-paused-print-drag.json), [settled](../../output/qa-v2.1/v09-1793170091718-paused-print-settled.json) |
| close·늦은onended | 재생 중close 즉시source0/offset0, coverIdle/unmounted까지 유지. 보존한old callback을 명시 호출해도 새start·완료·owner변경 없음 | [close-late-ended](../../output/qa-v2.1/v09-1793170091718-close-late-ended.json). close는 실제, 늦은callback 호출은 에뮬레이션; native 경합이 우연히 발생한 관측이라고 쓰지 않음 |
| native suspend/close | 실제context.suspend 중paused owner 즉시reset, resume context만으로autoplay 없음. 실제context.close는unavailable/source0/offset0; 이후 명시Play도CONTEXT_CLOSED 안내, source 추가 없음 | [native-suspend-paused](../../output/qa-v2.1/v09-1793170091718-native-suspend-paused.json), [native-context-closed](../../output/qa-v2.1/v09-1793170091718-native-context-closed.json), [closed-context-retry](../../output/qa-v2.1/v09-1793170091718-closed-context-retry.json). OS의 실제interrupted 발생은 미관측; 해당 문자열 경로는 unit 검사 |
| hidden→visible | document.hidden과visibilityState 양쪽getter+event 에뮬레이션에서offset0/source0, 복귀자동재생 없음 | [hidden-paused](../../output/qa-v2.1/v09-1793170091718-hidden-paused.json). 처음visibilityState만 바꾼 실패 표본은통과근거에서제외. native background tab은 미검증. visible 표본은scene entering이므로 최종visual ready를 이 파일만으로 주장하지 않음 |

## 판정 범위와 남은 검수

프롬프트 V09의 위치 유지·불변 snapshot·안전 stop·소유권/race 계약은 새 단위 검사와 명시된 실제 브라우저/API 증거로 기술 통과했다. 정확한시간 경계·불변성·희소경합을 단위 검사한 사실과 실제 환경에서 재현한 경로를 표에서 분리했다. 모든 조합을 실제기기에서 수행했다는 뜻은 아니다.

실제 스피커/헤드폰·출력음량·클릭 소리·중복 어택 청취, 다른브라우저와 OS interruption, native background visibility는 미검증이다. 실제 청취는 최종 수업 시험 준비의 필수 검수로 유지한다. 새로운 환경/기기 검사나 전체 V10+ 완료를 이 기술 판정으로 대체하지 않는다.

## API 근거

2026-10-28에 읽은 [AudioBufferSourceNode.start](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start), [OfflineAudioContext.startRendering](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/startRendering), [BaseAudioContext.state](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state)를 ADR의 대안 비교와 연결한다. 새source의offset재생·동일node재시작금지와 실제브라우저지원범위를 구분한다.
