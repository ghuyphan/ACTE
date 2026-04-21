#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const baselinePath = path.join(__dirname, 'theme-audit-baseline.json');
const targetDirs = ['app', 'components', 'hooks', 'services', 'constants'];
const excludedFiles = new Set([
  'hooks/useTheme.tsx',
  'constants/theme.ts',
  'constants/noteColors.ts',
]);
const colorLiteralPattern = /#[0-9A-Fa-f]{3,8}\b|(?:rgb|hsl)a?\([^\n)]*\)|['"](?:white|black)['"]/g;

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolutePath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function collectColorLiteralCounts() {
  const counts = {};

  for (const targetDir of targetDirs) {
    const absoluteDir = path.join(repoRoot, targetDir);
    if (!fs.existsSync(absoluteDir)) {
      continue;
    }

    for (const absolutePath of walk(absoluteDir)) {
      const relativePath = path.relative(repoRoot, absolutePath);
      if (excludedFiles.has(relativePath)) {
        continue;
      }

      const contents = fs.readFileSync(absolutePath, 'utf8');
      const matches = contents.match(colorLiteralPattern);
      if (!matches || matches.length === 0) {
        continue;
      }

      counts[relativePath] = matches.length;
    }
  }

  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
}

function loadBaseline() {
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

function formatSummary(currentCounts) {
  const fileCount = Object.keys(currentCounts).length;
  const totalMatches = Object.values(currentCounts).reduce((sum, count) => sum + count, 0);
  return `${totalMatches} raw color literals tracked across ${fileCount} files.`;
}

function main() {
  const currentCounts = collectColorLiteralCounts();

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(currentCounts, null, 2)}\n`);
    return;
  }

  const baselineCounts = loadBaseline();
  const violations = [];
  let improvedFiles = 0;

  for (const [relativePath, count] of Object.entries(currentCounts)) {
    const baselineCount = baselineCounts[relativePath];
    if (baselineCount === undefined) {
      violations.push(
        `${relativePath}: new file with ${count} raw color literal${count === 1 ? '' : 's'}`
      );
      continue;
    }

    if (count > baselineCount) {
      violations.push(
        `${relativePath}: ${count} raw color literals (baseline ${baselineCount})`
      );
      continue;
    }

    if (count < baselineCount) {
      improvedFiles += 1;
    }
  }

  for (const relativePath of Object.keys(baselineCounts)) {
    if (!(relativePath in currentCounts)) {
      improvedFiles += 1;
    }
  }

  if (violations.length > 0) {
    console.error('Theme audit failed.');
    console.error(formatSummary(currentCounts));
    console.error('');
    console.error('These files introduced new hardcoded-color debt relative to the baseline:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    console.error('');
    console.error(
      'If the new colors are intentional, move them into semantic theme tokens or a dedicated feature token module, then update scripts/theme-audit-baseline.json in the same change.'
    );
    process.exit(1);
  }

  console.log('Theme audit passed.');
  console.log(formatSummary(currentCounts));
  if (improvedFiles > 0) {
    console.log(`${improvedFiles} file(s) improved relative to the baseline.`);
  }
}

main();
