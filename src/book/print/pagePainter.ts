import { PAGE_LOGICAL, PRINT_COLORS } from './pageLayout.ts';
import type { FontSpec, LaidOutItem, PageLayout, Rect, TextLine } from './pageLayout.ts';
import type { PrintIcon } from './pageSpec.ts';

/**
 * v3 R3 page painter (REFACTOR_DESIGN_V3 §6 R3 (3)). Ink on white: the lit paper shader supplies
 * paper colour and fibre, so the print stays a clean multiply layer. Printed controls are drawn as
 * ink outlines, not UI chrome.
 */
export type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export interface NotationPainter {
  draw(context: Canvas2D, key: string, rect: Rect, scale: number): void;
}

export function cssFont(font: FontSpec, scale: number): string {
  return `${font.weight} ${Math.max(1, font.size * scale).toFixed(2)}px "${font.family}"`;
}

function drawLines(context: Canvas2D, lines: readonly TextLine[], k: number, color?: string): void {
  for (const line of lines) {
    context.font = cssFont(line.font, k);
    const spacing = (line.font.letterSpacing ?? 0) * k;
    if ('letterSpacing' in context) (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
    context.fillStyle = color ?? line.color;
    context.fillText(line.text, line.x * k, line.baseline * k);
  }
  if ('letterSpacing' in context) (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
}

function roundedRect(context: Canvas2D, rect: Rect, radius: number, k: number): void {
  const x = rect.x * k, y = rect.y * k, w = rect.w * k, h = rect.h * k, r = Math.min(radius * k, h / 2, w / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

/** Small printed pictograms in a 24-unit box, ink strokes only. */
export function drawIcon(context: Canvas2D, icon: PrintIcon, x: number, y: number, size: number, k: number, color: string): void {
  const s = size * k / 24;
  context.save();
  context.translate(x * k, y * k);
  context.scale(s, s);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 2.2;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  switch (icon) {
    case 'play': context.moveTo(7, 5); context.lineTo(19, 12); context.lineTo(7, 19); context.closePath(); context.fill(); break;
    case 'pause': context.rect(6, 5, 4, 14); context.rect(14, 5, 4, 14); context.fill(); break;
    case 'stop': context.rect(6, 6, 12, 12); context.fill(); break;
    case 'split': context.moveTo(4, 12); context.lineTo(20, 12); context.moveTo(12, 5); context.lineTo(12, 19); context.stroke(); break;
    case 'merge': context.moveTo(4, 8); context.lineTo(11, 12); context.lineTo(4, 16); context.moveTo(20, 8); context.lineTo(13, 12); context.lineTo(20, 16); context.stroke(); break;
    case 'undo': context.arc(13, 13, 6.5, Math.PI * 1.1, Math.PI * 0.35, true); context.moveTo(5, 6); context.lineTo(5.6, 11.4); context.lineTo(10.6, 10.4); context.stroke(); break;
    case 'redo': context.arc(11, 13, 6.5, Math.PI * -0.1, Math.PI * 0.65, false); context.moveTo(19, 6); context.lineTo(18.4, 11.4); context.lineTo(13.4, 10.4); context.stroke(); break;
    case 'look': context.arc(10.5, 10.5, 6, 0, Math.PI * 2); context.moveTo(15, 15); context.lineTo(20, 20); context.stroke(); break;
    case 'add': context.moveTo(12, 5); context.lineTo(12, 19); context.moveTo(5, 12); context.lineTo(19, 12); context.stroke(); break;
    case 'remove': context.moveTo(6, 6); context.lineTo(18, 18); context.moveTo(18, 6); context.lineTo(6, 18); context.stroke(); break;
    case 'toggle': context.rect(4, 8, 7, 8); context.moveTo(14, 9); context.lineTo(20, 9); context.moveTo(14, 15); context.lineTo(20, 15); context.stroke(); break;
    case 'check': context.moveTo(5, 12.5); context.lineTo(10, 17); context.lineTo(19, 7); context.stroke(); break;
  }
  context.restore();
}

function paintItem(context: Canvas2D, item: LaidOutItem, k: number, notation: NotationPainter): void {
  switch (item.kind) {
    case 'text':
      drawLines(context, item.lines, k);
      break;
    case 'rule':
      context.strokeStyle = item.color;
      context.lineWidth = 1.4 * k;
      context.beginPath();
      context.moveTo(item.x * k, item.y * k);
      context.lineTo((item.x + item.w) * k, item.y * k);
      context.stroke();
      break;
    case 'button': {
      const color = item.enabled ? PRINT_COLORS.ink : PRINT_COLORS.faint;
      roundedRect(context, item.rect, 9, k);
      if (item.pressed) { context.fillStyle = 'rgba(67,108,123,0.16)'; context.fill(); }
      context.strokeStyle = color;
      context.lineWidth = (item.pressed ? 2.6 : 1.6) * k;
      if (!item.enabled) context.setLineDash([5 * k, 4 * k]);
      context.stroke();
      context.setLineDash([]);
      if (item.icon) drawIcon(context, item.icon, item.rect.x + 14, item.rect.y + (item.rect.h - 22) / 2, 22, k, item.enabled ? PRINT_COLORS.blue : PRINT_COLORS.faint);
      drawLines(context, item.label, k, color);
      break;
    }
    case 'radio': {
      const color = item.enabled ? PRINT_COLORS.ink : PRINT_COLORS.faint;
      context.strokeStyle = color;
      context.lineWidth = 1.8 * k;
      context.beginPath();
      context.arc(item.center.x * k, item.center.y * k, item.radius * k, 0, Math.PI * 2);
      context.stroke();
      if (item.selected) {
        context.fillStyle = PRINT_COLORS.blue;
        context.beginPath();
        context.arc(item.center.x * k, item.center.y * k, item.radius * 0.55 * k, 0, Math.PI * 2);
        context.fill();
      }
      drawLines(context, item.label, k, color);
      break;
    }
    case 'checkbox': {
      const color = item.enabled || !item.hotspotId ? PRINT_COLORS.ink : PRINT_COLORS.faint;
      context.strokeStyle = color;
      context.lineWidth = 1.8 * k;
      roundedRect(context, item.box, 3, k);
      context.stroke();
      if (item.checked) drawIcon(context, 'check', item.box.x, item.box.y, item.box.w, k, PRINT_COLORS.blue);
      drawLines(context, item.label, k, color);
      break;
    }
    case 'cell': {
      roundedRect(context, item.rect, 6, k);
      context.strokeStyle = item.enabled ? PRINT_COLORS.rule : '#d4cfc2';
      context.lineWidth = 1.3 * k;
      if (item.rest) context.setLineDash([6 * k, 4 * k]);
      context.stroke();
      context.setLineDash([]);
      drawLines(context, [item.number], k);
      drawLines(context, [item.label], k);
      break;
    }
    case 'notation':
      notation.draw(context, item.key, item.rect, k);
      break;
    case 'figure':
      break;
    case 'flapTab': {
      roundedRect(context, item.rect, 8, k);
      context.fillStyle = item.open ? 'rgba(67,108,123,0.10)' : 'rgba(37,39,33,0.05)';
      context.fill();
      context.strokeStyle = PRINT_COLORS.rule;
      context.lineWidth = 1.4 * k;
      context.stroke();
      // Fold mark: the printed tab shows which way the paper opens.
      const cx = item.rect.x + 22, cy = item.rect.y + item.rect.h / 2;
      context.strokeStyle = PRINT_COLORS.blue;
      context.lineWidth = 2.2 * k;
      context.beginPath();
      if (item.open) { context.moveTo((cx - 7) * k, (cy - 3) * k); context.lineTo(cx * k, (cy + 4) * k); context.lineTo((cx + 7) * k, (cy - 3) * k); }
      else { context.moveTo((cx - 3) * k, (cy - 7) * k); context.lineTo((cx + 4) * k, cy * k); context.lineTo((cx - 3) * k, (cy + 7) * k); }
      context.stroke();
      drawLines(context, item.label, k);
      break;
    }
    case 'flapPanel':
      context.fillStyle = 'rgba(67,108,123,0.05)';
      context.fillRect(item.rect.x * k, item.rect.y * k, item.rect.w * k, item.rect.h * k);
      context.fillStyle = PRINT_COLORS.blue;
      context.fillRect(item.rect.x * k, item.rect.y * k, 3 * k, item.rect.h * k);
      break;
    case 'axis': {
      context.strokeStyle = PRINT_COLORS.blue;
      context.lineWidth = 1.6 * k;
      context.beginPath();
      context.moveTo(item.x * k, item.y * k);
      context.lineTo((item.x + item.w) * k, item.y * k);
      item.ticks.forEach((_tick, index) => {
        const x = item.x + item.w * index / Math.max(1, item.ticks.length - 1);
        context.moveTo(x * k, item.y * k);
        context.lineTo(x * k, (item.y + 12) * k);
      });
      context.stroke();
      drawLines(context, item.ticks, k);
      break;
    }
    case 'stampSlot': {
      const cx = (item.rect.x + item.rect.w / 2) * k, cy = (item.rect.y + item.rect.h / 2) * k, r = item.rect.w / 2 * k;
      if (item.stamped) {
        context.save();
        context.translate(cx, cy);
        context.rotate(-0.18);
        context.strokeStyle = 'rgba(178,58,40,0.86)';
        context.lineWidth = 4 * k;
        context.beginPath(); context.arc(0, 0, r * 0.9, 0, Math.PI * 2); context.stroke();
        context.lineWidth = 1.6 * k;
        context.beginPath(); context.arc(0, 0, r * 0.76, 0, Math.PI * 2); context.stroke();
        context.fillStyle = 'rgba(178,58,40,0.9)';
        context.font = `700 ${(r * 0.5).toFixed(2)}px "Book Serif"`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('확인', 0, 0);
        context.restore();
        context.textAlign = 'start';
        context.textBaseline = 'alphabetic';
      } else {
        context.strokeStyle = PRINT_COLORS.rule;
        context.lineWidth = 1.4 * k;
        context.setLineDash([5 * k, 5 * k]);
        context.beginPath(); context.arc(cx, cy, r * 0.9, 0, Math.PI * 2); context.stroke();
        context.setLineDash([]);
      }
      drawLines(context, item.label, k);
      break;
    }
    case 'overflow':
      drawLines(context, item.label, k);
      break;
  }
}

/** Paint a whole page onto a canvas whose width maps to the 1000-unit logical page. */
export function paintPage(context: Canvas2D, layout: PageLayout, notation: NotationPainter): void {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const k = width / PAGE_LOGICAL.width;
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.textBaseline = 'alphabetic';
  context.textAlign = 'start';
  for (const item of layout.items) paintItem(context, item, k, notation);
  context.restore();
}
