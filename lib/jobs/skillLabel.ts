// Skills are stored as slugs ("corrective-action", "ci-cd", "aws"); readers should see "Corrective Action", "CI/CD", "AWS".
import { SKILL_TARGETS } from '../seo/pseoTargets'

const KNOWN = new Map(SKILL_TARGETS.map((s) => [s.slug, s.label]))

// Whole slugs whose hyphens or case a rule would get wrong.
const SPECIAL: Record<string, string> = {
  'ci-cd': 'CI/CD',
  cpp: 'C++',
  'go-to-market': 'Go-to-market',
  'pre-sales': 'Pre-sales',
  'iso-27001': 'ISO 27001',
  'event-driven-architecture': 'Event-driven Architecture',
  'cloud-native': 'Cloud-native',
  'full-stack': 'Full-stack',
  'real-time': 'Real-time',
  'open-source': 'Open Source',
  'infrastructure-as-code': 'Infrastructure as Code',
}

const ACRONYMS = new Set(
  (
    'ai api aws gcp sql nosql cad cam erp crm sap iam itar mcp gdpr ccpa pmp gpu cpu iot nist etl elt cissp cism css dns ' +
    'html hipaa itil sdlc ecs cli pcb hris abap pcie dhcp fpga cmmc aks seo hpc rdbms oop nlp ccnp llm plm osha saas ' +
    'ui ux qa sre hr ml bi kpi okr sla sdk ide rpa rf tcp ip vpn sso mfa ssh ehr emr sox pci soc xml json yaml http rest ' +
    'jwt cdn ar vr gis scada plc hvac cnc cfd fea pmo ppc sem b2b b2c'
  ).split(' '),
)

const BRANDS: Record<string, string> = {
  ios: 'iOS',
  oauth: 'OAuth',
  grpc: 'gRPC',
  dbt: 'dbt',
  devops: 'DevOps',
  mlops: 'MLOps',
  github: 'GitHub',
  gitlab: 'GitLab',
  labview: 'LabVIEW',
  autocad: 'AutoCAD',
  microstation: 'MicroStation',
  tensorflow: 'TensorFlow',
  pytorch: 'PyTorch',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with'])

/** A skill as a reader should see it. Text that already has capitals, spaces or symbols is left as written. */
export function skillLabel(value: string): string {
  const v = String(value ?? '').trim()
  if (!v || /[A-Z\s.+#/]/.test(v)) return v
  if (SPECIAL[v]) return SPECIAL[v]
  if (KNOWN.has(v)) return KNOWN.get(v) as string
  return v
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w, i) => {
      if (ACRONYMS.has(w)) return w.toUpperCase()
      if (BRANDS[w]) return BRANDS[w]
      if (i > 0 && SMALL_WORDS.has(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}
