#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const ROOT_FILES = [path.join(ROOT, 'tailwind.config.cjs')];
const ALLOWED_RAW_COLOR_FILES = new Set([
  path.normalize(path.join(SRC_DIR, 'lib', 'styles', 'tokens.css')).toLowerCase(),
  path.normalize(path.join(ROOT, 'tailwind.config.cjs')).toLowerCase(),
]);

const EXCLUDED_BASENAMES = new Set(['vite.config.ts', 'svelte.config.js']);

const colorChecks = [];

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const lower = fullPath.toLowerCase();

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.svelte-kit' || entry.name === '.git') {
        continue;
      }

      walk(fullPath);
      continue;
    }

    if (!/\.(svelte|ts|js|css)$/i.test(entry.name)) {
      continue;
    }

    if (EXCLUDED_BASENAMES.has(entry.name)) {
      continue;
    }

    const isAllowed = ALLOWED_RAW_COLOR_FILES.has(lower);
    if (isAllowed) {
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);

    const colorFunctions = /\b(?:rgba?|hsla?)\s*\((.*?)\)/g;
    const hexColors = /(^|[^a-zA-Z0-9_#-])#([0-9a-fA-F]{3,8})\b/g;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const lineText = lines[lineIndex];
      const lineNum = lineIndex + 1;

      let match;
      colorFunctions.lastIndex = 0;
      while ((match = colorFunctions.exec(lineText)) !== null) {
        const args = match[1] || '';
        if (!/var\(/.test(args)) {
          colorChecks.push({
            file: fullPath,
            line: lineNum,
            column: match.index + 1,
            text: match[0],
            reason: 'raw color function',
          });
        }
      }

      hexColors.lastIndex = 0;
      while ((match = hexColors.exec(lineText)) !== null) {
        const candidate = match[2] || '';
        colorChecks.push({
          file: fullPath,
          line: lineNum,
          column: match.index + (match[1]?.length || 0) + 1,
          text: `#${candidate}`,
          reason: 'raw hex color',
        });
      }
    }
  }
}

walk(SRC_DIR);
for (const file of ROOT_FILES) {
  const lower = file.toLowerCase();
  if (!fs.existsSync(file) || ALLOWED_RAW_COLOR_FILES.has(lower)) {
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const colorFunctions = /\b(?:rgba?|hsla?)\s*\((.*?)\)/g;
  const hexColors = /(^|[^a-zA-Z0-9_#-])#([0-9a-fA-F]{3,8})\b/g;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineText = lines[lineIndex];
    const lineNum = lineIndex + 1;

    let match;
    colorFunctions.lastIndex = 0;
    while ((match = colorFunctions.exec(lineText)) !== null) {
      const args = match[1] || '';
      if (!/var\(/.test(args)) {
        colorChecks.push({
          file,
          line: lineNum,
          column: match.index + 1,
          text: match[0],
          reason: 'raw color function',
        });
      }
    }

    hexColors.lastIndex = 0;
    while ((match = hexColors.exec(lineText)) !== null) {
      const candidate = match[2] || '';
      colorChecks.push({
        file,
        line: lineNum,
        column: match.index + (match[1]?.length || 0) + 1,
        text: `#${candidate}`,
        reason: 'raw hex color',
      });
    }
  }
}

if (colorChecks.length > 0) {
  for (const item of colorChecks) {
    console.log(`✖ ${item.file}:${item.line}:${item.column} ${item.reason}: ${item.text}`);
  }

  console.log(`\nDetected ${colorChecks.length} color literal violation(s).`);
  process.exit(1);
}

console.log('✓ No raw color literals found in scanned source files.');
