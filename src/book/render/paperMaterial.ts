import {
  Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial,
  NoColorSpace, RedFormat, RepeatWrapping, RGBAFormat, SRGBColorSpace, UnsignedByteType,
} from 'three';
import type { Texture } from 'three';

/**
 * v3 R2 lit paper (CONTRACT_V3 C7). A print texture is ink on white (or transparent paper);
 * the shader multiplies it into the paper colour and a procedural fibre, then mixes an RGBA
 * state layer (selection, focus, pressed, stamps) on top. The result is lit like any other
 * surface: no `toneMapped:false`, no unlit MeshBasicMaterial.
 */
export const PAPER_TOKENS = Object.freeze({ paper: '#f4eedc', roughness: 0.94, fibreRepeat: 7, fibreLow: 0.955 });

export interface PaperMaterial extends MeshStandardMaterial {
  setPrint(texture: Texture | null): void;
  setState(texture: Texture | null): void;
  readonly print: Texture | null;
}

let sharedWhite: DataTexture | null = null;
let sharedClear: DataTexture | null = null;
let sharedFibre: DataTexture | null = null;

function solid(rgba: readonly [number, number, number, number]): DataTexture {
  const texture = new DataTexture(new Uint8Array(rgba), 1, 1, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** 2-octave value noise with paper-like long fibres, tileable. Deterministic (seeded). */
export function createFibreData(size = 256, seed = 7): Uint8Array {
  let state = seed >>> 0;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const lattice = (cells: number) => Array.from({ length: cells * cells }, random);
  const sample = (grid: number[], cells: number, x: number, y: number) => {
    const gx = x * cells, gy = y * cells;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const at = (i: number, j: number) => grid[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)]!;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  };
  const coarse = lattice(16), fine = lattice(64), streak = lattice(96);
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const u = x / size, v = y / size;
    // Fibres run mostly along u: stretch the streak noise vertically.
    const value = 0.5 * sample(coarse, 16, u, v) + 0.3 * sample(fine, 64, u, v) + 0.2 * sample(streak, 96, u * 0.25, v);
    data[y * size + x] = Math.round(Math.max(0, Math.min(1, value)) * 255);
  }
  return data;
}

function fibreTexture(): DataTexture {
  if (sharedFibre) return sharedFibre;
  const size = 256;
  const texture = new DataTexture(createFibreData(size), size, size, RedFormat, UnsignedByteType);
  texture.colorSpace = NoColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  sharedFibre = texture;
  return texture;
}

export function paperPlaceholders(): { white: DataTexture; clear: DataTexture } {
  sharedWhite ??= solid([255, 255, 255, 255]);
  sharedClear ??= solid([0, 0, 0, 0]);
  return { white: sharedWhite, clear: sharedClear };
}

export const PAPER_FRAGMENT = /* glsl */`
#ifdef USE_MAP
  vec4 printSample = texture2D( map, vMapUv );
  vec3 ink = mix( vec3( 1.0 ), printSample.rgb, printSample.a );
  vec4 stateSample = texture2D( uPaperState, vMapUv );
  float fibre = texture2D( uPaperFibre, vMapUv * uPaperFibreRepeat ).r;
  vec3 albedo = uPaperColor * mix( uPaperFibreLow, 1.0, fibre ) * ink;
  albedo = mix( albedo, stateSample.rgb, stateSample.a );
  diffuseColor.rgb *= albedo;
#endif
`;

export function createPaperMaterial(options: Readonly<{ paper?: string; roughness?: number; name?: string }> = {}): PaperMaterial {
  const { white, clear } = paperPlaceholders();
  const uniforms = {
    uPaperState: { value: clear as Texture },
    uPaperFibre: { value: fibreTexture() as Texture },
    uPaperColor: { value: new Color(options.paper ?? PAPER_TOKENS.paper) },
    uPaperFibreRepeat: { value: PAPER_TOKENS.fibreRepeat },
    uPaperFibreLow: { value: PAPER_TOKENS.fibreLow },
  };
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: options.roughness ?? PAPER_TOKENS.roughness, metalness: 0, map: white }) as PaperMaterial;
  material.name = options.name ?? 'paper';
  let print: Texture | null = null;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uPaperState;
uniform sampler2D uPaperFibre;
uniform vec3 uPaperColor;
uniform float uPaperFibreRepeat;
uniform float uPaperFibreLow;`)
      .replace('#include <map_fragment>', PAPER_FRAGMENT);
  };
  material.customProgramCacheKey = () => 'v3-paper-1';
  Object.defineProperty(material, 'print', { get: () => print });
  material.setPrint = (texture) => {
    print = texture;
    material.map = texture ?? white;
  };
  material.setState = (texture) => { uniforms.uPaperState.value = texture ?? clear; };
  return material;
}

/** A fore-edge texture: thin sheet lines across the stack thickness (V = sheets). */
export function createForeEdgeTexture(): DataTexture {
  const height = 16;
  const data = new Uint8Array(4 * height);
  for (let row = 0; row < height; row += 1) {
    const shade = row === 0 ? 196 : row === 1 ? 214 : 236 - (row % 3) * 4;
    data.set([shade, shade - 6, shade - 18, 255], row * 4);
  }
  const texture = new DataTexture(data, 1, height, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
