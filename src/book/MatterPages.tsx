import '../styles/matter-pages.css';
import type { ReactNode } from 'react';
import { resolve } from './print/pageSpec.ts';
import type { HotspotCommand, PageBlock, PageContext, PageSpec } from './print/pageSpec.ts';

/**
 * v3 R8: the 2D reading path for the contents and closing pages. It reads the same page DSL as the
 * printed 3D pages (content/pages/matterPages.ts) and runs the same commands, so both paths show
 * the same words and jump the same way. Only the block kinds the matter pages use are drawn.
 */
export type MatterPageProps = Readonly<{
  spec: PageSpec;
  context: PageContext;
  onCommand(command: HotspotCommand): void;
}>;

function Block(props: Readonly<{ block: PageBlock; context: PageContext; onCommand(command: HotspotCommand): void }>): ReactNode {
  const { block, context, onCommand } = props;
  switch (block.kind) {
    case 'heading': {
      const text = resolve(block.text, context);
      return block.level === 1 ? <h1 tabIndex={block.focusTarget ? -1 : undefined}>{text}</h1> : block.level === 2 ? <h2>{text}</h2> : <h3>{text}</h3>;
    }
    case 'paragraph': {
      const text = resolve(block.text, context);
      return text ? <p className={`matter-text matter-text--${block.style ?? 'body'}`}>{text}</p> : null;
    }
    case 'rule': return <hr className="matter-rule" />;
    case 'spacer': return null;
    case 'contents':
      return <ol className="matter-contents" aria-label={block.label}>
        {block.entries.map(entry => {
          const done = entry.done === undefined ? false : resolve(entry.done, context);
          return <li key={entry.id}>
            <button type="button" className="matter-entry" data-testid={entry.testId} disabled={!context.interactive} onClick={() => onCommand(entry.command)}>
              {entry.number && <span className="matter-entry-number">{entry.number}</span>}
              <span className="matter-entry-text">
                <span className="matter-entry-title">{entry.title}{done && <span className="matter-entry-done"> · 완료</span>}</span>
                {entry.detail && <span className="matter-entry-detail">{entry.detail}</span>}
              </span>
              {entry.folio && <span className="matter-entry-folio">{entry.folio}</span>}
            </button>
          </li>;
        })}
      </ol>;
    case 'checklist':
      return <ul className="matter-checklist" aria-label={block.label}>
        {resolve(block.items, context).map(item => <li key={item.label} data-done={item.done}>
          <span aria-hidden="true">{item.done ? '✓' : '○'}</span> {item.label}<span className="book-sr-only">{item.done ? ' 완료' : ' 아직'}</span>
        </li>)}
      </ul>;
    case 'stampSlot': {
      const stamped = resolve(block.stamped, context);
      return <p className="lesson-stamp" data-stamped={stamped} role="status">
        <span className="lesson-stamp-mark" aria-hidden="true">{stamped ? '확인' : ''}</span>
        <span>{block.label}{stamped ? ' · 도장이 찍혔어요' : ''}</span>
      </p>;
    }
    case 'buttons':
      return <div className="matter-buttons" role="group" aria-label={block.label}>
        {block.buttons.map(button => {
          const command = resolve(button.command, context);
          const enabled = context.interactive && !!command && (button.enabled === undefined ? true : resolve(button.enabled, context));
          return <button key={button.id} type="button" className="book-text-button" data-testid={button.testId ? resolve(button.testId, context) : undefined}
            disabled={!enabled} onClick={() => { if (command) onCommand(command); }}>{resolve(button.label, context)}</button>;
        })}
      </div>;
    case 'when':
      return block.test(context) ? block.blocks.map((child, index) => <Block key={index} block={child} context={context} onCommand={onCommand} />) : null;
    default:
      // Lesson blocks (notation, questions, figures…) belong to LessonPages.tsx.
      return null;
  }
}

export function MatterPage(props: MatterPageProps) {
  return <div className="lesson-page-content matter-page" data-matter-page={props.spec.pageId}>
    <p className="book-running-title">{props.spec.runningHead}</p>
    {props.spec.blocks.map((block, index) => <Block key={index} block={block} context={props.context} onCommand={props.onCommand} />)}
  </div>;
}
