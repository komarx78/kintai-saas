import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, DollarSign, 
  History, Plus, Download, Search, CheckCircle2, 
  FileText, X, Loader2, LayoutGrid, Table, 
  Building2, Sparkles, Save, Printer
} from 'lucide-react';
import type { EmployeePayrollProfile } from '../lib/payrollEngine';
import { 
  getRevisionContracts, 
  addOrUpdateRevisionContract, 
  type RevisionContractDoc 
} from '../lib/revisionContracts';
import { OfficialLaborContractDoc, type LaborContractData } from './OfficialLaborContractDoc';
import { getLaborContractTemplateFromStorage } from '../lib/laborContractTemplate';

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

// エクセル風編集用の一時データ型
interface BatchEditItem {
  userId: string;
  name: string;
  department: string;
  role: string;
  employmentType: string;
  currentBase: number;
  newBase: number;
  positionAllowance: number;
  qualificationAllowance: number;
  housingAllowance: number;
  commutingAllowance: number;
  familyAllowance: number;
  otherAllowance: number;
  revisionType: string;
  reasonNote: string;
  isModified: boolean;
}

export const SalaryLedgerDashboard: React.FC<SalaryLedgerDashboardProps> = ({ tenantId }) => {
  // 表示ビューモード: 'matrix'(社員名上部・横スクロール) | 'batch'(エクセル風一括編集) | 'ledger'(縦一覧) | 'history'(全社ログ)
  const [viewMode, setViewMode] = useState<'matrix' | 'batch' | 'ledger' | 'history'>('matrix');

  const [employees, setEmployees] = useState<any[]>([]);
  const [payrollProfiles, setPayrollProfiles] = useState<Record<string, EmployeePayrollProfile>>({});
  const [revisions, setRevisions] = useState<SalaryRevisionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 検索・絞り込み
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');

  // モーダル管理（個別）
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [selectedEmployeeForTimeline, setSelectedEmployeeForTimeline] = useState<any | null>(null);
  const [isSavingRevision, setIsSavingRevision] = useState(false);

  // 個別昇給登録フォームState（昇給適用月を主軸に！）
  const [formUserId, setFormUserId] = useState('');
  const [formAppliedYearMonth, setFormAppliedYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [formRevisionDate, setFormRevisionDate] = useState(() => new Date().toISOString().split('T')[0]);
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
  const [autoGenerateContract, setAutoGenerateContract] = useState(true);

  // 📝 エクセル風一括編集用のローカルステート（昇給適用月を主軸に！）
  const [batchData, setBatchData] = useState<Record<string, BatchEditItem>>({});
  const [batchAppliedYearMonth, setBatchAppliedYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [batchRevisionDate, setBatchRevisionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // 📄 労働条件通知書（賃金改定版）State
  const [revisionContracts, setRevisionContracts] = useState<RevisionContractDoc[]>([]);
  const [previewContractDoc, setPreviewContractDoc] = useState<RevisionContractDoc | null>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);

  // 一括シミュレーション用State
  const [simAmount, setSimAmount] = useState<number>(5000);
  const [simPercent, setSimPercent] = useState<number>(3.0);
  const [simTargetDept, setSimTargetDept] = useState<string>('ALL');

  // 1. データ取得
  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

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

      const savedProfiles = localStorage.getItem(`payroll_profiles_${tenantId}`);
      if (savedProfiles) {
        try {
          const parsed = JSON.parse(savedProfiles);
          profilesMap = { ...parsed, ...profilesMap };
        } catch {}
      }

      let revList: SalaryRevisionRecord[] = [];
      try {
        const { data: revData } = await supabase
          .from('salary_revision_history')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('revision_date', { ascending: false });

        if (revData) revList = revData;
      } catch (e) {
        console.warn('salary_revision_history fetch error:', e);
      }

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

      // 労働条件通知書（改定版）リスト取得
      const contracts = getRevisionContracts(tenantId);
      setRevisionContracts(contracts);

      // 会社基本情報取得
      try {
        const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
        const { data: cmsData } = await supabase.from('company_master_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
        setCompanySettings({ ...tData, ...cmsData });
      } catch (e) {}

      // エクセル風バッチ編集ステートの初期化
      const initialBatch: Record<string, BatchEditItem> = {};
      activeUsers.filter(u => !u.is_retired).forEach(u => {
        const p = profilesMap[u.id];
        const base = p?.base_salary || 250000;
        initialBatch[u.id] = {
          userId: u.id,
          name: u.name,
          department: u.department || '-',
          role: u.role || '一般',
          employmentType: u.employment_type === 'part-time' ? 'パート' : '正社員',
          currentBase: base,
          newBase: base,
          positionAllowance: p?.position_allowance || 0,
          qualificationAllowance: p?.qualification_allowance || 0,
          housingAllowance: p?.housing_allowance || 0,
          commutingAllowance: p?.commuting_allowance || 0,
          familyAllowance: p?.family_allowance || 0,
          otherAllowance: p?.special_allowance || 0,
          revisionType: 'regular',
          reasonNote: '',
          isModified: false
        };
      });
      setBatchData(initialBatch);

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

  // 部署一覧
  const departments = useMemo(() => {
    const deps = new Set<string>();
    employees.forEach(e => {
      if (e.department && e.department !== '-') deps.add(e.department);
    });
    return Array.from(deps);
  }, [employees]);

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

  // 🏢 部署別 昇給・人件費インパクト分析（エクセル編集中の値とリアルタイム連動！）
  const departmentAnalytics = useMemo(() => {
    const active = employees.filter(e => !e.is_retired);
    const map: Record<string, {
      dept: string;
      count: number;
      prevTotalSalary: number;
      newTotalSalary: number;
      diffSalary: number;
      diffBase: number;
      revisedCount: number;
    }> = {};

    // 全社計
    map['__ALL__'] = {
      dept: '全社合計',
      count: 0,
      prevTotalSalary: 0,
      newTotalSalary: 0,
      diffSalary: 0,
      diffBase: 0,
      revisedCount: 0
    };

    active.forEach(e => {
      const deptName = e.department && e.department !== '-' ? e.department : '未配属';
      if (!map[deptName]) {
        map[deptName] = {
          dept: deptName,
          count: 0,
          prevTotalSalary: 0,
          newTotalSalary: 0,
          diffSalary: 0,
          diffBase: 0,
          revisedCount: 0
        };
      }

      const b = batchData[e.id];
      const p = payrollProfiles[e.id];
      const prevBase = b ? b.currentBase : (p?.base_salary || 250000);
      const newBase = b ? b.newBase : prevBase;
      const prevAllowances = (p?.position_allowance || 0) + (p?.qualification_allowance || 0) + 
                             (p?.housing_allowance || 0) + (p?.commuting_allowance || 0) + 
                             (p?.family_allowance || 0) + (p?.special_allowance || 0);
      const newAllowances = b 
        ? (b.positionAllowance + b.qualificationAllowance + b.housingAllowance + b.commutingAllowance + b.familyAllowance + b.otherAllowance)
        : prevAllowances;

      const prevTotal = prevBase + prevAllowances;
      const newTotal = newBase + newAllowances;
      const dTotal = newTotal - prevTotal;
      const dBase = newBase - prevBase;
      const isRevised = dBase !== 0 || dTotal !== 0;

      // 部署加算
      map[deptName].count += 1;
      map[deptName].prevTotalSalary += prevTotal;
      map[deptName].newTotalSalary += newTotal;
      map[deptName].diffSalary += dTotal;
      map[deptName].diffBase += dBase;
      if (isRevised) map[deptName].revisedCount += 1;

      // 全社加算
      map['__ALL__'].count += 1;
      map['__ALL__'].prevTotalSalary += prevTotal;
      map['__ALL__'].newTotalSalary += newTotal;
      map['__ALL__'].diffSalary += dTotal;
      map['__ALL__'].diffBase += dBase;
      if (isRevised) map['__ALL__'].revisedCount += 1;
    });

    return Object.values(map);
  }, [employees, batchData, payrollProfiles]);

  // 一括編集の変更ハンドラ
  const handleBatchFieldChange = (userId: string, field: keyof BatchEditItem, val: any) => {
    setBatchData(prev => {
      const item = prev[userId];
      if (!item) return prev;
      const updated = { ...item, [field]: val };
      const isModified = updated.newBase !== updated.currentBase ||
                         updated.positionAllowance !== (payrollProfiles[userId]?.position_allowance || 0) ||
                         updated.qualificationAllowance !== (payrollProfiles[userId]?.qualification_allowance || 0) ||
                         updated.housingAllowance !== (payrollProfiles[userId]?.housing_allowance || 0);
      return {
        ...prev,
        [userId]: { ...updated, isModified }
      };
    });
  };

  // ⚡ シミュレーション：定額昇給一括適用（例: 全員/特定部署に +¥5,000）
  const handleApplyFixedAmount = () => {
    if (simAmount === 0) return;
    setBatchData(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(uid => {
        const item = next[uid];
        if (simTargetDept === 'ALL' || item.department === simTargetDept) {
          const newBase = Math.max(0, item.currentBase + simAmount);
          next[uid] = {
            ...item,
            newBase,
            isModified: newBase !== item.currentBase,
            revisionType: simAmount >= 0 ? 'regular' : 'other',
            reasonNote: item.reasonNote || `一括改定（${simAmount >= 0 ? '+' : ''}¥${simAmount.toLocaleString()}）`
          };
        }
      });
      return next;
    });
  };

  // ⚡ シミュレーション：定率昇給一括適用（例: 全員/特定部署に +3.0% ベア）
  const handleApplyFixedPercent = () => {
    if (simPercent === 0) return;
    setBatchData(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(uid => {
        const item = next[uid];
        if (simTargetDept === 'ALL' || item.department === simTargetDept) {
          const diff = Math.round(item.currentBase * (simPercent / 100));
          const newBase = item.currentBase + diff;
          next[uid] = {
            ...item,
            newBase,
            isModified: newBase !== item.currentBase,
            revisionType: 'base_up',
            reasonNote: item.reasonNote || `一律ベースアップ（+${simPercent}%）`
          };
        }
      });
      return next;
    });
  };

  // 一括リセット
  const handleResetBatch = () => {
    if (!confirm('編集中の昇給シミュレーション内容を破棄し、現在の給与状態に戻しますか？')) return;
    const initialBatch: Record<string, BatchEditItem> = {};
    employees.filter(u => !u.is_retired).forEach(u => {
      const p = payrollProfiles[u.id];
      const base = p?.base_salary || 250000;
      initialBatch[u.id] = {
        userId: u.id,
        name: u.name,
        department: u.department || '-',
        role: u.role || '一般',
        employmentType: u.employment_type === 'part-time' ? 'パート' : '正社員',
        currentBase: base,
        newBase: base,
        positionAllowance: p?.position_allowance || 0,
        qualificationAllowance: p?.qualification_allowance || 0,
        housingAllowance: p?.housing_allowance || 0,
        commutingAllowance: p?.commuting_allowance || 0,
        familyAllowance: p?.family_allowance || 0,
        otherAllowance: p?.special_allowance || 0,
        revisionType: 'regular',
        reasonNote: '',
        isModified: false
      };
    });
    setBatchData(initialBatch);
  };

  // 💾 エクセル風 全社員一括保存
  const handleSaveBatchAll = async () => {
    if (!tenantId) return;
    const modifiedItems = Object.values(batchData).filter(item => item.isModified || item.newBase !== item.currentBase);
    if (modifiedItems.length === 0) {
      alert('変更された給与データがありません。');
      return;
    }

    if (!confirm(`給与が改定された ${modifiedItems.length} 名のデータを一括保存しますか？\n昇給履歴を記録し、大元の給与マスタへ即座に反映します。`)) return;

    setIsSavingBatch(true);
    try {
      const appliedYearMonth = batchAppliedYearMonth;
      const newHistoryRecords: SalaryRevisionRecord[] = [];
      const updatedProfilesMap = { ...payrollProfiles };

      for (const item of modifiedItems) {
        const p = payrollProfiles[item.userId];
        const prevBase = item.currentBase;
        const prevAllowances = (p?.position_allowance || 0) + (p?.qualification_allowance || 0) + 
                               (p?.housing_allowance || 0) + (p?.commuting_allowance || 0) + 
                               (p?.family_allowance || 0) + (p?.special_allowance || 0);
        const newAllowances = item.positionAllowance + item.qualificationAllowance + 
                              item.housingAllowance + item.commutingAllowance + 
                              item.familyAllowance + item.otherAllowance;
        const prevTotal = prevBase + prevAllowances;
        const newTotal = item.newBase + newAllowances;
        const diffBase = item.newBase - prevBase;
        const diffTotal = newTotal - prevTotal;
        const rate = prevBase > 0 ? parseFloat(((diffBase / prevBase) * 100).toFixed(2)) : 0;

        const revRecord: SalaryRevisionRecord = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          user_id: item.userId,
          user_name: item.name,
          department: item.department,
          revision_date: batchRevisionDate,
          applied_year_month: appliedYearMonth,
          revision_type: item.revisionType || 'regular',
          previous_base_salary: prevBase,
          new_base_salary: item.newBase,
          diff_base_salary: diffBase,
          previous_total_allowance: prevAllowances,
          new_total_allowance: newAllowances,
          previous_total_salary: prevTotal,
          new_total_salary: newTotal,
          diff_total_salary: diffTotal,
          revision_rate: rate,
          allowance_details: {
            position: item.positionAllowance,
            qualification: item.qualificationAllowance,
            housing: item.housingAllowance,
            commuting: item.commutingAllowance,
            family: item.familyAllowance,
            other: item.otherAllowance
          },
          reason_note: item.reasonNote || '一括給与改定',
          approved_by: '管理者一括決裁',
          created_at: new Date().toISOString()
        };
        newHistoryRecords.push(revRecord);

        // 📄 労働条件通知書（賃金改定版）の自動発行＆本人マイページ配信
        if (autoGenerateContract) {
          const contractDoc: RevisionContractDoc = {
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            user_id: item.userId,
            user_name: item.name,
            revision_id: revRecord.id,
            applied_year_month: appliedYearMonth,
            revision_date: batchRevisionDate,
            revision_type: item.revisionType || 'regular',
            base_salary: item.newBase,
            position_allowance: item.positionAllowance,
            qualification_allowance: item.qualificationAllowance,
            housing_allowance: item.housingAllowance,
            commuting_allowance: item.commutingAllowance,
            family_allowance: item.familyAllowance,
            reason_note: item.reasonNote || '一括給与改定',
            status: 'pending_signature',
            created_at: new Date().toISOString()
          };
          addOrUpdateRevisionContract(tenantId, contractDoc);
        }

        const updatedProf: EmployeePayrollProfile = {
          ...(p || {}),
          user_id: item.userId,
          tenant_id: tenantId,
          salary_type: p?.salary_type || 'monthly',
          hourly_wage: p?.hourly_wage || 0,
          fixed_overtime_hours: p?.fixed_overtime_hours || 0,
          fixed_overtime_allowance: p?.fixed_overtime_allowance || 0,
          dependents_count: p?.dependents_count || 0,
          health_insurance_enabled: p?.health_insurance_enabled ?? true,
          pension_insurance_enabled: p?.pension_insurance_enabled ?? true,
          employment_insurance_enabled: p?.employment_insurance_enabled ?? true,
          resident_tax_monthly: p?.resident_tax_monthly || 0,
          tax_bracket: p?.tax_bracket || 'kou',
          commuting_taxable: p?.commuting_taxable ?? false,
          base_salary: item.newBase,
          position_allowance: item.positionAllowance,
          qualification_allowance: item.qualificationAllowance,
          housing_allowance: item.housingAllowance,
          commuting_allowance: item.commutingAllowance,
          family_allowance: item.familyAllowance,
          special_allowance: item.otherAllowance
        };
        updatedProfilesMap[item.userId] = updatedProf;

        // DB Upsert (給与プロファイル ＆ 大元労務マスタの完全同期)
        try {
          await supabase.from('employee_payroll_profiles').upsert(updatedProf, { onConflict: 'tenant_id,user_id' });
          await supabase.from('employee_onboarding_profiles').update({
            base_salary: item.newBase,
            position_allowance: item.positionAllowance,
            qualification_allowance: item.qualificationAllowance,
            housing_allowance: item.housingAllowance,
            commuting_allowance: item.commutingAllowance,
            family_allowance: item.familyAllowance,
            updated_at: new Date().toISOString()
          }).eq('tenant_id', tenantId).eq('user_id', item.userId);
        } catch (e) {
          console.warn('Batch DB upsert notice:', e);
        }
      }

      // 昇給履歴テーブルに一括INSERT
      try {
        await supabase.from('salary_revision_history').insert(newHistoryRecords);
      } catch (e) {
        console.warn('Batch revision history insert notice:', e);
      }

      // ローカルストレージ更新
      const updatedRevs = [...newHistoryRecords, ...revisions];
      setRevisions(updatedRevs);
      localStorage.setItem(`salary_revisions_${tenantId}`, JSON.stringify(updatedRevs));

      setPayrollProfiles(updatedProfilesMap);
      localStorage.setItem(`payroll_profiles_${tenantId}`, JSON.stringify(updatedProfilesMap));

      // 契約書一覧更新
      setRevisionContracts(getRevisionContracts(tenantId));

      // バッチデータの基準値を更新
      setBatchData(prev => {
        const next = { ...prev };
        modifiedItems.forEach(item => {
          if (next[item.userId]) {
            next[item.userId].currentBase = item.newBase;
            next[item.userId].isModified = false;
          }
        });
        return next;
      });

      alert(`🎉 ${modifiedItems.length} 名の昇給・給与改定を一括保存しました！\n【適用開始】: ${appliedYearMonth} 分給与より\n【労働条件通知書】: 全員の個人マイページへ電子同意・押印依頼を自動配信いたしました。`);
    } catch (err: any) {
      console.error(err);
      alert('一括保存に失敗しました: ' + err.message);
    } finally {
      setIsSavingBatch(false);
    }
  };

  // 個別モーダル開く
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

  // 個別保存
  const handleSaveRevision = async () => {
    if (!tenantId || !formUserId) return;
    if (formNewBaseSalary <= 0) {
      alert('改定後の基本給を入力してください。');
      return;
    }

    setIsSavingRevision(true);
    try {
      const targetUser = employees.find(e => e.id === formUserId);
      const p = payrollProfiles[formUserId];
      const currentBase = p?.base_salary || 250000;
      const prevAllowances = (p?.position_allowance || 0) + (p?.qualification_allowance || 0) + 
                             (p?.housing_allowance || 0) + (p?.commuting_allowance || 0) + 
                             (p?.family_allowance || 0) + (p?.special_allowance || 0);
      const newAllowances = formPositionAllowance + formQualificationAllowance + 
                            formHousingAllowance + formCommutingAllowance + 
                            formFamilyAllowance + formOtherAllowance;
      const prevTotal = currentBase + prevAllowances;
      const newTotal = formNewBaseSalary + newAllowances;
      const diffBase = formNewBaseSalary - currentBase;
      const diffTotal = newTotal - prevTotal;
      const revisionRate = currentBase > 0 ? parseFloat(((diffBase / currentBase) * 100).toFixed(2)) : 0;
      const appliedYearMonth = formAppliedYearMonth;

      const revisionPayload: SalaryRevisionRecord = {
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

      try {
        await supabase.from('salary_revision_history').insert([revisionPayload]);
      } catch (e) {
        console.warn('DB error, using local fallback:', e);
      }

      const updatedRevList = [revisionPayload, ...revisions];
      setRevisions(updatedRevList);
      localStorage.setItem(`salary_revisions_${tenantId}`, JSON.stringify(updatedRevList));

      const updatedProfile: EmployeePayrollProfile = {
        ...(p || {}),
        user_id: formUserId,
        tenant_id: tenantId,
        salary_type: p?.salary_type || 'monthly',
        hourly_wage: p?.hourly_wage || 0,
        fixed_overtime_hours: p?.fixed_overtime_hours || 0,
        fixed_overtime_allowance: p?.fixed_overtime_allowance || 0,
        dependents_count: p?.dependents_count || 0,
        health_insurance_enabled: p?.health_insurance_enabled ?? true,
        pension_insurance_enabled: p?.pension_insurance_enabled ?? true,
        employment_insurance_enabled: p?.employment_insurance_enabled ?? true,
        resident_tax_monthly: p?.resident_tax_monthly || 0,
        tax_bracket: p?.tax_bracket || 'kou',
        commuting_taxable: p?.commuting_taxable ?? false,
        base_salary: formNewBaseSalary,
        position_allowance: formPositionAllowance,
        qualification_allowance: formQualificationAllowance,
        housing_allowance: formHousingAllowance,
        commuting_allowance: formCommutingAllowance,
        family_allowance: formFamilyAllowance,
        special_allowance: formOtherAllowance
      };

      try {
        await supabase.from('employee_payroll_profiles').upsert(updatedProfile, { onConflict: 'tenant_id,user_id' });
        await supabase.from('employee_onboarding_profiles').update({
          base_salary: formNewBaseSalary,
          position_allowance: formPositionAllowance,
          qualification_allowance: formQualificationAllowance,
          housing_allowance: formHousingAllowance,
          commuting_allowance: formCommutingAllowance,
          family_allowance: formFamilyAllowance,
          updated_at: new Date().toISOString()
        }).eq('tenant_id', tenantId).eq('user_id', formUserId);
      } catch (e) {}

      const updatedProfiles = { ...payrollProfiles, [formUserId]: updatedProfile };
      setPayrollProfiles(updatedProfiles);
      localStorage.setItem(`payroll_profiles_${tenantId}`, JSON.stringify(updatedProfiles));

      // バッチステートにも反映
      setBatchData(prev => ({
        ...prev,
        [formUserId]: {
          ...(prev[formUserId] || {}),
          currentBase: formNewBaseSalary,
          newBase: formNewBaseSalary,
          isModified: false
        }
      }));

      // 📄 労働条件通知書（賃金改定版）の自動発行＆本人マイページ配信
      if (autoGenerateContract) {
        const contractDoc: RevisionContractDoc = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          user_id: formUserId,
          user_name: targetUser?.name || '未設定',
          revision_id: revisionPayload.id,
          applied_year_month: formAppliedYearMonth,
          revision_date: formRevisionDate,
          revision_type: formRevisionType,
          base_salary: formNewBaseSalary,
          position_allowance: formPositionAllowance,
          qualification_allowance: formQualificationAllowance,
          housing_allowance: formHousingAllowance,
          commuting_allowance: formCommutingAllowance,
          family_allowance: formFamilyAllowance,
          reason_note: formReasonNote || '給与改定',
          status: 'pending_signature',
          created_at: new Date().toISOString()
        };
        addOrUpdateRevisionContract(tenantId, contractDoc);
        setRevisionContracts(getRevisionContracts(tenantId));
      }

      setIsRevisionModalOpen(false);
      alert(`🎉 ${targetUser?.name} さんの給与改定（${diffBase >= 0 ? '+' : ''}¥${diffBase.toLocaleString()}）を保存しました！\n【適用開始】: ${formAppliedYearMonth} 分給与より\n【労働条件通知書】: 本人の個人マイページへ電子同意・押印依頼を送信いたしました。`);
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

  const modifiedBatchCount = Object.values(batchData).filter(item => item.isModified || item.newBase !== item.currentBase).length;

  return (
    <div className="space-y-6">
      {/* 🏢 1. 部署別 昇給・人件費インパクト分析パネル（我が君のご提案：部署ごとにどのくらい上がったのかが即座にわかる！） */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                🏢 部署別 昇給・人件費インパクト分析
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  リアルタイム連動
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                各部署の対象人数、昇給総額、平均賃上げ率、年間人件費インパクトを一目で把握できます。
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-400">
            全在籍 {employees.filter(e => !e.is_retired).length} 名 / {departments.length} 部署
          </span>
        </div>

        {/* 部署別グリッドカード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {departmentAnalytics.map(dept => {
            const isAll = dept.dept === '全社合計';
            const rate = dept.prevTotalSalary > 0 
              ? parseFloat(((dept.diffSalary / dept.prevTotalSalary) * 100).toFixed(2)) 
              : 0;
            const avgDiff = dept.count > 0 ? Math.round(dept.diffSalary / dept.count) : 0;
            const annualImpact = dept.diffSalary * 12;

            return (
              <div 
                key={dept.dept} 
                className={`p-4 rounded-2xl border transition ${
                  isAll 
                    ? 'bg-gradient-to-br from-slate-900 to-indigo-950 text-white border-slate-800 shadow-md md:col-span-2 lg:col-span-1' 
                    : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${isAll ? 'text-indigo-200' : 'text-slate-800'}`}>
                    {dept.dept}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isAll ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30' : 'bg-white text-slate-500 border border-slate-200'}`}>
                    {dept.count}名中 {dept.revisedCount}名昇給
                  </span>
                </div>

                <div className="mt-2.5 flex items-baseline justify-between">
                  <div>
                    <span className={`text-[10px] ${isAll ? 'text-slate-400' : 'text-slate-500'}`}>昇給総額（月額）</span>
                    <p className={`text-xl font-black font-mono mt-0.5 ${isAll ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      {dept.diffSalary >= 0 ? '+' : ''}¥{dept.diffSalary.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] ${isAll ? 'text-slate-400' : 'text-slate-500'}`}>平均賃上げ率</span>
                    <p className={`text-sm font-black font-mono ${dept.diffSalary >= 0 ? (isAll ? 'text-emerald-300' : 'text-emerald-700') : 'text-rose-500'}`}>
                      {rate >= 0 ? '+' : ''}{rate}%
                    </p>
                  </div>
                </div>

                <div className={`mt-3 pt-2.5 border-t text-[11px] flex justify-between items-center ${isAll ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
                  <span>平均昇給: <strong>{avgDiff >= 0 ? '+' : ''}¥{avgDiff.toLocaleString()}</strong></span>
                  <span className={`font-mono text-[10px] ${isAll ? 'text-amber-300' : 'text-amber-700 font-bold'}`}>
                    年間人件費 {annualImpact >= 0 ? '+' : ''}¥{(annualImpact / 10000).toFixed(1)}万
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🌟 2. メインビュー切替ツールバー */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* ビューモード選択 */}
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setViewMode('matrix')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'matrix'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="社員名を上部に、給与項目を行に配置して右スクロールで比較"
          >
            <LayoutGrid className="w-4 h-4 text-indigo-600" />
            ↔️ 横スクロール給与台帳（社員上部）
          </button>

          <button
            onClick={() => setViewMode('batch')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'batch'
                ? 'bg-white text-slate-900 shadow-xs ring-2 ring-emerald-500/20'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="エクセルのようにセル上で直接全員の昇給額を入力・編集"
          >
            <Table className="w-4 h-4 text-emerald-600" />
            📝 エクセル風 一括昇給エディタ
            {modifiedBatchCount > 0 && (
              <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {modifiedBatchCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode('ledger')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'ledger'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-slate-600" />
            📋 縦一覧台帳
          </button>

          <button
            onClick={() => setViewMode('history')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4 text-purple-600" />
            📜 全社昇給ログ ({revisions.length})
          </button>
        </div>

        {/* 検索・絞り込み ＆ CSV */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-44">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="社員名で検索..."
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
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4" />
            個別昇給登録
          </button>
        </div>
      </div>

      {/* 🌟 3. 【VIEW①：↔️ 社員名上部 ＆ 右スクロール型 マトリクス給与台帳】（我が君のご指定仕様！） */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-2">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-black text-slate-800">
                ↔️ マトリクス給与比較台帳（上部: 社員一覧 ／ 行: 給与項目）
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 font-bold">
              👉 マウスホイールまたはドラッグで右スクロールできます ({filteredEmployees.length}名表示中)
            </span>
          </div>

          <div className="overflow-x-auto pb-4">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70">
                  {/* 左固定ヘッダー */}
                  <th className="sticky left-0 z-20 bg-slate-100 py-3.5 px-4 text-left font-black text-slate-700 w-44 min-w-[176px] shadow-xs border-r border-slate-200">
                    給与・手当項目
                  </th>
                  {/* 社員ヘッダー（横並び） */}
                  {filteredEmployees.map(emp => (
                    <th key={emp.id} className="py-3 px-3 min-w-[190px] text-left align-top bg-white border-r border-slate-100 hover:bg-slate-50 transition">
                      <div className="space-y-1">
                        <div className="font-black text-sm text-slate-900 flex items-center justify-between">
                          <span>{emp.name}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                            {emp.employment_type === 'part-time' ? 'パート' : '正社員'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                          <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                            {emp.department || '未配属'}
                          </span>
                          <span>{emp.role === 'admin' ? '管理者' : '一般'}</span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {/* 1. 基本給 */}
                <tr className="hover:bg-slate-50/70 transition">
                  <td className="sticky left-0 z-10 bg-slate-50 py-3 px-4 font-bold text-slate-800 border-r border-slate-200 shadow-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    基本給（月額）
                  </td>
                  {filteredEmployees.map(emp => {
                    const base = payrollProfiles[emp.id]?.base_salary || 250000;
                    return (
                      <td key={emp.id} className="py-3 px-3 text-right font-mono font-black text-slate-900 text-sm border-r border-slate-100">
                        ¥{base.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* 2. 役職手当 */}
                <tr className="hover:bg-slate-50/70 transition">
                  <td className="sticky left-0 z-10 bg-slate-50 py-2.5 px-4 font-medium text-slate-600 border-r border-slate-200 shadow-xs">
                    🎖️ 役職手当
                  </td>
                  {filteredEmployees.map(emp => {
                    const val = payrollProfiles[emp.id]?.position_allowance || 0;
                    return (
                      <td key={emp.id} className="py-2.5 px-3 text-right font-mono text-slate-600 border-r border-slate-100">
                        {val > 0 ? `¥${val.toLocaleString()}` : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* 3. 資格手当 */}
                <tr className="hover:bg-slate-50/70 transition">
                  <td className="sticky left-0 z-10 bg-slate-50 py-2.5 px-4 font-medium text-slate-600 border-r border-slate-200 shadow-xs">
                    📜 資格・職能手当
                  </td>
                  {filteredEmployees.map(emp => {
                    const val = payrollProfiles[emp.id]?.qualification_allowance || 0;
                    return (
                      <td key={emp.id} className="py-2.5 px-3 text-right font-mono text-slate-600 border-r border-slate-100">
                        {val > 0 ? `¥${val.toLocaleString()}` : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* 4. 住宅手当 */}
                <tr className="hover:bg-slate-50/70 transition">
                  <td className="sticky left-0 z-10 bg-slate-50 py-2.5 px-4 font-medium text-slate-600 border-r border-slate-200 shadow-xs">
                    🏠 住宅手当
                  </td>
                  {filteredEmployees.map(emp => {
                    const val = payrollProfiles[emp.id]?.housing_allowance || 0;
                    return (
                      <td key={emp.id} className="py-2.5 px-3 text-right font-mono text-slate-600 border-r border-slate-100">
                        {val > 0 ? `¥${val.toLocaleString()}` : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* 5. 通勤手当 */}
                <tr className="hover:bg-slate-50/70 transition">
                  <td className="sticky left-0 z-10 bg-slate-50 py-2.5 px-4 font-medium text-slate-600 border-r border-slate-200 shadow-xs">
                    🚃 通勤手当
                  </td>
                  {filteredEmployees.map(emp => {
                    const val = payrollProfiles[emp.id]?.commuting_allowance || 0;
                    return (
                      <td key={emp.id} className="py-2.5 px-3 text-right font-mono text-slate-600 border-r border-slate-100">
                        {val > 0 ? `¥${val.toLocaleString()}` : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* 6. 家族手当 */}
                <tr className="hover:bg-slate-50/70 transition">
                  <td className="sticky left-0 z-10 bg-slate-50 py-2.5 px-4 font-medium text-slate-600 border-r border-slate-200 shadow-xs">
                    👨‍👩‍👧 家族手当
                  </td>
                  {filteredEmployees.map(emp => {
                    const val = payrollProfiles[emp.id]?.family_allowance || 0;
                    return (
                      <td key={emp.id} className="py-2.5 px-3 text-right font-mono text-slate-600 border-r border-slate-100">
                        {val > 0 ? `¥${val.toLocaleString()}` : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* 7. その他手当 */}
                <tr className="hover:bg-slate-50/70 transition">
                  <td className="sticky left-0 z-10 bg-slate-50 py-2.5 px-4 font-medium text-slate-600 border-r border-slate-200 shadow-xs">
                    🎁 その他手当
                  </td>
                  {filteredEmployees.map(emp => {
                    const val = payrollProfiles[emp.id]?.special_allowance || 0;
                    return (
                      <td key={emp.id} className="py-2.5 px-3 text-right font-mono text-slate-600 border-r border-slate-100">
                        {val > 0 ? `¥${val.toLocaleString()}` : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* 8. 💰 総支給月給（合計行・ハイライト） */}
                <tr className="bg-emerald-50/50 font-black hover:bg-emerald-50 transition border-t-2 border-b-2 border-emerald-200">
                  <td className="sticky left-0 z-10 bg-emerald-100/90 py-3.5 px-4 text-emerald-950 font-black border-r border-emerald-200 shadow-xs flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-700" />
                    総支給月給（合計）
                  </td>
                  {filteredEmployees.map(emp => {
                    const p = payrollProfiles[emp.id];
                    const base = p?.base_salary || 250000;
                    const allowances = (p?.position_allowance || 0) + (p?.qualification_allowance || 0) + 
                                       (p?.housing_allowance || 0) + (p?.commuting_allowance || 0) + 
                                       (p?.family_allowance || 0) + (p?.special_allowance || 0);
                    const total = base + allowances;
                    return (
                      <td key={emp.id} className="py-3.5 px-3 text-right font-mono text-emerald-700 font-black text-base border-r border-emerald-100">
                        ¥{total.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* 9. 直近の昇給実績 */}
                <tr className="hover:bg-slate-50/70 transition">
                  <td className="sticky left-0 z-10 bg-slate-50 py-3 px-4 font-bold text-slate-700 border-r border-slate-200 shadow-xs">
                    📈 直近の昇給実績
                  </td>
                  {filteredEmployees.map(emp => {
                    const latest = latestRevisionByUser[emp.id];
                    return (
                      <td key={emp.id} className="py-3 px-3 border-r border-slate-100">
                        {latest ? (
                          <div className="space-y-1">
                            <div className="font-mono font-black text-emerald-600 text-xs">
                              {latest.diff_base_salary >= 0 ? '+' : ''}¥{latest.diff_base_salary.toLocaleString()}
                              <span className="text-[10px] text-emerald-700 ml-1">(+{latest.revision_rate}%)</span>
                            </div>
                            <div className="text-[9px] text-slate-400">
                              {latest.revision_date}
                              <span className="ml-1 px-1 py-0.2 rounded bg-slate-100 text-slate-600">
                                {REVISION_TYPE_LABELS[latest.revision_type]?.label || latest.revision_type}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[10px]">改定履歴なし</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* 10. 操作ボタン行 */}
                <tr className="bg-slate-50/30">
                  <td className="sticky left-0 z-10 bg-slate-100 py-3 px-4 font-bold text-slate-600 border-r border-slate-200 shadow-xs">
                    アクション
                  </td>
                  {filteredEmployees.map(emp => (
                    <td key={emp.id} className="py-3 px-2 border-r border-slate-100 text-center">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleOpenRevisionModal(emp)}
                          className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition cursor-pointer shadow-2xs"
                        >
                          昇給登録
                        </button>
                        <button
                          onClick={() => setSelectedEmployeeForTimeline(emp)}
                          className="w-full py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded text-[9px] transition cursor-pointer"
                        >
                          履歴閲覧
                        </button>
                        {(() => {
                          const doc = revisionContracts.find(c => c.user_id === emp.id);
                          if (!doc) return null;
                          const isSigned = doc.status === 'signed';
                          return (
                            <button
                              onClick={() => setPreviewContractDoc(doc)}
                              className={`w-full py-0.5 rounded text-[9px] font-bold transition flex items-center justify-center gap-0.5 cursor-pointer border ${
                                isSigned 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              }`}
                              title={isSigned ? `合意押印済 (${doc.signed_at?.slice(0, 10)})` : '本人電子押印待ち'}
                            >
                              <FileText className="w-2.5 h-2.5" />
                              {isSigned ? '✅通知書済' : '🕒通知書待'}
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🌟 4. 【VIEW②：📝 エクセル風 全社員一括昇給エディタ】（我が君のご指定仕様！） */}
      {viewMode === 'batch' && (
        <div className="space-y-4">
          {/* ⚡ 一括シミュレーション・アシストバー */}
          <div className="bg-emerald-50/80 border border-emerald-300 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                <h4 className="text-xs font-black text-emerald-950">
                  ⚡ エクセル風 一括昇給シミュレーションアシスト
                </h4>
              </div>
              <span className="text-[11px] text-emerald-800 font-bold">
                ※ 表内の数値を直接変更してもリアルタイム反映されます
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* 対象部署フィルター */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">対象部署:</span>
                <select
                  value={simTargetDept}
                  onChange={e => setSimTargetDept(e.target.value)}
                  className="p-2 bg-white border border-emerald-300 rounded-xl font-bold text-slate-800 text-xs"
                >
                  <option value="ALL">全社（全すべての部署）</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* 定額昇給ボタン */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-300">
                <span className="text-[11px] font-bold text-slate-600 pl-2">一律定額:</span>
                <input
                  type="number"
                  step="1000"
                  value={simAmount}
                  onChange={e => setSimAmount(Number(e.target.value))}
                  className="w-24 p-1 text-right font-mono font-bold text-xs border border-slate-200 rounded-lg"
                />
                <span className="text-slate-500 font-bold pr-1">円</span>
                <button
                  type="button"
                  onClick={handleApplyFixedAmount}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                >
                  反映
                </button>
              </div>

              {/* 定率昇給ボタン */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-300">
                <span className="text-[11px] font-bold text-slate-600 pl-2">一律ベア:</span>
                <input
                  type="number"
                  step="0.5"
                  value={simPercent}
                  onChange={e => setSimPercent(Number(e.target.value))}
                  className="w-16 p-1 text-right font-mono font-bold text-xs border border-slate-200 rounded-lg"
                />
                <span className="text-slate-500 font-bold pr-1">%</span>
                <button
                  type="button"
                  onClick={handleApplyFixedPercent}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                >
                  反映
                </button>
              </div>

              {/* リセット */}
              <button
                type="button"
                onClick={handleResetBatch}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer ml-auto"
              >
                元に戻す
              </button>
            </div>
          </div>

          {/* 📝 スプレッドシートテーブル */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-black text-slate-800">
                  全社員給与・昇給スプレッドシート（セル直接編集可能）
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-300">
                  <span className="text-emerald-900">📅 昇給適用開始月:</span>
                  <input
                    type="month"
                    value={batchAppliedYearMonth}
                    onChange={e => setBatchAppliedYearMonth(e.target.value)}
                    className="p-1 border border-emerald-400 rounded-lg font-mono text-xs font-black text-emerald-900 bg-white"
                  />
                  <span className="text-[10px] text-emerald-700">分給与〜</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <span>改定日:</span>
                  <input
                    type="date"
                    value={batchRevisionDate}
                    onChange={e => setBatchRevisionDate(e.target.value)}
                    className="p-1.5 border border-slate-300 rounded-lg font-mono text-xs font-bold"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={autoGenerateContract}
                    onChange={e => setAutoGenerateContract(e.target.checked)}
                    className="rounded text-emerald-600 cursor-pointer"
                  />
                  <span>📄 労働条件通知書を個人へ配信</span>
                </label>
                <button
                  type="button"
                  onClick={handleSaveBatchAll}
                  disabled={isSavingBatch || modifiedBatchCount === 0}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  {isSavingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  全社昇給を一括保存する ({modifiedBatchCount}名分)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3">社員名 / 部署</th>
                    <th className="py-3 px-3 text-right">現在基本給</th>
                    <th className="py-3 px-3 text-right w-36 bg-emerald-50 text-emerald-950 font-black">
                      ✏️ 新基本給 (円)
                    </th>
                    <th className="py-3 px-3 text-right">昇給額 (差額)</th>
                    <th className="py-3 px-3 text-right">昇給率</th>
                    <th className="py-3 px-3 text-right w-24">役職手当</th>
                    <th className="py-3 px-3 text-right w-24">資格手当</th>
                    <th className="py-3 px-3 text-right w-24">住宅手当</th>
                    <th className="py-3 px-3 text-right">新総支給月給</th>
                    <th className="py-3 px-3 w-40">改定理由・メモ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredEmployees.map(emp => {
                    const item = batchData[emp.id];
                    if (!item) return null;

                    const diffBase = item.newBase - item.currentBase;
                    const rate = item.currentBase > 0 ? parseFloat(((diffBase / item.currentBase) * 100).toFixed(2)) : 0;
                    const allowances = item.positionAllowance + item.qualificationAllowance + 
                                       item.housingAllowance + item.commutingAllowance + 
                                       item.familyAllowance + item.otherAllowance;
                    const newTotal = item.newBase + allowances;

                    return (
                      <tr 
                        key={emp.id} 
                        className={`transition ${item.isModified ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/60'}`}
                      >
                        {/* 社員情報 */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                          <div className="text-[10px] text-slate-400">{item.department} / {item.role}</div>
                        </td>

                        {/* 現在基本給 */}
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                          ¥{item.currentBase.toLocaleString()}
                        </td>

                        {/* ✏️ 新基本給（エクセル風入力セル） */}
                        <td className="py-2.5 px-3 text-right bg-emerald-50/40">
                          <input
                            type="number"
                            step="1000"
                            value={item.newBase}
                            onChange={e => handleBatchFieldChange(emp.id, 'newBase', Number(e.target.value))}
                            className="w-full p-1.5 text-right font-mono font-black text-sm bg-white border border-emerald-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </td>

                        {/* 昇給額（差額） */}
                        <td className="py-2.5 px-3 text-right font-mono font-black">
                          {diffBase !== 0 ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${diffBase > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {diffBase > 0 ? '+' : ''}¥{diffBase.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-300">±0</span>
                          )}
                        </td>

                        {/* 昇給率 */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-xs">
                          {diffBase !== 0 ? (
                            <span className={diffBase > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                              {diffBase > 0 ? '+' : ''}{rate}%
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* 役職手当 */}
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            value={item.positionAllowance}
                            onChange={e => handleBatchFieldChange(emp.id, 'positionAllowance', Number(e.target.value))}
                            className="w-full p-1 text-right font-mono text-xs bg-white border border-slate-200 rounded"
                          />
                        </td>

                        {/* 資格手当 */}
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            value={item.qualificationAllowance}
                            onChange={e => handleBatchFieldChange(emp.id, 'qualificationAllowance', Number(e.target.value))}
                            className="w-full p-1 text-right font-mono text-xs bg-white border border-slate-200 rounded"
                          />
                        </td>

                        {/* 住宅手当 */}
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            value={item.housingAllowance}
                            onChange={e => handleBatchFieldChange(emp.id, 'housingAllowance', Number(e.target.value))}
                            className="w-full p-1 text-right font-mono text-xs bg-white border border-slate-200 rounded"
                          />
                        </td>

                        {/* 新総支給月給 */}
                        <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700 text-xs">
                          ¥{newTotal.toLocaleString()}
                        </td>

                        {/* 改定理由・メモ */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="例: 春季ベア"
                            value={item.reasonNote}
                            onChange={e => handleBatchFieldChange(emp.id, 'reasonNote', e.target.value)}
                            className="w-full p-1 text-xs border border-slate-200 rounded bg-white"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 下部一括保存バー */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs font-bold text-slate-500">
                変更あり: <strong className="text-emerald-600">{modifiedBatchCount}</strong> 名
              </span>
              <button
                type="button"
                onClick={handleSaveBatchAll}
                disabled={isSavingBatch || modifiedBatchCount === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {isSavingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                全社員の昇給を一括保存・マスタ更新
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 5. 【VIEW③：📋 縦一覧台帳】 */}
      {viewMode === 'ledger' && (
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
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          {emp.name}
                          <span className="text-[10px] font-normal px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {emp.employment_type === 'part-time' ? 'パート' : '正社員'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">{emp.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-700">{emp.department || '-'}</div>
                        <div className="text-[11px] text-slate-400">{emp.role === 'admin' ? '管理者' : '一般'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        ¥{base.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        ¥{allowances.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                        ¥{total.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        {latestRev ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${REVISION_TYPE_LABELS[latestRev.revision_type]?.color || 'bg-slate-100'}`}>
                                {REVISION_TYPE_LABELS[latestRev.revision_type]?.label || latestRev.revision_type}
                              </span>
                              <span className="font-mono font-black text-xs text-emerald-600">
                                {latestRev.diff_base_salary >= 0 ? '+' : ''}¥{latestRev.diff_base_salary.toLocaleString()}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                                +{latestRev.revision_rate}%
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">適用日: {latestRev.revision_date}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">改定履歴なし</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleOpenRevisionModal(emp)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 transition text-[11px] cursor-pointer flex items-center gap-1"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            昇給登録
                          </button>
                          <button
                            onClick={() => setSelectedEmployeeForTimeline(emp)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px] cursor-pointer flex items-center gap-1"
                          >
                            <History className="w-3.5 h-3.5" />
                            履歴 ({empRevs.length})
                          </button>
                          {(() => {
                            const doc = revisionContracts.find(c => c.user_id === emp.id);
                            if (!doc) return null;
                            const isSigned = doc.status === 'signed';
                            return (
                              <button
                                onClick={() => setPreviewContractDoc(doc)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer border ${
                                  isSigned 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                                title={isSigned ? `本人押印済 (${doc.signed_at?.slice(0, 10)})` : '本人電子押印待ち'}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                {isSigned ? '✅ 通知書済' : '🕒 押印待ち'}
                              </button>
                            );
                          })()}
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

      {/* 🌟 6. 【VIEW④：📜 全社昇給履歴タイムラインログ】 */}
      {viewMode === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                全社給与改定・昇給履歴ログ
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                過去に実施されたすべての昇給・ベースアップ・役職昇格の全記録です。
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">計 {revisions.length} 件</span>
          </div>

          {revisions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <History className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-bold">まだ昇給・給与改定の履歴が登録されていません。</p>
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

      {/* 🌟 7. 個別 昇給・給与改定 登録モーダル */}
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">対象従業員</label>
                <select
                  value={formUserId}
                  onChange={e => {
                    setFormUserId(e.target.value);
                    const p = payrollProfiles[e.target.value];
                    const b = p?.base_salary || 250000;
                    setFormNewBaseSalary(b);
                    setFormPositionAllowance(p?.position_allowance || 0);
                    setFormQualificationAllowance(p?.qualification_allowance || 0);
                    setFormHousingAllowance(p?.housing_allowance || 0);
                    setFormCommutingAllowance(p?.commuting_allowance || 0);
                    setFormFamilyAllowance(p?.family_allowance || 0);
                    setFormOtherAllowance(p?.special_allowance || 0);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  {employees.filter(e => !e.is_retired).map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department || '所属なし'} / 現在基本給: ¥{(payrollProfiles[emp.id]?.base_salary || 250000).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-300">
                  <label className="block text-[11px] font-black text-emerald-950 mb-1">📅 昇給適用開始月</label>
                  <input
                    type="month"
                    value={formAppliedYearMonth}
                    onChange={e => setFormAppliedYearMonth(e.target.value)}
                    className="w-full p-2 bg-white border border-emerald-400 rounded-lg text-xs font-mono font-black text-emerald-900"
                  />
                  <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">※給与計算に反映される月</span>
                </div>
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

              {/* 📄 労働条件通知書自動発行チェック */}
              <label className="flex items-center gap-2 p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerateContract}
                  onChange={e => setAutoGenerateContract(e.target.checked)}
                  className="rounded text-indigo-600 cursor-pointer w-4 h-4"
                />
                <div>
                  <span>📄 労働条件通知書（賃金改定版）を自動発行して個人へ配信</span>
                  <p className="text-[10px] text-indigo-600 font-normal">
                    本人のマイページに通知書が届き、電子印鑑での同意・押印が行えるようになります。
                  </p>
                </div>
              </label>

              {/* 基本給改定 */}
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950">基本給（月額）の改定</span>
                  <span className="text-[11px] font-mono text-slate-500">
                    現在: ¥{(payrollProfiles[formUserId]?.base_salary || 250000).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">新基本給 (円)</label>
                    <input
                      type="number"
                      step="1000"
                      value={formNewBaseSalary}
                      onChange={e => setFormNewBaseSalary(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-emerald-400 rounded-xl text-sm font-mono font-black text-slate-900"
                    />
                  </div>

                  {(() => {
                    const cBase = payrollProfiles[formUserId]?.base_salary || 250000;
                    const diff = formNewBaseSalary - cBase;
                    const rate = cBase > 0 ? parseFloat(((diff / cBase) * 100).toFixed(2)) : 0;
                    return (
                      <div className="p-2.5 bg-white rounded-xl border border-emerald-200 space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-500">昇給差額</span>
                        <p className="text-base font-black font-mono text-emerald-600">
                          {diff >= 0 ? '+' : ''}¥{diff.toLocaleString()}
                        </p>
                        <span className="text-[10px] font-bold text-emerald-700">
                          上昇率: {diff >= 0 ? '+' : ''}{rate}%
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 理由 ＆ 承認者 */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">改定理由・メモ</label>
                  <input
                    type="text"
                    placeholder="例: 春季定期昇給（S評価）"
                    value={formReasonNote}
                    onChange={e => setFormReasonNote(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">決裁者</label>
                  <input
                    type="text"
                    placeholder="例: 代表取締役"
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
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveRevision}
                disabled={isSavingRevision}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingRevision ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                昇給を保存・マスタ更新
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 8. 社員個別 昇給履歴タイムライン モーダル */}
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
                  {selectedEmployeeForTimeline.department || '所属なし'} / 現在基本給: ¥{(payrollProfiles[selectedEmployeeForTimeline.id]?.base_salary || 250000).toLocaleString()}
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
                  </div>
                );
              }

              return (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {empRevs.map(rev => (
                    <div key={rev.id} className="relative">
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

            <div className="pt-2 border-t border-slate-100 flex justify-end">
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

      {/* 📄 労働条件通知書（賃金改定版）プレビュー・印刷モーダル */}
      {previewContractDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:p-0 print:bg-white">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-100 overflow-hidden print:border-none print:shadow-none print:max-h-none">
            {/* モーダルヘッダー */}
            <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                    労働条件通知書（賃金改定版）
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      previewContractDoc.status === 'signed' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {previewContractDoc.status === 'signed' ? '✅ 本人電子押印合意済' : '🕒 本人電子押印待ち'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {previewContractDoc.user_name} 様 / {previewContractDoc.applied_year_month} 分給与改定
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  印刷・PDF
                </button>
                <button
                  onClick={() => setPreviewContractDoc(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 書面本文 */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/50 print:p-0 print:bg-white">
              {(() => {
                const targetEmp = employees.find(e => e.id === previewContractDoc.user_id);
                const prof = payrollProfiles[previewContractDoc.user_id];
                const tpl = getLaborContractTemplateFromStorage(tenantId || '');
                const contractData: LaborContractData = {
                  companyName: companySettings?.name || '株式会社KAP',
                  companyAddress: companySettings?.address || '滋賀県大津市坂本3丁目21-16',
                  representativeName: companySettings?.representative || '代表取締役',
                  employeeName: previewContractDoc.user_name,
                  employeeAddress: targetEmp?.address || '滋賀県大津市',
                  joinDate: targetEmp?.join_date || '2024-04-01',
                  contractType: 'indefinite',
                  trialPeriodMonths: 3,
                  workLocation: companySettings?.address || '本社',
                  jobDescription: targetEmp?.role === 'admin' ? '管理統括業務' : '通常業務',
                  startTime: '09:00',
                  endTime: '18:00',
                  breakTimeMinutes: 60,
                  overtimeWork: 'あり（労働基準法第36条に基づく協定の範囲内）',
                  holidaysText: '土曜、日曜、祝日、年末年始休暇',
                  paidLeaveGrantDays: 10,
                  salaryType: prof?.salary_type === 'hourly' ? 'hourly' : 'monthly',
                  baseSalary: previewContractDoc.base_salary,
                  hourlyWage: prof?.hourly_wage || 1150,
                  positionAllowance: previewContractDoc.position_allowance,
                  qualificationAllowance: previewContractDoc.qualification_allowance,
                  housingAllowance: previewContractDoc.housing_allowance,
                  familyAllowance: previewContractDoc.family_allowance,
                  commutingAllowance: previewContractDoc.commuting_allowance,
                  fixedOvertimeHours: prof?.fixed_overtime_hours || 0,
                  fixedOvertimeAllowance: prof?.fixed_overtime_allowance || 0,
                  closingDayText: tpl?.closing_day_text || '毎月末日',
                  paymentDayText: tpl?.payment_day_text || '翌月25日振込',
                  bonusPolicy: '会社業績および個人の勤務成績により支給する（年2回）',
                  raisePolicy: `定期昇給または業務能力の評価による給与改定（${previewContractDoc.applied_year_month}分改定: ${previewContractDoc.reason_note || '定期改定'}）`,
                  retirementAllowance: '会社の退職金規程による',
                  healthInsuranceJoined: true,
                  pensionInsuranceJoined: true,
                  employmentInsuranceJoined: true,
                  workersCompJoined: true,
                  createdDate: previewContractDoc.revision_date,
                  isEmployeeSigned: previewContractDoc.status === 'signed',
                  employeeSignedAt: previewContractDoc.signed_at,
                  employeeSignatureImage: undefined
                };

                return <OfficialLaborContractDoc data={contractData} />;
              })()}
            </div>

            {/* モーダルフッター */}
            <div className="p-3 px-6 border-t border-slate-200 bg-white flex items-center justify-between text-xs font-bold text-slate-500 print:hidden shrink-0">
              <span>
                ステータス: {previewContractDoc.status === 'signed' ? `✅ ${previewContractDoc.signed_at?.slice(0, 16).replace('T', ' ')} 本人押印合意済` : '🕒 従業員のマイページにて電子押印待ち'}
              </span>
              <button
                onClick={() => setPreviewContractDoc(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
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
