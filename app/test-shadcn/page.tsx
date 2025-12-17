import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { JobCardV2 } from '@/components/jobs/JobCardV2'
import { JobCardSkeleton } from '@/components/jobs/JobCardSkeleton'
import { SearchInput } from '@/components/search/SearchInput'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function TestShadcnPage() {
  const mockJob = {
    id: 'test-job',
    title: 'Senior Software Engineer',
    company: {
      name: 'Stripe',
      logo: 'https://img.logo.dev/stripe.com',
    },
    location: 'San Francisco, CA',
    isRemote: true,
    salaryMin: 180000,
    salaryMax: 250000,
  currency: "USD",
    skills: ['React', 'TypeScript', 'Node.js', 'AWS'],
    postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="mb-2 text-4xl font-bold">shadcn/ui Test Page</h1>
          <p className="text-muted-foreground">
            Testing Six Figure Jobs components with shadcn/ui
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Basic Components</CardTitle>
            <CardDescription>Button, Badge, Input testing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button>Primary Button</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                $200k+
              </Badge>
            </div>

            <SearchInput placeholder="Test search..." />
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-4 text-2xl font-bold">Job Cards</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <JobCardV2 job={mockJob} />
            <JobCardV2 job={mockJob} featured />
            <JobCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}
