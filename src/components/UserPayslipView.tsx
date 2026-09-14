import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  DollarSign, Printer, FileText, Loader2, CheckCircle2, Sparkles, X, Check,
  CreditCard, UserCheck, Gift, ChevronDown
} from 'lucide-react';
import { OfficialPayslipDoc } from './OfficialPayslipDoc';
import { OfficialLaborContractDoc, type LaborContractData } from './OfficialLaborContractDoc';
import { OfficialTaxWithholdingSlipDoc } from './OfficialTaxWithholdingSlipDoc';
import { fetchRevisionContracts, signRevisionContract, type RevisionContractDoc } from '../lib/revisionContracts';
import { getLaborContractTemplateFromStorage } from '../lib/laborContractTemplate';

interface UserPayslipViewProps {
  userId: string;
  userName: string;
  tenantId?: string | null;
}

export const UserPayslipView: React.FC<UserPayslipViewProps> = ({ userId, userName, tenantId }) => {
  const [activeDocTab, setActiveDocTab] = useState<'payslip' | 'bonus' | 'tax_slip' | 'contract' | 'labor_profile'>('payslip');
  const [selectedTaxYear, setSelectedTaxYear] = useState<number>(new Date().getFullYear());
  const [payslips, setPayslips] = useState<any[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [tenantName, setTenantName] = useState<string>('株式会社KAP');
  const [companySealUrl, setCompanySealUrl] = useState<string>('');
  const [companyAddress, setCompanyAddress] = useState<string>('滋賀県大津市坂本3丁目21-16');
  const [companyPhone, setCompanyPhone] = useState<string>('077-574-6907');
  const [corporateNumber, setCorporateNumber] = useState<string>('1010001999999');

  // 👤 本人労務・給与プロファイル（SSOT一元連携）
  const [userProfile, setUserProfile] = useState<{
    birth_date?: string;
    address?: string;
    join_date?: string;
    retirement_date?: string;
    is_retired?: boolean;
    my_number?: string;
    bank_name?: string;
    branch_name?: string;
    account_type?: string;
    account_number?: string;
    account_holder?: string;
    dependents_count?: number;
    base_salary?: number;
    position_name?: string;
    department?: string;
  }>({});

  // 📄 労働条件通知書（賃金改定版）電子押印State
  const [myContracts, setMyContracts] = useState<RevisionContractDoc[]>([]);
  const [signModalDoc, setSignModalDoc] = useState<RevisionContractDoc | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);

  // 🎁 確定公開済み賞与データState
  const [publishedBonusList, setPublishedBonusList] = useState<any[]>([]);
  const [selectedBonusId, setSelectedBonusId] = useState<string>('');

  useEffect(() => {
    const fetchPayslips = async () => {
      setIsLoading(true);
      try {
        // 会社名・所在地・社印の取得
        if (tenantId) {
          try {
            const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
            if (tData?.name) setTenantName(tData.name);
            if (tData?.address) setCompanyAddress(tData.address);
            if (tData?.phone_number) setCompanyPhone(tData.phone_number);
            if (tData?.corporate_number) setCorporateNumber(tData.corporate_number);
            if (tData?.company_seal_url) setCompanySealUrl(tData.company_seal_url);
          } catch (tErr) {
            console.warn('Tenant fetch error:', tErr);
          }
        }

        // LocalStorage からの会社設定フォールバック取得
        try {
          const sealStored = (tenantId ? localStorage.getItem(`company_seal_image_${tenantId}`) : null) || 
                             localStorage.getItem('company_seal_image');
          if (sealStored) setCompanySealUrl(sealStored);

          const basicRaw = (tenantId ? localStorage.getItem(`company_basic_settings_${tenantId}`) : null) || 
                           localStorage.getItem('company_basic_info');
          if (basicRaw) {
            const bp = JSON.parse(basicRaw);
            if (bp.name) setTenantName(bp.name);
            if (bp.address) setCompanyAddress(bp.address);
            if (bp.phone_number) setCompanyPhone(bp.phone_number);
            if (bp.corporate_number) setCorporateNumber(bp.corporate_number);
            if (bp.company_seal_url) setCompanySealUrl(bp.company_seal_url);
          }
        } catch (e) {}

        // 👤 本人プロファイル（入退社労務・給与マスタ SSOT）の取得
        if (userId) {
          try {
            const { data: obData } = await supabase
              .from('employee_onboarding_profiles')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle();

            const { data: pyData } = await supabase
              .from('employee_payroll_profiles')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle();

            const { data: uData } = await supabase
              .from('users')
              .select('*')
              .eq('id', userId)
              .maybeSingle();

            let localPay: Record<string, any> = {};
            try {
              const raw = localStorage.getItem(`payroll_profiles_${tenantId}`);
              if (raw) localPay = JSON.parse(raw);
            } catch (e) {}
            const myLocalPay = localPay[userId] || {};

            setUserProfile({
              birth_date: obData?.birth_date || '',
              address: obData?.address || '滋賀県大津市',
              join_date: obData?.join_date || uData?.join_date || '2024-04-01',
              retirement_date: obData?.retirement_date || uData?.retirement_date,
              is_retired: uData?.status === 'retired' || !!obData?.retirement_date,
              my_number: obData?.my_number || '',
              bank_name: obData?.bank_name || pyData?.bank_name || myLocalPay?.bank_name || '滋賀銀行',
              branch_name: obData?.branch_name || pyData?.branch_name || myLocalPay?.branch_name || '坂本支店',
              account_type: obData?.account_type || pyData?.account_type || myLocalPay?.account_type || '普通',
              account_number: obData?.account_number || pyData?.account_number || myLocalPay?.account_number || '1234567',
              account_holder: obData?.account_holder || pyData?.account_holder || userName,
              dependents_count: obData?.dependents_count || pyData?.dependents_count || 0,
              base_salary: pyData?.base_salary || myLocalPay?.base_salary || obData?.base_salary || 250000,
              position_name: obData?.position_name || '一般社員',
              department: obData?.department || uData?.department || '本社営業部'
            });
          } catch (pErr) {
            console.warn('Profile fetch error:', pErr);
          }
        }

        let combined: any[] = [];

        // 1. Supabaseから確定公開済みの明細を取得
        if (userId) {
          try {
            const { data } = await supabase
              .from('payslips')
              .select('*')
              .eq('user_id', userId)
              .eq('status', 'published')
              .order('year_month', { ascending: false });

            if (data && data.length > 0) {
              combined = [...data];
            }
          } catch (dbErr) {
            console.warn('Supabase fetch note:', dbErr);
          }
        }

        // 本人の有給残日数・ユーザー情報を取得（今年度付与分 + 前年度繰越分の【合計残日数】）
        let userLeaveBalance = 10.0;
        if (userId) {
          try {
            const { data: uInfo } = await supabase.from('users').select('paid_leave_balance, paid_leave_carryover').eq('id', userId).maybeSingle();
            if (uInfo) {
              const curBal = Number(uInfo.paid_leave_balance || 0);
              const carryBal = Number(uInfo.paid_leave_carryover || 0);
              if (uInfo.paid_leave_balance !== undefined || uInfo.paid_leave_carryover !== undefined) {
                userLeaveBalance = curBal + carryBal;
              }
            }
          } catch (uErr) {}
        }

        // 2. LocalStorageから取得＆マージ（確定公開済み status === 'published' のみ）
        const localKey = tenantId ? `mf_payslips_${tenantId}` : 'mf_payslips_default';
        const storedLocal = localStorage.getItem(localKey);
        if (storedLocal) {
          try {
            const parsedLocal: any[] = JSON.parse(storedLocal);
            // 自分のIDまたは名前でフィルタ ＆ 確定公開済み（published）のみ対象
            const myLocal = parsedLocal.filter(p => {
              const isMine = (userId && p.user_id === userId) ||
                (userName && p.employee_name && p.employee_name.replace(/\s+/g, '') === userName.replace(/\s+/g, '')) ||
                (userName && p.user?.name && p.user.name.replace(/\s+/g, '') === userName.replace(/\s+/g, ''));
              const isPublished = p.status === 'published' || p.status === undefined;
              return isMine && isPublished;
            });

            myLocal.forEach(lp => {
              if (!combined.some(cp => cp.year_month === lp.year_month)) {
                combined.push(lp);
              }
            });
          } catch (e) {
            console.error('LocalStorage parse error:', e);
          }
        }

        // 各レコードに一意の識別キーと有給残日数を確実に付与
        const normalized = combined.map((p, idx) => ({
          ...p,
          paid_leave_remaining: p.paid_leave_remaining !== undefined && p.paid_leave_remaining !== null ? Number(p.paid_leave_remaining) : userLeaveBalance,
          uniqueKey: p.id || `${p.user_id || 'u'}_${p.year_month || idx}`
        }));

        // 年月降順（新しい月順）でソート
        normalized.sort((a, b) => (b.year_month || '').localeCompare(a.year_month || ''));

        if (normalized.length > 0) {
          setPayslips(normalized);
          setSelectedPayslip(normalized[0]);
          setSelectedKey(normalized[0].uniqueKey);
        } else {
          setPayslips([]);
          setSelectedPayslip(null);
          setSelectedKey('');
        }

        // 📄 本人の労働条件通知書（改定版）取得（DB完全自動同期）
        if (tenantId) {
          const allDocs = await fetchRevisionContracts(tenantId);
          const mine = allDocs.filter(d => d.user_id === userId || (userName && d.user_name === userName));
          setMyContracts(mine);

          try {
            const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
            const { data: cmsData } = await supabase.from('company_master_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
            setCompanySettings({ ...tData, ...cmsData });
          } catch (e) {}
        }

        // 🎁 確定公開済み賞与データ（status === 'published'）の取得・同期
        const bonusKey = tenantId ? `mf_bonus_campaigns_${tenantId}` : 'mf_bonus_campaigns_default';
        const storedBonus = localStorage.getItem(bonusKey);
        let myBonusList: any[] = [];
        if (storedBonus) {
          try {
            const allCampaigns: any[] = JSON.parse(storedBonus);
            allCampaigns.forEach(camp => {
              if (camp.status === 'published' && Array.isArray(camp.records)) {
                const myRec = camp.records.find((r: any) => 
                  (userId && r.user_id === userId) ||
                  (userName && r.user_name && r.user_name.replace(/\s+/g, '') === userName.replace(/\s+/g, ''))
                );
                if (myRec) {
                  myBonusList.push({
                    campaignId: camp.id,
                    title: camp.title,
                    bonusType: camp.bonus_type,
                    paymentDate: camp.payment_date,
                    assessmentPeriod: camp.assessment_period,
                    record: myRec
                  });
                }
              }
            });
          } catch (bErr) {
            console.warn('Bonus parse error:', bErr);
          }
        }
        setPublishedBonusList(myBonusList);
        if (myBonusList.length > 0) {
          setSelectedBonusId(myBonusList[0].campaignId);
        }
      } catch (e) {
        console.error('Fetch user payslip error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayslips();
  }, [userId, userName, tenantId]);

  const handleSignContract = async (docId: string) => {
    if (!tenantId) return;
    setIsSigning(true);
    try {
      const signed = await signRevisionContract(tenantId, docId, userName || '本人');
      if (signed) {
        const allDocs = await fetchRevisionContracts(tenantId);
        const mine = allDocs.filter(d => d.user_id === userId || (userName && d.user_name === userName));
        setMyContracts(mine);
        setSignModalDoc(null);
        alert('🎉 労働条件通知書（賃金改定版）に電子押印・合意いたしました！\n会社管理者へ合意完了が通知されました。');
      }
    } catch (e: any) {
      alert('押印処理に失敗しました: ' + e.message);
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className={`space-y-6 animate-in fade-in duration-300 ${signModalDoc ? 'print:hidden' : ''}`}>
      
      {/* 🔔 労働条件通知書（賃金改定版）の合意・電子押印依頼バナー */}
      {(() => {
        const pendingDoc = myContracts.find(c => c.status === 'pending_signature');
        if (pendingDoc) {
          return (
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-5 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-amber-300 print:hidden">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shrink-0">
                  🔔
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base tracking-tight">
                      【重要】給与改定に伴う『労働条件通知書』が届いています
                    </h3>
                    <span className="bg-white text-orange-700 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                      電子押印待ち
                    </span>
                  </div>
                  <p className="text-xs text-amber-100 mt-0.5">
                    {pendingDoc.applied_year_month}分給与改定（新基本給: ¥{pendingDoc.base_salary.toLocaleString()}）の内容をご確認の上、電子同意・押印を行ってください。
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSignModalDoc(pendingDoc)}
                className="px-5 py-2.5 bg-white text-orange-700 hover:bg-orange-50 rounded-2xl font-black text-xs transition shadow-md cursor-pointer shrink-0 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-orange-600" />
                書面を確認して電子押印する
              </button>
            </div>
          );
        }

        const signedDoc = myContracts.find(c => c.status === 'signed');
        if (signedDoc) {
          return (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 p-4 rounded-2xl flex items-center justify-between gap-3 print:hidden shadow-2xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold flex items-center gap-2">
                    <span>労働条件通知書（{signedDoc.applied_year_month}分給与改定版）: 本人電子押印合意済み</span>
                    <span className="text-[10px] text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                      押印日時: {signedDoc.signed_at?.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">いつでも合意済み通知書の内容を確認・印刷できます。</p>
                </div>
              </div>
              <button
                onClick={() => setSignModalDoc(signedDoc)}
                className="px-3.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                合意書面を表示
              </button>
            </div>
          );
        }

        return null;
      })()}

      {/* 📂 マイ書類フォルダー タブナビゲーション */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveDocTab('payslip')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
              activeDocTab === 'payslip'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            💰 給与明細書
          </button>

          <button
            onClick={() => setActiveDocTab('bonus')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
              activeDocTab === 'bonus'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            🎁 賞与明細書
          </button>

          <button
            onClick={() => setActiveDocTab('tax_slip')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
              activeDocTab === 'tax_slip'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            🧾 源泉徴収票
            <span className="text-[10px] bg-amber-400 text-slate-900 font-bold px-1.5 py-0.2 rounded-full shadow-2xs">
              国税庁公式
            </span>
          </button>

          <button
            onClick={() => setActiveDocTab('contract')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
              activeDocTab === 'contract'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            📝 労働条件通知書
            {myContracts.length > 0 && (
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full">
                {myContracts.length}件
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveDocTab('labor_profile')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
              activeDocTab === 'labor_profile'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            📋 提出済み労務情報
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. 💰 給与明細書ビュー                                                    */}
      {/* ========================================================================= */}
      {activeDocTab === 'payslip' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Web給与明細</h1>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  マネーフォワード給与公式フォーマット準拠・PDFダウンロード・印刷
                </p>
              </div>
            </div>

            {payslips.length > 0 && selectedPayslip && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">支給月度:</label>
                <select
                  value={selectedKey}
                  onChange={(e) => {
                    const targetKey = e.target.value;
                    const found = payslips.find(p => p.uniqueKey === targetKey);
                    if (found) {
                      setSelectedPayslip(found);
                      setSelectedKey(targetKey);
                    }
                  }}
                  className="text-xs font-black p-2 px-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-800 cursor-pointer shadow-2xs"
                >
                  {payslips.map(p => (
                    <option key={p.uniqueKey} value={p.uniqueKey}>
                      {p.year_month} 支給分（支給日: {p.payment_date}）
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-cyan-400" />
                  印刷 / PDF保存
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center gap-3 border border-slate-200 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="text-xs font-bold text-slate-400">給与明細を読み込み中...</span>
            </div>
          ) : !selectedPayslip ? (
            <div className="bg-white rounded-2xl p-16 text-center space-y-3 border border-slate-200 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-700 text-sm">
                公開されている給与明細がありません
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                管理者が給与明細を発行・公開すると、ここに月ごとの明細書が表示されます。
              </p>
            </div>
          ) : (
            <div id="user-payslip-print-area" className="bg-white rounded-2xl border border-slate-300 shadow-xl overflow-hidden print:border-none print:shadow-none print:rounded-none">
              <OfficialPayslipDoc
                payslip={selectedPayslip}
                userName={userName}
                tenantName={tenantName}
                companySealUrl={companySealUrl}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. 🎁 賞与明細書ビュー                                                    */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 2. 🎁 賞与明細書ビュー（確定公開実データ完全連動）                         */}
      {/* ========================================================================= */}
      {activeDocTab === 'bonus' && (() => {
        const currentBonus = publishedBonusList.find(b => b.campaignId === selectedBonusId) || publishedBonusList[0];
        const record = currentBonus?.record;

        if (!currentBonus || !record) {
          return (
            <div className="bg-white rounded-3xl p-16 text-center space-y-4 border border-slate-200 shadow-sm max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                <Gift className="w-8 h-8" />
              </div>
              <h3 className="font-black text-slate-800 text-base">
                現在公開されている賞与明細はありません
              </h3>
              <p className="text-xs font-bold text-slate-400 max-w-md mx-auto leading-relaxed">
                管理者が賞与の査定・計算を行い「賞与を確定して全社員へ公開」すると、ここに正式な賞与支払明細書が表示され、確認・A4印刷・PDF保存が可能になります。
              </p>
            </div>
          );
        }

        const base = record.base_salary || userProfile.base_salary || 250000;
        const multiplier = record.multiplier || 1.5;
        const adjustment = record.adjustment_amount || 0;
        const bonusAmount = record.bonus_gross;
        const health = record.health_insurance;
        const pension = record.welfare_pension;
        const empIns = record.employment_insurance;
        const social = record.social_insurance_total;
        const tax = record.income_tax;
        const totalDeduction = record.deduction_total;
        const net = record.net_pay;

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Gift className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">賞与支払明細書</h1>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      確定公開済
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">
                    支給賞与額・社会保険料および源泉所得税控除・振込手取り額
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {publishedBonusList.length > 1 && (
                  <div className="relative">
                    <select
                      value={selectedBonusId}
                      onChange={(e) => setSelectedBonusId(e.target.value)}
                      className="appearance-none bg-slate-50 border border-slate-300 text-slate-800 text-xs font-black rounded-xl pl-3 pr-8 py-2 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {publishedBonusList.map(b => (
                        <option key={b.campaignId} value={b.campaignId}>
                          {b.title}（支給: {b.paymentDate}）
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  </div>
                )}

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  A4印刷 / PDF保存
                </button>
              </div>
            </div>

            {/* 賞与明細カード本体 */}
            <div className="bg-white p-8 rounded-3xl border border-slate-300 text-slate-900 font-sans text-xs max-w-4xl mx-auto shadow-sm print:shadow-none print:border-none print:p-0">
              <div className="border-b-2 border-slate-900 pb-3 mb-5 flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                    OFFICIAL BONUS STATEMENT
                  </div>
                  <h2 className="text-xl font-black text-slate-950">
                    {currentBonus.title} 明細書
                  </h2>
                </div>
                <div className="text-right text-xs">
                  <div className="font-black text-slate-900">{tenantName}</div>
                  <div className="text-slate-500 text-[10px]">支給日: {currentBonus.paymentDate}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 mb-5">
                <div><span className="text-slate-400 text-[10px]">氏名:</span> <span className="font-black text-sm">{userName} 殿</span></div>
                <div><span className="text-slate-400 text-[10px]">所属:</span> <span className="font-bold">{record.department || userProfile.department || '本社'}</span></div>
                <div><span className="text-slate-400 text-[10px]">算定基準:</span> <span className="font-bold text-indigo-700">{multiplier} ヶ月分</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="border border-slate-300 rounded-2xl overflow-hidden">
                  <div className="bg-emerald-50 p-2.5 font-black text-emerald-950 border-b border-slate-300 flex justify-between">
                    <span>支給の部</span>
                    <span className="font-mono">金額</span>
                  </div>
                  <div className="p-3.5 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">算定基準基本給</span>
                      <span className="font-mono">¥{base.toLocaleString()}</span>
                    </div>
                    {adjustment !== 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">調整手当・加算額</span>
                        <span className="font-mono">¥{adjustment.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                      <span className="text-slate-900">賞与額面総支給額</span>
                      <span className="font-mono text-emerald-700">¥{bonusAmount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 border-t border-slate-300 flex justify-between font-black">
                    <span>総支給金額</span>
                    <span className="font-mono text-sm">¥{bonusAmount.toLocaleString()}</span>
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
                      <span className="font-mono">¥{health.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">厚生年金保険料</span>
                      <span className="font-mono">¥{pension.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">雇用保険料</span>
                      <span className="font-mono">¥{empIns.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-700">
                      <span>社会保険料計</span>
                      <span className="font-mono text-rose-600">¥{social.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">源泉所得税</span>
                      <span className="font-mono">¥{tax.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 border-t border-slate-300 flex justify-between font-black">
                    <span>控除合計額</span>
                    <span className="font-mono text-sm text-rose-700">¥{totalDeduction.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between mb-4 shadow-sm">
                <div>
                  <div className="text-[10px] text-slate-400">差引支給額（指定口座振込手取り額）</div>
                  <div className="text-xs font-bold text-slate-300">
                    総支給 ¥{bonusAmount.toLocaleString()} − 総控除 ¥{totalDeduction.toLocaleString()}
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  ¥{net.toLocaleString()}
                </div>
              </div>

              {record.memo && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-400 mr-2">考課・支給備考:</span>
                  {record.memo}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-[10px] text-slate-500 relative">
                <div>振込先: {userProfile.bank_name} {userProfile.branch_name}（{userProfile.account_type || '普通'} {userProfile.account_number}）</div>
                <div className="relative">
                  <div className="font-bold text-slate-800">{tenantName}</div>
                  {companySealUrl && (
                    <img
                      src={companySealUrl}
                      alt="社印"
                      className="absolute right-[-10px] top-[-10px] w-12 h-12 object-contain mix-blend-multiply opacity-80 pointer-events-none"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 3. 🧾 源泉徴収票（国税庁公式原本様式 NTAOHSZ062010060）                     */}
      {/* ========================================================================= */}
      {activeDocTab === 'tax_slip' && (() => {
        const base = userProfile.base_salary || 250000;
        const totalPaid = base * (userProfile.is_retired ? 8 : 12) + Math.round(base * 2.0);
        const socialDeducted = Math.round(totalPaid * 0.1475);
        const deductionAfterPayment = Math.round(totalPaid * 0.7);
        const totalIncomeDeduction = socialDeducted + 480000;
        const taxable = Math.max(0, deductionAfterPayment - totalIncomeDeduction);
        const taxDeducted = Math.round(taxable * 0.05 * 1.021);

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">給与所得の源泉徴収票</h1>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">
                    国税庁公式原本様式（様式ID: NTAOHSZ062010060）完全準拠・PDF保存・住宅ローン控除・確定申告対応
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedTaxYear}
                  onChange={e => setSelectedTaxYear(Number(e.target.value))}
                  className="text-xs font-black p-2 px-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 cursor-pointer shadow-2xs"
                >
                  {[2026, 2025, 2024].map(y => (
                    <option key={y} value={y}>令和{y - 2018}年分（{y}年）</option>
                  ))}
                </select>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-cyan-400" />
                  A4印刷 / PDF保存
                </button>
              </div>
            </div>

            {/* 国税庁公式NTAOHSZ062010060様式本体 */}
            <div className="max-w-4xl mx-auto">
              <OfficialTaxWithholdingSlipDoc
                data={{
                  year: selectedTaxYear,
                  recipientAddress: userProfile.address,
                  recipientKana: '',
                  recipientName: userName,
                  recipientNumber: `EMP-${userId.slice(0, 4)}`,
                  recipientPosition: userProfile.position_name,
                  myNumber: userProfile.my_number,
                  birthDate: userProfile.birth_date,
                  joinDate: userProfile.join_date,
                  retirementDate: userProfile.retirement_date,
                  isRetired: userProfile.is_retired,
                  totalPayment: totalPaid,
                  deductionAfterPayment: deductionAfterPayment,
                  totalIncomeDeduction: totalIncomeDeduction,
                  withholdingTaxAmount: taxDeducted,
                  socialInsuranceAmount: socialDeducted,
                  dependentsCount: userProfile.dependents_count,
                  basicDeduction: 480000,
                  companyAddress: companyAddress,
                  companyName: tenantName,
                  companyPhone: companyPhone,
                  corporateNumber: corporateNumber,
                  companySealUrl: companySealUrl
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 4. 📝 労働条件通知書・雇用契約合意書ビュー                                */}
      {/* ========================================================================= */}
      {activeDocTab === 'contract' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">労働条件通知書 兼 雇用契約書</h1>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  入社時および賃金改定・昇給時に電子合意された公式書面アーカイブ
                </p>
              </div>
            </div>
          </div>

          {myContracts.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center space-y-3 border border-slate-200 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-700 text-sm">現在発行されている通知書はありません</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                給与改定や入社時に会社から交付された労働条件通知書がここに保管されます。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myContracts.map(c => (
                <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500">{c.applied_year_month}分 改定</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        c.status === 'signed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {c.status === 'signed' ? '✅ 本人合意押印済' : '🕒 電子押印待ち'}
                      </span>
                    </div>
                    <h3 className="font-black text-base text-slate-900 mb-1">
                      労働条件通知書 兼 雇用契約変更合意書
                    </h3>
                    <div className="text-xs text-slate-600 mb-4">
                      新基本給: <span className="font-bold text-emerald-700 font-mono">¥{c.base_salary.toLocaleString()}</span> / 改定日: {c.revision_date}
                    </div>
                  </div>

                  <button
                    onClick={() => setSignModalDoc(c)}
                    className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-indigo-600" />
                    書面を確認・印刷する
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. 📋 提出済み労務情報ビュー                                               */}
      {/* ========================================================================= */}
      {activeDocTab === 'labor_profile' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">提出済み労務情報</h1>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  入社・年末調整手続にて会社へ登録されている基本情報・振込口座・扶養情報
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-black text-slate-800 text-sm border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" /> 基本身分情報
                </h4>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">氏名:</span>
                  <span className="font-bold text-slate-900">{userName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">生年月日:</span>
                  <span className="font-mono text-slate-900">{userProfile.birth_date}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">現住所:</span>
                  <span className="text-slate-900">{userProfile.address}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">入社年月日:</span>
                  <span className="font-mono text-slate-900">{userProfile.join_date}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">所属・役職:</span>
                  <span className="text-slate-900">{userProfile.department} / {userProfile.position_name}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-black text-slate-800 text-sm border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" /> 給与振込先口座
                </h4>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">金融機関:</span>
                  <span className="font-bold text-slate-900">{userProfile.bank_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">支店名:</span>
                  <span className="text-slate-900">{userProfile.branch_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">預金種別:</span>
                  <span className="text-slate-900">{userProfile.account_type || '普通'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">口座番号:</span>
                  <span className="font-mono text-slate-900">{userProfile.account_number}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">口座名義人:</span>
                  <span className="font-bold text-slate-900">{userProfile.account_holder || userName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📄 労働条件通知書（賃金改定版）合意・電子押印モーダル */}
      {signModalDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:p-0 print:static print:bg-transparent print:z-auto print:block">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-100 overflow-hidden print:border-none print:shadow-none print:max-h-none print:overflow-visible print:w-full print:block">
            {/* ヘッダー */}
            <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                    労働条件通知書 兼 雇用契約変更合意書
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      signModalDoc.status === 'signed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {signModalDoc.status === 'signed' ? '✅ 本人合意押印済' : '🕒 電子押印待ち'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {signModalDoc.applied_year_month}分 改定（新基本給: ¥{signModalDoc.base_salary.toLocaleString()}）
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
                  onClick={() => setSignModalDoc(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 書面 */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/50 print:p-0 print:bg-white print:overflow-visible print:h-auto print:block">
              {(() => {
                const tpl = getLaborContractTemplateFromStorage(tenantId || '');
                const repName = companySettings?.representative_name || 
                                (companySettings?.representative ? `代表取締役 ${companySettings.representative}` : '代表取締役 駒井 秀一朗');
                const sealFromLocal = companySealUrl || 
                                      (tenantId ? localStorage.getItem(`company_seal_image_${tenantId}`) : null) || 
                                      localStorage.getItem('company_seal_image') || 
                                      companySettings?.company_seal_url || 
                                      tpl?.company_seal_url;
                const compAddress = companySettings?.address || '滋賀県大津市坂本3丁目21-16';

                const contractData: LaborContractData = {
                  companyName: companySettings?.name || tenantName || '株式会社KAP',
                  companyAddress: compAddress,
                  representativeName: repName,
                  companySealUrl: sealFromLocal,
                  employeeName: userName,
                  employeeAddress: '滋賀県大津市',
                  joinDate: '2024-04-01',
                  contractType: 'indefinite',
                  trialPeriodMonths: 3,
                  workLocation: companySettings?.address || '本社',
                  jobDescription: '通常業務',
                  startTime: '09:00',
                  endTime: '18:00',
                  breakTimeMinutes: 60,
                  overtimeWork: 'あり（労働基準法第36条に基づく協定の範囲内）',
                  holidaysText: '土曜、日曜、祝日、年末年始休暇',
                  paidLeaveGrantDays: 10,
                  salaryType: 'monthly',
                  baseSalary: signModalDoc.base_salary,
                  hourlyWage: 1150,
                  positionAllowance: signModalDoc.position_allowance,
                  qualificationAllowance: signModalDoc.qualification_allowance,
                  housingAllowance: signModalDoc.housing_allowance,
                  familyAllowance: signModalDoc.family_allowance,
                  commutingAllowance: signModalDoc.commuting_allowance,
                  fixedOvertimeHours: 0,
                  fixedOvertimeAllowance: 0,
                  closingDayText: tpl?.closing_day_text || '毎月末日',
                  paymentDayText: tpl?.payment_day_text || '翌月25日振込',
                  bonusPolicy: '会社業績および個人の勤務成績により支給する（年2回）',
                  raisePolicy: `定期昇給または業務能力の評価による給与改定（${signModalDoc.applied_year_month}分改定: ${signModalDoc.reason_note || '定期改定'}）`,
                  retirementAllowance: '会社の退職金規程による',
                  healthInsuranceJoined: true,
                  pensionInsuranceJoined: true,
                  employmentInsuranceJoined: true,
                  workersCompJoined: true,
                  createdDate: signModalDoc.revision_date,
                  isEmployeeSigned: signModalDoc.status === 'signed',
                  employeeSignedAt: signModalDoc.signed_at,
                  employeeSignatureImage: undefined,
                  docCategory: 'revision',
                  appliedYearMonth: signModalDoc.applied_year_month,
                  revisionDate: signModalDoc.revision_date,
                  revisionType: signModalDoc.revision_type || '定期改定',
                  previousBaseSalary: signModalDoc.previous_base_salary,
                  diffBaseSalary: signModalDoc.diff_base_salary,
                  revisionRate: signModalDoc.revision_rate,
                  revisionReasonNote: signModalDoc.reason_note
                };

                return <OfficialLaborContractDoc data={contractData} />;
              })()}
            </div>

            {/* フッター（押印アクション） */}
            <div className="p-4 px-6 border-t border-slate-200 bg-white flex items-center justify-between gap-3 print:hidden shrink-0">
              <button
                onClick={() => setSignModalDoc(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                閉じる
              </button>

              {signModalDoc.status === 'pending_signature' ? (
                <button
                  onClick={() => handleSignContract(signModalDoc.id)}
                  disabled={isSigning}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  内容に同意し、電子印鑑を押印する
                </button>
              ) : (
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{signModalDoc.signed_at?.slice(0, 16).replace('T', ' ')} 本人合意押印済み</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
