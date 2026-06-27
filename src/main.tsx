import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'

import './styles/tokens.css'
import './styles/global.css'
import { CAVEAT_URL, INTER_URL } from './assets/fonts'
import { Hero } from './pages/Hero'
import { LoadingPlate } from './ui/LoadingPlate'

// Preload the self-hosted fonts with their build-time (base-correct) URLs so
// the handwritten wordmark paints without a flash of fallback text.
for (const href of [CAVEAT_URL, INTER_URL]) {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'font'
  link.type = 'font/woff2'
  link.href = href
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
}

// The editor pulls in the whole tldraw bundle — keep it off the hero's
// critical path.
const Editor = lazy(() =>
  import('./pages/Editor').then((m) => ({ default: m.Editor })),
)

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route
          path="/draft"
          element={
            <Suspense fallback={<LoadingPlate />}>
              <Editor />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
