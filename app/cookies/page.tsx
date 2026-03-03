import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'Cookie Policy for Six Figure Jobs. Learn how cookies are used and how to control them.',
}

export default function CookiesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        Cookie Policy
      </h1>

      <p className="mt-5 text-slate-300">
        This Cookie Policy explains how Six Figure Jobs uses cookies and similar
        technologies. For broader information, see our{' '}
        <Link className="text-emerald-300 underline" href="/privacy">
          Privacy Policy
        </Link>
        .
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        What are cookies?
      </h2>
      <p className="mt-4 text-slate-300">
        Cookies are small text files stored on your device. They help websites
        function and provide analytics about usage.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Cookies we use
      </h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-slate-300">
        <li>
          <strong>Essential cookies:</strong> required for core site functionality.
        </li>
        <li>
          <strong>Analytics cookies:</strong> help us understand which pages are
          useful so we can improve the experience and reduce low-value pages.
        </li>
        <li>
          <strong>Security cookies:</strong> help prevent abuse and bot traffic.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        How to control cookies
      </h2>
      <p className="mt-4 text-slate-300">
        You can disable cookies in your browser settings. Some features may not
        work as intended if cookies are disabled.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Contact
      </h2>
      <p className="mt-4 text-slate-300">
        Questions? Email{' '}
        <a className="text-emerald-300 underline" href="mailto:privacy@6figjobs.com">
          privacy@6figjobs.com
        </a>
        .
      </p>

      <p className="mt-10 text-sm text-slate-500">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
    </main>
  )
}
