// A local stand-in for an employer's Greenhouse application page (the newer job-boards form): same control ids, searchable
// dropdowns, a résumé upload, a cover letter behind "Enter manually". It records exactly what is submitted and can end the
// submission in each way the real site can (?mode=confirm | captcha | code | silent | invalid). Used to exercise the browser
// driver without ever touching a real employer.

import { createServer, type Server } from 'http'

export type Received = { fields: Record<string, string | string[]>; resumeFile: string | null }

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Job</title></head><body>
<h1>Software Engineer</h1>
<form id="application-form" novalidate>
  <label for="first_name">First Name*</label><input id="first_name" type="text" required aria-required="true">
  <label for="last_name">Last Name*</label><input id="last_name" type="text" required aria-required="true">
  <label for="email">Email*</label><input id="email" type="text" required aria-required="true">
  <div class="select__container"><label for="country">Country*</label>
    <input id="country" type="text" role="combobox" required aria-required="true" autocomplete="off"><div class="opts"></div></div>
  <label for="phone">Phone*</label><input id="phone" type="tel" required aria-required="true">
  <label for="candidate-location">Location (City)</label><input id="candidate-location" type="text" role="combobox" autocomplete="off">
  <div class="upload"><label>Resume/CV</label><input id="resume" type="file"><button type="button">Attach</button><button type="button">Enter manually</button></div>
  <div class="upload"><label>Cover Letter</label><input id="cover_letter" type="file"><button type="button">Attach</button>
    <button type="button" id="cl-manual">Enter manually</button><div id="cl-slot"></div></div>
  <div class="select__container"><label for="question_1">Are you legally authorized to work in the United States?*</label>
    <input id="question_1" type="text" role="combobox" required aria-required="true" autocomplete="off"><div class="opts"></div></div>
  <fieldset><legend>What matters most?*</legend>
    <label><input type="checkbox" id="question_2[]_11" required aria-required="true">Career Growth</label>
    <label><input type="checkbox" id="question_2[]_12" required aria-required="true">Culture</label></fieldset>
  <label for="question_3">Why us?*</label><textarea id="question_3" required aria-required="true"></textarea>
  <label for="question_4">LinkedIn Profile</label><input id="question_4" type="text">
  <button type="submit">Submit application</button>
</form>
<script>
  const OPTIONS = { country: ['United States', 'Canada', 'United Kingdom'], question_1: ['Yes', 'No'] }
  document.querySelectorAll('.select__container').forEach((box) => {
    const input = box.querySelector('input'); const list = box.querySelector('.opts')
    const show = () => {
      const q = input.value.toLowerCase()
      list.innerHTML = ''
      OPTIONS[input.id].filter((o) => o.toLowerCase().includes(q)).forEach((o) => {
        const d = document.createElement('div'); d.setAttribute('role', 'option'); d.textContent = o
        d.addEventListener('click', () => {
          input.value = ''; list.innerHTML = ''
          box.querySelector('.select__single-value')?.remove()
          const v = document.createElement('div'); v.className = 'select__single-value'; v.textContent = o; box.appendChild(v)
        })
        list.appendChild(d)
      })
    }
    input.addEventListener('focus', show); input.addEventListener('input', show); input.addEventListener('click', show)
  })
  document.getElementById('cl-manual').addEventListener('click', () => {
    document.getElementById('cl-slot').innerHTML = '<textarea id="cover_letter_text"></textarea>'
  })
  const val = (id) => document.getElementById(id)?.value ?? ''
  const chosen = (id) => document.getElementById(id).closest('.select__container').querySelector('.select__single-value')?.textContent ?? ''
  document.getElementById('application-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const boxes = [...document.querySelectorAll('input[type=checkbox]')]
    const missing = ['first_name', 'last_name', 'email', 'phone', 'question_3'].filter((id) => !val(id).trim())
    if (!chosen('country') || !chosen('question_1') || !boxes.some((b) => b.checked)) missing.push('select')
    if (missing.length) { document.getElementById(missing[0] === 'select' ? 'country' : missing[0])?.setAttribute('aria-invalid', 'true'); return }
    const fields = { first_name: val('first_name'), last_name: val('last_name'), email: val('email'), phone: val('phone'),
      country: chosen('country'), city: val('candidate-location'), authorized: chosen('question_1'), why: val('question_3'),
      linkedin: val('question_4'), cover_letter: val('cover_letter_text'), matters: boxes.filter((b) => b.checked).map((b) => b.id) }
    const file = document.getElementById('resume').files[0]
    await fetch('/__submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields, resumeFile: file ? file.name : null, resumeBytes: file ? file.size : 0 }) })
    const mode = new URLSearchParams(location.search).get('mode') || 'confirm'
    if (mode === 'confirm') document.body.innerHTML = '<h1>Thank you for applying.</h1><p>We have received your application.</p>'
    if (mode === 'captcha') document.body.insertAdjacentHTML('beforeend', '<p>Please complete the captcha to verify you are human.</p>')
    if (mode === 'code') document.body.insertAdjacentHTML('beforeend', '<p>Enter the security code we emailed you.</p>')
    if (mode === 'invalid') document.getElementById('first_name').setAttribute('aria-invalid', 'true')
  })
</script></body></html>`

export async function startFixtureServer(): Promise<{ url: string; received: Array<Received & { resumeBytes: number }>; close: () => Promise<void> }> {
  const received: Array<Received & { resumeBytes: number }> = []
  const server: Server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__submit') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        received.push(JSON.parse(body))
        res.end('ok')
      })
      return
    }
    if (req.url?.startsWith('/missing')) {
      res.statusCode = 404
      res.end('<html><body>Job not found</body></html>')
      return
    }
    res.setHeader('content-type', 'text/html')
    res.end(PAGE)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const port = (server.address() as { port: number }).port
  return { url: `http://127.0.0.1:${port}`, received, close: () => new Promise((r) => server.close(() => r())) }
}
