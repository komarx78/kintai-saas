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
const badProps = ['commuting_daily_amount', 'commuting_type', 'has_spouse', 'special_allowance'];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('employee_payroll_profiles')) {
    for (const p of badProps) {
      if (content.includes(p)) {
        console.log(`File [${f}] contains employee_payroll_profiles AND prop [${p}]`);
      }
    }
  }
}
