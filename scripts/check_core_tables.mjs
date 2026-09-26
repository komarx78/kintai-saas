process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://phhrulzeaomqsvrregpc.supabase.co';
const supabaseAnonKey = 'sb_publishable_8_P6N71OloWQOjDU8vQcCw_HG4Yl71Y';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test common columns for attendance_records, leave_requests, users, advanced_shifts
const checks = [
  {
    table: 'attendance_records',
    cols: ['id', 'tenant_id', 'user_id', 'date', 'check_in_time', 'check_out_time', 'break_minutes', 'overtime_minutes', 'late_minutes', 'early_leave_minutes', 'is_late', 'is_early_leave', 'note', 'status', 'created_at', 'updated_at']
  },
  {
    table: 'leave_requests',
    cols: ['id', 'tenant_id', 'user_id', 'type', 'start_date', 'end_date', 'reason', 'status', 'approver_id', 'approved_at', 'rejection_reason', 'created_at', 'updated_at']
  },
  {
    table: 'users',
    cols: ['id', 'tenant_id', 'name', 'name_kana', 'email', 'role', 'department', 'store_name', 'position_name', 'position_id', 'phone', 'postal_code', 'address', 'address_kana', 'birth_date', 'join_date', 'employment_type', 'weekly_working_days', 'paid_leave_balance', 'paid_leave_carryover', 'has_kintai_access', 'has_shift_access', 'approver_id', 'created_at', 'updated_at']
  },
  {
    table: 'advanced_shifts',
    cols: ['id', 'tenant_id', 'user_id', 'target_date', 'date', 'start_time', 'end_time', 'break_minutes', 'store_name', 'role', 'status', 'created_at', 'updated_at']
  }
];

async function run() {
  console.log('Checking core tables columns...');
  for (const c of checks) {
    console.log(`\nTable: ${c.table}`);
    for (const col of c.cols) {
      const { error } = await supabase.from(c.table).select(col).limit(0);
      if (error) {
        console.error(`  ❌ MISSING: [${c.table}].[${col}] - ${error.message}`);
      } else {
        // OK
      }
    }
    console.log(`  Table ${c.table} check completed.`);
  }
}

run();
