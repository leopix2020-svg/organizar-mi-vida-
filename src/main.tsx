import { createRoot } from 'react-dom/client';
import { App } from './App';
import { init } from './api/client';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
init();
