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

console.log('=== CHECKING USAGE OF NON-EXISTENT COLUMNS ===\n');

// Targets:
// 1. users: updated_at
// 2. leave_requests: approved_at, rejection_reason, updated_at
// 3. attendance_records: overtime_minutes, late_minutes, early_leave_minutes, is_late, is_early_leave
// 4. advanced_shifts: break_minutes

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');

  // Check users with updated_at
  if (content.includes("from('users')") || content.includes('from("users")')) {
    // find statements around from('users')
    const matches = content.matchAll(/from\(['"]users['"]\)[^;]+;/g);
    for (const m of matches) {
      if (m[0].includes('updated_at')) {
        console.log(`🚨 File [${f}] has 'updated_at' in users query:\n${m[0].slice(0, 150)}...\n`);
      }
    }
  }

  // Check leave_requests
  if (content.includes("from('leave_requests')") || content.includes('from("leave_requests")')) {
    const matches = content.matchAll(/from\(['"]leave_requests['"]\)[^;]+;/g);
    for (const m of matches) {
      for (const bad of ['approved_at', 'rejection_reason', 'updated_at']) {
        if (m[0].includes(bad)) {
          console.log(`🚨 File [${f}] has '${bad}' in leave_requests query:\n${m[0].slice(0, 150)}...\n`);
        }
      }
    }
  }

  // Check attendance_records
  if (content.includes("from('attendance_records')") || content.includes('from("attendance_records")')) {
    const matches = content.matchAll(/from\(['"]attendance_records['"]\)[^;]+;/g);
    for (const m of matches) {
      for (const bad of ['overtime_minutes', 'late_minutes', 'early_leave_minutes', 'is_late', 'is_early_leave']) {
        if (m[0].includes(bad)) {
          console.log(`🚨 File [${f}] has '${bad}' in attendance_records query:\n${m[0].slice(0, 150)}...\n`);
        }
      }
    }
  }

  // Check advanced_shifts
  if (content.includes("from('advanced_shifts')") || content.includes('from("advanced_shifts")')) {
    const matches = content.matchAll(/from\(['"]advanced_shifts['"]\)[^;]+;/g);
    for (const m of matches) {
      if (m[0].includes('break_minutes')) {
        console.log(`🚨 File [${f}] has 'break_minutes' in advanced_shifts query:\n${m[0].slice(0, 150)}...\n`);
      }
    }
  }
}

console.log('Done scanning.');
