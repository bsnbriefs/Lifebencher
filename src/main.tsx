import {StrictMode, Component, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyTheme, readStoredTheme } from './lib/theme';

declare global {
  interface Window {
    __lbDeferredPrompt?: Event;
  }
}

class RootBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message || 'The app failed to load.' };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding: 24, fontFamily: 'sans-serif', color: '#fff'}}>
          <p>Lifebencher could not open this screen.</p>
          <p style={{fontSize: 12, opacity: 0.7}}>{this.state.error}</p>
          <button type="button" onClick={() => window.location.reload()} style={{marginTop: 12, padding: '8px 14px', borderRadius: 999, border: 0, background: '#7A1F2B', color: '#fff'}}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__lbDeferredPrompt = e;
});

applyTheme(readStoredTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
