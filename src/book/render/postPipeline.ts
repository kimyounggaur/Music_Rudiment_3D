import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import type { Camera, Scene, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import type { QualityTier } from '../profile.ts';

/**
 * v3 R2 post chain (CONTRACT_V3 C7): Render → GTAO → SMAA → Vignette → Output (tone map + sRGB).
 * high = all passes, medium = no GTAO, low = no composer (the renderer's own MSAA and tone map).
 */
export const POST_TOKENS = Object.freeze({
  gtao: { radius: 0.18, distanceExponent: 1, thickness: 1, scale: 1, samples: 12, distanceFallOff: 1, blendIntensity: 0.9 },
  vignette: { offset: 0.95, darkness: 0.38 },
});

export function tierPasses(tier: QualityTier): readonly ('render' | 'gtao' | 'smaa' | 'vignette' | 'output')[] {
  if (tier === 'low') return [];
  return tier === 'high' ? ['render', 'gtao', 'smaa', 'vignette', 'output'] : ['render', 'smaa', 'vignette', 'output'];
}

export function tierPixelRatio(tier: QualityTier, devicePixelRatio: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr, tier === 'high' ? 2 : tier === 'medium' ? 1.5 : 1.25);
}

export interface PostPipeline {
  readonly tier: QualityTier;
  readonly passes: readonly string[];
  render(): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}

export function createPostPipeline(renderer: WebGLRenderer, scene: Scene, camera: Camera, tier: QualityTier): PostPipeline {
  const names = tierPasses(tier);
  if (!names.length) {
    return { tier, passes: names, render() { renderer.render(scene, camera); }, setSize() {}, dispose() {} };
  }
  const size = renderer.getSize(new Vector2());
  const target = new WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  let gtao: GTAOPass | null = null;
  if (names.includes('gtao')) {
    const { blendIntensity, ...parameters } = POST_TOKENS.gtao;
    gtao = new GTAOPass(scene, camera, Math.max(1, size.x), Math.max(1, size.y));
    gtao.updateGtaoMaterial(parameters);
    gtao.blendIntensity = blendIntensity;
    composer.addPass(gtao);
  }
  const smaa = new SMAAPass();
  composer.addPass(smaa);
  const vignette = new ShaderPass(VignetteShader);
  vignette.uniforms.offset.value = POST_TOKENS.vignette.offset;
  vignette.uniforms.darkness.value = POST_TOKENS.vignette.darkness;
  composer.addPass(vignette);
  composer.addPass(new OutputPass());
  return {
    tier, passes: names,
    render() { composer.render(); },
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    dispose() {
      gtao?.dispose();
      smaa.dispose();
      vignette.dispose();
      composer.dispose();
      target.dispose();
    },
  };
}
