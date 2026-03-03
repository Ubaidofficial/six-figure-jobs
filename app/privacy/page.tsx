import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for Six Figure Jobs. Learn what data we collect, how we use it, and the choices you have.',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        Privacy Policy
      </h1>

      <p className="mt-5 text-slate-300">
        This Privacy Policy describes how Six Figure Jobs (“we”, “us”) collects,
        uses, and shares information when you use our website.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Information we collect
      </h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-slate-300">
        <li>
          <strong>Usage data:</strong> basic analytics such as pages visited,
          device/browser type, and approximate location (e.g., country/city).
        </li>
        <li>
          <strong>Cookies:</strong> for essential site functionality and
          measurement. See{' '}
          <a className="text-emerald-300 underline" href="/cookies">
            Cookie Policy
          </a>
          .
        </li>
        <li>
          <strong>Contact data:</strong> if you email us, we receive your message
          and email address.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        How we use information
      </h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-slate-300">
        <li>Operate and improve the site (performance, reliability).</li>
        <li>Understand which pages are useful and reduce low-value pages.</li>
        <li>Prevent abuse, bots, and scraping.</li>
        <li>Respond to support requests.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Sharing of information
      </h2>
      <p className="mt-4 text-slate-300">
        We do not sell your personal information. We may share limited data with
        service providers that help us operate the site (hosting, analytics,
        logging) under appropriate safeguards.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        International visitors
      </h2>
      <p className="mt-4 text-slate-300">
        We serve users globally. Your information may be processed in countries
        where we or our providers operate. Where required, we use safeguards for
        cross-border transfers.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Your choices
      </h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-slate-300">
        <li>You can control cookies via your browser settings.</li>
        <li>You can request deletion of support emails you’ve sent us.</li>
      </ul>

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
