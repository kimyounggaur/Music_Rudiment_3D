import { useEffect, useRef } from 'react';
import { BookProgressContent } from '../BookProgressTools.tsx';
import type { BookProgressToolsProps } from '../BookProgressTools.tsx';

/**
 * v3 R5 records dialog (REFACTOR_DESIGN_V3 §6 R5 (4), C1): the backup, export, import, delete and
 * settings tools in a modal outside the book. While it is open the rest of the app is inert (native
 * modal) and the book does not take arrow keys (EN02). Its content exists only while it is open.
 */
export type RecordsDialogProps = BookProgressToolsProps & Readonly<{
  open: boolean;
  /** Shown above the tools when automatic saving stopped. */
  storageNotice: string | null;
  onClose(): void;
}>;

export function RecordsDialog(props: RecordsDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { open, onOpen } = props;
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      // Opening the records stops playback, as the page tools did.
      onOpen();
      if (typeof element.showModal === 'function') element.showModal(); else element.setAttribute('open', '');
    } else if (!open && element.open) element.close();
  }, [open, onOpen]);
  // Escape is a cancel request: close through our own state at once. The native 'close' event can
  // arrive late (seen in Chromium on the next input), and until then the book would still treat the
  // dialog as open; with the state already closed, that late event finds `open` false and does nothing.
  return <dialog ref={dialog} className="book-records" aria-labelledby="book-records-title" data-testid="records-dialog"
    onCancel={event => { event.preventDefault(); if (open) props.onClose(); }}
    onClose={() => { if (open) props.onClose(); }}>
    {open && <>
      <div className="book-records-heading">
        <h2 id="book-records-title">기록과 설정</h2>
        <button type="button" className="book-text-button" data-testid="records-close" onClick={props.onClose}>닫기</button>
      </div>
      {props.storageNotice && <p className="book-page-error" role="status">자동 저장을 멈췄어요. {props.storageNotice}</p>}
      <div className="book-progress-tools book-records-body" data-book-instrument="true"><BookProgressContent {...props} /></div>
    </>}
  </dialog>;
}
