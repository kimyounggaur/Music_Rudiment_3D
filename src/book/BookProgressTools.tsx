import { useId, useLayoutEffect, useRef, useState } from 'react';
import '../styles/book-progress.css';

export type BookProgressPreferences = Readonly<{
  mode: '2d' | '3d';
  reducedMotion: boolean;
  muted: boolean;
  volume: number;
  /** v3 R7: procedural sound effects (decision 2: on). */
  sfx: boolean;
  /** v3 R6/R7: start the lesson shot when playback starts (decision 5: off). */
  autoShot: boolean;
}>;

export type BookProgressToolsProps = {
  busy: boolean;
  notice: string;
  protectedRaw: string | null;
  backups: readonly { key: string; raw: string }[];
  exportedText: string;
  preview: { savedAt: string; spreadLabel: string; patternCount: number; canApply?: boolean; reason?: string } | null;
  preferences: BookProgressPreferences;
  onOpen(): void;
  onPreferences(patch: Partial<BookProgressPreferences>): void;
  onExport(): void;
  onPreviewImport(raw: string): void;
  onConfirmImport(): void;
  onCancelImport(): void;
  onDelete(): void;
};

function backupLabel(key: string, index: number): string {
  if (key.endsWith(':v1-source-backup')) return '이전 형식 원문 백업';
  if (key.endsWith(':v2-source-backup')) return '책 기록(2판) 원문 백업';
  if (key.endsWith(':book-v2:backup')) return '책 기록(2판) 백업';
  if (key.endsWith(':book-v3:backup')) return '책 기록 백업';
  if (key.endsWith(':backup')) return '이전 학습 기록 백업';
  return `앱 보관 기록 ${index + 1}`;
}

/**
 * Presentation only: the parent owns validation, storage and all record changes. v3 R5: the same
 * content serves the 2D page disclosure (BookProgressTools) and the toolbar's records dialog.
 */
export function BookProgressContent(props: BookProgressToolsProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const exportText = useRef<HTMLTextAreaElement>(null);
  const originalText = useRef<HTMLTextAreaElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const importHeading = useRef<HTMLHeadingElement>(null);
  const deleteHeading = useRef<HTMLHeadingElement>(null);
  const focusPreview = useRef(false);
  const [importText, setImportText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState('');

  useLayoutEffect(() => {
    if (props.preview && focusPreview.current) {
      focusPreview.current = false;
      importHeading.current?.focus({ preventScroll: true });
    }
  }, [props.preview]);
  useLayoutEffect(() => {
    if (confirmDelete) deleteHeading.current?.focus({ preventScroll: true });
  }, [confirmDelete]);

  const cancelImport = () => {
    if (props.busy) return;
    focusPreview.current = false;
    props.onCancelImport();
    previewButton.current?.focus({ preventScroll: true });
  };
  const selectText = (target: HTMLTextAreaElement | null) => {
    if (!target) return;
    target.focus({ preventScroll: true });
    target.select();
  };
  const download = (text: string, filename: string) => {
    const link = document.createElement('a');
    let url: string | null = null;
    try {
      url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      link.href = url;
      link.download = filename;
      link.hidden = true;
      root.current?.appendChild(link);
      link.click();
      setDownloadNotice('내려받기를 요청했어요. 브라우저의 다운로드 목록을 확인해 주세요.');
    } catch {
      setDownloadNotice('내려받기를 시작하지 못했어요. 내용을 모두 선택해 복사할 수 있어요.');
    } finally {
      link.remove();
      if (url) {
        const completedUrl = url;
        // Let the browser consume the download URL before releasing its memory.
        globalThis.setTimeout(() => URL.revokeObjectURL(completedUrl), 0);
      }
    }
  };

  return <div ref={root} className="book-progress-content" aria-busy={props.busy}>
      {props.notice && <p className="book-progress-notice" role="status">{props.notice}</p>}
      <fieldset className="book-progress-settings" data-print-disabled="false" disabled={props.busy}>
        <legend>읽기와 소리</legend>
        <label className="book-progress-setting" htmlFor={`${id}-mode`}>
          <span>읽기 방식</span>
          <select id={`${id}-mode`} value={props.preferences.mode} onChange={event => {
            if (!props.busy) props.onPreferences({ mode: event.currentTarget.value === '2d' ? '2d' : '3d' });
          }}>
            <option value="3d">3D 책</option>
            <option value="2d">2D로 크게 읽기</option>
          </select>
        </label>
        <label className="book-progress-check">
          <input type="checkbox" checked={props.preferences.reducedMotion} onChange={event => {
            if (!props.busy) props.onPreferences({ reducedMotion: event.currentTarget.checked });
          }} />
          <span>움직임 줄이기</span>
        </label>
        <p>기기에서 움직임 줄이기를 켰다면 그 설정도 함께 적용해요.</p>
        <label className="book-progress-check">
          <input type="checkbox" checked={props.preferences.muted} onChange={event => {
            if (!props.busy) props.onPreferences({ muted: event.currentTarget.checked });
          }} />
          <span>음소거</span>
        </label>
        <label className="book-progress-check">
          <input type="checkbox" checked={props.preferences.sfx} onChange={event => {
            if (!props.busy) props.onPreferences({ sfx: event.currentTarget.checked });
          }} />
          <span>효과음(책장·표지·펜 소리)</span>
        </label>
        <p>조작바의 ‘소리’는 음악과 효과음을 함께 끄고 켜요.</p>
        <label className="book-progress-check">
          <input type="checkbox" checked={props.preferences.autoShot} onChange={event => {
            if (!props.busy) props.onPreferences({ autoShot: event.currentTarget.checked });
          }} />
          <span>들을 때 그림을 가까이 보기</span>
        </label>
        <label className="book-progress-setting" htmlFor={`${id}-volume`}>
          <span>음량 {Math.round(props.preferences.volume * 100)}%</span>
          <input id={`${id}-volume`} type="range" min="0" max="1" step="0.05" value={props.preferences.volume}
            onChange={event => { if (!props.busy) props.onPreferences({ volume: event.currentTarget.valueAsNumber }); }} />
        </label>
      </fieldset>

      <section className="book-progress-section" aria-labelledby={`${id}-export-heading`}>
        <h3 id={`${id}-export-heading`}>현재 기록 내보내기</h3>
        <button type="button" className="book-text-button" data-print-disabled="false" disabled={props.busy} onClick={() => {
          if (!props.busy) props.onExport();
        }}>현재 기록 준비</button>
        {props.exportedText && <div className="book-progress-raw">
          <label htmlFor={`${id}-export`}>준비한 현재 기록 JSON</label>
          <textarea ref={exportText} id={`${id}-export`} value={props.exportedText} readOnly spellCheck={false} rows={4} />
          <div className="book-progress-actions">
            <button type="button" className="book-text-button"
              onClick={() => download(props.exportedText, 'music-rudiment-progress-v2.json')}>현재 기록 내려받기</button>
            <button type="button" className="book-text-button"
              onClick={() => selectText(exportText.current)}>전체 선택</button>
          </div>
        </div>}
      </section>

      {props.protectedRaw !== null && <section className="book-progress-section" aria-labelledby={`${id}-original-heading`}>
        <h3 id={`${id}-original-heading`}>이 창이 보관한 저장 원문</h3>
        <p>이 창이 마지막으로 보관한 원문이에요. 다른 창의 최신 기록과 다를 수 있으며, 현재 학습과 별도로 내려받을 수 있어요.</p>
        <div className="book-progress-raw">
          <label htmlFor={`${id}-original`}>이 창이 보관한 원문 내용</label>
          <textarea ref={originalText} id={`${id}-original`} value={props.protectedRaw} readOnly spellCheck={false} rows={4} />
          <div className="book-progress-actions">
            <button type="button" className="book-text-button"
              onClick={() => download(props.protectedRaw!, 'music-rudiment-preserved-original.txt')}>원문 내려받기</button>
            <button type="button" className="book-text-button"
              onClick={() => selectText(originalText.current)}>원문 전체 선택</button>
          </div>
        </div>
      </section>}
      {props.backups.length > 0 && <section className="book-progress-section" aria-labelledby={`${id}-backups-heading`}>
        <h3 id={`${id}-backups-heading`}>앱 백업 원문</h3>
        <p>각 기록을 펼쳐 확인하거나 별도로 내려받을 수 있어요.</p>
        <div className="book-progress-backups">
          {props.backups.map((backup, index) => <details key={backup.key} className="book-progress-backup">
            <summary>{backupLabel(backup.key, index)}</summary>
            <code className="book-progress-backup-key">{backup.key}</code>
            <div className="book-progress-raw">
              <label htmlFor={`${id}-backup-${index}`}>백업 {index + 1} 원문</label>
              <textarea id={`${id}-backup-${index}`} value={backup.raw} readOnly spellCheck={false} rows={3} />
              <button type="button" className="book-text-button" onClick={() => download(backup.raw, `music-rudiment-app-backup-${index + 1}.txt`)}>
                백업 {index + 1} 내려받기
              </button>
            </div>
          </details>)}
        </div>
      </section>}
      {downloadNotice && <p className="book-progress-notice" role="status">{downloadNotice}</p>}

      <section className="book-progress-section" aria-labelledby={`${id}-import-heading`}>
        <h3 id={`${id}-import-heading`}>기록 가져오기</h3>
        <div className="book-progress-raw">
          <label htmlFor={`${id}-import`}>가져올 JSON 붙여넣기</label>
          <textarea id={`${id}-import`} value={importText} disabled={props.busy} spellCheck={false} rows={5}
            onChange={event => {
              if (props.busy) return;
              setImportText(event.currentTarget.value);
              focusPreview.current = false;
              props.onCancelImport();
            }} />
          <button ref={previewButton} type="button" className="book-text-button" disabled={props.busy || !importText.trim()}
            onClick={() => {
              if (props.busy || !importText.trim()) return;
              setConfirmDelete(false);
              focusPreview.current = true;
              props.onPreviewImport(importText);
            }}>내용 미리보기</button>
        </div>
        {props.preview && <div className="book-progress-confirm">
          <h4 ref={importHeading} tabIndex={-1}>이 기록을 가져올까요?</h4>
          <dl>
            <div><dt>저장 시각</dt><dd>{props.preview.savedAt}</dd></div>
            <div><dt>펼침면</dt><dd>{props.preview.spreadLabel}</dd></div>
            <div><dt>리듬 수</dt><dd>{props.preview.patternCount}개</dd></div>
          </dl>
          {props.preview.reason && <p role="status">{props.preview.reason}</p>}
          {props.preview.canApply !== false && <p>확인하면 현재 학습 기록에 적용돼요.</p>}
          <div className="book-progress-actions">
            <button type="button" className="book-text-button" disabled={props.busy || props.preview.canApply === false} onClick={() => {
              if (props.busy || props.preview?.canApply === false) return;
              focusPreview.current = false;
              props.onConfirmImport();
              previewButton.current?.focus({ preventScroll: true });
            }}>이 기록 가져오기</button>
            <button type="button" className="book-text-button" disabled={props.busy} onClick={cancelImport}>취소</button>
          </div>
        </div>}
      </section>

      <section className="book-progress-section" aria-labelledby={`${id}-delete-heading`}>
        <h3 id={`${id}-delete-heading`}>이 교재의 기록 삭제</h3>
        <button ref={deleteButton} type="button" className="book-text-button" data-print-disabled="false" disabled={props.busy}
          onClick={() => {
            if (props.busy) return;
            focusPreview.current = false;
            props.onCancelImport();
            setConfirmDelete(true);
          }}>삭제 내용 확인</button>
        {confirmDelete && <div className="book-progress-confirm">
          <h4 ref={deleteHeading} tabIndex={-1}>교재 기록을 모두 지울까요?</h4>
          <p>이 교재의 학습 기록과 앱 백업을 삭제해요. 다른 사이트의 기록은 지우지 않아요. 필요하면 먼저 기록을 내려받아 주세요.</p>
          <div className="book-progress-actions">
            <button type="button" className="book-text-button book-progress-delete" disabled={props.busy} onClick={() => {
              if (props.busy) return;
              props.onDelete();
              setConfirmDelete(false);
              deleteButton.current?.focus({ preventScroll: true });
            }}>교재 기록 모두 삭제</button>
            <button type="button" className="book-text-button" disabled={props.busy} onClick={() => {
              if (props.busy) return;
              setConfirmDelete(false);
              deleteButton.current?.focus({ preventScroll: true });
            }}>취소</button>
          </div>
        </div>}
      </section>
  </div>;
}

/** The 2D reading pages' disclosure: opening it stops playback, as before. */
export function BookProgressTools(props: BookProgressToolsProps) {
  return <details className="book-progress-tools" data-book-instrument="true" onToggle={event => {
    // Opening the tools stops playback, even while the mutating controls are
    // busy. A nested backup disclosure must not repeat that parent action.
    if (event.target === event.currentTarget && event.currentTarget.open) props.onOpen();
  }}>
    <summary>기록과 설정</summary>
    <BookProgressContent {...props} />
  </details>;
}
