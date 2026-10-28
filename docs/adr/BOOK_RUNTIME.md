# V03: pure book coordinator on the existing Three runtime

Status: implementation and focused state tests; no WebGL, touch, audio or G1 acceptance claim.

## Decision

Keep React 19.2.5 and Three 0.186.1 already locked in this repository. A pure TypeScript reducer is sufficient for the small, explicit G1 transition graph. Do not add XState, R3F, GSAP, another renderer or a dependency migration. Book phase, camera, scene lifecycle and transport status are separate fields; musical values remain in the existing Lesson domain.

`src/book/manifest.ts` owns the two G1 spreads, their scene IDs and four printed page IDs. The physical forward leaf is page-2 on its front and page-3 on its back; backward traversal retains those faces. Page-1 and page-4 are the stationary surfaces. Numeric index helpers are derived from this one manifest. Expand its types and entries only after G1-A/B has actual runtime evidence.

## Runtime contract

Use `createBookState`, `bookReducer`, `bookToken` and `bookCanInteract`. Every asynchronous callback carries the exact `{bookEpoch,navigationToken,sceneInstanceId}` captured when its operation began. Never replace an old callback's token with a fresh one to force acceptance. The runtime owns AbortControllers and must abort obsolete work; the reducer also rejects stale results, including unabortable completion callbacks.

The runtime owns timers/RAF, real audio, GPU objects, validated lesson snapshots and resource disposal. An accepted NEXT/PREV/drag/CLOSE/hide/fallback/error must synchronously stop the actual AudioEngine and future scheduled sources. Reducer transport status alone does not stop physical sound. New scene resources must replace/dispose the prior owner before sending SCENE_READY. Timeout is failure, not a completion event.

- Boot: BOOT_READY with matching token and prepared first-spread content, START_INTRO, INTRO_SETTLED. Reduced-motion and 2D boot directly at the same closed endpoint. SKIP_INTRO consumes its input ID; OPEN_BOOK from the same pointer/key input is rejected. A distinct explicit input opens.
- Open: OPEN_BOOK starts one cover/camera transition. COVER_COMPLETE and CAMERA_COMPLETE form a join barrier. Only afterward does scene become entering, with a new scene instance. SCENE_READY enables learning.
- Button/keyboard turn: NEXT/PREV → preparingTurn (snapshot/audio stop/scene exit/print preparation) → TURN_PREPARED → turningForward/turningBack → TURN_COMPLETE → settling → SETTLED (one currentSpreadId commit/new scene instance) → SCENE_READY.
- Direct turn: TURN_DRAG_START requires prepared surfaces and an external page-edge owner. TURN_DRAG_MOVE supplies measured progress and current sample immediately, including during preparation; the scene runtime scrubs exit in the low-progress interval. Held gestures reject time-driven TURN_PROGRESS/TURN_COMPLETE. TURN_RELEASE stores one decision. Release while preparation is pending enters settling when prepared, never reactivates the pointer. Inactive/unactivated taps cancel. TURN_CANCEL invalidates outstanding callbacks immediately; runtime obtains the new token for reverse settling. SETTLED restores the committed spread on cancel.
- Close: CLOSE_BOOK has priority over pending next/prev. It restores the committed spread, releases gesture ownership and starts scene exit. Send SCENE_EXITED before beginning the rigid cover/reframe animation. COVER_COMPLETE plus CAMERA_COMPLETE commit coverIdle only after scene disposal. No auto-open or autoplay occurs afterward.
- Queue: at most one last valid next/prev intent. Evaluate against the pending destination and again after actual commit. Invalid next at the last spread does not overwrite an already valid previous intent. Pending intent drains only when the destination scene is ready. The first previous closes the cover.
- Hide/context loss: retain `currentSpreadId` and stable `isOpen`, clear previews/gesture/queue, invalidate epoch and owners, stop audio. SHOW_DOCUMENT settles the endpoint without playback. WEBGL_LOST/USE_2D preserve the same open/closed reading state. RETRY_3D rebuilds the renderer from the last committed spread via guarded BOOT_READY. No runtime objects are serialized.

`SET_REDUCED_MOTION` changes the preference only. The caller shortens or skips animation and sends the same completion events, preserving commit semantics. Samples and geometry progress are input data, not the musical clock. Source-specific pointer ownership, pinch, hotkey exceptions, cancellation on orientation, focus restoration, 44px targets, rendering and listening must be implemented and verified in later steps.

## Validation boundary

Focused tests cover manifest front/back, intro consumption, cover/camera join, commit timing, bounded queue, reversal, early drag release/cancel, stale callbacks, close priority, hide/fallback, transport ownership, retries and 2D/reduced-motion equivalence. These are CPU state tests. They are not evidence of a curved page, WebGL availability, real Web Audio timing, actual touch, listening or G1 completion.

Reference: locally read design v2.1 sections 8–10 and 15–16; prompt v2.1 V03; repository BOOK_VISUAL_SPEC and reference/MOTION_REFERENCE. Existing music regression expectations remain unchanged.
