import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initGlobalErrorLogging } from './lib/errorLogger'

// Inicializa o monitor global de erros não capturados da aplicação
initGlobalErrorLogging()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
