# R2 종이·조명·환경·후처리 — 캡처

before = [R1 after](../R1/after/) (같은 viewport·상태). after = 이번 단계(`?quality=high`: GTAO·SMAA·비네트·Output). 생성: `node scripts/refactor-capture.ts --stage R2 --phase after --renderer ink --quality high`.

| viewport | 상태 | 티어 | draw calls | 종이 음영 폭(%) | 바깥→거터(%) | far/near | 책 폭 | 파일 |
|---|---|---|---|---|---|---|---|---|
| 1280x720 | cover | high | 87 | – | – | – | 0.4214 | [1280x720_cover_ink.jpg](after/1280x720_cover_ink.jpg) |
| 1280x720 | opening50 | high | 87 | – | – | – | 0.2763 | [1280x720_opening50_ink.jpg](after/1280x720_opening50_ink.jpg) |
| 1280x720 | spread1 | high | 114 | 4.43 | -1.87 | 0.8469 | 0.6251 | [1280x720_spread1_ink.jpg](after/1280x720_spread1_ink.jpg) |
| 1280x720 | turn50 | high | 99 | 25.63 | 13.57 | 0.8469 | 0.6251 | [1280x720_turn50_ink.jpg](after/1280x720_turn50_ink.jpg) |
| 1280x720 | spread2 | high | 93 | 4.55 | -2.52 | 0.8469 | 0.6251 | [1280x720_spread2_ink.jpg](after/1280x720_spread2_ink.jpg) |
| 1280x720 | 2d | high | 93 | – | – | – | 0.6251 | [1280x720_2d_ink.jpg](after/1280x720_2d_ink.jpg) |
| 844x390 | cover | high | 87 | – | – | – | 0.3357 | [844x390_cover_ink.jpg](after/844x390_cover_ink.jpg) |
| 844x390 | opening50 | high | 87 | – | – | – | 0.2202 | [844x390_opening50_ink.jpg](after/844x390_opening50_ink.jpg) |
| 844x390 | spread1 | high | 87 | 4.7 | -2.26 | 0.8506 | 0.4989 | [844x390_spread1_ink.jpg](after/844x390_spread1_ink.jpg) |
| 844x390 | turn50 | high | 99 | 8.16 | 2.14 | 0.8506 | 0.4989 | [844x390_turn50_ink.jpg](after/844x390_turn50_ink.jpg) |
| 844x390 | spread2 | high | 87 | 5.27 | -2.95 | 0.8506 | 0.4989 | [844x390_spread2_ink.jpg](after/844x390_spread2_ink.jpg) |
| 844x390 | 2d | high | 87 | – | – | – | 0.4989 | [844x390_2d_ink.jpg](after/844x390_2d_ink.jpg) |
| 390x844 | cover | high | 87 | – | – | – | 0.8931 | [390x844_cover_ink.jpg](after/390x844_cover_ink.jpg) |
| 390x844 | opening50 | high | 87 | – | – | – | 0.612 | [390x844_opening50_ink.jpg](after/390x844_opening50_ink.jpg) |
| 390x844 | spread1 | high | 87 | 29.09 | -23.13 | 0.9377 | 0.8835 | [390x844_spread1_ink.jpg](after/390x844_spread1_ink.jpg) |
| 390x844 | turn50 | high | 99 | 34.82 | -13.08 | 0.9377 | 0.8835 | [390x844_turn50_ink.jpg](after/390x844_turn50_ink.jpg) |
| 390x844 | spread2 | high | 87 | 30.21 | -24.91 | 0.9377 | 0.8835 | [390x844_spread2_ink.jpg](after/390x844_spread2_ink.jpg) |
| 390x844 | 2d | high | 87 | – | – | – | 0.8835 | [390x844_2d_ink.jpg](after/390x844_2d_ink.jpg) |

- 종이 음영 폭 = 네 인쇄 여백 표본(왼쪽 바깥·왼쪽 거터·오른쪽 거터·오른쪽 바깥)의 (최대−최소)/최대. 설계서 §3.1 목표 3–8%.
- 바깥→거터 = (바깥 평균 − 거터 평균)/바깥 평균. 광원이 왼쪽 위에 있어 오른쪽 거터가 빛을 향하므로 정지 상태에서는 음수(거터가 더 밝음)가 나온다.
- 390×844의 큰 음영 폭은 좁은 쪽에서 표본점이 과도기 HTML 글자·버튼에 걸린 결과다(R3에서 인쇄 텍스처로 바뀐 뒤 재측정).
- 표지 색 변화: 같은 원근 기하(R1 after 대비)에서 표지 중앙 영역 평균색 ΔE76 3.78, 상단 영역 4.05 (목표 ≤ 6). 측정 도구는 PIL 평균색 비교.
