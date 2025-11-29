// lib/slices/builder.ts

import slugify from 'slugify';
import { prisma } from '../prisma';

export type SliceType =
  | 'role-country'
  | 'city-salary'
  | 'skill-region'
  | 'remote-category';

interface SliceKey {
  type: SliceType;
  key: string;   // unique string representing this slice
  name: string;  // human readable
  slug: string;  // path slug
  filters: any;  // JSON filters used in UI queries
}

function makeSlug(parts: string[]): string {
  return parts
    .map((p) =>
      slugify(p, { lower: true, strict: true, trim: true })
    )
    .filter(Boolean)
    .join('-');
}

// ------- Example: role + country slice -------

function buildRoleCountrySlice(job: any): SliceKey | null {
  if (!job.roleSlug || !job.countryCode) return null;

  const role = job.roleSlug;          // e.g. "data-scientist"
  const country = job.countryCode;    // e.g. "us"
  const name = `${roleToLabel(role)} jobs in ${country.toUpperCase()} paying 100k+`;
  const slug = `jobs/${role}/${country}/100k-plus`;

  return {
    type: 'role-country',
    key: `role-country:${role}:${country}`,
    name,
    slug,
    filters: {
      roleSlug: role,
      countryCode: country,
      minAnnual: 100000,
    },
  };
}

function roleToLabel(roleSlug: string): string {
  return roleSlug
    .split('-')
    .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export async function rebuildSlicesForJob(jobId: string) {
  const job = await (prisma as any).job.findUnique({
    where: { id: jobId },
  });
  if (!job) return;

  const slices: (SliceKey | null)[] = [buildRoleCountrySlice(job)];
  const valid = slices.filter(Boolean) as SliceKey[];

  for (const s of valid) {
    const existing = await (prisma as any).jobSlice.findUnique({
      where: { slug: s.slug },
    });

    if (!existing) {
      await (prisma as any).jobSlice.create({
        data: {
          slug: s.slug,
          type: s.type,
          // if your JobSlice model doesn't have "name" yet,
          // this will still compile because of `as any`
          name: s.name,
          filtersJson: JSON.stringify(s.filters),
          jobCount: 1,
        } as any,
      });
    } else {
      await (prisma as any).jobSlice.update({
        where: { slug: s.slug },
        data: {
          jobCount: { increment: 1 },
          filtersJson: JSON.stringify(s.filters),
        } as any,
      });
    }
  }
}
