import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'

const CHUNK_RELOAD_KEY = 'joallm:chunk-reload'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()

  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') {
    return
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  window.location.reload()
})

sessionStorage.removeItem(CHUNK_RELOAD_KEY)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true,
        }}
      >
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
