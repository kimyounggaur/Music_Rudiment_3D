# V10 — 버전이 분리된 책 기록과 원문 보존

2026-10-28 UTC. 상세 설계서16절과 프롬프트 V10의 저장/이관 계약을 적용한다. 기존 `src/persistence/progress.ts`와 v1 테스트는 변경하지 않는다. 새 `bookProgress.ts`가 엄격한 v2 schema 및 저장 작업을 담당하고, `learningProgress.ts`는 검증된 lesson과 저장 데이터 사이만 연결한다.

## 저장 형식과 복원

`progressSchemaVersion:2`, `bookUiVersion:'2.1.0'`, `lessonSchemaVersion:'2.0.0'`, `contentVersion:'1.0.0'`을 구별한다. 허용 top-level/설정/장면 metadata 필드만 받는다. 공통 음악 데이터는 기존 v1 validator에 명시적으로 투영하여 검증하고, 참조 레인 불변·scene2 전체 길이·scene별 허용 편집·질문/선택지/관찰 레인을 추가 확인한다. 잘못된 답안 key를 silently drop하여 성공 처리하지 않는다. 정답이 아닌 유효 선택이나 아직 완성되지 않은 draft는 그대로 학습 데이터다.

저장하는 값은 마지막 확정 spread, 전체 여섯 장면의 draft/답안/관찰 기록, 지원 수준, attempts/hints, 장면별 tempo, 현재/과거 성취와 사용자 mode/reduced-motion/mute/volume 선호다. 음량 범위는 v1과 같은0–1이다. 새 hook/UI가 마지막 확정 spread와 명시적 선호만 capture에 넘긴다. pause offset·transport·pointer·전이 progress·timer·RAF·Promise·DOM·GPU·AudioNode·undo/redo 이력은 저장하지 않는다.

현재 성취는 매 검증/복원 시 실제 lesson 조건으로 재계산한다. 과거 `ever`는 보존하고 새 성공과 OR하지만 현재 정답을 대신하지 않는다. v1에는 과거 성공 이력이 없으므로 이관 시 확인 가능한 현재 성취에서 시작한다. v1에 저장되지 않았던 tempo는 기존 장면 기본값을 사용한다. v2는 scene5의60/120 및 다른 장면의90을 저장한다. 복원 상태는 UI가 직접 적용한다. 기존 reducer의 legacy restore serializer는 tempo를 저장하지 않으므로 이 새 경로에서 경유하지 않는다.

attempts/hints는 기존 validator의 bounded numeric map을 보존한다. 이전 기록의 보조 count key를 삭제하지 않는다. 이 map은 코드를 실행하거나 점수를 부여하지 않으며, 현재 UI는 알려진 질문/힌트 key만 소비한다. 새 질문/대체 설명 플랩의 open 상태는 `scene-N/questions`, `scene-N/alternative`의0/1로 표현할 수 있다. 과거 `observedLanes:'listened'`는 원래 기록의 provenance를 유지할 뿐, 이 작업에서 실제 청취를 새로 검증했다는 뜻이 아니다.

저장 매핑은 scene1–6 ↔ spread1–6을 명시한다. 실행 BOOK_MANIFEST가 아직1–2만 제공하더라도3–6의 원문·draft·위치를 자르거나2로 clamp하지 않는다. UI는 지원되지 않는 위치를 안내하고 자동 저장을 막으며, 첫 페이지 둘러보기는 기존 기록 삭제나 미래 위치의 묵시적 덮어쓰기가 아니다. 새 진입/복원도 닫힌 표지에서 시작하고 사용자 선택 뒤 정상 entry, 정지 상태로 연다.

## 키와 이관 순서

| 역할 | 키 |
|---|---|
| 기존 v1 원본 | `music-theory-lab:duration-basics:progress` |
| 기존 v1 backup | 위 키 + `:backup` |
| v2 primary | 위 v1 원본 키 + `:book-v2` |
| 이관/가져온 v1 원문 backup | 위 v1 원본 키 + `:v1-source-backup` |
| 명시적 v2 교체 직전 원문 backup | v2 primary 키 + `:backup` |

load는 v2 primary를 먼저 읽는다. 있으면 v2만 검증하며, 손상/미래 버전이라고 v1로 자동 덮어쓰지 않는다. v2가 없을 때만 정확히 지원하는 v1을 검증·의미 복원하고, **공백까지 동일한 원문 backup → 원본/새 키 재확인 → v2 새 키 쓰기 → 성공 상태 반환** 순서로 이관한다. 기존 v1 원본은 삭제하거나 수정하지 않는다. 정상 v2가 생긴 뒤 같은 load를 다시 해도 이관 쓰기를 반복하지 않는다. 백업을 자동 복구하여 삭제한 학습을 되살리지 않는다.

v1-source-backup은 불변이다. 다른 원문이 이미 있으면 `BACKUP_CONFLICT`로 이관/다른 v1 import를 멈추고 원문 내보내기와 명시적 앱 기록 삭제 후 재시도를 안내한다. v2 replacement backup도 기존 primary와 다른 원문이 있으면 `IMPORT_BACKUP_CONFLICT`로 보호한다. 동일한 backup은 재사용한다. 기존 정상 backup을 손상된 primary로 먼저 바꾸었다가 뒤의 primary 쓰기가 실패하면 정상 사본을 잃으므로, rollback에 기대지 않고 충돌 시 쓰기 전 멈춘다. 다음 다른 import는 현재 기록과 백업을 내보낸 뒤 명시적으로 앱 기록을 삭제하고 가져오는 절차를 안내한다.

## 실패와 사용자 확인

`loadBookProgress`는 empty/loaded/migrated/blocked와 정확한 v2 `raw`, 관련 v1 `legacyRaw`, 오류 및 `canSave`를 반환한다. 읽기/backup/새 키 쓰기 실패나 의미 복원 실패는 blocked이고 UI의 메모리 학습을 막지 않는다. 손상된 원문은 그대로 내보낼 수 있고, 검증된 현재 임시 학습도 별도로 내보낼 수 있다. 이관 중 backup만 성공했다면 그 backup과 v1 원본은 남고 성공한 이관으로 표시하지 않는다.

`readBookBackups`는 위 세 backup 키의 원문만 읽어 내보내기 UI에 제공한다. 손상/이전 형식도 해석하거나 수정하지 않는다. backup 충돌 안내에서 primary 원문뿐 아니라 실제 보존된 backup을 내보낼 수 있어야 한다. 읽기 실패는 해당 키의 `BACKUP_READ` 오류이며 삭제를 권하지 않는다.

자동 저장은 새 값 검증 후 현재 primary가 마지막에 읽은 `expectedRaw`와 같은지 확인한다. 손상 primary는 일치하더라도 `STORAGE_PROTECTED`로 거부한다. v1이 있는데 v2가 없는 상태는 먼저 이관을 확인하도록 막는다. 다른 창의 관측 가능한 변경은 `STORAGE_CONFLICT`다. 이 비교는 best-effort이며 다중 키/다중 탭 트랜잭션이나 잠금이라고 주장하지 않는다.

가져오기는 parse/미리보기만으로 쓰지 않는다. 명시적 commit에서 sourceRaw를 다시 파싱하고 canonical progress와 비교하여 변조된 preview를 거부한다. 현재 primary의 CAS를 확인하고 필요한 원문 backup을 쓴 뒤 다시 primary를 확인하여 교체한다. 이 명시적 경로만 손상/미래 v2 primary를 교체할 수 있다. 실패하면 기존 primary를 바꾸지 않고 이유를 반환한다. 지원하지 않는 버전을 임의 추정하여 변환하지 않는다.

전체 삭제는 위 다섯 앱 키만 각각 제거하고 다른 origin/app 키를 건드리지 않는다. 하나라도 실패하면 부분 삭제 오류로 반환하며 UI는 새 학습자로 초기화됐다고 주장하지 않는다. 완전 성공 이후에만 메모리와 자동 저장 상태를 초기화한다. 처음부터 둘러보기, 한 장면 초기화, 전체 로컬 삭제의 범위를 UI에서 구별한다.

[WHATWG Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html)의 setItem 실패 처리와 [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [setItem](https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem)을 확인한 상위 검토에 따라 getter SecurityError와 쓰기 QuotaExceededError를 처리한다. 한 키의 setItem 성공/실패 계약을 여러 키의 원자성으로 확대하지 않는다. 로그인·서버 동기화·분석·개인 식별·녹음·URL history는 추가하지 않는다.

## 검증 범위

별도 단위 검사는 정확한 v1 원문 및 여섯 위치 이관, 백업/쓰기/읽기 실패, 기존 v2 우선, 손상/미래 버전 보호, CAS, preview 변조, 명시적 교체, 분할/답안/tempo 복원, current/ever 분리, 앱 전용 삭제를 포함한다. 실제 새로고침·이어 펼치기·전이 중 저장 억제·저장 오류 UI는 실제 브라우저 증거와 함께 따로 판정한다. 과거 V09 통과를 V10 통과로 승계하지 않는다.

최종 코어 집중 검사는 기존 persistence12개와 새 book-progress36개, **48/48** 통과했다. source/test 범위 ESLint와 분리된 strict TypeScript 검사도 exit0이다. [집중 검사 요약](../../output/qa-v2.1/v10-persistence-focused-20261028-072643-summary.json)에 실제 로그·빈 출력 파일·SHA256을 보존했다. 기존 정상 backup + 손상 primary + primary 쓰기 실패 fixture는 `IMPORT_BACKUP_CONFLICT`와 쓰기0회로 두 원문이 모두 보존됨을 확인한다. v1 preview도 기존 v2 backup 충돌을 먼저 검사하여 적용하지 않은 import가 새 원문 backup 자리를 예약하지 않는다. 동일 backup 재사용, 세 backup의 읽기 전용 원문 내보내기, scene별 불가능한 편집 거부와 오답인 유효 draft 보존을 함께 검증했다.
