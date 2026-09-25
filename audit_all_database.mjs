import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://phhrulzeaomqsvrregpc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8_P6N71OloWQOjDU8vQcCw_HG4Yl71Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('================================================================');
console.log('🏛️ 【司馬懿・全域実DB精密監査】全テーブル・カラム・永続化総合診断');
console.log('================================================================');
console.log(`📡 接続先 URL: ${SUPABASE_URL}\n`);

async function runAudit() {
  const auditResults = [];

  async function checkTable(tableName, selectQuery, description, requiredColumns = []) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select(selectQuery, { count: 'exact' })
        .limit(3);

      if (error) {
        auditResults.push({
          table: tableName,
          status: 'ERROR',
          count: 0,
          description,
          detail: error.message,
          missingCols: []
        });
        return;
      }

      // カラムチェック
      const sample = data && data[0] ? data[0] : null;
      const missingCols = [];
      if (sample && requiredColumns.length > 0) {
        requiredColumns.forEach(col => {
          if (sample[col] === undefined) {
            missingCols.push(col);
          }
        });
      }

      auditResults.push({
        table: tableName,
        status: missingCols.length > 0 ? 'WARN' : 'OK',
        count: count !== null ? count : (data ? data.length : 0),
        description,
        detail: sample ? 'データ取得成功' : 'テーブル存在（レコード0件）',
        sampleKeys: sample ? Object.keys(sample) : [],
        missingCols
      });
    } catch (err) {
      auditResults.push({
        table: tableName,
        status: 'EXCEPTION',
        count: 0,
        description,
        detail: err.message,
        missingCols: []
      });
    }
  }

  // 1. 会社・テナント
  await checkTable('tenants', 'id, name, address, representative_name, labor_contract_template_data, position_settings, work_calendar_settings, shakai_hoken_settings', '会社基本情報・契約書・役職設定', ['name', 'address', 'labor_contract_template_data']);

  // 2. 社員台帳
  await checkTable('users', 'id, email, name, role, tenant_id, department, store_name, position_id', '全社ユーザー基本情報', ['name', 'tenant_id']);
  await checkTable('employee_onboarding_profiles', 'id, user_id, tenant_id, full_name, health_standard_monthly_remuneration, resident_tax_monthly', '入退社労務・公的情報マスタ', ['user_id', 'tenant_id']);
  await checkTable('employee_payroll_profiles', 'id, user_id, tenant_id, base_salary, salary_type', '給与計算プロファイルマスタ', ['base_salary', 'salary_type']);

  // 3. 勤怠打刻・月次締め
  await checkTable('attendance_records', 'id, tenant_id, user_id, date, clock_in, clock_out', '勤怠タイムカード日別打刻', ['date']);
  await checkTable('attendance_monthly_closings', 'id, tenant_id, year_month, status, closed_at', '勤怠月次締めロックテーブル', ['year_month', 'status']);

  // 4. シフト管理
  await checkTable('advanced_shifts', 'id, tenant_id, user_id, date, start_time, end_time', '新シフト確定レコード', ['date']);
  await checkTable('advanced_shift_requirements', 'id, tenant_id, store_name, day_of_week, role, required_count', '店舗別シフト必要枠マスタ', ['day_of_week', 'role', 'required_count']);
  await checkTable('shift_roles', 'id, tenant_id, name, display_order', 'シフト職種・役割マスタ', ['name']);

  // 5. 給与明細
  await checkTable('payslips', 'id, tenant_id, user_id, year_month, payment_date, total_earnings, total_deductions, net_salary, status', '月次給与明細データ', ['year_month', 'status', 'net_salary']);

  // 6. 公的帳票印字座標マスタ
  await checkTable('system_settings', 'id, health_pension_acquisition_doc_coordinates, health_pension_loss_doc_coordinates, employment_acquisition_doc_coordinates, employment_loss_doc_coordinates, spouse_doc_coordinates, bonus_doc_coordinates', '公的帳票原本印字座標（全6種）', ['health_pension_acquisition_doc_coordinates', 'bonus_doc_coordinates']);

  // 7. 組織・マスタ
  await checkTable('department_masters', 'id, tenant_id, name, display_order', '部署マスタ', ['name']);
  await checkTable('store_masters', 'id, tenant_id, name, address', '店舗・拠点マスタ', ['name']);
  await checkTable('company_qualification_masters', 'id, tenant_id, name, default_allowance', '全社資格手当マスタ', ['name']);

  // 総合レポート出力
  auditResults.forEach((res, idx) => {
    const icon = res.status === 'OK' ? '✅' : res.status === 'WARN' ? '⚠️' : '❌';
    console.log(`[${idx + 1}] ${icon} 【${res.table}】（${res.description}）`);
    console.log(`     状態: ${res.status} | 件数: ${res.count}件 | 詳細: ${res.detail}`);
    if (res.missingCols && res.missingCols.length > 0) {
      console.log(`     ⚠️ 未検出カラム: ${res.missingCols.join(', ')}`);
    }
    if (res.sampleKeys && res.sampleKeys.length > 0) {
      console.log(`     🔑 取得可能カラム: ${res.sampleKeys.join(', ')}`);
    }
    console.log('');
  });

  console.log('================================================================');
  console.log('🎖️ 司馬懿の総合診断結果:');
  const errorCount = auditResults.filter(r => r.status === 'ERROR' || r.status === 'EXCEPTION').length;
  const warnCount = auditResults.filter(r => r.status === 'WARN').length;
  const okCount = auditResults.filter(r => r.status === 'OK').length;
  console.log(`   全検査テーブル数: ${auditResults.length} / 正常: ${okCount} / 警告: ${warnCount} / エラー: ${errorCount}`);
  if (errorCount === 0) {
    console.log('   🎉 全テーブルのアクセスと主要カラムの存在が確認されました！');
  } else {
    console.log('   ⚠️ 一部のテーブルまたはカラムでエラーが発生しています。マイグレーションの実行が必要です。');
  }
  console.log('================================================================');
}

runAudit();
