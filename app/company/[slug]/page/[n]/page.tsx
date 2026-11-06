// /company/<slug>/page/N: the no-JavaScript target of "Show more jobs" on the company page (jobs 11-20, 21-30, ...).
// It is the company page rendered at page N (noindex, canonical = /company/<slug>; see page.tsx). It lives under its own
// path, not ?page=N, so reading a query string does not turn the company page itself from cached (ISR) into dynamic.

export { default, generateMetadata } from '../../page'

export const revalidate = 3600
