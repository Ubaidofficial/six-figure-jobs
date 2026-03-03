// lib/scrapers/utils/extractApplyLink.ts

import type { Page } from 'puppeteer'
import * as cheerio from 'cheerio'

import { detectATS } from './detectATS'

function looksLikeAbsoluteHttpUrl(maybeUrl: string): boolean {
  return /^https?:\/\//i.test(String(maybeUrl || '').trim())
}

function normalizeHost(host: string): string {
  return String(host || '').replace(/^www\./, '').toLowerCase()
}

function unwrapRemoteOkRedirectLink(
  rawHref: string,
  pageUrl: string,
  attrs: Record<string, string | undefined>,
): string | null {
  const href = String(rawHref || '').trim()
  if (!href) return null

  for (const key of ['data-url', 'data-href', 'data-redirect', 'data-destination', 'data-apply-url']) {
    const v = attrs[key]
    if (v && looksLikeAbsoluteHttpUrl(v)) {
      try {
        const h = normalizeHost(new URL(v).hostname)
        if (h && h !== 'remoteok.com') return v
      } catch {
        // ignore
      }
    }
  }

  try {
    const u = new URL(href, pageUrl)
    const host = normalizeHost(u.hostname)
    if (host !== 'remoteok.com') return null
    if (!u.pathname.startsWith('/l/')) return null

    const qp =
      u.searchParams.get('url') ||
      u.searchParams.get('u') ||
      u.searchParams.get('dest') ||
      u.searchParams.get('redirect') ||
      null

    if (qp && looksLikeAbsoluteHttpUrl(qp)) return qp

    if (qp) {
      try {
        const decoded = decodeURIComponent(qp)
        if (looksLikeAbsoluteHttpUrl(decoded)) return decoded
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  return null
}

export async function extractApplyDestination(page: Page, sourceUrl: string): Promise<string | null> {
  void sourceUrl

  const href = await page.evaluate(`(() => {
    function normalizeHost(host) {
      return String(host || '').replace(/^www\\./, '').toLowerCase();
    }

    function isExternal(href) {
      try {
        var u = new URL(href, window.location.href);
        return normalizeHost(u.hostname) !== normalizeHost(window.location.hostname);
      } catch (e) {
        return false;
      }
    }

    function hasApplyText(text) {
      var t = String(text || '').toLowerCase().trim();
      return t.indexOf('apply') !== -1 ||
        t.indexOf('view job') !== -1 ||
        t.indexOf('see job') !== -1 ||
        t.indexOf('original') !== -1 ||
        t.indexOf('more details') !== -1;
    }

    function isKnownAtsDomain(href) {
      var h = String(href || '').toLowerCase();
      return h.indexOf('greenhouse.io') !== -1 ||
        h.indexOf('boards.greenhouse.io') !== -1 ||
        h.indexOf('lever.co') !== -1 ||
        h.indexOf('ashbyhq.com') !== -1 ||
        h.indexOf('myworkdayjobs.com') !== -1 ||
        h.indexOf('bamboohr.com') !== -1 ||
        h.indexOf('smartrecruiters.com') !== -1 ||
        h.indexOf('recruitee.com') !== -1 ||
        h.indexOf('teamtailor.com') !== -1 ||
        h.indexOf('workable.com') !== -1 ||
        h.indexOf('breezy.hr') !== -1;
    }

    var links = Array.from(document.querySelectorAll('a'));
    var bestHref = null;
    var bestScore = 0;

    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = a.href || a.getAttribute('href') || '';
      if (!href) continue;

      var text = a.textContent || '';
      var score = 0;

      if (hasApplyText(text)) score += 50;
      if (isKnownAtsDomain(href)) score += 100;
      if (isExternal(href)) score += 25;

      if (score > bestScore) {
        bestScore = score;
        bestHref = href;
      }
    }

    return bestScore >= 50 ? bestHref : null;
  })()`)

  return typeof href === 'string' && href.trim() ? href.trim() : null
}

export function extractApplyDestinationFromHtml(html: string, pageUrl: string): string | null {
  if (!html) return null

  try {
    const $ = cheerio.load(html)
    const pageHost = new URL(pageUrl).hostname.replace(/^www\./, '').toLowerCase()

    let bestHref: string | null = null
    let bestScore = 0

    $('a[href]').each((_i, el) => {
      const rawHref = $(el).attr('href')
      if (!rawHref) return

      let href: string
      try {
        href = new URL(rawHref, pageUrl).toString()
      } catch {
        return
      }

      if (pageHost === 'remoteok.com') {
        const unwrapped = unwrapRemoteOkRedirectLink(href, pageUrl, {
          'data-url': $(el).attr('data-url'),
          'data-href': $(el).attr('data-href'),
          'data-redirect': $(el).attr('data-redirect'),
          'data-destination': $(el).attr('data-destination'),
          'data-apply-url': $(el).attr('data-apply-url'),
        })
        if (unwrapped) href = unwrapped
      }

      const linkHost = new URL(href).hostname.replace(/^www\./, '').toLowerCase()
      const isExternal = linkHost !== pageHost

      const text = ($(el).text() || '').toLowerCase().trim()
      const title = ($(el).attr('title') || '').toLowerCase().trim()
      const rel = ($(el).attr('rel') || '').toLowerCase()

      const applyText =
        text.includes('apply') ||
        title.includes('apply') ||
        text.includes('view job') ||
        text.includes('original') ||
        text.includes('more details')

      const atsType = detectATS(href)

      let score = 0
      if (applyText) score += 50
      if (atsType !== 'generic') score += 100
      if (isExternal) score += 25
      if (rel.includes('nofollow')) score += 5

      if (score > bestScore) {
        bestScore = score
        bestHref = href
      }
    })

    return bestScore >= 50 ? bestHref : null
  } catch {
    return null
  }
}
