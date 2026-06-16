// app/preload-resources.tsx
'use client'

import ReactDOM from 'react-dom'

export function PreloadResources() {
  ReactDOM.preconnect('https://img.logo.dev')
  ReactDOM.preconnect('https://cdn.builtin.com')
  ReactDOM.preconnect('https://logo.clearbit.com')

  return null
}
