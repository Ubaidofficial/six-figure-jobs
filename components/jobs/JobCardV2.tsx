'use client'

import Link from 'next/link'
import { ArrowUpRight, BadgeCheck, Clock, Globe, MapPin, Sparkles } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { buildJobSlug, buildJobSlugHref } from '@/lib/jobs/jobSlug'
import { formatSalaryRange } from "@/lib/normalizers/salary"

interface JobCardV2Props {
  job: {
    id: string
    title: string
    company: {
      name: string
      logo: string | null
    }
    location: string | null
    isRemote: boolean
    salaryMin: number | null
    salaryMax: number | null
    currency: string | null | undefined
    skills: string[]
    postedAt: Date
    snippet?: string | null
  }
  featured?: boolean
}

function formatRelativeTime(date: Date): string {
  const ts = new Date(date as any).getTime()
  if (!Number.isFinite(ts)) return 'recently'

  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return `${Math.floor(seconds / 604800)}w ago`
}

export function JobCardV2({ job, featured = false }: JobCardV2Props) {
  const postedTs = new Date(job.postedAt as any).getTime()
  const isNew =
    Number.isFinite(postedTs) &&
    Date.now() - postedTs < 3 * 24 * 60 * 60 * 1000
  const hasSalary = job.salaryMin != null || job.salaryMax != null

  // Prefer canonical helper if present (keeps routing consistent)
  const href =
    typeof buildJobSlugHref === 'function'
      ? buildJobSlugHref({ id: job.id, title: job.title } as any)
      : `/job/${buildJobSlug({ id: job.id, title: job.title })}`

  return (
    <Link href={href} className="focus-ring group block rounded-2xl">
      <Card
        className={`h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_55px_rgba(16,185,129,0.14)] focus-within:ring-2 focus-within:ring-emerald-400/70 focus-within:ring-offset-2 focus-within:ring-offset-background ${
          featured
            ? 'border-emerald-400/40 ring-1 ring-emerald-400/10 hover:border-emerald-300/60'
            : 'hover:border-emerald-400/25'
        }`}
      >
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              <Avatar className="h-14 w-14 rounded-xl">
                <AvatarImage
                  src={job.company.logo || ''}
                  alt={`${job.company.name} logo`}
                />
                <AvatarFallback className="rounded-xl bg-secondary">
                  {job.company.name?.[0] || 'C'}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <h3 className="line-clamp-1 text-lg font-semibold text-foreground transition-colors group-hover:text-emerald-300">
                  {job.title}
                </h3>
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {job.company.name}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {featured && (
                <Badge className="border-amber-500/20 bg-amber-500/10 text-[11px] font-semibold text-amber-300">
                  <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  FEATURED
                </Badge>
              )}
              {isNew && (
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[11px] font-semibold text-emerald-300">
                  ✨ NEW
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {hasSalary && (
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[11px] font-semibold text-emerald-300">
                <BadgeCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                VERIFIED SALARY
              </Badge>
            )}
          </div>

          <div className="inline-flex items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 font-mono text-lg font-semibold text-emerald-200">
            💰 {formatSalaryRange(job.salaryMin, job.salaryMax, job.currency ?? null)}
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {job.location}
              </span>
            )}
{job.isRemote && !job.location?.includes('Remote') && (
  <span className="flex items-center gap-1 text-emerald-300">
    <Globe className="h-3.5 w-3.5" />
    Remote
  </span>
)}
          </div>

          {/* ✅ snippet */}
          {typeof job.snippet === 'string' && job.snippet.trim() && (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {job.snippet.trim()}
            </p>
          )}

          {Array.isArray(job.skills) && job.skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {job.skills.slice(0, 4).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {job.skills.length > 4 && (
                <Badge variant="secondary" className="text-xs text-muted-foreground">
                  +{job.skills.length - 4}
                </Badge>
              )}
            </div>
          )}
        </CardContent>

        <Separator />

        <CardFooter className="flex flex-wrap items-center justify-between gap-3 pt-3">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            Apply now on company site
            <span className="text-muted-foreground/60">•</span>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Posted {formatRelativeTime(job.postedAt)}
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
