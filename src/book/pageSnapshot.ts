import { CanvasTexture, SRGBColorSpace } from 'three';
import type { PageId } from './manifest.ts';

export type PageSnapshotIdentity = Readonly<{
  pageId: PageId;
  contentRevision: number;
  width: number;
  height: number;
  scale: number;
  fontVersion: string;
  /** Root and nested scroll positions, in DOM order, in page-local CSS pixels. */
  scrollSignature: string;
  /** Serialized visual state (for example an open explanation flap). */
  presentationSignature?: string;
  background?: string;
  presentationKey?: string;
}>;

export type PageSnapshotOptions = Readonly<{
  pageId: PageId;
  contentRevision: number;
  /** Self-contained @font-face rules using the same local bytes as the live notation. */
  fontCss: string;
  fontVersion: string;
  width?: number;
  height?: number;
  scale?: number;
  background?: string;
  /** Coordinator state not represented by native form values. */
  presentationKey?: string;
  /** Prewarm the ready/stopped appearance used immediately after navigation stops audio. */
  canonicalStopped?: boolean;
  signal?: AbortSignal;
  /** The coordinator checks its revision/token here before and after asynchronous work. */
  isCurrent?: () => boolean;
}>;

export type PageSnapshot = PageSnapshotIdentity & Readonly<{
  key: string;
  texture: CanvasTexture;
  dispose(): void;
}>;

const HTML = 'http://www.w3.org/1999/xhtml';
const SVG = 'http://www.w3.org/2000/svg';
const MAX_SIDE = 8192;

/** A committed layout may supersede an in-flight print between async steps. */
export class PageSnapshotLayoutError extends Error {
  constructor(pageId: PageId, width: number, height: number, actualWidth: number, actualHeight: number) {
    super(`Page ${pageId} print dimensions do not match the laid-out viewport (expected ${width}x${height}, actual ${actualWidth}x${actualHeight})`);
    this.name = 'PageSnapshotLayoutError';
  }
}

export function assertPageSnapshotLayout(source: Pick<HTMLElement, 'offsetWidth' | 'offsetHeight'>,
  pageId: PageId, width: number, height: number): void {
  // offset dimensions round fractional CSS pixels; keep the existing tolerance.
  if (Math.abs(source.offsetWidth - width) > 1 || Math.abs(source.offsetHeight - height) > 1) {
    throw new PageSnapshotLayoutError(pageId, width, height, source.offsetWidth, source.offsetHeight);
  }
}

/** Retry only layout races, at most twice. A stale revision is cancellation and
 * persistent layout/real raster failures still reach the coordinator's error path.
 */
export async function withPageSnapshotLayoutRetries<T>(capture: () => Promise<T>,
  waitForLayout: () => Promise<void>, isCurrent: () => boolean): Promise<T> {
  const check = () => { if (!isCurrent()) throw new DOMException('Page layout superseded', 'AbortError'); };
  for (let attempt = 0; ; attempt += 1) {
    check();
    await waitForLayout();
    check();
    try {
      const result = await capture();
      check();
      return result;
    } catch (reason) {
      check();
      if (!(reason instanceof PageSnapshotLayoutError) || attempt >= 2) throw reason;
    }
  }
}

export type CanonicalPrintPresentation = Readonly<{
  omit: boolean;
  disabled: boolean | undefined;
  text: string | undefined;
  clearActive: boolean;
  clearDash: boolean;
}>;

/** Metadata describes static musical restrictions; transient lifecycle/playback
 * disabling is intentionally excluded from a stopped page. Selection is retained.
 */
export function canonicalPrintPresentation(attributes: Readonly<Record<string, string | undefined>>): CanonicalPrintPresentation {
  const disabled = attributes['data-print-disabled'];
  if (disabled !== undefined && disabled !== 'true' && disabled !== 'false') throw new Error('Invalid canonical print disabled state');
  const highlight = attributes['data-score-highlight'] !== undefined;
  const selected = attributes['data-selected'] === 'true';
  return { omit: highlight && !selected, disabled: disabled === undefined ? undefined : disabled === 'true',
    text: attributes['data-print-text'], clearActive: attributes['data-active'] !== undefined,
    clearDash: highlight && selected };
}

/** Every condition affecting a print is explicit; there is no implicit global cache. */
export function pageSnapshotKey(identity: PageSnapshotIdentity): string {
  if (!/^page-[1-4]$/.test(identity.pageId) || !Number.isSafeInteger(identity.contentRevision) || identity.contentRevision < 0) {
    throw new Error('Invalid page snapshot identity');
  }
  if (![identity.width, identity.height, identity.scale].every(value => Number.isFinite(value) && value > 0)
    || identity.scale > 4 || Math.ceil(identity.width * identity.scale) > MAX_SIDE
    || Math.ceil(identity.height * identity.scale) > MAX_SIDE || !identity.fontVersion.trim()) {
    throw new Error('Invalid page snapshot dimensions or font version');
  }
  return JSON.stringify([identity.pageId, identity.contentRevision, identity.width, identity.height,
    identity.scale, identity.fontVersion, identity.scrollSignature, identity.presentationSignature ?? '',
    identity.background ?? '#f4eedc', identity.presentationKey ?? '']);
}

function checkCurrent(options: PageSnapshotOptions): void {
  if (options.signal?.aborted || options.isCurrent?.() === false) throw new DOMException('Page snapshot cancelled', 'AbortError');
}

/** External resource requests cannot silently become blank pixels in a page print. */
export function selfContainedCss(css: string, documentUrl?: string): string {
  if (/@import\b/i.test(css)) throw new Error('Page snapshots cannot import remote styles');
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_match, _quote: string, raw: string) => {
    const value = raw.trim();
    if (/^data:(?:font\/|application\/(?:font-|x-font-|vnd\.ms-fontobject)|image\/)/i.test(value) || value.startsWith('#')) return `url("${value}")`;
    if (documentUrl) {
      const resource = new URL(value, documentUrl);
      const current = new URL(documentUrl);
      if (resource.origin === current.origin && resource.pathname === current.pathname && resource.search === current.search && resource.hash) {
        return `url("${resource.hash}")`;
      }
    }
    throw new Error('Page snapshot contains a non-embedded resource');
  });
}

function copyStyle(source: Element, target: Element, view: Window, documentUrl: string): CSSStyleDeclaration {
  const computed = view.getComputedStyle(source);
  const style = (target as HTMLElement | SVGElement).style;
  for (const property of computed) {
    // Transitions/animations and focus rings are live input affordances, not moving print content.
    if (property.startsWith('animation') || property.startsWith('transition') || property.startsWith('outline')) continue;
    style.setProperty(property, selfContainedCss(computed.getPropertyValue(property), documentUrl));
  }
  style.setProperty('animation', 'none', 'important');
  style.setProperty('transition', 'none', 'important');
  style.setProperty('outline', 'none', 'important');
  style.setProperty('caret-color', 'transparent', 'important');
  style.setProperty('pointer-events', 'none', 'important');
  return computed;
}

function clonePrintedNode(node: Node, view: Window, documentUrl: string, canonicalStopped: boolean): Node | null {
  const doc = node.ownerDocument!;
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? '');
  if (!(node instanceof Element)) return null;
  if (['SCRIPT', 'STYLE', 'LINK', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT'].includes(node.tagName)) return null;
  if (node.matches('[data-snapshot-exclude]')) return null;
  const canonical = canonicalStopped ? canonicalPrintPresentation(Object.fromEntries([...node.attributes].map(attribute => [attribute.name, attribute.value]))) : null;
  if (canonical?.omit) return null;
  if (node instanceof HTMLCanvasElement || node instanceof HTMLVideoElement) throw new Error('Live canvas/video must have a separate page print representation');
  const clone = node.cloneNode(false) as Element;
  for (const attribute of [...clone.attributes]) {
    if (attribute.name.startsWith('on') || ['tabindex', 'autofocus', 'contenteditable', 'srcset'].includes(attribute.name.toLowerCase())) clone.removeAttribute(attribute.name);
    if (['href', 'xlink:href', 'src'].includes(attribute.name.toLowerCase())) {
      const value = attribute.value;
      if (node instanceof HTMLAnchorElement) clone.removeAttribute(attribute.name);
      else if (!value.startsWith('#') && !/^data:image\//i.test(value)) throw new Error('Page snapshot contains an external image or SVG reference');
    }
  }
  const computed = copyStyle(node, clone, view, documentUrl);
  for (const child of node.childNodes) {
    const printed = clonePrintedNode(child, view, documentUrl, canonicalStopped);
    if (printed) clone.appendChild(printed);
  }
  if (node instanceof HTMLInputElement) {
    clone.setAttribute('value', node.value);
    if (node.checked) clone.setAttribute('checked', ''); else clone.removeAttribute('checked');
  }
  if (node instanceof HTMLTextAreaElement) clone.textContent = node.value;
  if (node instanceof HTMLSelectElement) [...clone.querySelectorAll('option')].forEach((option, index) => {
    if (node.options[index]?.selected) option.setAttribute('selected', ''); else option.removeAttribute('selected');
  });
  if (node instanceof HTMLDetailsElement && node.open) clone.setAttribute('open', '');
  if (canonical) {
    if (canonical.disabled !== undefined) {
      clone.toggleAttribute('disabled', canonical.disabled);
      // Current button styling dims disabled controls; static restrictions keep it.
      if (clone instanceof HTMLButtonElement) clone.style.opacity = canonical.disabled ? '0.55' : '1';
    }
    if (canonical.text !== undefined) clone.textContent = canonical.text;
    if (canonical.clearActive) clone.setAttribute('data-active', 'false');
    if (canonical.clearDash) {
      clone.removeAttribute('stroke-dasharray');
      (clone as SVGElement).style.strokeDasharray = 'none';
    }
  }

  // scrollTop/scrollLeft are runtime state, not serialized HTML attributes. Preserve
  // each viewport using a fixed border box and translate its original padded layout.
  if (node instanceof HTMLElement && (node.scrollTop !== 0 || node.scrollLeft !== 0)) {
    // A native textarea paints its value through an anonymous control tree;
    // nested HTML cannot translate that value. Use an identically styled print
    // viewport for its scrolled text, retaining the same padding and font.
    const textarea = node instanceof HTMLTextAreaElement;
    const outer = textarea ? doc.createElementNS(HTML, 'div') : clone.cloneNode(false) as HTMLElement;
    if (textarea) outer.style.cssText = (clone as HTMLElement).style.cssText;
    outer.removeAttribute('id');
    outer.style.padding = '0';
    outer.style.overflow = 'hidden';
    outer.style.position = 'relative';
    outer.style.width = `${node.offsetWidth}px`;
    outer.style.height = `${node.offsetHeight}px`;
    outer.style.boxSizing = 'border-box';
    const clip = doc.createElementNS(HTML, 'div');
    clip.style.cssText = `position:absolute;left:0;top:0;width:${node.clientWidth}px;height:${node.clientHeight}px;overflow:hidden;`;
    const inner = textarea ? doc.createElementNS(HTML, 'div') : clone as HTMLElement;
    if (textarea) {
      inner.style.cssText = (clone as HTMLElement).style.cssText;
      inner.textContent = node.value;
      inner.style.whiteSpace = node.wrap === 'off' ? 'pre' : 'pre-wrap';
    }
    inner.style.position = 'relative';
    inner.style.left = '0';
    inner.style.top = '0';
    inner.style.margin = '0';
    inner.style.border = '0';
    inner.style.boxSizing = 'border-box';
    inner.style.width = `${node.clientWidth}px`;
    inner.style.height = `${node.scrollHeight}px`;
    inner.style.minHeight = '0';
    inner.style.maxHeight = 'none';
    inner.style.minWidth = '0';
    inner.style.maxWidth = 'none';
    inner.style.overflow = 'visible';
    // The viewport owns its stationary background and border.
    inner.style.background = 'transparent';
    // Chromium's SVG image raster path ignores the relative top/left offset
    // here even though inline SVG layout reports it. A transform preserves the
    // same clipped scroll viewport in both the DOM and the decoded page image.
    inner.style.transform = `translate(${-node.scrollLeft}px,${-node.scrollTop}px)`;
    clip.appendChild(inner);
    outer.appendChild(clip);
    return outer;
  }
  // Unsupported generated content must not disappear silently from a print.
  if (computed.display !== 'none' && node.namespaceURI === HTML) {
    for (const pseudo of ['::before', '::after']) {
      const content = view.getComputedStyle(node, pseudo).content;
      if (content && !['none', 'normal', '""', "''"].includes(content)) throw new Error('Page print requires explicit DOM for generated content');
    }
  }
  return clone;
}

function imageFromSvg(markup: string, options: PageSnapshotOptions): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const cleanup = () => { image.onload = null; image.onerror = null; options.signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); image.src = ''; reject(new DOMException('Page snapshot cancelled', 'AbortError')); };
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(new Error('Self-contained page print could not be decoded')); };
    options.signal?.addEventListener('abort', abort, { once: true });
    // A data URL keeps the nested foreignObject image origin-clean in Chromium;
    // object URLs for an SVG with foreignObject can taint the canvas instead.
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

/** Capture only a page's local viewport, not the projected 3D transform of its parent.
 * The source must be laid out (offscreen is fine) and have ready local notation.
 * The caller owns disposal, preparation barriers, and atomic DOM/texture swapping.
 */
export async function createPageSnapshot(source: HTMLElement, options: PageSnapshotOptions): Promise<PageSnapshot> {
  checkCurrent(options);
  const doc = source.ownerDocument;
  const view = doc.defaultView;
  if (!view || !source.isConnected || source.clientWidth === 0 || source.clientHeight === 0) throw new Error('Page print source is not laid out');
  if (view.getComputedStyle(source).visibility !== 'visible') throw new Error('Page print source must be visible; position preparation copies offscreen instead');
  if (!doc.fonts) throw new Error('Page print font readiness is unavailable');
  await doc.fonts.ready;
  checkCurrent(options);
  const notations = [...source.querySelectorAll('[data-notation-ready]')];
  if (notations.some(element => element.getAttribute('data-notation-ready') !== 'true')) {
    throw new Error('Page notation is not ready for printing');
  }
  if (notations.some(element => element.getAttribute('data-notation-revision') !== String(options.contentRevision))) {
    throw new Error('Page notation revision does not match the print revision');
  }
  const fontCss = selfContainedCss(options.fontCss);
  if (!fontCss.includes('@font-face') || !fontCss.includes('data:')) throw new Error('Embedded page notation fonts are required');
  const width = options.width ?? source.offsetWidth;
  const height = options.height ?? source.offsetHeight;
  assertPageSnapshotLayout(source, options.pageId, width, height);
  const descendants = [...source.querySelectorAll<HTMLElement>('*')];
  const scrollSignature = [source, ...descendants]
    .filter(element => element instanceof HTMLElement && (element === source || element.scrollTop !== 0 || element.scrollLeft !== 0))
    .map(element => [element === source ? 'root' : descendants.indexOf(element), element.scrollLeft, element.scrollTop]);
  const presentationSignature = JSON.stringify([options.canonicalStopped ?? false, descendants.flatMap((element, index) => {
    if (element instanceof HTMLDetailsElement) return [[index, 'details', element.open]];
    if (element instanceof HTMLInputElement) return [[index, 'input', element.value, element.checked]];
    if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return [[index, 'value', element.value]];
    return [];
  })]);
  const identity: PageSnapshotIdentity = { pageId: options.pageId, contentRevision: options.contentRevision,
    width, height, scale: options.scale ?? 2, fontVersion: options.fontVersion, scrollSignature: JSON.stringify(scrollSignature), presentationSignature,
    background: options.background ?? '#f4eedc', presentationKey: options.presentationKey ?? '' };
  const key = pageSnapshotKey(identity);
  const clone = clonePrintedNode(source, view, doc.URL, options.canonicalStopped ?? false) as HTMLElement;
  clone.style.position = 'relative';
  clone.style.left = '0'; clone.style.top = '0'; clone.style.margin = '0';
  clone.style.transform = 'none'; clone.style.transformOrigin = '0 0';
  clone.style.width = `${width}px`; clone.style.height = `${height}px`;
  clone.style.boxSizing = 'border-box'; clone.style.overflow = 'hidden';
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('xmlns', SVG);
  svg.setAttribute('width', String(Math.ceil(width * identity.scale)));
  svg.setAttribute('height', String(Math.ceil(height * identity.scale)));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const styles = doc.createElementNS(SVG, 'style');
  styles.textContent = fontCss;
  svg.appendChild(styles);
  const foreign = doc.createElementNS(SVG, 'foreignObject');
  foreign.setAttribute('x', '0'); foreign.setAttribute('y', '0'); foreign.setAttribute('width', String(width)); foreign.setAttribute('height', String(height));
  foreign.appendChild(clone); svg.appendChild(foreign);
  const image = await imageFromSvg(new XMLSerializer().serializeToString(svg), options);
  checkCurrent(options);
  assertPageSnapshotLayout(source, options.pageId, width, height);
  const canvas = doc.createElement('canvas');
  canvas.width = Math.ceil(width * identity.scale); canvas.height = Math.ceil(height * identity.scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Page print canvas is unavailable');
  context.fillStyle = identity.background!;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  // Detect a tainted canvas immediately, before it reaches the WebGL uploader.
  context.getImageData(0, 0, 1, 1);
  checkCurrent(options);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.name = `page-print:${options.pageId}:r${options.contentRevision}`;
  let disposed = false;
  return { ...identity, key, texture, dispose() {
    if (disposed) return;
    disposed = true; texture.dispose(); canvas.width = 0; canvas.height = 0;
  } };
}
