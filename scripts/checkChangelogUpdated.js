const { execSync } = require('child_process');

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

try {
  // Compare against main/develop if available; fallback to HEAD~1 for local runs
  let base = 'origin/develop';
  try { sh(`git rev-parse --verify ${base}`); } catch { base = 'HEAD~1'; }

  const changed = sh(`git diff --name-only ${base}...HEAD`);
  if (!changed) process.exit(0);

  const files = changed.split('\n').filter(Boolean);

  const codeTouched = files.some(f =>
    f.startsWith('app/') ||
    f.startsWith('lib/') ||
    f.startsWith('scripts/') ||
    f.startsWith('prisma/') ||
    f.startsWith('components/') ||
    f === 'middleware.ts' ||
    f === 'next.config.js' ||
    f === 'package.json'
  );

  if (!codeTouched) process.exit(0);

  const changelogTouched = files.includes('CHANGELOG.md') || files.includes('CHANGELOG.generated.md');

  if (!changelogTouched) {
    console.error('\n❌ Code changed but CHANGELOG not updated.');
    console.error('Update CHANGELOG.md OR run: npm run changelog:generate\n');
    process.exit(1);
  }

  process.exit(0);
} catch (e) {
  console.error('checkChangelogUpdated failed:', e.message);
  process.exit(1);
}
