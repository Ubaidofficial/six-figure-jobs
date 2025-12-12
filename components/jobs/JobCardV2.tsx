'use client'

import Link from 'next/link'
import { MapPin, Globe, Clock, Bookmark } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

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
    salaryMin: number
    salaryMax: number | null
    skills: string[]
    postedAt: Date
  }
  featured?: boolean
}

export function JobCardV2({ job, featured = false }: JobCardV2Props) {
  const formatSalary = (min: number, max: number | null) => {
    const minK = Math.round(min / 1000)
    const maxK = max ? Math.round(max / 1000) : null
    return maxK ? `$${minK}k - $${maxK}k` : `$${minK}k+`
  }

  const isNew = Date.now() - new Date(job.postedAt).getTime() < 3 * 24 * 60 * 60 * 1000

  const formatRelativeTime = (date: Date): string => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return `${Math.floor(seconds / 604800)}w ago`
  }

  return (
    <Link href={`/job/${job.id}`} className="block group">
      <Card
        className={`h-full transition-all hover:shadow-lg ${
          featured
            ? 'border-primary/50 ring-1 ring-primary/10 hover:border-primary'
            : 'hover:border-primary/30'
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex gap-4">
            <Avatar className="h-14 w-14 rounded-xl">
              <AvatarImage src={job.company.logo || ''} alt={job.company.name} />
              <AvatarFallback className="rounded-xl bg-secondary">
                {job.company.name[0]}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                {job.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {job.company.name}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault()
              }}
              className="h-9 w-9 shrink-0"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.location}
              </span>
            )}
            {job.isRemote && (
              <>
                {job.location && <span>•</span>}
                <span className="flex items-center gap-1 text-primary">
                  <Globe className="h-3.5 w-3.5" />
                  Remote
                </span>
              </>
            )}
          </div>

          <Badge
            variant="outline"
            className="bg-primary/10 text-primary border-primary/20 font-mono text-base px-4 py-1.5"
          >
            💰 {formatSalary(job.salaryMin, job.salaryMax)}
          </Badge>

          {job.skills && job.skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {job.skills.slice(0, 4).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {job.skills.length > 4 && (
                <Badge
                  variant="secondary"
                  className="text-xs text-muted-foreground"
                >
                  +{job.skills.length - 4}
                </Badge>
              )}
            </div>
          )}
        </CardContent>

        <Separator />

        <CardFooter className="pt-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Posted {formatRelativeTime(job.postedAt)}
          </span>

          {isNew && (
            <Badge className="bg-primary/10 text-primary border-primary/20">
              NEW
            </Badge>
          )}

          {featured && !isNew && (
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
              ⭐ Featured
            </Badge>
          )}
        </CardFooter>
      </Card>
    </Link>
  )
}

