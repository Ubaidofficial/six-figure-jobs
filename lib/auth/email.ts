// The magic-link email, sent with nodemailer over the SMTP server named by EMAIL_SERVER.
// Auth.js's default sender is not used so that nothing about the recipient is logged and the message is ours.

import { createTransport } from 'nodemailer'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Pure so it can be tested: subject, plain text and HTML for one sign-in link. */
export function buildSignInEmail(url: string, minutesValid: number) {
  const host = new URL(url).host
  const text = [
    `Sign in to Six Figure Jobs (${host})`,
    '',
    url,
    '',
    `This link works once and expires in ${minutesValid} minutes. If you did not ask for it, you can ignore this email.`,
  ].join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0e0f0c">
<p style="font-size:18px;font-weight:600;margin:0 0 16px">Sign in to Six Figure Jobs</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#84cc16;color:#0a0a0a;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">Sign in</a></p>
<p style="font-size:14px;color:#4a4a45;margin:0">This link works once and expires in ${minutesValid} minutes. If you did not ask for it, you can ignore this email.</p>
</div>`
  return { subject: 'Your sign-in link for Six Figure Jobs', text, html }
}

export async function sendSignInEmail(params: {
  identifier: string
  url: string
  server: string
  from: string
  minutesValid: number
}): Promise<void> {
  const { subject, text, html } = buildSignInEmail(params.url, params.minutesValid)
  const result = await createTransport(params.server).sendMail({
    to: params.identifier,
    from: params.from,
    subject,
    text,
    html,
  })
  // Deliberately generic: the transport's message can contain the recipient address.
  // `pending` exists only on some transports (the pool one); a plain SMTP result has `rejected` alone.
  const refused = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean)
  if (refused.length > 0) throw new Error('sign-in email was not accepted')
}
