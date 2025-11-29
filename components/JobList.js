// app/components/JobList.js

import Link from "next/link"

/**
 * Small helper – format salary nicely from DB job
 */
function formatSalary(job) {
  if (job.salaryRaw && job.salaryRaw.trim()) return job.salaryRaw

  if (typeof job.salaryMin === "number" && typeof job.salaryMax === "number") {
    const cur = job.salaryCurrency || ""
    const period = job.salaryPeriod === "year" ? " / year" : job.salaryPeriod ? ` / ${job.salaryPeriod}` : ""
    return `${cur} ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}${period}`.trim()
  }

  if (typeof job.salaryMin === "number") {
    const cur = job.salaryCurrency || ""
    const period = job.salaryPeriod === "year" ? " / year" : job.salaryPeriod ? ` / ${job.salaryPeriod}` : ""
    return `${cur} ${job.salaryMin.toLocaleString()}+${period}`.trim()
  }

  return "100k+ (local currency)"
}

function formatLocation(job) {
  if (job.locationRaw && job.locationRaw.trim()) return job.locationRaw

  const bits = []
  if (job.city) bits.push(job.city)
  if (job.countryCode) bits.push(job.countryCode)
  if (job.remote && bits.length === 0) return "Remote"
  if (job.remote && bits.length > 0) return bits.join(", ") + " · Remote"

  return bits.length ? bits.join(", ") : "Remote / Flexible"
}

function formatPosted(job) {
  if (!job.postedAt) return "Recently"
  try {
    const d = new Date(job.postedAt)
    if (Number.isNaN(d.getTime())) return "Recently"
    return d.toLocaleDateString()
  } catch {
    return "Recently"
  }
}

function companyInitial(job) {
  if (job.company && job.company.trim()) return job.company.trim()[0].toUpperCase()
  return "?"
}

/* ------------------------------------------------------------------ */
/* JobList – shared across country / city / role / slice pages        */
/* ------------------------------------------------------------------ */

export default function JobList({ jobs }) {
  if (!jobs || jobs.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "72px 20px",
          color: "#9ca3af",
        }}
      >
        <div style={{ fontSize: 46, marginBottom: 8 }}>🧐</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#e5e7eb" }}>
          No jobs found
        </div>
        <p style={{ marginTop: 4, fontSize: 14 }}>
          Try another country, city, or role.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* RemoteRocketship-style row card                                    */
/* ------------------------------------------------------------------ */

function JobRow({ job }) {
  const salary = formatSalary(job)
  const location = formatLocation(job)
  const posted = formatPosted(job)
  const initial = companyInitial(job)
  const is100kLocal = job.isHundredKLocal

  // prefer /job/[id] detail page
  const detailHref = `/job/${job.id}`

  return (
    <article
      style={{
        borderRadius: 16,
        padding: "14px 16px",
        background:
          "linear-gradient(90deg, rgba(15,23,42,0.98), rgba(15,23,42,0.98))",
        border: "1px solid rgba(31,41,55,1)",
        boxShadow: "0 10px 26px rgba(15,23,42,0.8)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 2.3fr) minmax(0, 1.8fr) minmax(0, 1fr)",
        gap: 16,
        alignItems: "center",
      }}
    >
      {/* Left: logo + title + company + short description */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          minWidth: 0,
        }}
      >
        {job.companyLogo ? (
          <img
            src={job.companyLogo}
            alt={job.company}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              objectFit: "cover",
              border: "1px solid rgba(30,64,175,0.7)",
              backgroundColor: "#020617",
              flexShrink: 0,
            }}
            onError={(e) => {
              e.target.style.display = "none"
            }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background:
                "radial-gradient(circle at top, rgba(30,64,175,0.8), rgba(15,23,42,1))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 700,
              color: "#e5e7eb",
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "#9ca3af",
              marginBottom: 2,
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
            }}
          >
            {job.company || "Company"}
          </div>

          <Link
            href={detailHref}
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#f9fafb",
              lineHeight: 1.3,
              marginBottom: 4,
              display: "inline-block",
              textDecoration: "none",
            }}
          >
            {job.title}
          </Link>

          {job.description && (
            <div
              style={{
                fontSize: 12,
                color: "#9ca3af",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}
            >
              {job.description}
            </div>
          )}
        </div>
      </div>

      {/* Middle: meta + skills */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontSize: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <MetaChip icon="💰" value={salary} highlight />
          <MetaChip icon="📍" value={location} />
          <MetaChip icon="⌚" value={job.type || "Full-time"} />
          {job.source && <MetaChip icon="📡" value={job.source} />}
          {is100kLocal && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                background: "rgba(22,163,74,0.16)",
                color: "#4ade80",
                border: "1px solid rgba(34,197,94,0.5)",
              }}
            >
              100k+ local verified
            </span>
          )}
        </div>

        {Array.isArray(job.skills) && job.skills.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {job.skills.slice(0, 4).map((skill, i) => (
              <span
                key={i}
                style={{
                  padding: "3px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  background: "rgba(30,64,175,0.9)",
                  color: "#c7d2fe",
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: posted + CTA */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "#9ca3af",
          }}
        >
          {posted}
        </div>

        <Link
          href={detailHref}
          style={{
            padding: "8px 18px",
            borderRadius: 999,
            border: "none",
            background:
              "linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #ec4899 100%)",
            color: "#f9fafb",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          View details →
        </Link>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Small subcomponent                                                 */
/* ------------------------------------------------------------------ */

function MetaChip({ icon, value, highlight }) {
  if (!value) return null
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 11,
        background: highlight
          ? "rgba(22,163,74,0.1)"
          : "rgba(15,23,42,0.9)",
        border: highlight
          ? "1px solid rgba(34,197,94,0.5)"
          : "1px solid rgba(31,41,55,1)",
        color: highlight ? "#4ade80" : "#e5e7eb",
      }}
    >
      <span>{icon}</span>
      <span>{value}</span>
    </div>
  )
}
