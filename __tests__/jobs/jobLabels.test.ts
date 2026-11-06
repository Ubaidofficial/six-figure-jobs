import { employmentTypeLabel } from '../../lib/jobs/employmentTypeLabel'
import { skillLabel } from '../../lib/jobs/skillLabel'

describe('employmentTypeLabel', () => {
  it.each([
    ['full_time', 'Full-time'],
    ['Full-time', 'Full-time'],
    ['FULL_TIME', 'Full-time'],
    ['fulltime', 'Full-time'],
    ['part_time', 'Part-time'],
    ['contract', 'Contract'],
    ['contractor', 'Contract'],
    ['internship', 'Internship'],
    ['temporary', 'Temporary'],
    ['fellowship', 'Fellowship'],
    ['per_diem', 'Per diem'],
    ['job_share', 'Job share'],
  ])('%s -> %s', (input, out) => expect(employmentTypeLabel(input)).toBe(out))

  it('is null for nothing', () => {
    expect(employmentTypeLabel(null)).toBeNull()
    expect(employmentTypeLabel('')).toBeNull()
    expect(employmentTypeLabel('  _ ')).toBeNull()
  })
})

describe('skillLabel', () => {
  it.each([
    ['corrective-action', 'Corrective Action'],
    ['design-for-manufacturing', 'Design for Manufacturing'],
    ['computer-vision', 'Computer Vision'],
    ['agentic-ai', 'Agentic AI'],
    ['ai', 'AI'],
    ['aws', 'AWS'],
    ['cad', 'CAD'],
    ['sql', 'SQL'],
    ['ci-cd', 'CI/CD'],
    ['cpp', 'C++'],
    ['iso-27001', 'ISO 27001'],
    ['root-cause-analysis', 'Root Cause Analysis'],
    ['infrastructure-as-code', 'Infrastructure as Code'],
    ['go-to-market', 'Go-to-market'],
    ['labview', 'LabVIEW'],
    ['linux', 'Linux'],
    ['python', 'Python'],
    ['node-js', 'Node.js'],
    ['machine-learning', 'Machine Learning'],
    ['azure-devops', 'Azure DevOps'],
    ['data_pipelines', 'Data Pipelines'],
  ])('%s -> %s', (input, out) => expect(skillLabel(input)).toBe(out))

  it('leaves text that is already written for people alone', () => {
    expect(skillLabel('TensorFlow')).toBe('TensorFlow')
    expect(skillLabel('Machine Learning')).toBe('Machine Learning')
    expect(skillLabel('C#')).toBe('C#')
    expect(skillLabel('Node.js')).toBe('Node.js')
  })

  it('handles empty values', () => {
    expect(skillLabel('')).toBe('')
    expect(skillLabel('  ')).toBe('')
  })
})
