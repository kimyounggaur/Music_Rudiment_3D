import {
  ACESFilmicToneMapping, AmbientLight, Box3, BoxGeometry, Color,
  DirectionalLight, Group, LineSegments, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PCFShadowMap, Plane, PlaneGeometry,
  Raycaster, Scene, ShadowMaterial, SRGBColorSpace, Texture, TextureLoader,
  Vector2, Vector3, WebGLRenderer,
} from 'three';
import { balancedAnchor, createCameraRig, fitDistance, placeRig, READING_POSE } from './render/cameraRig.ts';
import type { FitResult, RigPose } from './render/cameraRig.ts';
import { CLOSED_ANCHOR, closedFramePoints, OPEN_ANCHOR, openFramePoints, SCENE_EXTENT } from './render/bookFraming.ts';
import {
  BOOK_DIMENSIONS, createFlatPageGeometry, createTurningLeafGeometry,
  leafProgressFromX, LEAF_THICKNESS, stackHeights, unitProgress, updateTurningLeafGeometry,
} from './geometry.ts';
import type { BookCorner, BookTurnDirection } from './geometry.ts';

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
  sceneProgress?: number;
  suspendFit?: boolean;
  inspectionWireframe?: boolean;
}
export interface StageTextures {
  staticLeft: Texture | null;
  staticRight: Texture | null;
  turnFront: Texture | null;
  turnBack: Texture | null;
}
export interface StageMetrics {
  renderedFrames: number;
  geometries: number;
  textures: number;
  programs: number;
  contextLost: boolean;
  coverReady: boolean;
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
  pointerProjection(clientX: number, clientY: number, grabbedOffsetX?: number): { x: number; y: number; z: number; u: number; v: number; turnProgress?: number } | null;
  getLayout(): StageLayout | null;
  invalidate(): void;
  dispose(): void;
}
interface StageOptions {
  onLayout?: (layout: StageLayout) => void;
  onFailure?: (error: Error) => void;
  onMetrics?: (metrics: StageMetrics) => void;
  coverTexture?: Texture;
}

const D = BOOK_DIMENSIONS;
const PAGE_CORNERS = [[0, -1], [1, -1], [1, 1], [0, 1]] as const;
/** Intro starts slightly farther away and to the side, then settles on the exact cover fit. */
const INTRO_OFFSET = new Vector3(0.3, 0, 0.12);
const INTRO_DISTANCE = 0.16;

export function createBookStage(host: HTMLElement, options: StageOptions = {}): BookStage | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    options.onFailure?.(error instanceof Error ? error : new Error(String(error)));
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.domElement.className = 'book-webgl-canvas';
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:inherit;';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const safeProbe = document.createElement('div');
  safeProbe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
  safeProbe.setAttribute('aria-hidden', 'true');
  host.append(safeProbe);

  const scene = new Scene();
  scene.background = new Color('#d9d1c4');
  const rig = createCameraRig();
  const camera = rig.camera;
  const pose: RigPose = READING_POSE;
  let cameraFit: FitResult | null = null;
  const bookRoot = new Group();
  bookRoot.name = 'BookRoot';
  scene.add(bookRoot);
  const ownedGeometries = new Set<ReturnType<typeof createFlatPageGeometry>>();
  const ownedMaterials = new Set<Material>();
  const ownGeometry = <T extends ReturnType<typeof createFlatPageGeometry>>(geometry: T): T => {
    ownedGeometries.add(geometry); return geometry;
  };
  const ownMaterial = <T extends Material>(material: T): T => { ownedMaterials.add(material); return material; };
  const coverEdge = ownMaterial(new MeshStandardMaterial({ color: '#68665c', roughness: 0.88 }));
  const innerCover = ownMaterial(new MeshStandardMaterial({ color: '#e6ddc5', roughness: 1 }));
  const paperSide = ownMaterial(new MeshStandardMaterial({ color: '#d9d0b9', roughness: 1 }));
  const ruleMaterial = ownMaterial(new MeshStandardMaterial({ color: '#c2b9a3', roughness: 1 }));
  // Printed CSS/SVG pixels already contain their intended color. Lighting and
  // ACES must not brighten the ink when live DOM becomes a moving texture.
  const leftMaterial = ownMaterial(new MeshBasicMaterial({ color: '#f4eedc', toneMapped: false }));
  const rightMaterial = ownMaterial(new MeshBasicMaterial({ color: '#f4eedc', toneMapped: false }));
  const leafFrontMaterial = ownMaterial(new MeshBasicMaterial({ color: '#f4eedc', toneMapped: false }));
  const leafBackMaterial = ownMaterial(new MeshBasicMaterial({ color: '#f4eedc', toneMapped: false }));
  const leafEdgeMaterial = ownMaterial(paperSide.clone());
  const artworkMaterial = ownMaterial(new MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  // Receive physical shadows separately on the identical surface. Polygon
  // offset changes depth testing only; the paper's position/curvature stays exact.
  const printShadowMaterial = ownMaterial(new ShadowMaterial({ color: '#26343b', opacity: 0.28,
    toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const hiddenShadowEdge = ownMaterial(new ShadowMaterial({ visible: false }));
  function printShadow(parent: Mesh, curved = false): Mesh {
    const overlay = new Mesh(parent.geometry, curved
      ? [printShadowMaterial, printShadowMaterial, hiddenShadowEdge] : printShadowMaterial);
    overlay.name = `${parent.name}Shadow`;
    overlay.receiveShadow = true;
    // Child placement makes every pose, hinge and visibility follow the paper.
    parent.add(overlay);
    return overlay;
  }

  const backCover = new Mesh(ownGeometry(new BoxGeometry(D.coverWidth, D.coverThickness, D.coverHeight)), coverEdge);
  backCover.name = 'BackCover';
  backCover.position.set(D.coverWidth / 2, D.coverThickness / 2, 0);
  backCover.castShadow = true;
  backCover.receiveShadow = true;
  bookRoot.add(backCover);
  const spine = new Mesh(ownGeometry(new BoxGeometry(0.12, D.totalStackHeight + D.coverThickness, D.coverHeight)), coverEdge);
  spine.name = 'Spine';
  spine.position.set(-0.025, (D.totalStackHeight + D.coverThickness) / 2, 0);
  spine.castShadow = true;
  bookRoot.add(spine);

  const coverHinge = new Group();
  coverHinge.name = 'FrontCoverHinge';
  bookRoot.add(coverHinge);
  const frontCover = new Mesh(
    ownGeometry(new BoxGeometry(D.coverWidth, D.coverThickness, D.coverHeight)),
    [coverEdge, coverEdge, coverEdge, innerCover, coverEdge, coverEdge],
  );
  frontCover.name = 'FrontCover';
  frontCover.position.x = D.coverWidth / 2;
  frontCover.castShadow = true;
  frontCover.receiveShadow = true;
  coverHinge.add(frontCover);
  const artwork = new Mesh(ownGeometry(createFlatPageGeometry(D.coverWidth, D.coverHeight)), artworkMaterial);
  artwork.name = 'VerifiedFrontArtwork';
  artwork.position.y = D.coverThickness / 2 + 0.001;
  coverHinge.add(artwork);

  const unitStackGeometry = ownGeometry(new BoxGeometry(D.pageWidth, 1, D.pageHeight));
  const rightStack = new Mesh(unitStackGeometry, paperSide);
  rightStack.name = 'RightPageStack';
  rightStack.castShadow = true;
  rightStack.receiveShadow = true;
  bookRoot.add(rightStack);
  const leftStack = new Mesh(unitStackGeometry, paperSide);
  leftStack.name = 'LeftPageStack';
  leftStack.castShadow = true;
  leftStack.receiveShadow = true;
  coverHinge.add(leftStack);
  const rightPage = new Mesh(ownGeometry(createFlatPageGeometry(D.pageWidth, D.pageHeight)), rightMaterial);
  rightPage.name = 'StaticRightPage';
  const rightPageShadow = printShadow(rightPage);
  bookRoot.add(rightPage);
  const leftPage = new Mesh(ownGeometry(createFlatPageGeometry(D.pageWidth, D.pageHeight)), leftMaterial);
  leftPage.name = 'StaticLeftPage';
  leftPage.rotation.z = Math.PI;
  const leftPageShadow = printShadow(leftPage);
  coverHinge.add(leftPage);

  const leafGeometry = ownGeometry(createTurningLeafGeometry());
  const turningLeaf = new Mesh(leafGeometry, [leafFrontMaterial, leafBackMaterial, leafEdgeMaterial]);
  turningLeaf.name = 'TurningLeaf';
  turningLeaf.visible = false;
  turningLeaf.castShadow = true;
  const turningLeafShadow = printShadow(turningLeaf, true);
  bookRoot.add(turningLeaf);

  // A small reusable set of visible fore-edge lines represents a paper bundle.
  const lineGeometry = ownGeometry(new BoxGeometry(D.pageWidth, 0.001, 0.002));
  const leftRules: Mesh[] = [];
  const rightRules: Mesh[] = [];
  for (let index = 1; index <= 7; index += 1) {
    const leftRule = new Mesh(lineGeometry, ruleMaterial);
    const rightRule = new Mesh(lineGeometry, ruleMaterial);
    coverHinge.add(leftRule); bookRoot.add(rightRule);
    leftRules.push(leftRule); rightRules.push(rightRule);
  }
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

  const ambient = new AmbientLight('#fff8e9', 2.1);
  scene.add(ambient);
  const key = new DirectionalLight('#fff7e8', 2.8);
  key.position.set(-3, 8, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 18;
  key.shadow.normalBias = 0.018;
  key.shadow.bias = -0.0001;
  key.shadow.radius = 3;
  scene.add(key);
  const desk = new Mesh(ownGeometry(new PlaneGeometry(30, 30)), ownMaterial(new ShadowMaterial({ color: '#4b4233', opacity: 0.19 })));
  desk.name = 'ContactShadowDesk';
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -0.002;
  desk.receiveShadow = true;
  scene.add(desk);

  let state: StageUpdate = { coverProgress: 0, introProgress: 0, currentSpreadIndex: 0, spreadCount: 6, turn: null, sceneProgress: 0, suspendFit: false };
  const textures: StageTextures = { staticLeft: null, staticRight: null, turnFront: null, turnBack: null };
  let width = 0;
  let height = 0;
  let layout: StageLayout | null = null;
  let pendingFrame: number | null = null;
  let disposed = false;
  let contextLost = false;
  let coverReady = false;
  let ownedCoverTexture: Texture | null = null;
  let renderedFrames = 0;
  let rightSurfaceY = 0;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const rayHit = new Vector3();
  const dragPlane = new Plane(new Vector3(0, 1, 0), 0);
  let visiblePoints: Vector3[] = [];
  const closedAnchor = CLOSED_ANCHOR;
  const openAnchor = OPEN_ANCHOR;
  // Fit the actual swept surface: open book bounds plus the outer samples of every turn pose.
  const openPoints = openFramePoints();
  const closedPoints = closedFramePoints();
  let fitCache: { key: string; closed: number; open: { anchor: Vector3; distance: number } } | null = null;

  function metrics(): void {
    if (disposed) return;
    options.onMetrics?.({ renderedFrames, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length ?? 0, contextLost, coverReady });
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
  function pageQuad(mesh: Mesh, pageWidth: number, pageHeight: number): StageQuad {
    const [tl, tr, br, bl] = PAGE_CORNERS.map(([u, v]) => project(new Vector3(u * pageWidth, 0, v * pageHeight / 2).applyMatrix4(mesh.matrixWorld)));
    return { tl, tr, br, bl };
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
    turningLeafShadow.visible = !state.inspectionWireframe;
    const heights = stackHeights(state.currentSpreadIndex + (turn ? turnSign * turnProgress : 0), state.spreadCount);
    // The binding flexes down the spine as the rigid board opens. The pivot
    // stays at x=0 on the spine, never at the center of the cover artwork.
    coverHinge.position.y = D.coverThickness / 2 + (D.coverThickness + D.totalStackHeight) * (1 - progress);
    coverHinge.rotation.z = Math.PI * progress;
    rightStack.scale.y = heights.right;
    rightStack.position.set(D.pageWidth / 2, D.coverThickness + heights.right / 2, 0);
    leftStack.scale.y = heights.left;
    leftStack.position.set(D.pageWidth / 2, -D.coverThickness / 2 - heights.left / 2, 0);
    rightSurfaceY = D.coverThickness + heights.right + D.pageLift;
    rightPage.position.y = rightSurfaceY;
    leftPage.position.set(D.pageWidth, -D.coverThickness / 2 - heights.left - D.pageLift, 0);
    leftRules.forEach((line, index) => line.position.set(D.pageWidth / 2, -D.coverThickness / 2 - heights.left * (index + 1) / 8, D.pageHeight / 2 + 0.001));
    rightRules.forEach((line, index) => line.position.set(D.pageWidth / 2, D.coverThickness + heights.right * (index + 1) / 8, D.pageHeight / 2 + 0.001));
    turningLeaf.visible = progress >= 1 && turn !== null;
    if (turn && turningLeaf.visible) {
      const source = stackHeights(state.currentSpreadIndex, state.spreadCount);
      const destination = stackHeights(state.currentSpreadIndex + turnSign, state.spreadCount);
      const sourceHeight = turn.direction === 'forward' ? source.right : source.left;
      const destinationHeight = turn.direction === 'forward' ? destination.left : destination.right;
      // The subpixel lift prevents coplanar source print from z-fighting. It
      // remains below the DOM/texture handoff tolerance at the tested sizes.
      turningLeaf.position.y = D.coverThickness + sourceHeight + (destinationHeight - sourceHeight) * turnProgress + D.pageLift + LEAF_THICKNESS;
      updateTurningLeafGeometry(leafGeometry, D.pageWidth, D.pageHeight, turnProgress, turn.corner, turn.direction);
    }
    const growth = unitProgress(state.sceneProgress ?? 0);
    // The current owner may fold under an early direct curl and unfold on
    // cancellation. Depth testing keeps the leaf in front; the destination
    // owner is attached only after the controller commits the turn.
    sceneAnchor.visible = progress >= 1 && growth > 0 && (sceneWindow?.visible ?? true);
    sceneAnchor.position.set(0, rightSurfaceY + 0.006 - (1 - growth) * 0.07, 0);
    sceneAnchor.scale.set(1, Math.max(0.0001, growth), 1);
    applySceneWindow();
    bookRoot.updateMatrixWorld(true);
    visiblePoints = [];
    bookRoot.traverseVisible(object => {
      if (!(object instanceof Mesh)) return;
      // Shadow receivers reuse their parents' vertices and are not extra book
      // bounds; using a curved receiver's AABB would overestimate its silhouette.
      if (object === leftPageShadow || object === rightPageShadow || object === turningLeafShadow) return;
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
      const closed = fitDistance({ points: closedPoints, anchor: closedAnchor, target, safe, viewport, pose }).distance;
      const open = balancedAnchor({ points: openPoints, anchor: openAnchor, target, safe, viewport, pose }, 1.6);
      fitCache = { key, closed, open };
    }
    const anchor = closedAnchor.clone().lerp(fitCache.open.anchor, progress).addScaledVector(INTRO_OFFSET, 1 - intro);
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
    }
    applyObjects();
    const safe = safeRect();
    fitCamera(rect, safe);
    renderer.render(scene, camera);
    renderedFrames += 1;
    const coverUvCenter = project(new Vector3(D.coverWidth / 2, 0, 0).applyMatrix4(artwork.matrixWorld));
    const target = viewportCenter(rect);
    const screenBounds = visiblePoints.map(project);
    const bounds = { left: Math.min(...screenBounds.map(point => point.x)), right: Math.max(...screenBounds.map(point => point.x)), top: Math.min(...screenBounds.map(point => point.y)), bottom: Math.max(...screenBounds.map(point => point.y)) };
    layout = {
      width, height, pageWidth: D.pageWidth, pageHeight: D.pageHeight,
      pageWorld: { width: D.pageWidth, height: D.pageHeight },
      left: pageQuad(leftPage, D.pageWidth, D.pageHeight), right: pageQuad(rightPage, D.pageWidth, D.pageHeight),
      cover: pageQuad(artwork, D.coverWidth, D.coverHeight), safeRect: safe, coverUvCenter,
      coverCenterErrorPx: Math.hypot(coverUvCenter.x - target.x, coverUvCenter.y - target.y),
      camera: { position: camera.position.toArray(), target: cameraFit?.cameraTarget.toArray() ?? [], quaternion: camera.quaternion.toArray(),
        span: cameraFit ? cameraFit.worldPerPixelAtAnchor * height : 0, fov: camera.fov, distance: cameraFit?.distance ?? 0,
        worldPerPixelAtAnchor: cameraFit?.worldPerPixelAtAnchor ?? 0 },
      bookBounds: bounds, openWidthFraction: (bounds.right - bounds.left) / width,
    };
    options.onLayout?.(layout);
    metrics();
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
        && merged.sceneProgress === state.sceneProgress && merged.suspendFit === state.suspendFit
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
      leftMaterial.map = textures.staticLeft;
      rightMaterial.map = textures.staticRight;
      leafFrontMaterial.map = textures.turnFront;
      leafBackMaterial.map = textures.turnBack;
      leftMaterial.color.set(textures.staticLeft ? '#ffffff' : '#f4eedc');
      rightMaterial.color.set(textures.staticRight ? '#ffffff' : '#f4eedc');
      leafFrontMaterial.color.set(textures.turnFront ? '#ffffff' : '#f4eedc');
      leafBackMaterial.color.set(textures.turnBack ? '#ffffff' : '#f4eedc');
      leftMaterial.needsUpdate = true;
      rightMaterial.needsUpdate = true;
      leafFrontMaterial.needsUpdate = true;
      leafBackMaterial.needsUpdate = true;
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
      ownedCoverTexture?.dispose();
      ownedGeometries.forEach(geometry => geometry.dispose());
      ownedMaterials.forEach(material => material.dispose());
      key.shadow.map?.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      safeProbe.remove();
      layout = null;
    },
  };
}
