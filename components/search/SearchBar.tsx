import { Search } from 'lucide-react'

import { HeroSearchInput } from '@/components/home/HeroSearchInput'
import { Button } from '@/components/ui/button'

import styles from './SearchBar.module.css'

/**
 * The big search bar (homepage hero, /jobs and /remote heroes): live role and job suggestions as you type
 * (HeroSearchInput), a "/" shortcut, and example searches typed into the empty box. Place it inside a GET form; the
 * form's other fields (filters, a hidden remoteMode) narrow both the suggestions and the submitted search.
 */
export function SearchBar({
  id,
  label = 'Search six-figure jobs',
  defaultValue,
  typingExamples = true,
}: {
  id: string
  label?: string
  /** The current search, so a results page opens with it in the box. */
  defaultValue?: string
  typingExamples?: boolean
}) {
  return (
    <div className={styles.bar}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Search className={styles.icon} aria-hidden="true" />
      <HeroSearchInput
        id={id}
        name="q"
        placeholder="Job title, company or keyword"
        className={styles.input}
        defaultValue={defaultValue}
        shortcut
        shortcutHint
        typingExamples={typingExamples}
      />
      <Button variant="primary" size="lg" type="submit" className={styles.cta}>
        Search jobs<span aria-hidden="true" className="ml-2">&rarr;</span>
      </Button>
    </div>
  )
}
