jest.mock('@/components/ui/Link', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
      React.createElement('a', { href, className }, children),
  }
})

/**
 * Renders inside one isolated module registry: AuthNav reads NEXT_PUBLIC_ACCOUNTS_ENABLED when it is first loaded, and
 * React and react-dom must come from the same registry as the component or hooks fail.
 */
function render(enabled: boolean, pick: 'auth' | 'pricing', props: Record<string, string>): string {
  process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED = enabled ? 'true' : ''
  let html = ''
  jest.isolateModules(() => {
    const React = require('react')
    const { renderToStaticMarkup } = require('react-dom/server')
    const mod = require('@/components/layout/AuthNav')
    html = renderToStaticMarkup(React.createElement(pick === 'auth' ? mod.AuthNav : mod.PricingNavLink, props))
  })
  return html
}

describe('header auth links', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED
  })

  it('shows "Sign in" and a "Sign up" button, both to the sign-in page, when accounts are on', () => {
    const html = render(true, 'auth', { className: 'link', signUpClassName: 'btn' })
    expect(html).toContain('>Sign in<')
    expect(html).toContain('class="btn"')
    expect(html).toContain('>Sign up<')
    expect(html.match(/href="\/sign-in"/g)).toHaveLength(2)
  })

  it('shows only "Sign in" where no button style is given (the phone header)', () => {
    const html = render(true, 'auth', { className: 'link' })
    expect(html).toContain('>Sign in<')
    expect(html).not.toContain('Sign up')
  })

  it('renders nothing, and no Pricing link, while accounts are off', () => {
    expect(render(false, 'auth', { className: 'a', signUpClassName: 'b' })).toBe('')
    expect(render(false, 'pricing', { className: 'a' })).toBe('')
  })

  it('links Pricing to /pricing when accounts are on', () => {
    expect(render(true, 'pricing', { className: 'a' })).toContain('href="/pricing"')
  })
})
