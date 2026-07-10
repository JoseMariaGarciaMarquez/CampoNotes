import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Clear old service worker caches and register fresh
if ('serviceWorker' in navigator) {
  caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/CampoNotes/sw.js').catch(() => {})
  })
}
