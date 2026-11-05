'use client'

import * as React from 'react'
import { Flag } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { JOB_REPORT_REASONS, type JobReportReason } from '@/lib/jobs/jobReport'

type Status = 'idle' | 'sending' | 'done' | 'error'

/** "Report this job" link + dialog. Reports go to /api/report-job and show up in the admin Feedback list. */
export function ReportJob({ jobId }: { jobId: string }) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState<JobReportReason | ''>('')
  const [details, setDetails] = React.useState('')
  const [website, setWebsite] = React.useState('') // honeypot
  const [status, setStatus] = React.useState<Status>('idle')
  const [error, setError] = React.useState('')

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // Reset after closing, keeping a finished report's confirmation out of the next open.
      setTimeout(() => {
        setReason('')
        setDetails('')
        setStatus('idle')
        setError('')
      }, 200)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) return
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/report-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, reason, details, website, path: window.location.pathname }),
      })
      if (res.ok) {
        setStatus('done')
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.')
      setStatus('error')
    } catch {
      setError('Could not send the report. Check your connection and try again.')
      setStatus('error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <Flag className="size-3.5" aria-hidden="true" /> Report this job
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this job</DialogTitle>
          <DialogDescription>
            Tell us what is wrong. We review every report and remove listings that don&rsquo;t belong.
          </DialogDescription>
        </DialogHeader>

        {status === 'done' ? (
          <p role="status" className="text-sm text-foreground">
            Thank you. We&rsquo;ll look into it.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-foreground">What is the problem?</legend>
              {(Object.keys(JOB_REPORT_REASONS) as JobReportReason[]).map((key) => (
                <label key={key} className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="reason"
                    value={key}
                    checked={reason === key}
                    onChange={() => setReason(key)}
                    className="mt-0.5 accent-[var(--color-primary-text)]"
                  />
                  {JOB_REPORT_REASONS[key].label}
                </label>
              ))}
            </fieldset>

            <div>
              <label htmlFor="report-details" className="mb-1 block text-sm font-medium text-foreground">
                Details <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Anything that helps us check it"
              />
            </div>

            {/* Honeypot: hidden from people and assistive tech, bots tend to fill it. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>

            {error ? (
              <p role="alert" className="text-sm text-[var(--color-error-text)]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!reason || status === 'sending'}
              className="inline-flex items-center justify-center rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-[var(--color-primary-light)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Send report'}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
