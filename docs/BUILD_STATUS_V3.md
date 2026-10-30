# v3 리팩토링 진행 기록 (BUILD_STATUS_V3)

설계: [REFACTOR_DESIGN_V3.md](REFACTOR_DESIGN_V3.md) · 실행 계약: [IMPLEMENTATION_CONTRACT_V3.md](IMPLEMENTATION_CONTRACT_V3.md) · 개정 조항: [CONTRACT_V3.md](CONTRACT_V3.md) · 캡처 규약: [qa/refactor/README.md](qa/refactor/README.md)

"코드를 작성함", "자동 검사가 통과함", "사람이 승인함"을 구분한다. headless 캡처는 실기기 통과가 아니고, 무음 캡처는 청취 증거가 아니다.

## 단계 지도

| ID | 지도 번호 | 이름 | 상태 |
|---|---|---|---|
| R0 | V3-00 | 계약 개정 | 통과 |
| R1 | V19 | 원근 카메라 리그 | 미착수 |
| R2 | V20 | 종이·조명·환경·후처리 | 미착수 |
| R3 | V21 | 캔버스 페이지 인쇄 시스템 | 미착수 |
| R4 | V22 | 잉크 그림 시스템 + 음가 그림 | 미착수 |
| R5 | V23 | 조작부 재배치 | 미착수 |
| R6 | V24 | 레슨 카메라 연출(샷) | 미착수 |
| R7 | V25 | 효과음·마감 | 미착수 |
| R8 | V26 | 콘텐츠 확장(목차·마침·GO_TO) | 미착수 |
| R9 | V27 | 검증 관문 개편·정리 | 미착수 |

v2.1 단계 지도와의 대응: R1→V19, R2→V20, R3→V21, R4→V22, R5→V23, R6→V24, R7→V25, R8→V26, R9→V27. v2 기록은 [BUILD_STATUS_V2.md](BUILD_STATUS_V2.md)에 그대로 있다.

## 보고 양식

~~~text
단계 ID와 상태: 통과 / 실패 / 일부 완료 / 외부 검수 대기
실제로 가능한 사용자 행동:
변경 경로와 이유:
실행 명령과 종료 결과:
기기와 브라우저 및 commit:
실제 캡처 영상 로그 경로:
미실행 항목과 정확한 이유:
남은 결함과 재현 절차:
객관적 게이트와 선택적 사용자 피드백 상태:
다음 허용 단계와 막힌 단계:
전후 캡처 경로와 metrics.json 요약:
renderer 플래그 상태:
설계서 대비 편차와 사유:
G1-C 체크리스트(부록 B) 영향 항목과 현재 판정:
~~~

---

## R0 (V3-00) 계약 개정 — 통과

- **단계 ID와 상태:** R0 통과(문서 단계, 자체 승인).
- **실제로 가능한 사용자 행동:** 변화 없음. 앱 코드는 바뀌지 않았다.
- **변경 경로와 이유:** `docs/REFACTOR_DESIGN_V3.md`, `docs/REFACTOR_PROMPTS_V3.md`(설계서·프롬프트 사본), `docs/CONTRACT_V3.md`(C1–C12, 결정 기록, 착수 편차 B1–B5, 불변식 검사 위치), `docs/IMPLEMENTATION_CONTRACT_V3.md`(P00 원문), `docs/BUILD_STATUS_V3.md`(이 파일), `docs/qa/refactor/README.md`(캡처 규약). `docs/BUILD_STATUS_V2.md` 끝에 이어짐 안내 한 줄.
- **실행 명령과 종료 결과(세션 시작 baseline, 착수 커밋 `5f2f7bb`):** `npm ci --ignore-scripts` 성공(EBADENGINE 경고: Node 22.23.4). `npm run typecheck` exit 0, `npm run lint` exit 0, `npm test` 288/288 통과(실패·skip 0), `npm run build` exit 0(main 청크 1,097.50 kB, 500 kB 초과 경고 기존 그대로).
- **기기와 브라우저 및 commit:** Linux 컨테이너, Node 22.23.4, npm 10.9.9. 브랜치 `refactor/v3-ink-book`.
- **실제 캡처 영상 로그 경로:** 없음(문서 단계).
- **미실행 항목과 정확한 이유:** Node 24.14.0 로컬 실행은 컨테이너에서 바이너리를 받을 수 없어 미실행. push 후 GitHub Actions 결과로 대신 기록한다.
- **남은 결함과 재현 절차:** 없음.
- **객관적 게이트와 선택적 사용자 피드백 상태:** 결정 6항목은 사용자 위임에 따른 자체 승인. 6번(원본 녹화)은 미제공.
- **다음 허용 단계와 막힌 단계:** R1 허용.
- **전후 캡처 경로와 metrics.json 요약:** 해당 없음.
- **renderer 플래그 상태:** 아직 없음(R1에서 도입).
- **설계서 대비 편차와 사유:** CONTRACT_V3 §3 B1–B5.
- **G1-C 체크리스트 영향 항목과 현재 판정:** 13항목 모두 미판정(R9).
