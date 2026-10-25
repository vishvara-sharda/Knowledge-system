import React, { StrictMode, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fffbfd', fontFamily: 'sans-serif', padding: '20px' }}>
          <div style={{ maxWidth: '450px', width: '100%', background: '#ffffff', border: '1px solid #fbcfe8', borderRadius: '24px', padding: '32px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(244, 114, 182, 0.15)' }}>
            <div style={{ width: '56px', height: '56px', margin: '0 auto 16px', borderRadius: '16px', background: '#fdf2f8', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 8px' }}>
              Something went wrong loading the canvas
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px', lineHeight: '1.6' }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{ width: '100%', padding: '12px 20px', borderRadius: '12px', background: 'linear-gradient(to right, #ec4899, #f43f5e)', color: '#ffffff', border: 'none', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)' }}
            >
              Reset & Reload Canvas
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
