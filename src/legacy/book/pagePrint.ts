import { CanvasTexture, SRGBColorSpace } from 'three';
import type { PageId } from './manifest.ts';

/** V05 geometric inspection print; V07 replaces this with the lesson revision. */
export function createInspectionPrints(): Map<PageId, CanvasTexture> {
  const result = new Map<PageId, CanvasTexture>();
  for (let page = 1; page <= 4; page += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1059;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Page print canvas unavailable');
    context.fillStyle = '#f4eedc';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#334e5d';
    context.font = '24px sans-serif';
    context.fillText('MUSIC · DURATION', 44, 60);
    context.font = 'bold 62px serif';
    context.fillText(`PAGE ${page}`, 44, 166);
    context.font = '28px sans-serif';
    context.fillText(page < 3 ? 'One whole. Four quarters.' : 'Divide a whole in half.', 44, 240);
    context.strokeStyle = '#a2b4b6';
    context.lineWidth = 2;
    for (let line = 0; line < 5; line += 1) {
      context.beginPath(); context.moveTo(44, 350 + line * 20); context.lineTo(676, 350 + line * 20); context.stroke();
    }
    context.font = '32px serif';
    context.fillText(String(page), 44, 1000);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    result.set(`page-${page}` as PageId, texture);
  }
  return result;
}
