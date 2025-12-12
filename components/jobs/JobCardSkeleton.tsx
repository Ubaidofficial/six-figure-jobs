import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

export function JobCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex gap-4">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4 space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-32 rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-[4.5rem] rounded-md" />
        </div>
      </CardContent>

      <Separator />

      <CardFooter className="pt-3">
        <Skeleton className="h-4 w-28" />
      </CardFooter>
    </Card>
  )
}
