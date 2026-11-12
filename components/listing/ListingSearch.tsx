import { SearchBar } from '@/components/search/SearchBar'

/**
 * The big live search for a listing page's header: suggestions as you type, submits to `action` with `hidden` fields
 * (e.g. remoteMode=remote on /remote, so both the suggestions and the results stay remote).
 */
export function ListingSearch({
  action,
  defaultValue,
  hidden,
}: {
  action: string
  defaultValue?: string
  hidden?: Record<string, string>
}) {
  return (
    <form role="search" method="GET" action={action}>
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SearchBar id="listing-q" defaultValue={defaultValue} typingExamples={!defaultValue} />
    </form>
  )
}
