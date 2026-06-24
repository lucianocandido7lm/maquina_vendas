
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const srcDir = 'src';
const allFiles = [];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) {
      allFiles.push(fullPath);
    }
  }
}

walk(srcDir);

console.log('--- Dead Code Audit ---');
const candidates = [];

for (const file of allFiles) {
  const relPath = path.relative('.', file);
  const baseName = path.basename(file, path.extname(file));
  
  if (baseName === 'main' || baseName === 'index' || baseName === 'App' || baseName === 'api') continue;

  // Search for the filename (without extension) or the full relative path in other files
  // We use grep to find if anyone imports this file.
  // Note: this is a heuristic.
  const searchPattern = baseName;
  try {
    const cmd = `grep -r "${searchPattern}" src | grep -v "${relPath}" | wc -l`;
    const count = parseInt(execSync(cmd).toString().trim(), 10);

    if (count === 0) {
      candidates.push(relPath);
      console.log(`[CANDIDATE] ${relPath} - No references found.`);
    }
  } catch (e) {
    // Ignore errors
  }
}

console.log(`\nTotal files analyzed: ${allFiles.length}`);
console.log(`Total candidates for removal: ${candidates.length}`);
