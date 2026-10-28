# First-preview manual corner check

Prepared 2026-10-28 14:09 UTC. This is a procedure, **not a passing result**.

The existing dev server is responding at http://127.0.0.1:4183/. The retained IAB tab is at spread 1, spreadIdle, scene ready, prints ready, turn null and active audio sources 0. Its temporary viewport overrides were reset to the normal1280x720 view. Other browsers may start at the cover; choose the first-page browsing action after the cover settles.

## User actions and expected results

1. Confirm the first spread heading is `같은 끝, 다른 시작`. Use the lower right paper-edge gutter, below the right-arrow bookmark. In the prepared1280x720 view the44px hit area is x1000-1044, y613-657; its center is approximately(1022,635). Coordinates are only for this prepared view.
2. Hold the mouse button and pull left slowly. Stop around a quarter and then halfway through the turn. Keep holding still for about2seconds. The curved page must stay at the held position and must not automatically finish the turn. No hand model is expected.
3. While still holding, move back toward the original right edge, then release near that edge. This must cancel the turn, retain spread1, restore its scene and controls, and leave sound stopped.
4. Grab the same corner again, pull deliberately past the midpoint, then release. It must settle at spread2, `절반씩 나누기`, with usable notation and editing controls. In this prepared QA profile,16 sixteenth notes were saved; their IDs and count must remain unchanged.
5. Click the left-arrow bookmark to return, then the right-arrow bookmark to revisit. The same edited rhythm must remain and sound must not start automatically.

Report `hold / reverse-cancel / complete / revisit: pass or fail`, together with what happened for a failure. A mid-turn capture and a settled spread2 capture are useful if the user can capture them normally, but no screenshot is required to claim an action the user did not actually perform. This procedure does not verify physical phone touch, assistive technology or actual listening.

## Automation boundary

The attempted localhost25/50percent corner drag with PNG capture returned exactly `JavaScript execution was denied`. No reason or reviewer identity was supplied. Requested drag PNGs do not exist; read-only reattachment found spreadIdle/turn:null. Ordinary page reads, semantic button actions and independent screenshots subsequently worked. This supports reporting the denied request's observed scope; it does not identify its undisclosed cause. No automated pointer movement or alternate drag route has been attempted since the denial. A specific retry-permission question remains pending. If access itself is later refused, stop rather than using this procedure to evade it.

Latest source checks after the separate keyboard-focus repair: `r1-integrated-20261028-140635-summary.json`,257/257, lint/build/typecheck exit0,78 fingerprints unchanged. These checks do not replace this manual result. No commit, push or new deployment has occurred.
