# V10 학습 기록 저장과 이관 검증

상태: **V10 기술 계약 통과 — Windows의 전용 IAB와 명시한 예외 주입 범위.** 고정 소스의 251/251 테스트와 lint·build·typecheck가 통과했고, 실제 저장·이관·새로고침·가져오기·삭제 동작을 아래 증거와 대조했다. 전체 v2.1 완료나 실제 청취·물리 터치·보조기술 수용 판정은 아니다.

## 보존과 복구 계약

- 기존 v1 저장 형식과 검증기를 유지하고, 책 UI·학습 schema·콘텐츠 버전을 별도로 구분한다.
- 현재 확정된 펼침면, 장면별 리듬·답안·템포·힌트, 현재/과거 성취, 접근성·음량 선호만 저장한다. 페이지 턴 중간값이나 재생 세션은 저장하지 않는다.
- v1 원문 보존과 새 형식 검증이 성공한 뒤 새 키에 쓴다. 손상·지원하지 않는 버전·저장 실패는 원문과 기존 정상 값을 유지한다.
- 표지의 이어보기와 처음부터 둘러보기를 구분한다. 둘러보기는 학습 데이터 삭제가 아니다.
- 가져오기는 미리보기와 확정을 분리한다. 삭제는 책 안에서 별도로 확인하고 앱 전용 키만 대상으로 한다.
- 복원된 답안은 현재 음악 규칙으로 다시 평가한다. 과거 성공을 현재 정답으로 고정하지 않는다.

## 실행 검증 행렬

| 입력 | 확인할 결과 | 상태 |
|---|---|---|
| 분할 → 페이지 복귀 | 같은 이벤트와 길이 유지, 정지 상태 | 실제 분할2→이전1→다음2 통과. 문자 그대로 다음3→이전2는 V13에 대기 |
| 답안/리듬 저장 → 새로고침 → 이어보기 | 저장된 확정 펼침면과 학습 데이터 복원, 자동 소리 없음 | 실제 IAB 통과 |
| 저장 후 처음부터 둘러보기 | 첫 펼침면부터 읽으며 다른 장면 답안 유지 | 실제 IAB 통과 |
| v1 정상 기록 | 원문 보존, 명시적 장면 매핑, 새 키 검증 성공 | 실제 localStorage 이관·byte 일치 통과. 6개 장면 매핑은 단위 검사 |
| 손상 JSON / 지원하지 않는 버전 | 자동 덮어쓰기 없음, 원문 내보내기와 이유 표시 | 실제 IAB 시작·학습 편집·원문 표시 통과 |
| quota / security 오류 | 저장 실패를 성공으로 표시하지 않음, 세션 학습 계속 가능 | quota는 실제 UI와 내보내기 통과. SecurityError는 실제 시작 로더에 getter 예외 주입 통과. OS 정책 차단 검수 아님 |
| 가져오기 미리보기 취소 / 확정 | 확정 전 저장 변경 없음, 재검증 후 적용 | 실제 IAB 통과; 확정 뒤 표지/장면 unmounted/소스0, 이전 원문 백업 일치 |
| 전체 삭제 → 재실행 | 앱 기록·앱 백업 제거, 다른 키 유지, 자동 복구 없음 | 실제 IAB 통과; 취소 시 5개 hash 유지, 확정 후 5개 키 없음, 별도 sentinel 유지, reload 뒤 이어보기 없음 |
| 저장 중 다른 탭 변경 | 새 값을 덮지 않고 충돌을 알림 | 통제한 외부 쓰기 뒤 실제 UI 충돌 안내·새 원문 보존. 원자적 탭 간 트랜잭션 주장 없음 |

브라우저 검증은 전용 IAB의 localhost에서 수행한다. 기존 앱 키는 먼저 보존하고 임시 검증 데이터와 구분한다. 속성/예외 주입은 명시적인 에뮬레이션으로 기록하며 실제 OS 저장 차단과 동일하다고 주장하지 않는다.

## 실제 실행 증거

증거 디렉터리는 `output/qa-v2.1/`, 공통 접두사는 `v10-1793171557709-`이다. 통합 검사 기록은 `v10-integrated-20261028-073547-summary.json`이며 74개 소스·테스트·설정 파일이 검사 전후 동일했다. 251개 테스트의 fail/skipped/cancelled/todo는 모두 0이다. 빌드의 main 1081.03kB/gzip 302.13kB 및 500kB 경고는 V15에 남긴다.

| 증거 파일의 접미사 | 확인 내용 |
|---|---|
| `storage-before.json`, `actual-v1-migration.json` | 검증 시작 전 앱 키 0개, 실제 v1 원문 보존과 새 schema 이관 |
| `resume-split-revisit.json`, `refresh-resume.json`, `browse-keeps-data.json` | quarter/quarter/half의 동일 이벤트 IDs·답안8 복원, 정지 상태, 처음부터 읽기의 데이터 보존 |
| `preferences-motion.json`, `preferences-and-tools.json` | 힌트·2D·움직임 줄이기·음소거·음량 복원, 도구를 열면 재생 중단 |
| `import-export.json` | 유효한 JSON 내보내기, 미리보기/취소 무변경, 확정 시 원문 백업 |
| `corrupt-protected.json`, `unsupported-version.json`, `unsupported-spread.json` | 손상/미지원 원문 보호, 아직 없는6번 펼침면을 임의로 덮지 않음 |
| `quota-injected.json`, `security-injected.json` | 명시한 예외 주입. quota 후 저장은3개 이벤트 유지, 세션 내보내기는4개 이벤트 유지 |
| `storage-conflict.json` | 감지 이후 다른 writer의 원문 유지 |
| `resume-before-delete.json`, `delete-confirm.json`, `delete-reload.json`, `delete-reload.png` | 중단 후 원문/hash 보존, 취소/확정/재실행·별도 키 보존. sentinel은 검증 후 자기 값일 때만 제거 |

현재/과거 성취는 저장 실패 중에도 세션에서 유지하고, 복원 시 현재 평가를 다시 계산한다. 가져오기 실패가 이미 존재하는 정상 백업을 덮지 않도록 보호하는 회귀도 포함됐다. 상세 단위 경계는 `tests/book-progress.test.ts`와 `tests/book-progress-session.test.ts`에 있다.

## 중단과 범위 제한

- 07:51:48 UTC 이후 실제 파일 내려받기 확인 도중 Browser use 권한 대기가 발생해 실행이 중단됐다. 사용자가 허용과 제어권 반환을 명시한 뒤 같은 IAB를 다시 연결했다. 중단된 내려받기는 성공 notice나 파일 경로가 확보되지 않아 **실제 파일 전달 결과 불확실**로 남긴다. 유효한 현재 JSON의 textarea 내보내기와 schema 검증은 별도 통과 증거다.
- 재개 시 브라우저 번호가 바뀌어 현 목록으로 IAB를 다시 식별했다. Edge의 다른 탭·프로세스는 조작하지 않았다. 기존 Vite PID19044와 IAB의 HTTP200 응답을 확인했다. 한 번의 추가 시작 시도는 포트 사용 중 오류로 종료돼 중복 서버를 만들지 않았다.
- 원문 확보·이전 단계 검사·251개 소스 검사는 전체 제품 완료 증거가 아니다. V11 이후, G1-C/원본 체감 비교, 물리 기기 터치, 실제 청취, 실제 보조기술·교육자 검수와 최종 CI/배포는 별도로 남는다.
- 이번 단계에서 commit/push는 하지 않았다. 모든 작업과 검증 완료 후에만 실행한다.

## API 근거

2026-10-28 [WHATWG Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html), [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [Storage.setItem](https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem)을 확인했다. 저장 접근 자체가 거부될 수 있으며, 한 키 쓰기 실패 시 새 값이 적용되지 않는다. 여러 키를 하나의 트랜잭션으로 취급하지 않는다.
