import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';
import { currentProfile } from './book/profile.ts';

const root = document.getElementById('root');
if (!root) throw new Error('앱의 시작 영역을 찾지 못했습니다.');
const container = root;

// ?renderer=legacy mounts the frozen 5f2f7bb shell for v3 before/after comparison (removed in R9).
const entry: Promise<{ default: ComponentType }> = currentProfile().renderer === 'legacy'
  ? import('./legacy/entry.tsx') : import('./book/entry.tsx');
void entry.then(({ default: App }) => createRoot(container).render(<App />));
