# SIX FIGURE JOBS - EMERGENCY ROLLBACK PLAN

## When to Use This Plan

Execute this plan if ANY of the following occur:
- 🚨 Google manual action appears in GSC
- 🚨 GSC coverage drops >10% in one day
- 🚨 GSC coverage drops >20% in one week
- 🚨 Massive de-indexing (>50% of pages removed)
- 🚨 Traffic drops >50% overnight

## Day 1: IMMEDIATE ACTIONS (Within 1 Hour)

### Stop Publishing
```bash
# Set PSEO_ENABLED=false immediately
echo "PSEO_ENABLED=false" >> .env.local

# Restart server to apply changes
pm2 restart 6figjobs
```

### Document Everything
1. Screenshot GSC manual action (if any)
2. Record coverage % before/after drop
3. Note which pages were published when
4. Export GSC data (Coverage report)
5. Check Google Analytics for traffic drop

### Alert Team
- Send Slack/email to stakeholders
- Include screenshots and data
- Explain situation clearly
- Set expectations for recovery time (3-6 months typical)

## Days 2-7: DAMAGE CONTROL

### Identify Thin Pages
```bash
# Find pages with <10 jobs
node scripts/find-thin-pages.ts --threshold=10 > thin-pages.txt

# Review the list
cat thin-pages.txt
```

### Add Noindex to Thin Pages
```bash
# Option A: Via middleware (recommended)
# Update middleware.ts to add noindex header for thin pages

# Option B: Via emergency script
node scripts/emergency-noindex.ts --threshold=10
```

### Remove from Sitemap
```bash
# Rebuild sitemap excluding thin pages
node scripts/rebuild-sitemap.ts --min-jobs=10

# Verify new sitemap
curl https://www.6figjobs.com/sitemap.xml | grep -c "<url>"
```

### Submit Reconsideration Request
1. Go to GSC → Security & Manual Actions → Request Review
2. Explain what happened:
   - "We published too many pages too quickly on a new domain"
   - "We've now implemented strict quality gates"
   - "All pages with <10 jobs are now noindexed"
3. List improvements made:
   - Quality gates (min jobs, content length, schemas)
   - Publishing limits (max X/day, Y/week)
   - Manual review process before publishing
4. Promise to maintain high standards going forward

## Weeks 2-4: WAIT & MONITOR

### Daily Monitoring
- Check GSC for response (typically 2-3 weeks)
- Monitor coverage (should stabilize or slowly improve)
- Do NOT publish any new pages
- Continue scraping to keep existing pages fresh

### Improve Quality
- Review all existing pages
- Add more content to thin pages
- Improve metadata quality
- Add more internal links
- Fix any broken links/images

### Document Changes
Keep log of all improvements:
```
Date       | Action                          | Pages Affected
-----------|----------------------------------|----------------
Dec 15     | Added noindex to <10 job pages  | 1,247
Dec 16     | Rebuilt sitemap                  | 15,346
Dec 17     | Improved metadata on top pages  | 50
Dec 18     | Added FAQ sections              | 100
```

## Week 5+: RESTART PUBLISHING (Only After Approval)

### Prerequisites
- ✅ Manual action resolved in GSC
- ✅ Coverage stabilized or improving
- ✅ No new penalties for 2+ weeks

### Ultra-Conservative Restart
```bash
# Set DOMAIN_AGE_WEEKS to current week
echo "DOMAIN_AGE_WEEKS=8" >> .env.local

# Enable publishing with STRICT limits
echo "PSEO_ENABLED=true" >> .env.local

# DOUBLE all quality minimums
echo "MIN_JOBS_PER_PAGE=20" >> .env.local  # Was 10
echo "MIN_CONTENT_LENGTH=400" >> .env.local  # Was 200
```

### Publishing Schedule After Recovery
- Week 1: 5 pages total (1/day)
- Week 2: 10 pages total (2/day)
- Week 3: 15 pages total (2-3/day)
- Week 4: 20 pages total (3/day)

### Monitor Closely
- Check GSC 2x per day
- Any drop >5% = STOP immediately
- Track every published page in spreadsheet
- Manual review before each publishing run

## Prevention for Future

### Quality Checklist
Before publishing ANY page:
- [ ] Has 20+ jobs minimum
- [ ] Has 400+ chars unique content
- [ ] Has all metadata (title, description, canonical)
- [ ] Has 3+ schemas (ItemList, Breadcrumb, FAQ)
- [ ] Has 5+ internal links
- [ ] Has been reviewed manually
- [ ] GSC coverage >80% before publishing more

### Publishing Limits
Never exceed these limits again:
- Max 3 pages/day on domains <6 months
- Max 20 pages/week on domains <6 months
- Max 50 pages/week on domains >6 months
- Always check GSC before publishing

## Emergency Contacts

- Google Search Console: https://search.google.com/search-console
- Team Lead: [Your Email]
- Database Backup Location: [Railway/Backup Service]
- Rollback Script Location: scripts/emergency-noindex.ts

## Recovery Timeline

Typical recovery times:
- Minor issue (small coverage drop): 2-4 weeks
- Manual action: 4-8 weeks
- Severe penalty: 3-6 months

Be patient. Google needs time to re-evaluate your site.
