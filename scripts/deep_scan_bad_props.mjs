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

// Test whether any write payload contains the bad keys
const badKeysByTable = {
  users: ['updated_at', 'status', 'is_retired', 'is_active', 'contact_line_id', 'resident_tax_monthly', 'resident_tax_details'],
  leave_requests: ['approved_at', 'rejection_reason', 'updated_at'],
  attendance_records: ['overtime_minutes', 'late_minutes', 'early_leave_minutes', 'is_late', 'is_early_leave'],
  advanced_shifts: ['break_minutes'],
  employee_maternity_leaves: ['childcare_extended', 'attachment_mynumber_url', 'attachment_mynumber_filename'],
  salary_revision_history: ['user_name', 'department'],
  tenants: ['square_checkout_url', 'billing_settings'],
  payroll_settings: ['employment_insurance_business_type', 'employment_insurance_employer_rate', 'target_month']
};

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');

  for (const [table, badKeys] of Object.entries(badKeysByTable)) {
    if (!content.includes(`'${table}'`) && !content.includes(`"${table}"`)) continue;

    // Split file by lines or function blocks, check proximity
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(`from('${table}')`) || line.includes(`from("${table}")`)) {
        // Look before and after 40 lines
        const start = Math.max(0, i - 40);
        const end = Math.min(lines.length - 1, i + 40);
        const snippet = lines.slice(start, end).join('\n');

        for (const bad of badKeys) {
          // Check if snippet defines or uses badKey as property
          const propRegex = new RegExp(`\\b${bad}\\s*:`, 'g');
          if (propRegex.test(snippet)) {
            console.log(`⚠️ Possible issue in [${f}:${i + 1}]: Table [${table}] near bad property [${bad}]`);
          }
        }
      }
    }
  }
}
