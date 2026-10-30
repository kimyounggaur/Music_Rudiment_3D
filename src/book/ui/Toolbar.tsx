import { forwardRef } from 'react';
import '../../styles/toolbar.css';

/**
 * v3 R5 toolbar (REFACTOR_DESIGN_V3 §6 R5 (1), CONTRACT_V3 C1·C9, decision 1): one row outside the
 * book for the global controls — previous, contents and next with the folio, sound, still picture,
 * reading mode and records. Lesson controls stay printed on the page.
 */
export type ToolbarProps = Readonly<{
  /** The book is open: the row is shown (the cover keeps its own hint). Hidden, it still holds its height. */
  visible: boolean;
  /** First spread: "previous" closes the book (CLOSE_BOOK). */
  first: boolean;
  /** Last spread: "next" is disabled (BK09). */
  last: boolean;
  folio: string;
  muted: boolean;
  reducedMotion: boolean;
  mode: '2d' | '3d';
  /** Contents arrive with the contents spread (R8, GO_TO); until then the button says why it waits. */
  contentsEnabled: boolean;
  onPrev(): void;
  onNext(): void;
  onContents(): void;
  onSound(): void;
  onStill(): void;
  onReadingMode(): void;
  onRecords(): void;
}>;

export const Toolbar = forwardRef<HTMLElement, ToolbarProps>(function Toolbar(props, ref) {
  return <nav ref={ref} className="book-toolbar" aria-label="책 조작" data-visible={props.visible} aria-hidden={!props.visible} inert={!props.visible}>
    <div className="book-toolbar-group">
      <button type="button" className="book-toolbar-button" data-testid="book-prev" aria-label={props.first ? '표지로' : '이전 펼침면'} onClick={props.onPrev}>←</button>
      <button type="button" className="book-toolbar-button" data-testid="book-contents" disabled={!props.contentsEnabled}
        title={props.contentsEnabled ? undefined : '목차 펼침면은 준비 중이에요'} onClick={props.onContents}>목차</button>
      <button type="button" className="book-toolbar-button" data-testid="book-next" aria-label="다음 펼침면" disabled={props.last} onClick={props.onNext}>→</button>
      <span className="book-toolbar-folio" aria-live="polite">{props.folio}</span>
    </div>
    <div className="book-toolbar-group">
      <button type="button" className="book-toolbar-button" data-testid="sound" aria-pressed={!props.muted} onClick={props.onSound}>소리</button>
      <button type="button" className="book-toolbar-button" data-testid="still" aria-pressed={props.reducedMotion} onClick={props.onStill}>정지 화면</button>
      <button type="button" className="book-toolbar-button" data-testid="reading-mode" onClick={props.onReadingMode}>{props.mode === '3d' ? '크게 읽기' : '3D로 보기'}</button>
      <button type="button" className="book-toolbar-button" data-testid="records" aria-haspopup="dialog" onClick={props.onRecords}>기록</button>
    </div>
  </nav>;
});
