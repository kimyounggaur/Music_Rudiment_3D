# 음악 규칙과 실제 검증

정본은 기약분수{n,d}, 온음표=1. BigInt 내부 연산 뒤 안전한 JSON 정수 범위로 반환한다. 분모0·잘못된 값·overflow를 거부하며 float epsilon을 정답에 쓰지 않는다. duration양수/onset0이상, 연산 차이는 음수 가능하다.

seconds=(duration/tempo.unit)*60/bpm. 4/4=1, 90에서 한 마디8/3초, 아래4분어택0·2/3·4/3·2초. 60/120에서는4초/2초, 온:4분 비율4:1. rest는 시간을 유지하고 source0개다. 오디오 envelope는 다음 쉼표를 침범하지 않는다.

pitch는 step/alter/octave. C4=MIDI60, alter는 최종 유효값이며 조표를 다시 더하지 않는다. C→D# 증2도/C→Eb 단3도. MIDI/frequency는 파생값. 하행·복합 등 미지원 음정 범위는 typed error. 점4분3/8, 셋잇단8분1/12는 엔진 테스트이며 화면 단원 확장이 아니다.

장면3 C와 장면6 음가 종류는 기약분수 duration 집합으로 센다. 음표와 같은 길이 쉼표는 같은 음가 종류다. 장면6은 합1·종류2이상·rest1이상+설명 자기확인. 현재 성공은 편집/undo마다 재계산한다.

검증: domain25, lesson25, audio18 테스트와 콘텐츠검증. tests/의 고정 기대값과 불변식을 참조한다. 실제 기보·청취·음악교육자 승인과 분리한다.

