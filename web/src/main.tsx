import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { startDemoIfNew } from './store/demo'
import { browserStorage } from './store/storage'

// The demo copy's first start fills it with the demo before Studium loads its data.
startDemoIfNew(browserStorage(), new Date())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
