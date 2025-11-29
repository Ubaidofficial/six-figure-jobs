export default function FilterBar() {
  return (
    <div className="filters">
      <div className="filter-row">
        <input type="text" placeholder="Search jobs, companies..." />
        <select>
          <option>All Locations</option>
          <option>Remote</option>
          <option>Hybrid</option>
        </select>
        <select>
          <option>All Types</option>
          <option>Full-time</option>
          <option>Part-time</option>
        </select>
        <select>
          <option>Min: $100k</option>
          <option>Min: $150k</option>
        </select>
      </div>
    </div>
  )
}