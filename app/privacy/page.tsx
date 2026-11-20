import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Six Figure Jobs',
  description:
    'Privacy Policy for Six Figure Jobs. Learn what data we collect, how we use it, and the choices you have.',
  alternates: {
    canonical: 'https://www.6figjobs.com/privacy',
  },
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Privacy Policy
      </h1>

      <p className="mt-5 text-muted-foreground">
        This Privacy Policy describes how Six Figure Jobs (“we”, “us”) collects,
        uses, and shares information when you use our website.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        Information we collect
      </h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-muted-foreground">
        <li>
          <strong>Usage data:</strong> basic analytics such as pages visited,
          device/browser type, and approximate location (e.g., country/city).
        </li>
        <li>
          <strong>Apply clicks:</strong> when you click Apply on a job we count the click (which job, which
          button, and whether you are on a phone or a computer). We do not store your IP address, user agent or any
          cookie or ID with it, and we do not count clicks from visitors who send Do Not Track or Global Privacy
          Control.
        </li>
        <li>
          <strong>Cookies:</strong> for essential site functionality and
          measurement. See{' '}
          <a className="text-primary underline" href="/cookies">
            Cookie Policy
          </a>
          .
        </li>
        <li>
          <strong>Contact data:</strong> if you email us, we receive your message
          and email address.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        Email job alerts
      </h2>
      <p className="mt-4 text-muted-foreground">
        If you sign up for a free job alert, we store your email address, your first name if you give it, the search you chose (for example a role,
        country or pay level), how often you want to hear from us (daily or weekly), the page you signed up on, when
        you confirmed, and which jobs we have already emailed you. We use this only to send you that alert. We first
        send one email asking you to confirm, and we send nothing more until you do. Every alert email has an
        unsubscribe link, and your email provider’s own unsubscribe button works too. The emails are sent through an
        email delivery provider that processes your address for us. We keep an alert until you unsubscribe; after you
        unsubscribe we keep the address and the alert record so that signing up again works, and you can ask us to
        delete them by emailing{' '}
        <a className="text-primary underline" href="mailto:privacy@6figjobs.com">
          privacy@6figjobs.com
        </a>
        . The signup pop-up remembers on your device (in your browser’s local storage, not a cookie) that you closed it
        or signed up, so it does not keep appearing.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        How we use information
      </h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-muted-foreground">
        <li>Operate and improve the site (performance, reliability).</li>
        <li>Understand which pages are useful and reduce low-value pages.</li>
        <li>Prevent abuse, bots, and scraping.</li>
        <li>Respond to support requests.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        Sharing of information
      </h2>
      <p className="mt-4 text-muted-foreground">
        We do not sell your personal information. We may share limited data with
        service providers that help us operate the site (hosting, analytics,
        logging) under appropriate safeguards.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        International visitors
      </h2>
      <p className="mt-4 text-muted-foreground">
        We serve users globally. Your information may be processed in countries
        where we or our providers operate. Where required, we use safeguards for
        cross-border transfers.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        Your choices
      </h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-muted-foreground">
        <li>You can control cookies via your browser settings.</li>
        <li>You can request deletion of support emails you’ve sent us.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        Contact
      </h2>
      <p className="mt-4 text-muted-foreground">
        Questions? Email{' '}
        <a className="text-primary underline" href="mailto:privacy@6figjobs.com">
          privacy@6figjobs.com
        </a>
        .
      </p>

      <p className="mt-10 text-sm text-muted-foreground">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
    </main>
  )
}
