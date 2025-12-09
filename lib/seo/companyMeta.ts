// lib/seo/companyMeta.ts
import type { Metadata } from "next";
import type { Company } from "@prisma/client";
import { getSiteUrl, SITE_NAME } from "./site";

export function buildCompanyCanonical(slug: string) {
  const origin = getSiteUrl();
  return `${origin}/company/${slug}`;
}

export function buildCompanyTitle(company: Company): string {
  return `${company.name} – $100k+ Jobs, Hiring Info, Careers | ${SITE_NAME}`;
}

export function buildCompanyDescription(company: Company, jobCount: number): string {
  return `${company.name} has ${jobCount}+ verified $100k+ job openings. Explore high-paying roles, company info, and how to apply.`;
}

export function buildCompanyMetadata(params: {
  company: Company;
  jobCount: number;
}): Metadata {
  const { company, jobCount } = params;

  const title = buildCompanyTitle(company);
  const description = buildCompanyDescription(company, jobCount);
  const canonical = buildCompanyCanonical(company.slug);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: "website",
      images: company.logoUrl ? [company.logoUrl] : undefined
    },
    twitter: {
      card: "summary",
      title,
      description
    }
  };
}
