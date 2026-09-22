import { supabase } from './supabase';
import { format, addDays, startOfWeek } from 'date-fns';

export interface SeedResult {
  success: boolean;
  message: string;
  storeCounts: Record<string, number>;
  totalShiftStaff: number;
  requirementsCount: number;
  requestsCount: number;
}

/**
 * 🎲 クラウドシフト管理システム 検証用ダミーデータ自動投入
 * - 全スタッフを「新宿店」「渋谷店」「池袋店」にバランスよくダミー配属
 * - 各店舗の平日・土日・祝日の必要時間帯＆必要人数枠（要件）を自動配備
 * - 今週〜来週分のスタッフシフト希望データを自動生成（AI自動作成の即時検証用）
 */
export async function seedShiftDemoData(tenantId: string): Promise<SeedResult> {
  const STORES = ['新宿店', '渋谷店', '池袋店'];
  const HQ_DEPTS = ['総務部', '総務・管理部', '管理部', '人事部', '経理部', '財務部', '営業部', '企画部', '役員'];

  // 1. 全ユーザーの取得（store_nameカラム未定義環境でも確実に取得する二段階フォールバック）
  let allUsers: any[] = [];
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, department, store_name, employment_type')
      .eq('tenant_id', tenantId);
    if (error) throw error;
    allUsers = data || [];
  } catch (firstErr) {
    console.warn('First fetch with store_name failed, trying fallback without store_name:', firstErr);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, department, employment_type')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      allUsers = data || [];
    } catch (secondErr: any) {
      console.error('Fetch users fallback error:', secondErr);
      throw new Error(`ユーザー情報の取得に失敗しました: ${secondErr?.message || secondErr}`);
    }
  }

  if (allUsers.length === 0) {
    throw new Error('ユーザーが登録されていません。');
  }

  // 2. 本部専属スタッフ（代表取締役・営業部・総務部など）を分離し、現場シフト対象スタッフを抽出
  const hqStaff = allUsers.filter(u => {
    if (u.role === 'admin' && (!u.department || u.department === '役員')) return true;
    if (u.department && (HQ_DEPTS.includes(u.department) || u.department.includes('営業') || u.department.includes('総務'))) {
      // 過去に店舗が明示的に設定されていない場合は本部扱い
      if (!u.store_name) return true;
    }
    return false;
  });

  const shiftCandidates = allUsers.filter(u => !hqStaff.some(h => h.id === u.id));
  const candidateList = shiftCandidates.length > 0 ? shiftCandidates : allUsers;

  // 3. 各店舗へのダミー振り分け（新宿店: 35%, 渋谷店: 35%, 池袋店: 30%）
  const storeCounts: Record<string, number> = { '新宿店': 0, '渋谷店': 0, '池袋店': 0 };
  const userPositionsKey = `user_positions_${tenantId}`;
  let currentPosMap: Record<string, any> = {};
  try {
    currentPosMap = JSON.parse(localStorage.getItem(userPositionsKey) || '{}');
  } catch {}

  const updatedStaffInfo: { id: string; store: string; role: string; hourlyWage: number }[] = [];

  for (let i = 0; i < candidateList.length; i++) {
    const staff = candidateList[i];
    const storeIndex = i % STORES.length;
    const targetStore = STORES[storeIndex];
    storeCounts[targetStore] = (storeCounts[targetStore] || 0) + 1;

    // 役割のローテーション配分（ホール多め、キッチン、レジ、清掃）
    const roleIndex = i % 10;
    let assignedRole = 'ホール';
    if (roleIndex === 0 || roleIndex === 4 || roleIndex === 7) assignedRole = 'キッチン';
    else if (roleIndex === 2 || roleIndex === 5 || roleIndex === 8) assignedRole = 'レジ';
    else if (roleIndex === 9) assignedRole = '清掃';
    else assignedRole = 'ホール';

    const hourlyWage = assignedRole === 'キッチン' ? 1250 : assignedRole === 'レジ' ? 1150 : assignedRole === '清掃' ? 1200 : 1100;

    updatedStaffInfo.push({
      id: staff.id,
      store: targetStore,
      role: assignedRole,
      hourlyWage
    });

    // キャッシュ更新
    currentPosMap[staff.id] = {
      ...(currentPosMap[staff.id] || {}),
      department: '店舗運営部',
      store_name: targetStore
    };

    // DB更新（usersテーブル）
    try {
      await supabase.from('users').update({
        department: '店舗運営部',
        store_name: targetStore
      }).eq('id', staff.id);
    } catch {
      try {
        await supabase.from('users').update({
          department: '店舗運営部'
        }).eq('id', staff.id);
      } catch {}
    }

    // shift_employee_settings の配備
    try {
      await supabase.from('shift_employee_settings').upsert({
        tenant_id: tenantId,
        user_id: staff.id,
        hourly_wage: hourlyWage,
        default_role: assignedRole,
        roles: [assignedRole]
      });
    } catch (e) {
      console.warn('shift_employee_settings upsert error:', e);
    }
  }

  localStorage.setItem(userPositionsKey, JSON.stringify(currentPosMap));

  // 4. 各店舗の必要時間帯＆必要人数枠（Requirements）の自動生成
  const storeRequirementTemplates: Record<string, any> = {
    '新宿店': {
      '平日': [
        { id: 'shinjuku_w_h1', role: 'ホール', startHour: 9, endHour: 15, count: 2 },
        { id: 'shinjuku_w_h2', role: 'ホール', startHour: 11, endHour: 20, count: 3 },
        { id: 'shinjuku_w_h3', role: 'ホール', startHour: 17, endHour: 22, count: 2 },
        { id: 'shinjuku_w_k1', role: 'キッチン', startHour: 8, endHour: 16, count: 2 },
        { id: 'shinjuku_w_k2', role: 'キッチン', startHour: 12, endHour: 21, count: 2 },
        { id: 'shinjuku_w_r1', role: 'レジ', startHour: 10, endHour: 19, count: 2 },
        { id: 'shinjuku_w_c1', role: '清掃', startHour: 7, endHour: 10, count: 1 },
        { id: 'shinjuku_w_c2', role: '清掃', startHour: 19, endHour: 22, count: 1 }
      ],
      '土日': [
        { id: 'shinjuku_h_h1', role: 'ホール', startHour: 9, endHour: 22, count: 5 },
        { id: 'shinjuku_h_k1', role: 'キッチン', startHour: 8, endHour: 22, count: 4 },
        { id: 'shinjuku_h_r1', role: 'レジ', startHour: 9, endHour: 21, count: 3 },
        { id: 'shinjuku_h_c1', role: '清掃', startHour: 7, endHour: 11, count: 2 },
        { id: 'shinjuku_h_c2', role: '清掃', startHour: 18, endHour: 22, count: 2 }
      ],
      '祝日': [
        { id: 'shinjuku_hol_h1', role: 'ホール', startHour: 9, endHour: 22, count: 5 },
        { id: 'shinjuku_hol_k1', role: 'キッチン', startHour: 8, endHour: 22, count: 4 },
        { id: 'shinjuku_hol_r1', role: 'レジ', startHour: 9, endHour: 21, count: 3 }
      ]
    },
    '渋谷店': {
      '平日': [
        { id: 'shibuya_w_h1', role: 'ホール', startHour: 11, endHour: 23, count: 4 },
        { id: 'shibuya_w_k1', role: 'キッチン', startHour: 10, endHour: 23, count: 3 },
        { id: 'shibuya_w_r1', role: 'レジ', startHour: 12, endHour: 21, count: 2 },
        { id: 'shibuya_w_c1', role: '清掃', startHour: 8, endHour: 11, count: 1 }
      ],
      '土日': [
        { id: 'shibuya_h_h1', role: 'ホール', startHour: 10, endHour: 23, count: 6 },
        { id: 'shibuya_h_k1', role: 'キッチン', startHour: 9, endHour: 23, count: 5 },
        { id: 'shibuya_h_r1', role: 'レジ', startHour: 11, endHour: 22, count: 3 },
        { id: 'shibuya_h_c1', role: '清掃', startHour: 8, endHour: 12, count: 2 }
      ],
      '祝日': [
        { id: 'shibuya_hol_h1', role: 'ホール', startHour: 10, endHour: 23, count: 6 },
        { id: 'shibuya_hol_k1', role: 'キッチン', startHour: 9, endHour: 23, count: 5 }
      ]
    },
    '池袋店': {
      '平日': [
        { id: 'ikebukuro_w_h1', role: 'ホール', startHour: 9, endHour: 18, count: 2 },
        { id: 'ikebukuro_w_h2', role: 'ホール', startHour: 12, endHour: 21, count: 2 },
        { id: 'ikebukuro_w_k1', role: 'キッチン', startHour: 9, endHour: 20, count: 2 },
        { id: 'ikebukuro_w_r1', role: 'レジ', startHour: 10, endHour: 19, count: 2 },
        { id: 'ikebukuro_w_c1', role: '清掃', startHour: 8, endHour: 11, count: 1 }
      ],
      '土日': [
        { id: 'ikebukuro_h_h1', role: 'ホール', startHour: 9, endHour: 21, count: 4 },
        { id: 'ikebukuro_h_k1', role: 'キッチン', startHour: 8, endHour: 21, count: 3 },
        { id: 'ikebukuro_h_r1', role: 'レジ', startHour: 9, endHour: 20, count: 2 }
      ],
      '祝日': [
        { id: 'ikebukuro_hol_h1', role: 'ホール', startHour: 9, endHour: 21, count: 4 },
        { id: 'ikebukuro_hol_k1', role: 'キッチン', startHour: 8, endHour: 21, count: 3 }
      ]
    }
  };

  let totalRequirementsCount = 0;
  const dbReqInserts: any[] = [];

  for (const storeName of STORES) {
    const template = storeRequirementTemplates[storeName];
    // 店舗別キャッシュへの保存
    localStorage.setItem(`shift_reqs_${tenantId}_${storeName}`, JSON.stringify(template));

    // DB用レコードの作成
    const weekdays = template['平日'] || [];
    const weekends = template['土日'] || [];
    const holidays = template['祝日'] || [];

    totalRequirementsCount += weekdays.length + weekends.length + holidays.length;

    weekdays.forEach((r: any) => {
      [1, 2, 3, 4, 5].forEach(dow => {
        dbReqInserts.push({
          tenant_id: tenantId,
          day_of_week: dow,
          role: r.role,
          required_count: r.count,
          start_time: `${String(r.startHour).padStart(2, '0')}:00:00`,
          end_time: `${String(r.endHour).padStart(2, '0')}:00:00`
        });
      });
    });
    weekends.forEach((r: any) => {
      [0, 6].forEach(dow => {
        dbReqInserts.push({
          tenant_id: tenantId,
          day_of_week: dow,
          role: r.role,
          required_count: r.count,
          start_time: `${String(r.startHour).padStart(2, '0')}:00:00`,
          end_time: `${String(r.endHour).padStart(2, '0')}:00:00`
        });
      });
    });
    holidays.forEach((r: any) => {
      dbReqInserts.push({
        tenant_id: tenantId,
        day_of_week: 7,
        role: r.role,
        required_count: r.count,
        start_time: `${String(r.startHour).padStart(2, '0')}:00:00`,
        end_time: `${String(r.endHour).padStart(2, '0')}:00:00`
      });
    });
  }

  // 全社共通（all）用キャッシュにも新宿店ベースで保存
  localStorage.setItem(`shift_reqs_${tenantId}_all`, JSON.stringify(storeRequirementTemplates['新宿店']));

  // DBの要件データを安全に再投入
  try {
    await supabase.from('advanced_shift_requirements').delete().eq('tenant_id', tenantId).is('target_date', null);
    if (dbReqInserts.length > 0) {
      // 50件ずつバッチインサート
      for (let i = 0; i < dbReqInserts.length; i += 50) {
        await supabase.from('advanced_shift_requirements').insert(dbReqInserts.slice(i, i + 50));
      }
    }
  } catch (reqDbErr) {
    console.warn('advanced_shift_requirements DB insert note:', reqDbErr);
  }

  // 5. 今週〜来週分のシフト希望データ（advanced_shift_requests）の自動投入
  // これにより、画面上で「AI自動作成」を押した瞬間にシフトが美しく埋まります
  const today = new Date();
  const startDay = startOfWeek(today, { weekStartsOn: 1 }); // 今週月曜
  let totalRequestsCount = 0;
  const requestsToInsert: any[] = [];

  // 今週〜来週（14日間）の希望を生成
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const targetDateObj = addDays(startDay, dayOffset);
    const dateStr = format(targetDateObj, 'yyyy-MM-dd');
    const dayOfWeek = targetDateObj.getDay(); // 0:日, 1:月, ... 6:土

    // 各店舗のスタッフから出勤希望者をピックアップ
    for (const storeName of STORES) {
      const storeStaff = updatedStaffInfo.filter(s => s.store === storeName);
      storeStaff.forEach((st, idx) => {
        // スタッフごとに週3〜5日希望（インデックスと日付で擬似分散）
        const isAvailable = (idx + dayOffset) % 7 !== 0 && (idx * 2 + dayOffset) % 7 !== 3;
        if (!isAvailable) return;

        let startT = '09:00';
        let endT = '18:00';
        if (st.role === '清掃') {
          startT = idx % 2 === 0 ? '07:00' : '18:00';
          endT = idx % 2 === 0 ? '11:00' : '22:00';
        } else if (st.role === 'キッチン') {
          startT = idx % 2 === 0 ? '08:00' : '12:00';
          endT = idx % 2 === 0 ? '17:00' : '21:00';
        } else if (dayOfWeek === 0 || dayOfWeek === 6) {
          // 土日は通し・ロング希望
          startT = idx % 2 === 0 ? '09:00' : '12:00';
          endT = idx % 2 === 0 ? '18:00' : '21:00';
        }

        requestsToInsert.push({
          tenant_id: tenantId,
          user_id: st.id,
          target_date: dateStr,
          available_start_time: startT,
          available_end_time: endT,
          preferred_role: st.role,
          note: `${st.store} 出勤希望`
        });
        totalRequestsCount++;
      });
    }
  }

  try {
    const startStr = format(startDay, 'yyyy-MM-dd');
    const endStr = format(addDays(startDay, 14), 'yyyy-MM-dd');
    await supabase.from('advanced_shift_requests').delete()
      .eq('tenant_id', tenantId)
      .gte('target_date', startStr)
      .lte('target_date', endStr);

    if (requestsToInsert.length > 0) {
      for (let i = 0; i < requestsToInsert.length; i += 50) {
        await supabase.from('advanced_shift_requests').insert(requestsToInsert.slice(i, i + 50));
      }
    }
  } catch (rqErr) {
    console.warn('advanced_shift_requests insert note:', rqErr);
  }

  return {
    success: true,
    message: `スタッフ${candidateList.length}名を各店舗へ振り分け、必要人数枠およびシフト希望データを一括投入しました！`,
    storeCounts,
    totalShiftStaff: candidateList.length,
    requirementsCount: totalRequirementsCount,
    requestsCount: totalRequestsCount
  };
}
