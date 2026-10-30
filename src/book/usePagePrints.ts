import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Texture } from 'three';
import { ensureBookNotationReady } from './BookNotation.tsx';
import { getScene } from '../content/lesson.ts';
import { BOOK_MANIFEST } from './manifest.ts';
import type { PageId } from './manifest.ts';
import { pageNotationReady } from './notationPreparation.ts';
import { assertPageSnapshotLayout, createPageSnapshot, withPageSnapshotLayoutRetries } from './pageSnapshot.ts';
import type { PageSnapshot } from './pageSnapshot.ts';

export type PagePrintOptions = Readonly<{
  root: RefObject<HTMLElement | null>;
  revision: number;
  width: number;
  height: number;
  enabled: boolean;
  pageIds?: readonly PageId[];
  preparationEpoch?: number;
  /** Persistent UI state such as mute/error, excluding playback frame positions. */
  presentationKey?: string;
  /** v3 R2: prints are ink on white; the lit paper shader supplies the paper colour. */
  background?: string;
  onError?: (error: Error) => void;
}>;

export type PagePrintState = Readonly<{
  /** Borrowed textures. The hook owns their lifetime; do not dispose them in stage. */
  textures: Map<PageId, Texture>;
  ready: boolean;
  generation: number;
  /** Invalidates ready immediately; call after stopping audio before preparing a turn. */
  refresh(): void;
}>;

const PAGE_IDS = BOOK_MANIFEST.flatMap(spread => [spread.leftPageId, spread.rightPageId]);
const scoreCount = (id: PageId) => {
  const spread = BOOK_MANIFEST.find(spread => spread.leftPageId === id || spread.rightPageId === id);
  if (!spread) throw new RangeError(`Unknown print page ${id}`);
  return spread.leftPageId === id ? getScene(spread.sceneId).lanes.length : 0;
};
type PrintBatch = Map<PageId, PageSnapshot>;
type Publication = { textures: Map<PageId, Texture>; generation: number; identity: string };

function disposeBatch(batch: PrintBatch): void {
  batch.forEach(print => print.dispose());
  batch.clear();
}

function pageSources(root: HTMLElement, revision: number, preparationEpoch: number, pageIds: readonly PageId[]): Map<PageId, HTMLElement> | null {
  const pages = new Map<PageId, HTMLElement>();
  let ready = true;
  for (const id of pageIds) {
    const matches = root.querySelectorAll<HTMLElement>(`[data-print-page="${id}"]`);
    if (matches.length !== 1) { ready = false; continue; }
    const source = matches[0];
    const scores = [...source.querySelectorAll('[data-notation-ready]')];
    // Inspect every current marker before returning pending. A different score
    // still loading must not hide a renderer error in this or a later page.
    const scoreStates = scores.map(score => pageNotationReady(score, id, revision, preparationEpoch));
    if (!source.isConnected || !source.clientWidth || !source.clientHeight || scores.length !== scoreCount(id)
      || scoreStates.some(value => !value)) ready = false;
    pages.set(id, source);
  }
  return ready ? pages : null;
}

function abortableLayoutFrames(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let frame = 0;
    const abort = () => { cancelAnimationFrame(frame); reject(new DOMException('Page layout cancelled', 'AbortError')); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        signal.removeEventListener('abort', abort);
        if (signal.aborted) { abort(); return; }
        resolve();
      });
    });
  });
}

/** Bounded adjacent-page preparation barrier. Observer filters intentionally exclude
 * score highlights, playback attributes and hover, so audio frames never bake prints.
 */
export function usePagePrints({ root, revision, width, height, enabled, pageIds = PAGE_IDS, preparationEpoch = 0, presentationKey = '', background = '#f4eedc', onError }: PagePrintOptions): PagePrintState {
  const [publication, setPublication] = useState<Publication>(() => ({ textures: new Map(), generation: 0, identity: '' }));
  const [ready, setReady] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const active = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const invalidated = useRef(true);
  const owned = useRef<PrintBatch>(new Map());
  const retired = useRef<PrintBatch[]>([]);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const identity = JSON.stringify([revision, width, height, pageIds, preparationEpoch, presentationKey, background, refreshVersion]);

  // A DOM resize commits before passive-effect cleanup. Invalidate during that
  // commit so an older async capture cannot mistake the new size for a failure.
  useLayoutEffect(() => {
    const invalidate = () => {
      invalidated.current = true;
      sequence.current += 1;
      active.current?.abort();
    };
    invalidate();
    return invalidate;
  }, [root, enabled, identity]);

  const refresh = useCallback(() => {
    invalidated.current = true;
    sequence.current += 1;
    active.current?.abort();
    setReady(false);
    setRefreshVersion(value => value + 1);
  }, []);

  useEffect(() => {
    const element = root.current;
    invalidated.current = true;
    setReady(false);
    sequence.current += 1;
    active.current?.abort();
    if (!enabled) {
      if (owned.current.size) {
        retired.current.push(owned.current);
        owned.current = new Map();
        setPublication(previous => ({ textures: new Map(), generation: previous.generation + 1, identity: '' }));
      }
      return;
    }
    if (!element || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    let alive = true;
    let scheduled = 0;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const report = (phase: string, details: Record<string, unknown> = {}) => {
      if (import.meta.env.DEV) element.dataset.printPreparation = JSON.stringify({ phase, revision,
        pages: pageIds, request: sequence.current, ...details });
    };

    const cancelScheduled = () => {
      cancelAnimationFrame(scheduled);
      scheduled = 0;
      clearTimeout(scrollTimer);
      scrollTimer = undefined;
    };

    const capture = async () => {
      const request = ++sequence.current;
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      const current = () => alive && !controller.signal.aborted && request === sequence.current;
      const batch: PrintBatch = new Map();
      try {
        report('fonts');
        const fonts = await ensureBookNotationReady();
        if (!current()) return;
        const captured = await withPageSnapshotLayoutRetries(async () => {
          // A retried batch never retains pages from its superseded layout.
          disposeBatch(batch);
          const pages = pageSources(element, revision, preparationEpoch, pageIds);
          // Notation mutations or an explicit refresh retry unready scores.
          if (!pages) { report('notation-pending'); return false; }
          for (const id of pageIds) {
            if (!current()) return false;
            report('capturing', { pageId: id, completed: batch.size });
            const source = pages.get(id)!;
            assertPageSnapshotLayout(source, id, width, height);
            const print = await createPageSnapshot(source, { pageId: id, contentRevision: revision,
              width, height, scale: 2, fontCss: fonts.fontCss, fontVersion: fonts.fontVersion,
              presentationKey, canonicalStopped: true, signal: controller.signal, isCurrent: current, background });
            batch.set(id, print);
          }
          if (!pageSources(element, revision, preparationEpoch, pageIds)) return false;
          for (const [id, source] of pages) assertPageSnapshotLayout(source, id, width, height);
          return true;
        }, () => abortableLayoutFrames(controller.signal), current);
        if (!captured || !current()) return;
        const previous = owned.current;
        owned.current = new Map(batch);
        batch.clear();
        if (previous.size) retired.current.push(previous);
        const textures = new Map<PageId, Texture>([...owned.current].map(([id, print]) => [id, print.texture]));
        invalidated.current = false;
        report('ready', { count: textures.size });
        setPublication(previousPublication => ({ textures, generation: previousPublication.generation + 1, identity }));
        setReady(true);
      } catch (reason) {
        report(current() ? 'error' : 'cancelled', { message: reason instanceof Error ? reason.message : String(reason) });
        if (current() && !(reason instanceof DOMException && reason.name === 'AbortError')) {
          onErrorRef.current?.(reason instanceof Error ? reason : new Error(String(reason)));
        }
      } finally {
        disposeBatch(batch);
        if (active.current === controller) active.current = null;
      }
    };

    const queue = (debounceScroll = false) => {
      if (!alive) return;
      invalidated.current = true;
      sequence.current += 1;
      active.current?.abort();
      setReady(false);
      cancelScheduled();
      const schedule = () => { scheduled = requestAnimationFrame(() => { scheduled = 0; void capture(); }); };
      if (debounceScroll) scrollTimer = setTimeout(schedule, 80);
      else schedule();
    };

    const containsRelevantNode = (node: Node) => node instanceof Element
      && (node.matches('[data-print-page], [data-notation-ready]') || !!node.querySelector('[data-print-page], [data-notation-ready]'));
    const observer = new MutationObserver(records => {
      if (records.some(record => record.type === 'attributes'
        || (record.target instanceof Element ? record.target : record.target.parentElement)?.closest('.book-progress-tools')
        || [...record.addedNodes, ...record.removedNodes].some(containsRelevantNode))) queue();
    });
    observer.observe(element, { subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['data-notation-ready', 'data-notation-revision', 'data-notation-epoch', 'data-notation-status', 'data-notation-error', 'data-print-page'] });
    const scroll = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-print-page]')) queue(true);
    };
    const toggle = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-print-page]')) queue();
    };
    element.addEventListener('scroll', scroll, true);
    element.addEventListener('toggle', toggle, true);
    element.addEventListener('input', toggle, true);
    element.addEventListener('change', toggle, true);
    queue();
    return () => {
      alive = false;
      invalidated.current = true;
      sequence.current += 1;
      active.current?.abort();
      cancelScheduled();
      observer.disconnect();
      element.removeEventListener('scroll', scroll, true);
      element.removeEventListener('toggle', toggle, true);
      element.removeEventListener('input', toggle, true);
      element.removeEventListener('change', toggle, true);
    };
  }, [root, revision, width, height, enabled, pageIds, preparationEpoch, presentationKey, background, identity]);

  // This passive effect runs after the published map's React commit. Disposing
  // in the following frame lets BookApp's stage swap effect borrow the new map
  // before any previous texture is released.
  useEffect(() => {
    if (!retired.current.length) return;
    const frame = requestAnimationFrame(() => {
      const batches = retired.current.splice(0);
      batches.forEach(disposeBatch);
    });
    return () => cancelAnimationFrame(frame);
  }, [publication.generation]);

  useEffect(() => () => {
    invalidated.current = true;
    sequence.current += 1;
    active.current?.abort();
    disposeBatch(owned.current);
    retired.current.splice(0).forEach(disposeBatch);
  }, []);

  return { textures: publication.textures, generation: publication.generation,
    // Event handlers may refresh then inspect this same object before React flushes.
    get ready() { return enabled && ready && !invalidated.current && publication.identity === identity; }, refresh };
}
