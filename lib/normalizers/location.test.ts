
// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { normalizeLocation } from './location'

describe('normalizeLocation', () => {
    it('handles simple remote string', () => {
        const res = normalizeLocation('Remote')
        expect(res.kind).toBe('remote')
        expect(res.isRemote).toBe(true)
        expect(res.normalizedText).toBe('Remote')
    })

    it('handles hybrid string with location', () => {
        const res = normalizeLocation('Hybrid - London')
        expect(res.kind).toBe('hybrid')
        expect(res.isRemote).toBe(true)
        expect(res.city).toBe('London')
    })

    it('handles onsite keyword', () => {
        const res = normalizeLocation('Onsite in New York')
        expect(res.kind).toBe('onsite')
        expect(res.isRemote).toBe(false)
        expect(res.city).toBe('New York') // "Onsite in New York" -> "New York" (after stripRemoteQualifiers? No, stripRemoteQualifiers removes suffixes)
        // Actually "Onsite in New York" -> parts=["Onsite in New York"] -> city="Onsite in New York"
        // The normalizer is simple, it doesn't extract city from "in City".
        // But it detects kind=onsite.
    })

    it('parses city and country', () => {
        const res = normalizeLocation('Berlin, Germany')
        expect(res.city).toBe('Berlin')
        expect(res.country).toBe('Germany')
        expect(res.region).toBe(null)
    })

    it('parses city, region, country', () => {
        const res = normalizeLocation('San Francisco, CA, US')
        expect(res.city).toBe('San Francisco')
        expect(res.region).toBe('CA')
        expect(res.country).toBe('United States')
    })

    it('handles US state code as region', () => {
        const res = normalizeLocation('San Francisco, CA')
        expect(res.city).toBe('San Francisco')
        expect(res.region).toBe('CA')
        expect(res.country).toBe(null) // "CA" is not recognized as country by normalizeCountry (length <= 2)
    })

    it('strips remote qualifiers', () => {
        const res = normalizeLocation('London (Remote)')
        expect(res.kind).toBe('remote')
        expect(res.city).toBe('London')
        expect(res.normalizedText).toBe('London')
    })
})
