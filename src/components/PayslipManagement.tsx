import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  DollarSign, ChevronLeft, ChevronRight, Plus, 
  Eye, Edit3, Trash2, CheckCircle2, Lock, Unlock, Printer, 
  Users, Sparkles, FileText, Loader2, X, Clock, UploadCloud, FileSpreadsheet 
} from 'lucide-react';
import { parseMoneyForwardPayslipCsv, type ParsedMFPayslip } from '../lib/mfPayslipParser';
import { OfficialPayslipDoc } from './OfficialPayslipDoc';

interface PayslipManagementProps {
  tenantId: string | null;
}

export interface Payslip {
  id?: string;
  tenant_id: string;
  user_id: string;
  year_month: string;
  payment_date: string;
  work_days: number;
  actual_hours: number;
  overtime_hours: number;
  paid_leave_days: number;
  absence_days: number;
  executive_salary?: number;
  base_salary: number;
  overtime_allowance: number;
  position_allowance: number;
  commuting_allowance: number;
  housing_allowance: number;
  special_allowance: number;
  total_earnings: number;
  health_insurance: number;
  nursing_insurance: number;
  child_care_support?: number;
  pension_insurance: number;
  employment_insurance: number;
  income_tax: number;
  resident_tax: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  note: string;
  pdf_data_base64?: string;
  status: 'draft' | 'published';
  user?: any;
}

export const PayslipManagement: React.FC<PayslipManagementProps> = ({ tenantId }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [employees, setEmployees] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  // CSV/TSVインポートモーダルState
  const [importModal, setImportModal] = useState<{
    isOpen: boolean;
    rawText: string;
    parsedList: ParsedMFPayslip[];
  }>({
    isOpen: false,
    rawText: '',
    parsedList: []
  });

  // 編集モーダルState
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    data: Payslip;
  }>({
    isOpen: false,
    data: getInitialPayslipData('', '')
  });

  // 明細プレビューモーダルState
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    payslip: Payslip | null;
  }>({
    isOpen: false,
    payslip: null
  });

  function getInitialPayslipData(userId: string, targetMonth: string): Payslip {
    const defaultPayDate = `${targetMonth}-25`;
    return {
      tenant_id: tenantId || '',
      user_id: userId,
      year_month: targetMonth,
      payment_date: defaultPayDate,
      work_days: 20,
      actual_hours: 160,
      overtime_hours: 0,
      paid_leave_days: 0,
      absence_days: 0,
      base_salary: 250000,
      overtime_allowance: 0,
      position_allowance: 0,
      commuting_allowance: 15000,
      housing_allowance: 0,
      special_allowance: 0,
      total_earnings: 265000,
      health_insurance: 13000,
      nursing_insurance: 0,
      pension_insurance: 24000,
      employment_insurance: 1500,
      income_tax: 6000,
      resident_tax: 12000,
      other_deductions: 0,
      total_deductions: 56500,
      net_salary: 208500,
      note: 'いつもお疲れ様です。',
      status: 'draft'
    };
  }

  const currentYearMonth = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`;

  const fetchData = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      // 1. 会社情報取得
      const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
      setTenantInfo(tData);

      // 2. 従業員一覧取得
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      const usersList = uData || [];
      setEmployees(usersList);

      // 3. 当月の給与明細取得
      const { data: pData } = await supabase
        .from('payslips')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('year_month', currentYearMonth);

      if (pData) {
        const enriched = pData.map(p => ({
          ...p,
          user: usersList.find(u => u.id === p.user_id)
        }));
        setPayslips(enriched);
      } else {
        setPayslips([]);
      }
    } catch (e) {
      console.error('Error fetching payslips:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId, currentMonth]);

  // 前月・次月
  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const handleCurrentMonth = () => setCurrentMonth(new Date());

  // 勤怠実績から当月の給与明細を一括自動生成（下書き）
  const handleAutoGenerateFromAttendance = async () => {
    if (!tenantId || employees.length === 0) return;
    if (!confirm(`${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月度の打刻データ・有給実績を集計して、全員分の給与明細（下書き）を作成しますか？`)) return;

    setIsSaving(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // 当月の打刻取得
      const { data: attData } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('date', startDate)
        .lte('date', endDate);

      // 当月の有給申請取得
      const { data: reqData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', '承認')
        .gte('start_date', startDate)
        .lte('start_date', endDate);

      const records = attData || [];
      const requests = reqData || [];

      for (const emp of employees) {
        const empRecords = records.filter(r => r.user_id === emp.id);
        const workDays = empRecords.filter(r => r.check_in_time).length;
        
        let actualMins = 0;
        let overtimeMins = 0;
        empRecords.forEach(r => {
          if (r.check_in_time && r.check_out_time) {
            const [inH, inM] = r.check_in_time.split(':').map(Number);
            const [outH, outM] = r.check_out_time.split(':').map(Number);
            const total = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM));
            const breakM = total >= 480 ? 60 : (total >= 360 ? 45 : 0);
            const work = Math.max(0, total - breakM);
            actualMins += work;
            overtimeMins += Math.max(0, work - 480);
          }
        });

        const empRequests = requests.filter(r => r.user_id === emp.id && (r.type?.includes('有給') || r.type?.includes('年休')));
        const paidLeaveDays = empRequests.length;

        const base = 250000;
        const overtimeHours = Number((overtimeMins / 60).toFixed(1));
        const overtimeAllowance = Math.floor(overtimeHours * (base / 160 * 1.25));
        const commuting = 15000;
        const totalEarn = base + overtimeAllowance + commuting;

        // 概算社会保険・税金
        const health = Math.floor(totalEarn * 0.05);
        const pension = Math.floor(totalEarn * 0.0915);
        const employ = Math.floor(totalEarn * 0.006);
        const income = Math.floor(totalEarn * 0.03);
        const resident = 12000;
        const totalDeduct = health + pension + employ + income + resident;
        const net = totalEarn - totalDeduct;

        const payload = {
          tenant_id: tenantId,
          user_id: emp.id,
          year_month: currentYearMonth,
          payment_date: `${currentYearMonth}-25`,
          work_days: workDays || 20,
          actual_hours: Number((actualMins / 60).toFixed(1)) || 160,
          overtime_hours: overtimeHours,
          paid_leave_days: paidLeaveDays,
          absence_days: 0,
          base_salary: base,
          overtime_allowance: overtimeAllowance,
          position_allowance: 0,
          commuting_allowance: commuting,
          housing_allowance: 0,
          special_allowance: 0,
          total_earnings: totalEarn,
          health_insurance: health,
          nursing_insurance: 0,
          pension_insurance: pension,
          employment_insurance: employ,
          income_tax: income,
          resident_tax: resident,
          other_deductions: 0,
          total_deductions: totalDeduct,
          net_salary: net,
          note: '今月も勤務お疲れ様でした。',
          status: 'draft'
        };

        await supabase
          .from('payslips')
          .upsert(payload, { onConflict: 'tenant_id,user_id,year_month' });
      }

      alert('✨ 全員の打刻・有給データから給与明細（下書き）を一括生成しました！');
      await fetchData();
    } catch (e: any) {
      console.error(e);
      alert('自動生成中にエラーが発生しました: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // マネーフォワード給与テキスト解析
  const handleParseImportText = (text: string) => {
    const list = parseMoneyForwardPayslipCsv(text);
    setImportModal(prev => ({
      ...prev,
      rawText: text,
      parsedList: list
    }));
  };

  // ファイル選択時の解析
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) handleParseImportText(content);
    };
    reader.readAsText(file);
  };

  // マネーフォワード給与データ取込実行
  const handleExecuteImport = async () => {
    if (!tenantId || importModal.parsedList.length === 0) return;
    setIsSaving(true);
    try {
      let successCount = 0;
      for (const item of importModal.parsedList) {
        // 従業員検索（氏名のスペース除去比較）
        const matchedEmp = employees.find(
          e => e.name.replace(/\s+/g, '') === item.employeeName.replace(/\s+/g, '')
        );

        let targetUserId = matchedEmp?.id;

        // 従業員マスタに存在しない場合は自動登録
        if (!targetUserId) {
          const { data: newUser, error: createErr } = await supabase
            .from('users')
            .insert({
              tenant_id: tenantId,
              name: item.employeeName,
              role: item.contractType === '役員' ? '管理者' : '一般',
              department: item.department || '役員',
              email: `emp_${Date.now()}_${Math.floor(Math.random()*1000)}@cocotte.local`
            })
            .select()
            .single();
          
          if (!createErr && newUser) {
            targetUserId = newUser.id;
          }
        }

        if (targetUserId) {
          const payload = {
            tenant_id: tenantId,
            user_id: targetUserId,
            year_month: currentYearMonth,
            payment_date: `${currentYearMonth}-25`,
            work_days: item.workDays || 0,
            actual_hours: item.totalWorkHours || 0,
            overtime_hours: 0,
            paid_leave_days: item.paidLeaveDays || 0,
            paid_leave_remaining: item.paidLeaveRemaining || 0.0,
            absence_days: 0,
            executive_salary: item.executiveSalary || 0,
            base_salary: item.baseSalary,
            overtime_allowance: item.overtimeAllowance,
            position_allowance: item.positionAllowance,
            commuting_allowance: item.commutingTaxFree + item.commutingTaxable,
            housing_allowance: item.housingAllowance,
            special_allowance: item.specialAllowance,
            total_earnings: item.totalEarnings,
            health_insurance: item.healthInsurance,
            nursing_insurance: item.nursingInsurance,
            child_care_support: item.childCareSupport || 0,
            pension_insurance: item.pensionInsurance,
            employment_insurance: item.employmentInsurance,
            income_tax: item.incomeTax,
            resident_tax: item.residentTax,
            other_deductions: 0,
            total_deductions: item.totalDeductions,
            net_salary: item.netSalary,
            transfer_amount: item.transferAmount || item.netSalary,
            note: `${item.contractType ? `【${item.contractType}】` : ''}マネーフォワード給与取込データ`,
            status: 'published' // 即時公開
          };

          await supabase
            .from('payslips')
            .upsert(payload, { onConflict: 'tenant_id,user_id,year_month' });
          
          successCount++;
        }
      }

      alert(`🎉 マネーフォワード給与データから ${successCount} 名分の給与明細を正常に取り込みました！`);
      setImportModal({ isOpen: false, rawText: '', parsedList: [] });
      await fetchData();
    } catch (e: any) {
      console.error(e);
      alert('インポート中にエラーが発生しました: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 全員分一括公開 / 非公開
  const handleBulkTogglePublish = async (publish: boolean) => {
    if (payslips.length === 0) return;
    const msg = publish 
      ? `当月（${currentYearMonth}）の給与明細 ${payslips.length} 件をすべて従業員へ公開しますか？` 
      : `当月の給与明細をすべて非公開（下書き）に戻しますか？`;
    if (!confirm(msg)) return;

    setIsSaving(true);
    try {
      for (const p of payslips) {
        if (p.id) {
          await supabase
            .from('payslips')
            .update({ status: publish ? 'published' : 'draft' })
            .eq('id', p.id);
        }
      }
      alert(publish ? '🎉 全員の給与明細を公開しました！従業員画面で閲覧可能になります。' : '給与明細を下書き（非公開）に戻しました。');
      await fetchData();
    } catch (e: any) {
      alert('更新に失敗しました: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 個別保存
  const handleSavePayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setIsSaving(true);
    try {
      const data = editModal.data;
      const earnings = Number(data.base_salary || 0) + Number(data.overtime_allowance || 0) + 
                       Number(data.position_allowance || 0) + Number(data.commuting_allowance || 0) + 
                       Number(data.housing_allowance || 0) + Number(data.special_allowance || 0);

      const deductions = Number(data.health_insurance || 0) + Number(data.nursing_insurance || 0) + 
                         Number(data.pension_insurance || 0) + Number(data.employment_insurance || 0) + 
                         Number(data.income_tax || 0) + Number(data.resident_tax || 0) + 
                         Number(data.other_deductions || 0);

      const net = earnings - deductions;

      const payload = {
        ...data,
        total_earnings: earnings,
        total_deductions: deductions,
        net_salary: net,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('payslips')
        .upsert(payload, { onConflict: 'tenant_id,user_id,year_month' });

      if (error) throw error;

      alert('給与明細を保存しました！');
      setEditModal({ isOpen: false, data: getInitialPayslipData('', '') });
      await fetchData();
    } catch (e: any) {
      alert('保存エラー: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 削除
  const handleDeletePayslip = async (id: string) => {
    if (!confirm('この給与明細を削除しますか？')) return;
    try {
      await supabase.from('payslips').delete().eq('id', id);
      await fetchData();
    } catch (e: any) {
      alert('削除エラー: ' + e.message);
    }
  };

  // 合計集計
  const totalGrossEarnings = payslips.reduce((sum, p) => sum + (p.total_earnings || 0), 0);
  const totalDeductions = payslips.reduce((sum, p) => sum + (p.total_deductions || 0), 0);
  const totalNetSalary = payslips.reduce((sum, p) => sum + (p.net_salary || 0), 0);
  const publishedCount = payslips.filter(p => p.status === 'published').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 上部ヘッダー & ナビゲーション */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Web給与明細管理</h1>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              従業員の月次給与明細の発行・打刻連携・Web公開・PDF出力
            </p>
          </div>
        </div>

        {/* 月切り替え */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white text-slate-600 rounded-lg transition cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-black text-slate-800 tracking-tight">
              {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月度 支給分
            </span>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-white text-slate-600 rounded-lg transition cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={handleCurrentMonth} className="ml-1 text-[11px] font-bold bg-white text-emerald-600 border border-slate-200 px-2 py-1 rounded-lg hover:bg-emerald-50 transition cursor-pointer">
              今月
            </button>
          </div>
        </div>
      </div>

      {/* 4大メトリクス サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-600" /> 対象従業員数
          </span>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-800">{payslips.length}</span>
            <span className="text-xs font-bold text-slate-400 ml-1">/ {employees.length} 名</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-blue-600" /> 総支給額 合計
          </span>
          <div className="mt-2 text-xl sm:text-2xl font-black text-blue-600">
            ¥{totalGrossEarnings.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-rose-600" /> 控除合計額
          </span>
          <div className="mt-2 text-xl sm:text-2xl font-black text-rose-600">
            ¥{totalDeductions.toLocaleString()}
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-md flex flex-col justify-between">
          <span className="text-xs font-bold text-emerald-100 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" /> 手取り支給総額
          </span>
          <div className="mt-2 text-xl sm:text-2xl font-black text-white">
            ¥{totalNetSalary.toLocaleString()}
          </div>
        </div>
      </div>

      {/* アクションバー */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setImportModal({ isOpen: true, rawText: '', parsedList: [] })}
            className="flex items-center gap-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-orange-600/20 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            📥 マネーフォワード給与データ取込
          </button>

          <button
            type="button"
            onClick={handleAutoGenerateFromAttendance}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
            打刻から自動計算
          </button>

          <button
            type="button"
            onClick={() => {
              if (employees.length === 0) return alert('先に従業員を登録してください');
              setEditModal({
                isOpen: true,
                data: getInitialPayslipData(employees[0].id, currentYearMonth)
              });
            }}
            className="flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            個別入力
          </button>
        </div>

        <div className="flex items-center gap-2">
          {publishedCount < payslips.length ? (
            <button
              type="button"
              onClick={() => handleBulkTogglePublish(true)}
              disabled={payslips.length === 0 || isSaving}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" />
              全員分を一括公開（Web公開）
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleBulkTogglePublish(false)}
              disabled={payslips.length === 0 || isSaving}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              一括非公開にする（下書きに戻す）
            </button>
          )}
        </div>
      </div>

      {/* 給与明細テーブル */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="text-xs font-bold text-slate-400">給与データを読み込み中...</span>
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <DollarSign className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-700 text-sm">
              {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月度の給与明細データがまだありません
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              「当月の打刻実績から明細を一括自動作成」ボタンを押すと、出勤日数・実働時間・残業時間を自動集計して下書きを作成できます。
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-black text-slate-600 uppercase">
                  <th className="p-4">従業員名</th>
                  <th className="p-4 text-center">出勤/実働</th>
                  <th className="p-4 text-right">総支給額</th>
                  <th className="p-4 text-right">控除合計</th>
                  <th className="p-4 text-right font-black text-emerald-700">差引支給額（手取り）</th>
                  <th className="p-4 text-center">公開状況</th>
                  <th className="p-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {payslips.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-slate-900">
                      <div>{p.user?.name || '不明'}</div>
                      <span className="text-[10px] text-slate-400 font-medium">{p.user?.department || '部署未設定'}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-bold text-slate-700">{p.work_days}日</span>
                      <span className="text-[11px] text-slate-400 block">{p.actual_hours}h（残業: {p.overtime_hours}h）</span>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-800">
                      ¥{p.total_earnings?.toLocaleString()}
                    </td>
                    <td className="p-4 text-right text-rose-600 font-bold">
                      -¥{p.total_deductions?.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-black text-sm text-emerald-600">
                      ¥{p.net_salary?.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      {p.status === 'published' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> 公開中
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-300">
                          下書き
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPreviewModal({ isOpen: true, payslip: p })}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                        title="明細書プレビュー・印刷"
                      >
                        <Eye className="w-3.5 h-3.5 inline mr-1" />
                        プレビュー
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditModal({ isOpen: true, data: p })}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 inline mr-1" />
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => p.id && handleDeletePayslip(p.id)}
                        className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 給与明細 編集・登録モーダル                                               */}
      {/* ========================================================================= */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white flex items-center justify-between rounded-t-2xl">
              <h3 className="font-black text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                給与明細の入力・編集（{editModal.data.year_month} 支給分）
              </h3>
              <button onClick={() => setEditModal({ isOpen: false, data: getInitialPayslipData('', '') })} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSavePayslip} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">対象従業員</label>
                  <select
                    value={editModal.data.user_id}
                    onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, user_id: e.target.value } })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold"
                    required
                  >
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name}（{e.department || '部署なし'}）</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">支給日</label>
                  <input
                    type="date"
                    value={editModal.data.payment_date}
                    onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, payment_date: e.target.value } })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">公開ステータス</label>
                  <select
                    value={editModal.data.status}
                    onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, status: e.target.value as any } })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold"
                  >
                    <option value="draft">⚪ 下書き（従業員には非公開）</option>
                    <option value="published">🟢 公開済（従業員が閲覧可能）</option>
                  </select>
                </div>
              </div>

              {/* 3ブロック分割（勤怠・支給・控除） */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. 勤怠の部 */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-xs text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" /> ① 勤怠の部
                  </h4>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">出勤日数（日）</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editModal.data.work_days}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, work_days: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">総実働時間（時間）</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editModal.data.actual_hours}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, actual_hours: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">残業時間（時間）</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editModal.data.overtime_hours}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, overtime_hours: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right font-bold text-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">有給消化日数（日）</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editModal.data.paid_leave_days}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, paid_leave_days: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right text-emerald-600 font-bold"
                    />
                  </div>
                </div>

                {/* 2. 支給の部 */}
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 space-y-3">
                  <h4 className="font-bold text-xs text-blue-900 border-b border-blue-200 pb-2 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-blue-600" /> ② 支給の部
                  </h4>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">基本給（円）</label>
                    <input
                      type="number"
                      value={editModal.data.base_salary}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, base_salary: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">残業手当（円）</label>
                    <input
                      type="number"
                      value={editModal.data.overtime_allowance}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, overtime_allowance: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">役職手当（円）</label>
                    <input
                      type="number"
                      value={editModal.data.position_allowance}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, position_allowance: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">通勤手当 / 非課税（円）</label>
                    <input
                      type="number"
                      value={editModal.data.commuting_allowance}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, commuting_allowance: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right"
                    />
                  </div>
                </div>

                {/* 3. 控除の部 */}
                <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200 space-y-3">
                  <h4 className="font-bold text-xs text-rose-900 border-b border-rose-200 pb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-rose-600" /> ③ 控除の部
                  </h4>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">健康保険（円）</label>
                    <input
                      type="number"
                      value={editModal.data.health_insurance}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, health_insurance: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">厚生年金（円）</label>
                    <input
                      type="number"
                      value={editModal.data.pension_insurance}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, pension_insurance: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">雇用保険（円）</label>
                    <input
                      type="number"
                      value={editModal.data.employment_insurance}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, employment_insurance: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">所得税（円）</label>
                    <input
                      type="number"
                      value={editModal.data.income_tax}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, income_tax: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">住民税（円）</label>
                    <input
                      type="number"
                      value={editModal.data.resident_tax}
                      onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, resident_tax: Number(e.target.value) } })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-right"
                    />
                  </div>
                </div>

              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">備考・社内連絡事項</label>
                <input
                  type="text"
                  value={editModal.data.note}
                  onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, note: e.target.value } })}
                  placeholder="例: 今月もお疲れ様でした。"
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setEditModal({ isOpen: false, data: getInitialPayslipData('', '') })}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md"
                >
                  {isSaving ? '保存中...' : '給与明細を保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 給与明細書 プレビュー & 印刷モーダル                                       */}
      {/* ========================================================================= */}
      {previewModal.isOpen && previewModal.payslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-200">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between rounded-t-2xl print:hidden">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-cyan-400" />
                給与明細書 プレビュー / 印刷
              </h3>
              <button onClick={() => setPreviewModal({ isOpen: false, payslip: null })} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-8 overflow-y-auto font-sans bg-slate-100/50 flex-1">
              <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden print:border-none print:shadow-none">
                <OfficialPayslipDoc
                  payslip={previewModal.payslip}
                  userName={previewModal.payslip.user?.name}
                  tenantName={tenantInfo?.name || '株式会社cocotte'}
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t flex justify-end gap-3 rounded-b-2xl print:hidden">
              <button
                type="button"
                onClick={() => setPreviewModal({ isOpen: false, payslip: null })}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                PDF保存 / 印刷
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* マネーフォワード給与 CSV/TSV インポートモーダル                            */}
      {/* ========================================================================= */}
      {importModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 animate-in zoom-in-95">
            
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-amber-700 p-5 text-white flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight flex items-center gap-2">
                    マネーフォワード給与データ インポート
                    <span className="bg-white/25 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      CSV / TSV 自動解析
                    </span>
                  </h3>
                  <p className="text-xs text-orange-100 font-medium">
                    マネーフォワード給与から出力したCSVファイルを読み込むか、テキストを貼り付けてください
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setImportModal({ isOpen: false, rawText: '', parsedList: [] })} 
                className="text-orange-200 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* モーダルコンテンツ */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* ファイル選択 & サンプル読み込み */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-orange-50/60 p-4 rounded-xl border border-orange-200">
                <div className="flex items-center gap-2">
                  <label className="bg-white hover:bg-orange-100 text-orange-800 border border-orange-300 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs transition">
                    <UploadCloud className="w-4 h-4 text-orange-600" />
                    CSVファイルを選択
                    <input 
                      type="file" 
                      accept=".csv,.tsv,.txt" 
                      onChange={handleImportFileChange}
                      className="hidden" 
                    />
                  </label>
                  <span className="text-xs text-slate-500">または下の枠に直接貼り付け</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const sampleText = `従業員番号\t従業員\t所属事業所\t部門\t職種\t契約種別\t出勤日数（平日）\t出勤日数（所定休日）\t出勤日数（法定休日）\t欠勤日数（平日）\t遅刻時間（平日）\t早退時間（平日）\t所定時間（平日）\t所定時間（所定休日）\t所定時間（法定休日）\t所定外時間（平日）\t所定外時間（所定休日）\t所定外時間（法定休日）\t法定外時間（平日）\t深夜所定時間（平日）\t深夜所定時間（所定休日）\t深夜所定時間（法定休日）\t深夜所定外時間（平日）\t深夜所定外時間（所定休日）\t深夜所定外時間（法定休日）\t深夜法定外時間（平日）\t深夜法定外時間（所定休日）\t深夜法定外時間（法定休日）\t有休取得日数\t有休残日数\t所定時間（所定休日）（内）\t法定外時間（平日）（内）\t深夜休憩時間（平日）（内）\t深夜（平日）（内）\t休憩時間（平日）（内）\t残業（平日）（内）\t所定時間（平日）（内）\t慶弔休暇残時間数\t慶弔休暇残日数\t慶弔休暇付与時間数\t慶弔休暇付与日数\t総労働時間\t慶弔休暇取得時間数\t残業（所定休日）（内）\t休憩時間（所定休日）（内）\t深夜（所定休日）（内）\t深夜休憩時間（所定休日）（内）\t法定外時間（所定休日）（内）\t所定時間（法定休日）（内）\t残業（法定休日）（内）\t休憩時間（法定休日）（内）\t深夜（法定休日）（内）\t深夜休憩時間（法定休日）（内）\t法定外時間（法定休日）（内）\t法定外時間（平日・所定休日）\t60時間超法定外時間（平日・所定休日）\t育児休業取得日数\t休暇みなし時間(所定)(平日)\t休暇みなし時間(所定外)(平日)\t休暇みなし時間(法定外)(平日)\t休暇みなし時間(所定)(所定休日)\t休暇みなし時間(所定外)(所定休日)\t休暇みなし時間(法定外)(所定休日)\t休暇みなし時間(所定)(法定休日)\t休暇みなし時間(所定外)(法定休日)\t休暇みなし時間(法定外)(法定休日)\t介護休業取得日数\t業務上の疾病による休業取得日数\t産前産後休業取得日数\t慶弔休暇取得日数\t介護休暇取得日数\t介護休暇取得時間数\t介護休暇付与日数\t介護休暇付与時間数\t介護休暇残日数\t介護休暇残時間数\t子の看護休暇取得日数\t子の看護休暇取得時間数\t子の看護休暇付与日数\t子の看護休暇付与時間数\t子の看護休暇残日数\t子の看護休暇残時間数\t役員報酬(支給)\t基本給(支給)\t役職手当(支給)\t家族手当(支給)\t住宅手当(支給)\t営業手当(支給)\t残業手当(支給)\t深夜残業手当(支給)\t法定休日手当(支給)\t所定休日手当(支給)\t通勤手当/課税(支給)\t通勤手当/非課(支給)\t立替経費(支給)\t特別手当(支給)\t未払給与分(支給)\t課税支給合計\t非課税支給合計\t課税現物支給合計\t非課税現物支給合計\t支給合計\t労保対象合計\t社保対象合計(金銭)\t社保対象合計(現物)\t社保対象通勤手当(金銭)\t社保対象通勤手当(現物)\t固定賃金合計\t役員報酬合計\t割増基礎合計\t控除基礎合計\t健康保険料(控除)\t介護保険料(控除)\t子ども・子育て支援金(控除)\t厚生年金保険料(控除)\t雇用保険料(控除)\t所得税(控除)\t住民税(控除)\t年調過不足税額(控除)\t社宅家賃(控除)\t社会保険料合計\t控除合計\t社保控除後合計\t差引支給合計\t現物支給額\t振込支給１\t振込支給２\t振込支給残額\t振込支給額合計\t現金支給額\t扶養人数\t税額表\t健保標準報酬\t厚年標準報酬\t健康保険料(会社)\t介護保険料(会社)\t子ども・子育て支援金(会社)\t厚生年金保険料(会社)\t子ども・子育て拠出金(会社)\t厚生年金基金掛金(会社)\t雇用保険料(会社)\t労災保険料(会社)\t一般拠出金(会社)
2\t駒井 秀一朗\t株式会社cocotte\t\t\t役員\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t169000\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t169000\t0\t0\t0\t169000\t0\t169000\t0\t0\t0\t169000\t169000\t0\t0\t8342\t1336\t244\t12424\t\t2220\t46900\t\t\t22346\t71466\t146654\t97534\t0\t0\t0\t97534\t97534\t0\t0\t甲\t320000\t320000\t0\t0\t0\t0\t1152\t0\t0\t0\t0`;
                    handleParseImportText(sampleText);
                  }}
                  className="text-xs bg-white hover:bg-orange-100 text-orange-900 border border-orange-300 font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  ⚡ 駒井様のサンプルデータを貼付
                </button>
              </div>

              {/* テキスト入力エリア */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CSV / TSV テキスト（貼り付け）
                </label>
                <textarea
                  value={importModal.rawText}
                  onChange={(e) => handleParseImportText(e.target.value)}
                  rows={6}
                  placeholder="マネーフォワード給与のCSVデータをここに貼り付けてください..."
                  className="w-full font-mono text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white bg-slate-50 leading-relaxed"
                />
              </div>

              {/* 解析結果プレビューテーブル */}
              {importModal.parsedList.length > 0 && (
                <div className="space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      解析成功：{importModal.parsedList.length} 名分の給与明細データ
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ※インポート実行時に自動で従業員・給与明細と紐付けます
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-600 font-black sticky top-0">
                        <tr>
                          <th className="p-2.5">CSV従業員名</th>
                          <th className="p-2.5">社内紐付け先</th>
                          <th className="p-2.5">区分</th>
                          <th className="p-2.5 text-right">総支給額</th>
                          <th className="p-2.5 text-right">社会保険料</th>
                          <th className="p-2.5 text-right">所得税・住民税</th>
                          <th className="p-2.5 text-right">控除合計</th>
                          <th className="p-2.5 text-right font-black text-emerald-700">差引手取り額</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {importModal.parsedList.map((item, idx) => {
                          const matched = employees.find(
                            e => e.name.replace(/\s+/g, '') === item.employeeName.replace(/\s+/g, '')
                          );
                          return (
                            <tr key={idx} className="hover:bg-orange-50/50">
                              <td className="p-2.5 font-bold text-slate-900">
                                {item.employeeName}
                                <span className="text-[10px] text-slate-400 block">No.{item.employeeNumber}</span>
                              </td>
                              <td className="p-2.5">
                                {matched ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    {matched.name}（一致）
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-300">
                                    <Plus className="w-3 h-3 text-blue-600" />
                                    新規ユーザー自動作成
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-500">{item.contractType || '社員'}</td>
                              <td className="p-2.5 text-right font-bold text-blue-700">¥{item.totalEarnings.toLocaleString()}</td>
                              <td className="p-2.5 text-right text-slate-600">¥{item.socialInsuranceTotal.toLocaleString()}</td>
                              <td className="p-2.5 text-right text-slate-600">¥{(item.incomeTax + item.residentTax).toLocaleString()}</td>
                              <td className="p-2.5 text-right text-rose-600 font-bold">-¥{item.totalDeductions.toLocaleString()}</td>
                              <td className="p-2.5 text-right font-black text-emerald-600">¥{item.netSalary.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* フッター */}
            <div className="bg-slate-50 p-4 border-t flex justify-between items-center rounded-b-2xl">
              <span className="text-xs text-slate-500 font-medium">
                対象月度: <strong>{currentYearMonth}</strong> 支給分として登録されます
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setImportModal({ isOpen: false, rawText: '', parsedList: [] })}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={importModal.parsedList.length === 0 || isSaving}
                  className="px-6 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-orange-600/20 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  給与明細を一括インポートする
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
