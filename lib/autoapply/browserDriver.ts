// Fills (and, only in live mode, submits) one employer form in a real browser. Imported by the worker script only, never by
// the Next.js app: it needs puppeteer, a dev dependency, and a Chromium to drive.
//
// What it will never do: solve or work around a captcha, pretend to be another browser, answer a question that is not in the
// approved plan, or submit while a required field is still empty. Anything it does not recognise stops the application and
// hands it back to the user with the employer's own link; nothing is charged for that.

import { mkdtemp, rmdir, unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import type { Browser, ElementHandle, Page } from 'puppeteer'

import type { PlanField } from './plan'
import type { ApplyDriver, DriverRequest } from './service'
import type { Outcome } from './state'

const CONFIRM = /thank you for applying|thanks for applying|application (has been |was )?(successfully )?(submitted|received)|we(?:'ve| have) received your application/i
const SECURITY = /security code|verification code|enter the code/i
const CAPTCHA = /captcha|verify (?:that )?you(?:'re| are) (?:a )?human|are you a robot|unusual (?:traffic|activity)/i
const LOGIN = /(?:sign|log) in to (?:continue|apply)|enter your password/i

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const sel = (id: string) => `[id="${id.replace(/"/g, '\\"')}"]`
const bodyText = (page: Page) => page.evaluate(() => document.body.innerText || '')

export type BrowserDriverOptions = { launch: () => Promise<Browser>; confirmTimeoutMs?: number; formTimeoutMs?: number }

async function fillText(page: Page, id: string, value: string): Promise<boolean> {
  const el = await page.$(sel(id))
  if (!el) return false
  await el.evaluate((e) => (e as HTMLElement).scrollIntoView({ block: 'center' }))
  await el.click({ clickCount: 3 })
  await page.keyboard.press('Backspace')
  await el.type(value, { delay: 0 })
  return true
}

/** The employer's dropdowns are searchable comboboxes: open, type the option's text, click the matching option. */
async function chooseOption(page: Page, id: string, label: string): Promise<boolean> {
  const el = await page.$(sel(id))
  if (!el) return false
  await el.evaluate((e) => (e as HTMLElement).scrollIntoView({ block: 'center' }))
  await el.click()
  await el.type(label.slice(0, 40), { delay: 0 })
  // Wait for the list to show the option (React lists render a moment after typing), up to 2 s, instead of a fixed pause.
  await page
    .waitForFunction(
      (want: string) => Array.from(document.querySelectorAll('[role="option"]')).some((o) => (o.textContent || '').trim().toLowerCase() === want),
      { timeout: 2000 },
      label.trim().toLowerCase(),
    )
    .catch(() => {})
  const options = await page.$$('[role="option"]')
  for (const o of options) {
    const t = ((await o.evaluate((n) => n.textContent)) || '').trim().toLowerCase()
    if (t === label.trim().toLowerCase()) {
      await o.click()
      return true
    }
  }
  await page.keyboard.press('Escape')
  return false
}

async function checkBox(page: Page, id: string, valueId: string): Promise<boolean> {
  const el = await page.$(sel(`${id}[]_${valueId}`))
  if (!el) return false
  await el.evaluate((e) => (e as HTMLElement).scrollIntoView({ block: 'center' }))
  if (!(await el.evaluate((e) => (e as HTMLInputElement).checked))) await el.click()
  return true
}

/** The résumé text as a PDF, drawn by the browser itself, so no extra package is needed. Returns the file path. */
async function makeResumePdf(browser: Browser, text: string, dir: string): Promise<string> {
  const page = await browser.newPage()
  try {
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    await page.setContent(`<pre style="font:12px/1.45 Helvetica,Arial,sans-serif;white-space:pre-wrap;margin:0">${esc}</pre>`)
    const path = join(dir, 'Resume.pdf')
    await writeFile(path, await page.pdf({ format: 'A4', margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' } }))
    return path
  } finally {
    await page.close()
  }
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Reads a control back after filling it: does the employer's form now hold exactly what the user approved? A text box
 * must hold the text, a dropdown must show the approved option's label, a checkbox group the approved boxes, the resume
 * input a file, and a phone field with a separate country picker must show the same dialling code as the number.
 * Fields with nothing to enter, and a country/city the form does not ask for, count as set.
 */
async function isSet(page: Page, f: PlanField): Promise<boolean> {
  const v = f.value
  if (v == null || (typeof v === 'string' && v.trim() === '')) return true
  if (f.type === 'file') {
    if (f.key !== 'resume') return true
    return page.evaluate((id: string) => {
      const input = document.getElementById(id) as HTMLInputElement | null
      if (!input) return false
      return (input.files?.length ?? 0) > 0 || /\.(pdf|docx?|txt)\b/i.test(input.closest('div')?.textContent || '')
    }, f.key)
  }
  if (f.type === 'multi') {
    const list = (Array.isArray(v) ? v : [v]).map((valueId) => `${f.key}[]_${valueId}`)
    return page.evaluate((ids: string[]) => ids.every((id) => (document.getElementById(id) as HTMLInputElement | null)?.checked === true), list)
  }
  const optional = f.key === 'country' || f.key === 'candidate-location'
  const want = f.type === 'single' ? f.options?.find((o) => o.value === v)?.label ?? '' : String(v)
  const state = await page.evaluate((id: string) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null
    if (!el) return null
    const box = el.closest('.select__container, [class*="select"]')
    const shown = box?.querySelector('.select__single-value, [class*="singleValue"]')?.textContent ?? null
    // intl-tel-input and similar widgets show the chosen country's dialling code next to the phone box.
    const scope = el.closest('[class*="phone"], [class*="iti"], .field') ?? el.parentElement
    const dial = scope?.querySelector('.iti__selected-dial-code, [class*="dial-code"], [class*="dialCode"]')?.textContent ?? null
    return { value: el.value ?? '', shown, dial, combobox: el.getAttribute('role') === 'combobox' }
  }, f.key)
  if (!state) return optional
  if (f.key === 'phone' && state.dial) {
    const code = state.dial.replace(/[^\d+]/g, '')
    if (!code || !String(v).replace(/[\s().-]/g, '').startsWith(code)) return false
  }
  if (f.type === 'single' || (state.combobox && state.shown !== null && f.key !== 'candidate-location')) return norm(state.shown ?? '') === norm(want)
  // A city box may be an autocomplete that keeps the typed text or shows the chosen place: either is the user's own text.
  if (state.combobox) return norm(state.value) === norm(want) || norm(state.shown ?? '') === norm(want)
  return norm(state.value) === norm(want)
}

/** Fills one field from the plan. Returns true when the control was found and set. */
async function fillField(page: Page, f: PlanField, resumePath: string): Promise<boolean> {
  const v = f.value
  if (v == null || (typeof v === 'string' && v.trim() === '')) return true // nothing to enter for an empty optional field
  if (f.type === 'file') {
    if (f.key !== 'resume') return true
    const input = await page.$(sel('resume'))
    if (!input) return false
    await (input as ElementHandle<HTMLInputElement>).uploadFile(resumePath)
    return true
  }
  if (f.key === 'cover_letter_text') {
    if (!(await page.$(sel('cover_letter_text')))) {
      const reveal = await page.evaluateHandle(() => {
        const input = document.getElementById('cover_letter')
        const scope = input?.closest('[class*="upload"], [class*="field"], fieldset, div') ?? document
        return Array.from(scope.querySelectorAll('button')).find((b) => /enter manually/i.test(b.textContent || '')) ?? null
      })
      const btn = reveal.asElement()
      if (!btn) return false
      await (btn as ElementHandle<Element>).click()
      await sleep(200)
    }
    return fillText(page, 'cover_letter_text', String(v))
  }
  if (f.type === 'single') {
    const label = f.options?.find((o) => o.value === v)?.label
    return label ? chooseOption(page, f.key, label) : false
  }
  if (f.type === 'multi') {
    const list = Array.isArray(v) ? v : [v]
    let ok = true
    for (const valueId of list) ok = (await checkBox(page, f.key, valueId)) && ok
    return ok
  }
  // The newer form asks for a country and a city; an older form does not, and then there is nothing to fill.
  if (f.key === 'country') return (await page.$(sel('country'))) ? chooseOption(page, 'country', String(v)) : true
  if (f.key === 'candidate-location') return (await page.$(sel('candidate-location'))) ? fillText(page, 'candidate-location', String(v)) : true
  return fillText(page, f.key, String(v))
}

/** Required controls on the page that are still empty. If any, we refuse to submit. */
function unfilledRequired(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const groups = new Map<string, boolean>()
    const out: string[] = []
    for (const e of Array.from(document.querySelectorAll('input, textarea, select')) as HTMLInputElement[]) {
      const required = e.required || e.getAttribute('aria-required') === 'true'
      if (!required || e.disabled || e.type === 'hidden' || !e.id) continue
      if (e.type === 'checkbox') {
        const group = e.id.split(']_')[0]
        groups.set(group, (groups.get(group) ?? false) || e.checked)
        continue
      }
      let filled: boolean
      if (e.type === 'file') filled = (e.files?.length ?? 0) > 0 || !!e.closest('div')?.textContent?.match(/\.(pdf|docx?|txt)/i)
      else if (e.getAttribute('role') === 'combobox')
        filled = !!e.closest('.select__container, [class*="select"]')?.querySelector('.select__single-value, .select__multi-value, [class*="singleValue"]')
      else filled = e.value.trim() !== ''
      if (!filled) out.push(e.id)
    }
    for (const [g, ok] of groups) if (!ok) out.push(g)
    return out
  })
}

/** The employer's label text for each control id (label[for], aria-label or aria-labelledby), cut to 120 characters. */
function labelsFor(page: Page, ids: string[]): Promise<Record<string, string>> {
  return page.evaluate((list: string[]) => {
    const out: Record<string, string> = {}
    for (const id of list) {
      const el = document.getElementById(id) ?? document.querySelector(`[id^="${CSS.escape(id)}"]`)
      const byFor = document.querySelector(`label[for="${CSS.escape(id)}"]`) as HTMLElement | null
      const by = el?.getAttribute('aria-labelledby')
      const text = byFor?.innerText || el?.getAttribute('aria-label') || (by ? document.getElementById(by)?.innerText : '') || ''
      const clean = text.replace(/\s+/g, ' ').replace(/\*$/, '').trim().slice(0, 120)
      if (clean) out[id] = clean
    }
    return out
  }, ids)
}

export function createBrowserDriver(opts: BrowserDriverOptions): ApplyDriver {
  const formTimeout = opts.formTimeoutMs ?? 20_000
  const confirmTimeout = opts.confirmTimeoutMs ?? 30_000

  return async (req: DriverRequest): Promise<Outcome> => {
    const browser = await opts.launch()
    const dir = await mkdtemp(join(tmpdir(), 'autoapply-'))
    let resumePath = ''
    try {
      resumePath = await makeResumePdf(browser, req.resumeText, dir)
      const page = await browser.newPage()
      await page.setViewport({ width: 1200, height: 900 })
      await page.goto(req.applyUrl, { waitUntil: 'domcontentloaded', timeout: formTimeout })
      try {
        await page.waitForSelector(sel('first_name'), { timeout: formTimeout })
      } catch {
        const t = await bodyText(page)
        if (CAPTCHA.test(t)) return { kind: 'needs_user', reason: 'captcha' }
        if (LOGIN.test(t)) return { kind: 'needs_user', reason: 'login' }
        return { kind: 'failed', reason: 'form_not_found' }
      }

      const filled: string[] = []
      const missed: string[] = []
      const notSet: string[] = []
      const has = (f: PlanField) => f.value != null && !(typeof f.value === 'string' && f.value.trim() === '')
      // Fill, read back, and try once more if the form did not take it. A control that still does not hold the approved
      // value is never guessed at: the application stops and goes back to the user.
      const fillAndCheck = async (f: PlanField): Promise<'ok' | 'missing' | 'not_set'> => {
        if (!(await fillField(page, f, resumePath))) return 'missing'
        if (await isSet(page, f)) return 'ok'
        await sleep(300)
        if ((await fillField(page, f, resumePath)) && (await isSet(page, f))) return 'ok'
        return 'not_set'
      }
      for (const f of req.plan.fields) {
        if (!has(f)) {
          await fillField(page, f, resumePath)
          continue
        }
        const r = await fillAndCheck(f)
        ;(r === 'ok' ? filled : r === 'missing' ? missed : notSet).push(f.key)
      }
      // Some forms read the uploaded resume and overwrite fields already filled. Check every one again at the end.
      if (req.plan.fields.some((f) => f.type === 'file' && has(f))) {
        await sleep(500)
        for (const f of req.plan.fields) {
          if (!filled.includes(f.key) || f.type === 'file' || (await isSet(page, f))) continue
          if ((await fillAndCheck(f)) !== 'ok') {
            filled.splice(filled.indexOf(f.key), 1)
            notSet.push(f.key)
          }
        }
      }
      const unfilled = [...new Set([...(await unfilledRequired(page)), ...missed, ...notSet])]

      const labels = unfilled.length > 0 ? await labelsFor(page, unfilled).catch(() => ({})) : {}
      if (!req.live) return { kind: 'dry_run', filled, unfilled, labels, ...(notSet.length ? { notSet } : {}) }
      if (notSet.length > 0) return { kind: 'needs_user', reason: 'control_not_set', unfilled: notSet, labels }
      if (unfilled.length > 0) return { kind: 'needs_user', reason: 'unexpected_field', unfilled, labels }

      const before = await bodyText(page)
      const baseline = { captcha: CAPTCHA.test(before), security: SECURITY.test(before) }
      const submit = await page.$('button[type="submit"]')
      if (!submit) return { kind: 'failed', reason: 'no_submit_button' }
      await submit.click()

      const deadline = Date.now() + confirmTimeout
      while (Date.now() < deadline) {
        await sleep(750)
        const t = await bodyText(page).catch(() => '')
        const m = CONFIRM.exec(t)
        if (m) return { kind: 'submitted', evidence: t.slice(Math.max(0, m.index - 80), m.index + 220).trim() }
        if (!baseline.security && SECURITY.test(t)) return { kind: 'needs_user', reason: 'security_code' }
        if (!baseline.captcha && CAPTCHA.test(t)) return { kind: 'needs_user', reason: 'captcha' }
        if (await page.$('[aria-invalid="true"]')) return { kind: 'needs_user', reason: 'validation' }
      }
      // We clicked submit and saw nothing either way. It may have gone through, so never charge and never retry on our own.
      return { kind: 'needs_user', reason: 'unconfirmed' }
    } finally {
      if (resumePath) await unlink(resumePath).catch(() => {})
      await rmdir(dir).catch(() => {})
      await browser.close().catch(() => {})
    }
  }
}
