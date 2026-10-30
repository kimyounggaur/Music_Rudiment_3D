import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (!root) throw new Error('앱의 시작 영역을 찾지 못했습니다.');
const container = root;

// v3 R9: the printed book is the only app (the v1 shell and the frozen legacy renderer were removed).
void import('./book/entry.tsx').then(({ default: App }) => createRoot(container).render(<App />));
