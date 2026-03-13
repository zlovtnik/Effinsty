import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const CLIENT_DIR = '.svelte-kit/output/client';
const JS_BUDGET_BYTES = 25 * 1024;
const TOTAL_JS_BUDGET_BYTES = 90 * 1024;
const TOTAL_CSS_BUDGET_BYTES = 15 * 1024;

function collectFiles(rootDir, extensions, results = []) {
  for (const entry of readdirSync(rootDir)) {
    const fullPath = join(rootDir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      collectFiles(fullPath, extensions, results);
      continue;
    }

    if (extensions.some((extension) => fullPath.endsWith(extension))) {
      results.push(fullPath);
    }
  }

  return results;
}

function gzipSize(filePath) {
  const source = readFileSync(filePath);
  return gzipSync(source).length;
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(2)} KB`;
}

function writeSummary(lines) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return;
  }

  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

const jsFiles = collectFiles(CLIENT_DIR, ['.js']);
const cssFiles = collectFiles(CLIENT_DIR, ['.css']);

const jsSizes = jsFiles.map((filePath) => ({
  filePath,
  gzipBytes: gzipSize(filePath),
}));
const cssSizes = cssFiles.map((filePath) => ({
  filePath,
  gzipBytes: gzipSize(filePath),
}));

const largestJsChunk = jsSizes.reduce(
  (largest, next) => (next.gzipBytes > largest.gzipBytes ? next : largest),
  { filePath: 'n/a', gzipBytes: 0 }
);
const totalJsBytes = jsSizes.reduce((sum, item) => sum + item.gzipBytes, 0);
const totalCssBytes = cssSizes.reduce((sum, item) => sum + item.gzipBytes, 0);

const summaryLines = [
  '## Frontend Bundle Budgets',
  '',
  `- Largest client JS chunk: ${formatBytes(largestJsChunk.gzipBytes)} (${largestJsChunk.filePath})`,
  `- Total client JS: ${formatBytes(totalJsBytes)}`,
  `- Total client CSS: ${formatBytes(totalCssBytes)}`,
];

writeSummary(summaryLines);
console.log(summaryLines.join('\n'));

const failures = [];

if (largestJsChunk.gzipBytes > JS_BUDGET_BYTES) {
  failures.push(
    `Largest JS chunk exceeded budget: ${formatBytes(largestJsChunk.gzipBytes)} > ${formatBytes(JS_BUDGET_BYTES)}`
  );
}

if (totalJsBytes > TOTAL_JS_BUDGET_BYTES) {
  failures.push(
    `Total JS exceeded budget: ${formatBytes(totalJsBytes)} > ${formatBytes(TOTAL_JS_BUDGET_BYTES)}`
  );
}

if (totalCssBytes > TOTAL_CSS_BUDGET_BYTES) {
  failures.push(
    `Total CSS exceeded budget: ${formatBytes(totalCssBytes)} > ${formatBytes(TOTAL_CSS_BUDGET_BYTES)}`
  );
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
