import { PAGE_LOGICAL } from './pageLayout.ts';
import type { MirrorNode, PageHotspot, PageLayout, Rect } from './pageLayout.ts';
import type { Canvas2D } from './pagePainter.ts';

/**
 * v3 R3 state layer (REFACTOR_DESIGN_V3 §6 R3 (6)): an RGBA overlay mixed over the lit paper.
 * It changes without reprinting: pointer press/hover, keyboard focus from the accessible mirror,
 * the learner's selected note and playback's active note.
 */
export type PageInteraction = Readonly<{
  focusId: string | null;
  pressedId: string | null;
  hoverId: string | null;
  selected: Readonly<{ laneId: string; eventId: string }> | null;
  activeEventId: string | null;
  activeLaneId: string | null;
}>;
export const NO_INTERACTION: PageInteraction = Object.freeze({ focusId: null, pressedId: null, hoverId: null, selected: null, activeEventId: null, activeLaneId: null });

export function interactionKey(layout: PageLayout, interaction: PageInteraction): string {
  const own = (id: string | null) => id && layout.hotspots.some(hotspot => hotspot.id === id) ? id : null;
  const lanes = new Set(layout.noteBoxes.map(box => box.laneId));
  return JSON.stringify([own(interaction.focusId), own(interaction.pressedId), own(interaction.hoverId),
    interaction.selected && lanes.has(interaction.selected.laneId) ? interaction.selected : null,
    interaction.activeLaneId && lanes.has(interaction.activeLaneId) ? interaction.activeEventId : null]);
}

function rounded(context: Canvas2D, rect: Rect, radius: number, k: number, grow = 0): void {
  const x = (rect.x - grow) * k, y = (rect.y - grow) * k, w = (rect.w + grow * 2) * k, h = (rect.h + grow * 2) * k;
  const r = Math.min(radius * k, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

/** The red '확인' stamp, slightly turned, inside a stamp slot (logical rect, canvas scale k). */
export function paintStamp(context: Canvas2D, rect: Readonly<{ x: number; y: number; w: number; h: number }>, k: number): void {
  const cx = (rect.x + rect.w / 2) * k, cy = (rect.y + rect.h / 2) * k, r = rect.w / 2 * k;
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
}

export function paintState(context: Canvas2D, layout: PageLayout, interaction: PageInteraction): void {
  const k = context.canvas.width / PAGE_LOGICAL.width;
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  const hotspot = (id: string | null) => id ? layout.hotspots.find(item => item.id === id) ?? null : null;
  if (interaction.selected) {
    for (const box of layout.noteBoxes) {
      if (box.laneId !== interaction.selected.laneId || box.eventId !== interaction.selected.eventId) continue;
      rounded(context, box, 6, k, 1);
      // Multiplied over the print (paper shader): a warm marker tint that leaves the ink dark.
      context.fillStyle = 'rgba(246,196,128,0.7)';
      context.fill();
      context.strokeStyle = 'rgba(185,99,53,0.95)';
      context.lineWidth = 3 * k;
      context.stroke();
    }
  }
  if (interaction.activeEventId && interaction.activeLaneId) {
    for (const box of layout.noteBoxes) {
      if (box.laneId !== interaction.activeLaneId || box.eventId !== interaction.activeEventId) continue;
      rounded(context, box, 6, k, 3);
      context.strokeStyle = 'rgba(67,108,123,0.95)';
      context.lineWidth = 3 * k;
      context.setLineDash([8 * k, 5 * k]);
      context.stroke();
      context.setLineDash([]);
    }
  }
  // v3 R5: stamps (derived from the saved answers) are drawn here, so the print keeps the empty slot.
  for (const stamp of layout.stamps ?? []) if (stamp.stamped) paintStamp(context, stamp.rect, k);
  const hover = hotspot(interaction.hoverId);
  if (hover && hover.enabled && hover.id !== interaction.pressedId) {
    rounded(context, hover.rect, 9, k);
    context.fillStyle = 'rgba(67,108,123,0.08)';
    context.fill();
  }
  const pressed = hotspot(interaction.pressedId);
  if (pressed && pressed.enabled) {
    rounded(context, pressed.rect, 9, k);
    context.fillStyle = 'rgba(37,39,33,0.14)';
    context.fill();
  }
  const focus = hotspot(interaction.focusId);
  if (focus) {
    // AX21: keyboard focus is drawn on the visible page, around the printed target.
    rounded(context, focus.rect, 11, k, 5);
    context.strokeStyle = 'rgba(177,107,35,1)';
    context.lineWidth = 4 * k;
    context.stroke();
  }
  context.restore();
}

export function findHotspot(layout: PageLayout | undefined, id: string | null): PageHotspot | null {
  return layout && id ? layout.hotspots.find(item => item.id === id) ?? null : null;
}


/** Hotspots in accessible-mirror reading order; pointer-only duplicates (printed staff notes) are not listed. */
export function mirrorControls(layout: PageLayout): PageHotspot[] {
  const byId = new Map(layout.hotspots.map(hotspot => [hotspot.id, hotspot]));
  const result: PageHotspot[] = [];
  const visit = (nodes: readonly MirrorNode[]) => nodes.forEach(node => {
    if (node.kind === 'control') { const hotspot = byId.get(node.hotspotId); if (hotspot) result.push(hotspot); }
    else if (node.kind === 'group') visit(node.children);
  });
  visit(layout.mirror);
  return result;
}
