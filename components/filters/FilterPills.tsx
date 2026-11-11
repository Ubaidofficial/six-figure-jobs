// components/filters/FilterPills.tsx
// A group of pill toggles built from native radio inputs, for GET forms (homepage search, /search): they submit with
// the form and work without JavaScript. The listing sidebar (app/jobs/_components/JobsFilters.tsx) draws the same pill.
import styles from './FilterPills.module.css'

export type FilterOption = { value: string; label: string }

export function FilterPills({
  legend,
  name,
  options,
  defaultValue,
}: {
  legend: string
  name: string
  options: FilterOption[]
  defaultValue: string
}) {
  return (
    <fieldset className={styles.pills}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.row}>
        {options.map((o) => (
          <label key={o.value || 'any'} className={styles.pill}>
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={o.value === defaultValue}
              className={styles.input}
            />
            <span className={styles.text}>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
