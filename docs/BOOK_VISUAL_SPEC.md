# Book visual specification — v2.1 / V02

Status: provisional implementation specification, not a complete rendered-product acceptance result. V01 source audit and fresh baseline checks are recorded in REUSE_MAP.md, REQUIREMENTS_TRACE_V2.md, BUILD_STATUS_V2.md and the task's evidence/baseline. V04 implementation and one desktop open/close observation exist; full CI01–03 responsive and intermediate-frame evidence is still pending. No product G1 claim is made.

## Geometry and source artwork

The original supplied cover is a one-page PDF-compatible Illustrator file (595.276 by 841.89 pt). It was downloaded directly from the specified Drive ID, preserved outside the repository, and rasterized using Poppler to a new 1273 by 1800 PNG after an interrupted first render. Full pixel decode and visual inspection succeeded. The original title, logo, illustration, frame and aspect ratio are intact. Source SHA256 is 6767fd48643a4f78e561ab1a051c92bcf64fa604826cce59515d0fe2d6414dd8. No original Every Joule asset is used.

Front-cover width is 3 world units; height is 3 * 841.89 / 595.276. Front-face geometry has exactly this ratio. Paper width/height are derived by subtracting a small uniform cover overhang, not by expanding an identically sized cover around paper. Back cover and spine have no supplied artwork and use a quiet blue-grey solid colour. The front cover is a rigid slab on the spine hinge. A neutral background and contact shadow are the only objects outside the book.

Book lies in XZ, Y is up, spine is Z. The closed front cover extends from hinge X=0 toward positive X. The open book occupies both sides of X=0. Turning front/back faces have distinct printed pages and UV orientation. Normals, thin paper edge and depth-tested shadows convey curvature. Page deformation reuses a 24 by 4 grid initially; quality is evaluated in actual WebGL.

## Camera and first paint

Use an orthographic camera with fixed reading direction near (0,10,5), subject to actual readability/turn-bounds inspection. Cover idle and spread idle use the same quaternion. Intro interpolates position and target from a visibly different, already-in-bounds pose over an initial proposed 1100 ms. This is an authored token, not an observed original timing. A static CSS closed-book image appears before Three's lazy import resolves; loading/error/skip controls belong to that surface.

Place loading, open and skip hints only in clear space inside the cover without covering its title, logo, illustration or frame. The semantic open button, cover hit area, Enter and Space dispatch the same OPEN_BOOK command after the common guard. An intro tap/skip is consumed only as skip; it must not open the book on the same pointer release.

The true front-cover UV centre is projected to the actual visual viewport centre with <=2 CSS px settled error. Safe-area plus 12 CSS px margins constrain every body bound, including cover thickness, spine, stacks and attached bookmarks. Fit increases view span without moving the target toward an asymmetric safe-area centre. Open fit includes the rigid-cover opening and leaf apex envelope; page dragging never rotates/reframes the camera. OPEN/CLOSE joins cover and camera completion before input or scene entry.

Convert the canvas client rect, projected cover UV centre and visualViewport offsets into the same CSS-pixel coordinate system before comparing with T=(visualViewport.width/2, visualViewport.height/2). Record the offsets and scroll/address-bar condition with the measurement. BookRoot/spine origin and the average projected corner position are not substitutes for the projected UV centre.

Fixed A4 shape and full-turn height can make the older suggested 88–94% horizontal occupation impossible in short landscape viewports. Preserve aspect ratio and full bounds; report measured occupancy, never stretch the cover to meet an incompatible percentage.

Resize starts from the current pose. Active drag cancels to its committed spread before reframing. Browser/pinch zoom must be preserved rather than counteracted by fit; focused input must not trigger whole-book shrink. Test 844x390, 667x375, 568x320, 390x844, 360x640 and asymmetric safe-area. These are future verification cases, not current passes.

## Page composition

- Spread 1 left: quiet running header, lesson question, two exact VexFlow score rows, compact reading text. Right: two duration lanes emerging above the paper, separate on-page listen buttons, stop, active-lane meaning and short question controls. Both real lane datasets retain C4/4/4/90 BPM and exact timing.
- Spread 2 left: question and current exact notation; right: one selectable duration strip, split/merge/undo/redo and an accessible event selection list. At small sizes, page-local scroll and an on-page reading enlargement preserve readable text and >=44 CSS px targets.
- Stable semantic DOM uses the projected four paper corners, not an arbitrary bounding rectangle. A fixed orthographic direction permits an exact affine mapping for flat pages. During turns DOM is hidden/inert and replaced by same-revision print textures. The right-page live content reserves a clear region for the 3D scene.
- Previous/next bookmarks attach to outer page edges. Corner grab areas remain separate and include upper/lower corners. Buttons own their pointer before page drag. First previous closes; last next is disabled. Keyboard uses identical commands and respects fields/sliders/modal/instrument ownership.
- Bookmark accessible names are “이전 펼침면” and “다음 펼침면”; the first spread's previous name is “표지로”. Closed/occluded controls are absent from hit testing and the tab order. The last next control is aria-disabled and sends no out-of-range command.
- Settings and reading views are book paper/flaps with semantic focus management. There is no normal external top nav, HUD, toast or playback bar. 2D and reduced-motion preserve the same data and commit semantics.

## Motion tokens and evidence

Initial authored values: intro 1100 ms; rigid cover 1000 ms; button leaf 1120 ms; first scene entry 600 ms; revisit entry 200 ms; button scene exit 180 ms. All easing is monotonic. Direct drag maps pointer to current paper progress immediately, with scrubbable early scene exit; it never waits for the 180 ms button-exit timer. Holding/reversing/cancelling must be continuous. The coordinator owns cancellation and commit; renderer animation never changes lesson data.

V04 must show cover 0/25/50/75/100%, V05 distinct front/back and curved p=0/.25/.5/.75/1, V06 stale-owner cleanup, V07 actual music, and V08/G1 the connected sequence with numerical projection evidence. No static image or CPU test substitutes for those runs.

CI01–03 begin at V04, not only at V08/G1: capture visible intro movement, true centre/bounds, the required responsive conditions, skip/reduced-motion/hide/load-failure recovery and no duplicate OPEN. A single desktop settled-centre result or open/close observation does not complete these cases. Use the pending matrix in qa/BOOK_EXPERIENCE_GATE.md.

## Official implementation references checked

- https://threejs.org/docs/pages/BufferGeometry.html — reusable attributes, normals, bounds and groups.
- https://threejs.org/docs/pages/OrthographicCamera.html — fixed projection, span and projection-matrix updates.
- https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture — pointer ownership through release/cancel.

Keep installed Three 0.186.1 and React 19.2.5. No R3F, GSAP, XState or WebGPU migration is required.
