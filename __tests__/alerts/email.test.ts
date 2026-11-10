jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { normalizeEmail, suggestEmailFix } from '@/lib/alerts/email'
import { csvField } from '@/lib/alerts/csv'
import { readSource } from '@/lib/alerts/service'

describe('reading the address a visitor typed', () => {
  it('trims, lower-cases and removes invisible characters copied with it', () => {
    expect(normalizeEmail('  Jane.Doe+Jobs@Example.COM ')).toBe('jane.doe+jobs@example.com')
    expect(normalizeEmail('jane​@exam﻿ple.com')).toBe('jane@example.com')
  })

  it('accepts real addresses, including subdomains and internationalised endings', () => {
    for (const ok of ['a@b.co', 'first.last@mail.company.co.uk', "o'brien@example.ie", 'x_y-z@my-domain.io', 'me@example.xn--p1ai']) {
      expect(normalizeEmail(ok)).toBe(ok)
    }
  })

  it('refuses what cannot be delivered', () => {
    for (const bad of [
      '',
      'plainaddress',
      'a@b',
      'a b@c.com',
      'a@b c.com',
      'a@-b.com',
      'a@b-.com',
      'a@b..com',
      '.a@b.com',
      'a.@b.com',
      'a..b@c.com',
      'a@b.c',
      'a@b.c0m',
      '<a@b.com>',
      'a@b.com, c@d.com',
      `${'a'.repeat(65)}@b.com`,
      `a@${'b'.repeat(250)}.com`,
    ]) {
      expect(normalizeEmail(bad)).toBeNull()
    }
    expect(normalizeEmail(42)).toBeNull()
  })
})

describe('suggesting a fix for a likely typo', () => {
  it('fixes common provider slips', () => {
    expect(suggestEmailFix('jane@gmial.com')).toBe('jane@gmail.com')
    expect(suggestEmailFix('jane@gmail.co')).toBe('jane@gmail.com')
    expect(suggestEmailFix('jane@gnail.com')).toBe('jane@gmail.com')
    expect(suggestEmailFix('jane@hotmial.com')).toBe('jane@hotmail.com')
    expect(suggestEmailFix('jane@yaho.com')).toBe('jane@yahoo.com')
    expect(suggestEmailFix('jane@outlok.com')).toBe('jane@outlook.com')
    expect(suggestEmailFix('jane@icloud.co')).toBe('jane@icloud.com')
  })

  it('fixes a mistyped .com on any domain', () => {
    expect(suggestEmailFix('jane@acme.con')).toBe('jane@acme.com')
    expect(suggestEmailFix('jane@acme.cmo')).toBe('jane@acme.com')
  })

  it('leaves correct and regional addresses alone', () => {
    for (const ok of ['jane@gmail.com', 'jane@outlook.de', 'jane@yahoo.fr', 'jane@hotmail.it', 'jane@acme.com', 'jane@mail.om', 'jane@mail.ru', 'jane@gmx.net', 'jane@ae.com', 'jane@web.com', 'jane@live.ca']) {
      expect(suggestEmailFix(ok)).toBeNull()
    }
    expect(suggestEmailFix('not an email')).toBeNull()
  })
})

describe('where the signup came from', () => {
  it('keeps the path only', () => {
    expect(readSource('/jobs/data-engineer?remoteMode=remote#jobs')).toBe('/jobs/data-engineer')
    expect(readSource('/remote')).toBe('/remote')
    expect(readSource('https://evil.example/x')).toBeNull()
    expect(readSource('/<script>')).toBeNull()
    expect(readSource(5)).toBeNull()
    expect(readSource('/' + 'a'.repeat(300))).toBeNull()
  })
})

describe('CSV export', () => {
  it('quotes values and stops spreadsheet formulas', () => {
    expect(csvField('a@b.com')).toBe('"a@b.com"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(csvField('+1')).toBe('"\'+1"')
  })
})
