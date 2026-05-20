import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global log interceptor for debugging in headless environment
const logs: string[] = [];
(window as any).__app_logs = logs;

const originalError = console.error;
console.error = (...args) => {
  logs.push(`[ERROR] ${args.map(a => typeof a === 'object' ? (a instanceof Error ? a.stack || a.message : JSON.stringify(a)) : String(a)).join(' ')}`);
  originalError.apply(console, args);
};

const originalWarn = console.warn;
console.warn = (...args) => {
  logs.push(`[WARN] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
  originalWarn.apply(console, args);
};

const originalLog = console.log;
console.log = (...args) => {
  logs.push(`[INFO] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
  originalLog.apply(console, args);
};

window.addEventListener('error', (event) => {
  logs.push(`[UNHANDLED ERROR] ${event.message} at ${event.filename}:${event.lineno}`);
});

window.addEventListener('unhandledrejection', (event) => {
  logs.push(`[UNHANDLED REJECTION] ${event.reason}`);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
