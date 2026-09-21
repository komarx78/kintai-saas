import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://phhrulzeaomqsvrregpc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8_P6N71OloWQOjDU8vQcCw_HG4Yl71Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkData() {
  try {
    // 1. テナント確認
    const { data: tenants, error: tErr } = await supabase.from('tenants').select('id, name');
    console.log('--- Tenants ---');
    console.log(tenants, tErr);

    if (tenants && tenants.length > 0) {
      const tenant = tenants.find(t => t.name && t.name.includes('KAP')) || tenants[0];
      const tenantId = tenant.id;
      console.log('Selected Tenant:', tenant);

      // 2. スタッフ一覧
      const { data: users, error: uErr } = await supabase.from('users').select('id, name, email, role').eq('tenant_id', tenantId);
      console.log('--- Users (Staff) ---');
      console.log(users, uErr);

      // 3. 役割マスタ
      const { data: roles } = await supabase.from('shift_roles').select('*').eq('tenant_id', tenantId);
      console.log('--- Shift Roles ---');
      console.log(roles);

      // 4. 必要枠設定
      const { data: reqs } = await supabase.from('advanced_shift_requirements').select('*').eq('tenant_id', tenantId);
      console.log('--- Shift Requirements ---');
      console.log(reqs);

      // 5. 現在の希望シフト
      const { data: requests } = await supabase.from('advanced_shift_requests').select('*').eq('tenant_id', tenantId).gte('target_date', '2026-09-21').lte('target_date', '2026-09-27');
      console.log('--- Shift Requests (This Week) ---');
      console.log(requests);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

checkData();
