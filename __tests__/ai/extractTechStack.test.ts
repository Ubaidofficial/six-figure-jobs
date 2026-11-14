import { extractTechStackFromText } from '../../lib/ai/extractTechStack'

const names = (text: string) => extractTechStackFromText(text).display

describe('extractTechStackFromText: ambiguous words', () => {
  it('does not read plain English as technology', () => {
    expect(names('We go the extra mile. Let us go beyond. Time to go live.')).toEqual([])
    expect(names('You will express ideas clearly and react to feedback. Spring 2027 internship.')).toEqual([])
    expect(names('Remove rust from the pipes, then ruby-red paint; swift delivery matters.')).toEqual([])
    expect(names('Payments with American Express, and a node in the graph.')).toEqual([])
    expect(names('Our elastic scheduling and rails of the pipeline.')).toEqual([])
  })

  it('reads the real technologies in a stack list', () => {
    const out = names('Stack: Python, Go, Rust, Ruby, Swift, React, Node.js, Express, Rails, Spring Boot, Elasticsearch.')
    expect(out).toEqual(expect.arrayContaining(['Python', 'Go', 'Rust', 'Ruby', 'Swift', 'React', 'Node.js', 'Express', 'Rails', 'Spring', 'Elasticsearch']))
  })

  it('reads Go in the ways engineers write it', () => {
    expect(names('Experience in Go or Python')).toContain('Go')
    expect(names('We build services with Go and Kubernetes')).toContain('Go')
    expect(names('Golang backend engineer')).toContain('Go')
    expect(names('Skills: Java, Go, SQL')).toContain('Go')
    expect(names('Go programming language')).toContain('Go')
  })

  it('keeps lowercase file-style names that are unambiguous', () => {
    expect(names('built on reactjs and node.js with express.js')).toEqual(expect.arrayContaining(['React', 'Node.js', 'Express']))
    expect(names('typescript, python, docker and kubernetes')).toEqual(expect.arrayContaining(['TypeScript', 'Python', 'Docker', 'Kubernetes']))
  })
})
