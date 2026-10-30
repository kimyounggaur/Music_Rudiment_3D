import {
  Color, DataTexture, ExtrudeGeometry, Fog, HemisphereLight, LinearFilter, LinearMipmapLinearFilter, Mesh,
  MeshStandardMaterial, NoColorSpace, Object3D, PlaneGeometry, PMREMGenerator, RepeatWrapping, RGBAFormat,
  Scene, Shape, SpotLight, SRGBColorSpace, UnsignedByteType, Vector3, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BOOK_DIMENSIONS } from '../geometry.ts';
import type { QualityTier } from '../profile.ts';

/**
 * v3 R2 desk, mat, room light and key light (CONTRACT_V3 C2, decision 3: linen).
 * Everything is procedural; no image, model or HDR asset is loaded.
 */
export const ENVIRONMENT_TOKENS = Object.freeze({
  background: '#b8b0a3', environmentIntensity: 0.38,
  key: { color: '#fff4e4', intensity: 3.0, position: new Vector3(-3.2, 7.5, 3.0), angle: 0.6, penumbra: 0.8, normalBias: 0.02, radius: 2.5, shadowIntensity: 0.78 },
  hemisphere: { sky: '#dfe8f4', ground: '#cbb08c', intensity: 0.22 },
  desk: { linen: '#c9bea9', roughness: 0.88, bumpScale: 0.35, repeat: 18, size: 48 },
  mat: { color: '#6f6a62', roughness: 0.95, thickness: 0.02, radius: 0.28 },
});

/** Seeded, tileable linen weave: irregular warp/weft threads with slubs. RGBA bytes. */
export function createLinenData(size = 512, seed = 11): Uint8Array {
  let state = seed >>> 0;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const pitch = 4;
  const threads = size / pitch;
  // Low thread-to-thread variation reads as linen; strong variation reads as plaid.
  const warp = Array.from({ length: threads }, () => 0.93 + random() * 0.07);
  const weft = Array.from({ length: threads }, () => 0.93 + random() * 0.07);
  const slubs = Array.from({ length: threads }, () => ({ start: random() * size, length: 12 + random() * 40, gain: 0.03 + random() * 0.05 }));
  const base = new Color(ENVIRONMENT_TOKENS.desk.linen);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const tx = Math.floor(x / pitch), ty = Math.floor(y / pitch);
    const fx = (x % pitch) / pitch, fy = (y % pitch) / pitch;
    // Over-under: alternate which thread is on top per cell.
    const warpOnTop = (tx + ty) % 2 === 0;
    const warpProfile = Math.sin(Math.PI * (fx + 0.5 / pitch)) ** 0.6;
    const weftProfile = Math.sin(Math.PI * (fy + 0.5 / pitch)) ** 0.6;
    const slub = slubs[tx]!;
    const along = (y - slub.start + size) % size;
    const slubGain = along < slub.length ? slub.gain * Math.sin(Math.PI * along / slub.length) : 0;
    const warpValue = warp[tx]! * (0.86 + 0.14 * warpProfile) + slubGain;
    const weftValue = weft[ty]! * (0.86 + 0.14 * weftProfile);
    const value = warpOnTop ? Math.max(warpValue, weftValue * 0.94) : Math.max(weftValue, warpValue * 0.94);
    const index = (y * size + x) * 4;
    const tone = Math.min(1.08, value);
    data[index] = Math.round(Math.min(255, base.r * 255 * tone));
    data[index + 1] = Math.round(Math.min(255, base.g * 255 * tone));
    data[index + 2] = Math.round(Math.min(255, base.b * 255 * tone));
    data[index + 3] = Math.round(Math.max(0, Math.min(1, (value - 0.7) / 0.4)) * 255);
  }
  return data;
}

function roundedRectangle(width: number, depth: number, radius: number): Shape {
  const shape = new Shape();
  const x = -width / 2, y = -depth / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

export interface BookEnvironment {
  readonly key: SpotLight;
  readonly objects: readonly Object3D[];
  dispose(): void;
}

export function createBookEnvironment(renderer: WebGLRenderer, scene: Scene, quality: QualityTier): BookEnvironment {
  const tokens = ENVIRONMENT_TOKENS;
  scene.background = new Color(tokens.background);
  scene.fog = new Fog(tokens.background, 20, 46);
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = tokens.environmentIntensity;

  const size = 512;
  const linen = createLinenData(size);
  const color = new DataTexture(linen, size, size, RGBAFormat, UnsignedByteType);
  color.colorSpace = SRGBColorSpace;
  const bump = new DataTexture(linen, size, size, RGBAFormat, UnsignedByteType);
  bump.colorSpace = NoColorSpace;
  for (const texture of [color, bump]) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(tokens.desk.repeat, tokens.desk.repeat);
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
  }
  const deskGeometry = new PlaneGeometry(tokens.desk.size, tokens.desk.size);
  const deskMaterial = new MeshStandardMaterial({ map: color, bumpMap: bump, bumpScale: tokens.desk.bumpScale, roughness: tokens.desk.roughness, metalness: 0 });
  const desk = new Mesh(deskGeometry, deskMaterial);
  desk.name = 'LinenDesk';
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -tokens.mat.thickness - 0.001;
  desk.receiveShadow = true;

  const D = BOOK_DIMENSIONS;
  const matGeometry = new ExtrudeGeometry(roundedRectangle(2 * D.coverWidth * 1.18, D.coverHeight * 1.22, tokens.mat.radius),
    { depth: tokens.mat.thickness, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 });
  matGeometry.rotateX(-Math.PI / 2);
  const matMaterial = new MeshStandardMaterial({ color: tokens.mat.color, roughness: tokens.mat.roughness, metalness: 0 });
  const mat = new Mesh(matGeometry, matMaterial);
  mat.name = 'DeskMat';
  mat.position.y = -tokens.mat.thickness - 0.004;
  mat.receiveShadow = true;

  const key = new SpotLight(tokens.key.color, tokens.key.intensity, 0, tokens.key.angle, tokens.key.penumbra, 0);
  key.name = 'KeyLight';
  key.position.copy(tokens.key.position);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  const mapSize = quality === 'low' ? 1024 : 2048;
  key.shadow.mapSize.set(mapSize, mapSize);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 22;
  key.shadow.normalBias = tokens.key.normalBias;
  key.shadow.bias = -0.0002;
  key.shadow.radius = tokens.key.radius;
  key.shadow.intensity = tokens.key.shadowIntensity;
  const hemisphere = new HemisphereLight(tokens.hemisphere.sky, tokens.hemisphere.ground, tokens.hemisphere.intensity);
  hemisphere.name = 'RoomFill';

  const objects = [desk, mat, key, key.target, hemisphere];
  scene.add(...objects);
  return {
    key, objects,
    dispose() {
      scene.remove(...objects);
      key.shadow.map?.dispose();
      deskGeometry.dispose(); deskMaterial.dispose(); color.dispose(); bump.dispose();
      matGeometry.dispose(); matMaterial.dispose();
      environment.dispose();
      if (scene.environment === environment) scene.environment = null;
      scene.fog = null;
    },
  };
}
