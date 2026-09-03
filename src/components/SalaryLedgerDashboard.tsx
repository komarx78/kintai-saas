import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, Users, DollarSign, 
  History, Plus, Download, Search, CheckCircle2, 
  Award, FileText, X, Loader2
} from 'lucide-react';
import type { EmployeePayrollProfile } from '../lib/payrollEngine';

interface SalaryLedgerDashboardProps {
  tenantId: string | null;
}

export interface SalaryRevisionRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  user_name?: string;
  department?: string;
  revision_date: string;
  applied_year_month: string;
  revision_type: string;
  previous_base_salary: number;
  new_base_salary: number;
  diff_base_salary: number;
  previous_total_allowance: number;
  new_total_allowance: number;
  previous_total_salary: number;
  new_total_salary: number;
  diff_total_salary: number;
  revision_rate: number;
  allowance_details?: any;
  reason_note?: string;
  approved_by?: string;
  created_at?: string;
}

export const REVISION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  regular: { label: '定期昇給', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  base_up: { label: 'ベースアップ', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  promotion: { label: '役職昇格', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  position: { label: '役職手当改定', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  qualification: { label: '資格取得手当', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  special: { label: '特別功労昇給', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  other: { label: 'その他給与改定', color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export const SalaryLedgerDashboard: React.FC<SalaryLedgerDashboardProps> = ({ tenantId }) => {
  const [activeTab, setActiveTab] = useState<'ledger' | 'history'>('ledger');
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrollProfiles, setPayrollProfiles] = useState<Record<string, EmployeePayrollProfile>>({});
  const [revisions, setRevisions] = useState<SalaryRevisionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 検索・フィルタ
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');

  // モーダル管理
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [selectedEmployeeForTimeline, setSelectedEmployeeForTimeline] = useState<any | null>(null);
  const [isSavingRevision, setIsSavingRevision] = useState(false);

  // 昇給登録フォームState
  const [formUserId, setFormUserId] = useState('');
  const [formRevisionDate, setFormRevisionDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [formRevisionType, setFormRevisionType] = useState('regular');
  const [formNewBaseSalary, setFormNewBaseSalary] = useState<number>(0);
  const [formPositionAllowance, setFormPositionAllowance] = useState<number>(0);
  const [formQualificationAllowance, setFormQualificationAllowance] = useState<number>(0);
  const [formHousingAllowance, setFormHousingAllowance] = useState<number>(0);
  const [formCommutingAllowance, setFormCommutingAllowance] = useState<number>(0);
  const [formFamilyAllowance, setFormFamilyAllowance] = useState<number>(0);
  const [formOtherAllowance, setFormOtherAllowance] = useState<number>(0);
  const [formReasonNote, setFormReasonNote] = useState('');
  const [formApprovedBy, setFormApprovedBy] = useState('');

  // 1. データ取得
  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // ユーザー一覧
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      // 在籍ステータス取得（退職者フラグ）
      let retiredUserIds = new Set<string>();
      try {
        const { data: onbData } = await supabase
          .from('employee_onboarding_profiles')
          .select('user_id, status')
          .eq('tenant_id', tenantId);
        if (onbData) {
          onbData.filter(o => o.status === 'retired').forEach(o => retiredUserIds.add(o.user_id));
        }
      } catch {}

      // 給与プロファイル取得
      let profilesMap: Record<string, EmployeePayrollProfile> = {};
      try {
        const { data: profData } = await supabase
          .from('employee_payroll_profiles')
          .select('*')
          .eq('tenant_id', tenantId);

        if (profData && profData.length > 0) {
          profData.forEach((p: any) => {
            profilesMap[p.user_id] = p;
          });
        }
      } catch (e) {
        console.warn('employee_payroll_profiles not found, using localStorage fallback');
      }

      // ローカルストレージフォールバック
      const savedProfiles = localStorage.getItem(`payroll_profiles_${tenantId}`);
      if (savedProfiles) {
        try {
          const parsed = JSON.parse(savedProfiles);
          profilesMap = { ...parsed, ...profilesMap };
        } catch {}
      }

      // 昇給履歴取得
      let revList: SalaryRevisionRecord[] = [];
      try {
        const { data: revData } = await supabase
          .from('salary_revision_history')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('revision_date', { ascending: false });

        if (revData) {
          revList = revData;
        }
      } catch (e) {
        console.warn('salary_revision_history fetch error:', e);
      }

      // ローカルストレージフォールバック（履歴）
      const savedRev = localStorage.getItem(`salary_revisions_${tenantId}`);
      if (savedRev) {
        try {
          const parsedRev = JSON.parse(savedRev);
          const existingIds = new Set(revList.map(r => r.id));
          parsedRev.forEach((r: any) => {
            if (!existingIds.has(r.id)) revList.push(r);
          });
        } catch {}
      }

      const activeUsers = (usersData || []).map(u => ({
        ...u,
        is_retired: retiredUserIds.has(u.id) || u.status === 'retired'
      }));

      setEmployees(activeUsers);
      setPayrollProfiles(profilesMap);
      setRevisions(revList);
    } catch (err) {
      console.error('Fetch salary ledger error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  // 各社員の直近昇給レコードマップ
  const latestRevisionByUser = useMemo(() => {
    const map: Record<string, SalaryRevisionRecord> = {};
    revisions.forEach(r => {
      if (!map[r.user_id] || new Date(r.revision_date) > new Date(map[r.user_id].revision_date)) {
        map[r.user_id] = r;
      }
    });
    return map;
  }, [revisions]);

  // 部署リスト
  const departments = useMemo(() => {
    const deps = new Set<string>();
    employees.forEach(e => {
      if (e.department && e.department !== '-') deps.add(e.department);
    });
    return Array.from(deps);
  }, [employees]);

  // 全社サマリー指標
  const summaryMetrics = useMemo(() => {
    const active = employees.filter(e => !e.is_retired);
    if (active.length === 0) {
      return { totalMonthlySalary: 0, avgBaseSalary: 0, revisedCountPastYear: 0, avgDiffAmount: 0, avgRate: 0 };
    }

    let totalSalarySum = 0;
    let totalBaseSum = 0;

    active.forEach(e => {
      const p = payrollProfiles[e.id];
      const base = p?.base_salary || 250000;
      const allowances = (p?.position_allowance || 0) + (p?.qualification_allowance || 0) + 
                         (p?.housing_allowance || 0) + (p?.commuting_allowance || 0) + 
                         (p?.family_allowance || 0) + (p?.special_allowance || 0);
      totalBaseSum += base;
      totalSalarySum += (base + allowances);
    });

    // 直近1年の昇給実績
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const pastYearRevisions = revisions.filter(r => new Date(r.revision_date) >= oneYearAgo);
    const revisedUsers = new Set(pastYearRevisions.map(r => r.user_id));
    const totalDiff = pastYearRevisions.reduce((acc, r) => acc + (r.diff_base_salary || 0), 0);
    const avgDiff = pastYearRevisions.length > 0 ? Math.round(totalDiff / pastYearRevisions.length) : 0;
    const totalRate = pastYearRevisions.reduce((acc, r) => acc + (r.revision_rate || 0), 0);
    const avgRate = pastYearRevisions.length > 0 ? parseFloat((totalRate / pastYearRevisions.length).toFixed(1)) : 0;

    return {
      totalMonthlySalary: totalSalarySum,
      avgBaseSalary: Math.round(totalBaseSum / active.length),
      revisedCountPastYear: revisedUsers.size,
      avgDiffAmount: avgDiff,
      avgRate
    };
  }, [employees, payrollProfiles, revisions]);

  // フィルタ済み社員リスト
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (e.is_retired) return false;
      const matchSearch = e.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDept = selectedDepartment === 'ALL' || e.department === selectedDepartment;
      return matchSearch && matchDept;
    });
  }, [employees, searchTerm, selectedDepartment]);

  // 昇給登録モーダルを開く
  const handleOpenRevisionModal = (emp?: any) => {
    const target = emp || employees.find(e => !e.is_retired);
    if (!target) return;

    setFormUserId(target.id);
    const p = payrollProfiles[target.id];
    const currentBase = p?.base_salary || 250000;
    setFormNewBaseSalary(currentBase);
    setFormPositionAllowance(p?.position_allowance || 0);
    setFormQualificationAllowance(p?.qualification_allowance || 0);
    setFormHousingAllowance(p?.housing_allowance || 0);
    setFormCommutingAllowance(p?.commuting_allowance || 0);
    setFormFamilyAllowance(p?.family_allowance || 0);
    setFormOtherAllowance(p?.special_allowance || 0);
    setFormRevisionType('regular');
    setFormReasonNote('');
    setFormApprovedBy('');
    setIsRevisionModalOpen(true);
  };

  // 選択社員変更時
  const handleSelectUserChange = (userId: string) => {
    setFormUserId(userId);
    const p = payrollProfiles[userId];
    const currentBase = p?.base_salary || 250000;
    setFormNewBaseSalary(currentBase);
    setFormPositionAllowance(p?.position_allowance || 0);
    setFormQualificationAllowance(p?.qualification_allowance || 0);
    setFormHousingAllowance(p?.housing_allowance || 0);
    setFormCommutingAllowance(p?.commuting_allowance || 0);
    setFormFamilyAllowance(p?.family_allowance || 0);
    setFormOtherAllowance(p?.special_allowance || 0);
  };

  // 現在選択中の社員プロファイル
  const currentTargetProfile = useMemo(() => {
    if (!formUserId) return null;
    return payrollProfiles[formUserId] || { base_salary: 250000 };
  }, [formUserId, payrollProfiles]);

  const currentBase = currentTargetProfile?.base_salary || 250000;
  const prevAllowances = (currentTargetProfile?.position_allowance || 0) + 
                         (currentTargetProfile?.qualification_allowance || 0) + 
                         (currentTargetProfile?.housing_allowance || 0) + 
                         (currentTargetProfile?.commuting_allowance || 0) + 
                         (currentTargetProfile?.family_allowance || 0) + 
                         (currentTargetProfile?.special_allowance || 0);
  const prevTotal = currentBase + prevAllowances;

  const newAllowances = formPositionAllowance + formQualificationAllowance + 
                        formHousingAllowance + formCommutingAllowance + 
                        formFamilyAllowance + formOtherAllowance;
  const newTotal = formNewBaseSalary + newAllowances;

  const diffBase = formNewBaseSalary - currentBase;
  const diffTotal = newTotal - prevTotal;
  const revisionRate = currentBase > 0 ? parseFloat(((diffBase / currentBase) * 100).toFixed(2)) : 0;

  // 昇給保存処理
  const handleSaveRevision = async () => {
    if (!tenantId || !formUserId) return;
    if (formNewBaseSalary <= 0) {
      alert('改定後の基本給を入力してください。');
      return;
    }

    setIsSavingRevision(true);
    try {
      const targetUser = employees.find(e => e.id === formUserId);
      const appliedYearMonth = formRevisionDate.slice(0, 7);

      const revisionPayload = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        user_id: formUserId,
        user_name: targetUser?.name || '未設定',
        department: targetUser?.department || '-',
        revision_date: formRevisionDate,
        applied_year_month: appliedYearMonth,
        revision_type: formRevisionType,
        previous_base_salary: currentBase,
        new_base_salary: formNewBaseSalary,
        diff_base_salary: diffBase,
        previous_total_allowance: prevAllowances,
        new_total_allowance: newAllowances,
        previous_total_salary: prevTotal,
        new_total_salary: newTotal,
        diff_total_salary: diffTotal,
        revision_rate: revisionRate,
        allowance_details: {
          position: formPositionAllowance,
          qualification: formQualificationAllowance,
          housing: formHousingAllowance,
          commuting: formCommutingAllowance,
          family: formFamilyAllowance,
          other: formOtherAllowance
        },
        reason_note: formReasonNote,
        approved_by: formApprovedBy || '管理者',
        created_at: new Date().toISOString()
      };

      // 1. 昇給履歴テーブルにINSERT
      try {
        const { error: revErr } = await supabase
          .from('salary_revision_history')
          .insert([revisionPayload]);
        if (revErr) console.warn('DB insert salary_revision_history notice:', revErr.message);
      } catch (e) {
        console.warn('DB error, using local fallback:', e);
      }

      // ローカルストレージに履歴保存
      const updatedRevList = [revisionPayload, ...revisions];
      setRevisions(updatedRevList);
      localStorage.setItem(`salary_revisions_${tenantId}`, JSON.stringify(updatedRevList));

      // 2. 大元マスタ（employee_payroll_profiles）の基本給・手当を自動UPDATE (SSOT遵守)
      const updatedProfile: EmployeePayrollProfile = {
        salary_type: currentTargetProfile?.salary_type || 'monthly',
        hourly_wage: currentTargetProfile?.hourly_wage || 0,
        fixed_overtime_hours: currentTargetProfile?.fixed_overtime_hours || 0,
        fixed_overtime_allowance: currentTargetProfile?.fixed_overtime_allowance || 0,
        dependents_count: currentTargetProfile?.dependents_count || 0,
        health_insurance_enabled: currentTargetProfile?.health_insurance_enabled ?? true,
        pension_insurance_enabled: currentTargetProfile?.pension_insurance_enabled ?? true,
        employment_insurance_enabled: currentTargetProfile?.employment_insurance_enabled ?? true,
        resident_tax_monthly: currentTargetProfile?.resident_tax_monthly || 0,
        tax_bracket: currentTargetProfile?.tax_bracket || 'kou',
        commuting_taxable: currentTargetProfile?.commuting_taxable ?? false,
        ...(currentTargetProfile || {}),
        user_id: formUserId,
        tenant_id: tenantId,
        base_salary: formNewBaseSalary,
        position_allowance: formPositionAllowance,
        qualification_allowance: formQualificationAllowance,
        housing_allowance: formHousingAllowance,
        commuting_allowance: formCommutingAllowance,
        family_allowance: formFamilyAllowance,
        special_allowance: formOtherAllowance
      };

      try {
        await supabase
          .from('employee_payroll_profiles')
          .upsert(updatedProfile, { onConflict: 'tenant_id,user_id' });
      } catch (e) {
        console.warn('Profile DB upsert notice:', e);
      }

      // ローカルストレージプロファイルも更新
      const updatedProfiles = { ...payrollProfiles, [formUserId]: updatedProfile };
      setPayrollProfiles(updatedProfiles);
      localStorage.setItem(`payroll_profiles_${tenantId}`, JSON.stringify(updatedProfiles));

      setIsRevisionModalOpen(false);
      alert(`🎉 ${targetUser?.name} さんの給与改定（${diffBase >= 0 ? '+' : ''}¥${diffBase.toLocaleString()}）を保存しました！\n昇給履歴を記録し、大元の給与マスタへ即時反映いたしました。`);
    } catch (err: any) {
      console.error(err);
      alert('昇給の保存に失敗しました: ' + err.message);
    } finally {
      setIsSavingRevision(false);
    }
  };

  // CSVダウンロード
  const handleExportCsv = () => {
    const headers = [
      '社員ID', '氏名', '部署', '役職', '雇用形態', 
      '基本給(円)', '役職手当(円)', '資格手当(円)', '住宅手当(円)', '通勤手当(円)', '家族手当(円)', 'その他手当(円)', 
      '総支給月給(円)', '直近昇給日', '直近昇給額(円)', '直近昇給率(%)', '直近昇給種別'
    ];

    const rows = filteredEmployees.map(emp => {
      const p = payrollProfiles[emp.id];
      const base = p?.base_salary || 250000;
      const pos = p?.position_allowance || 0;
      const qual = p?.qualification_allowance || 0;
      const house = p?.housing_allowance || 0;
      const com = p?.commuting_allowance || 0;
      const fam = p?.family_allowance || 0;
      const oth = p?.special_allowance || 0;
      const total = base + pos + qual + house + com + fam + oth;

      const latest = latestRevisionByUser[emp.id];

      return [
        emp.id,
        emp.name,
        emp.department || '-',
        emp.role || '一般',
        emp.employment_type === 'part-time' ? 'パート' : '正社員',
        base,
        pos,
        qual,
        house,
        com,
        fam,
        oth,
        total,
        latest?.revision_date || '-',
        latest?.diff_base_salary ? (latest.diff_base_salary > 0 ? `+${latest.diff_base_salary}` : latest.diff_base_salary) : '-',
        latest?.revision_rate ? `${latest.revision_rate}%` : '-',
        latest?.revision_type ? (REVISION_TYPE_LABELS[latest.revision_type]?.label || latest.revision_type) : '-'
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `全社給与一覧台帳_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500">社員給与台帳 ＆ 昇給履歴を照会中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 🌟 1. ヘッダーサマリー指標カード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400">全社月間総人件費（総支給計）</span>
            <p className="text-2xl font-black text-slate-900 mt-1 font-mono">
              ¥{summaryMetrics.totalMonthlySalary.toLocaleString()}
            </p>
            <span className="text-[11px] text-slate-400 font-medium">在籍 {employees.filter(e => !e.is_retired).length} 名分</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400">平均基本給（月額）</span>
            <p className="text-2xl font-black text-indigo-600 mt-1 font-mono">
              ¥{summaryMetrics.avgBaseSalary.toLocaleString()}
            </p>
            <span className="text-[11px] text-indigo-500 font-bold">各種諸手当を除く基礎額</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400">年間昇給実績人数</span>
            <p className="text-2xl font-black text-emerald-600 mt-1 font-mono">
              {summaryMetrics.revisedCountPastYear} <span className="text-xs font-normal text-slate-500">名</span>
            </p>
            <span className="text-[11px] text-emerald-600 font-bold">直近1年以内の昇給対象者</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400">直近平均昇給額 / 率</span>
            <p className="text-2xl font-black text-purple-600 mt-1 font-mono">
              +¥{summaryMetrics.avgDiffAmount.toLocaleString()}
            </p>
            <span className="text-[11px] font-bold text-purple-600">平均賃上げ率 +{summaryMetrics.avgRate}%</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 🌟 2. メイン台帳コントロールバー */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* タブ切り替え */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ledger'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            全社員給与一覧台帳
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4 text-indigo-600" />
            全社昇給履歴ログ ({revisions.length}件)
          </button>
        </div>

        {/* 検索・絞り込み ＆ アクション */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="社員名・メールで検索..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {departments.length > 0 && (
            <select
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="ALL">全すべての部署</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleExportCsv}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            title="CSV形式で給与台帳をダウンロード"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>

          <button
            onClick={() => handleOpenRevisionModal()}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4" />
            昇給・給与改定を登録
          </button>
        </div>
      </div>

      {/* 🌟 3. タブ①：全社員給与一覧台帳 */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">社員氏名</th>
                  <th className="py-3 px-4">部署 / 役職</th>
                  <th className="py-3 px-4 text-right">基本給</th>
                  <th className="py-3 px-4 text-right">各種手当計</th>
                  <th className="py-3 px-4 text-right">総支給月給</th>
                  <th className="py-3 px-4">直近の昇給実績</th>
                  <th className="py-3 px-4 text-center">操作・履歴</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map(emp => {
                  const p = payrollProfiles[emp.id];
                  const base = p?.base_salary || 250000;
                  const pos = p?.position_allowance || 0;
                  const qual = p?.qualification_allowance || 0;
                  const house = p?.housing_allowance || 0;
                  const com = p?.commuting_allowance || 0;
                  const fam = p?.family_allowance || 0;
                  const oth = p?.special_allowance || 0;
                  const allowances = pos + qual + house + com + fam + oth;
                  const total = base + allowances;

                  const latestRev = latestRevisionByUser[emp.id];
                  const empRevs = revisions.filter(r => r.user_id === emp.id);

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                      {/* 氏名 */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          {emp.name}
                          <span className="text-[10px] font-normal px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {emp.employment_type === 'part-time' ? 'パート' : '正社員'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">{emp.email}</div>
                      </td>

                      {/* 部署 / 役職 */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-700">{emp.department || '-'}</div>
                        <div className="text-[11px] text-slate-400">{emp.role === 'admin' ? '管理者' : '一般'}</div>
                      </td>

                      {/* 基本給 */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        ¥{base.toLocaleString()}
                      </td>

                      {/* 手当計 */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        ¥{allowances.toLocaleString()}
                        {allowances > 0 && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            {[
                              pos > 0 ? `役職¥${pos.toLocaleString()}` : '',
                              qual > 0 ? `資格¥${qual.toLocaleString()}` : '',
                              house > 0 ? `住宅¥${house.toLocaleString()}` : '',
                              com > 0 ? `通勤¥${com.toLocaleString()}` : ''
                            ].filter(Boolean).slice(0, 2).join(' / ')}
                          </div>
                        )}
                      </td>

                      {/* 総支給月給 */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                        ¥{total.toLocaleString()}
                      </td>

                      {/* 直近の昇給実績 */}
                      <td className="py-3.5 px-4">
                        {latestRev ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${REVISION_TYPE_LABELS[latestRev.revision_type]?.color || 'bg-slate-100 text-slate-700'}`}>
                                {REVISION_TYPE_LABELS[latestRev.revision_type]?.label || latestRev.revision_type}
                              </span>
                              <span className="font-mono font-black text-xs text-emerald-600">
                                {latestRev.diff_base_salary >= 0 ? '+' : ''}¥{latestRev.diff_base_salary.toLocaleString()}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                                +{latestRev.revision_rate}%
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              適用日: {latestRev.revision_date}
                              {latestRev.reason_note && `（${latestRev.reason_note}）`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">改定履歴なし</span>
                        )}
                      </td>

                      {/* 操作 */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenRevisionModal(emp)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 transition text-[11px] cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="この社員の給与改定・昇給を登録"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            昇給登録
                          </button>
                          <button
                            onClick={() => setSelectedEmployeeForTimeline(emp)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px] cursor-pointer flex items-center gap-1"
                            title="昇給の過去履歴タイムラインを表示"
                          >
                            <History className="w-3.5 h-3.5" />
                            履歴 ({empRevs.length})
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🌟 4. タブ②：全社昇給履歴タイムラインログ */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                全社給与改定・昇給履歴ログ
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                過去に実施されたすべての昇給・ベースアップ・役職昇格の記録です（改定額・改定理由を完全保持）。
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">計 {revisions.length} 件</span>
          </div>

          {revisions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <History className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-bold">まだ昇給・給与改定の履歴が登録されていません。</p>
              <button
                onClick={() => handleOpenRevisionModal()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
              >
                最初の昇給を登録する
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {revisions.map(rev => (
                <div key={rev.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/50 p-2 rounded-xl transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {rev.revision_date}
                      </span>
                      <span className="font-bold text-sm text-slate-900">
                        {rev.user_name || employees.find(e => e.id === rev.user_id)?.name || '従業員'}
                      </span>
                      <span className="text-xs text-slate-400">({rev.department || '-'})</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${REVISION_TYPE_LABELS[rev.revision_type]?.color || 'bg-slate-100'}`}>
                        {REVISION_TYPE_LABELS[rev.revision_type]?.label || rev.revision_type}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-2">
                      <span className="font-mono text-slate-400 line-through">¥{rev.previous_base_salary.toLocaleString()}</span>
                      <span className="text-slate-400">➔</span>
                      <span className="font-mono font-bold text-slate-900">¥{rev.new_base_salary.toLocaleString()}</span>
                      <span className="font-mono font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {rev.diff_base_salary >= 0 ? '+' : ''}¥{rev.diff_base_salary.toLocaleString()} ({rev.diff_base_salary >= 0 ? '+' : ''}{rev.revision_rate}%)
                      </span>
                    </div>

                    {rev.reason_note && (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                        💡 <strong>改定理由:</strong> {rev.reason_note}
                        {rev.approved_by && <span className="ml-2 text-slate-400">（承認: {rev.approved_by}）</span>}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-slate-400">総支給額の推移</span>
                    <p className="font-mono font-black text-sm text-slate-800">
                      ¥{rev.new_total_salary.toLocaleString()}
                    </p>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold">
                      差額 {rev.diff_total_salary >= 0 ? '+' : ''}¥{rev.diff_total_salary.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🌟 5. 昇給・給与改定 登録モーダル */}
      {isRevisionModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="font-black text-base text-slate-900">昇給・給与改定の登録</h3>
              </div>
              <button
                onClick={() => setIsRevisionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 対象社員 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">対象従業員</label>
                <select
                  value={formUserId}
                  onChange={e => handleSelectUserChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  {employees.filter(e => !e.is_retired).map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department || '所属なし'} / 現在の基本給: ¥{(payrollProfiles[emp.id]?.base_salary || 250000).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* 改定日 ＆ 改定種別 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">改定適用日</label>
                  <input
                    type="date"
                    value={formRevisionDate}
                    onChange={e => setFormRevisionDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">改定種別</label>
                  <select
                    value={formRevisionType}
                    onChange={e => setFormRevisionType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {Object.entries(REVISION_TYPE_LABELS).map(([key, info]) => (
                      <option key={key} value={key}>{info.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 💰 基本給の改定（リアルタイム差額計算） */}
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950">基本給（月額）の改定</span>
                  <span className="text-[11px] font-mono text-slate-500">
                    現在額: ¥{currentBase.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">改定後の新しい基本給 (円)</label>
                    <input
                      type="number"
                      value={formNewBaseSalary}
                      onChange={e => setFormNewBaseSalary(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-emerald-400 rounded-xl text-sm font-mono font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  {/* リアルタイム昇給シミュレーション */}
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500">昇給額（差額）</span>
                    <p className="text-base font-black font-mono text-emerald-600">
                      {diffBase >= 0 ? '+' : ''}¥{diffBase.toLocaleString()}
                    </p>
                    <span className="text-[10px] font-bold text-emerald-700">
                      上昇率: {diffBase >= 0 ? '+' : ''}{revisionRate}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 各種手当の調整（アコーディオン的） */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-black text-slate-700 block">
                  各種手当の改定・調整（必要な場合のみ）
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-500">役職手当</label>
                    <input
                      type="number"
                      value={formPositionAllowance}
                      onChange={e => setFormPositionAllowance(Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">資格手当</label>
                    <input
                      type="number"
                      value={formQualificationAllowance}
                      onChange={e => setFormQualificationAllowance(Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">住宅手当</label>
                    <input
                      type="number"
                      value={formHousingAllowance}
                      onChange={e => setFormHousingAllowance(Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">通勤手当</label>
                    <input
                      type="number"
                      value={formCommutingAllowance}
                      onChange={e => setFormCommutingAllowance(Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">家族手当</label>
                    <input
                      type="number"
                      value={formFamilyAllowance}
                      onChange={e => setFormFamilyAllowance(Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">その他手当</label>
                    <input
                      type="number"
                      value={formOtherAllowance}
                      onChange={e => setFormOtherAllowance(Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-bold text-slate-700">
                  <span>改定後 総支給月給:</span>
                  <span className="font-mono text-emerald-600 text-sm">¥{newTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* 理由 ＆ 承認者 */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">改定理由・人事考課メモ</label>
                  <input
                    type="text"
                    placeholder="例: 2026年度春季定期昇給（S評価）、主任昇格に伴う増額"
                    value={formReasonNote}
                    onChange={e => setFormReasonNote(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">決裁者・承認者</label>
                  <input
                    type="text"
                    placeholder="例: 代表取締役、人事部長"
                    value={formApprovedBy}
                    onChange={e => setFormApprovedBy(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRevisionModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveRevision}
                disabled={isSavingRevision}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingRevision ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                昇給を保存・大元マスタへ即時反映
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 6. 社員個別 昇給履歴タイムライン モーダル */}
      {selectedEmployeeForTimeline && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 border border-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  昇給履歴タイムライン: {selectedEmployeeForTimeline.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedEmployeeForTimeline.department || '所属なし'} / 現在の基本給: ¥{(payrollProfiles[selectedEmployeeForTimeline.id]?.base_salary || 250000).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedEmployeeForTimeline(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const empRevs = revisions.filter(r => r.user_id === selectedEmployeeForTimeline.id);
              if (empRevs.length === 0) {
                return (
                  <div className="py-8 text-center text-slate-400 space-y-2">
                    <p className="text-xs font-bold">まだこの社員の昇給改定履歴はありません。</p>
                    <button
                      onClick={() => {
                        setSelectedEmployeeForTimeline(null);
                        handleOpenRevisionModal(selectedEmployeeForTimeline);
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                    >
                      昇給を登録する
                    </button>
                  </div>
                );
              }

              return (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {empRevs.map(rev => (
                    <div key={rev.id} className="relative">
                      {/* タイムラインの丸ポチ */}
                      <span className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-xs ring-2 ring-emerald-100" />
                      
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {rev.revision_date}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${REVISION_TYPE_LABELS[rev.revision_type]?.color || 'bg-slate-100'}`}>
                            {REVISION_TYPE_LABELS[rev.revision_type]?.label || rev.revision_type}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                          <div className="text-xs">
                            <span className="text-slate-400 line-through mr-1.5">¥{rev.previous_base_salary.toLocaleString()}</span>
                            <span className="text-slate-400 mr-1.5">➔</span>
                            <span className="font-mono font-bold text-slate-900 text-sm">¥{rev.new_base_salary.toLocaleString()}</span>
                          </div>
                          <span className="font-mono font-black text-emerald-600 text-sm">
                            {rev.diff_base_salary >= 0 ? '+' : ''}¥{rev.diff_base_salary.toLocaleString()} (+{rev.revision_rate}%)
                          </span>
                        </div>

                        {rev.reason_note && (
                          <p className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                            💡 {rev.reason_note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <button
                onClick={() => {
                  const emp = selectedEmployeeForTimeline;
                  setSelectedEmployeeForTimeline(null);
                  handleOpenRevisionModal(emp);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                新しい昇給を登録
              </button>
              <button
                onClick={() => setSelectedEmployeeForTimeline(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
