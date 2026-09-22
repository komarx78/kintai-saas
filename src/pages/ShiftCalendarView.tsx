import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, User, X, Save, Clock, Trash2, Wand2, RotateCcw, AlertTriangle, Users, ChevronDown, CheckCircle2, Scale, Sparkles, ArrowRightLeft, Calendar, Briefcase, Printer, Building2, MapPin, Store } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { generateAutoShift, rebalanceDraftShifts } from '../lib/shiftAlgorithm';
import AppSwitcher from '../components/AppSwitcher';
import { HelpGuideModal } from '../components/HelpGuideModal';
import { ConfirmedShiftCalendarModal } from '../components/ConfirmedShiftCalendarModal';

interface Shift {
  id: string;
  user_id: string;
  target_date: string;
  start_time: string;
  end_time: string;
  status: string;
  role: string;
  user?: { name: string; department?: string };
  store_name?: string; // 勤務先店舗（応援先店舗）
}

interface ShiftRole {
  name: string;
  color: string;
}

const ShiftCalendarView: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<ShiftRole[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [rawRequests, setRawRequests] = useState<any[]>([]);
  const [userRoleMapState, setUserRoleMapState] = useState<Record<string, string>>({});
  const [isWorkloadPanelOpen, setIsWorkloadPanelOpen] = useState(false);

  // 🏪 複数店舗・店舗間応援機能用State
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all'); // 'all' または '本店' など
  const [enableStoreHelp, setEnableStoreHelp] = useState<boolean>(false);
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);

  const location = useLocation();
  const queryDate = new URLSearchParams(location.search).get('date');
  const [baseDate, setBaseDate] = useState(queryDate ? new Date(queryDate) : new Date());
  const [loading, setLoading] = useState(true);
  const [displayPeriod, setDisplayPeriod] = useState<'1day' | '1week' | '2weeks' | '1month'>('1week');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<Partial<Shift>>({});
  const [saving, setSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isRebalancing, setIsRebalancing] = useState(false);

  // 策B：未配置スタッフ専用 クイック救済アシスト用State
  const [rescueStaffId, setRescueStaffId] = useState<string | null>(null);
  const [isRescuing, setIsRescuing] = useState(false);

  // 🏢 正社員シフト個別先入れエディタ用State（曜日固定完全撤廃・日別変動シフト対応）
  const [isStaffPresetModalOpen, setIsStaffPresetModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  // 社員ID -> 日付文字列 (yyyy-MM-dd) -> { isOff, startTime, endTime }
  const [staffDateConfigs, setStaffDateConfigs] = useState<Record<string, Record<string, { isOff: boolean; startTime: string; endTime: string }>>>({});
  const [isPresetting, setIsPresetting] = useState(false);

  // 📋 確定版シフトカレンダー（店舗貼り出し・印刷用）モーダル用State
  const [isConfirmedCalendarOpen, setIsConfirmedCalendarOpen] = useState(false);

  useEffect(() => {
    fetchSettingsAndData();
  }, [baseDate]);

  const fetchSettingsAndData = async () => {
    setLoading(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) {
        setLoading(false);
        return;
      }

      // シフト設定（表示期間、店舗応援機能ON/OFF）
      const { data: settings } = await supabase.from('shift_settings').select('shift_period, enable_store_help').eq('tenant_id', tenantIdData).maybeSingle();
      const localHelp = localStorage.getItem(`shift_store_help_${tenantIdData}`);
      setEnableStoreHelp(settings?.enable_store_help ?? (localHelp === 'true'));

      const isSingleDayQuery = new URLSearchParams(location.search).has('date');
      const period = isSingleDayQuery ? '1day' : (settings?.shift_period || '1week');
      if (period !== displayPeriod) {
        setDisplayPeriod(period);
      }

      let startD: Date;
      let endD: Date;
      if (displayPeriod === '1day') {
        startD = baseDate;
        endD = baseDate;
      } else if (displayPeriod === '1week') {
        startD = startOfWeek(baseDate, { weekStartsOn: 1 }); // 月曜始まり
        endD = endOfWeek(baseDate, { weekStartsOn: 1 });
      } else if (displayPeriod === '2weeks') {
        startD = startOfWeek(baseDate, { weekStartsOn: 1 });
        endD = addDays(startD, 13);
      } else {
        startD = startOfMonth(baseDate);
        endD = endOfMonth(baseDate);
      }

      const startStr = format(startD, 'yyyy-MM-dd');
      const endStr = format(endD, 'yyyy-MM-dd');

      const { data: rolesData } = await supabase.from('shift_roles').select('*').eq('tenant_id', tenantIdData).order('display_order');
      if (rolesData && rolesData.length > 0) {
        setRoles(rolesData);
      } else {
        setRoles([{name: 'ホール', color: '#4F46E5'}, {name: 'キッチン', color: '#EA580C'}]);
      }

      // ユーザー一覧（所属店舗 department を含めて取得し二重管理を完全排除）
      const { data: usersData } = await supabase.from('users').select('id, name, role, employment_type, department').eq('tenant_id', tenantIdData);
      setUsers(usersData || []);

      // 🏢 店舗（部門）リストの自動連動：department_masters + users.department から一意な店舗名を抽出
      let depts: string[] = [];
      try {
        const { data: deptsData } = await supabase.from('department_masters').select('name').eq('tenant_id', tenantIdData).order('display_order');
        if (deptsData && deptsData.length > 0) {
          depts = deptsData.map((d: any) => d.name).filter(Boolean);
        }
      } catch (e) {
        console.warn('department_masters取得スキップ:', e);
      }
      try {
        const rawLocalDepts = localStorage.getItem(`company_departments_${tenantIdData}`);
        if (rawLocalDepts) {
          const parsed = JSON.parse(rawLocalDepts);
          parsed.forEach((d: any) => { if (d.name && !depts.includes(d.name)) depts.push(d.name); });
        }
      } catch (e) {}

      // 社員マスタ（users）に登録されているdepartmentも完全マージ
      (usersData || []).forEach((u: any) => {
        if (u.department && typeof u.department === 'string' && u.department.trim() && !depts.includes(u.department.trim())) {
          depts.push(u.department.trim());
        }
      });
      setDepartmentsList(depts);

      const { data: shiftsData } = await supabase
        .from('advanced_shifts')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .gte('target_date', startStr)
        .lte('target_date', endStr);
      
      const { data: requestsData } = await supabase
        .from('advanced_shift_requests')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .gte('target_date', startStr)
        .lte('target_date', endStr);

      const { data: reqsData } = await supabase
        .from('advanced_shift_requirements')
        .select('*')
        .eq('tenant_id', tenantIdData);
      setRequirements(reqsData || []);
      
      const { data: empSettingsData } = await supabase.from('shift_employee_settings').select('user_id, default_role').eq('tenant_id', tenantIdData);
      const userRoleMap: Record<string, string> = {};
      (empSettingsData || []).forEach((es: any) => { if (es.default_role) userRoleMap[es.user_id] = es.default_role; });

      const userMap: Record<string, { name: string; department?: string }> = {};
      (usersData || []).forEach((u: any) => { 
        userMap[u.id] = { name: u.name, department: u.department || '' }; 
      });
      
      const formattedShifts = (shiftsData || []).map((s: any) => ({ 
        ...s, 
        user: { 
          name: userMap[s.user_id]?.name || '不明',
          department: userMap[s.user_id]?.department || ''
        },
        store_name: s.store_name || userMap[s.user_id]?.department || '',
        status: s.status || 'confirmed' 
      }));
      
      // すでにドラフトまたは確定シフトが割り当てられているユーザー・日付のキーSet
      const assignedKeys = new Set(formattedShifts.map((s: any) => `${s.target_date}_${s.user_id}`));

      // まだシフトが割り当てられていない未処理の希望のみを抽出
      const formattedRequests = (requestsData || [])
        .filter((r: any) => r.available_start_time && r.available_end_time && !assignedKeys.has(`${r.target_date}_${r.user_id}`))
        .map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          target_date: r.target_date,
          start_time: r.available_start_time,
          end_time: r.available_end_time,
          role: r.preferred_role || userRoleMap[r.user_id] || (rolesData && rolesData.length > 0 ? rolesData[0].name : 'ホール'),
          status: 'request',
          user: { name: userMap[r.user_id] || '不明' }
        }));
      
      setRawRequests(requestsData || []);
      setUserRoleMapState(userRoleMap);
      setShifts([...formattedShifts, ...formattedRequests]);

    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveShift = async () => {
    if (!modalData.target_date || !modalData.user_id || !modalData.start_time || !modalData.end_time || !modalData.role) {
      alert('すべての項目を入力してください');
      return;
    }
    setSaving(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      
      const [sh, sm] = modalData.start_time.split(':').map(Number);
      const [eh, em] = modalData.end_time.split(':').map(Number);
      if (sh * 60 + sm >= eh * 60 + em) {
        alert('終了時間は開始時間より後に設定してください');
        setSaving(false); return;
      }

      // 勤務先店舗の確定
      const assignedUser = users.find(u => u.id === modalData.user_id);
      const targetStore = modalData.store_name || (selectedDepartment !== 'all' ? selectedDepartment : (assignedUser?.department || '本店'));

      // 🚨 店舗間応援機能が有効な場合：同一日・他店舗へのダブルブッキング防止チェック
      if (enableStoreHelp && modalData.user_id && modalData.target_date) {
        const otherShiftsOnSameDay = shifts.filter(s => 
          s.id !== modalData.id && 
          s.user_id === modalData.user_id && 
          s.target_date === modalData.target_date && 
          s.status !== 'request'
        );

        if (otherShiftsOnSameDay.length > 0) {
          const existing = otherShiftsOnSameDay[0];
          const existingStore = existing.store_name || existing.user?.department || '他店舗';
          if (existingStore !== targetStore) {
            const staffName = assignedUser?.name || 'スタッフ';
            alert(`⚠️ 【ダブルブッキング防止警告】\n\n${staffName} さんは同日（${modalData.target_date}）に【${existingStore}】で既にシフト（${existing.start_time.substring(0,5)}〜${existing.end_time.substring(0,5)}）が割り当てられています。\n同一日に複数店舗への重複配置はできません。`);
            setSaving(false);
            return;
          }
        }
      }

      if (modalData.id) {
        if (modalData.status === 'request') {
          try {
            const { error: insertError } = await supabase.from('advanced_shifts').insert([{
              tenant_id: tenantIdData,
              user_id: modalData.user_id,
              target_date: modalData.target_date,
              start_time: modalData.start_time,
              end_time: modalData.end_time,
              role: modalData.role,
              store_name: targetStore,
              status: 'confirmed'
            }]);
            if (insertError) throw insertError;
          } catch (colErr) {
            // store_nameカラムが存在しない場合の安全なフォールバック
            const { error: retryError } = await supabase.from('advanced_shifts').insert([{
              tenant_id: tenantIdData,
              user_id: modalData.user_id,
              target_date: modalData.target_date,
              start_time: modalData.start_time,
              end_time: modalData.end_time,
              role: modalData.role,
              status: 'confirmed'
            }]);
            if (retryError) throw retryError;
          }

          const { error: deleteError } = await supabase.from('advanced_shift_requests').delete().eq('id', modalData.id);
          if (deleteError) throw deleteError;
        } else {
          try {
            const { error } = await supabase.from('advanced_shifts').update({
              target_date: modalData.target_date,
              start_time: modalData.start_time,
              end_time: modalData.end_time,
              role: modalData.role,
              store_name: targetStore,
              status: modalData.status || 'confirmed'
            }).eq('id', modalData.id);
            if (error) throw error;
          } catch (colErr) {
            const { error } = await supabase.from('advanced_shifts').update({
              target_date: modalData.target_date,
              start_time: modalData.start_time,
              end_time: modalData.end_time,
              role: modalData.role,
              status: modalData.status || 'confirmed'
            }).eq('id', modalData.id);
            if (error) throw error;
          }
        }
      } else {
        try {
          const { error } = await supabase.from('advanced_shifts').insert([{
            tenant_id: tenantIdData,
            user_id: modalData.user_id,
            target_date: modalData.target_date,
            start_time: modalData.start_time,
            end_time: modalData.end_time,
            role: modalData.role,
            store_name: targetStore,
            status: 'confirmed'
          }]);
          if (error) throw error;
        } catch (colErr) {
          const { error } = await supabase.from('advanced_shifts').insert([{
            tenant_id: tenantIdData,
            user_id: modalData.user_id,
            target_date: modalData.target_date,
            start_time: modalData.start_time,
            end_time: modalData.end_time,
            role: modalData.role,
            status: 'confirmed'
          }]);
          if (error) throw error;
        }
      }
      
      setIsModalOpen(false);
      fetchSettingsAndData();
    } catch (err) {
      console.error(err);
      alert('シフトの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (id: string, status?: string) => {
    if (!window.confirm('このシフト（希望）を削除しますか？')) return;
    try {
      if (status === 'request') {
        await supabase.from('advanced_shift_requests').delete().eq('id', id);
      } else {
        await supabase.from('advanced_shifts').delete().eq('id', id);
      }
      setIsModalOpen(false);
      fetchSettingsAndData();
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました');
    }
  };

  const handleGenerate = async () => {
    if (!window.confirm('現在の表示期間の希望シフトを元に、AI自動割り当てを実行しますか？\n（実行後、割り当てられたシフトは「未確定（ドラフト）」として配置されます）')) return;
    setIsGenerating(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) return;

      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      const { data: settingsData } = await supabase.from('shift_settings').select('auto_generation_mode').eq('tenant_id', tenantIdData).maybeSingle();
      const mode = settingsData?.auto_generation_mode || 'equal';
      const { data: empSettings } = await supabase.from('shift_employee_settings').select('*').eq('tenant_id', tenantIdData);

      // 既存のドラフトシフトをクリア（再生成時の二重配置防止）
      await supabase.from('advanced_shifts')
        .delete()
        .eq('tenant_id', tenantIdData)
        .eq('status', 'draft')
        .gte('target_date', startStr)
        .lte('target_date', endStr);

      const { data: rawRequests } = await supabase.from('advanced_shift_requests')
        .select('*').eq('tenant_id', tenantIdData)
        .gte('target_date', startStr).lte('target_date', endStr);
      
      const { data: existingShifts } = await supabase.from('advanced_shifts')
        .select('*').eq('tenant_id', tenantIdData)
        .gte('target_date', startStr).lte('target_date', endStr);

      // 最新の必要枠マスタを取得
      const { data: latestReqs } = await supabase.from('advanced_shift_requirements').select('*').eq('tenant_id', tenantIdData);
      const activeReqs = (latestReqs && latestReqs.length > 0) ? latestReqs : (requirements || []);

      const toInsert: any[] = [];
      const datesToProcess = eachDayOfInterval({ start: startDate, end: endDate });

      for (const targetDay of datesToProcess) {
        const targetDateStr = format(targetDay, 'yyyy-MM-dd');
        const dbDow = targetDay.getDay(); // 0: 日 〜 6: 土

        const generated = generateAutoShift(
          activeReqs, 
          rawRequests || [], 
          existingShifts || [], 
          empSettings || [], 
          targetDateStr, 
          dbDow, 
          mode,
          toInsert
        );
        for (const shift of generated) {
          toInsert.push({ ...shift, tenant_id: tenantIdData, status: 'draft' });
        }
      }

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('advanced_shifts').insert(toInsert);
        if (insertError) throw insertError;
      }
      
      alert(`🎉 AI自動割り当てが完了しました！（${toInsert.length}件のシフトを配置）\nカレンダーで配置状況を確認し、「一括確定」を行ってください。`);
      await fetchSettingsAndData();
    } catch (err) {
      console.error(err);
      alert('自動生成中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishAll = async () => {
    if (!window.confirm('現在の表示期間内にある「未確定（ドラフト）」のシフトをすべて確定し、従業員に公開しますか？')) return;
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      const { error } = await supabase.from('advanced_shifts')
        .update({ status: 'confirmed' })
        .eq('tenant_id', tenantIdData)
        .eq('status', 'draft')
        .gte('target_date', startStr)
        .lte('target_date', endStr);
      
      if (error) throw error;
      await fetchSettingsAndData();
      // 🎉 確定完了と同時に確定版カレンダー（店舗貼り出し・印刷用）を自動表示！
      setIsConfirmedCalendarOpen(true);
    } catch (err) {
      console.error(err);
      alert('確定処理に失敗しました');
    }
  };

  const handleUnpublishAll = async () => {
    if (!window.confirm(`現在の表示期間（${format(startDate, 'M/d')}〜${format(endDate, 'M/d')}）の確定シフトをすべて「未確定（下書き）」に戻しますか？\n\n※確定を解除すると、シフトは下書き（ドラフト）状態に戻り、再度の手動微調整やAI自動生成、再確定が可能になります。`)) return;
    setIsUnpublishing(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      const { error } = await supabase.from('advanced_shifts')
        .update({ status: 'draft' })
        .eq('tenant_id', tenantIdData)
        .eq('status', 'confirmed')
        .gte('target_date', startStr)
        .lte('target_date', endStr);
      
      if (error) throw error;
      alert('🎉 対象期間のシフトの確定を解除し、下書き（ドラフト）状態に戻しました！');
      fetchSettingsAndData();
    } catch (err) {
      console.error(err);
      alert('確定解除処理に失敗しました');
    } finally {
      setIsUnpublishing(false);
    }
  };

  const handleRebalanceShifts = async () => {
    if (isRebalancing) return;
    setIsRebalancing(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) return;

      const { data: empSettingsData } = await supabase
        .from('shift_employee_settings')
        .select('*')
        .eq('tenant_id', tenantIdData);

      // 表示期間内のドラフトシフトのみを対象に平準化
      const draftShifts = shifts.filter(s => s.status === 'draft');
      if (draftShifts.length === 0) {
        alert('現在、調整可能な下書き（ドラフト）シフトがありません。\n先に「⚡ AI自動割り当て」を実行してください。');
        setIsRebalancing(false);
        return;
      }

      const result = rebalanceDraftShifts(
        shifts.filter(s => s.status !== 'request'), // 実働シフト（確定＋ドラフト）
        rawRequests,
        users,
        empSettingsData || []
      );

      if (result.updatedShifts.length === 0) {
        alert('ℹ️ すでに全員のシフトが均等に割り振られているか、希望条件に合致する交代可能な枠がありませんでした。');
        setIsRebalancing(false);
        return;
      }

      // Supabaseの advanced_shifts を更新
      for (const updateItem of result.updatedShifts) {
        const { error: updErr } = await supabase
          .from('advanced_shifts')
          .update({ user_id: updateItem.user_id })
          .eq('id', updateItem.id)
          .eq('tenant_id', tenantIdData);
        if (updErr) throw updErr;
      }

      // レポートメッセージの作成
      const logSummary = result.swapLogs.map(log => 
        `・${format(new Date(log.targetDate), 'M/d(E)', { locale: ja })} ${log.timeRange} [${log.role}]:\n   ${log.fromUserName} ➔ ${log.toUserName} へバトンタッチ`
      ).join('\n');

      const remainingMsg = result.unassignedRemaining === 0 
        ? '🎉 未配置スタッフが0名になり、全員均等になりました！'
        : `⚠️ 残り未配置スタッフ: ${result.unassignedRemaining}名（希望枠の不足等により交代できず）`;

      alert(`⚖️ AI稼働平準化が完了しました！（${result.updatedShifts.length}件のシフトを自動調整）\n\n【交代内容】\n${logSummary}\n\n${remainingMsg}`);

      await fetchSettingsAndData();
    } catch (err: any) {
      console.error('リバランスエラー:', err);
      alert('平準化処理中にエラーが発生しました: ' + (err.message || err));
    } finally {
      setIsRebalancing(false);
    }
  };

  let startDate: Date, endDate: Date;
  if (displayPeriod === '1day') {
    startDate = baseDate;
    endDate = baseDate;
  } else if (displayPeriod === '1week') {
    startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
    endDate = endOfWeek(baseDate, { weekStartsOn: 1 });
  } else if (displayPeriod === '2weeks') {
    startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
    endDate = addDays(startDate, 13);
  } else {
    startDate = startOfMonth(baseDate);
    endDate = endOfMonth(baseDate);
  }
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  // スタッフ別 稼働バランス集計（公平性・未配置チェック）
  const staffStats = useMemo(() => {
    return users.map(user => {
      // この期間の有効な希望シフト（日付ユニーク）
      const userRequests = rawRequests.filter(r => r.user_id === user.id && r.available_start_time && r.available_end_time);
      const requestedDates = new Set(userRequests.map(r => r.target_date));
      const requestedDays = requestedDates.size;

      // この期間の実働シフト（ドラフト または 確定）
      const userAssignedShifts = shifts.filter(s => s.user_id === user.id && s.status !== 'request');
      const assignedDates = new Set(userAssignedShifts.map(s => s.target_date));
      const assignedDays = assignedDates.size;

      // 合計勤務時間
      let totalMinutes = 0;
      userAssignedShifts.forEach(s => {
        if (!s.start_time || !s.end_time) return;
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 24 * 60;
        totalMinutes += diff;
      });
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
      const roleName = userRoleMapState[user.id] || (roles[0]?.name || 'ホール');

      let status: 'unassigned' | 'critical_overwork' | 'high_warning' | 'shortage' | 'high' | 'balanced' | 'low' | 'no_request' = 'no_request';
      if (requestedDays > 0 && assignedDays === 0) {
        status = 'unassigned'; // 🚨 未配置（希望を出したのに出番ゼロ！）
      } else if (requestedDays === 0 && assignedDays === 0) {
        status = 'no_request';
      } else if (assignedDays >= 7) {
        status = 'critical_overwork'; // 🚨 労基法違反注意！週7日全勤（法定休日ゼロ）
      } else if (assignedDays === 6) {
        status = 'high_warning'; // ⚠️ 週6日出勤（休日1日のみ・要過密調整）
      } else if (requestedDays >= 3 && assignedDays <= 2) {
        status = 'shortage'; // ⚠️ 最低出勤日数不足！（希望3日以上に対して1〜2日しか入れられていない）
      } else if (requestedDays - assignedDays >= 2 && assignedDays <= 3) {
        status = 'shortage'; // ⚠️ 希望より2日以上削られている不足状態
      } else if (assignedDays === 5) {
        status = 'high'; // 🟡 週5日出勤（週休2日）
      } else if (assignedDays === 3 || assignedDays === 4) {
        status = 'balanced'; // 🟢 適正均等（週3〜4日）
      } else {
        status = 'low'; // 🔵 少なめ（週1〜2日）
      }

      return {
        userId: user.id,
        name: user.name,
        roleName,
        requestedDays,
        assignedDays,
        totalHours,
        status
      };
    }).sort((a, b) => {
      // 🚨 労基法注意（週7日・週6日）や未配置（0日）、最低日数不足など、店長が最優先で調整すべき人を最上部に表示！
      const getPriority = (st: string) => {
        if (st === 'critical_overwork') return 1; // 週7日（最危険・法定休日ゼロ）
        if (st === 'unassigned') return 2; // 未配置0日（要救済）
        if (st === 'high_warning') return 3; // 週6日（休日不足）
        if (st === 'shortage') return 4; // ⚠️ 最低出勤日数不足（希望大幅下回り）
        return 5;
      };
      const pA = getPriority(a.status);
      const pB = getPriority(b.status);
      if (pA !== pB) return pA - pB;
      return a.assignedDays - b.assignedDays;
    });
  }, [users, rawRequests, shifts, userRoleMapState, roles]);

  const unassignedStaffList = useMemo(() => {
    return staffStats.filter(s => s.status === 'unassigned');
  }, [staffStats]);

  // ⚠️ 最低出勤日数不足スタッフ（希望3日以上なのに1〜2日のみ、または希望より2日以上削られている人）
  const shortageStaffList = useMemo(() => {
    return staffStats.filter(s => s.status === 'shortage');
  }, [staffStats]);

  // 🏢 正社員（フルタイム）スタッフの抽出（管理者・正社員）
  const fullTimeEmployees = useMemo(() => {
    return users.filter(u => u.employment_type === 'full-time' || u.role === 'admin' || u.role === 'superadmin');
  }, [users]);

  // 🚨 労基法注意・過密スタッフ（週7日全勤・週6日出勤）の抽出
  const overworkedStaffList = useMemo(() => {
    return staffStats.filter(s => s.status === 'critical_overwork' || s.status === 'high_warning');
  }, [staffStats]);

  // 策B：救済対象スタッフのユーザー情報
  const rescueStaffUser = useMemo(() => {
    if (!rescueStaffId) return null;
    return users.find(u => u.id === rescueStaffId) || null;
  }, [rescueStaffId, users]);

  // 策B：救済対象スタッフの専門職種（店舗設定を最優先）
  const rescueStaffRole = useMemo(() => {
    if (!rescueStaffId) return roles[0]?.name || 'ホール';
    return userRoleMapState[rescueStaffId] || (roles[0]?.name || 'ホール');
  }, [rescueStaffId, userRoleMapState, roles]);

  // 策B：救済対象スタッフの希望日別 救済オプション
  const rescueOptions = useMemo(() => {
    if (!rescueStaffId || !rescueStaffUser) return [];

    const targetRole = rescueStaffRole;
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    // 表示期間内の本人の有効な希望シフト
    const userRequests = rawRequests.filter(r => 
      r.user_id === rescueStaffId &&
      r.available_start_time &&
      r.available_end_time &&
      r.target_date >= startStr &&
      r.target_date <= endStr
    );

    return userRequests.map(req => {
      const dateStr = req.target_date;
      const reqStart = req.available_start_time.substring(0, 5);
      const reqEnd = req.available_end_time.substring(0, 5);

      // 希望時間の算出
      const [sh, sm] = reqStart.split(':').map(Number);
      const [eh, em] = reqEnd.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60;
      const durationHours = Math.round((diff / 60) * 10) / 10;

      // その日の同職種の実働シフト（下書き・確定）
      const sameRoleShifts = shifts.filter(s => 
        s.target_date === dateStr &&
        s.role === targetRole &&
        s.status !== 'request'
      );

      // 本人がすでに入っているか（救済済みなど）
      const isAlreadyAssigned = sameRoleShifts.some(s => s.user_id === rescueStaffId);

      // 同職種で入っている他スタッフの交代候補リスト
      const donorCandidates = sameRoleShifts
        .filter(s => s.user_id !== rescueStaffId)
        .map(s => {
          const stats = staffStats.find(st => st.userId === s.user_id);
          const donorUser = users.find(u => u.id === s.user_id);
          return {
            shiftId: s.id,
            userId: s.user_id,
            userName: donorUser?.name || s.user?.name || '不明',
            startTime: s.start_time.substring(0, 5),
            endTime: s.end_time.substring(0, 5),
            status: s.status, // 'draft' or 'confirmed'
            assignedDays: stats?.assignedDays ?? 1,
            totalHours: stats?.totalHours ?? 0,
          };
        })
        .sort((a, b) => b.assignedDays - a.assignedDays || b.totalHours - a.totalHours);

      return {
        requestId: req.id,
        targetDate: dateStr,
        startTime: reqStart,
        endTime: reqEnd,
        durationHours,
        role: targetRole,
        isAlreadyAssigned,
        sameRoleAssignedCount: sameRoleShifts.length,
        donorCandidates,
      };
    }).sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  }, [rescueStaffId, rescueStaffUser, rescueStaffRole, startDate, endDate, rawRequests, shifts, staffStats, users]);

  // 策B：救済実行ハンドラー（追加 or 交代）
  const handleExecuteRescue = async (
    targetDate: string,
    startTime: string,
    endTime: string,
    role: string,
    donorShiftId?: string,
    donorName?: string
  ) => {
    if (isRescuing || !rescueStaffUser) return;

    const targetDateLabel = format(new Date(targetDate), 'M月d日(E)', { locale: ja });
    const actionDescription = donorShiftId
      ? `${donorName} 様と交代して、${rescueStaffUser.name} 様を配置`
      : `${rescueStaffUser.name} 様を空き枠に追加配置`;

    if (!window.confirm(`【未配置スタッフ救済確認】\n\n対象日: ${targetDateLabel}\n時間帯: ${startTime} 〜 ${endTime}\n専門職種: ${role}\n\n内容: ${actionDescription} しますか？`)) {
      return;
    }

    setIsRescuing(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) throw new Error('テナント情報の取得に失敗しました');

      if (donorShiftId) {
        // 交代（バトンタッチ）：既存ドラフトシフトの担当者を救済対象スタッフに更新
        const { error } = await supabase
          .from('advanced_shifts')
          .update({ 
            user_id: rescueStaffUser.id,
            start_time: startTime,
            end_time: endTime
          })
          .eq('id', donorShiftId)
          .eq('tenant_id', tenantIdData);

        if (error) throw error;
        alert(`🎉 交代が完了しました！\n${donorName} 様から ${rescueStaffUser.name} 様へシフトを交代しました。`);
      } else {
        // 新規追加配置：下書き（draft）として配置
        const { error } = await supabase
          .from('advanced_shifts')
          .insert([{
            tenant_id: tenantIdData,
            user_id: rescueStaffUser.id,
            target_date: targetDate,
            start_time: startTime,
            end_time: endTime,
            role: role,
            status: 'draft'
          }]);

        if (error) throw error;
        alert(`🎉 追加配置が完了しました！\n${rescueStaffUser.name} 様を ${targetDateLabel} の下書きシフトに配置しました。`);
      }

      await fetchSettingsAndData();
    } catch (err: any) {
      console.error('救済エラー:', err);
      alert('救済処理中にエラーが発生しました: ' + (err.message || err));
    } finally {
      setIsRescuing(false);
    }
  };

  // 🏢 正社員シフト先入れ：クイック時間パレット定義（早番・中番・遅番・通し）
  const PRESET_TIME_SLOTS = [
    { label: '早番', start: '09:00', end: '18:00', badge: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
    { label: '中番', start: '11:00', end: '20:00', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
    { label: '遅番', start: '14:00', end: '23:00', badge: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
    { label: '通し', start: '09:00', end: '21:00', badge: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' },
  ];

  // 🏢 正社員日別個別エディタを開く（実際の日付・既存シフトをロード）
  const handleOpenStaffPresetModal = () => {
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    const nextConfigs: Record<string, Record<string, { isOff: boolean; startTime: string; endTime: string }>> = { ...staffDateConfigs };

    fullTimeEmployees.forEach((emp, empIdx) => {
      if (!nextConfigs[emp.id]) {
        nextConfigs[emp.id] = {};
      }
      dates.forEach((d, dIdx) => {
        const dStr = format(d, 'yyyy-MM-dd');
        if (!nextConfigs[emp.id][dStr]) {
          // 既存のカレンダー上の実働シフト（確定・ドラフト）があれば初期値に採用
          const existing = shifts.find(s => s.user_id === emp.id && s.target_date === dStr && s.status !== 'request');
          if (existing) {
            nextConfigs[emp.id][dStr] = {
              isOff: false,
              startTime: existing.start_time.substring(0, 5),
              endTime: existing.end_time.substring(0, 5)
            };
          } else {
            // 初期値：週休2日を適度に分散（社員ごとに公休日をずらす）
            const offDayIndex1 = (empIdx * 2) % dates.length;
            const offDayIndex2 = (empIdx * 2 + 1) % dates.length;
            const isOff = dIdx === offDayIndex1 || dIdx === offDayIndex2;
            nextConfigs[emp.id][dStr] = {
              isOff,
              startTime: '09:00',
              endTime: '18:00'
            };
          }
        }
      });
    });

    setStaffDateConfigs(nextConfigs);
    if ((!selectedStaffId || !fullTimeEmployees.some(e => e.id === selectedStaffId)) && fullTimeEmployees.length > 0) {
      setSelectedStaffId(fullTimeEmployees[0].id);
    }
    setIsStaffPresetModalOpen(true);
  };

  // 🏢 日別の公休トグル
  const toggleStaffDateOff = (empId: string, dateStr: string) => {
    setStaffDateConfigs(prev => {
      const empConfig = prev[empId] || {};
      const current = empConfig[dateStr] || { isOff: false, startTime: '09:00', endTime: '18:00' };
      return {
        ...prev,
        [empId]: {
          ...empConfig,
          [dateStr]: {
            ...current,
            isOff: !current.isOff
          }
        }
      };
    });
  };

  // 🏢 日別のクイック時間パレット適用
  const setStaffDateSlot = (empId: string, dateStr: string, start: string, end: string) => {
    setStaffDateConfigs(prev => {
      const empConfig = prev[empId] || {};
      return {
        ...prev,
        [empId]: {
          ...empConfig,
          [dateStr]: {
            isOff: false,
            startTime: start,
            endTime: end
          }
        }
      };
    });
  };

  // 🏢 日別の時間直接変更
  const updateStaffDateTimeField = (empId: string, dateStr: string, field: 'startTime' | 'endTime', val: string) => {
    setStaffDateConfigs(prev => {
      const empConfig = prev[empId] || {};
      const current = empConfig[dateStr] || { isOff: false, startTime: '09:00', endTime: '18:00' };
      return {
        ...prev,
        [empId]: {
          ...empConfig,
          [dateStr]: {
            ...current,
            [field]: val
          }
        }
      };
    });
  };

  // 🏢 選択中社員の全出勤日を同じ時間帯に一括設定
  const applyTimeToAllDays = (empId: string, start: string, end: string) => {
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    setStaffDateConfigs(prev => {
      const empConfig = prev[empId] || {};
      const updated: Record<string, { isOff: boolean; startTime: string; endTime: string }> = { ...empConfig };
      dates.forEach(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        const cur = updated[dStr] || { isOff: false, startTime: start, endTime: end };
        updated[dStr] = {
          ...cur,
          startTime: start,
          endTime: end
        };
      });
      return {
        ...prev,
        [empId]: updated
      };
    });
  };

  // 🏢 日別 正社員出勤人数の集計マップ（日付文字列 -> 出勤人数）
  const dateStaffCountsMap = useMemo(() => {
    const counts: Record<string, number> = {};
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    dates.forEach(d => {
      const dStr = format(d, 'yyyy-MM-dd');
      let count = 0;
      fullTimeEmployees.forEach(emp => {
        const conf = staffDateConfigs[emp.id]?.[dStr];
        if (conf && !conf.isOff) {
          count++;
        }
      });
      counts[dStr] = count;
    });
    return counts;
  }, [fullTimeEmployees, staffDateConfigs, startDate, endDate]);

  // 🏢 正社員シフト先入れの実行（実際の日付・個別時間帯を確定枠として一括保存）
  const handlePresetFullTimeEmployees = async () => {
    if (fullTimeEmployees.length === 0) {
      alert('正社員（フルタイム）として登録されているスタッフがいません。\n「従業員シフト設定」で雇用区分を「正社員」に設定してください。');
      return;
    }

    setIsPresetting(true);
    try {
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) throw new Error('テナント情報の取得に失敗しました');

      const datesToProcess = eachDayOfInterval({ start: startDate, end: endDate });
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // 既存の正社員の当該期間シフトを一旦クリア（上書き更新）
      const empIds = fullTimeEmployees.map(e => e.id);
      const { error: delErr } = await supabase
        .from('advanced_shifts')
        .delete()
        .eq('tenant_id', tenantIdData)
        .in('user_id', empIds)
        .gte('target_date', startStr)
        .lte('target_date', endStr);
      if (delErr) throw delErr;

      const toInsert: any[] = [];
      for (const emp of fullTimeEmployees) {
        const empRole = userRoleMapState[emp.id] || roles[0]?.name || 'ホール';
        const empConfigs = staffDateConfigs[emp.id] || {};

        for (const day of datesToProcess) {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayConf = empConfigs[dateStr];
          // 公休なら登録しない（公休＝出勤なし）
          if (!dayConf || dayConf.isOff) continue;

          toInsert.push({
            tenant_id: tenantIdData,
            user_id: emp.id,
            target_date: dateStr,
            start_time: dayConf.startTime,
            end_time: dayConf.endTime,
            role: empRole,
            status: 'confirmed' // 正社員の骨組みは確定枠として配置
          });
        }
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('advanced_shifts').insert(toInsert);
        if (insErr) throw insErr;
      }

      alert(`🎉 正社員 ${fullTimeEmployees.length}名 の日付別シフト（出勤計 ${toInsert.length}件）を確定枠として先入れ配置しました！\n\n続いて「⚡ 自動割り当て」を実行すれば、残りの空き枠にバイトが綺麗に埋まります。`);
      setIsStaffPresetModalOpen(false);
      await fetchSettingsAndData();
    } catch (err: any) {
      console.error('Preset full-time error:', err);
      alert('正社員シフトの配置に失敗しました: ' + (err.message || ''));
    } finally {
      setIsPresetting(false);
    }
  };

  const movePeriod = (dir: 1 | -1) => {
    if (displayPeriod === '1day') setBaseDate(addDays(baseDate, dir * 1));
    else if (displayPeriod === '1week') setBaseDate(addDays(baseDate, dir * 7));
    else if (displayPeriod === '2weeks') setBaseDate(addDays(baseDate, dir * 14));
    else setBaseDate(addDays(baseDate, dir * 30));
  };

  const openCellModal = (userId: string, roleName: string, dateStr: string) => {
    setModalData({
      user_id: userId,
      role: roleName,
      target_date: dateStr,
      start_time: '10:00',
      end_time: '15:00'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (shift: Shift) => {
    setModalData({
      id: shift.id,
      user_id: shift.user_id,
      role: shift.role,
      target_date: shift.target_date,
      start_time: shift.start_time.substring(0, 5),
      end_time: shift.end_time.substring(0, 5),
      status: shift.status
    });
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/shift/admin')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center">
              <Clock className="w-6 h-6 mr-3 text-indigo-600" />
              シフトカレンダー ({displayPeriod === '1day' ? '1日' : displayPeriod === '1week' ? '1週間' : displayPeriod === '2weeks' ? '2週間' : '1ヶ月'})
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button onClick={() => movePeriod(-1)} className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm">
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <span className="font-bold text-lg px-6 min-w-[220px] text-center">
                {format(startDate, 'yyyy年M月d日')} 〜 {format(endDate, 'M月d日')}
              </span>
              <button onClick={() => movePeriod(1)} className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm">
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* 🏢 正社員シフト一括先入れボタン（黄金フロー第1歩！） */}
            <button 
              onClick={handleOpenStaffPresetModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl flex flex-col items-center justify-center transition shadow-md font-bold cursor-pointer border border-indigo-400"
              title="正社員スタッフのシフトを実際の日付ごとに1人ずつ（早番・遅番・公休など）細かく先入れ調整します"
            >
              <div className="flex items-center space-x-1.5 text-xs">
                <Briefcase className="w-3.5 h-3.5 text-indigo-200" />
                <span>正社員シフト先入れ</span>
              </div>
              <span className="text-[10px] text-indigo-100 font-medium">（日別個別調整）</span>
            </button>

            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl flex flex-col items-center justify-center transition shadow-md font-bold disabled:opacity-50 cursor-pointer"
              title="社員枠を崩さず、空いている枠にAIがバイトの希望を自動割り当てします"
            >
              <div className="flex items-center space-x-1.5 text-xs">
                {isGenerating ? <div className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"></div> : <Wand2 className="w-3.5 h-3.5" />}
                <span>自動割り当て</span>
              </div>
              <span className="text-[10px] text-amber-100 font-medium">（バイト自動配置）</span>
            </button>

            <button 
              onClick={handlePublishAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl flex flex-col items-center justify-center transition shadow-md font-bold cursor-pointer"
              title="仕上がった下書きシフトを確定し、スタッフのスマホマイページへ本番公開します（確定版カレンダーが自動起動します）"
            >
              <div className="flex items-center space-x-1.5 text-xs">
                <Save className="w-3.5 h-3.5" />
                <span>一括確定</span>
              </div>
              <span className="text-[10px] text-emerald-100 font-medium">（本番公開・配信）</span>
            </button>

            {/* 📋 確定版カレンダー（店舗貼り出し・印刷用）ボタン */}
            <button 
              onClick={() => setIsConfirmedCalendarOpen(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl flex flex-col items-center justify-center transition shadow-md font-bold cursor-pointer border border-slate-700"
              title="確定済みの完成シフトを一覧表示し、店舗貼り出し用にA4横で印刷できます"
            >
              <div className="flex items-center space-x-1.5 text-xs">
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>確定版カレンダー</span>
              </div>
              <span className="text-[10px] text-slate-300 font-medium">（店舗貼り出し・印刷）</span>
            </button>

            <button 
              onClick={handleUnpublishAll}
              disabled={isUnpublishing}
              className="bg-slate-700 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl flex flex-col items-center justify-center transition shadow-md font-bold cursor-pointer disabled:opacity-50"
              title="確定済みのシフトを未確定の下書き（ドラフト）に戻し、再調整やAI再割り当てを可能にします"
            >
              <div className="flex items-center space-x-1.5 text-xs">
                {isUnpublishing ? <div className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"></div> : <RotateCcw className="w-3.5 h-3.5 text-amber-300" />}
                <span>確定解除</span>
              </div>
              <span className="text-[10px] text-slate-300 font-medium">（下書きに戻す）</span>
            </button>
            
            <button 
              onClick={() => {
                setModalData({ target_date: format(baseDate, 'yyyy-MM-dd'), role: roles[0]?.name || 'ホール', start_time: '10:00', end_time: '15:00', user_id: users[0]?.id });
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition shadow-md font-bold text-xs cursor-pointer h-[42px]"
            >
              <Plus className="w-4 h-4" />
              <span>シフト追加</span>
            </button>

            <button
              onClick={() => setIsHelpOpen(true)}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-xl flex items-center space-x-1 transition font-bold text-xs shadow-xs cursor-pointer h-[42px]"
              title="シフト作成の流れ・機能の違いを見る"
            >
              <span className="text-sm">❓</span>
              <span>使い方ガイド</span>
            </button>

            <AppSwitcher currentApp="shift" role="admin" />
          </div>
        </div>

        {/* 🏪 複数店舗セレクター ＆ 店舗応援ステータスバー */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 mb-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center text-slate-700 font-bold text-xs mr-1">
              <Building2 className="w-4 h-4 text-indigo-600 mr-1.5" />
              <span>対象店舗:</span>
            </div>

            {/* 全店舗ボタン */}
            <button
              onClick={() => setSelectedDepartment('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedDepartment === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>全社・全店舗</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedDepartment === 'all' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {users.length}名
              </span>
            </button>

            {/* 各店舗ボタン */}
            {departmentsList.map(deptName => {
              const deptStaffCount = users.filter(u => u.department === deptName).length;
              const isSelected = selectedDepartment === deptName;
              return (
                <button
                  key={deptName}
                  onClick={() => setSelectedDepartment(deptName)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{deptName}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {deptStaffCount}名
                  </span>
                </button>
              );
            })}

            {departmentsList.length === 0 && (
              <span className="text-xs text-slate-400 italic">
                （※ 社員マスタまたは会社設定の部門が自動反映されます）
              </span>
            )}
          </div>

          {/* 右側：店舗応援機能ステータスバッジ */}
          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1.5 ${
              enableStoreHelp
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              {enableStoreHelp ? (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />
                  <span>店舗間応援：有効（他店ヘルプ可）</span>
                </>
              ) : (
                <>
                  <span>🔒 店舗固定モード（自店のみ）</span>
                </>
              )}
            </span>
            <button
              onClick={() => navigate('/shift/settings')}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline font-bold"
              title="シフト設定画面で応援機能のON/OFFを切り替えます"
            >
              設定変更 ≫
            </button>
          </div>
        </div>

        {/* 💡 シフト作成のカンタン4ステップ案内バナー */}
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-100/80 rounded-2xl p-3.5 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center flex-wrap gap-2 text-slate-700 font-medium">
            <span className="font-black text-white bg-indigo-600 px-2 py-0.5 rounded-md text-[10px]">黄金フロー</span>
            <span className="flex items-center gap-1 font-bold text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded-lg border border-indigo-200">
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white inline-flex items-center justify-center text-[10px]">1</span>
              🏢 正社員一括配置（骨組み）
            </span>
            <span className="text-slate-400">➔</span>
            <span className="flex items-center gap-1 font-bold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-lg border border-amber-200/50">
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white inline-flex items-center justify-center text-[10px]">2</span>
              ⚡ 自動割り当て（バイト穴埋め）
            </span>
            <span className="text-slate-400">➔</span>
            <span className="flex items-center gap-1 font-bold text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
              <span className="w-4 h-4 rounded-full bg-slate-400 text-white inline-flex items-center justify-center text-[10px]">3</span>
              ⚠️ バナーで不足・過密確認
            </span>
            <span className="text-slate-400">➔</span>
            <span className="flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-lg border border-emerald-200/50">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px]">4</span>
              🚀 一括確定（本番公開）
            </span>
            <span className="text-slate-400">➔</span>
            <span className="flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-300">
              <RotateCcw className="w-3 h-3 text-slate-500" />
              確定解除（いつでも下書きに戻して再調整可）
            </span>
          </div>
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline shrink-0 text-right cursor-pointer"
          >
            詳しく見る ≫
          </button>
        </div>

        {/* 🚨 未配置スタッフ（出勤ゼロ）警告アラートバナー */}
        {unassignedStaffList.length > 0 && (
          <div className="mb-4 bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start md:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black bg-rose-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                    店長チェック必須
                  </span>
                  <span className="text-xs font-bold text-rose-800 bg-white border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-rose-600" />
                    対象期間: {format(startDate, 'M/d(E)', { locale: ja })}〜{format(endDate, 'M/d(E)', { locale: ja })}
                  </span>
                  <h3 className="font-black text-rose-900 text-base">
                    希望を出したのに【一度も割り当てられていないスタッフ】が {unassignedStaffList.length}名 います！
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {unassignedStaffList.map(st => (
                    <button 
                      key={st.userId}
                      onClick={() => setRescueStaffId(st.userId)}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 px-3 py-1 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer hover:scale-105"
                      title="クリックしてこのスタッフの救済アシストを開く"
                    >
                      <User className="w-3.5 h-3.5 text-rose-600" />
                      <span>{st.name}</span>
                      <span className="text-[11px] bg-rose-600 text-white font-black px-1.5 py-0.2 rounded-md">救済 ≫</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
              <button 
                onClick={handleRebalanceShifts}
                disabled={isRebalancing}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Scale className={`w-4 h-4 ${isRebalancing ? 'animate-spin' : ''}`} />
                <span>{isRebalancing ? '平準化中...' : '⚡ AIで未配置を自動解消'}</span>
              </button>
              <button 
                onClick={() => setIsWorkloadPanelOpen(true)}
                className="bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold px-3 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Users className="w-3.5 h-3.5 text-rose-600" />
                バランス盤
              </button>
            </div>
          </div>
        )}

        {/* 🚨 労基法注意（週6〜7日出勤・法定休日不足）警告アラートバナー */}
        {overworkedStaffList.length > 0 && (
          <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start md:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black bg-amber-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                    労基法注意・休日不足
                  </span>
                  <span className="text-xs font-bold text-amber-900 bg-white border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-600" />
                    対象期間: {format(startDate, 'M/d(E)', { locale: ja })}〜{format(endDate, 'M/d(E)', { locale: ja })}
                  </span>
                  <h3 className="font-black text-amber-950 text-base">
                    【週6〜7日出勤（週休1日以下）】の過密スタッフが {overworkedStaffList.length}名 います！
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {overworkedStaffList.map(st => (
                    <span 
                      key={st.userId}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold shadow-xs ${
                        st.assignedDays >= 7 
                          ? 'bg-rose-600 text-white font-black animate-pulse' 
                          : 'bg-white border border-amber-300 text-amber-900'
                      }`}
                    >
                      <User className={`w-3.5 h-3.5 ${st.assignedDays >= 7 ? 'text-white' : 'text-amber-600'}`} />
                      <span>{st.name}</span>
                      <span className="text-[11px] opacity-90">
                        ({st.assignedDays >= 7 ? '🚨 週7日全勤・休日ゼロ！' : '⚠️ 週6日出勤・休日1日'})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
              <button 
                onClick={handleRebalanceShifts}
                disabled={isRebalancing}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                title="過密スタッフの枠を未配置・少なめスタッフへ安全にバトンタッチして休日を作ります"
              >
                <Scale className={`w-4 h-4 ${isRebalancing ? 'animate-spin' : ''}`} />
                <span>{isRebalancing ? '平準化中...' : '⚖️ AIで過密を平準化（休日作成）'}</span>
              </button>
              <button 
                onClick={() => setIsWorkloadPanelOpen(true)}
                className="bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold px-3 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Users className="w-3.5 h-3.5 text-amber-700" />
                バランス盤
              </button>
            </div>
          </div>
        )}

        {/* ⚠️ 最低出勤日数不足（希望日数を大幅に下回っているスタッフ）警告アラートバナー */}
        {shortageStaffList.length > 0 && (
          <div className="mb-4 bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start md:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black bg-amber-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                    シフト削られ注意・不満防止
                  </span>
                  <span className="text-xs font-bold text-amber-900 bg-white border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-600" />
                    対象期間: {format(startDate, 'M/d(E)', { locale: ja })}〜{format(endDate, 'M/d(E)', { locale: ja })}
                  </span>
                  <h3 className="font-black text-amber-950 text-base">
                    希望日数に対して【出勤枠が大幅に不足しているスタッフ】が {shortageStaffList.length}名 います！
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {shortageStaffList.map(st => (
                    <button 
                      key={st.userId}
                      onClick={() => setRescueStaffId(st.userId)}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 px-3 py-1 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer hover:scale-105"
                      title="クリックしてこのスタッフの救済アシストを開く"
                    >
                      <User className="w-3.5 h-3.5 text-amber-600" />
                      <span>{st.name}</span>
                      <span className="text-[11px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.2 rounded-md border border-amber-200">
                        希望{st.requestedDays}日 ➔ 実働{st.assignedDays}日（{st.requestedDays - st.assignedDays}日不足）
                      </span>
                      <span className="text-[11px] bg-amber-600 text-white font-black px-1.5 py-0.2 rounded-md">
                        救済 ≫
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
              <button 
                onClick={handleRebalanceShifts}
                disabled={isRebalancing}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Scale className={`w-4 h-4 ${isRebalancing ? 'animate-spin' : ''}`} />
                <span>{isRebalancing ? '平準化中...' : '⚡ AIでバランス平準化'}</span>
              </button>
              <button 
                onClick={() => setIsWorkloadPanelOpen(true)}
                className="bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold px-3 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Users className="w-3.5 h-3.5 text-amber-700" />
                バランス盤
              </button>
            </div>
          </div>
        )}

        {/* 📊 スタッフ別 稼働バランス＆公平性チェッカー盤（開閉式） */}
        <div className="mb-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all">
          <div 
            onClick={() => setIsWorkloadPanelOpen(!isWorkloadPanelOpen)}
            className="p-3 sm:px-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors select-none flex-wrap gap-2"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl text-white shadow-xs ${
                overworkedStaffList.length > 0 ? 'bg-rose-600' : unassignedStaffList.length > 0 ? 'bg-rose-500' : shortageStaffList.length > 0 ? 'bg-amber-500' : 'bg-indigo-600'
              }`}>
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-slate-800 text-sm sm:text-base flex items-center gap-2">
                    <span>📊 スタッフ稼働バランス・公平性チェッカー盤</span>
                  </h3>
                  <span className="text-xs bg-indigo-50 text-indigo-700 font-black px-2.5 py-0.5 rounded-lg border border-indigo-200 flex items-center gap-1 shadow-2xs">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>集計期間: {format(startDate, 'yyyy年M月d日(E)', { locale: ja })} 〜 {format(endDate, 'M月d日(E)', { locale: ja })}</span>
                  </span>
                  {overworkedStaffList.length > 0 && (
                    <span className="bg-rose-600 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                      🚨 労基法注意(週6〜7日) {overworkedStaffList.length}名
                    </span>
                  )}
                  {unassignedStaffList.length > 0 && (
                    <span className="bg-rose-100 text-rose-700 text-xs font-black px-2 py-0.5 rounded-full border border-rose-200">
                      ⚠️ 未配置 {unassignedStaffList.length}名
                    </span>
                  )}
                  {shortageStaffList.length > 0 && (
                    <span className="bg-amber-100 text-amber-800 text-xs font-black px-2 py-0.5 rounded-full border border-amber-300">
                      ⚠️ 最低日数不足 {shortageStaffList.length}名
                    </span>
                  )}
                  {unassignedStaffList.length === 0 && overworkedStaffList.length === 0 && shortageStaffList.length === 0 && (
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      全員適正配置（希望通り＆週休2日以上確保）
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  誰が何日・何時間入っているかを一覧確認し、週7日全勤（労基法違反）や未配置・シフト不足を即座にチェック・是正できます
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRebalanceShifts();
                }}
                disabled={isRebalancing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 ${
                  overworkedStaffList.length > 0 || unassignedStaffList.length > 0
                    ? 'bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 animate-pulse shadow-amber-200'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                title="過密スタッフの下書きシフトを未配置・少なめスタッフへ安全に自動バトンタッチして休日を作ります"
              >
                <Scale className={`w-3.5 h-3.5 ${isRebalancing ? 'animate-spin' : ''}`} />
                <span>{isRebalancing ? '平準化中...' : '⚖️ AIで稼働バランスを自動平準化'}</span>
              </button>

              <span className="text-xs font-bold text-indigo-600 hidden md:inline ml-2">
                {isWorkloadPanelOpen ? '閉じる' : '詳細を見る'}
              </span>
              <div className={`p-1.5 rounded-lg bg-slate-100 text-slate-600 transition-transform duration-200 ${isWorkloadPanelOpen ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {isWorkloadPanelOpen && (
            <div className="border-t border-slate-100 p-4 bg-slate-50/50">
              {/* クイック指標サマリー */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold text-slate-400">対象スタッフ総数</div>
                  <div className="text-lg font-black text-slate-800 mt-0.5">{users.length}名</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
                  <div className="text-[11px] font-bold text-emerald-600">適正均等（3〜4日）</div>
                  <div className="text-lg font-black text-emerald-700 mt-0.5">
                    {staffStats.filter(s => s.status === 'balanced').length}名
                  </div>
                </div>
                <div className={`p-3 rounded-xl border shadow-xs ${
                  overworkedStaffList.length > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-amber-200'
                }`}>
                  <div className={`text-[11px] font-bold ${overworkedStaffList.length > 0 ? 'text-rose-600 font-black' : 'text-amber-600'}`}>
                    過密・休日不足（6〜7日）
                  </div>
                  <div className={`text-lg font-black mt-0.5 ${overworkedStaffList.length > 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                    {overworkedStaffList.length}名
                  </div>
                </div>
                <div className={`p-3 rounded-xl border shadow-xs ${unassignedStaffList.length > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'}`}>
                  <div className={`text-[11px] font-bold ${unassignedStaffList.length > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}`}>
                    未配置（出勤ゼロ）
                  </div>
                  <div className={`text-lg font-black mt-0.5 ${unassignedStaffList.length > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                    {unassignedStaffList.length}名
                  </div>
                </div>
                <div className={`p-3 rounded-xl border shadow-xs ${shortageStaffList.length > 0 ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
                  <div className={`text-[11px] font-bold ${shortageStaffList.length > 0 ? 'text-amber-700 font-black' : 'text-slate-400'}`}>
                    最低日数不足
                  </div>
                  <div className={`text-lg font-black mt-0.5 ${shortageStaffList.length > 0 ? 'text-amber-800' : 'text-slate-800'}`}>
                    {shortageStaffList.length}名
                  </div>
                </div>
              </div>

              {/* スタッフ一覧テーブル */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">スタッフ名</th>
                        <th className="py-2.5 px-3">主な役割</th>
                        <th className="py-2.5 px-3 text-center">希望日数</th>
                        <th className="py-2.5 px-3 text-center">確定・下書き</th>
                        <th className="py-2.5 px-3 text-right">週間労働時間</th>
                        <th className="py-2.5 px-4 text-center">公平性判定</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffStats.map(st => (
                        <tr key={st.userId} className={`hover:bg-slate-50 transition-colors ${
                          st.status === 'unassigned' ? 'bg-rose-50/40 font-bold' : 
                          st.status === 'shortage' ? 'bg-amber-50/30' : ''
                        }`}>
                          <td className="py-2.5 px-4 font-bold text-slate-800">
                            {st.status === 'unassigned' || st.status === 'shortage' ? (
                              <button
                                onClick={() => setRescueStaffId(st.userId)}
                                className={`flex items-center gap-2 hover:underline cursor-pointer text-left font-black ${
                                  st.status === 'unassigned' ? 'text-rose-700' : 'text-amber-900'
                                }`}
                                title="クリックして救済アシストを開く"
                              >
                                <User className={`w-3.5 h-3.5 ${st.status === 'unassigned' ? 'text-rose-500' : 'text-amber-600'}`} />
                                <span>{st.name}</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>{st.name}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {st.roleName}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                            {st.requestedDays > 0 ? `${st.requestedDays}日` : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-xs font-black px-2 py-0.5 rounded ${
                              st.status === 'critical_overwork'
                                ? 'bg-rose-600 text-white animate-pulse'
                                : st.status === 'high_warning'
                                  ? 'bg-amber-600 text-white'
                                  : st.status === 'unassigned' 
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : st.status === 'shortage'
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : st.assignedDays >= 5
                                        ? 'bg-amber-100 text-amber-800'
                                        : st.assignedDays > 0
                                          ? 'bg-indigo-50 text-indigo-700'
                                          : 'text-slate-300'
                            }`}>
                              {st.assignedDays}日
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                            {st.totalHours > 0 ? `${st.totalHours}h` : <span className="text-slate-300">0.0h</span>}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {st.status === 'critical_overwork' && (
                              <span className="inline-flex items-center gap-1 bg-rose-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-black animate-pulse shadow-xs">
                                🚨 労基法違反(週7日全勤)
                              </span>
                            )}
                            {st.status === 'high_warning' && (
                              <span className="inline-flex items-center gap-1 bg-amber-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-black shadow-xs">
                                ⚠️ 休日1日のみ(週6日)
                              </span>
                            )}
                            {st.status === 'unassigned' && (
                              <button
                                onClick={() => setRescueStaffId(st.userId)}
                                className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-black shadow-xs transition cursor-pointer hover:scale-105"
                                title="クリックして救済アシストを開く"
                              >
                                <Sparkles className="w-3 h-3 text-amber-200" />
                                <span>🚨 救済アシスト ≫</span>
                              </button>
                            )}
                            {st.status === 'shortage' && (
                              <button
                                onClick={() => setRescueStaffId(st.userId)}
                                className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-black shadow-xs transition cursor-pointer hover:scale-105"
                                title="クリックして救済アシスト（追加枠）を開く"
                              >
                                <Sparkles className="w-3 h-3 text-amber-100" />
                                <span>⚠️ 最低日数不足(救済) ≫</span>
                              </button>
                            )}
                            {st.status === 'balanced' && (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[11px] font-bold">
                                🟢 適正均等(週3〜4日)
                              </span>
                            )}
                            {st.status === 'high' && (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[11px] font-bold">
                                🟡 週5日出勤(週休2日)
                              </span>
                            )}
                            {st.status === 'low' && (
                              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[11px] font-bold">
                                🔵 少なめ(週1〜2日)
                              </span>
                            )}
                            {st.status === 'no_request' && (
                              <span className="text-slate-400 text-[11px]">
                                希望なし
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 凡例 (Legend) */}
        <div className="flex items-center space-x-6 mb-4 px-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-4 rounded shadow-sm" style={{backgroundColor: '#94a3b8', backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.5) 4px, rgba(255,255,255,0.5) 8px)', border: '1px dashed #fff'}}></div>
            <span className="text-sm font-bold text-slate-600">従業員からの希望 (未処理)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-4 rounded shadow-sm opacity-80" style={{backgroundColor: '#94a3b8', border: '2px dotted #fff'}}></div>
            <span className="text-sm font-bold text-slate-600">ドラフト (自動割り当て結果・未確定)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-4 rounded shadow-sm" style={{backgroundColor: '#94a3b8', border: '1px solid rgba(0,0,0,0.15)'}}></div>
            <span className="text-sm font-bold text-slate-600">確定済みシフト</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl overflow-y-auto relative max-h-[75vh] p-2 sm:p-4">
          {loading ? (
            <div className="h-64 flex justify-center items-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
          ) : (
            <div className="flex flex-col space-y-8">
              {dateRange.map(d => {
                const dStr = format(d, 'yyyy-MM-dd');
                const dayShifts = shifts.filter(s => s.target_date === dStr);
                const isToday = dStr === format(new Date(), 'yyyy-MM-dd');

                return (
                  <div key={dStr} className={`bg-white border ${isToday ? 'border-indigo-300 shadow-md' : 'border-slate-200 shadow-sm'} rounded-xl overflow-hidden`}>
                    <div className={`p-3 font-bold flex items-center border-b border-slate-200 ${isToday ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-100 text-slate-800'}`}>
                      <span className="text-lg">
                        【{format(d, 'M月d日')} ({format(d, 'E', { locale: ja })})】
                      </span>
                      {isToday && <span className="ml-3 text-xs bg-indigo-600 text-white px-2 py-1 rounded-full">本日</span>}
                    </div>

                    <div className="overflow-x-auto">
                      <div className="min-w-[800px]">
                        <div className="flex border-b border-slate-200 bg-slate-50">
                          <div className="w-56 shrink-0 p-2 font-bold text-slate-500 border-r border-slate-200 text-sm flex items-center justify-center bg-slate-100 sticky left-0 z-20">
                            スタッフ / 役割
                          </div>
                          <div className="flex-1 flex">
                            {Array.from({length: 24}, (_, i) => i).map(h => (
                              <div key={h} className="flex-1 border-r border-slate-200 text-center py-1 bg-slate-50">
                                <span className="text-[10px] font-bold text-slate-400">{h.toString().padStart(2, '0')}:00</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {roles.map(role => {
                            const roleShifts = dayShifts.filter(s => {
                              if (s.role !== role.name) return false;
                              if (selectedDepartment !== 'all') {
                                const shiftStore = s.store_name || s.user?.department;
                                if (enableStoreHelp) {
                                  // 応援ON：勤務店舗が選択店舗と一致するもの
                                  return shiftStore === selectedDepartment;
                                } else {
                                  // 応援OFF：所属店舗が選択店舗と一致するもののみ
                                  return s.user?.department === selectedDepartment;
                                }
                              }
                              return true;
                            });

                            // 選択中店舗の所属スタッフで、この役割を担当できるスタッフも行として抽出（空枠への配置をスムーズにするため）
                            const deptStaffsWithRole = selectedDepartment !== 'all' 
                              ? users.filter(u => u.department === selectedDepartment && (userRoleMapState[u.id] || roles[0]?.name) === role.name).map(u => u.id)
                              : [];
                            const staffIds = [...new Set([...roleShifts.map(s => s.user_id), ...deptStaffsWithRole])];

                            return (
                              <React.Fragment key={role.name}>
                                <div className="bg-slate-50/50 px-3 py-1.5 font-bold text-xs text-slate-600 flex items-center border-b border-slate-100 sticky left-0 z-10 w-56">
                                  <div className="w-2 h-2 rounded-full mr-2 shadow-sm" style={{backgroundColor: role.color}}></div>
                                  {role.name}
                                  {selectedDepartment !== 'all' && (
                                    <span className="ml-2 text-[10px] text-slate-400 font-normal">
                                      （{selectedDepartment}）
                                    </span>
                                  )}
                                </div>

                                {staffIds.length === 0 ? (
                                   <div className="flex text-sm group">
                                     <div className="w-56 shrink-0 p-2 text-slate-400 border-r border-slate-100 flex items-center sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors">
                                       <span className="ml-6 text-xs">配置なし</span>
                                     </div>
                                     <div className="flex-1 flex relative bg-slate-50/20">
                                        <div className="absolute inset-0 flex pointer-events-none">
                                          {Array.from({length: 24}, (_, i) => i).map(h => (
                                            <div key={h} className="flex-1 border-r border-slate-100/50 h-full"></div>
                                          ))}
                                        </div>
                                     </div>
                                   </div>
                                ) : (
                                  staffIds.map(uid => {
                                    const userObj = users.find(u => u.id === uid);
                                    const userShifts = roleShifts.filter(s => s.user_id === uid);
                                    const userStats = staffStats.find(st => st.userId === uid);
                                    const isHelperStaff = enableStoreHelp && selectedDepartment !== 'all' && userObj?.department && userObj.department !== selectedDepartment;

                                    return (
                                      <div key={uid} className="flex group hover:bg-slate-50 transition-colors">
                                        <div className="w-56 shrink-0 p-2 font-bold text-slate-700 border-r border-slate-100 flex items-center justify-between sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors shadow-[1px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                          <div className="flex flex-col min-w-0 pr-1">
                                            <div className="flex items-center">
                                              <User className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                                              <span className="truncate text-sm font-bold" title={userObj?.name || '不明なユーザー'}>
                                                {userObj?.name || '不明なユーザー'}
                                              </span>
                                            </div>
                                            {/* 所属店舗名 ＆ 他店舗からの応援バッジ */}
                                            <div className="flex items-center gap-1 mt-0.5 ml-4 flex-wrap">
                                              {userObj?.department && (
                                                <span className="text-[10px] text-slate-400 font-medium truncate">
                                                  {userObj.department}
                                                </span>
                                              )}
                                              {isHelperStaff && (
                                                <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1 py-0.1 rounded border border-amber-300">
                                                  🤝 応援
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          {userStats && (
                                            <div 
                                              className={`shrink-0 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs ${
                                                userStats.assignedDays >= 7
                                                  ? 'bg-rose-600 text-white animate-pulse'
                                                  : userStats.assignedDays === 6
                                                    ? 'bg-amber-600 text-white'
                                                    : userStats.assignedDays === 0 
                                                      ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                                                      : userStats.assignedDays === 5
                                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                              }`}
                                              title={`今週: ${userStats.assignedDays}日出勤 / 合計 ${userStats.totalHours}時間 ${userStats.assignedDays >= 7 ? '（🚨 労働基準法違反・週7日全勤・休日ゼロ）' : userStats.assignedDays === 6 ? '（⚠️ 休日1日のみ・要調整）' : ''}`}
                                            >
                                              <span className={userStats.assignedDays >= 7 ? 'font-black' : userStats.assignedDays === 0 ? 'text-rose-600 font-black' : 'text-indigo-600 font-black'}>
                                                {userStats.assignedDays >= 7 ? '🚨 7日(無休)' : userStats.assignedDays === 6 ? '⚠️ 6日' : `${userStats.assignedDays}日`}
                                              </span>
                                              <span className={`text-[9px] ${userStats.assignedDays >= 6 ? 'text-white/80' : 'text-slate-400'}`}>({userStats.totalHours}h)</span>
                                            </div>
                                          )}
                                        </div>
                                        
                                        <div 
                                          className="flex-1 relative min-h-[44px] group/cell bg-white flex cursor-pointer"
                                          onClick={(e) => {
                                            if ((e.target as HTMLElement).closest('.shift-block')) return;
                                            openCellModal(uid, role.name, dStr);
                                          }}
                                        >
                                          <div className="absolute inset-0 flex pointer-events-none">
                                            {Array.from({length: 24}, (_, i) => i).map(h => (
                                              <div key={h} className="flex-1 border-r border-slate-100/50 h-full"></div>
                                            ))}
                                          </div>
                                          
                                          <div className="absolute inset-0">
                                            {userShifts.map(shift => {
                                              const [sh, sm] = shift.start_time.split(':').map(Number);
                                              const [eh, em] = shift.end_time.split(':').map(Number);
                                              const startMinutes = sh * 60 + sm;
                                              const endMinutes = eh * 60 + em;
                                              
                                              const totalMinutes = 24 * 60;
                                              const leftPercent = (startMinutes / totalMinutes) * 100;
                                              const widthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;
                                              const isRequest = shift.status === 'request';
                                              const isDraft = shift.status === 'draft';
                                              
                                              // 🤝 応援勤務バッジ判定（シフトの勤務先とスタッフの所属店舗が異なる場合）
                                              const isShiftHelper = enableStoreHelp && shift.store_name && userObj?.department && shift.store_name !== userObj.department;

                                              return (
                                                <div
                                                  key={shift.id}
                                                  onClick={(e) => { e.stopPropagation(); openEditModal(shift); }}
                                                  className={`shift-block absolute top-1.5 bottom-1.5 rounded-md shadow-sm flex items-center justify-center text-white text-[11px] font-bold hover:brightness-110 hover:-translate-y-0.5 transition-all z-10 px-1.5 overflow-hidden whitespace-nowrap cursor-pointer`}
                                                  style={{
                                                    backgroundColor: role.color,
                                                    backgroundImage: isRequest 
                                                      ? `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.4) 10px, rgba(255,255,255,0.4) 20px)`
                                                      : undefined,
                                                    opacity: (isRequest || isDraft) ? 0.8 : 1,
                                                    border: isRequest ? '2px dashed #fff' : isDraft ? '2px dotted #fff' : '1px solid rgba(0,0,0,0.15)',
                                                    left: `${leftPercent}%`,
                                                    width: `${widthPercent}%`
                                                  }}
                                                  title={`${isShiftHelper ? `【🤝 ${userObj?.department}より応援勤務】` : ''}勤務店舗: ${shift.store_name || userObj?.department || '自店'} (${isRequest ? "未確定（希望）" : isDraft ? "ドラフト（未確定）" : "確定済み"})`}
                                                >
                                                  <div className="flex items-center gap-1 truncate pointer-events-none">
                                                    {isShiftHelper && (
                                                      <span className="bg-amber-400 text-slate-900 text-[9px] font-black px-1 py-0.2 rounded shrink-0 shadow-2xs">
                                                        🤝 {userObj?.department}応援
                                                      </span>
                                                    )}
                                                    <span>{shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)}</span>
                                                    {isRequest && " (希望)"}
                                                    {isDraft && " (未確定)"}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                                {/* 役割ごとの不足状況サマリー（ガントチャート時間軸と完全同期） */}
                                <div className="flex bg-rose-50/20 group border-b border-slate-100 hover:bg-rose-50/30 transition-colors">
                                  <div className="w-56 shrink-0 p-2 font-bold text-rose-600 border-r border-slate-100 text-[10px] flex items-center justify-between sticky left-0 z-10 bg-white shadow-[1px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                                      {role.name} 不足状況
                                    </span>
                                  </div>
                                  <div className="flex-1 min-h-[38px] relative flex items-center">
                                    {/* 24時間グリッド線 */}
                                    <div className="absolute inset-0 flex pointer-events-none">
                                      {Array.from({length: 24}, (_, i) => i).map(h => (
                                        <div key={h} className="flex-1 border-r border-slate-100/50 h-full"></div>
                                      ))}
                                    </div>
                                    
                                    {(() => {
                                      const dow = d.getDay();
                                      const dayReqs = requirements.filter(r => r.day_of_week === dow && r.role === role.name);
                                      // 確定・ドラフトのみを実働シフトとしてカウント
                                      const dayAssignedShifts = dayShifts.filter(s => s.role === role.name && s.status !== 'request');
                                      
                                      const shortages: { start: number; end: number; count: number }[] = [];
                                      let currentStart: number | null = null;
                                      let currentCount = 0;

                                      for (let h = 0; h < 24; h++) {
                                        let required = 0;
                                        dayReqs.forEach(req => {
                                          const [sh] = req.start_time.split(':').map(Number);
                                          const [eh, em] = req.end_time.split(':').map(Number);
                                          const endHour = em > 0 ? eh : eh - 1;
                                          if (h >= sh && h <= endHour) required += req.required_count || 0;
                                        });

                                        let actual = 0;
                                        if (required > 0) {
                                          dayAssignedShifts.forEach(shift => {
                                            const [sh] = shift.start_time.split(':').map(Number);
                                            const [eh, em] = shift.end_time.split(':').map(Number);
                                            const endHour = em > 0 ? eh : eh - 1;
                                            if (h >= sh && h <= endHour) actual++;
                                          });
                                        }

                                        const diff = required - actual;
                                        if (diff > 0) {
                                          if (currentStart === null || currentCount !== diff) {
                                            if (currentStart !== null) {
                                              shortages.push({ start: currentStart, end: h, count: currentCount });
                                            }
                                            currentStart = h;
                                            currentCount = diff;
                                          }
                                        } else {
                                          if (currentStart !== null) {
                                            shortages.push({ start: currentStart, end: h, count: currentCount });
                                            currentStart = null;
                                          }
                                        }
                                      }
                                      if (currentStart !== null) {
                                        shortages.push({ start: currentStart, end: 24, count: currentCount });
                                      }

                                      if (shortages.length === 0) {
                                        return (
                                          <div className="text-[10px] font-bold text-slate-400 pl-4 z-10 select-none">
                                            充足（不足なし）
                                          </div>
                                        );
                                      }

                                      const totalMinutes = 24 * 60;

                                      return shortages.map((shortage, idx) => {
                                        const startMinutes = shortage.start * 60;
                                        const endMinutes = shortage.end * 60;
                                        const leftPercent = (startMinutes / totalMinutes) * 100;
                                        const widthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;

                                        return (
                                          <div 
                                            key={idx}
                                            onClick={() => {
                                              const shStr = shortage.start.toString().padStart(2, '0') + ':00';
                                              const ehStr = shortage.end.toString().padStart(2, '0') + ':00';
                                              setModalData({
                                                target_date: dStr,
                                                role: role.name,
                                                start_time: shStr,
                                                end_time: ehStr,
                                                user_id: users[0]?.id
                                              });
                                              setIsModalOpen(true);
                                            }}
                                            className="absolute top-1.5 bottom-1.5 rounded-md shadow-xs bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black flex items-center justify-center px-1 overflow-hidden whitespace-nowrap z-10 border border-rose-600 cursor-pointer transition-all hover:scale-[1.02] hover:z-20"
                                            style={{
                                              left: `${leftPercent}%`,
                                              width: `${widthPercent}%`,
                                              minWidth: '20px'
                                            }}
                                            title={`${shortage.start}:00〜${shortage.end}:00 【${shortage.count}人不足】（クリックしてこの時間帯にシフト追加）`}
                                          >
                                            <span className="truncate flex items-center gap-0.5 pointer-events-none">
                                              <span className="text-[9px]">⚠️</span>
                                              {widthPercent >= 8 ? (
                                                <span>{shortage.start}:00-{shortage.end}:00 ({shortage.count}人不足)</span>
                                              ) : widthPercent >= 4.5 ? (
                                                <span>{shortage.count}人不足</span>
                                              ) : (
                                                <span>{shortage.count}</span>
                                              )}
                                            </span>
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-indigo-600 p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-lg">{modalData.id ? 'シフト編集' : 'シフト直接追加'}</h2>
                {modalData.id && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shadow-2xs ${
                    modalData.status === 'confirmed' ? 'bg-emerald-500 text-white' :
                    modalData.status === 'request' ? 'bg-rose-500 text-white' :
                    'bg-amber-400 text-slate-900'
                  }`}>
                    {modalData.status === 'confirmed' ? '確定済み' : modalData.status === 'request' ? '従業員希望' : '下書き（ドラフト）'}
                  </span>
                )}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">対象日</label>
                <input type="date" value={modalData.target_date || ''} onChange={e => setModalData({...modalData, target_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">役割</label>
                <select value={modalData.role || ''} onChange={e => setModalData({...modalData, role: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium">
                  {roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">開始時間</label>
                  <input type="time" value={modalData.start_time || ''} onChange={e => setModalData({...modalData, start_time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">終了時間</label>
                  <input type="time" value={modalData.end_time || ''} onChange={e => setModalData({...modalData, end_time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium" />
                </div>
              </div>
              {/* 勤務先店舗（店舗間応援機能ONの場合に表示） */}
              {enableStoreHelp && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      勤務先店舗（応援先）
                    </span>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
                      🤝 応援機能有効
                    </span>
                  </label>
                  <select
                    value={modalData.store_name || (selectedDepartment !== 'all' ? selectedDepartment : (departmentsList[0] || '本店'))}
                    onChange={e => setModalData({...modalData, store_name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-800"
                  >
                    {departmentsList.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    {departmentsList.length === 0 && <option value="本店">本店</option>}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">担当者</label>
                <select 
                  value={modalData.user_id || ''} 
                  onChange={e => {
                    const newUserId = e.target.value;
                    const selUser = users.find(u => u.id === newUserId);
                    setModalData({
                      ...modalData, 
                      user_id: newUserId,
                      store_name: modalData.store_name || (selectedDepartment !== 'all' ? selectedDepartment : (selUser?.department || departmentsList[0] || '本店'))
                    });
                  }} 
                  className="w-full bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg p-2 font-bold"
                >
                  <option value="">選択してください</option>
                  {users
                    .filter(u => {
                      if (!enableStoreHelp && selectedDepartment !== 'all') {
                        return u.department === selectedDepartment;
                      }
                      return true;
                    })
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.department ? `(${u.department})` : ''}
                      </option>
                    ))}
                </select>

                {/* 応援勤務に関するガイダンス表示 */}
                {(() => {
                  const assignedUser = users.find(u => u.id === modalData.user_id);
                  const targetStore = modalData.store_name || (selectedDepartment !== 'all' ? selectedDepartment : assignedUser?.department);
                  const isHelper = enableStoreHelp && assignedUser?.department && targetStore && assignedUser.department !== targetStore;
                  if (isHelper) {
                    return (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-1.5 font-bold">
                        <span>🤝</span>
                        <span>【他店応援】{assignedUser.name} 様（{assignedUser.department}所属）を【{targetStore}】へ応援勤務として配置します。</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              
              <div className="flex flex-wrap gap-2 mt-6">
                {modalData.id && (
                  <button 
                    type="button"
                    onClick={() => handleDeleteShift(modalData.id!, modalData.status)} 
                    className="px-3 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition flex items-center justify-center whitespace-nowrap text-xs cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    {modalData.status === 'request' ? '却下する' : '削除する'}
                  </button>
                )}

                {modalData.id && modalData.status === 'confirmed' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!modalData.id) return;
                      try {
                        const { error } = await supabase.from('advanced_shifts').update({ status: 'draft' }).eq('id', modalData.id);
                        if (error) throw error;
                        setIsModalOpen(false);
                        fetchSettingsAndData();
                        alert('このシフトの確定を解除し、下書きに戻しました');
                      } catch (e: any) {
                        alert('確定解除に失敗しました: ' + e.message);
                      }
                    }}
                    className="px-3 py-3 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl font-bold hover:bg-amber-100 transition flex items-center justify-center whitespace-nowrap text-xs cursor-pointer"
                    title="このシフトのみ確定を解除して下書き状態に戻します"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5 text-amber-700" />
                    確定解除（下書きへ）
                  </button>
                )}

                <button 
                  type="button"
                  onClick={handleSaveShift} 
                  disabled={saving} 
                  className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-indigo-700 transition flex items-center justify-center text-xs cursor-pointer"
                >
                  {saving ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div> : <><Save className="w-4 h-4 mr-1.5" />{modalData.status === 'request' ? 'この希望で確定する' : '確定する'}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚨 策B：未配置スタッフ専用 クイック救済アシストモーダル */}
      {rescueStaffId && rescueStaffUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            {/* モーダルヘッダー */}
            <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 p-5 text-white flex justify-between items-start shrink-0">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                  未配置スタッフ クイック救済アシスト（策B）
                </div>
                <h2 className="text-xl font-black flex items-center gap-2">
                  <span>{rescueStaffUser.name} 様</span>
                  <span className="text-xs bg-white/25 px-2.5 py-0.5 rounded-lg font-bold border border-white/30">
                    専門職種: {rescueStaffRole}
                  </span>
                </h2>
                <p className="text-xs text-rose-100 mt-1">
                  専門職種【{rescueStaffRole}】を守ったまま、本人の希望日に合わせて「空き枠への追加」または「同職種スタッフとの交代」を1クリックで実行できます。
                </p>
              </div>
              <button 
                onClick={() => setRescueStaffId(null)} 
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* モーダルコンテンツ（スクロール可能） */}
            <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/50 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  本人の出勤希望日（全 {rescueOptions.length} 日）
                </h3>
                <span className="text-xs text-slate-500">
                  ※本人が出勤可能と回答した希望日のみを表示しています
                </span>
              </div>

              {rescueOptions.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
                  <p className="font-bold">この期間に提出された出勤希望シフトがありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rescueOptions.map((opt) => (
                    <div 
                      key={opt.requestId}
                      className={`p-4 rounded-2xl border transition-all ${
                        opt.isAlreadyAssigned
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base font-black text-slate-800">
                            {format(new Date(opt.targetDate), 'M月d日(E)', { locale: ja })}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 text-slate-400" />
                            希望時間: {opt.startTime} 〜 {opt.endTime}（{opt.durationHours}h）
                          </span>
                        </div>

                        {opt.isAlreadyAssigned && (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            この日に配置済み
                          </span>
                        )}
                      </div>

                      {/* アクション選択肢 */}
                      {!opt.isAlreadyAssigned && (
                        <div className="space-y-2.5">
                          {/* 選択肢1：空き枠に追加配置 */}
                          <div className="flex items-center justify-between bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 gap-3">
                            <div>
                              <div className="text-xs font-black text-emerald-900 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                空き枠に追加配置（下書き）
                              </div>
                              <div className="text-[11px] text-emerald-700 mt-0.5">
                                現在の同職種配置: {opt.sameRoleAssignedCount}名。本人の希望時間（{opt.startTime}〜{opt.endTime}）で枠を追加して配置します。
                              </div>
                            </div>
                            <button
                              disabled={isRescuing}
                              onClick={() => handleExecuteRescue(opt.targetDate, opt.startTime, opt.endTime, opt.role)}
                              className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>追加配置する</span>
                            </button>
                          </div>

                          {/* 選択肢2：同職種スタッフとの交代（バトンタッチ） */}
                          {opt.donorCandidates.length > 0 && (
                            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 space-y-2">
                              <div className="text-xs font-black text-amber-900 flex items-center gap-1">
                                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                                同職種スタッフと交代して配置（過密緩和）
                              </div>
                              <div className="text-[11px] text-amber-700">
                                すでに配置されている同職種スタッフから交代します（相手の出勤日は1日減り、休日になります）。
                              </div>

                              <div className="space-y-1.5 pt-1">
                                {opt.donorCandidates.map(donor => (
                                  <div 
                                    key={donor.shiftId}
                                    className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs gap-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <User className="w-3.5 h-3.5 text-amber-600" />
                                      <span className="font-black text-xs text-slate-800">{donor.userName} 様</span>
                                      <span className="text-[11px] text-slate-500 font-medium">（{donor.startTime}〜{donor.endTime}）</span>
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded shadow-2xs ${
                                        donor.assignedDays >= 7 
                                          ? 'bg-rose-600 text-white animate-pulse' 
                                          : donor.assignedDays === 6
                                            ? 'bg-amber-600 text-white'
                                            : donor.assignedDays === 5
                                              ? 'bg-amber-500 text-white' 
                                              : 'bg-slate-100 text-slate-700'
                                      }`}>
                                        {donor.assignedDays >= 7 ? '🚨 週7日全勤(休日なし)' : donor.assignedDays === 6 ? '⚠️ 週6日出勤(休日不足)' : `週間${donor.assignedDays}日出勤`} / {donor.totalHours}h
                                      </span>
                                    </div>
                                    <button
                                      disabled={isRescuing}
                                      onClick={() => handleExecuteRescue(opt.targetDate, donor.startTime, donor.endTime, opt.role, donor.shiftId, donor.userName)}
                                      className={`shrink-0 font-black text-[11px] px-3 py-1.5 rounded-lg shadow-2xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1 text-white ${
                                        donor.assignedDays >= 7 
                                          ? 'bg-rose-600 hover:bg-rose-700' 
                                          : donor.assignedDays === 6
                                            ? 'bg-amber-600 hover:bg-amber-700'
                                            : 'bg-amber-500 hover:bg-amber-600'
                                      }`}
                                      title={donor.assignedDays >= 7 ? 'この人と交代して、このスタッフに休日を作ります（労基法遵守）' : 'この人と交代します'}
                                    >
                                      <ArrowRightLeft className="w-3 h-3" />
                                      <span>{donor.assignedDays >= 7 ? 'この人と交代(休日作成)' : 'この人と交代'}</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                配置したシフトは「下書き」状態となり、後から手動微調整も可能です
              </span>
              <button
                onClick={() => setRescueStaffId(null)}
                className="bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏢 正社員シフト個別先入れエディタ（曜日固定完全撤廃・日別変動シフト対応） */}
      {isStaffPresetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 animate-in fade-in flex flex-col max-h-[92vh]">
            {/* モーダルヘッダー */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex justify-between items-start shrink-0">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase mb-1">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-300" />
                  正社員シフト先入れ（土台・骨組み作成）
                </div>
                <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
                  <span>👔 正社員 日付別・個別シフト調整</span>
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  曜日固定ではなく、<strong className="text-amber-300">実際の日付（年月日）ごとに社員1人ずつ「公休」や「出勤時間（早番・遅番など）」を細かく調整</strong>できます。<br />
                  同日に出勤する他社員の状況も確認しながら、責任者不在のない確実な土台を作成できます。
                </p>
              </div>
              <button 
                onClick={() => setIsStaffPresetModalOpen(false)} 
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* モーダルコンテンツ（スクロール可能） */}
            <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50 overflow-y-auto grow">
              {/* 上部：対象期間 ＆ 社員切り替えセレクター */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      対象期間:
                    </span>
                    <span className="text-xs font-black text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                      {format(startDate, 'yyyy年M月d日(E)', { locale: ja })} 〜 {format(endDate, 'M月d日(E)', { locale: ja })}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-bold">
                    正社員スタッフ: <span className="text-indigo-700 font-black">{fullTimeEmployees.length}</span> 名
                  </div>
                </div>

                {/* 社員選択タブ */}
                <div>
                  <div className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>調整する社員を選択してください（1人ずつじっくり調整できます）:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fullTimeEmployees.map(emp => {
                      const isSelected = (selectedStaffId || fullTimeEmployees[0]?.id) === emp.id;
                      const empConfig = staffDateConfigs[emp.id] || {};
                      const dates = eachDayOfInterval({ start: startDate, end: endDate });
                      const offCount = dates.filter(d => empConfig[format(d, 'yyyy-MM-dd')]?.isOff).length;
                      const workCount = dates.length - offCount;

                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => setSelectedStaffId(emp.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                            isSelected 
                              ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400 scale-102' 
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                            isSelected ? 'bg-white text-indigo-700' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {emp.name.charAt(0)}
                          </div>
                          <span>{emp.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-white text-slate-500'
                          }`}>
                            出勤{workCount}日 / 休{offCount}日
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 日別 正社員出勤バランス盤（店舗責任者不在チェッカー） */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600" />
                    日付別 正社員出勤人数（責任者不在チェック）
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ※赤色の日は正社員が0名（店舗に責任者不在）です
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 text-center">
                  {eachDayOfInterval({ start: startDate, end: endDate }).map(d => {
                    const dStr = format(d, 'yyyy-MM-dd');
                    const count = dateStaffCountsMap[dStr] || 0;
                    const isZero = count === 0;
                    const dow = d.getDay();
                    return (
                      <div 
                        key={dStr} 
                        className={`p-2 rounded-xl border transition ${
                          isZero 
                            ? 'bg-rose-50 border-rose-300 text-rose-700 font-black ring-2 ring-rose-400/50' 
                            : count === 1 
                              ? 'bg-amber-50 border-amber-200 text-amber-800' 
                              : 'bg-indigo-50/40 border-indigo-100 text-indigo-900'
                        }`}
                      >
                        <div className={`text-xs font-bold ${dow === 0 ? 'text-rose-600' : dow === 6 ? 'text-blue-600' : 'text-slate-700'}`}>
                          {format(d, 'M/d(E)', { locale: ja })}
                        </div>
                        <div className="text-sm font-black mt-0.5">
                          {count}名
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {isZero ? (
                            <span className="text-rose-600 font-black animate-pulse">⚠️ 不在!</span>
                          ) : (
                            <span className="text-slate-500 font-medium">出勤</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 選択中社員の「日付別シフト調整カードリスト」 */}
              {(() => {
                const currentStaff = fullTimeEmployees.find(e => e.id === (selectedStaffId || fullTimeEmployees[0]?.id)) || fullTimeEmployees[0];
                if (!currentStaff) return null;

                const currentEmpConfigs = staffDateConfigs[currentStaff.id] || {};
                const dates = eachDayOfInterval({ start: startDate, end: endDate });
                const offCount = dates.filter(d => currentEmpConfigs[format(d, 'yyyy-MM-dd')]?.isOff).length;
                const workCount = dates.length - offCount;

                // 週間合計労働時間
                let totalMinutes = 0;
                dates.forEach(d => {
                  const conf = currentEmpConfigs[format(d, 'yyyy-MM-dd')];
                  if (conf && !conf.isOff) {
                    const [sh, sm] = conf.startTime.split(':').map(Number);
                    const [eh, em] = conf.endTime.split(':').map(Number);
                    let diff = (eh * 60 + em) - (sh * 60 + sm);
                    if (diff < 0) diff += 24 * 60;
                    totalMinutes += diff;
                  }
                });
                const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

                return (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    {/* 選択中社員の情報ヘッダー */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-indigo-950 flex items-center gap-1.5">
                          <span>👤 {currentStaff.name} のシフト設定</span>
                        </span>
                        <span className="text-[11px] bg-indigo-600 text-white font-black px-2 py-0.5 rounded-full">
                          正社員
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="text-slate-600">
                          週出勤: <strong className="text-indigo-700 text-sm">{workCount}日</strong>
                        </span>
                        <span className="text-slate-600">
                          週公休: <strong className="text-rose-600 text-sm">{offCount}日</strong>
                        </span>
                        <span className="text-slate-600">
                          合計勤務: <strong className="text-slate-900 text-sm">{totalHours}h</strong>
                        </span>
                      </div>
                    </div>

                    {/* 一括時間アシストバー */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100/80 px-3 py-2 rounded-xl text-xs">
                      <span className="font-bold text-slate-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{currentStaff.name} の全出勤日を一括で同じ時間帯に統一:</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {PRESET_TIME_SLOTS.map(slot => (
                          <button
                            key={slot.label}
                            type="button"
                            onClick={() => applyTimeToAllDays(currentStaff.id, slot.start, slot.end)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${slot.badge}`}
                            title={`全出勤日を ${slot.label} (${slot.start}〜${slot.end}) に一括設定`}
                          >
                            全日程を{slot.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 日付別カードリスト */}
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {dates.map(d => {
                        const dStr = format(d, 'yyyy-MM-dd');
                        const dayConf = currentEmpConfigs[dStr] || { isOff: false, startTime: '09:00', endTime: '18:00' };
                        const dow = d.getDay();
                        const isSun = dow === 0;
                        const isSat = dow === 6;

                        // 同日出勤の他正社員
                        const otherStaffStatus = fullTimeEmployees
                          .filter(e => e.id !== currentStaff.id)
                          .map(e => {
                            const conf = staffDateConfigs[e.id]?.[dStr];
                            const isOff = conf ? conf.isOff : false;
                            return {
                              name: e.name,
                              isOff,
                              time: conf ? `${conf.startTime}-${conf.endTime}` : '09:00-18:00'
                            };
                          });
                        const workingOthers = otherStaffStatus.filter(s => !s.isOff);

                        return (
                          <div 
                            key={dStr}
                            className={`p-3 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                              dayConf.isOff 
                                ? 'bg-rose-50/50 border-rose-200' 
                                : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200'
                            }`}
                          >
                            {/* 日付 ＆ 公休切替ボタン */}
                            <div className="flex items-center gap-3 min-w-[210px]">
                              <div className="flex flex-col">
                                <span className={`text-sm font-black ${
                                  isSun ? 'text-rose-600' : isSat ? 'text-blue-600' : 'text-slate-800'
                                }`}>
                                  {format(d, 'M月d日 (E)', { locale: ja })}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {format(d, 'yyyy-MM-dd')}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleStaffDateOff(currentStaff.id, dStr)}
                                className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                  dayConf.isOff 
                                    ? 'bg-rose-500 text-white shadow-xs' 
                                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
                                }`}
                              >
                                <span>{dayConf.isOff ? '🔴 公休（休み）' : '⚪ 出勤'}</span>
                              </button>
                            </div>

                            {/* 出勤の場合：クイックパレット ＆ 時間入力 */}
                            {!dayConf.isOff ? (
                              <div className="flex flex-wrap items-center gap-2 grow">
                                {/* クイック時間パレット */}
                                <div className="flex items-center gap-1">
                                  {PRESET_TIME_SLOTS.map(slot => (
                                    <button
                                      key={slot.label}
                                      type="button"
                                      onClick={() => setStaffDateSlot(currentStaff.id, dStr, slot.start, slot.end)}
                                      className={`px-2 py-1 rounded-md text-[11px] font-bold border transition cursor-pointer ${slot.badge} ${
                                        dayConf.startTime === slot.start && dayConf.endTime === slot.end
                                          ? 'ring-2 ring-indigo-500 font-black'
                                          : ''
                                      }`}
                                      title={`${slot.label} (${slot.start}〜${slot.end}) を適用`}
                                    >
                                      {slot.label}
                                    </button>
                                  ))}
                                </div>

                                {/* 直接時間変更 */}
                                <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded-lg border border-slate-300">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <input 
                                    type="time" 
                                    value={dayConf.startTime} 
                                    onChange={e => updateStaffDateTimeField(currentStaff.id, dStr, 'startTime', e.target.value)}
                                    className="text-xs font-bold text-slate-800 text-center w-16"
                                  />
                                  <span className="text-slate-400">〜</span>
                                  <input 
                                    type="time" 
                                    value={dayConf.endTime} 
                                    onChange={e => updateStaffDateTimeField(currentStaff.id, dStr, 'endTime', e.target.value)}
                                    className="text-xs font-bold text-slate-800 text-center w-16"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="grow text-xs font-bold text-rose-600 flex items-center gap-1">
                                <span>✨ この日は公休（休み）です</span>
                              </div>
                            )}

                            {/* 同日出勤の他正社員プレビュー */}
                            <div className="text-[11px] text-slate-500 shrink-0 md:text-right">
                              {workingOthers.length > 0 ? (
                                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  <Users className="w-3 h-3 text-indigo-600" />
                                  同日出勤: {workingOthers.map(o => `${o.name}(${o.time})`).join(', ')}
                                </span>
                              ) : (
                                <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  ⚠️ 他の社員出勤なし（{dayConf.isOff ? '責任者ゼロ！' : 'ワンオペ'}）
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* モーダルフッター */}
            <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
              <button
                onClick={() => setIsStaffPresetModalOpen(false)}
                className="bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                disabled={isPresetting || fullTimeEmployees.length === 0}
                onClick={handlePresetFullTimeEmployees}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isPresetting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div>
                    <span>先入れ配置中...</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="w-4 h-4" />
                    <span>正社員 {fullTimeEmployees.length}名 のシフトを先入れ配置する（確定枠）</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📋 確定版シフトカレンダー（店舗貼り出し・印刷用）モーダル */}
      <ConfirmedShiftCalendarModal 
        isOpen={isConfirmedCalendarOpen} 
        onClose={() => setIsConfirmedCalendarOpen(false)} 
        shifts={shifts}
        users={users}
        startDate={startDate}
        endDate={endDate}
        roles={roles}
      />

      {/* ❓ 使い方ガイドモーダル */}
      <HelpGuideModal 
        screenKey="shift_calendar" 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
      />
    </div>
  );
};

export default ShiftCalendarView;
