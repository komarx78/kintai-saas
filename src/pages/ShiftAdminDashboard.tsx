import React, { useState, useEffect } from 'react';
import { DollarSign, Zap, Calendar, ArrowLeft, CheckCircle, Settings, Users, ClipboardList, Send, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays } from 'date-fns';
import AppSwitcher from '../components/AppSwitcher';

import { calculateLaborCost, generateAutoShift } from '../lib/shiftAlgorithm';

const ShiftAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tenantName, setTenantName] = useState<string>('');
  const [loadingStats, setLoadingStats] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [generationResult, setGenerationResult] = useState<{ added: number } | null>(null);

  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [submittedUserIds, setSubmittedUserIds] = useState<string[]>([]);
  
  const [estimatedLaborCost, setEstimatedLaborCost] = useState(0);
  const [requiredLaborCost, setRequiredLaborCost] = useState(0);

  const [shiftPeriod, setShiftPeriod] = useState<string>('1week');
  const [submissionDeadlineRule, setSubmissionDeadlineRule] = useState<string>('');
  const [isSubmissionLocked, setIsSubmissionLocked] = useState(false);
  const [autoLockDays, setAutoLockDays] = useState<string>('');
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [isSavingLock, setIsSavingLock] = useState(false);
  const [isSavingAutoLock, setIsSavingAutoLock] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // 1. シフトデータの完全リセット（初期化）
  const handleResetAllShiftData = async () => {
    if (!window.confirm('確定シフト・ドラフトシフト・希望シフトをすべて削除し、完全にリセットします。よろしいですか？')) return;
    setIsResetting(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) return;

      await supabase.from('advanced_shifts').delete().eq('tenant_id', tenantId);
      await supabase.from('advanced_shift_requests').delete().eq('tenant_id', tenantId);

      alert('🗑️ シフトデータ（確定・ドラフト・希望）を完全にクリアしました！');
      setGenerationResult(null);
      await fetchStats();
    } catch (err: any) {
      console.error('Reset error:', err);
      alert('リセットに失敗しました: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // 2. 画像に準拠した40名規模のデモデータ一括投入
  const handleSeedDummyData = async () => {
    if (!window.confirm('既存のシフト・希望をクリアし、画像準拠の【ホール1名・キッチン1名・レジ2名・清掃朝夜各1名】の必要枠および【40名スタッフ・リアルなシフト希望】を一括投入します。よろしいですか？')) return;
    setIsSeeding(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) {
        alert('テナントIDが取得できませんでした。');
        return;
      }

      // 既存シフト＆希望をクリア
      await supabase.from('advanced_shifts').delete().eq('tenant_id', tenantId);
      await supabase.from('advanced_shift_requests').delete().eq('tenant_id', tenantId);

      // 1. 役割（ロール）マスタ作成（画像準拠の4役割）
      const rolesToInsert = [
        { tenant_id: tenantId, name: 'ホール', color: '#4F46E5', display_order: 1 },
        { tenant_id: tenantId, name: 'キッチン', color: '#EA580C', display_order: 2 },
        { tenant_id: tenantId, name: 'レジ', color: '#8B5CF6', display_order: 3 },
        { tenant_id: tenantId, name: '清掃', color: '#06B6D4', display_order: 4 }
      ];
      await supabase.from('shift_roles').upsert(rolesToInsert, { onConflict: 'tenant_id,name' });

      // 2. 必要人数枠マスタ作成（平日＆土日すべて画像通りの枠）
      const reqsToInsert: any[] = [];
      [0, 1, 2, 3, 4, 5, 6].forEach(dow => {
        reqsToInsert.push({
          tenant_id: tenantId,
          day_of_week: dow,
          role: 'ホール',
          start_time: '09:00:00',
          end_time: '18:00:00',
          required_count: 1
        });
        reqsToInsert.push({
          tenant_id: tenantId,
          day_of_week: dow,
          role: 'キッチン',
          start_time: '09:00:00',
          end_time: '18:00:00',
          required_count: 1
        });
        reqsToInsert.push({
          tenant_id: tenantId,
          day_of_week: dow,
          role: 'レジ',
          start_time: '09:00:00',
          end_time: '18:00:00',
          required_count: 2
        });
        reqsToInsert.push({
          tenant_id: tenantId,
          day_of_week: dow,
          role: '清掃',
          start_time: '07:00:00',
          end_time: '10:00:00',
          required_count: 1
        });
        reqsToInsert.push({
          tenant_id: tenantId,
          day_of_week: dow,
          role: '清掃',
          start_time: '19:00:00',
          end_time: '22:00:00',
          required_count: 1
        });
      });

      await supabase.from('advanced_shift_requirements').delete().eq('tenant_id', tenantId).is('target_date', null);
      await supabase.from('advanced_shift_requirements').insert(reqsToInsert);

      // 3. 40名スタッフの定義（小刻みなリアル希望時間帯：午前/昼/午後/フル/早朝/夜間）
      const dummyStaffs = [
        // ホール担当 (12名)
        { name: '佐藤 裕美', roleName: 'ホール', dept: 'ホール運営部', wage: 1200, priority: 5, maxH: 25, startT: '09:00:00', endT: '14:00:00', days: [1, 2, 3, 4, 5] },
        { name: '田中 健太', roleName: 'ホール', dept: 'ホール運営部', wage: 1150, priority: 4, maxH: 25, startT: '13:00:00', endT: '18:00:00', days: [2, 3, 4, 5, 6] },
        { name: '高橋 優香', roleName: 'ホール', dept: 'ホール運営部', wage: 1150, priority: 4, maxH: 25, startT: '10:00:00', endT: '15:00:00', days: [0, 1, 4, 5, 6] },
        { name: '渡辺 直樹', roleName: 'ホール', dept: 'ホール運営部', wage: 1250, priority: 5, maxH: 40, startT: '09:00:00', endT: '18:00:00', days: [0, 1, 2, 3, 6] },
        { name: '伊藤 結衣', roleName: 'ホール', dept: 'ホール運営部', wage: 1100, priority: 3, maxH: 15, startT: '14:00:00', endT: '18:00:00', days: [1, 3, 5] },
        { name: '山本 拓也', roleName: 'ホール', dept: 'ホール運営部', wage: 1150, priority: 3, maxH: 15, startT: '09:00:00', endT: '13:00:00', days: [2, 4, 6] },
        { name: '中村 美咲', roleName: 'ホール', dept: 'ホール運営部', wage: 1150, priority: 4, maxH: 24, startT: '10:00:00', endT: '16:00:00', days: [0, 2, 3, 5] },
        { name: '小林 翔平', roleName: 'ホール', dept: 'ホール運営部', wage: 1200, priority: 4, maxH: 24, startT: '12:00:00', endT: '18:00:00', days: [1, 2, 4, 6] },
        { name: '加藤 綾乃', roleName: 'ホール', dept: 'ホール運営部', wage: 1100, priority: 3, maxH: 15, startT: '13:00:00', endT: '18:00:00', days: [0, 3, 5] },
        { name: '吉田 大地', roleName: 'ホール', dept: 'ホール運営部', wage: 1150, priority: 3, maxH: 20, startT: '09:00:00', endT: '14:00:00', days: [1, 4, 6] },
        { name: '山田 浩二', roleName: 'ホール', dept: 'ホール運営部', wage: 1200, priority: 4, maxH: 20, startT: '14:00:00', endT: '18:00:00', days: [0, 2, 5] },
        { name: '佐々木 葵', roleName: 'ホール', dept: 'ホール運営部', wage: 1150, priority: 3, maxH: 16, startT: '11:00:00', endT: '15:00:00', days: [1, 3, 6] },

        // キッチン担当 (10名)
        { name: '鈴木 一郎', roleName: 'キッチン', dept: '調理厨房部', wage: 1350, priority: 5, maxH: 40, startT: '09:00:00', endT: '18:00:00', days: [1, 2, 3, 4, 5] },
        { name: '斉藤 健二', roleName: 'キッチン', dept: '調理厨房部', wage: 1300, priority: 5, maxH: 40, startT: '09:00:00', endT: '18:00:00', days: [0, 1, 2, 3, 6] },
        { name: '松本 恭子', roleName: 'キッチン', dept: '調理厨房部', wage: 1250, priority: 4, maxH: 25, startT: '09:00:00', endT: '14:00:00', days: [2, 3, 4, 5, 6] },
        { name: '井上 蓮', roleName: 'キッチン', dept: '調理厨房部', wage: 1200, priority: 3, maxH: 20, startT: '13:00:00', endT: '18:00:00', days: [0, 2, 4, 6] },
        { name: '木村 友美', roleName: 'キッチン', dept: '調理厨房部', wage: 1250, priority: 4, maxH: 20, startT: '10:00:00', endT: '15:00:00', days: [1, 3, 5] },
        { name: '林 龍平', roleName: 'キッチン', dept: '調理厨房部', wage: 1300, priority: 4, maxH: 35, startT: '09:00:00', endT: '18:00:00', days: [0, 1, 4, 5] },
        { name: '清水 麻美', roleName: 'キッチン', dept: '調理厨房部', wage: 1200, priority: 3, maxH: 16, startT: '14:00:00', endT: '18:00:00', days: [2, 3, 6] },
        { name: '山口 慎太郎', roleName: 'キッチン', dept: '調理厨房部', wage: 1250, priority: 4, maxH: 24, startT: '11:00:00', endT: '17:00:00', days: [1, 4, 6] },
        { name: '池田 美優', roleName: 'キッチン', dept: '調理厨房部', wage: 1200, priority: 3, maxH: 16, startT: '09:00:00', endT: '13:00:00', days: [0, 3, 5] },
        { name: '橋本 陽介', roleName: 'キッチン', dept: '調理厨房部', wage: 1300, priority: 4, maxH: 24, startT: '12:00:00', endT: '18:00:00', days: [2, 5, 6] },

        // レジ担当 (12名)
        { name: '山崎 栞', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1150, priority: 5, maxH: 25, startT: '09:00:00', endT: '14:00:00', days: [1, 2, 3, 4, 5] },
        { name: '森 淳', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1200, priority: 5, maxH: 25, startT: '13:00:00', endT: '18:00:00', days: [0, 1, 2, 3, 6] },
        { name: '阿部 さくら', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1150, priority: 4, maxH: 25, startT: '09:00:00', endT: '14:00:00', days: [2, 3, 4, 5, 6] },
        { name: '石川 雅人', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1100, priority: 3, maxH: 20, startT: '14:00:00', endT: '18:00:00', days: [0, 1, 4, 5] },
        { name: '前田 菜月', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1150, priority: 4, maxH: 20, startT: '10:00:00', endT: '15:00:00', days: [1, 3, 5, 6] },
        { name: '藤田 涼太', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1100, priority: 3, maxH: 15, startT: '13:00:00', endT: '18:00:00', days: [0, 2, 4] },
        { name: '後藤 萌', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1150, priority: 4, maxH: 16, startT: '09:00:00', endT: '13:00:00', days: [1, 2, 5, 6] },
        { name: '岡田 雄介', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1150, priority: 3, maxH: 16, startT: '14:00:00', endT: '18:00:00', days: [0, 3, 4] },
        { name: '長谷川 凛', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1100, priority: 3, maxH: 20, startT: '09:00:00', endT: '14:00:00', days: [2, 4, 6] },
        { name: '村上 和也', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1200, priority: 4, maxH: 25, startT: '13:00:00', endT: '18:00:00', days: [1, 3, 5] },
        { name: '近藤 恵', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1150, priority: 4, maxH: 35, startT: '09:00:00', endT: '18:00:00', days: [0, 2, 5, 6] },
        { name: '石井 達也', roleName: 'レジ', dept: 'フロント・レジ部', wage: 1100, priority: 3, maxH: 35, startT: '09:00:00', endT: '18:00:00', days: [1, 4, 6] },

        // 清掃担当 (6名)
        { name: '遠藤 勝', roleName: '清掃', dept: '環境整備・清掃部', wage: 1150, priority: 5, maxH: 15, startT: '07:00:00', endT: '10:00:00', days: [1, 2, 3, 4, 5] },
        { name: '青木 テル', roleName: '清掃', dept: '環境整備・清掃部', wage: 1100, priority: 4, maxH: 15, startT: '07:00:00', endT: '10:00:00', days: [0, 2, 4, 6] },
        { name: '坂本 昭夫', roleName: '清掃', dept: '環境整備・清掃部', wage: 1150, priority: 5, maxH: 15, startT: '07:00:00', endT: '10:00:00', days: [0, 1, 3, 5, 6] },
        { name: '斉藤 清', roleName: '清掃', dept: '環境整備・清掃部', wage: 1100, priority: 4, maxH: 15, startT: '19:00:00', endT: '22:00:00', days: [1, 2, 3, 4, 5] },
        { name: '福田 トメ', roleName: '清掃', dept: '環境整備・清掃部', wage: 1080, priority: 3, maxH: 15, startT: '19:00:00', endT: '22:00:00', days: [0, 2, 4, 6] },
        { name: '西村 重三', roleName: '清掃', dept: '環境整備・清掃部', wage: 1100, priority: 4, maxH: 15, startT: '19:00:00', endT: '22:00:00', days: [0, 1, 3, 5, 6] }
      ];

      const createdUserList: { id: string; name: string; roleName: string; startT: string; endT: string; days: number[] }[] = [];

      for (let idx = 0; idx < dummyStaffs.length; idx++) {
        const staff = dummyStaffs[idx];
        const email = `staff${(idx + 1).toString().padStart(2, '0')}.${tenantId.substring(0, 4)}@example.com`;

        const { data: existUser } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', staff.name)
          .maybeSingle();

        let uid = existUser?.id;
        if (!uid) {
          const generatedUid = crypto.randomUUID();
          const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert({
              id: generatedUid,
              tenant_id: tenantId,
              name: staff.name,
              email: email,
              role: 'user',
              department: staff.dept,
              employment_type: staff.wage >= 1300 ? 'full-time' : 'part-time',
              join_date: '2024-04-01',
              has_shift_access: true
            })
            .select('id')
            .single();
          if (userError) {
            console.error('User insert error:', userError);
            throw userError;
          }
          uid = newUser?.id || generatedUid;
        } else {
          await supabase.from('users').update({ 
            has_shift_access: true,
            department: staff.dept,
            employment_type: staff.wage >= 1300 ? 'full-time' : 'part-time',
            join_date: '2024-04-01'
          }).eq('id', uid);
        }

        if (uid) {
          createdUserList.push({
            id: uid,
            name: staff.name,
            roleName: staff.roleName,
            startT: staff.startT,
            endT: staff.endT,
            days: staff.days
          });

          // 大元労務台帳詳細プロファイルへの登録 (employee_onboarding_profiles)
          try {
            const { data: existProfile } = await supabase
              .from('employee_onboarding_profiles')
              .select('id')
              .eq('user_id', uid)
              .maybeSingle();

            const profilePayload = {
              user_id: uid,
              tenant_id: tenantId,
              employment_status: 'active',
              salary_type: staff.wage >= 1300 ? 'monthly' : 'hourly',
              base_salary: staff.wage >= 1300 ? 250000 : 0,
              hourly_wage: staff.wage,
              birth_date: '1996-05-15',
              phone_number: `090-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
              address: '東京都港区芝公園1-1-1',
              updated_at: new Date().toISOString()
            };

            if (existProfile) {
              await supabase.from('employee_onboarding_profiles').update(profilePayload).eq('id', existProfile.id);
            } else {
              await supabase.from('employee_onboarding_profiles').insert(profilePayload);
            }
          } catch (profileErr) {
            console.warn('employee_onboarding_profiles save skipped:', profileErr);
          }

          // シフト要員設定への連動 (shift_employee_settings)
          try {
            const { data: existSetting } = await supabase
              .from('shift_employee_settings')
              .select('id')
              .eq('user_id', uid)
              .maybeSingle();

            const settingPayload = {
              tenant_id: tenantId,
              user_id: uid,
              hire_date: '2024-04-01',
              max_hours_per_week: staff.maxH,
              priority_score: staff.priority,
              default_role: staff.roleName,
              base_wage: staff.wage,
              updated_at: new Date().toISOString()
            };

            if (existSetting) {
              await supabase.from('shift_employee_settings').update(settingPayload).eq('id', existSetting.id);
            } else {
              await supabase.from('shift_employee_settings').insert(settingPayload);
            }
          } catch (settingErr) {
            console.warn('shift_employee_settings save fallback:', settingErr);
          }
        }
      }

      // 4. 今週＋翌週（14日間：月〜日×2）の小刻みシフト希望を一括生成
      const requestsToInsert: any[] = [];

      for (let i = 0; i < 14; i++) {
        const d = addDays(weekStart, i);
        const dStr = format(d, 'yyyy-MM-dd');
        const dow = d.getDay(); // 0:日, 1:月, ... 6:土

        createdUserList.forEach((staff) => {
          if (staff.days.includes(dow)) {
            requestsToInsert.push({
              tenant_id: tenantId,
              user_id: staff.id,
              target_date: dStr,
              available_start_time: staff.startT,
              available_end_time: staff.endT,
              preferred_role: staff.roleName,
              status: 'submitted'
            });
          }
        });
      }

      if (requestsToInsert.length > 0) {
        const { error: reqError } = await supabase.from('advanced_shift_requests').insert(requestsToInsert);
        if (reqError) throw reqError;
      }

      alert('🎉 40名規模の小刻みでリアルなデモデータセットを一括投入しました！\n\n【内訳】\n・午前(9-14時) / 午後(13-18時) / フル(9-18時) / 早朝(7-10時) / 夜間(19-22時)\n・14日間分のシフト希望：' + requestsToInsert.length + '件\n\n「⚡ シフトを自動生成する (AI)」を押して動作をご確認ください！');
      setGenerationResult(null);
      await fetchStats();
    } catch (err: any) {
      console.error('Seed dummy data error:', err);
      alert('ダミーデータの投入に失敗しました: ' + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const currentDate = new Date();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const totalEmployees = allEmployees.length;
  const submittedCount = submittedUserIds.length;
  const submissionRate = totalEmployees > 0 ? Math.round((submittedCount / totalEmployees) * 100) : 0;

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) return;

      const { data: tData } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle();
      if (tData) setTenantName(tData.name);

      const { data: empData } = await supabase.from('users').select('id, name, email').eq('tenant_id', tenantId);
      setAllEmployees(empData || []);

      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');
      
      const { data: reqData } = await supabase.from('advanced_shift_requests').select('user_id').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);
      const uniqueIds = [...new Set((reqData || []).map(r => r.user_id))];
      setSubmittedUserIds(uniqueIds);

      const { data: settingsData } = await supabase.from('shift_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
      if (settingsData) {
        setRequiredLaborCost(settingsData.monthly_labor_budget || 0);
        if (settingsData.shift_period) {
          setShiftPeriod(settingsData.shift_period);
        }
        if (settingsData.submission_deadline_rule) {
          setSubmissionDeadlineRule(settingsData.submission_deadline_rule);
        }
        if (settingsData.is_submission_locked !== undefined) {
          setIsSubmissionLocked(settingsData.is_submission_locked);
        }
        if (settingsData.auto_lock_days !== undefined && settingsData.auto_lock_days !== null) {
          setAutoLockDays(settingsData.auto_lock_days);
        } else if (settingsData.auto_lock_day !== undefined && settingsData.auto_lock_day !== null) {
          setAutoLockDays(String(settingsData.auto_lock_day));
        }
      }

      const monthStartStr = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const monthEndStr = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      const { data: shiftsData } = await supabase.from('advanced_shifts').select('*').eq('tenant_id', tenantId).gte('target_date', monthStartStr).lte('target_date', monthEndStr);
      const { data: wageData } = await supabase.from('shift_employee_settings').select('*').eq('tenant_id', tenantId);
      
      if (shiftsData && wageData) {
        const cost = calculateLaborCost(shiftsData, wageData);
        setEstimatedLaborCost(cost);
      }
    } catch (error) {
      console.error('統計データ取得エラー:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handlePeriodChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value;
    setShiftPeriod(newPeriod);
    setIsSavingPeriod(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const { error } = await supabase.from('shift_settings').update({ shift_period: newPeriod }).eq('tenant_id', tenantId);
      if (error) throw error;
    } catch (err) {
      console.error('期間設定保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setIsSavingPeriod(false);
    }
  };

  const handleSaveRule = async () => {
    setIsSavingRule(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const { error } = await supabase.from('shift_settings').update({ submission_deadline_rule: submissionDeadlineRule }).eq('tenant_id', tenantId);
      if (error) throw error;
      alert('提出ルールを保存しました。');
    } catch (err) {
      console.error('ルール設定保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleToggleLock = async () => {
    setIsSavingLock(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const newValue = !isSubmissionLocked;
      const { error } = await supabase.from('shift_settings').update({ is_submission_locked: newValue }).eq('tenant_id', tenantId);
      if (error) throw error;
      setIsSubmissionLocked(newValue);
    } catch (err) {
      console.error('ロック設定保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setIsSavingLock(false);
    }
  };

  const handleSaveAutoLockDays = async () => {
    setIsSavingAutoLock(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const val = autoLockDays.trim() === '' ? null : autoLockDays.trim();
      const { error } = await supabase.from('shift_settings').update({ auto_lock_days: val }).eq('tenant_id', tenantId);
      if (error) throw error;
      alert('自動締め切り日を保存しました。');
    } catch (err) {
      console.error('自動締め切り日設定保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setIsSavingAutoLock(false);
    }
  };

  const handlePublishDrafts = async () => {
    if (!window.confirm('対象期間の下書きシフトをすべて確定（公開）します。よろしいですか？')) return;
    setIsPublishing(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      const { error } = await supabase.from('advanced_shifts')
        .update({ status: 'confirmed' })
        .eq('tenant_id', tenantId)
        .eq('status', 'draft')
        .gte('target_date', startDate)
        .lte('target_date', endDate);
      
      if (error) throw error;
      alert('シフトを確定しました！');
      fetchStats();
    } catch (err) {
      console.error('確定エラー:', err);
      alert('確定処理中にエラーが発生しました。');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationResult(null);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) return;
      
      const { data: settingsData } = await supabase.from('shift_settings').select('auto_generation_mode').eq('tenant_id', tenantId).maybeSingle();
      const mode = settingsData?.auto_generation_mode || 'equal';
      const { data: empSettings } = await supabase.from('shift_employee_settings').select('*').eq('tenant_id', tenantId);
      
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      // 既存のドラフトシフトをクリア（再生成時の二重化防止）
      await supabase.from('advanced_shifts')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('status', 'draft')
        .gte('target_date', startDate)
        .lte('target_date', endDate);

      const { data: reqs } = await supabase.from('advanced_shift_requirements').select('*').eq('tenant_id', tenantId).is('target_date', null);
      const { data: requests } = await supabase.from('advanced_shift_requests').select('*').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);
      const { data: existingShifts } = await supabase.from('advanced_shifts').select('*').eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);

      const allPeriodGenerated: any[] = [];

      for (let i = 0; i < 7; i++) {
        const targetDay = addDays(weekStart, i);
        const targetDateStr = format(targetDay, 'yyyy-MM-dd');
        const dbDow = targetDay.getDay(); // 0: 日 〜 6: 土

        const generated = generateAutoShift(
          reqs || [], 
          requests || [], 
          existingShifts || [], 
          empSettings || [], 
          targetDateStr, 
          dbDow, 
          mode, 
          allPeriodGenerated
        );
        for (const shift of generated) {
          allPeriodGenerated.push({ ...shift, tenant_id: tenantId, status: 'draft' });
        }
      }

      let newShiftsCount = 0;
      if (allPeriodGenerated.length > 0) {
        const { error: insertError } = await supabase.from('advanced_shifts').insert(allPeriodGenerated);
        if (insertError) {
          console.error(insertError);
          alert('シフト保存エラー: ' + insertError.message);
          throw insertError;
        }
        newShiftsCount = allPeriodGenerated.length;
      }
      
      setGenerationResult({ added: newShiftsCount });
      fetchStats();
    } catch (err) {
      console.error('自動生成エラー:', err);
      alert('自動生成中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative overflow-hidden flex flex-col">
      {/* 画面最上部：全システム共通ヘッダー（固定トップバー） */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/portal')}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
            title="ポータルに戻る"
          >
            <ArrowLeft className="w-4 h-4" />
            ポータル
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-sm">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                クラウドシフト管理システム
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  管理画面
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">{tenantName || '株式会社KAP'}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <AppSwitcher currentApp="shift" role="admin" />
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/');
            }}
            className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
            title="ログアウト"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* グラデーション背景バナー */}
      <div className="relative flex-1">
        <div className="absolute top-0 left-0 w-full h-[320px] bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 opacity-90 rounded-b-[3rem] shadow-2xl"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
            <div className="text-white">
              <h1 className="text-2xl lg:text-3xl font-black flex items-center tracking-tight">
                シフト管理ダッシュボード
              </h1>
              <p className="text-xs text-indigo-100 mt-1 font-medium">希望シフトの収集からAI自動生成・確定・人件費試算まで一括管理</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={handleResetAllShiftData} 
                disabled={isResetting}
                className="bg-rose-500 hover:bg-rose-600 text-white shadow-md px-3 py-2 rounded-xl flex items-center transition font-bold text-xs cursor-pointer disabled:opacity-50"
                title="確定シフト・ドラフト・希望を全削除して初期化します"
              >
                {isResetting ? <div className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full mr-1.5"></div> : <span className="mr-1">🗑️</span>}
                全リセット
              </button>
              <button 
                onClick={handleSeedDummyData} 
                disabled={isSeeding}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md px-3.5 py-2 rounded-xl flex items-center transition font-black text-xs cursor-pointer disabled:opacity-50"
                title="【大元台帳40名・画像通りの必要枠・今週のシフト希望】を一括セットアップします"
              >
                {isSeeding ? <div className="animate-spin w-3.5 h-3.5 border-2 border-slate-950 border-t-slate-950 rounded-full mr-1.5"></div> : <span className="mr-1">🪄</span>}
                40名台帳＆シフト投入
              </button>
              <button 
                onClick={handlePublishDrafts} 
                disabled={isPublishing}
                className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-md px-3.5 py-2 rounded-xl flex items-center transition font-bold text-xs disabled:opacity-50 cursor-pointer"
              >
                {isPublishing ? <div className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full mr-1.5"></div> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                下書き確定（Publish）
              </button>
              <button onClick={() => navigate('/shift/admin/employees')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-3 py-2 rounded-xl flex items-center transition shadow-xs font-bold border border-white/30 text-xs cursor-pointer">
                <Users className="w-3.5 h-3.5 mr-1.5" />人員マスタ
              </button>
              <button onClick={() => navigate('/shift/admin/patterns')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-3 py-2 rounded-xl flex items-center transition shadow-xs font-bold border border-white/30 text-xs cursor-pointer">
                <ClipboardList className="w-3.5 h-3.5 mr-1.5" />必要枠設定
              </button>
              <button onClick={() => navigate('/shift/admin/monthly')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-3 py-2 rounded-xl flex items-center transition shadow-xs font-bold border border-white/30 text-xs cursor-pointer">
                <Calendar className="w-3.5 h-3.5 mr-1.5" />月間状況
              </button>
              <button onClick={() => navigate('/shift/admin/settings')} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-3 py-2 rounded-xl flex items-center transition shadow-xs font-bold border border-white/30 text-xs cursor-pointer">
                <Settings className="w-3.5 h-3.5 mr-1.5" />詳細設定
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center">
                    <DollarSign className="w-6 h-6 mr-2 text-indigo-500" />
                    今月の人件費予実
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">※確定シフトに基づく試算</p>
                </div>
              </div>

              {loadingStats ? (
                <div className="h-32 flex justify-center items-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
              ) : (
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="text-4xl font-black text-indigo-600 tracking-tight">¥{estimatedLaborCost.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">予算設定額</div>
                      <div className="text-lg font-bold text-slate-700">¥{requiredLaborCost > 0 ? requiredLaborCost.toLocaleString() : '未設定'}</div>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-4 mt-4 overflow-hidden shadow-inner">
                    <div 
                      className={`h-4 rounded-full ${estimatedLaborCost > requiredLaborCost && requiredLaborCost > 0 ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-blue-500'}`} 
                      style={{ width: requiredLaborCost > 0 ? `${Math.min((estimatedLaborCost / requiredLaborCost) * 100, 100)}%` : '0%' }}
                    ></div>
                  </div>
                  {estimatedLaborCost > requiredLaborCost && requiredLaborCost > 0 && (
                    <p className="text-xs font-bold text-red-500 mt-2 text-right flex items-center justify-end">
                      <Zap className="w-3 h-3 mr-1" /> 予算をオーバーしています！
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 shadow-xl border border-indigo-500/50 text-white relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
              <h2 className="text-xl font-bold mb-2 flex items-center">
                <Zap className="w-6 h-6 mr-2 text-yellow-300" />
                オートシフト生成 (AI)
              </h2>
              <p className="text-indigo-100 text-sm mb-6">提出された希望と必要枠を照らし合わせ、今週の最適なシフトを1秒で自動作成します。</p>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6 border border-white/20 flex justify-between items-center cursor-pointer hover:bg-white/20 transition" onClick={() => navigate('/shift/admin/requests')}>
                <div>
                  <div className="text-xs text-indigo-200 mb-1">今週のシフト提出率</div>
                  <div className="text-2xl font-bold">{submissionRate}%</div>
                </div>
                <div className="w-px h-10 bg-white/20"></div>
                <div>
                  <div className="text-xs text-indigo-200 mb-1">対象期間</div>
                  <div className="font-bold text-sm">{format(weekStart, 'M/d')} - {format(weekEnd, 'M/d')}</div>
                </div>
              </div>

              {generationResult ? (
                <div className="bg-emerald-500/20 border border-emerald-400 rounded-2xl p-4 text-center">
                  <p className="font-bold text-emerald-100 mb-3 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-emerald-300" />
                    {generationResult.added}件のシフトを自動生成しました！
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => navigate('/shift/admin/calendar')} className="flex-1 bg-white text-indigo-700 font-black py-3 rounded-xl shadow-lg hover:bg-indigo-50 transition text-sm flex items-center justify-center cursor-pointer">
                      📅 シフトカレンダーで確認
                    </button>
                    <button onClick={() => setGenerationResult(null)} className="px-4 bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-xl transition text-sm cursor-pointer">
                      再生成
                    </button>
                  </div>
                </div>
              ) : submissionRate === 0 ? (
                <div className="space-y-3">
                  <button 
                    onClick={handleSeedDummyData} 
                    disabled={isSeeding}
                    className="w-full bg-amber-400 text-slate-950 font-black py-3.5 rounded-xl shadow-lg hover:bg-amber-300 hover:scale-[1.02] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    {isSeeding ? (
                      <><div className="animate-spin w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full mr-3"></div>40名従業員台帳＆シフト投入中...</>
                    ) : (
                      <><span>🪄</span><span className="ml-2">40名従業員台帳＆シフトデモデータを投入</span></>
                    )}
                  </button>
                  <p className="text-[11px] text-indigo-200 text-center">※大元従業員台帳（40名）・時給・4役割の必要枠・今週の希望が一括セットされます</p>
                </div>
              ) : (
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating}
                  className="w-full bg-white text-indigo-700 font-black py-4 rounded-xl shadow-lg hover:bg-indigo-50 hover:scale-[1.02] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isGenerating ? (
                    <><div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full mr-3"></div>AIがシフトを自動割り当て中...</>
                  ) : (
                    <>⚡ シフトを自動生成する (AI)</>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative overflow-hidden mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-indigo-500" />
              シフト管理期間設定
            </h2>
            <div className="flex items-center space-x-4">
              <select
                value={shiftPeriod}
                onChange={handlePeriodChange}
                disabled={isSavingPeriod}
                className="px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-700 font-bold min-w-[200px]"
              >
                <option value="1week">1週間</option>
                <option value="2weeks">2週間</option>
                <option value="1month">1ヶ月</option>
              </select>
              {isSavingPeriod && <span className="text-sm text-indigo-500 font-bold animate-pulse">保存中...</span>}
              {!isSavingPeriod && shiftPeriod && (
                <span className="text-sm text-emerald-600 font-bold flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  現在の設定: {shiftPeriod === '1week' ? '1週間' : shiftPeriod === '2weeks' ? '2週間' : '1ヶ月'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">※この設定はシフト提出画面やカレンダーの表示期間に影響します。</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative overflow-hidden mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-indigo-500" />
              提出ルールの設定（テキスト）
            </h2>
            <div className="flex flex-col space-y-3">
              <textarea
                value={submissionDeadlineRule}
                onChange={(e) => setSubmissionDeadlineRule(e.target.value)}
                placeholder="例: 1〜15日のシフトは前月20日までに提出してください"
                className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-700 min-h-[100px]"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSaveRule}
                  disabled={isSavingRule}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl transition shadow flex items-center disabled:opacity-50 cursor-pointer"
                >
                  {isSavingRule ? '保存中...' : 'ルールを保存'}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">※従業員のシフト提出画面の上部にこのルールが表示されます。</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-xl border border-red-100 relative overflow-hidden mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-red-500" />
              提出を締め切る（ロック）
            </h2>
            <div className="flex items-center space-x-4">
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={isSubmissionLocked} onChange={handleToggleLock} disabled={isSavingLock} />
                  <div className={`block w-14 h-8 rounded-full transition-colors ${isSubmissionLocked ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isSubmissionLocked ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <div className="ml-3 text-slate-700 font-bold">
                  {isSubmissionLocked ? 'ロック中（提出不可）' : '提出可能'}
                </div>
              </label>
              {isSavingLock && <span className="text-sm text-indigo-500 font-bold animate-pulse">保存中...</span>}
            </div>
            <p className="text-xs text-slate-500 mt-2">※オンにすると、従業員はシフト希望の提出・変更ができなくなります。</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-xl border border-orange-100 relative overflow-hidden mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-orange-500" />
              自動締め切り日（複数設定可）
            </h2>
            <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-4">
              <div className="flex items-center w-full md:w-auto">
                <input
                  type="text"
                  value={autoLockDays}
                  onChange={(e) => setAutoLockDays(e.target.value)}
                  placeholder="例: 10,25"
                  className="px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-700 w-full md:w-64"
                />
                <span className="font-bold text-slate-700 ml-3 whitespace-nowrap">日</span>
              </div>
              <button
                onClick={handleSaveAutoLockDays}
                disabled={isSavingAutoLock}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl transition shadow flex items-center justify-center disabled:opacity-50 w-full md:w-auto cursor-pointer"
              >
                {isSavingAutoLock ? '保存中...' : '保存する'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">※カンマ区切りで複数指定できます（例: 10,25）。指定した日を過ぎると、次のサイクルの提出開始まで自動的にシフト提出がロックされます（空欄で無効化）。</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftAdminDashboard;


