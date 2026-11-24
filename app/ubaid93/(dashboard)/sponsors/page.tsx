// Admin: the sponsored placements above the job list on /jobs and on the home page (lib/sponsors/slots.ts).
import { prisma } from '../../../../lib/prisma'
import { buildSponsorSlots, SPONSOR_FIELDS, SPONSOR_KEY_PREFIX, SPONSOR_SLOT_COUNT } from '../../../../lib/sponsors/slots'
import { PageHead, s } from '../ui'
import SponsorSlotForm, { type SlotValues } from './SponsorSlotForm'
import { requireAdmin } from '../requireAdmin'

export const dynamic = 'force-dynamic'

export default async function SponsorsPage() {
  await requireAdmin()
  const rows = await prisma.siteConfig.findMany({ where: { key: { startsWith: SPONSOR_KEY_PREFIX } } })
  const config = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const live = new Map(buildSponsorSlots(config).map((slot) => [slot.id, slot]))

  const slots = Array.from({ length: SPONSOR_SLOT_COUNT }, (_, i) => {
    const id = i + 1
    const values = Object.fromEntries(SPONSOR_FIELDS.map((f) => [f, config[`${SPONSOR_KEY_PREFIX}${id}.${f}`] ?? ''])) as SlotValues
    const slot = live.get(id)
    return { id, values, liveHref: slot?.href ?? null }
  })

  return (
    <>
      <PageHead
        title="Sponsors"
        lede="Paid placements shown above the job list on /jobs and on the home page. A slot shows only while it has a name, an https link and a last day that has not passed, so a placement ends by itself. Changes reach the site within about 15 minutes (the slots and the pages that show them are cached)."
      />
      <div className={s.grid2}>
        {slots.map((slot) => (
          <SponsorSlotForm key={slot.id} id={slot.id} initial={slot.values} liveHref={slot.liveHref} />
        ))}
      </div>
    </>
  )
}
