// The site header, footer, feedback tab and every analytics tag sit inside HideOnAdmin (app/layout.tsx): rendered as
// they were on public pages, and not at all on the admin console, so the owner's own visits there are not counted.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let mockPath = '/'
jest.mock('next/navigation', () => ({ usePathname: () => mockPath }))

import { HideOnAdmin } from '@/components/layout/HideOnAdmin'

const tag = () => createElement(HideOnAdmin, null, createElement('script', { 'data-tag': 'gtm' }, 'x'))

describe('HideOnAdmin', () => {
  it.each(['/', '/jobs', '/about', '/ubaid93x', '/job/ubaid93-engineer-j-1'])('renders its children unchanged on %s', (path) => {
    mockPath = path
    expect(renderToStaticMarkup(tag())).toBe('<script data-tag="gtm">x</script>')
  })

  it.each(['/ubaid93', '/ubaid93/', '/ubaid93/login', '/ubaid93/jobs'])('renders nothing on %s', (path) => {
    mockPath = path
    expect(renderToStaticMarkup(tag())).toBe('')
  })
})
