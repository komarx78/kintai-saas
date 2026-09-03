import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  DollarSign, Printer, FileText, Loader2, CheckCircle2, Sparkles, X, Check
} from 'lucide-react';
import { OfficialPayslipDoc } from './OfficialPayslipDoc';
import { OfficialLaborContractDoc, type LaborContractData } from './OfficialLaborContractDoc';
import { getRevisionContracts, signRevisionContract, type RevisionContractDoc } from '../lib/revisionContracts';
import { getLaborContractTemplateFromStorage } from '../lib/laborContractTemplate';

interface UserPayslipViewProps {
  userId: string;
  userName: string;
  tenantId?: string | null;
}

export const UserPayslipView: React.FC<UserPayslipViewProps> = ({ userId, userName, tenantId }) => {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [tenantName, setTenantName] = useState<string>('株式会社KAP');
  const [companySealUrl, setCompanySealUrl] = useState<string>('');

  // 📄 労働条件通知書（賃金改定版）電子押印State
  const [myContracts, setMyContracts] = useState<RevisionContractDoc[]>([]);
  const [signModalDoc, setSignModalDoc] = useState<RevisionContractDoc | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    const fetchPayslips = async () => {
      setIsLoading(true);
      try {
        // 会社名 ＆ 社印の取得
        if (tenantId) {
          try {
            const { data: tData } = await supabase.from('tenants').select('name, company_seal_url').eq('id', tenantId).maybeSingle();
            if (tData?.name) setTenantName(tData.name);
            if (tData?.company_seal_url) setCompanySealUrl(tData.company_seal_url);
          } catch (tErr) {
            console.warn('Tenant fetch error:', tErr);
          }
        }

        // LocalStorage からの会社名・社印フォールバック取得
        try {
          const sealStored = (tenantId ? localStorage.getItem(`company_seal_image_${tenantId}`) : null) || 
                             localStorage.getItem('company_seal_image');
          if (sealStored) {
            setCompanySealUrl(sealStored);
          } else {
            const basicRaw = (tenantId ? localStorage.getItem(`company_basic_settings_${tenantId}`) : null) || 
                             localStorage.getItem('company_basic_info');
            if (basicRaw) {
              const basicParsed = JSON.parse(basicRaw);
              if (basicParsed.name) setTenantName(basicParsed.name);
              if (basicParsed.company_seal_url) setCompanySealUrl(basicParsed.company_seal_url);
            }
          }
        } catch (e) {}

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

        // 📄 本人の労働条件通知書（改定版）取得
        if (tenantId) {
          const allDocs = getRevisionContracts(tenantId);
          const mine = allDocs.filter(d => d.user_id === userId || (userName && d.user_name === userName));
          setMyContracts(mine);

          try {
            const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
            const { data: cmsData } = await supabase.from('company_master_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
            setCompanySettings({ ...tData, ...cmsData });
          } catch (e) {}
        }
      } catch (e) {
        console.error('Fetch user payslip error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayslips();
  }, [userId, userName, tenantId]);

  const handleSignContract = (docId: string) => {
    if (!tenantId) return;
    setIsSigning(true);
    try {
      const signed = signRevisionContract(tenantId, docId, userName || '本人');
      if (signed) {
        const allDocs = getRevisionContracts(tenantId);
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
    <div className="space-y-6 animate-in fade-in duration-300">
      
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

      {/* 上部ヘッダー */}
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

        {/* 支給月セレクター */}
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
        /* マネーフォワード給与公式フォーマット 給与明細書 */
        <div id="user-payslip-print-area" className="bg-white rounded-2xl border border-slate-300 shadow-xl overflow-hidden print:border-none print:shadow-none print:rounded-none">
          <OfficialPayslipDoc
            payslip={selectedPayslip}
            userName={userName}
            tenantName={tenantName}
            companySealUrl={companySealUrl}
          />
        </div>
      )}

      {/* 📄 労働条件通知書（賃金改定版）合意・電子押印モーダル */}
      {signModalDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:p-0 print:bg-white">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-100 overflow-hidden print:border-none print:shadow-none print:max-h-none">
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
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/50 print:p-0 print:bg-white">
              {(() => {
                const tpl = getLaborContractTemplateFromStorage(tenantId || '');
                const repName = companySettings?.representative_name || 
                                (companySettings?.representative ? `代表取締役 ${companySettings.representative}` : '代表取締役 駒井 秀一朗');
                const compSeal = companySealUrl || companySettings?.company_seal_url || tpl?.company_seal_url;

                const contractData: LaborContractData = {
                  companyName: companySettings?.name || tenantName || '株式会社KAP',
                  companyAddress: companySettings?.address || '滋賀県大津市坂本3丁目21-16',
                  representativeName: repName,
                  companySealUrl: compSeal,
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
