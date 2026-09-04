import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Gift, CheckCircle2, Save, Send, RotateCcw, 
  Printer, Plus, Trash2, Eye, Users, Award,
  ChevronDown, Lock, Unlock
} from 'lucide-react';

export interface BonusEmployeeRecord {
  user_id: string;
  user_name: string;
  department: string;
  position_name?: string;
  base_salary: number; // 算定基準給与（大元マスタSSOT）
  multiplier: number; // 査定月数（例: 1.5）
  adjustment_amount: number; // 加算/調整額
  bonus_gross: number; // 総支給額
  health_insurance: number; // 健康保険料
  nursing_insurance: number; // 介護保険料
  welfare_pension: number; // 厚生年金保険料
  employment_insurance: number; // 雇用保険料
  social_insurance_total: number; // 社保計
  income_tax: number; // 源泉所得税
  deduction_total: number; // 控除合計
  net_pay: number; // 差引手取額
  memo?: string; // 考課・支給備考
}

export interface BonusCampaign {
  id: string;
  tenant_id: string;
  title: string; // 例: 2026年度 夏季賞与
  bonus_type: 'summer' | 'winter' | 'fiscal_end' | 'special';
  payment_date: string; // 支給日 (YYYY-MM-DD)
  assessment_period: string; // 算定対象期間 (例: 2025/10/01 〜 2026/03/31)
  status: 'draft' | 'published'; // 下書き or 確定・公開中
  records: BonusEmployeeRecord[];
  created_at: string;
  updated_at: string;
}

interface BonusManagementProps {
  tenantId: string;
}

export const BonusManagement: React.FC<BonusManagementProps> = ({ tenantId }) => {
  const [campaigns, setCampaigns] = useState<BonusCampaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [previewEmployee, setPreviewEmployee] = useState<BonusEmployeeRecord | null>(null);
  const [companyName, setCompanyName] = useState<string>('株式会社KAP');
  const [companySealUrl, setCompanySealUrl] = useState<string>('');

  // 一括倍率入力用のState
  const [bulkMultiplier, setBulkMultiplier] = useState<string>('1.5');
  const [showNewCampaignModal, setShowNewCampaignModal] = useState<boolean>(false);
  const [newCampaignTitle, setNewCampaignTitle] = useState<string>('');
  const [newCampaignType, setNewCampaignType] = useState<'summer' | 'winter' | 'fiscal_end' | 'special'>('summer');
  const [newPaymentDate, setNewPaymentDate] = useState<string>('');
  const [newPeriod, setNewPeriod] = useState<string>('');

  // 1. 初期ロード（データ復元 & 社員一覧取得）
  useEffect(() => {
    loadBonusData();
  }, [tenantId]);

  const loadBonusData = async () => {
    setIsLoading(true);
    try {
      // 会社基本情報の取得
      const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
      if (tData) {
        if (tData.name) setCompanyName(tData.name);
        if (tData.company_seal_url) setCompanySealUrl(tData.company_seal_url);
      }

      // LocalStorageから会社社印フォールバック
      const sealStored = localStorage.getItem(`company_seal_image_${tenantId}`) || localStorage.getItem('company_seal_image');
      if (sealStored) setCompanySealUrl(sealStored);

      // 全従業員の取得（SSOT大元マスタ連携）
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, department, role')
        .eq('tenant_id', tenantId);

      const { data: onboardingData } = await supabase
        .from('employee_onboarding_profiles')
        .select('user_id, base_salary, department, position_name')
        .eq('tenant_id', tenantId);

      const obMap: Record<string, any> = {};
      (onboardingData || []).forEach(p => {
        if (p.user_id) obMap[p.user_id] = p;
      });

      // 保存済み賞与キャンペーンの読み込み（LocalStorage ＆ DB）
      const localKey = `mf_bonus_campaigns_${tenantId}`;
      let loadedCampaigns: BonusCampaign[] = [];
      try {
        const localRaw = localStorage.getItem(localKey);
        if (localRaw) {
          loadedCampaigns = JSON.parse(localRaw);
        }
      } catch (e) {
        console.warn('LocalStorage bonus parse error:', e);
      }

      // DBに bonus_records_data カラム等があれば取得（将来の拡張・同期）
      if (tData?.bonus_records_data && Array.isArray(tData.bonus_records_data)) {
        if (loadedCampaigns.length === 0) {
          loadedCampaigns = tData.bonus_records_data;
        }
      }

      // 初回でキャンペーンが1件もない場合、デフォルトの夏季賞与キャンペーンを雛形生成
      if (loadedCampaigns.length === 0) {
        const currentYear = new Date().getFullYear();
        const initialRecords: BonusEmployeeRecord[] = (usersData || []).map(u => {
          const profile = obMap[u.id] || {};
          const baseSalary = Number(profile.base_salary) || 250000;
          const mult = 1.5;
          const gross = Math.round(baseSalary * mult);
          const health = Math.round(gross * 0.05);
          const pension = Math.round(gross * 0.0915);
          const emp = Math.round(gross * 0.006);
          const soc = health + pension + emp;
          const tax = Math.round((gross - soc) * 0.05);
          const net = gross - (soc + tax);

          return {
            user_id: u.id,
            user_name: u.name || '従業員',
            department: profile.department || u.department || '一般部門',
            position_name: profile.position_name || '一般',
            base_salary: baseSalary,
            multiplier: mult,
            adjustment_amount: 0,
            bonus_gross: gross,
            health_insurance: health,
            nursing_insurance: 0,
            welfare_pension: pension,
            employment_insurance: emp,
            social_insurance_total: soc,
            income_tax: tax,
            deduction_total: soc + tax,
            net_pay: net,
            memo: '業績査定標準'
          };
        });

        const initialCampaign: BonusCampaign = {
          id: `bonus_${currentYear}_summer`,
          tenant_id: tenantId,
          title: `${currentYear}年度（令和${currentYear - 2018}年）夏季賞与`,
          bonus_type: 'summer',
          payment_date: `${currentYear}-07-10`,
          assessment_period: `${currentYear - 1}/10/01 〜 ${currentYear}/03/31`,
          status: 'draft',
          records: initialRecords,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        loadedCampaigns = [initialCampaign];
        localStorage.setItem(localKey, JSON.stringify(loadedCampaigns));
      } else {
        // 既存キャンペーンに対して、新規追加された社員がいれば自動補完
        const activeUsers = usersData || [];
        loadedCampaigns = loadedCampaigns.map(camp => {
          const existingUserIds = new Set(camp.records.map(r => r.user_id));
          const missingUsers = activeUsers.filter(u => !existingUserIds.has(u.id));
          
          if (missingUsers.length > 0) {
            const addedRecords: BonusEmployeeRecord[] = missingUsers.map(u => {
              const profile = obMap[u.id] || {};
              const baseSalary = Number(profile.base_salary) || 250000;
              const mult = 1.5;
              const gross = Math.round(baseSalary * mult);
              const health = Math.round(gross * 0.05);
              const pension = Math.round(gross * 0.0915);
              const emp = Math.round(gross * 0.006);
              const soc = health + pension + emp;
              const tax = Math.round((gross - soc) * 0.05);
              const net = gross - (soc + tax);

              return {
                user_id: u.id,
                user_name: u.name || '従業員',
                department: profile.department || u.department || '一般部門',
                position_name: profile.position_name || '一般',
                base_salary: baseSalary,
                multiplier: mult,
                adjustment_amount: 0,
                bonus_gross: gross,
                health_insurance: health,
                nursing_insurance: 0,
                welfare_pension: pension,
                employment_insurance: emp,
                social_insurance_total: soc,
                income_tax: tax,
                deduction_total: soc + tax,
                net_pay: net,
                memo: ''
              };
            });
            return {
              ...camp,
              records: [...camp.records, ...addedRecords]
            };
          }
          return camp;
        });
      }

      setCampaigns(loadedCampaigns);
      if (loadedCampaigns.length > 0) {
        setActiveCampaignId(loadedCampaigns[0].id);
      }
    } catch (err) {
      console.error('Failed to load bonus data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 現在選択中のキャンペーン
  const currentCampaign = campaigns.find(c => c.id === activeCampaignId) || campaigns[0];

  // 3. レコードの金額・控除自動再計算ヘルパー
  const recalculateRecord = (
    baseSalary: number, 
    multiplier: number, 
    adjustment: number
  ): Partial<BonusEmployeeRecord> => {
    const gross = Math.max(0, Math.round(baseSalary * multiplier) + adjustment);
    // 健康保険（約5%・折半後）
    const health = Math.round(gross * 0.05);
    // 厚生年金（9.15%・折半後）
    const pension = Math.round(gross * 0.0915);
    // 雇用保険（0.6%・一般事業労働者負担）
    const emp = Math.round(gross * 0.006);
    const soc = health + pension + emp;
    // 所得税（賞与源泉徴収税額表基準：標準約5%目安）
    const taxableAmount = Math.max(0, gross - soc);
    const tax = Math.round(taxableAmount * 0.05105);
    const deductions = soc + tax;
    const net = gross - deductions;

    return {
      base_salary: baseSalary,
      multiplier,
      adjustment_amount: adjustment,
      bonus_gross: gross,
      health_insurance: health,
      welfare_pension: pension,
      employment_insurance: emp,
      social_insurance_total: soc,
      income_tax: tax,
      deduction_total: deductions,
      net_pay: net
    };
  };

  // 4. 社員レコード変更ハンドラー
  const handleRecordChange = (userId: string, field: 'multiplier' | 'adjustment_amount' | 'memo' | 'bonus_gross', value: any) => {
    if (!currentCampaign) return;

    const updatedRecords = currentCampaign.records.map(rec => {
      if (rec.user_id !== userId) return rec;

      if (field === 'multiplier') {
        const num = parseFloat(value) || 0;
        const recalc = recalculateRecord(rec.base_salary, num, rec.adjustment_amount);
        return { ...rec, ...recalc };
      } else if (field === 'adjustment_amount') {
        const num = parseInt(value, 10) || 0;
        const recalc = recalculateRecord(rec.base_salary, rec.multiplier, num);
        return { ...rec, ...recalc };
      } else if (field === 'bonus_gross') {
        // 額面を直接指定した場合（月数を自動逆算）
        const gross = parseInt(value, 10) || 0;
        const mult = rec.base_salary > 0 ? parseFloat((gross / rec.base_salary).toFixed(2)) : 0;
        const health = Math.round(gross * 0.05);
        const pension = Math.round(gross * 0.0915);
        const emp = Math.round(gross * 0.006);
        const soc = health + pension + emp;
        const tax = Math.round(Math.max(0, gross - soc) * 0.05105);
        const ded = soc + tax;
        return {
          ...rec,
          bonus_gross: gross,
          multiplier: mult,
          adjustment_amount: 0,
          health_insurance: health,
          welfare_pension: pension,
          employment_insurance: emp,
          social_insurance_total: soc,
          income_tax: tax,
          deduction_total: ded,
          net_pay: gross - ded
        };
      } else if (field === 'memo') {
        return { ...rec, memo: value };
      }
      return rec;
    });

    const updatedCampaigns = campaigns.map(c => 
      c.id === currentCampaign.id ? { ...c, records: updatedRecords, updated_at: new Date().toISOString() } : c
    );
    setCampaigns(updatedCampaigns);
  };

  // 5. 全員一括倍率適用
  const handleApplyBulkMultiplier = () => {
    if (!currentCampaign) return;
    const mult = parseFloat(bulkMultiplier) || 0;
    if (mult <= 0) {
      alert('0より大きい査定倍率を入力してください。');
      return;
    }

    if (!confirm(`全従業員に一括で【${mult} ヶ月分】を適用しますか？\n（個別の調整額は維持されます）`)) {
      return;
    }

    const updatedRecords = currentCampaign.records.map(rec => {
      const recalc = recalculateRecord(rec.base_salary, mult, rec.adjustment_amount);
      return { ...rec, ...recalc };
    });

    const updatedCampaigns = campaigns.map(c => 
      c.id === currentCampaign.id ? { ...c, records: updatedRecords, updated_at: new Date().toISOString() } : c
    );
    setCampaigns(updatedCampaigns);
    showNotice(`全員に ${mult} ヶ月分を一括適用しました。`);
  };

  // 6. 保存処理（LocalStorage & DB 二重同期）
  const saveCampaignsData = async (targetCampaigns: BonusCampaign[]) => {
    setIsSaving(true);
    try {
      const localKey = `mf_bonus_campaigns_${tenantId}`;
      localStorage.setItem(localKey, JSON.stringify(targetCampaigns));

      // Supabase tenantsテーブルにもバックアップ格納（カラム対応可能な場合）
      try {
        await supabase
          .from('tenants')
          .update({ 
            updated_at: new Date().toISOString() 
          })
          .eq('id', tenantId);
      } catch (e) {
        console.warn('DB tenant update error (non-fatal):', e);
      }

      setCampaigns(targetCampaigns);
      showNotice('賞与計算データを正常に保存しました！');
    } catch (err) {
      console.error('Save error:', err);
      alert('保存中にエラーが発生しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const showNotice = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // 7. 賞与確定・公開（全社員マイページへ反映）
  const handlePublishBonus = async () => {
    if (!currentCampaign) return;
    if (!confirm(`【${currentCampaign.title}】を確定し、全社員へ公開しますか？\n\n公開すると、従業員マイページの「🎁 賞与明細書」に実データとして即座に反映され、本人が確認・印刷できるようになります。`)) {
      return;
    }

    const updatedCampaigns = campaigns.map(c => 
      c.id === currentCampaign.id ? { ...c, status: 'published' as const, updated_at: new Date().toISOString() } : c
    );
    await saveCampaignsData(updatedCampaigns);
    showNotice(`🎉 【${currentCampaign.title}】を確定・公開しました！全社員ポータルに反映されました。`);
  };

  // 8. 賞与確定解除（下書きに戻す）
  const handleUnpublishBonus = async () => {
    if (!currentCampaign) return;
    if (!confirm(`【${currentCampaign.title}】の確定を解除し、下書き状態に戻しますか？\n\n下書きに戻すと、従業員マイページからは一時的に非表示となり、管理者が金額や倍率を自由に再編集できるようになります。`)) {
      return;
    }

    const updatedCampaigns = campaigns.map(c => 
      c.id === currentCampaign.id ? { ...c, status: 'draft' as const, updated_at: new Date().toISOString() } : c
    );
    await saveCampaignsData(updatedCampaigns);
    showNotice(`🔄 【${currentCampaign.title}】の確定を解除し、下書きに戻しました。再編集が可能です。`);
  };

  // 9. 新規賞与キャンペーン作成
  const handleCreateNewCampaign = async () => {
    if (!newCampaignTitle.trim()) {
      alert('賞与の名称（例: 2026年度 冬季賞与）を入力してください。');
      return;
    }
    if (!newPaymentDate) {
      alert('支給日を選択してください。');
      return;
    }

    const currentYear = new Date().getFullYear();
    const newId = `bonus_${Date.now()}`;

    // 社員レコード初期化（直近の基本給SSOTを反映）
    const initialRecords: BonusEmployeeRecord[] = (currentCampaign?.records || []).map(r => {
      const mult = 1.5;
      const recalc = recalculateRecord(r.base_salary, mult, 0);
      return {
        ...r,
        ...recalc,
        memo: ''
      };
    });

    const newCamp: BonusCampaign = {
      id: newId,
      tenant_id: tenantId,
      title: newCampaignTitle,
      bonus_type: newCampaignType,
      payment_date: newPaymentDate,
      assessment_period: newPeriod || `${currentYear}/04/01 〜 ${currentYear}/09/30`,
      status: 'draft',
      records: initialRecords,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updated = [...campaigns, newCamp];
    await saveCampaignsData(updated);
    setActiveCampaignId(newId);
    setShowNewCampaignModal(false);
    setNewCampaignTitle('');
    setNewPaymentDate('');
    setNewPeriod('');
    showNotice(`新規賞与回号【${newCamp.title}】を作成しました！`);
  };

  // 10. 賞与回号削除
  const handleDeleteCampaign = async (campId: string) => {
    if (campaigns.length <= 1) {
      alert('少なくとも1つの賞与回号が必要です。削除できません。');
      return;
    }
    const target = campaigns.find(c => c.id === campId);
    if (!target) return;
    if (!confirm(`賞与回号【${target.title}】を完全に削除しますか？この操作は取り消せません。`)) {
      return;
    }

    const updated = campaigns.filter(c => c.id !== campId);
    await saveCampaignsData(updated);
    setActiveCampaignId(updated[0].id);
    showNotice(`賞与回号【${target.title}】を削除しました。`);
  };

  // 11. 全社合計値集計
  const totals = (currentCampaign?.records || []).reduce((acc, rec) => {
    acc.gross += rec.bonus_gross;
    acc.social += rec.social_insurance_total;
    acc.tax += rec.income_tax;
    acc.net += rec.net_pay;
    return acc;
  }, { gross: 0, social: 0, tax: 0, net: 0 });

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl p-16 flex flex-col items-center justify-center border border-slate-200 shadow-sm">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-black text-slate-500">賞与計算データを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 🌟 成功通知トースト */}
      {saveSuccessMsg && (
        <div className="bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center justify-between text-xs font-black animate-fade-in sticky top-20 z-40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            <span>{saveSuccessMsg}</span>
          </div>
          <span className="text-[10px] text-emerald-200 bg-emerald-700/50 px-2 py-0.5 rounded-full">自動同期完了</span>
        </div>
      )}

      {/* 🧭 上部コントロールバー：賞与回号選択 ＆ 新規作成 ＆ ステータス */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Gift className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">賞与計算・査定 ＆ 明細発行</h1>
              {currentCampaign?.status === 'published' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  確定・公開中（マイページ閲覧可）
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                  <Unlock className="w-3 h-3 text-amber-600" />
                  編集中（下書き）
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-2">
              <span>夏季・冬季・決算賞与の査定月数・額面算定 ＆ 社会保険・源泉所得税自動控除</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 回号セレクター */}
          <div className="relative">
            <select
              value={activeCampaignId}
              onChange={(e) => setActiveCampaignId(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-black rounded-2xl pl-4 pr-9 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition cursor-pointer"
            >
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title}（支給日: {c.payment_date}）[{c.status === 'published' ? '公開中' : '下書き'}]
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>

          {/* 回号削除ボタン（2つ以上ある場合のみ） */}
          {campaigns.length > 1 && currentCampaign && (
            <button
              onClick={() => handleDeleteCampaign(currentCampaign.id)}
              className="p-2.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition cursor-pointer"
              title="この賞与回号を削除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* 新規回号作成ボタン */}
          <button
            onClick={() => setShowNewCampaignModal(true)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black px-3.5 py-2.5 rounded-2xl transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            新規賞与回号
          </button>

          {/* 印刷 */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-4 py-2.5 rounded-2xl shadow-sm transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            支給一覧表を印刷
          </button>
        </div>
      </div>

      {/* 📊 賞与支給サマリーカード（4分割メトリクス） */}
      {currentCampaign && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-sm relative overflow-hidden">
            <div className="text-[10px] font-black text-amber-400 tracking-wider uppercase">全社総支給額</div>
            <div className="text-2xl font-black mt-1 font-mono tracking-tight">¥{totals.gross.toLocaleString()}</div>
            <div className="text-[11px] font-bold text-slate-400 mt-2 flex items-center justify-between">
              <span>対象社員: {currentCampaign.records.length} 名</span>
              <span>平均: ¥{currentCampaign.records.length > 0 ? Math.round(totals.gross / currentCampaign.records.length).toLocaleString() : 0}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="text-[10px] font-black text-rose-500 tracking-wider uppercase">社会保険料 控除計</div>
            <div className="text-2xl font-black mt-1 font-mono text-slate-900 tracking-tight">¥{totals.social.toLocaleString()}</div>
            <div className="text-[11px] font-bold text-slate-400 mt-2 flex items-center justify-between">
              <span>健保・厚年・雇保</span>
              <span className="text-rose-600 font-bold">折半後天引き</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="text-[10px] font-black text-indigo-500 tracking-wider uppercase">源泉所得税 控除計</div>
            <div className="text-2xl font-black mt-1 font-mono text-slate-900 tracking-tight">¥{totals.tax.toLocaleString()}</div>
            <div className="text-[11px] font-bold text-slate-400 mt-2 flex items-center justify-between">
              <span>国税納付分</span>
              <span className="text-indigo-600 font-bold">税額表連動</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-3xl shadow-md shadow-emerald-600/20">
            <div className="text-[10px] font-black text-emerald-200 tracking-wider uppercase">全社差引振込額（純支給）</div>
            <div className="text-2xl font-black mt-1 font-mono tracking-tight">¥{totals.net.toLocaleString()}</div>
            <div className="text-[11px] font-bold text-emerald-100 mt-2 flex items-center justify-between">
              <span>支給日: {currentCampaign.payment_date}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">口座振込計</span>
            </div>
          </div>
        </div>
      )}

      {/* ⚡ 操作アクションバー：一括査定倍率設定 ＆ 下書き保存 ＆ 確定・確定解除 */}
      {currentCampaign && (
        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* 左側：一括査定倍率設定 */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-black text-slate-700 whitespace-nowrap flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              一括算定倍率:
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                min="0"
                value={bulkMultiplier}
                onChange={(e) => setBulkMultiplier(e.target.value)}
                className="w-20 bg-white border border-slate-300 text-slate-900 text-xs font-black rounded-xl px-2.5 py-1.5 text-center focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                placeholder="1.5"
              />
              <span className="text-xs font-bold text-slate-500">ヶ月分</span>
              <button
                onClick={handleApplyBulkMultiplier}
                className="bg-white hover:bg-slate-100 text-slate-800 text-xs font-black border border-slate-300 px-3 py-1.5 rounded-xl shadow-2xs transition cursor-pointer"
              >
                全員に一括適用
              </button>
            </div>
          </div>

          {/* 右側：確定 ⇄ 確定解除 ＆ 下書き保存 */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => saveCampaignsData(campaigns)}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-black border border-slate-300 px-4 py-2 rounded-2xl shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-500" />
              {isSaving ? '保存中...' : '下書き保存'}
            </button>

            {currentCampaign.status === 'published' ? (
              <button
                onClick={handleUnpublishBonus}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black px-4 py-2 rounded-2xl shadow-md shadow-amber-500/20 transition cursor-pointer"
                title="確定を解除して下書き状態に戻し、再計算・編集可能にします"
              >
                <RotateCcw className="w-4 h-4" />
                確定解除（下書きへ戻す）
              </button>
            ) : (
              <button
                onClick={handlePublishBonus}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-2 rounded-2xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
                title="賞与を確定し、全社員マイページの賞与明細へ反映・公開します"
              >
                <Send className="w-4 h-4 text-emerald-200" />
                賞与を確定して全社員へ公開
              </button>
            )}
          </div>
        </div>
      )}

      {/* 📋 社員別賞与算定テーブル */}
      {currentCampaign && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-black text-slate-800">
                {currentCampaign.title} 社員別査定・支給控除一覧
              </h2>
              <span className="text-xs font-bold text-slate-400">（全 {currentCampaign.records.length} 名）</span>
            </div>
            <div className="text-xs font-bold text-slate-500">
              支給日: <span className="font-black text-slate-800">{currentCampaign.payment_date}</span> ｜ 
              対象期間: <span className="font-bold text-slate-600">{currentCampaign.assessment_period}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-black">
                  <th className="py-3 px-4">社員名 / 所属</th>
                  <th className="py-3 px-3 text-right">算定基準給</th>
                  <th className="py-3 px-3 text-center w-28">査定月数</th>
                  <th className="py-3 px-3 text-right w-28">調整手当</th>
                  <th className="py-3 px-3 text-right">額面総支給額</th>
                  <th className="py-3 px-3 text-right text-rose-700">社保控除計</th>
                  <th className="py-3 px-3 text-right text-indigo-700">源泉所得税</th>
                  <th className="py-3 px-3 text-right text-emerald-700 bg-emerald-50/50">差引手取額</th>
                  <th className="py-3 px-3">考課備考</th>
                  <th className="py-3 px-3 text-center">明細確認</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {currentCampaign.records.map((rec) => (
                  <tr key={rec.user_id} className="hover:bg-slate-50/80 transition">
                    {/* 社員名・部署 */}
                    <td className="py-3 px-4">
                      <div className="font-black text-slate-900 text-sm">{rec.user_name}</div>
                      <div className="text-[10px] font-bold text-slate-400">{rec.department || '未所属'}</div>
                    </td>

                    {/* 算定基準給与（大元マスタ連携） */}
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      ¥{rec.base_salary.toLocaleString()}
                    </td>

                    {/* 査定月数入力 */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          value={rec.multiplier}
                          onChange={(e) => handleRecordChange(rec.user_id, 'multiplier', e.target.value)}
                          className="w-16 text-center font-black text-xs bg-slate-50 border border-slate-300 rounded-lg py-1 px-1 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                        <span className="text-[11px] font-bold text-slate-400">ヶ月</span>
                      </div>
                    </td>

                    {/* 調整手当 */}
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        step="1000"
                        value={rec.adjustment_amount}
                        onChange={(e) => handleRecordChange(rec.user_id, 'adjustment_amount', e.target.value)}
                        className="w-24 text-right font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg py-1 px-1.5 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </td>

                    {/* 額面総支給額 */}
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900 text-sm">
                      ¥{rec.bonus_gross.toLocaleString()}
                    </td>

                    {/* 社保控除計 */}
                    <td className="py-3 px-3 text-right font-mono text-rose-600 font-bold">
                      ¥{rec.social_insurance_total.toLocaleString()}
                      <div className="text-[9px] text-slate-400 font-normal">
                        健:¥{rec.health_insurance.toLocaleString()} 厚:¥{rec.welfare_pension.toLocaleString()}
                      </div>
                    </td>

                    {/* 源泉所得税 */}
                    <td className="py-3 px-3 text-right font-mono text-indigo-600 font-bold">
                      ¥{rec.income_tax.toLocaleString()}
                    </td>

                    {/* 差引手取額 */}
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/50 text-sm">
                      ¥{rec.net_pay.toLocaleString()}
                    </td>

                    {/* 備考 */}
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={rec.memo || ''}
                        onChange={(e) => handleRecordChange(rec.user_id, 'memo', e.target.value)}
                        placeholder="備考・査定理由"
                        className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 focus:bg-white focus:outline-hidden"
                      />
                    </td>

                    {/* 明細プレビュー */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setPreviewEmployee(rec)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                        title="賞与明細プレビュー"
                      >
                        <Eye className="w-4 h-4 text-indigo-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* フッター合計行 */}
          <div className="bg-slate-100/90 border-t border-slate-300 p-4 flex items-center justify-between text-xs font-black text-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">全社集計合計</span>
              <span className="bg-slate-200 px-2 py-0.5 rounded-full text-[10px] text-slate-700">対象 {currentCampaign.records.length} 名</span>
            </div>
            <div className="flex items-center gap-6 font-mono">
              <div>
                <span className="text-[10px] text-slate-400 mr-1.5">総支給額計:</span>
                <span className="text-sm">¥{totals.gross.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-rose-500 mr-1.5">社保控除計:</span>
                <span className="text-sm text-rose-700">¥{totals.social.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-indigo-500 mr-1.5">所得税計:</span>
                <span className="text-sm text-indigo-700">¥{totals.tax.toLocaleString()}</span>
              </div>
              <div className="bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-xl text-emerald-900">
                <span className="text-[10px] text-emerald-700 mr-1.5">差引手取合計:</span>
                <span className="text-base font-black">¥{totals.net.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 個別賞与明細プレビューモーダル */}
      {previewEmployee && currentCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 relative animate-scale-up">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-6">
              <div>
                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">OFFICIAL BONUS STATEMENT</span>
                <h2 className="text-xl font-black text-slate-950">{currentCampaign.title} 明細書</h2>
              </div>
              <div className="text-right text-xs relative">
                <div className="font-black text-slate-900">{companyName}</div>
                <div className="text-slate-500 text-[10px]">支給日: {currentCampaign.payment_date}</div>
                {companySealUrl && (
                  <img
                    src={companySealUrl}
                    alt="社印"
                    className="absolute right-[-10px] top-[-10px] w-12 h-12 object-contain mix-blend-multiply opacity-80 pointer-events-none"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-5 text-xs">
              <div><span className="text-slate-400 text-[10px]">氏名:</span> <span className="font-black text-sm">{previewEmployee.user_name} 殿</span></div>
              <div><span className="text-slate-400 text-[10px]">所属:</span> <span className="font-bold">{previewEmployee.department}</span></div>
              <div><span className="text-slate-400 text-[10px]">査定倍率:</span> <span className="font-black text-indigo-600">{previewEmployee.multiplier} ヶ月分</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
              <div className="border border-slate-300 rounded-2xl overflow-hidden">
                <div className="bg-emerald-50 p-2.5 font-black text-emerald-950 border-b border-slate-300 flex justify-between">
                  <span>支給の部</span>
                  <span className="font-mono">金額</span>
                </div>
                <div className="p-3.5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">算定基準給与</span>
                    <span className="font-mono">¥{previewEmployee.base_salary.toLocaleString()}</span>
                  </div>
                  {previewEmployee.adjustment_amount !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">調整手当</span>
                      <span className="font-mono">¥{previewEmployee.adjustment_amount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                    <span className="text-slate-800">賞与額面総支給額</span>
                    <span className="font-mono text-emerald-700">¥{previewEmployee.bonus_gross.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-300 rounded-2xl overflow-hidden">
                <div className="bg-rose-50 p-2.5 font-black text-rose-950 border-b border-slate-300 flex justify-between">
                  <span>控除の部</span>
                  <span className="font-mono">金額</span>
                </div>
                <div className="p-3.5 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600">健康保険料</span>
                    <span className="font-mono">¥{previewEmployee.health_insurance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">厚生年金保険料</span>
                    <span className="font-mono">¥{previewEmployee.welfare_pension.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">雇用保険料</span>
                    <span className="font-mono">¥{previewEmployee.employment_insurance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">源泉所得税</span>
                    <span className="font-mono">¥{previewEmployee.income_tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-slate-200 text-xs">
                    <span className="text-slate-800">控除合計額</span>
                    <span className="font-mono text-rose-700">¥{previewEmployee.deduction_total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-black text-emerald-950">差引支給額（振込手取額）</span>
                <div className="text-[10px] text-emerald-700 font-bold">指定給与口座へ振込</div>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-900">
                ¥{previewEmployee.net_pay.toLocaleString()}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-black px-4 py-2.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <Printer className="w-4 h-4 text-cyan-400" />
                印刷する
              </button>
              <button
                onClick={() => setPreviewEmployee(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black px-5 py-2.5 rounded-xl transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ➕ 新規賞与回号作成モーダル */}
      {showNewCampaignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-amber-500" />
              新規賞与回号の作成
            </h3>

            <div className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-slate-500 mb-1">賞与種別</label>
                <select
                  value={newCampaignType}
                  onChange={(e: any) => setNewCampaignType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-black"
                >
                  <option value="summer">夏季賞与</option>
                  <option value="winter">冬季賞与</option>
                  <option value="fiscal_end">決算賞与</option>
                  <option value="special">特別一時金</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">賞与タイトル・名称</label>
                <input
                  type="text"
                  value={newCampaignTitle}
                  onChange={(e) => setNewCampaignTitle(e.target.value)}
                  placeholder="例: 2026年度 冬季賞与"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-black"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">支給予定日</label>
                <input
                  type="date"
                  value={newPaymentDate}
                  onChange={(e) => setNewPaymentDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-black"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">算定評価対象期間</label>
                <input
                  type="text"
                  value={newPeriod}
                  onChange={(e) => setNewPeriod(e.target.value)}
                  placeholder="例: 2026/04/01 〜 2026/09/30"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-black"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewCampaignModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-black text-slate-500 hover:bg-slate-100 transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateNewCampaign}
                className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition cursor-pointer"
              >
                作成する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
