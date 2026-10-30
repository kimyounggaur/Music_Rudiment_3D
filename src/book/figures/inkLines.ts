import { Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBufferAttribute } from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

/**
 * v3 R4 ink lines (REFACTOR_DESIGN_V3 §6 R4 (1), CONTRACT_V3 C6). Screen-space lines (three's
 * LineMaterial, CSS-pixel width at any distance) with two extra instance attributes: a flat
 * position on the paper and a pen schedule. `uLift` morphs every segment from its flat drawing to
 * its standing position; `uReveal` draws the segments in pen order, each from its start to its end.
 * The line quad is drawn `aaPad` px wider than the ink and the fragment covers exactly the ink
 * width with a one-pixel ramp, so a 1.4 px line is 1.4 px wide wherever it falls on the pixel grid.
 */
export const INK = Object.freeze({
  color: '#252721', accent: '#b96335', paper: '#fbf6ec',
  /** CSS px (design: 1.2–1.6 px at every distance). */
  width: 1.4, accentWidth: 2.2, playheadWidth: 1.6,
  /** Extra quad width (px) that carries the anti-aliased edge of the ink. */
  aaPad: 1.5,
  /** Flat drawings sit this far above the paper, in the figure's own units. */
  floor: 0.004,
  /** Default segment capacity of one line set; a larger set reallocates (design fallback). */
  capacity: 256,
  /** Design budget: segments per figure. */
  figureBudget: 3000,
  dashSize: 0.09, gapSize: 0.055,
});

export type Vec3 = readonly [number, number, number];
/**
 * One straight ink stroke. `flatStart/flatEnd` default to the standing position (ink that lies on
 * the paper). `t0/dur` are the pen schedule in the figure's 0..1 reveal time (0/0 = always drawn).
 * `tone` lightens the ink toward the paper (0 = full ink; the design's per-line density bias).
 */
export type InkSegment = Readonly<{ start: Vec3; end: Vec3; flatStart?: Vec3; flatEnd?: Vec3; t0?: number; dur?: number; tone?: number }>;
export type InkUniforms = Readonly<{ uLift: { value: number }; uReveal: { value: number } }>;
/** Per-material ink width (px), separate from the padded quad width LineMaterial draws. */
export type InkWidthUniform = { value: number };

export function createInkUniforms(lift = 1, reveal = 1): InkUniforms {
  return { uLift: { value: lift }, uReveal: { value: reveal } };
}

export const INK_VERTEX_PARS = /* glsl */`
attribute vec3 instanceFlatStart;
attribute vec3 instanceFlatEnd;
attribute vec2 instanceReveal;
uniform float uLift;
varying vec2 vReveal;
varying float vSegmentT;
`;
export const INK_FRAGMENT_PARS = /* glsl */`
uniform float uReveal;
uniform float uInkWidth;
varying vec2 vReveal;
varying float vSegmentT;
`;
/** A segment is inked from its start: pixels past the pen's local progress are not drawn yet. */
export const INK_FRAGMENT_REVEAL = /* glsl */`
  float inkLocal = ( uReveal - vReveal.x ) / max( vReveal.y, 1e-4 );
  if ( uReveal <= 0.0 || inkLocal < vSegmentT ) discard;
`;

export type ShaderSource = { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string };
const START = /vec4 start = modelViewMatrix \* vec4\( instanceStart, 1\.0 \);/;
const END = /vec4 end = modelViewMatrix \* vec4\( instanceEnd, 1\.0 \);/;

/**
 * Coverage of the ink across the (padded) line quad: |vUv.x| is the distance from the centre line
 * in half-quads, the caps continue radially. One-pixel linear ramp at the ink's edge.
 */
export const INK_FRAGMENT_COVERAGE = /* glsl */`
  float inkHalfQuad = 0.5 * linewidth;
  float inkCapRun = max( abs( vUv.y ) - 1.0, 0.0 );
  float inkDistance = length( vec2( vUv.x, inkCapRun ) ) * inkHalfQuad;
  float inkCoverage = clamp( 0.5 * uInkWidth + 0.5 - inkDistance, 0.0, 1.0 );
  if ( inkCoverage <= 0.0 ) discard;
  alpha *= inkCoverage;
`;
const FRAG_COLOR = 'gl_FragColor = vec4( diffuseColor.rgb, alpha );';
/** View-space pull toward the eye (≈ 7 mm at the reading distance of 5 world units). */
export const INK_PULL = '0.9985';

/** Patch three's line shader; throws if its source no longer has the expected anchors. */
export function patchInkShader(shader: ShaderSource, uniforms: InkUniforms, width: InkWidthUniform = { value: INK.width }): void {
  if (!shader.vertexShader.includes('attribute vec3 instanceEnd;') || !START.test(shader.vertexShader) || !END.test(shader.vertexShader)
    || !shader.fragmentShader.includes('void main() {') || !shader.fragmentShader.includes(FRAG_COLOR)) throw new Error('three LineMaterial shader changed: ink patch anchors missing.');
  shader.uniforms.uLift = uniforms.uLift;
  shader.uniforms.uReveal = uniforms.uReveal;
  shader.uniforms.uInkWidth = width;
  shader.vertexShader = shader.vertexShader
    .replace('attribute vec3 instanceEnd;', `attribute vec3 instanceEnd;\n${INK_VERTEX_PARS}`)
    // position.y runs 0 → 1 from the segment's start to its end (caps lie outside, clamped).
    // Scaling a view-space point toward the eye keeps its projection and only brings its depth
    // closer: ink on a face's edge is not hidden by the face sloping toward the camera next to it.
    .replace(START, `vReveal = instanceReveal;
			vSegmentT = clamp( position.y, 0.0, 1.0 );
			vec4 start = modelViewMatrix * vec4( mix( instanceFlatStart, instanceStart, uLift ), 1.0 );
			start.xyz *= ${INK_PULL};`)
    .replace(END, `vec4 end = modelViewMatrix * vec4( mix( instanceFlatEnd, instanceEnd, uLift ), 1.0 );
			end.xyz *= ${INK_PULL};`);
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', `${INK_FRAGMENT_PARS}\nvoid main() {\n${INK_FRAGMENT_REVEAL}`)
    .replace(FRAG_COLOR, `#ifndef WORLD_UNITS\n${INK_FRAGMENT_COVERAGE}\n#endif\n${FRAG_COLOR}`);
}

export type InkMaterialOptions = Readonly<{ width?: number; dashed?: boolean; dashSize?: number; gapSize?: number; depthTest?: boolean }>;

/**
 * The ink material. Colour comes from per-segment vertex colours (ink mixed toward the paper by
 * `tone`), so the material itself is white.
 */
export function createInkMaterial(uniforms: InkUniforms, options: InkMaterialOptions = {}): LineMaterial {
  const inkWidth: InkWidthUniform = { value: options.width ?? INK.width };
  const material = new LineMaterial({ color: 0xffffff, linewidth: inkWidth.value + INK.aaPad, worldUnits: false, vertexColors: true,
    dashed: options.dashed ?? false, dashSize: options.dashSize ?? INK.dashSize, gapSize: options.gapSize ?? INK.gapSize,
    depthTest: options.depthTest ?? true, transparent: true, depthWrite: false });
  material.name = options.dashed ? 'ink-line-dashed' : 'ink-line';
  material.userData.inkWidth = inkWidth;
  // Flat strokes lie on the paper: pull them toward the camera like printed ink (no z-fighting).
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -4;
  material.onBeforeCompile = shader => patchInkShader(shader as unknown as ShaderSource, uniforms, inkWidth);
  material.customProgramCacheKey = () => 'v3-ink-line-2';
  return material;
}

/** Pen scheduler: strokes overlap a little, longer strokes take longer; finalize() maps all to 0..1. */
export type PenSlot = { t0: number; dur: number };
export interface Pen {
  next(length: number): PenSlot;
  /** A breath between groups of strokes: the next group starts after the last stroke ends. */
  pause(amount: number): void;
  /** Normalise every issued slot to the 0..1 reveal range; returns the raw total (≥ 1e-6). */
  finalize(): number;
}
export function createPen(options: Readonly<{ baseDur?: number; overlap?: number; unit?: number }> = {}): Pen {
  const base = options.baseDur ?? 0.3, overlap = options.overlap ?? 0.55, unit = options.unit ?? 1;
  const slots: PenSlot[] = [];
  let cursor = 0, lastEnd = 0;
  return {
    next(length) {
      const dur = base * (0.6 + Math.min(1.4, Math.max(0, Number.isFinite(length) ? length : 0) / unit));
      // Stroke ends never go backwards, so the last stroke always finishes the drawing.
      const end = Math.max(cursor + dur, lastEnd);
      const slot = { t0: cursor, dur: end - cursor };
      slots.push(slot);
      lastEnd = end;
      cursor += dur * overlap;
      return slot;
    },
    pause(amount) { cursor = Math.max(cursor, lastEnd) + Math.max(0, Number.isFinite(amount) ? amount : 0); },
    finalize() {
      const total = Math.max(1e-6, lastEnd);
      for (const slot of slots) { slot.t0 /= total; slot.dur /= total; }
      return total;
    },
  };
}

export type InkLinesOptions = InkMaterialOptions & Readonly<{ color?: string; capacity?: number; name?: string }>;
type Buffers = { positions: InstancedInterleavedBuffer; flats: InstancedInterleavedBuffer; colors: InstancedInterleavedBuffer; distances: InstancedInterleavedBuffer; reveal: InstancedBufferAttribute };

/**
 * A set of ink segments sharing one material. Buffers are allocated for `capacity` segments and
 * reused; a larger set moves to a new, larger geometry (the old one is disposed).
 */
export class InkLines {
  readonly object: LineSegments2;
  readonly material: LineMaterial;
  #geometry: LineSegmentsGeometry;
  #buffers: Buffers;
  #capacity: number;
  #count = 0;
  #disposed = false;
  readonly #ink: Color;
  readonly #paper = new Color(INK.paper);
  readonly #mix = new Color();

  constructor(uniforms: InkUniforms, options: InkLinesOptions = {}) {
    this.material = createInkMaterial(uniforms, options);
    this.#ink = new Color(options.color ?? INK.color);
    this.#capacity = Math.max(1, Math.ceil(options.capacity ?? INK.capacity));
    this.#geometry = new LineSegmentsGeometry();
    this.#buffers = InkLines.#allocate(this.#geometry, this.#capacity);
    this.object = new LineSegments2(this.#geometry, this.material);
    this.object.name = options.name ?? 'ink';
    // Flat and standing positions differ; culling against either bound could drop visible ink.
    this.object.frustumCulled = false;
    // three's GTAO/SSAO/Outline passes hide fat lines from their normal/depth override pass by
    // this flag (they test isLine2, not isLineSegments2); without it the line quads would be drawn
    // as untransformed geometry into the AO normal buffer.
    (this.object as LineSegments2 & { isLine2: boolean }).isLine2 = true;
    this.object.visible = false;
  }

  static #allocate(geometry: LineSegmentsGeometry, capacity: number): Buffers {
    const interleaved = (stride: number) => new InstancedInterleavedBuffer(new Float32Array(capacity * stride), stride, 1).setUsage(DynamicDrawUsage);
    const buffers: Buffers = { positions: interleaved(6), flats: interleaved(6), colors: interleaved(6), distances: interleaved(2),
      reveal: new InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(DynamicDrawUsage) };
    geometry.setAttribute('instanceStart', new InterleavedBufferAttribute(buffers.positions, 3, 0));
    geometry.setAttribute('instanceEnd', new InterleavedBufferAttribute(buffers.positions, 3, 3));
    geometry.setAttribute('instanceFlatStart', new InterleavedBufferAttribute(buffers.flats, 3, 0));
    geometry.setAttribute('instanceFlatEnd', new InterleavedBufferAttribute(buffers.flats, 3, 3));
    geometry.setAttribute('instanceColorStart', new InterleavedBufferAttribute(buffers.colors, 3, 0));
    geometry.setAttribute('instanceColorEnd', new InterleavedBufferAttribute(buffers.colors, 3, 3));
    geometry.setAttribute('instanceDistanceStart', new InterleavedBufferAttribute(buffers.distances, 1, 0));
    geometry.setAttribute('instanceDistanceEnd', new InterleavedBufferAttribute(buffers.distances, 1, 1));
    geometry.setAttribute('instanceReveal', buffers.reveal);
    geometry.instanceCount = 0;
    return buffers;
  }

  get count(): number { return this.#count; }
  get capacity(): number { return this.#capacity; }
  get geometry(): LineSegmentsGeometry { return this.#geometry; }

  /** Replace every segment. */
  set(segments: readonly InkSegment[]): void {
    if (this.#disposed) throw new Error('Ink lines were disposed.');
    if (segments.length > this.#capacity) {
      let capacity = this.#capacity;
      while (capacity < segments.length) capacity *= 2;
      const previous = this.#geometry;
      this.#geometry = new LineSegmentsGeometry();
      this.#buffers = InkLines.#allocate(this.#geometry, capacity);
      this.#capacity = capacity;
      this.object.geometry = this.#geometry;
      previous.dispose();
    }
    const { positions, flats, colors, distances, reveal } = this.#buffers;
    const p = positions.array as Float32Array, f = flats.array as Float32Array, c = colors.array as Float32Array;
    const d = distances.array as Float32Array, r = reveal.array as Float32Array;
    let distance = 0;
    segments.forEach((segment, index) => {
      const flatStart = segment.flatStart ?? segment.start, flatEnd = segment.flatEnd ?? segment.end;
      p.set(segment.start, index * 6); p.set(segment.end, index * 6 + 3);
      f.set(flatStart, index * 6); f.set(flatEnd, index * 6 + 3);
      const tone = Math.max(0, Math.min(1, segment.tone ?? 0));
      this.#mix.copy(this.#ink).lerp(this.#paper, tone);
      c.set([this.#mix.r, this.#mix.g, this.#mix.b, this.#mix.r, this.#mix.g, this.#mix.b], index * 6);
      // Continuous dash phase along the set, measured on the standing drawing (three's convention).
      const length = Math.hypot(segment.end[0] - segment.start[0], segment.end[1] - segment.start[1], segment.end[2] - segment.start[2]);
      d[index * 2] = distance; d[index * 2 + 1] = distance + length;
      distance += length;
      r[index * 2] = segment.t0 ?? 0; r[index * 2 + 1] = segment.dur ?? 0;
    });
    this.#count = segments.length;
    this.#geometry.instanceCount = segments.length;
    positions.needsUpdate = true; flats.needsUpdate = true; colors.needsUpdate = true; distances.needsUpdate = true; reveal.needsUpdate = true;
    this.#geometry.boundingBox = null;
    this.#geometry.boundingSphere = null;
    this.object.visible = segments.length > 0;
  }

  /** Read back one segment (tests and inspection). */
  segment(index: number): { start: Vec3; end: Vec3; flatStart: Vec3; flatEnd: Vec3; t0: number; dur: number; color: Vec3 } | null {
    if (index < 0 || index >= this.#count) return null;
    const at = (array: ArrayLike<number>, offset: number): Vec3 => [array[offset]!, array[offset + 1]!, array[offset + 2]!];
    const { positions, flats, colors, reveal } = this.#buffers;
    return { start: at(positions.array, index * 6), end: at(positions.array, index * 6 + 3), flatStart: at(flats.array, index * 6),
      flatEnd: at(flats.array, index * 6 + 3), t0: reveal.array[index * 2]!, dur: reveal.array[index * 2 + 1]!, color: at(colors.array, index * 6) };
  }

  /** Viewport size in CSS px: LineMaterial widths are screen pixels of this resolution. */
  setResolution(width: number, height: number): void {
    if (width > 0 && height > 0 && (this.material.resolution.x !== width || this.material.resolution.y !== height)) this.material.resolution.set(width, height);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.object.removeFromParent();
    this.#geometry.dispose();
    this.material.dispose();
    this.#count = 0;
  }
}
