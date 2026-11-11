import { RevealWords } from './RevealWords'

/**
 * Section heading in the 2026-11 style (workflows.io reference): an optional pill label above, then one line that
 * starts light and ends semibold ("Latest **Six Figure Opportunities**"), revealed word by word as it scrolls in.
 * The heading text is `${light} ${strong}`.
 */
export function SectionHeading({
  id,
  eyebrow,
  light,
  strong,
  className,
}: {
  id?: string
  eyebrow?: string
  light?: string
  strong: string
  className?: string
}) {
  return (
    <>
      {eyebrow ? <p className="eyebrow-pill section-eyebrow">{eyebrow}</p> : null}
      <h2 id={id} className={className ? `section-heading ${className}` : 'section-heading'} data-reveal="" data-reveal-stagger="">
        {light ? (
          <>
            <RevealWords text={light} className="font-light" />{' '}
          </>
        ) : null}
        <RevealWords text={strong} />
      </h2>
    </>
  )
}
