#!/bin/bash

echo "════════════════════════════════════════════════════════════════"
echo "   SIX FIGURE JOBS - IMPLEMENTATION AUDIT v2.2"
echo "════════════════════════════════════════════════════════════════"
echo ""

PROJECT_ROOT="$(pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. DATABASE SCHEMA AUDIT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "prisma/schema.prisma" ]; then
    echo "✅ prisma/schema.prisma exists"
    echo ""
    echo "Required Job fields:"
    grep -q "minAnnual" prisma/schema.prisma && echo "  ✅ minAnnual" || echo "  ❌ minAnnual"
    grep -q "maxAnnual" prisma/schema.prisma && echo "  ✅ maxAnnual" || echo "  ❌ maxAnnual"
    grep -q "salaryCurrency" prisma/schema.prisma && echo "  ✅ salaryCurrency" || echo "  ❌ salaryCurrency"
    grep -q "isHundredKLocal" prisma/schema.prisma && echo "  ✅ isHundredKLocal" || echo "  ❌ isHundredKLocal (MISSING)"
    grep -q "isHighSalaryLocal" prisma/schema.prisma && echo "  ✅ isHighSalaryLocal" || echo "  ❌ isHighSalaryLocal (MISSING)"
    grep -q "benefitsJson" prisma/schema.prisma && echo "  ✅ benefitsJson" || echo "  ❌ benefitsJson (MISSING)"
else
    echo "❌ prisma/schema.prisma NOT FOUND"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. SEO FILES AUDIT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ -d "lib/seo" ] && echo "✅ lib/seo/ directory exists" || echo "❌ lib/seo/ directory MISSING"
[ -f "lib/seo/meta.ts" ] && echo "✅ lib/seo/meta.ts" || echo "❌ lib/seo/meta.ts MISSING"
[ -f "lib/seo/structuredData.ts" ] && echo "✅ lib/seo/structuredData.ts" || echo "❌ lib/seo/structuredData.ts MISSING"
[ -f "lib/seo/canonical.ts" ] && echo "✅ lib/seo/canonical.ts" || echo "❌ lib/seo/canonical.ts MISSING"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. ROLE SYNONYMS AUDIT (CRITICAL)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ -d "lib/roles" ] && echo "✅ lib/roles/ directory exists" || echo "❌ lib/roles/ directory MISSING"
[ -f "lib/roles/synonyms.ts" ] && echo "✅ lib/roles/synonyms.ts" || echo "❌ lib/roles/synonyms.ts MISSING - CRITICAL!"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. ATS SCRAPERS AUDIT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ -f "lib/scrapers/ats/ashby.ts" ] && echo "✅ lib/scrapers/ats/ashby.ts" || echo "❌ lib/scrapers/ats/ashby.ts MISSING"
[ -f "lib/scrapers/ats/greenhouse.ts" ] && echo "✅ lib/scrapers/ats/greenhouse.ts" || echo "❌ lib/scrapers/ats/greenhouse.ts MISSING"
[ -f "lib/scrapers/ats/lever.ts" ] && echo "✅ lib/scrapers/ats/lever.ts" || echo "❌ lib/scrapers/ats/lever.ts MISSING"

if [ -f "lib/scrapers/ats/ashby.ts" ]; then
    if grep -q "/ 100" lib/scrapers/ats/ashby.ts; then
        echo "  ✅ Ashby salary division by 100 present"
    else
        echo "  ❌ Ashby salary division MISSING - CRITICAL BUG!"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. COMPONENTS AUDIT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ -f "app/components/JobCard.tsx" ] && echo "✅ JobCard.tsx" || echo "❌ JobCard.tsx MISSING"
[ -f "app/components/RoleTypeahead.tsx" ] && echo "⚠️  RoleTypeahead.tsx (needs synonyms)" || echo "❌ RoleTypeahead.tsx MISSING"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. ROUTING AUDIT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ -f "app/page.tsx" ] && echo "✅ Homepage" || echo "❌ Homepage MISSING"
[ -d "app/jobs" ] && echo "✅ app/jobs/ directory" || echo "❌ app/jobs/ MISSING"
[ -f "app/job/[id]/page.tsx" ] && echo "✅ Job detail pages" || echo "❌ Job detail pages MISSING"
[ -d "app/salary" ] && echo "✅ Salary guides" || echo "⚠️  Salary guides MISSING (recommended)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "CRITICAL (Fix First):"
[ ! -f "lib/roles/synonyms.ts" ] && echo "  • Create lib/roles/synonyms.ts"
[ -f "lib/scrapers/ats/ashby.ts" ] && ! grep -q "/ 100" lib/scrapers/ats/ashby.ts && echo "  • Fix Ashby salary division"

echo ""
echo "HIGH PRIORITY:"
[ ! -f "lib/seo/structuredData.ts" ] && echo "  • Create SEO structured data"
! grep -q "isHundredKLocal" prisma/schema.prisma && echo "  • Add isHundredKLocal to schema"

echo ""
echo "════════════════════════════════════════════════════════════════"
