import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('앱의 시작 영역을 찾지 못했습니다.');
createRoot(root).render(<App />);

