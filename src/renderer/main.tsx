import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@renderer/App'
import '@renderer/styles/globals.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('未找到根节点 #root')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
