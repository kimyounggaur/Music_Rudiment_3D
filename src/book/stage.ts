import {
  Box3, BoxGeometry, Group, LineSegments, Material, Mesh, MeshStandardMaterial, NeutralToneMapping,
  PCFShadowMap, Plane, Raycaster, Scene, SRGBColorSpace, Texture, TextureLoader, Vector2, Vector3, WebGLRenderer,
} from 'three';
import type { BufferGeometry } from 'three';
import { balancedAnchor, createCameraRig, fitDistance, placeRig, READING_POSE } from './render/cameraRig.ts';
import type { FitResult, RigPose } from './render/cameraRig.ts';
import { CLOSED_ANCHOR, closedFramePoints, OPEN_ANCHOR, openFramePoints, SCENE_EXTENT } from './render/bookFraming.ts';
import { createForeEdgeTexture, createPaperMaterial } from './render/paperMaterial.ts';
import { createBookEnvironment } from './render/environment.ts';
import type { BookEnvironment } from './render/environment.ts';
import { createPostPipeline, tierPixelRatio } from './render/postPipeline.ts';
import type { PostPipeline } from './render/postPipeline.ts';
import type { QualityTier } from './profile.ts';
import { figureControlsOf } from './figures/figure.ts';
import { createFlapLayer } from './render/flaps.ts';
import type { StageFlap } from './render/flaps.ts';
import type { FigureStats } from './figures/figure.ts';
import {
  BOOK_DIMENSIONS, createFlatPageGeometry, createSpreadPageGeometry, createStackGeometry, createTurningLeafGeometry, leafProgressFromX, LEAF_THICKNESS,
  spreadAmplitude, spreadHeight, stackHeights, unitProgress, updateSpreadPageGeometry, updateStackGeometry, updateTurningLeafGeometry,
} from './geometry.ts';
import type { BookCorner, BookTurnDirection, SpineSide } from './geometry.ts';

export type StagePoint = { x: number; y: number };
export type StageQuad = { tl: StagePoint; tr: StagePoint; br: StagePoint; bl: StagePoint };
export type StageRect = { left: number; top: number; right: number; bottom: number };
export interface StageLayout {
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  pageWorld: { width: number; height: number };
  left: StageQuad;
  right: StageQuad;
  cover: StageQuad;
  safeRect: StageRect;
  coverUvCenter: StagePoint;
  coverCenterErrorPx: number;
  /** span = visible world height at the anchor distance (kept for the orthographic-era fixtures). */
  camera: { position: number[]; target: number[]; quaternion: number[]; span: number; fov?: number; distance?: number; worldPerPixelAtAnchor?: number };
  bookBounds: StageRect;
  openWidthFraction: number;
}
export interface StageUpdate {
  coverProgress: number;
  introProgress: number;
  currentSpreadIndex: number;
  spreadCount: number;
  turn: { direction: BookTurnDirection; progress: number; corner: BookCorner } | null;
  /** v3 R4: the scene figure's lift (0 = drawn flat on the paper, 1 = standing). */
  sceneProgress?: number;
  /** v3 R4: the pen's progress over the scene figure (0 = nothing drawn, 1 = fully drawn). */
  sceneReveal?: number;
  suspendFit?: boolean;
  inspectionWireframe?: boolean;
}
export interface StageTextures {
  staticLeft: Texture | null;
  staticRight: Texture | null;
  turnFront: Texture | null;
  turnBack: Texture | null;
  /** v3 R3 state layers (selection, playback note, hover, pressed, focus) for the same faces. */
  staticLeftState: Texture | null;
  staticRightState: Texture | null;
  turnFrontState: Texture | null;
  turnBackState: Texture | null;
}
/** A point on the printed page: u from the left edge, v from the top edge (print canvas orientation). */
export type PagePointerHit = Readonly<{ side: 'left' | 'right'; u: number; v: number }>;
export interface StageMetrics {
  renderedFrames: number;
  geometries: number;
  textures: number;
  programs: number;
  contextLost: boolean;
  coverReady: boolean;
  drawCalls: number;
  quality: QualityTier;
}
export interface StageSceneWindow {
  /** Page/world Z units. The book root is untransformed and the scene anchor has Z=0. */
  offsetZ: number;
  minZ: number;
  maxZ: number;
  visible: boolean;
}
export interface BookStage {
  update(next: Partial<StageUpdate>): void;
  setPageTextures(textures: Partial<StageTextures>): void;
  setSceneGroup(group: Group | null): void;
  setSceneWindow(window: StageSceneWindow | null): void;
  pickScene(clientX: number, clientY: number, targets: Mesh[]): Mesh | null;
  /** v3 R5: the spread's paper flaps (page-local rects); a changed `open` lifts or lowers the sheet. */
  setPageFlaps(flaps: readonly StageFlap[], instant?: boolean): void;
  /** DEV: current flap angles in degrees by key. */
  flapAngles(): Readonly<Record<string, number>>;
  /** DEV: pin moving flaps `ms` after they start (null resumes real time). */
  holdFlaps(ms: number | null): void;
  /** v3 R5: the key of a standing (or moving) paper flap under a client point, nearest first. */
  flapAt(clientX: number, clientY: number): string | null;
  /** DEV: client coordinates of a world point (inspection and measurements). */
  projectToClient(point: readonly [number, number, number]): StagePoint | null;
  /** DEV: draw calls of one frame with and without the scene figure (renders twice, then restores). */
  measureSceneDrawCalls(): Readonly<{ total: number; withoutScene: number; scene: number; figure: FigureStats | null }> | null;
  pointerProjection(clientX: number, clientY: number, grabbedOffsetX?: number): { x: number; y: number; z: number; u: number; v: number; turnProgress?: number } | null;
  /** v3 R3: the printed page under a client point (raycast on the curved page meshes), when the book is open and still. */
  pagePointer(clientX: number, clientY: number): PagePointerHit | null;
  /** v3 R3: client coordinates of a page-local point (u right, v down), for inspection and tests. */
  pagePoint(side: 'left' | 'right', u: number, v: number): StagePoint | null;
  getLayout(): StageLayout | null;
  invalidate(): void;
  dispose(): void;
}
interface StageOptions {
  onLayout?: (layout: StageLayout) => void;
  onFailure?: (error: Error) => void;
  onMetrics?: (metrics: StageMetrics) => void;
  coverTexture?: Texture;
  quality?: QualityTier;
}

const D = BOOK_DIMENSIONS;
/** Intro starts slightly farther away and to the side, then settles on the exact cover fit. */
const INTRO_OFFSET = new Vector3(0.3, 0, 0.12);
const INTRO_DISTANCE = 0.16;
/** v3 R2 binding materials: cloth-bound boards, warm paper edges (CONTRACT_V3 C7). */
export const BINDING_TOKENS = Object.freeze({ board: '#55707c', boardRoughness: 0.82, innerBoard: '#e6ddc5', paperEdge: '#e4dac4', coverRoughness: 0.62 });

export function createBookStage(host: HTMLElement, options: StageOptions = {}): BookStage | null {
  const quality: QualityTier = options.quality ?? 'high';
  let renderer: WebGLRenderer;
  try {
    // With a post chain, SMAA replaces MSAA; the low tier renders directly with MSAA.
    renderer = new WebGLRenderer({ antialias: quality === 'low', alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    options.onFailure?.(error instanceof Error ? error : new Error(String(error)));
    return null;
  }
  const pixelRatio = tierPixelRatio(quality, window.devicePixelRatio || 1);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.info.autoReset = false;
  renderer.domElement.className = 'book-webgl-canvas';
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:inherit;';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const safeProbe = document.createElement('div');
  safeProbe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
  safeProbe.setAttribute('aria-hidden', 'true');
  host.append(safeProbe);

  const scene = new Scene();
  const environment: BookEnvironment = createBookEnvironment(renderer, scene, quality);
  const rig = createCameraRig();
  const camera = rig.camera;
  const pose: RigPose = READING_POSE;
  let cameraFit: FitResult | null = null;
  const post: PostPipeline = createPostPipeline(renderer, scene, camera, quality);
  const bookRoot = new Group();
  bookRoot.name = 'BookRoot';
  scene.add(bookRoot);
  const ownedGeometries = new Set<BufferGeometry>();
  const ownedMaterials = new Set<Material>();
  const ownedTextures = new Set<Texture>();
  const ownGeometry = <T extends BufferGeometry>(geometry: T): T => { ownedGeometries.add(geometry); return geometry; };
  const ownMaterial = <T extends Material>(material: T): T => { ownedMaterials.add(material); return material; };
  const board = ownMaterial(new MeshStandardMaterial({ color: BINDING_TOKENS.board, roughness: BINDING_TOKENS.boardRoughness, metalness: 0 }));
  const innerCover = ownMaterial(new MeshStandardMaterial({ color: BINDING_TOKENS.innerBoard, roughness: 0.95, metalness: 0 }));
  const foreEdgeTexture = createForeEdgeTexture();
  ownedTextures.add(foreEdgeTexture);
  const foreEdge = ownMaterial(new MeshStandardMaterial({ color: '#ffffff', map: foreEdgeTexture, roughness: 0.96, metalness: 0 }));
  const stackTop = ownMaterial(createPaperMaterial({ name: 'stack-top' }));
  const leftMaterial = ownMaterial(createPaperMaterial({ name: 'page-left' }));
  const rightMaterial = ownMaterial(createPaperMaterial({ name: 'page-right' }));
  const leafFrontMaterial = ownMaterial(createPaperMaterial({ name: 'leaf-front' }));
  const leafBackMaterial = ownMaterial(createPaperMaterial({ name: 'leaf-back' }));
  const leafEdgeMaterial = ownMaterial(new MeshStandardMaterial({ color: BINDING_TOKENS.paperEdge, roughness: 0.96, metalness: 0 }));
  const artworkMaterial = ownMaterial(new MeshStandardMaterial({ color: '#ffffff', roughness: BINDING_TOKENS.coverRoughness, metalness: 0 }));

  const shadowed = <T extends Mesh>(mesh: T, cast = true): T => { mesh.castShadow = cast; mesh.receiveShadow = true; return mesh; };
  // Box faces: +x, -x, +y (inside, endpaper), -y (desk), +z, -z.
  const backCover = shadowed(new Mesh(ownGeometry(new BoxGeometry(D.coverWidth, D.coverThickness, D.coverHeight)),
    [board, board, innerCover, board, board, board]));
  backCover.name = 'BackCover';
  backCover.position.set(D.coverWidth / 2, D.coverThickness / 2, 0);
  bookRoot.add(backCover);
  // The spine follows the hinge: full book height when closed, down to the board when open,
  // so it never shows as a strip in the gutter between the curved pages.
  const spineHeight = 2 * D.coverThickness + D.totalStackHeight;
  const spine = shadowed(new Mesh(ownGeometry(new BoxGeometry(0.12, 1, D.coverHeight)), board));
  spine.name = 'Spine';
  spine.scale.y = spineHeight;
  spine.position.set(-0.025, spineHeight / 2, 0);
  bookRoot.add(spine);

  const coverHinge = new Group();
  coverHinge.name = 'FrontCoverHinge';
  bookRoot.add(coverHinge);
  const frontCover = shadowed(new Mesh(ownGeometry(new BoxGeometry(D.coverWidth, D.coverThickness, D.coverHeight)),
    [board, board, board, innerCover, board, board]));
  frontCover.name = 'FrontCover';
  frontCover.position.x = D.coverWidth / 2;
  coverHinge.add(frontCover);
  const artwork = shadowed(new Mesh(ownGeometry(createFlatPageGeometry(D.coverWidth, D.coverHeight)), artworkMaterial), false);
  artwork.name = 'VerifiedFrontArtwork';
  artwork.position.y = D.coverThickness / 2 + 0.001;
  coverHinge.add(artwork);

  // Stacks and pages share the spread profile. The left side is built in its own page-local
  // frame (spine at the far end) and turned by π inside the hinge, so local +Y is world +Y.
  const initial = stackHeights(0, 6);
  const geometryState = { right: { height: initial.right, amplitude: spreadAmplitude(initial.right) }, left: { height: initial.left, amplitude: spreadAmplitude(initial.left) } };
  const stackGeometry = (spine: SpineSide, state: { height: number; amplitude: number }) => ownGeometry(createStackGeometry(D.pageWidth, D.pageHeight, spine, state.height, state.amplitude));
  const rightStack = shadowed(new Mesh(stackGeometry('start', geometryState.right), [stackTop, foreEdge]));
  rightStack.name = 'RightPageStack';
  rightStack.position.set(0, D.coverThickness, 0);
  bookRoot.add(rightStack);
  const leftStack = shadowed(new Mesh(stackGeometry('end', geometryState.left), [stackTop, foreEdge]));
  leftStack.name = 'LeftPageStack';
  leftStack.rotation.z = Math.PI;
  leftStack.position.set(D.pageWidth, -D.coverThickness / 2, 0);
  coverHinge.add(leftStack);
  const rightPage = shadowed(new Mesh(ownGeometry(createSpreadPageGeometry(D.pageWidth, D.pageHeight, 'start', geometryState.right.amplitude)), rightMaterial), false);
  rightPage.name = 'StaticRightPage';
  bookRoot.add(rightPage);
  const leftPage = shadowed(new Mesh(ownGeometry(createSpreadPageGeometry(D.pageWidth, D.pageHeight, 'end', geometryState.left.amplitude)), leftMaterial), false);
  leftPage.name = 'StaticLeftPage';
  leftPage.rotation.z = Math.PI;
  coverHinge.add(leftPage);

  const leafGeometry = ownGeometry(createTurningLeafGeometry());
  const turningLeaf = shadowed(new Mesh(leafGeometry, [leafFrontMaterial, leafBackMaterial, leafEdgeMaterial]));
  turningLeaf.name = 'TurningLeaf';
  turningLeaf.visible = false;
  bookRoot.add(turningLeaf);

  // v3 R5: paper flaps ride the static page meshes (their own page-local frame).
  const flaps = createFlapLayer();
  const flapPages = () => ({
    left: { mesh: leftPage, width: D.pageWidth, height: D.pageHeight, surface: (u: number) => geometryState.left.amplitude * spreadHeight(1 - u) },
    right: { mesh: rightPage, width: D.pageWidth, height: D.pageHeight, surface: (u: number) => geometryState.right.amplitude * spreadHeight(u) },
  });
  let flapsMoving = false;
  const sceneAnchor = new Group();
  sceneAnchor.name = 'ActiveSceneAnchor';
  bookRoot.add(sceneAnchor);
  let borrowedScene: Group | null = null;
  let borrowedSceneZ = 0;
  let sceneWindow: StageSceneWindow | null = null;
  const sceneClipPlanes = [new Plane(new Vector3(0, 0, 1), 0), new Plane(new Vector3(0, 0, -1), 0)];
  const borrowedMaterialState = new Map<Material, {
    clippingPlanes: Plane[] | null; clipIntersection: boolean; clipShadows: boolean; depthTest: boolean;
  }>();

  function restoreSceneMaterials(): void {
    for (const [material, original] of borrowedMaterialState) {
      material.clippingPlanes = original.clippingPlanes;
      material.clipIntersection = original.clipIntersection;
      material.clipShadows = original.clipShadows;
      material.depthTest = original.depthTest;
      material.needsUpdate = true;
    }
    borrowedMaterialState.clear();
  }

  function applySceneWindow(): void {
    if (!borrowedScene) return;
    borrowedScene.position.z = borrowedSceneZ + (sceneWindow?.offsetZ ?? 0);
    if (!sceneWindow) return;
    // Three clips the negative half-space, retaining minZ <= world Z <= maxZ.
    sceneClipPlanes[0]!.constant = -sceneWindow.minZ;
    sceneClipPlanes[1]!.constant = sceneWindow.maxZ;
    borrowedScene.traverse((object) => {
      if (!(object instanceof Mesh || object instanceof LineSegments)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        // Edits/highlights can switch to another world-owned material after attachment.
        if (borrowedMaterialState.has(material)) continue;
        borrowedMaterialState.set(material, { clippingPlanes: material.clippingPlanes,
          clipIntersection: material.clipIntersection, clipShadows: material.clipShadows, depthTest: material.depthTest });
        material.clippingPlanes = [...(material.clippingPlanes ?? []), ...sceneClipPlanes];
        material.clipIntersection = false;
        material.clipShadows = true;
        material.depthTest = true;
        material.needsUpdate = true;
      }
    });
  }

  let state: StageUpdate = { coverProgress: 0, introProgress: 0, currentSpreadIndex: 0, spreadCount: 6, turn: null, sceneProgress: 0, sceneReveal: 1, suspendFit: false };
  const textures: StageTextures = { staticLeft: null, staticRight: null, turnFront: null, turnBack: null,
    staticLeftState: null, staticRightState: null, turnFrontState: null, turnBackState: null };
  let width = 0;
  let height = 0;
  let layout: StageLayout | null = null;
  let pendingFrame: number | null = null;
  let disposed = false;
  let contextLost = false;
  let coverReady = false;
  let ownedCoverTexture: Texture | null = null;
  let renderedFrames = 0;
  let drawCalls = 0;
  let rightSurfaceY = 0;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const rayHit = new Vector3();
  const dragPlane = new Plane(new Vector3(0, 1, 0), 0);
  let visiblePoints: Vector3[] = [];
  const openPoints = openFramePoints();
  const closedPoints = closedFramePoints();
  let fitCache: { key: string; closed: number; open: { anchor: Vector3; distance: number } } | null = null;

  function metrics(): void {
    if (disposed) return;
    options.onMetrics?.({ renderedFrames, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? 0, contextLost, coverReady, drawCalls, quality });
  }
  function safeRect(): StageRect {
    const probe = getComputedStyle(safeProbe);
    const hostStyle = getComputedStyle(host);
    const inset = (side: string): number => {
      const override = parseFloat(hostStyle.getPropertyValue(`--book-safe-${side}`));
      return Math.max(0, Number.isFinite(override) ? override : parseFloat(probe.getPropertyValue(`padding-${side}`)) || 0);
    };
    return { left: 12 + inset('left'), top: 12 + inset('top'), right: width - 12 - inset('right'), bottom: height - 12 - inset('bottom') };
  }
  function viewportCenter(rect: DOMRect): StagePoint {
    const vv = window.visualViewport;
    return {
      x: (vv ? vv.offsetLeft + vv.width / 2 : window.innerWidth / 2) - rect.left,
      y: (vv ? vv.offsetTop + vv.height / 2 : window.innerHeight / 2) - rect.top,
    };
  }
  function corners(bounds: Box3): Vector3[] {
    const result: Vector3[] = [];
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) result.push(new Vector3(x, y, z));
    return result;
  }
  function project(point: Vector3): StagePoint {
    point.project(camera);
    return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
  }
  /** Actual curved page corners: top-left, top-right, bottom-right, bottom-left in page-local UV order. */
  function pageQuad(mesh: Mesh, pageWidth: number, pageHeight: number, spine: SpineSide, amplitude: number): StageQuad {
    const corner = (u: number, v: number) => {
      const spineDistance = spine === 'start' ? u : 1 - u;
      return project(new Vector3(u * pageWidth, amplitude * spreadHeight(spineDistance), (v - 0.5) * pageHeight).applyMatrix4(mesh.matrixWorld));
    };
    return { tl: corner(0, 0), tr: corner(1, 0), br: corner(1, 1), bl: corner(0, 1) };
  }
  function refreshStack(side: 'left' | 'right', height: number): void {
    const target = geometryState[side];
    const amplitude = spreadAmplitude(height);
    if (Math.abs(target.height - height) < 1e-7 && Math.abs(target.amplitude - amplitude) < 1e-7) return;
    target.height = height;
    target.amplitude = amplitude;
    const spine: SpineSide = side === 'right' ? 'start' : 'end';
    updateStackGeometry((side === 'right' ? rightStack : leftStack).geometry, D.pageWidth, D.pageHeight, spine, height, amplitude);
    updateSpreadPageGeometry((side === 'right' ? rightPage : leftPage).geometry, D.pageWidth, D.pageHeight, spine, amplitude);
  }
  function applyObjects(): void {
    const progress = unitProgress(state.coverProgress);
    const turn = state.turn;
    const turnProgress = turn ? unitProgress(turn.progress) : 0;
    const turnSign = turn?.direction === 'backward' ? -1 : 1;
    for (const material of [leafFrontMaterial, leafBackMaterial, leafEdgeMaterial]) {
      if (material.wireframe !== Boolean(state.inspectionWireframe)) {
        material.wireframe = Boolean(state.inspectionWireframe);
        material.needsUpdate = true;
      }
    }
    const heights = stackHeights(state.currentSpreadIndex + (turn ? turnSign * turnProgress : 0), state.spreadCount);
    // The binding flexes down the spine as the rigid board opens. The pivot
    // stays at x=0 on the spine, never at the center of the cover artwork.
    coverHinge.position.y = D.coverThickness / 2 + (D.coverThickness + D.totalStackHeight) * (1 - progress);
    coverHinge.rotation.z = Math.PI * progress;
    const spineTop = coverHinge.position.y + D.coverThickness / 2;
    spine.scale.y = spineTop;
    spine.position.y = spineTop / 2;
    refreshStack('right', heights.right);
    refreshStack('left', heights.left);
    rightSurfaceY = D.coverThickness + heights.right + D.pageLift;
    rightPage.position.y = rightSurfaceY;
    leftPage.position.set(D.pageWidth, -D.coverThickness / 2 - heights.left - D.pageLift, 0);
    turningLeaf.visible = progress >= 1 && turn !== null;
    if (turn && turningLeaf.visible) {
      const source = stackHeights(state.currentSpreadIndex, state.spreadCount);
      const destination = stackHeights(state.currentSpreadIndex + turnSign, state.spreadCount);
      const sourceHeight = turn.direction === 'forward' ? source.right : source.left;
      const destinationHeight = turn.direction === 'forward' ? destination.left : destination.right;
      // The subpixel lift prevents coplanar source print from z-fighting.
      turningLeaf.position.y = D.coverThickness + sourceHeight + (destinationHeight - sourceHeight) * turnProgress + D.pageLift + LEAF_THICKNESS;
      updateTurningLeafGeometry(leafGeometry, D.pageWidth, D.pageHeight, turnProgress, turn.corner, turn.direction,
        { source: spreadAmplitude(sourceHeight), destination: spreadAmplitude(destinationHeight) });
    }
    // v3 R4: the scene is an ink figure lying on the right page (it follows the page's curve
    // itself). The timeline lifts it (0 flat → 1 standing) and the pen reveals it; the anchor no
    // longer grows. The current owner may lie down under an early direct curl and stand again on
    // cancellation; depth testing keeps the leaf in front. Once flat during a turn its ink would sit
    // on the wrong page, so only a standing figure stays visible while a leaf moves.
    const lift = unitProgress(state.sceneProgress ?? 0);
    const reveal = unitProgress(state.sceneReveal ?? 1);
    const figure = figureControlsOf(borrowedScene);
    figure?.setLift(lift);
    figure?.setReveal(reveal);
    sceneAnchor.visible = progress >= 1 && (lift > 0 || (reveal > 0 && !turn)) && (sceneWindow?.visible ?? true);
    // Flaps belong to the still page: the leaf carries the print during a turn.
    flaps.setVisible(progress >= 1 && !turn);
    sceneAnchor.position.set(0, rightSurfaceY, 0);
    applySceneWindow();
    bookRoot.updateMatrixWorld(true);
    visiblePoints = [];
    bookRoot.traverseVisible(object => {
      if (!(object instanceof Mesh)) return;
      if (object === turningLeaf) {
        const positions = leafGeometry.getAttribute('position');
        for (let index = 0; index < positions.count; index += 1) visiblePoints.push(new Vector3().fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld));
      } else {
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        if (object.geometry.boundingBox) visiblePoints.push(...corners(object.geometry.boundingBox).map(point => point.applyMatrix4(object.matrixWorld)));
      }
    });
  }
  function fitCamera(rect: DOMRect, safe: StageRect): void {
    // Pinch zoom belongs to the reader. Refitting to its smaller visual viewport
    // would move the book under the fingers and undo the chosen magnification.
    if ((state.suspendFit || (window.visualViewport?.scale ?? 1) > 1.001) && layout && cameraFit) return;
    const progress = unitProgress(state.coverProgress);
    const intro = unitProgress(state.introProgress);
    const target = viewportCenter(rect);
    const viewport = { width, height };
    const key = JSON.stringify([width, height, target, safe, pose]);
    if (!fitCache || fitCache.key !== key) {
      const closed = fitDistance({ points: closedPoints, anchor: CLOSED_ANCHOR, target, safe, viewport, pose }).distance;
      const open = balancedAnchor({ points: openPoints, anchor: OPEN_ANCHOR, target, safe, viewport, pose }, 1.6);
      fitCache = { key, closed, open };
    }
    const anchor = CLOSED_ANCHOR.clone().lerp(fitCache.open.anchor, progress).addScaledVector(INTRO_OFFSET, 1 - intro);
    const scale = 1 + INTRO_DISTANCE * (1 - intro);
    let distance = (fitCache.closed + (fitCache.open.distance - fitCache.closed) * progress) * scale;
    // In motion (intro, cover hinge) the visible silhouette can exceed both endpoints.
    if (!(progress === 1 && intro === 1) && !(progress === 0 && intro === 1)) {
      distance = Math.max(distance, fitDistance({ points: visiblePoints, anchor, target, safe, viewport, pose }).distance);
    }
    cameraFit = placeRig({ anchor, target, safe, viewport, pose, distance, sceneExtent: SCENE_EXTENT });
    rig.apply(cameraFit, viewport);
  }
  function render(): void {
    pendingFrame = null;
    if (disposed || contextLost) return;
    const rect = host.getBoundingClientRect();
    const nextWidth = Math.max(1, rect.width);
    const nextHeight = Math.max(1, rect.height);
    if (nextWidth !== width || nextHeight !== height) {
      width = nextWidth; height = nextHeight;
      renderer.setSize(width, height, false);
      post.setSize(width, height, pixelRatio);
    }
    applyObjects();
    flapsMoving = flaps.update(performance.now(), flapPages());
    const safe = safeRect();
    fitCamera(rect, safe);
    // Ink widths are CSS pixels of this viewport.
    figureControlsOf(borrowedScene)?.setResolution(width, height);
    renderer.info.reset();
    post.render();
    drawCalls = renderer.info.render.calls;
    renderedFrames += 1;
    const coverUvCenter = project(new Vector3(D.coverWidth / 2, 0, 0).applyMatrix4(artwork.matrixWorld));
    const target = viewportCenter(rect);
    const screenBounds = visiblePoints.map(project);
    const bounds = { left: Math.min(...screenBounds.map(point => point.x)), right: Math.max(...screenBounds.map(point => point.x)), top: Math.min(...screenBounds.map(point => point.y)), bottom: Math.max(...screenBounds.map(point => point.y)) };
    layout = {
      width, height, pageWidth: D.pageWidth, pageHeight: D.pageHeight,
      pageWorld: { width: D.pageWidth, height: D.pageHeight },
      left: pageQuad(leftPage, D.pageWidth, D.pageHeight, 'end', geometryState.left.amplitude),
      right: pageQuad(rightPage, D.pageWidth, D.pageHeight, 'start', geometryState.right.amplitude),
      cover: pageQuad(artwork, D.coverWidth, D.coverHeight, 'start', 0), safeRect: safe, coverUvCenter,
      coverCenterErrorPx: Math.hypot(coverUvCenter.x - target.x, coverUvCenter.y - target.y),
      camera: { position: camera.position.toArray(), target: cameraFit?.cameraTarget.toArray() ?? [], quaternion: camera.quaternion.toArray(),
        span: cameraFit ? cameraFit.worldPerPixelAtAnchor * height : 0, fov: camera.fov, distance: cameraFit?.distance ?? 0,
        worldPerPixelAtAnchor: cameraFit?.worldPerPixelAtAnchor ?? 0 },
      bookBounds: bounds, openWidthFraction: (bounds.right - bounds.left) / width,
    };
    options.onLayout?.(layout);
    metrics();
    if (flapsMoving) invalidate();
  }
  function invalidate(): void {
    if (!disposed && !contextLost && pendingFrame === null) pendingFrame = requestAnimationFrame(render);
  }
  function contextLostHandler(event: Event): void {
    event.preventDefault();
    if (disposed) return;
    contextLost = true;
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
    metrics();
    options.onFailure?.(new Error('WebGL context lost; the book must use its reading fallback until restored.'));
  }
  function contextRestoredHandler(): void { if (!disposed) { contextLost = false; invalidate(); } }
  renderer.domElement.addEventListener('webglcontextlost', contextLostHandler);
  renderer.domElement.addEventListener('webglcontextrestored', contextRestoredHandler);
  const observer = new ResizeObserver(invalidate);
  observer.observe(host);
  window.visualViewport?.addEventListener('resize', invalidate);
  window.visualViewport?.addEventListener('scroll', invalidate);

  const applyCover = (texture: Texture): void => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    artworkMaterial.map = texture;
    artworkMaterial.needsUpdate = true;
    coverReady = true;
    invalidate();
  };
  if (options.coverTexture) applyCover(options.coverTexture);
  else {
    new TextureLoader().load('/book/front-cover.png', texture => {
      if (disposed) { texture.dispose(); return; }
      ownedCoverTexture = texture;
      applyCover(texture);
    }, undefined, error => {
      if (!disposed) options.onFailure?.(error instanceof Error ? error : new Error('The verified front-cover image could not load.'));
    });
  }
  invalidate();

  return {
    update(next) {
      if (disposed) return;
      const merged = { ...state, ...next };
      const turnEqual = JSON.stringify(merged.turn) === JSON.stringify(state.turn);
      if (merged.coverProgress === state.coverProgress && merged.introProgress === state.introProgress
        && merged.currentSpreadIndex === state.currentSpreadIndex && merged.spreadCount === state.spreadCount
        && merged.sceneProgress === state.sceneProgress && merged.sceneReveal === state.sceneReveal && merged.suspendFit === state.suspendFit
        && merged.inspectionWireframe === state.inspectionWireframe && turnEqual) return;
      state = merged;
      invalidate();
    },
    setPageTextures(next) {
      let changed = false;
      for (const key of Object.keys(next) as (keyof StageTextures)[]) {
        const texture = next[key] ?? null;
        if (textures[key] !== texture) { textures[key] = texture; changed = true; }
      }
      if (!changed || disposed) return;
      leftMaterial.setPrint(textures.staticLeft);
      rightMaterial.setPrint(textures.staticRight);
      leafFrontMaterial.setPrint(textures.turnFront);
      leafBackMaterial.setPrint(textures.turnBack);
      leftMaterial.setState(textures.staticLeftState);
      rightMaterial.setState(textures.staticRightState);
      leafFrontMaterial.setState(textures.turnFrontState);
      leafBackMaterial.setState(textures.turnBackState);
      invalidate();
    },
    setSceneGroup(group) {
      if (disposed || group === borrowedScene) return;
      restoreSceneMaterials();
      if (borrowedScene) { borrowedScene.position.z = borrowedSceneZ; sceneAnchor.remove(borrowedScene); }
      borrowedScene = group;
      if (group) { borrowedSceneZ = group.position.z; sceneAnchor.add(group); applySceneWindow(); }
      else { sceneWindow = null; borrowedSceneZ = 0; }
      invalidate();
    },
    setSceneWindow(next) {
      if (disposed) return;
      if (next && ![next.offsetZ, next.minZ, next.maxZ].every(Number.isFinite)) {
        throw new RangeError('Scene window coordinates must be finite.');
      }
      const clipped = next ? { ...next, minZ: Math.max(-D.pageHeight / 2, next.minZ),
        maxZ: Math.min(D.pageHeight / 2, next.maxZ) } : null;
      if (clipped) clipped.visible = clipped.visible && clipped.minZ < clipped.maxZ;
      if ((!clipped && !sceneWindow) || (clipped && sceneWindow
        && clipped.offsetZ === sceneWindow.offsetZ && clipped.minZ === sceneWindow.minZ
        && clipped.maxZ === sceneWindow.maxZ && clipped.visible === sceneWindow.visible)) return;
      sceneWindow = clipped;
      if (!sceneWindow) restoreSceneMaterials();
      applySceneWindow();
      invalidate();
    },
    pointerProjection(clientX, clientY, grabbedOffsetX = 0) {
      if (disposed || !layout) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
      raycaster.setFromCamera(pointer, camera);
      dragPlane.constant = -rightSurfaceY;
      if (!raycaster.ray.intersectPlane(dragPlane, rayHit)) return null;
      return {
        x: rayHit.x, y: rayHit.y, z: rayHit.z, u: rayHit.x / D.pageWidth, v: rayHit.z / D.pageHeight + 0.5,
        turnProgress: state.turn ? leafProgressFromX(D.pageWidth, D.pageHeight, rayHit.x - grabbedOffsetX, state.turn.corner, state.turn.direction) : undefined,
      };
    },
    pagePointer(clientX, clientY) {
      if (disposed || !layout || state.turn || unitProgress(state.coverProgress) < 1) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return null;
      pointer.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([leftPage, rightPage], false)[0];
      if (!hit?.uv) return null;
      // Page geometry UV is (u, 1 - row); the print canvas runs top-down.
      return { side: hit.object === leftPage ? 'left' : 'right', u: hit.uv.x, v: 1 - hit.uv.y };
    },
    pagePoint(side, u, v) {
      if (disposed || !layout || ![u, v].every(Number.isFinite)) return null;
      const mesh = side === 'left' ? leftPage : rightPage;
      const spine: SpineSide = side === 'left' ? 'end' : 'start';
      const amplitude = geometryState[side].amplitude;
      const local = new Vector3(u * D.pageWidth, amplitude * spreadHeight(spine === 'start' ? u : 1 - u), (v - 0.5) * D.pageHeight);
      const point = project(local.applyMatrix4(mesh.matrixWorld));
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: rect.left + point.x, y: rect.top + point.y };
    },
    pickScene(clientX, clientY, targets) {
      if (disposed || !sceneAnchor.visible || state.turn || sceneWindow?.visible === false) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
      scene.updateMatrixWorld(true);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(targets, false).find(intersection => !sceneWindow
        || intersection.point.z >= sceneWindow.minZ && intersection.point.z <= sceneWindow.maxZ);
      return (hit?.object as Mesh | undefined) ?? null;
    },
    setPageFlaps(list, instant = false) {
      if (disposed) return;
      flaps.set(list, flapPages(), instant);
      invalidate();
    },
    flapAngles: () => flaps.angles(),
    holdFlaps(ms) { flaps.hold(ms); invalidate(); },
    flapAt(clientX, clientY) {
      const targets = flaps.targets();
      if (disposed || !targets.length || state.turn) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
      scene.updateMatrixWorld(true);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(targets, false)[0];
      return hit ? flaps.keyOf(hit.object) : null;
    },
    projectToClient(point) {
      if (disposed || !layout || !point.every(Number.isFinite)) return null;
      const projected = project(new Vector3(point[0], point[1], point[2]));
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: rect.left + projected.x, y: rect.top + projected.y };
    },
    measureSceneDrawCalls() {
      if (disposed || contextLost || !layout) return null;
      // A full frame first, so the figure reflects the current timeline state.
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
      render();
      const total = drawCalls;
      const visible = sceneAnchor.visible;
      sceneAnchor.visible = false;
      renderer.info.reset();
      post.render();
      const withoutScene = renderer.info.render.calls;
      sceneAnchor.visible = visible;
      render();
      return { total, withoutScene, scene: total - withoutScene, figure: figureControlsOf(borrowedScene)?.stats() ?? null };
    },
    getLayout: () => layout,
    invalidate,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
      pendingFrame = null;
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', invalidate);
      window.visualViewport?.removeEventListener('scroll', invalidate);
      renderer.domElement.removeEventListener('webglcontextlost', contextLostHandler);
      renderer.domElement.removeEventListener('webglcontextrestored', contextRestoredHandler);
      restoreSceneMaterials();
      if (borrowedScene) { borrowedScene.position.z = borrowedSceneZ; sceneAnchor.remove(borrowedScene); }
      flaps.dispose();
      ownedCoverTexture?.dispose();
      ownedGeometries.forEach(geometry => geometry.dispose());
      ownedMaterials.forEach(material => material.dispose());
      ownedTextures.forEach(texture => texture.dispose());
      environment.dispose();
      post.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      safeProbe.remove();
      layout = null;
    },
  };
}

