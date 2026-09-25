import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Baby, Calendar, CheckCircle2, 
  Upload, Trash2, Loader2, Sparkles, UserCheck, ShieldCheck,
  Heart, ArrowRight, ArrowLeft, Phone, FileText, Check
} from 'lucide-react';
import { 
  type MaternityLeaveRecord,
  DEFAULT_MATERNITY_CHECKLIST,
  calculateMaternityDates,
  generateResidentTaxAdvanceSchedule,
  submitEmployeeMaternityApplication,
  fetchMaternityLeaveRecord
} from '../lib/maternityLeave';
import { compressImageFile } from '../lib/imageCompressor';

export default function EmployeeMaternityApplication() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URLパラメータまたはログイン情報からの取得
  const tenantIdParam = searchParams.get('tenant_id') || '';
  const userIdParam = searchParams.get('user_id') || '';
  const nameParam = searchParams.get('name') || '';

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // 会社・テナント情報
  const [tenantId, setTenantId] = useState<string>(tenantIdParam);
  const [companyName, setCompanyName] = useState<string>('会社名');

  // 社員情報
  const [userId, setUserId] = useState<string>(userIdParam);
  const [employeeName, setEmployeeName] = useState<string>(nameParam);
  const [employeeResidentTax, setEmployeeResidentTax] = useState<number>(15000);
  const [residentTaxDetails, setResidentTaxDetails] = useState<Record<string, number>>({});

  // 入力ステップ (1: 予定日・期間, 2: 連絡先・子情報, 3: 書類添付, 4: 精算希望・確認)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // 申請フォームステート
  const [formData, setFormData] = useState<{
    pregnancyType: 'single' | 'multiple';
    expectedBirthDate: string;
    actualBirthDate: string;
    maternityStartDate: string;
    maternityEndDate: string;
    childcareStartDate: string;
    childcareEndDate: string;
    returnToWorkDate: string;
    childcareExtended: 'none' | '1_year_6_months' | '2_years';
    childName: string;
    childBirthDate: string;
    childRelationship: string;
    contactPhone: string;
    contactEmail: string;
    contactLineId: string;
    remarks: string;
    handbookPhotoUrl: string;
    handbookPhotoFilename: string;
    handbookFileSize: string;
    settlementPreference: 'deduct_from_salary' | 'monthly_transfer' | 'lump_sum_return';
    applicantSignature: string;
  }>({
    pregnancyType: 'single',
    expectedBirthDate: '',
    actualBirthDate: '',
    maternityStartDate: '',
    maternityEndDate: '',
    childcareStartDate: '',
    childcareEndDate: '',
    returnToWorkDate: '',
    childcareExtended: 'none',
    childName: '',
    childBirthDate: '',
    childRelationship: '実子',
    contactPhone: '',
    contactEmail: '',
    contactLineId: '',
    remarks: '',
    handbookPhotoUrl: '',
    handbookPhotoFilename: '',
    handbookFileSize: '',
    settlementPreference: 'deduct_from_salary',
    applicantSignature: ''
  });

  // 初期化：認証・URLパラメータ・既存申請の読み込み
  useEffect(() => {
    initApplication();
  }, [tenantIdParam, userIdParam]);

  const initApplication = async () => {
    setLoading(true);
    try {
      let activeTenantId = tenantIdParam;
      let activeUserId = userIdParam;

      // ログイン確認
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (!activeUserId) activeUserId = session.user.id;
        if (!activeTenantId) {
          const { data: tId } = await supabase.rpc('get_user_tenant_id');
          if (tId) activeTenantId = tId;
        }
      }

      setTenantId(activeTenantId);
      setUserId(activeUserId);

      // テナント名取得
      if (activeTenantId) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name')
          .eq('id', activeTenantId)
          .maybeSingle();
        if (tenant?.name) {
          setCompanyName(tenant.name);
        }
      }

      // ユーザー情報取得（氏名・電話・住民税など）
      if (activeUserId) {
        const { data: userDoc } = await supabase
          .from('users')
          .select('name, email, phone')
          .eq('id', activeUserId)
          .maybeSingle();

        const { data: payDoc } = await supabase
          .from('employee_payroll_profiles')
          .select('resident_tax_monthly, resident_tax_details')
          .eq('user_id', activeUserId)
          .maybeSingle();

        if (userDoc) {
          if (!employeeName && userDoc.name) setEmployeeName(userDoc.name);
          setFormData(prev => ({
            ...prev,
            contactEmail: prev.contactEmail || userDoc.email || '',
            contactPhone: prev.contactPhone || userDoc.phone || '',
            applicantSignature: prev.applicantSignature || userDoc.name || employeeName || ''
          }));
        }

        if (payDoc) {
          if (payDoc.resident_tax_monthly) setEmployeeResidentTax(payDoc.resident_tax_monthly);
          if (payDoc.resident_tax_details) setResidentTaxDetails(payDoc.resident_tax_details);
        }

        // 既存の産休データがあれば読み込む
        if (activeTenantId) {
          const existing = await fetchMaternityLeaveRecord(activeTenantId, activeUserId);
          if (existing) {
            setFormData(prev => ({
              ...prev,
              pregnancyType: existing.pregnancy_type || 'single',
              expectedBirthDate: existing.expected_birth_date || '',
              actualBirthDate: existing.actual_birth_date || '',
              maternityStartDate: existing.maternity_leave_start_date || '',
              maternityEndDate: existing.maternity_leave_end_date || '',
              childcareStartDate: existing.childcare_leave_start_date || '',
              childcareEndDate: existing.childcare_leave_end_date || '',
              returnToWorkDate: existing.return_to_work_date || '',
              childcareExtended: existing.childcare_extended || 'none',
              childName: existing.child_name || '',
              childBirthDate: existing.child_birth_date || '',
              childRelationship: existing.child_relationship || '実子',
              contactPhone: existing.contact_phone || prev.contactPhone,
              contactEmail: existing.contact_email || prev.contactEmail,
              contactLineId: existing.contact_line_id || '',
              remarks: existing.remarks || '',
              handbookPhotoUrl: existing.attachment_handbook_url || '',
              handbookPhotoFilename: existing.attachment_handbook_filename || '',
              settlementPreference: (existing.resident_tax_settlement_preference as any) || 'deduct_from_salary',
              applicantSignature: existing.applicant_signature_name || prev.applicantSignature
            }));
          }
        }
      }

      if (nameParam && !employeeName) {
        setEmployeeName(nameParam);
        setFormData(prev => ({ ...prev, applicantSignature: nameParam }));
      }
    } catch (err) {
      console.error('initApplication error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 出産予定日または単胎/多胎が変更された際の期間自動計算
  const handleCalculateDates = (birthDate: string, type: 'single' | 'multiple', ext: 'none' | '1_year_6_months' | '2_years') => {
    if (!birthDate) return;
    const calc = calculateMaternityDates({
      expectedBirthDate: birthDate,
      pregnancyType: type,
      childcareExtended: ext
    });

    setFormData(prev => ({
      ...prev,
      expectedBirthDate: birthDate,
      pregnancyType: type,
      childcareExtended: ext,
      maternityStartDate: calc.maternityLeaveStartDate,
      maternityEndDate: calc.maternityLeaveEndDate,
      childcareStartDate: calc.childcareLeaveStartDate,
      childcareEndDate: calc.childcareLeaveEndDate,
      returnToWorkDate: calc.returnToWorkDate
    }));
  };

  // 母子手帳画像アップロード（圧縮処理付き）
  const handleHandbookFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await compressImageFile(file, { maxWidth: 1600, quality: 0.85 });
      setFormData(prev => ({
        ...prev,
        handbookPhotoUrl: result.base64,
        handbookPhotoFilename: file.name,
        handbookFileSize: `${(result.compressedSize / 1024).toFixed(0)} KB`
      }));
    } catch (err) {
      console.error('File compress error:', err);
      alert('画像の読み込みに失敗しました。別の形式または容量の小さい画像をお試しください。');
    }
  };

  // 申請送信処理
  const handleSubmit = async () => {
    if (!formData.expectedBirthDate) {
      alert('出産予定日を入力してください。');
      setStep(1);
      return;
    }
    if (!formData.applicantSignature.trim()) {
      alert('申請者氏名（電子署名）を入力してください。');
      setStep(4);
      return;
    }

    setIsSubmitting(true);
    try {
      let effectiveTenantId = tenantId;
      let effectiveUserId = userId;
      let effectiveName = (employeeName || formData.applicantSignature || '申請社員').trim();

      // セッションからテナント・ユーザーUUIDをフォールバック解決
      if (!effectiveTenantId || !effectiveUserId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            if (!effectiveUserId) effectiveUserId = session.user.id;
            if (!effectiveTenantId) {
              const { data: tId } = await supabase.rpc('get_user_tenant_id');
              if (tId) effectiveTenantId = tId;
            }
          }
        } catch (_) {}
      }

      // 氏名で users テーブルから正規UUIDを照合解決（UUID形式違反の400エラー完全防止）
      if (effectiveTenantId && (!effectiveUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveUserId))) {
        try {
          const { data: matchedUser } = await supabase
            .from('users')
            .select('id, name')
            .eq('tenant_id', effectiveTenantId)
            .eq('name', effectiveName)
            .maybeSingle();
          if (matchedUser?.id) {
            effectiveUserId = matchedUser.id;
          }
        } catch (_) {}
      }

      // 住民税立替スケジュール自動生成（SSOT連動）
      const taxSchedule = generateResidentTaxAdvanceSchedule({
        leaveStartDate: formData.maternityStartDate || formData.expectedBirthDate,
        leaveEndDate: formData.childcareEndDate || formData.returnToWorkDate || formData.maternityEndDate,
        monthlyResidentTax: employeeResidentTax,
        monthlyDetails: residentTaxDetails
      });

      const record: MaternityLeaveRecord = {
        tenant_id: effectiveTenantId || '',
        user_id: effectiveUserId || '',
        application_date: new Date().toISOString().split('T')[0],
        pregnancy_type: formData.pregnancyType,
        expected_birth_date: formData.expectedBirthDate,
        actual_birth_date: formData.actualBirthDate || undefined,
        maternity_leave_start_date: formData.maternityStartDate,
        maternity_leave_end_date: formData.maternityEndDate,
        childcare_leave_start_date: formData.childcareStartDate,
        childcare_leave_end_date: formData.childcareEndDate,
        return_to_work_date: formData.returnToWorkDate,
        childcare_extended: formData.childcareExtended,
        child_name: formData.childName,
        child_birth_date: formData.childBirthDate || undefined,
        child_relationship: formData.childRelationship,
        contact_phone: formData.contactPhone,
        contact_email: formData.contactEmail,
        contact_line_id: formData.contactLineId,
        remarks: formData.remarks,
        checklist: DEFAULT_MATERNITY_CHECKLIST,
        attachment_handbook_url: formData.handbookPhotoUrl || undefined,
        attachment_handbook_filename: formData.handbookPhotoFilename || undefined,
        resident_tax_advance: taxSchedule,
        resident_tax_settlement_preference: formData.settlementPreference,
        applicant_signature_name: formData.applicantSignature
      };

      const res = await submitEmployeeMaternityApplication({
        tenantId: effectiveTenantId || '',
        userId: effectiveUserId || '',
        employeeName: effectiveName,
        record
      });

      if (res.success) {
        setIsCompleted(true);
      } else {
        const errMsg = res.error?.message || res.error?.details || JSON.stringify(res.error) || '通信環境をご確認ください';
        alert(`申請の送信に失敗しました: ${errMsg}`);
      }
    } catch (err: any) {
      console.error('handleSubmit error:', err);
      alert(`エラーが発生しました: ${err?.message || '労務担当者へお問い合わせください'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-pink-600 mx-auto" />
          <p className="text-sm font-bold text-slate-600">申請画面を読み込んでいます...</p>
        </div>
      </div>
    );
  }

  // 送信完了画面
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-pink-100 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-pink-100 text-pink-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-10 h-10 text-pink-600" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-black tracking-wider uppercase px-2.5 py-1 bg-pink-50 text-pink-600 rounded-full">
              Application Submitted
            </span>
            <h2 className="text-xl font-black text-slate-800">
              産休・育休の申請が完了しました
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              ご入力いただいた内容および母子手帳の提出を社内労務システムへ正常に送信いたしました。<br />
              会社の労務担当者が申請内容を確認後、公的手続き（年金事務所への免除申請等）を進めます。
            </p>
          </div>

          <div className="bg-pink-50/50 p-4 rounded-2xl border border-pink-100 text-left text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-pink-100/80 pb-1.5">
              <span className="text-slate-500">申請者</span>
              <span className="font-bold text-slate-800">{employeeName || formData.applicantSignature}</span>
            </div>
            <div className="flex items-center justify-between border-b border-pink-100/80 pb-1.5">
              <span className="text-slate-500">出産予定日</span>
              <span className="font-bold text-pink-700">{formData.expectedBirthDate}</span>
            </div>
            <div className="flex items-center justify-between border-b border-pink-100/80 pb-1.5">
              <span className="text-slate-500">産前産後休業</span>
              <span className="font-bold text-slate-800">{formData.maternityStartDate} 〜 {formData.maternityEndDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">復職予定日</span>
              <span className="font-bold text-indigo-700">{formData.returnToWorkDate}</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/portal');
                }
              }}
              className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              確認して画面を閉じる
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      {/* モバイルヘッダー */}
      <header className="bg-white border-b border-pink-100 sticky top-0 z-30 shadow-xs">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center">
              <Baby className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-slate-800 text-sm leading-tight">
                産前産後・育児休業 取得申請
              </h1>
              <p className="text-[10px] text-slate-400">
                {companyName} 労務手続きステーション
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
              Step {step}/4
            </span>
          </div>
        </div>

        {/* 進捗ステップバー */}
        <div className="w-full bg-pink-100/50 h-1">
          <div 
            className="bg-pink-600 h-1 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4">
        {/* 社員名・案内バナー */}
        <div className="bg-white p-4 rounded-2xl border border-pink-100/80 shadow-xs mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400">申請者</div>
              <div className="font-bold text-xs text-slate-800">
                {employeeName ? `${employeeName} 様` : '従業員 ご本人様'}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-pink-600 bg-pink-50 font-bold px-2 py-1 rounded-lg">
            スマホで完結
          </div>
        </div>

        {/* ステップ1: 出産予定日 ＆ 期間自動計算 */}
        {step === 1 && (
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-pink-600" />
              <h2 className="font-bold text-sm text-slate-800">
                1. 出産予定日 ＆ 休業期間の確認
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              母子健康手帳に記載されている「分べん予定日」を入力してください。法令に基づき産前・産後・育児休業の期間が自動計算されます。
            </p>

            {/* 単胎・多胎選択 */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                単胎 / 多胎（双子以上）<span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCalculateDates(formData.expectedBirthDate, 'single', formData.childcareExtended)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    formData.pregnancyType === 'single'
                      ? 'bg-pink-50 border-pink-500 text-pink-700 ring-2 ring-pink-200'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Baby className="w-3.5 h-3.5" />
                  単胎（1人）
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculateDates(formData.expectedBirthDate, 'multiple', formData.childcareExtended)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    formData.pregnancyType === 'multiple'
                      ? 'bg-pink-50 border-pink-500 text-pink-700 ring-2 ring-pink-200'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  多胎（双子以上）
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                ※ 多胎の場合は産前休業が14週間（98日前）から取得可能となります。
              </p>
            </div>

            {/* 出産予定日 */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                出産予定日（分べん予定日）<span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.expectedBirthDate}
                onChange={e => handleCalculateDates(e.target.value, formData.pregnancyType, formData.childcareExtended)}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 text-xs font-bold text-slate-800"
                required
              />
            </div>

            {/* 育児休業の取得予定期間 */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                育児休業の希望期間
              </label>
              <select
                value={formData.childcareExtended}
                onChange={e => handleCalculateDates(formData.expectedBirthDate, formData.pregnancyType, e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-pink-500 text-xs font-bold text-slate-800 bg-white"
              >
                <option value="none">原則：満1歳の誕生日前日まで（標準）</option>
                <option value="1_year_6_months">延長：1歳6ヶ月まで（保育所未決定等の場合）</option>
                <option value="2_years">延長：2歳まで（再延長の場合）</option>
              </select>
            </div>

            {/* 自動計算結果カード */}
            {formData.expectedBirthDate && (
              <div className="bg-gradient-to-br from-pink-50/70 to-indigo-50/50 p-4 rounded-2xl border border-pink-100 space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 text-pink-700 font-bold text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  法定 自動計算スケジュール
                </div>
                
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-pink-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400">産前休業（出産前）</div>
                      <div className="font-bold text-slate-800">{formData.maternityStartDate} 〜 {formData.expectedBirthDate}</div>
                    </div>
                    <span className="text-[10px] text-pink-600 bg-pink-50 font-bold px-2 py-0.5 rounded-full">
                      {formData.pregnancyType === 'multiple' ? '98日間' : '42日間'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-pink-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400">産後休業（出産後）</div>
                      <div className="font-bold text-slate-800">
                        {formData.expectedBirthDate} 翌日 〜 {formData.maternityEndDate}
                      </div>
                    </div>
                    <span className="text-[10px] text-pink-600 bg-pink-50 font-bold px-2 py-0.5 rounded-full">
                      56日間（8週）
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-indigo-500">育児休業期間</div>
                      <div className="font-bold text-slate-800">{formData.childcareStartDate} 〜 {formData.childcareEndDate}</div>
                    </div>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 font-bold px-2 py-0.5 rounded-full">
                      育休
                    </span>
                  </div>

                  <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                    <div className="text-[11px] font-bold text-indigo-900">復職予定日</div>
                    <div className="font-black text-indigo-700 text-xs">{formData.returnToWorkDate}</div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!formData.expectedBirthDate}
              onClick={() => setStep(2)}
              className="w-full py-3 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              次へ：連絡先 ＆ お子様の情報
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ステップ2: 連絡先 ＆ 子情報 */}
        {step === 2 && (
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Phone className="w-4 h-4 text-pink-600" />
              <h2 className="font-bold text-sm text-slate-800">
                2. 休業中の連絡先 ＆ お子様の情報
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              休業期間中の諸連絡（公的手続きの進捗連絡や復職前の打合せ等）に使用する緊急連絡先をご入力ください。
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                休業中の電話番号<span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={e => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                placeholder="090-1234-5678"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-pink-500 text-xs font-bold"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                休業中のメールアドレス<span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={e => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                placeholder="example@gmail.com"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-pink-500 text-xs font-bold"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                LINE ID / 緊急メッセージ連絡先（任意）
              </label>
              <input
                type="text"
                value={formData.contactLineId}
                onChange={e => setFormData(prev => ({ ...prev, contactLineId: e.target.value }))}
                placeholder="line_id_123"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-pink-500 text-xs font-bold"
              />
            </div>

            {/* お子様の情報（出生前は空欄でOK） */}
            <div className="pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                お子様のお名前（未定の場合は空欄で可）
              </label>
              <input
                type="text"
                value={formData.childName}
                onChange={e => setFormData(prev => ({ ...prev, childName: e.target.value }))}
                placeholder="例：山田 太郎（決まり次第で構いません）"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-pink-500 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                実出産日（※すでに出産後の申請・変更の場合のみ入力）
              </label>
              <input
                type="date"
                value={formData.actualBirthDate}
                onChange={e => setFormData(prev => ({ ...prev, actualBirthDate: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-pink-500 text-xs font-bold"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                戻る
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-2/3 py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                次へ：母子手帳写真の提出
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ステップ3: 母子手帳アップロード */}
        {step === 3 && (
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Upload className="w-4 h-4 text-pink-600" />
              <h2 className="font-bold text-sm text-slate-800">
                3. 母子健康手帳（証憑写真）の提出
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              年金事務所やハローワークへの法令届出（社会保険料免除届・給付金申請等）のため、**母子手帳の「表紙（市区町村印・保護者名）」または「分べん予定日・妊娠週数記載ページ」**の写真またはPDFをアップロードしてください。
            </p>

            <div className="border-2 border-dashed border-pink-200 rounded-2xl p-4 text-center bg-pink-50/30 space-y-3">
              {formData.handbookPhotoUrl ? (
                <div className="space-y-2">
                  <div className="relative inline-block">
                    <img 
                      src={formData.handbookPhotoUrl} 
                      alt="母子手帳プレビュー" 
                      className="max-h-48 rounded-xl shadow-md mx-auto object-contain border border-pink-200"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        handbookPhotoUrl: '',
                        handbookPhotoFilename: '',
                        handbookFileSize: ''
                      }))}
                      className="absolute -top-2 -right-2 p-1.5 bg-rose-600 text-white rounded-full shadow-md hover:bg-rose-700 transition cursor-pointer"
                      title="削除して再選択"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px] font-bold text-slate-700">
                    {formData.handbookPhotoFilename}
                    {formData.handbookFileSize && ` (${formData.handbookFileSize})`}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    正常に読み込まれました（高画質軽量化済）
                  </div>
                </div>
              ) : (
                <label className="block cursor-pointer py-4">
                  <div className="w-12 h-12 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    写真またはファイルを選択
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    スマホカメラで撮影した写真、または画像ファイル（JPG, PNG）
                  </p>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    capture="environment"
                    onChange={handleHandbookFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-500 space-y-1">
              <div className="font-bold text-slate-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-pink-600" />
                セキュリティとお取り扱いについて
              </div>
              <p>
                アップロードいただいた画像は暗号化され、労務公的手続きの目的にのみ安全に保管されます。後からの差し替えや再提出も可能です。
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                戻る
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-2/3 py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                次へ：住民税立替 ＆ 最終確認
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ステップ4: 精算希望 ＆ 最終確認・署名 */}
        {step === 4 && (
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-pink-600" />
              <h2 className="font-bold text-sm text-slate-800">
                4. 住民税の立替精算希望 ＆ 申請送信
              </h2>
            </div>

            {/* 住民税立替についての説明 */}
            <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100 space-y-1.5 text-xs">
              <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                休業期間中の特別徴収住民税について
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                産休・育休中は社会保険料は法令により全額免除となりますが、前年所得に対する**住民税は免除されません**。無給期間中は会社が市町村へ代理納付（立替）いたしますので、復職時等のご希望の精算方法を選択してください。
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                住民税立替分の精算方針（希望）
              </label>
              <div className="space-y-2 text-xs">
                <label className={`p-3 rounded-xl border block cursor-pointer transition ${
                  formData.settlementPreference === 'deduct_from_salary'
                    ? 'bg-pink-50 border-pink-400 text-pink-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="settlementPreference"
                    value="deduct_from_salary"
                    checked={formData.settlementPreference === 'deduct_from_salary'}
                    onChange={() => setFormData(prev => ({ ...prev, settlementPreference: 'deduct_from_salary' }))}
                    className="mr-2 accent-pink-600"
                  />
                  復職後の給与から分割天引き精算（推奨）
                </label>

                <label className={`p-3 rounded-xl border block cursor-pointer transition ${
                  formData.settlementPreference === 'monthly_transfer'
                    ? 'bg-pink-50 border-pink-400 text-pink-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="settlementPreference"
                    value="monthly_transfer"
                    checked={formData.settlementPreference === 'monthly_transfer'}
                    onChange={() => setFormData(prev => ({ ...prev, settlementPreference: 'monthly_transfer' }))}
                    className="mr-2 accent-pink-600"
                  />
                  休業期間中に毎月指定口座へ振込精算
                </label>

                <label className={`p-3 rounded-xl border block cursor-pointer transition ${
                  formData.settlementPreference === 'lump_sum_return'
                    ? 'bg-pink-50 border-pink-400 text-pink-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="settlementPreference"
                    value="lump_sum_return"
                    checked={formData.settlementPreference === 'lump_sum_return'}
                    onChange={() => setFormData(prev => ({ ...prev, settlementPreference: 'lump_sum_return' }))}
                    className="mr-2 accent-pink-600"
                  />
                  復職時に一括振込精算
                </label>
              </div>
            </div>

            {/* 備考欄 */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                会社・労務担当者への連絡事項・備考（任意）
              </label>
              <textarea
                rows={2}
                value={formData.remarks}
                onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="ご相談事項や特記事項がございましたらご記入ください"
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-pink-500 text-xs font-normal"
              />
            </div>

            {/* 署名欄 */}
            <div className="bg-pink-50/40 p-4 rounded-2xl border border-pink-100 space-y-2">
              <label className="text-xs font-black text-slate-800 block">
                申請者署名（フルネーム）<span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.applicantSignature}
                onChange={e => setFormData(prev => ({ ...prev, applicantSignature: e.target.value }))}
                placeholder="例：山田 花子"
                className="w-full p-2.5 rounded-xl border border-pink-300 focus:border-pink-500 text-xs font-bold bg-white"
                required
              />
              <p className="text-[10px] text-slate-400">
                ※ 氏名の入力をもって、産前産後休業および育児休業の電子申請の署名とみなします。
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                戻る
              </button>
              <button
                type="button"
                disabled={isSubmitting || !formData.applicantSignature.trim()}
                onClick={handleSubmit}
                className="w-2/3 py-3 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    申請を確定・送信する
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
