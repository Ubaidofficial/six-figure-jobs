'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function JobCard({ job }) {
  const router = useRouter()
  const [logoError, setLogoError] = useState(false)

  const handleViewJob = () => {
    // Save job to localStorage
    localStorage.setItem(`job-${job.id}`, JSON.stringify(job))
    // Navigate to job detail page
    router.push(`/job/${job.id}`)
  }

  // Better logo URL with multiple fallbacks
  const getLogoUrl = () => {
    if (logoError) {
      // Return a generic company icon
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&size=128&background=3b82f6&color=fff&bold=true`
    }
    
    // Try RemoteOK logo first if available
    if (job.companyLogo && job.companyLogo.includes('remoteok')) {
      return job.companyLogo
    }
    
    // Try Clearbit
    const cleanCompanyName = (job.company || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '')
      .replace(/inc|llc|ltd|corp|corporation|company/g, '')
    
    return `https://logo.clearbit.com/${cleanCompanyName}.com`
  }

  return (
    <div className="job-card">
      <div className="job-header">
        <div style={{display: 'flex', gap: '16px', alignItems: 'start', flex: 1}}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'white',
            padding: '8px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            <img 
              src={getLogoUrl()} 
              alt={job.company}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
              onError={(e) => { 
                setLogoError(true)
              }}
            />
          </div>
          <div>
            <h3 className="job-title">{job.title}</h3>
            <p className="job-company">{job.company}</p>
          </div>
        </div>
        <span className="job-salary">{job.salary}</span>
      </div>

      <div className="job-meta">
        <span>📍 {job.location}</span>
        <span>💼 {job.type}</span>
        <span>📅 {job.postedDate}</span>
      </div>

      {job.tags && job.tags.length > 0 && (
        <div className="job-tags">
          {job.tags.slice(0, 5).map((tag, idx) => (
            <span key={idx} className="job-tag">{tag}</span>
          ))}
        </div>
      )}

      {job.description && (
        <p style={{color: '#94a3b8', fontSize: '14px', marginBottom: '16px', lineHeight: '1.6'}}>
          {job.description.slice(0, 150)}{job.description.length > 150 ? '...' : ''}
        </p>
      )}

      <div className="job-footer">
        <span className="job-source">Source: {job.source}</span>
        <div style={{display: 'flex', gap: '12px'}}>
          <button 
            onClick={handleViewJob}
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            View Details
          </button>
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="job-apply">
            Apply Now →
          </a>
        </div>
      </div>
    </div>
  )
}