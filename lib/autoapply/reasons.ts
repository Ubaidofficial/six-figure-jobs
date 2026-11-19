// lib/autoapply/reasons.ts
// What each stop reason means for the user, in plain words, and what they should do next. Shown on the application's
// page (/account/autoapply/<id>) and as a hint in the owner's run report. Every code the worker or the service can
// write is listed here (a test checks it), so no user ever sees a bare code or a vague "it stopped".

export type ReasonText = {
  /** What happened, in one sentence. */
  what: string
  /** What the user should do now. */
  next: string
}

const FINISH = 'Open the employer’s form below and submit it yourself. Your approved answers are listed underneath to copy.'

export const REASONS: Record<string, ReasonText> = {
  captcha: {
    what: 'The employer’s site asked to prove you are a person (a captcha). We never try to get past those.',
    next: FINISH,
  },
  security_code: {
    what: 'The employer’s site sent a security code to your email and asked for it.',
    next: `${FINISH} If the site asks for a code, it will email it to you again.`,
  },
  login: {
    what: 'The employer’s site asked you to sign in before applying.',
    next: 'Sign in on their site and apply there. Your approved answers are listed underneath to copy.',
  },
  unexpected_field: {
    what: 'The employer’s form has a required question we do not have an answer for, so we stopped rather than guess.',
    next: FINISH,
  },
  validation: {
    what: 'The employer’s site rejected part of the form (for example a phone number or a date format).',
    next: `${FINISH} Their form will show which answer it wants changed.`,
  },
  unconfirmed: {
    what: 'We sent the form, but the employer’s page did not confirm it. It may still have gone through.',
    next: 'Check your email for a confirmation from the employer before applying again, so they do not get it twice.',
  },
  resume_changed: {
    what: 'Your résumé changed after you approved this application, so we did not send the old one.',
    next: 'Prepare auto-apply again from the application kit to review and approve it with your new résumé.',
  },
  plan_changed: {
    what: 'The application changed after you approved it, so we did not send it.',
    next: 'Prepare auto-apply again from the application kit, check the answers and approve.',
  },
  insufficient_credits: {
    what: 'You did not have enough credits when it was time to send. Nothing was sent and nothing was charged.',
    next: 'Add credits on the pricing page and prepare it again, or apply on the employer’s site yourself.',
  },
  form_not_found: {
    what: 'We could not open the employer’s application form. The job may have closed or the page may have moved.',
    next: 'Open the employer’s link below to check whether the job is still open, and apply there if it is.',
  },
  no_submit_button: {
    what: 'We filled the employer’s form but could not find its submit button, so nothing was sent.',
    next: FINISH,
  },
  driver_error: {
    what: 'Something went wrong on our side while filling the form. Nothing was sent.',
    next: FINISH,
  },
  driver_did_not_submit: {
    what: 'The form was filled but not sent, because of a problem on our side.',
    next: FINISH,
  },
}

export function reasonText(code: string | null | undefined): ReasonText {
  return (
    (code && REASONS[code]) || {
      what: 'We stopped before sending this application. Nothing was charged.',
      next: FINISH,
    }
  )
}
