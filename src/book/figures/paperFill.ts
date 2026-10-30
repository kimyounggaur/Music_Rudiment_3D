import { Color, MeshDepthMaterial, MeshStandardMaterial, Vector3 } from 'three';
import { ENVIRONMENT_TOKENS } from '../render/environment.ts';

/**
 * v3 R4 paper fill (REFACTOR_DESIGN_V3 §6 R4 (2)). Figure faces are the same warm paper as the
 * page, lit like it, with ink hatching on faces turned away from the key light. The flat→standing
 * lift is an absolute morph target on the geometry (no custom vertex math), so shadows and the AO
 * pass follow it too. A per-vertex `inkGlow` lights the playing note (emissive accent), and a
 * per-vertex `inkReveal` threshold keeps each face hidden until the pen has drawn its outline.
 */
export const PAPER_FILL = Object.freeze({
  color: '#fbf6ec', roughness: 0.9,
  /** Hatch period in the figure's own units (a duration lane is 10 units long). */
  spacing: 0.55, strength: 0.55,
  /** World direction toward the key light (the environment's spot, above-front-left of the book). */
  light: Object.freeze(ENVIRONMENT_TOKENS.key.position.clone().normalize().toArray() as [number, number, number]),
  glow: '#b96335', glowAmount: 0.35,
});

export const PAPER_FILL_VERTEX_PARS = /* glsl */`
attribute float inkGlow;
attribute float inkReveal;
varying vec3 vInkPos;
varying float vInkGlow;
varying float vInkReveal;
`;
export const PAPER_FILL_VERTEX = /* glsl */`
vInkPos = position;
vInkGlow = inkGlow;
vInkReveal = inkReveal;
`;
export const PAPER_FILL_FRAGMENT_PARS = /* glsl */`
uniform vec3 uHatchA;
uniform vec3 uHatchB;
uniform float uHatchSpacing;
uniform float uHatchStrength;
uniform vec3 uHatchLight;
uniform vec3 uGlowColor;
uniform float uReveal;
varying vec3 vInkPos;
varying float vInkGlow;
varying float vInkReveal;
float inkHatchLine( float d ) {
  float f = abs( fract( d ) - 0.5 ) * 2.0;
  float aa = max( fwidth( d ) * 2.0, 1e-3 );
  return smoothstep( 0.8 - aa, 0.8 + aa, f );
}
`;
/** Hatch only what faces away from the key light; cross-hatch the darkest faces. */
export const PAPER_FILL_HATCH = /* glsl */`
#ifdef INK_HATCH
  vec3 inkLightDir = normalize( ( viewMatrix * vec4( uHatchLight, 0.0 ) ).xyz );
  float inkDark = 1.0 - clamp( dot( normal, inkLightDir ), 0.0, 1.0 );
  float inkA = inkHatchLine( dot( vInkPos, uHatchA ) / uHatchSpacing ) * smoothstep( 0.3, 0.55, inkDark );
  float inkB = inkHatchLine( dot( vInkPos, uHatchB ) / uHatchSpacing ) * smoothstep( 0.62, 0.85, inkDark );
  diffuseColor.rgb *= 1.0 - uHatchStrength * max( inkA, inkB );
#endif
`;
export const PAPER_FILL_REVEAL = /* glsl */`
  if ( uReveal < vInkReveal ) discard;
`;
export const PAPER_FILL_GLOW = /* glsl */`
totalEmissiveRadiance += uGlowColor * vInkGlow;
`;

type ShaderSource = { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string };
const ANCHORS: readonly (readonly ['vertex' | 'fragment', string])[] = [
  ['vertex', '#include <common>'], ['vertex', '#include <begin_vertex>'],
  ['fragment', '#include <common>'], ['fragment', 'void main() {'], ['fragment', '#include <normal_fragment_maps>'], ['fragment', '#include <emissivemap_fragment>'],
];

export function patchPaperFillShader(shader: ShaderSource, uniforms: Record<string, { value: unknown }>, hatch: boolean): void {
  for (const [stage, anchor] of ANCHORS) {
    if (!(stage === 'vertex' ? shader.vertexShader : shader.fragmentShader).includes(anchor)) throw new Error(`three standard shader changed: ${anchor} missing.`);
  }
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${PAPER_FILL_VERTEX_PARS}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${PAPER_FILL_VERTEX}`);
  shader.fragmentShader = `${hatch ? '#define INK_HATCH\n' : ''}${shader.fragmentShader}`
    .replace('#include <common>', `#include <common>\n${PAPER_FILL_FRAGMENT_PARS}`)
    .replace('void main() {', `void main() {\n${PAPER_FILL_REVEAL}`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${PAPER_FILL_HATCH}`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${PAPER_FILL_GLOW}`);
}

/** Shadow pass: faces the pen has not reached yet cast no shadow either. */
export function patchPaperFillDepthShader(shader: ShaderSource, reveal: { value: number }): void {
  for (const anchor of ['#include <common>', '#include <begin_vertex>']) if (!shader.vertexShader.includes(anchor)) throw new Error(`three depth shader changed: ${anchor} missing.`);
  if (!shader.fragmentShader.includes('void main() {')) throw new Error('three depth shader changed: main missing.');
  shader.uniforms.uReveal = reveal;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float inkReveal;\nvarying float vInkReveal;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInkReveal = inkReveal;');
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', `uniform float uReveal;\nvarying float vInkReveal;\nvoid main() {\n${PAPER_FILL_REVEAL}`);
}

export interface PaperFillMaterial extends MeshStandardMaterial {
  readonly hatch: boolean;
}

export type PaperFillOptions = Readonly<{ hatch?: boolean; spacing?: number; color?: string; reveal?: { value: number } }>;

export function createPaperFillMaterial(options: PaperFillOptions = {}): PaperFillMaterial {
  const hatch = options.hatch ?? true;
  const material = new MeshStandardMaterial({ color: options.color ?? PAPER_FILL.color, roughness: PAPER_FILL.roughness, metalness: 0 }) as PaperFillMaterial;
  material.name = 'ink-paper-fill';
  const uniforms = {
    uHatchA: { value: new Vector3(1, 0.35, 0.6).normalize() },
    uHatchB: { value: new Vector3(-0.6, 0.5, 1).normalize() },
    uHatchSpacing: { value: options.spacing ?? PAPER_FILL.spacing },
    uHatchStrength: { value: PAPER_FILL.strength },
    uHatchLight: { value: new Vector3(...PAPER_FILL.light).normalize() },
    uGlowColor: { value: new Color(PAPER_FILL.glow) },
    // Shared with the figure's ink: faces wait for their outline.
    uReveal: options.reveal ?? { value: 1 },
  };
  Object.defineProperty(material, 'hatch', { value: hatch });
  material.onBeforeCompile = shader => patchPaperFillShader(shader as unknown as ShaderSource, uniforms, hatch);
  material.customProgramCacheKey = () => `v3-paper-fill-1-${hatch ? 'hatch' : 'plain'}`;
  return material;
}

export function createPaperFillDepthMaterial(reveal: { value: number }): MeshDepthMaterial {
  const material = new MeshDepthMaterial();
  material.name = 'ink-paper-fill-depth';
  material.onBeforeCompile = shader => patchPaperFillDepthShader(shader as unknown as ShaderSource, reveal);
  material.customProgramCacheKey = () => 'v3-paper-fill-depth-1';
  return material;
}
