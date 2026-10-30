/** Rendering profile: renderer path and quality tier. Pure, so tests can run it without a DOM. */
export type RendererKind = 'legacy' | 'ink';
export type QualityTier = 'high' | 'medium' | 'low';

export type ProfileNavigator = Readonly<{ hardwareConcurrency?: number; userAgent?: string; maxTouchPoints?: number }>;
export type BookProfile = Readonly<{ renderer: RendererKind; quality: QualityTier; qualitySource: 'auto' | 'url' | 'stored' }>;

const TIERS: readonly QualityTier[] = ['high', 'medium', 'low'];
export const QUALITY_STORAGE_KEY = 'duration-basics-lab:render-quality';

export function isQualityTier(value: unknown): value is QualityTier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}

/** Device heuristic from the design (R2): large canvases or few cores drop AO; phones drop post. */
export function pickQualityTier(nav: ProfileNavigator, devicePixelRatio: number, canvasCssPixels: number): QualityTier {
  const agent = nav.userAgent ?? '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(agent) || (nav.maxTouchPoints ?? 0) > 1 && /Macintosh/.test(agent);
  if (mobile) return 'low';
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const pixels = Number.isFinite(canvasCssPixels) && canvasCssPixels > 0 ? canvasCssPixels : 0;
  if (dpr * dpr * pixels > 2_400_000 || (nav.hardwareConcurrency ?? 8) <= 4) return 'medium';
  return 'high';
}

/**
 * `?renderer=legacy` mounts the frozen 5f2f7bb shell for before/after comparison until R9.
 * `?quality=high|medium|low` forces a tier for captures; otherwise a stored reader choice wins
 * over the device heuristic.
 */
export function resolveProfile(search: string, nav: ProfileNavigator, devicePixelRatio: number,
  canvasCssPixels: number, storedQuality: string | null = null): BookProfile {
  const params = new URLSearchParams(search);
  const renderer: RendererKind = params.get('renderer') === 'legacy' ? 'legacy' : 'ink';
  const forced = params.get('quality');
  if (isQualityTier(forced)) return { renderer, quality: forced, qualitySource: 'url' };
  if (isQualityTier(storedQuality)) return { renderer, quality: storedQuality, qualitySource: 'stored' };
  return { renderer, quality: pickQualityTier(nav, devicePixelRatio, canvasCssPixels), qualitySource: 'auto' };
}

export function readStoredQuality(): string | null {
  try { return globalThis.localStorage?.getItem(QUALITY_STORAGE_KEY) ?? null; } catch { return null; }
}

export function storeQuality(tier: QualityTier | null): void {
  try {
    if (tier) globalThis.localStorage?.setItem(QUALITY_STORAGE_KEY, tier);
    else globalThis.localStorage?.removeItem(QUALITY_STORAGE_KEY);
  } catch { /* storage may be blocked; the tier then lasts for this page only */ }
}

/** Browser profile for this page load. */
export function currentProfile(): BookProfile {
  if (typeof window === 'undefined') return { renderer: 'ink', quality: 'high', qualitySource: 'auto' };
  return resolveProfile(window.location.search, window.navigator, window.devicePixelRatio || 1,
    window.innerWidth * window.innerHeight, readStoredQuality());
}
