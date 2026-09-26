import fs from 'fs';
import path from 'path';

function getAllFiles(dir, exts) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) results = results.concat(getAllFiles(fullPath, exts));
    else if (exts.some(ext => file.endsWith(ext))) results.push(fullPath);
  }
  return results;
}

const files = getAllFiles('src', ['.ts', '.tsx']);

console.log('=== ALL DELETE OPERATIONS IN CODEBASE ===\n');

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('.delete()')) {
      // get surrounding context
      const snippet = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 4)).map(l => l.trim()).join(' ');
      console.log(`[${path.relative(process.cwd(), f)}:${i + 1}]`);
      console.log(`  ${snippet}\n`);
    }
  }
}
