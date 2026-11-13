import type { Metadata } from 'next'
import Link from '@/components/ui/Link'
import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'
import { SPONSOR_SLOT_COUNT } from '@/lib/sponsors/slots'

const SITE_URL = getSiteUrl()
const CONTACT = 'support@6figjobs.com'

// A sales page, not a search landing page: noindex keeps it out of the results (no thin page to rank), and it carries no
// hreflang. It is linked from the footer and left out of the sitemaps.
export const metadata: Metadata = {
  title: `Advertise on ${SITE_NAME}`,
  description: 'Put your company in front of people searching for $100k+ jobs, with a clearly labelled sponsored placement.',
  alternates: { canonical: `${SITE_URL}/post-a-job` },
  robots: { index: false, follow: true },
}

export default function PostAJobPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Advertise on {SITE_NAME}</h1>
      <p className="mt-5 text-base leading-7 text-muted-foreground">
        People come here to find roles that pay $100k or more. A sponsored placement puts your company, hiring page or
        product in front of them, above the job list.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">What you get</h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-muted-foreground">
        <li>
          A card with your name, logo and one line of text, above the job list on <Link className="text-primary underline" href="/jobs">/jobs</Link> and on
          the home page.
        </li>
        <li>
          Only {SPONSOR_SLOT_COUNT} placements at a time, for the dates we agree. A placement ends on its last day by
          itself.
        </li>
        <li>A link to the page you choose, tagged so you can see the visits from us in your own analytics.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-foreground">What it does not do</h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-muted-foreground">
        <li>It is always labelled &ldquo;Sponsored&rdquo;, and the link is marked as a paid link.</li>
        <li>It does not change how jobs are ordered, and it does not add a job to the listings.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-foreground">Want your jobs listed?</h2>
      <p className="mt-4 text-muted-foreground">
        That happens automatically. We collect jobs from employers&apos; careers pages and the applicant tracking systems they
        post on, and list the ones that publish a salary at or above the six-figure floor for their currency. See{' '}
        <Link className="text-primary underline" href="/method">how it works</Link>.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">Get in touch</h2>
      <p className="mt-4 text-muted-foreground">
        Tell us who you are, what you want to promote and when. We reply with availability and rates at{' '}
        <a
          className="text-primary underline"
          href={`mailto:${CONTACT}?subject=${encodeURIComponent('Sponsored placement')}`}
        >
          {CONTACT}
        </a>
        .
      </p>
    </main>
  )
}
