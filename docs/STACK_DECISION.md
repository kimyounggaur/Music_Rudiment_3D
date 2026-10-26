# 실제 스택과 제약

Node24.14.0/npm11.9.0, React/DOM19.2.5, TypeScript5.9.3, Vite5.4.21, esbuild0.21.5, ESLint9.39.4, Playwright1.60.0, VexFlow5.0.0, Three.js0.186.1, @types/three0.186.0을 사용한다. 최신 버전이라는 주장이 아니라 실제 설치·manifest·lock과 실행으로 확인한 구성이다.

초기 오프라인 단계에서는 기존 정상 로컬 개발 패키지를 읽기 전용으로 복사했다. VexFlow는 정상 pnpm store의 293파일에 대해 원본·복사본 SHA512를 검증하여 확보했다. 이후 사용자의 네트워크 승인을 받아 공식 npm registry로 실제 설치와 lock 정리를 마쳤다. 별도 새 경로의 clean npm ci도 성공했다. 현재 15개 선언과 228개 lock 항목·무결성 확인은 [DEPENDENCY_INSTALL.md](DEPENDENCY_INSTALL.md), [DEPENDENCY_SNAPSHOT.json](DEPENDENCY_SNAPSHOT.json)과 `output/clean-install` 증거를 따른다. 초기 잠정 lock 기록을 현재 clean-install 결과와 혼동하지 않는다.

3D는 실제 Three.js의 가벼운 명령형 WebGLRenderer로 구현했다. React Three Fiber·OrbitControls는 사용하지 않는다. 기존 React 지연 화면에 Three 모듈 지연 로딩을 더하고 공유 Geometry·Material, 두 고정 직교 시점, Raycaster 선택, DPR 최대1.5, 변경 시 그리기를 사용한다. 자동 카메라 이동이나 유휴 렌더 루프가 없다. WebGL2 부재·실제 연결 손실·모듈 로딩 실패는 같은 데이터의 2D로 이어진다. 초기 CSS3D 대체 및 패키지 미확보는 이미 대체된 이력이다. 실제 좌표·카메라·자원 검사 6개와 HTTP WebGL 검사 9개가 통과했다. [Three 검수 기록](qa/Three_REVIEW.md)에 실제 증거와 한계를 구분했다.

정확한 2D 악보는 `vexflow/bravura` entry를 지연 로딩하여 실제 SVG를 그린다. 내장 data-URL 음악·텍스트 글꼴의 로딩을 확인하며 CDN 기본 폰트 로딩을 호출하지 않는다. 프로그램 MIT와 내장 Bravura/Academico/Academico Bold의 OFL 원문을 각각 보존했다. Three·React의 MIT 고지도 `public/licenses`에 있다. 글꼴 실패 시 준비 완료를 표시하지 않고 텍스트·명시적 재시도로 복구한다.

상태 reducer/명령, 정확 Fraction/Pitch domain, runtime 콘텐츠 검증, Web Audio, localStorage envelope, 최소 JSON 교환을 구현했다. SSR·서비스워커·로그인·서버·원격키·분석 추적 없음.

Vite production build와 독립 HTML은 같은 React 소스를 사용한다. 독립 HTML은 esbuild IIFE에 CSS·내장 음악 폰트·Three 코드를 포함하여 file origin에서도 동작한다. Vite HTTP 빌드는 지연 모듈 파일을 사용하므로 두 실행 환경의 module loading·저장·다운로드를 같은 검증으로 취급하지 않는다. 실제 production HTTP 검사도 별도로 실행했다. 최종 빌드 해시와 전체 검사 범위는 [BUILD_STATUS.md](BUILD_STATUS.md)를 따른다.

현재 전체 단위 검사는 기존90개와 실제 Three6개를 합친96개다. 타입·린트·빌드 통과와 실제 브라우저 검사 수는 실행별 결과를 확인한다. clean npm ci 성공만으로 clean 소스 전체 재구축·장기 실기기 성능·배포 완료를 주장하지 않는다. [LOCAL_DEPENDENCIES.md](LOCAL_DEPENDENCIES.md)와 [DEPENDENCY_DIAGNOSIS.md](DEPENDENCY_DIAGNOSIS.md)는 초기 오프라인 확보 이력으로 보존한다.
