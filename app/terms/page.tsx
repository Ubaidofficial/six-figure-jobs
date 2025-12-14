import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for Six Figure Jobs. Rules for using the site, disclaimers, and limitations of liability.',
}

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        Terms of Service
      </h1>

      <p className="mt-5 text-slate-300">
        By accessing or using Six Figure Jobs, you agree to these Terms.
        If you do not agree, do not use the site.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        What we provide
      </h2>
      <p className="mt-4 text-slate-300">
        Six Figure Jobs is a directory of source-linked job listings. We do not
        act as an employer or recruiter. Applications are completed on the
        employer’s website.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Acceptable use
      </h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-slate-300">
        <li>Do not scrape, crawl aggressively, or attempt to disrupt service.</li>
        <li>Do not use the site for unlawful, harmful, or deceptive activity.</li>
        <li>Do not misrepresent affiliation with employers or the site.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Listing accuracy
      </h2>
      <p className="mt-4 text-slate-300">
        We try to keep listings accurate, but job details can change or expire.
        Always confirm details on the employer’s original posting.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Intellectual property
      </h2>
      <p className="mt-4 text-slate-300">
        Site design, branding, and original content belong to Six Figure Jobs.
        Employer trademarks and job descriptions belong to their respective owners.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Disclaimers
      </h2>
      <p className="mt-4 text-slate-300">
        The site is provided “as is” without warranties of any kind. We are not
        responsible for hiring decisions, employment outcomes, or third-party
        websites you visit via outbound links.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Limitation of liability
      </h2>
      <p className="mt-4 text-slate-300">
        To the maximum extent permitted by law, Six Figure Jobs will not be
        liable for indirect, incidental, special, consequential, or punitive
        damages.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Changes
      </h2>
      <p className="mt-4 text-slate-300">
        We may update these Terms from time to time. Continued use of the site
        means you accept the updated Terms.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        Contact
      </h2>
      <p className="mt-4 text-slate-300">
        Questions? Email{' '}
        <a className="text-emerald-300 underline" href="mailto:legal@6figjobs.com">
          legal@6figjobs.com
        </a>
        .
      </p>

      <p className="mt-10 text-sm text-slate-500">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
    </main>
  )
}
      