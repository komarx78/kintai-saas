process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://phhrulzeaomqsvrregpc.supabase.co';
const supabaseAnonKey = 'sb_publishable_8_P6N71OloWQOjDU8vQcCw_HG4Yl71Y';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const srcDir = path.resolve('src');

function getAllFiles(dir, exts) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else {
      if (exts.some(ext => file.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const files = getAllFiles(srcDir, ['.ts', '.tsx']);

// Collect all interface / type declarations
const interfaceProperties = new Map(); // InterfaceName -> Set of property names

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true
  );

  function visit(node) {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      const typeName = node.name.text;
      let members = [];
      if (ts.isInterfaceDeclaration(node)) {
        members = node.members;
      } else if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
        members = node.type.members;
      }

      if (members.length > 0) {
        if (!interfaceProperties.has(typeName)) interfaceProperties.set(typeName, new Set());
        for (const m of members) {
          if (m.name && ts.isIdentifier(m.name)) {
            interfaceProperties.get(typeName).add(m.name.text);
          } else if (m.name && ts.isStringLiteral(m.name)) {
            interfaceProperties.get(typeName).add(m.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

// Map interface names to DB tables
const interfaceToTable = [
  { types: ['User', 'Employee', 'StaffUser', 'AppUser'], table: 'users' },
  { types: ['EmployeePayrollProfile', 'PayrollProfile'], table: 'employee_payroll_profiles' },
  { types: ['EmployeeOnboardingProfile', 'OnboardingProfile', 'EmployeeProfile'], table: 'employee_onboarding_profiles' },
  { types: ['AttendanceRecord', 'AttendanceRow'], table: 'attendance_records' },
  { types: ['Shift', 'AdvancedShift', 'ShiftRecord'], table: 'advanced_shifts' },
  { types: ['ShiftEmployeeSetting', 'ShiftEmployeeSettings', 'ShiftStaffSetting'], table: 'shift_employee_settings' },
  { types: ['ShiftSetting', 'ShiftSettings'], table: 'shift_settings' },
  { types: ['LeaveRequest', 'LeaveApplication'], table: 'leave_requests' },
  { types: ['SalaryRevisionRecord', 'SalaryRevisionHistory'], table: 'salary_revision_history' },
  { types: ['EmployeeDocumentSubmission', 'DocumentSubmission'], table: 'employee_document_submissions' },
  { types: ['MaternityLeaveRecord', 'EmployeeMaternityLeave'], table: 'employee_maternity_leaves' },
  { types: ['Tenant', 'TenantInfo', 'CompanyInfo'], table: 'tenants' },
  { types: ['PayrollSettings', 'PayrollSetting'], table: 'payroll_settings' },
  { types: ['Payslip', 'PayslipRecord'], table: 'payslips' }
];

async function runTypeAudit() {
  console.log('=== TYPE DEFINITIONS VS REAL DB COLUMNS AUDIT ===\n');
  const discrepancies = [];

  for (const mapping of interfaceToTable) {
    const table = mapping.table;
    const combinedProps = new Set();
    for (const tName of mapping.types) {
      if (interfaceProperties.has(tName)) {
        for (const prop of interfaceProperties.get(tName)) {
          combinedProps.add(prop);
        }
      }
    }

    if (combinedProps.size === 0) continue;

    console.log(`\nAuditing Table [${table}] against Types [${mapping.types.join(', ')}] (${combinedProps.size} fields)...`);
    for (const prop of Array.from(combinedProps).sort()) {
      // test against real DB
      try {
        const { error } = await supabase.from(table).select(prop).limit(0);
        if (error) {
          if (error.code === '42703' || error.message.includes('does not exist')) {
            console.error(`  ⚠️ Interface field [${prop}] NOT in Table [${table}]`);
            discrepancies.push({ table, prop, types: mapping.types });
          }
        } else {
          // OK
        }
      } catch (e) {
        // console.error(e.message);
      }
    }
  }

  console.log('\n==============================================');
  console.log(`Audit finished. Found ${discrepancies.length} interface fields not in real DB.`);
  console.log('==============================================');

  fs.writeFileSync('scripts/type_db_discrepancies.json', JSON.stringify(discrepancies, null, 2));
  console.log('Saved to scripts/type_db_discrepancies.json');
}

runTypeAudit();
