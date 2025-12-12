// lib/scrapers/base.ts
import slugify from 'slugify';
import { z } from 'zod';
import { NormalizedJobInput, RawAtsJob } from './types';
import { parseSalaryStringsToAnnual } from '../salary/engine';

export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'user-agent': 'SixFigureJobsBot/1.0 (+https://www.6figjobs.com)',
      accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Failed fetching ${url} – ${res.status}`);
  }

  return (await res.json()) as T;
}

export function safeSlug(str: string): string {
  return slugify(str, {
    lower: true,
    strict: true,
    trim: true,
  });
}

const salaryResultSchema = z.object({
  minAnnual: z.number().nullable(),
  maxAnnual: z.number().nullable(),
  currency: z.string().nullable(),
});

export function normalizeAtsJobToInput(
  companyId: string,
  companyName: string,
  source: string,
  job: RawAtsJob
): NormalizedJobInput {
  const { minAnnual, maxAnnual, currency } = salaryResultSchema.parse(
    parseSalaryStringsToAnnual(job.salaryStrings, job.currencyHint)
  );

  return {
    companyId,
    companyName,
    title: job.title,
    slug: safeSlug(job.title),
    externalId: job.externalId,
    externalUrl: job.url,
    source,
    descriptionHtml: job.descriptionHtml ?? null,
    locations: job.locations,
    remote: job.remote,
    employmentType: job.employmentType ?? null,
    department: job.department ?? null,
    postedAt: job.createdAt ?? null,
    updatedAt: job.updatedAt ?? job.createdAt ?? null,
    minAnnual,
    maxAnnual,
    currency,
  };
}
