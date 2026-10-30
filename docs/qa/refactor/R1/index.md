# R1 원근 카메라 리그 — 캡처

before = `?renderer=legacy`(착수 커밋 `5f2f7bb`의 고정 사본), after = 새 경로(원근). 같은 viewport·상태·입력. 생성: `node scripts/refactor-capture.ts --stage R1 --phase {before|after} --renderer {legacy|ink}` (로컬 dev 서버, headless Chromium 1243 + SwiftShader, DPR 1).

| phase | viewport | 상태 | far/near | 책 폭 비율 | 표지 중앙 오차(px) | 오른쪽 쪽 높이(px) | 파일 |
|---|---|---|---|---|---|---|---|
| before | 1280x720 | cover | – | 0.4037 | 0 | – | [1280x720_cover_legacy.jpg](before/1280x720_cover_legacy.jpg) |
| before | 1280x720 | opening50 | – | 0.2778 | – | – | [1280x720_opening50_legacy.jpg](before/1280x720_opening50_legacy.jpg) |
| before | 1280x720 | spread1 | 1 | 0.6396 | – | 473.89 | [1280x720_spread1_legacy.jpg](before/1280x720_spread1_legacy.jpg) |
| before | 1280x720 | spread2 | 1 | 0.6396 | – | 473.89 | [1280x720_spread2_legacy.jpg](before/1280x720_spread2_legacy.jpg) |
| before | 1280x720 | 2d | – | 0.6396 | – | – | [1280x720_2d_legacy.jpg](before/1280x720_2d_legacy.jpg) |
| before | 844x390 | cover | – | 0.3219 | 0 | – | [844x390_cover_legacy.jpg](before/844x390_cover_legacy.jpg) |
| before | 844x390 | opening50 | – | 0.2216 | – | – | [844x390_opening50_legacy.jpg](before/844x390_opening50_legacy.jpg) |
| before | 844x390 | spread1 | 1 | 0.5101 | – | 249.2 | [844x390_spread1_legacy.jpg](before/844x390_spread1_legacy.jpg) |
| before | 844x390 | spread2 | 1 | 0.5101 | – | 249.2 | [844x390_spread2_legacy.jpg](before/844x390_spread2_legacy.jpg) |
| before | 844x390 | 2d | – | 0.5101 | – | – | [844x390_2d_legacy.jpg](before/844x390_2d_legacy.jpg) |
| before | 390x844 | cover | – | 0.8943 | 0 | – | [390x844_cover_legacy.jpg](before/390x844_cover_legacy.jpg) |
| before | 390x844 | opening50 | – | 0.6032 | – | – | [390x844_opening50_legacy.jpg](before/390x844_opening50_legacy.jpg) |
| before | 390x844 | spread1 | 1 | 0.885 | – | 199.78 | [390x844_spread1_legacy.jpg](before/390x844_spread1_legacy.jpg) |
| before | 390x844 | spread2 | 1 | 0.885 | – | 199.78 | [390x844_spread2_legacy.jpg](before/390x844_spread2_legacy.jpg) |
| before | 390x844 | 2d | – | 0.885 | – | – | [390x844_2d_legacy.jpg](before/390x844_2d_legacy.jpg) |
| after | 1280x720 | cover | – | 0.4198 | 0 | – | [1280x720_cover_ink.jpg](after/1280x720_cover_ink.jpg) |
| after | 1280x720 | opening50 | – | 0.2763 | – | – | [1280x720_opening50_ink.jpg](after/1280x720_opening50_ink.jpg) |
| after | 1280x720 | spread1 | 0.8468 | 0.6251 | – | 437.94 | [1280x720_spread1_ink.jpg](after/1280x720_spread1_ink.jpg) |
| after | 1280x720 | spread2 | 0.8468 | 0.6251 | – | 437.09 | [1280x720_spread2_ink.jpg](after/1280x720_spread2_ink.jpg) |
| after | 1280x720 | 2d | – | 0.6251 | – | – | [1280x720_2d_ink.jpg](after/1280x720_2d_ink.jpg) |
| after | 844x390 | cover | – | 0.3345 | 0 | – | [844x390_cover_ink.jpg](after/844x390_cover_ink.jpg) |
| after | 844x390 | opening50 | – | 0.2202 | – | – | [844x390_opening50_ink.jpg](after/844x390_opening50_ink.jpg) |
| after | 844x390 | spread1 | 0.8505 | 0.4989 | – | 230.68 | [844x390_spread1_ink.jpg](after/844x390_spread1_ink.jpg) |
| after | 844x390 | spread2 | 0.8505 | 0.4989 | – | 230.25 | [844x390_spread2_ink.jpg](after/844x390_spread2_ink.jpg) |
| after | 844x390 | 2d | – | 0.4989 | – | – | [844x390_2d_ink.jpg](after/844x390_2d_ink.jpg) |
| after | 390x844 | cover | – | 0.8912 | 0 | – | [390x844_cover_ink.jpg](after/390x844_cover_ink.jpg) |
| after | 390x844 | opening50 | – | 0.612 | – | – | [390x844_opening50_ink.jpg](after/390x844_opening50_ink.jpg) |
| after | 390x844 | spread1 | 0.9377 | 0.8835 | – | 189.8 | [390x844_spread1_ink.jpg](after/390x844_spread1_ink.jpg) |
| after | 390x844 | spread2 | 0.9377 | 0.8835 | – | 189.67 | [390x844_spread2_ink.jpg](after/390x844_spread2_ink.jpg) |
| after | 390x844 | 2d | – | 0.8835 | – | – | [390x844_2d_ink.jpg](after/390x844_2d_ink.jpg) |
| before | 1280x720 | turn50 | 1 | 0.6396 | – | 473.89 | [1280x720_turn50_legacy.jpg](before/1280x720_turn50_legacy.jpg) |
| before | 844x390 | turn50 | 1 | 0.5101 | – | 249.2 | [844x390_turn50_legacy.jpg](before/844x390_turn50_legacy.jpg) |
| before | 390x844 | turn50 | 1 | 0.885 | – | 199.78 | [390x844_turn50_legacy.jpg](before/390x844_turn50_legacy.jpg) |
| after | 1280x720 | turn50 | 0.8468 | 0.6251 | – | 437.63 | [1280x720_turn50_ink.jpg](after/1280x720_turn50_ink.jpg) |
| after | 844x390 | turn50 | 0.8505 | 0.4989 | – | 230.54 | [844x390_turn50_ink.jpg](after/844x390_turn50_ink.jpg) |
| after | 390x844 | turn50 | 0.9377 | 0.8835 | – | 189.76 | [390x844_turn50_ink.jpg](after/390x844_turn50_ink.jpg) |

held drag(turn50)는 실제 마우스로 오른쪽 아래 모서리를 잡아 끌고 멈춘 상태다(진행도 0.32–0.36, `metrics.json`의 `extra.heldTurn`). opening50은 DEV 전용 `__bookInspector.pose({coverProgress:0.5})` 자세다.
