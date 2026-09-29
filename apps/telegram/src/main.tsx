import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// The kit's stylesheet carries the `--tgui--*` theme variables and every
// component's base look, so it must load before the messenger-specific rules in
// app.css, which override it by source order.
import '@telegram-apps/telegram-ui/dist/styles.css';
import './styles/app.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
