import React, { useState, useEffect } from 'react';
import { 
  X, Save, Printer, Calendar, Clock, CheckSquare, 
  AlertCircle, Sparkles, Upload, Eye, Loader2,
  Baby, ShieldCheck, CheckCircle2, UserCheck, DollarSign,
  Smartphone, Copy, Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  type MaternityLeaveRecord, 
  DEFAULT_MATERNITY_CHECKLIST,
  calculateMaternityDates,
  generateResidentTaxAdvanceSchedule,
  fetchMaternityLeaveRecord,
  saveMaternityLeaveRecord
} from '../lib/maternityLeave';
import { OfficialMaternityLeaveDoc } from './OfficialMaternityLeaveDoc';
import { compressImageFile } from '../lib/imageCompressor';

export interface MaternityLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onOpenInviteUrl?: () => void;
  initialRecord?: MaternityLeaveRecord | null;
  companyInfo: {
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number?: string;
    company_seal_url?: string;
  };
  employee: {
    user_id: string;
    name: string;
    name_kana?: string;
    department?: string;
    birth_date?: string;
    join_date: string;
    address?: string;
    phone?: string;
    email?: string;
    resident_tax_monthly?: number;
    resident_tax_details?: Record<string, number>;
  };
  onSaved?: () => void;
}

export const MaternityLeaveModal: React.FC<MaternityLeaveModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  onOpenInviteUrl,
  initialRecord,
  companyInfo,
  employee,
  onSaved
}) => {
  const [activeTab, setActiveTab] = useState<'input' | 'checklist' | 'tax_advance' | 'preview'>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // フォームステート
  const [record, setRecord] = useState<MaternityLeaveRecord>({
    tenant_id: tenantId,
    user_id: employee.user_id,
    application_date: new Date().toISOString().split('T')[0],
    pregnancy_type: 'single',
    expected_birth_date: '',
    actual_birth_date: '',
    maternity_leave_start_date: '',
    maternity_leave_end_date: '',
    childcare_leave_start_date: '',
    childcare_leave_end_date: '',
    return_to_work_date: '',
    childcare_extended: 'none',
    child_name: '',
    child_birth_date: '',
    child_relationship: '実子',
    child_my_number: '',
    contact_phone: employee.phone || '',
    contact_email: employee.email || '',
    contact_line_id: '',
    remarks: '',
    checklist: { ...DEFAULT_MATERNITY_CHECKLIST },
    resident_tax_advance: {
      startDate: '',
      records: [],
      totalAmount: 0,
      settledAmount: 0
    }
  });

  // 初期データ取得＆社員申請原本からの多重フォールバック完全復元
  useEffect(() => {
    if (!isOpen || !tenantId || !employee.user_id) return;
    const loadData = async () => {
      setIsLoading(true);

      let foundRecord: MaternityLeaveRecord | null = null;

      // 1. propsで渡された initialRecord があれば最優先
      if (initialRecord && (initialRecord.expected_birth_date || initialRecord.maternity_leave_start_date)) {
        foundRecord = initialRecord;
      }

      // 2. DB (employee_maternity_leaves) から検索
      if (!foundRecord) {
        const existing = await fetchMaternityLeaveRecord(tenantId, employee.user_id);
        if (existing && (existing.expected_birth_date || existing.maternity_leave_start_date)) {
          foundRecord = existing;
        }
      }

      // 3. localStorage から検索
      if (!foundRecord) {
        try {
          const localStr = localStorage.getItem(`maternity_leave_record_${employee.user_id}`);
          if (localStr) {
            const parsed = JSON.parse(localStr);
            if (parsed && (parsed.expected_birth_date || parsed.maternity_leave_start_date)) {
              foundRecord = parsed;
            }
          }
        } catch (_) {}
      }

      // 4. employee_document_submissions から検索（社員がスマホで申請した大元データ！）
      if (!foundRecord) {
        try {
          // user_id で検索
          let { data: subData } = await supabase
            .from('employee_document_submissions')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('document_type', 'maternity_leave')
            .eq('user_id', employee.user_id)
            .order('created_at', { ascending: false })
            .limit(1);

          // user_id でヒットしなければ氏名で検索（名前の空白ゆれにも完全対応）
          if ((!subData || subData.length === 0) && employee.name) {
            const { data: nameSubData } = await supabase
              .from('employee_document_submissions')
              .select('*')
              .eq('tenant_id', tenantId)
              .eq('document_type', 'maternity_leave')
              .order('created_at', { ascending: false })
              .limit(20);

            if (nameSubData && nameSubData.length > 0) {
              const cleanTarget = (employee.name || '').replace(/[\s　]+/g, '').trim();
              const matched = nameSubData.find((s: any) => {
                const sName = (s.data?.employee_name || s.data?.applicant_signature_name || s.user_name || '').replace(/[\s　]+/g, '').trim();
                return (cleanTarget && sName.includes(cleanTarget)) || (s.title && s.title.replace(/[\s　]+/g, '').includes(cleanTarget));
              });
              if (matched) subData = [matched];
            }
          }

          if (subData && subData.length > 0) {
            const sub = subData[0];
            const d = sub.data || {};
            foundRecord = {
              id: sub.id,
              tenant_id: tenantId,
              user_id: employee.user_id,
              application_date: sub.created_at ? sub.created_at.split('T')[0] : (d.application_date || new Date().toISOString().split('T')[0]),
              pregnancy_type: d.pregnancy_type || 'single',
              expected_birth_date: d.expected_birth_date || '',
              actual_birth_date: d.actual_birth_date || null,
              maternity_leave_start_date: d.maternity_leave_start_date || '',
              maternity_leave_end_date: d.maternity_leave_end_date || '',
              childcare_leave_start_date: d.childcare_leave_start_date || null,
              childcare_leave_end_date: d.childcare_leave_end_date || null,
              return_to_work_date: d.return_to_work_date || null,
              childcare_extended: d.childcare_extended || 'none',
              child_name: d.child_name || '',
              child_birth_date: d.child_birth_date || null,
              child_relationship: d.child_relationship || '実子',
              child_my_number: d.child_my_number || '',
              contact_phone: d.contact_phone || employee.phone || '',
              contact_email: d.contact_email || employee.email || '',
              contact_line_id: d.contact_line_id || '',
              remarks: d.remarks || '',
              checklist: d.checklist || DEFAULT_MATERNITY_CHECKLIST,
              attachment_handbook_url: sub.attachment_data || d.attachment_handbook_url || null,
              attachment_handbook_filename: sub.attachment_filename || d.attachment_handbook_filename || '母子手帳写真.jpg',
              status: sub.status === 'approved' ? 'approved' : 'submitted',
              submitted_at: sub.created_at || new Date().toISOString(),
              approved_at: sub.approved_at || null,
              resident_tax_advance: d.resident_tax_advance || {
                startDate: '',
                records: [],
                totalAmount: 0,
                settledAmount: 0
              },
              resident_tax_settlement_preference: d.resident_tax_settlement_preference || 'deduct_from_salary',
              applicant_signature_name: d.applicant_signature_name || d.employee_name || employee.name || ''
            };
          }
        } catch (subErr) {
          console.warn('Fallback fetch from employee_document_submissions error:', subErr);
        }
      }

      if (foundRecord) {
        // 出産予定日がある場合、期間や住民税スケジュールが未計算であれば自動計算
        let updatedRecord = { ...foundRecord };
        const expDate = updatedRecord.expected_birth_date;
        if (expDate) {
          if (!updatedRecord.maternity_leave_start_date || !updatedRecord.return_to_work_date) {
            const calc = calculateMaternityDates({
              expectedBirthDate: expDate,
              pregnancyType: updatedRecord.pregnancy_type || 'single',
              actualBirthDate: updatedRecord.actual_birth_date || undefined,
              childcareExtended: updatedRecord.childcare_extended || 'none'
            });
            updatedRecord.maternity_leave_start_date = calc.maternityLeaveStartDate;
            updatedRecord.maternity_leave_end_date = calc.maternityLeaveEndDate;
            updatedRecord.childcare_leave_start_date = calc.childcareLeaveStartDate;
            updatedRecord.childcare_leave_end_date = calc.childcareLeaveEndDate;
            updatedRecord.return_to_work_date = calc.returnToWorkDate;
          }

          if (!updatedRecord.resident_tax_advance || !Array.isArray(updatedRecord.resident_tax_advance.records) || updatedRecord.resident_tax_advance.records.length === 0) {
            const taxSched = generateResidentTaxAdvanceSchedule({
              leaveStartDate: updatedRecord.maternity_leave_start_date,
              leaveEndDate: updatedRecord.childcare_leave_end_date || updatedRecord.maternity_leave_end_date,
              monthlyResidentTax: employee.resident_tax_monthly || 0,
              monthlyDetails: employee.resident_tax_details
            });
            updatedRecord.resident_tax_advance = taxSched;
          }
        }

        setRecord({
          ...updatedRecord,
          checklist: { ...DEFAULT_MATERNITY_CHECKLIST, ...(updatedRecord.checklist || {}) },
          resident_tax_advance: updatedRecord.resident_tax_advance || {
            startDate: '',
            records: [],
            totalAmount: 0,
            settledAmount: 0
          }
        });
      } else {
        // 初期値
        setRecord(prev => ({
          ...prev,
          tenant_id: tenantId,
          user_id: employee.user_id,
          contact_phone: employee.phone || '',
          contact_email: employee.email || ''
        }));
      }
      setIsLoading(false);
    };
    loadData();
  }, [isOpen, tenantId, employee.user_id, initialRecord]);

  // 出産予定日・単胎多胎・実出産日の変更時に期間を自動計算
  const handleAutoCalculateDates = (overrideParams?: {
    expectedBirthDate?: string;
    pregnancyType?: 'single' | 'multiple';
    actualBirthDate?: string;
    childcareExtended?: 'none' | '1_year_6_months' | '2_years';
  }) => {
    const expDate = overrideParams?.expectedBirthDate ?? record.expected_birth_date;
    const pType = overrideParams?.pregnancyType ?? record.pregnancy_type;
    const actDate = overrideParams?.actualBirthDate ?? record.actual_birth_date;
    const cExt = overrideParams?.childcareExtended ?? record.childcare_extended;

    if (!expDate) return;

    const calc = calculateMaternityDates({
      expectedBirthDate: expDate,
      pregnancyType: pType,
      actualBirthDate: actDate,
      childcareExtended: cExt
    });

    const newMaternityStart = calc.maternityLeaveStartDate;
    const newMaternityEnd = calc.maternityLeaveEndDate;
    const newChildcareStart = calc.childcareLeaveStartDate;
    const newChildcareEnd = calc.childcareLeaveEndDate;
    const newReturnDate = calc.returnToWorkDate;

    // 住民税立替スケジュールも連動再計算
    const taxSchedule = generateResidentTaxAdvanceSchedule({
      leaveStartDate: newMaternityStart,
      leaveEndDate: newChildcareEnd || newMaternityEnd,
      monthlyResidentTax: employee.resident_tax_monthly || 0,
      monthlyDetails: employee.resident_tax_details,
      existingRecords: record.resident_tax_advance?.records
    });

    setRecord(prev => ({
      ...prev,
      expected_birth_date: expDate,
      pregnancy_type: pType,
      actual_birth_date: actDate,
      childcare_extended: cExt,
      maternity_leave_start_date: newMaternityStart,
      maternity_leave_end_date: newMaternityEnd,
      childcare_leave_start_date: newChildcareStart,
      childcare_leave_end_date: newChildcareEnd,
      return_to_work_date: newReturnDate,
      resident_tax_advance: taxSchedule
    }));
  };

  // ファイル添付ハンドラー (Base64圧縮保存)
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'handbook' | 'certificate' | 'mynumber'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, { maxWidth: 1600, quality: 0.8 });
      const dataUrl = compressed.base64;

      if (type === 'handbook') {
        setRecord(prev => ({
          ...prev,
          attachment_handbook_url: dataUrl,
          attachment_handbook_filename: file.name,
          checklist: { ...prev.checklist, attached_maternal_handbook_1: true }
        }));
      } else if (type === 'certificate') {
        setRecord(prev => ({
          ...prev,
          attachment_certificate_url: dataUrl,
          attachment_certificate_filename: file.name,
          checklist: { ...prev.checklist, attached_maternal_handbook_2: true }
        }));
      } else if (type === 'mynumber') {
        setRecord(prev => ({
          ...prev,
          attachment_mynumber_url: dataUrl,
          attachment_mynumber_filename: file.name,
          checklist: { ...prev.checklist, attached_child_mynumber: true }
        }));
      }
    } catch (err) {
      console.error('File upload error:', err);
      alert('ファイルの読み込みに失敗しました。');
    }
  };

  // 保存処理 (実DB永続化)
  const handleSave = async () => {
    if (!record.expected_birth_date) {
      alert('出産予定日を入力してください。');
      return;
    }
    setIsSaving(true);
    const res = await saveMaternityLeaveRecord(record);
    setIsSaving(false);
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onSaved) onSaved();
    } else {
      alert('保存に失敗しました: ' + (res.error?.message || '不明なエラー'));
    }
  };

  // チェックリスト進捗率
  const checklistTotal = Object.keys(record.checklist).length;
  const checklistCompleted = Object.values(record.checklist).filter(Boolean).length;
  const checklistPercent = Math.round((checklistCompleted / checklistTotal) * 100);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* モーダルヘッダー (印刷非表示) */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-500 text-white flex items-center justify-center shadow-md shadow-pink-200">
              <Baby className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-pink-100 text-pink-700">
                  労務管理ステーション
                </span>
                <span className="text-xs text-slate-400 font-bold">法定休業・給付連動</span>
              </div>
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <span>産前産後・育児休業 手続き＆書類管理</span>
                <span className="text-sm font-bold text-slate-600">[{employee.name} 殿]</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isLoading && (
              <span className="text-xs text-slate-400 flex items-center gap-1 font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-500" />
                読込中...
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (onOpenInviteUrl) {
                  onOpenInviteUrl();
                } else {
                  setShowInviteModal(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 transition cursor-pointer shadow-xs"
              title="社員のスマホで入力してもらう専用URLを発行"
            >
              <Smartphone className="w-3.5 h-3.5 text-pink-600" />
              <span>📱 社員にURLを送付</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black shadow-xs transition cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isSaving ? (
                <span>保存中...</span>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  保存完了！
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  実DBへ保存
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ナビゲーションタブ (印刷非表示) */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-white print:hidden">
          <button
            onClick={() => setActiveTab('input')}
            className={`px-4 py-2.5 text-xs font-black border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'input'
                ? 'border-pink-600 text-pink-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            期間自動計算 ＆ 基本情報
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-4 py-2.5 text-xs font-black border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'checklist'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            手続きチェック ＆ 証憑提出
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 font-bold">
              {checklistPercent}%
            </span>
          </button>
          <button
            onClick={() => setActiveTab('tax_advance')}
            className={`px-4 py-2.5 text-xs font-black border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'tax_advance'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            住民税立替表（原本④）
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-bold">
              ¥{(record.resident_tax_advance?.totalAmount || 0).toLocaleString()}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2.5 text-xs font-black border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'preview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Printer className="w-4 h-4" />
            公式A4印刷プレビュー（原本1〜4）
          </button>
        </div>

        {/* モーダルコンテンツ (スクロールエリア) */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 print:p-0 print:bg-white">

          {/* =================================================================== */}
          {/* TAB 1: 期間自動計算 ＆ 基本情報 */}
          {/* =================================================================== */}
          {activeTab === 'input' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              
              {/* 自動計算トリガーカード */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-pink-600" />
                    <h3 className="font-bold text-sm text-slate-800">
                      出産予定日 ＆ 期間自動計算エンジン（労働基準法・育介法準拠）
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-bold">単胎: 産前42日 / 多胎: 産前98日</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      申請年月日 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={record.application_date}
                      onChange={e => setRecord({ ...record, application_date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      出産予定日 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={record.expected_birth_date}
                      onChange={e => {
                        const val = e.target.value;
                        setRecord(prev => ({ ...prev, expected_birth_date: val }));
                        handleAutoCalculateDates({ expectedBirthDate: val });
                      }}
                      className="w-full bg-pink-50/50 border border-pink-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      胎数（単胎 / 多胎） <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-3 pt-1">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="pregnancy_type"
                          value="single"
                          checked={record.pregnancy_type === 'single'}
                          onChange={() => {
                            setRecord(prev => ({ ...prev, pregnancy_type: 'single' }));
                            handleAutoCalculateDates({ pregnancyType: 'single' });
                          }}
                          className="w-4 h-4 text-pink-600"
                        />
                        単胎（産前6週/42日）
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="pregnancy_type"
                          value="multiple"
                          checked={record.pregnancy_type === 'multiple'}
                          onChange={() => {
                            setRecord(prev => ({ ...prev, pregnancy_type: 'multiple' }));
                            handleAutoCalculateDates({ pregnancyType: 'multiple' });
                          }}
                          className="w-4 h-4 text-pink-600"
                        />
                        多胎（産前14週/98日）
                      </label>
                    </div>
                  </div>
                </div>

                {/* 実出産日と予定日のズレ（変更申請対応） */}
                <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      実出産日（※出産後に確定・入力）
                    </label>
                    <input
                      type="date"
                      value={record.actual_birth_date || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setRecord(prev => ({ ...prev, actual_birth_date: val }));
                        handleAutoCalculateDates({ actualBirthDate: val });
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      育児休業の延長区分
                    </label>
                    <select
                      value={record.childcare_extended || 'none'}
                      onChange={e => {
                        const val = e.target.value as any;
                        setRecord(prev => ({ ...prev, childcare_extended: val }));
                        handleAutoCalculateDates({ childcareExtended: val });
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-500"
                    >
                      <option value="none">原則満1歳（誕生日前日まで）</option>
                      <option value="1_year_6_months">1歳6ヶ月まで延長（保育園不承諾等）</option>
                      <option value="2_years">2歳まで再延長（保育園不承諾等）</option>
                    </select>
                  </div>
                </div>

                {/* ズレ通知バナー */}
                {record.actual_birth_date && record.expected_birth_date && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      実出産日が確定しました。原本③の実務ルールに基づき、
                      「産前産後休業取得（変更）申請書②」および年金事務所への「産休変更届②」を提出してください。
                    </span>
                  </div>
                )}
              </div>

              {/* 自動算出された休業期間プレビュー */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <h4 className="font-bold text-xs text-slate-500 mb-4 tracking-wider uppercase flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  自動算出された休業期間 ＆ 復職予定スケジュール
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 産前産後休業 */}
                  <div className="p-4 rounded-xl bg-pink-50/60 border border-pink-200">
                    <span className="text-[11px] font-bold text-pink-700 block mb-1">
                      ① 産前休業期間
                    </span>
                    <div className="font-black text-sm text-slate-800">
                      {record.maternity_leave_start_date || '—'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      〜 出産当日まで
                    </div>

                    <div className="border-t border-pink-200/80 my-2.5"></div>

                    <span className="text-[11px] font-bold text-pink-700 block mb-1">
                      ② 産後休業期間（出産翌日〜56日後）
                    </span>
                    <div className="font-black text-sm text-slate-800">
                      {record.maternity_leave_end_date ? (
                        <span>〜 {record.maternity_leave_end_date} まで</span>
                      ) : '—'}
                    </div>
                  </div>

                  {/* 育児休業 */}
                  <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200">
                    <span className="text-[11px] font-bold text-indigo-700 block mb-1">
                      ③ 育児休業期間
                    </span>
                    <div className="font-black text-sm text-slate-800">
                      {record.childcare_leave_start_date || '—'}
                    </div>
                    <div className="text-xs text-slate-500 my-0.5">〜</div>
                    <div className="font-black text-sm text-slate-800">
                      {record.childcare_leave_end_date || '—'} まで
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      ※産後終了の翌日〜満1歳の誕生日前日
                    </p>
                  </div>

                  {/* 復職予定日 */}
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-emerald-700 block mb-1">
                      ④ 復職（予定）日
                    </span>
                    <div className="font-black text-lg text-emerald-900">
                      {record.return_to_work_date || '—'}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      育休終了の翌日に職場復帰
                    </p>
                  </div>
                </div>
              </div>

              {/* 子の情報 ＆ 休業中連絡先 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 子の情報 */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <h4 className="font-bold text-xs text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <Baby className="w-4 h-4 text-pink-600" />
                    休業に係るお子様の情報（原本②準拠）
                  </h4>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">お子様の氏名</label>
                    <input
                      type="text"
                      placeholder="例: 山田 太郎（出生前は空欄可）"
                      value={record.child_name || ''}
                      onChange={e => setRecord({ ...record, child_name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">続柄</label>
                      <input
                        type="text"
                        value={record.child_relationship || '実子'}
                        onChange={e => setRecord({ ...record, child_relationship: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">マイナンバー</label>
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="12桁の番号"
                        value={record.child_my_number || ''}
                        onChange={e => setRecord({ ...record, child_my_number: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 休業中の連絡先 */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <h4 className="font-bold text-xs text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    休業中の連絡先（原本①準拠）
                  </h4>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">電話番号（ＴＥＬ）</label>
                    <input
                      type="text"
                      value={record.contact_phone || ''}
                      onChange={e => setRecord({ ...record, contact_phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">メール（ＭＡＩＬ）</label>
                    <input
                      type="text"
                      value={record.contact_email || ''}
                      onChange={e => setRecord({ ...record, contact_email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">ＬＩＮＥ ＩＤ</label>
                    <input
                      type="text"
                      placeholder="LINE ID (任意)"
                      value={record.contact_line_id || ''}
                      onChange={e => setRecord({ ...record, contact_line_id: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 備考 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">備考（特記事項・引継ぎ等）</label>
                <textarea
                  rows={3}
                  value={record.remarks || ''}
                  onChange={e => setRecord({ ...record, remarks: e.target.value })}
                  placeholder="休業に関する特記事項や社内引継ぎに関するメモを入力してください。"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800"
                />
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 2: 手続きチェック ＆ 証憑提出 (原本3完全準拠) */}
          {/* =================================================================== */}
          {activeTab === 'checklist' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              
              {/* プログレスバー */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between gap-6">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">手続き・書類回収 進捗ステータス</h3>
                  <p className="text-xs text-slate-500 mt-0.5">全{checklistTotal}項目中、{checklistCompleted}項目完了</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-48 bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                    <div
                      className="bg-teal-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${checklistPercent}%` }}
                    />
                  </div>
                  <span className="font-black text-sm text-teal-700">{checklistPercent}%</span>
                </div>
              </div>

              {/* 原本3記載の3大区分チェックリスト */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* 1. 社内書類 */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800 block">📁 社内書類</span>
                    <span className="text-[10px] text-slate-400">従業員本人 ➔ 会社へ提出</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={record.checklist.internal_maternity_app_1}
                        onChange={e => setRecord({
                          ...record,
                          checklist: { ...record.checklist, internal_maternity_app_1: e.target.checked }
                        })}
                        className="w-4 h-4 text-teal-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-800">産前産後休業申請書①</span>
                        <p className="text-[10px] text-slate-500">休業前・出産予定日で提出</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={record.checklist.internal_maternity_app_2}
                        onChange={e => setRecord({
                          ...record,
                          checklist: { ...record.checklist, internal_maternity_app_2: e.target.checked }
                        })}
                        className="w-4 h-4 text-teal-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-800">産前産後休業申請書②</span>
                        <p className="text-[10px] text-slate-500">休業後・実出産日確定時に提出</p>
                      </div>
                    </label>

                    <div className="border-t border-slate-100 pt-2 my-1"></div>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={record.checklist.internal_childcare_app_1}
                        onChange={e => setRecord({
                          ...record,
                          checklist: { ...record.checklist, internal_childcare_app_1: e.target.checked }
                        })}
                        className="w-4 h-4 text-teal-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-800">育児休業申請書①</span>
                        <p className="text-[10px] text-slate-500">産休明けに育休へ入る時</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={record.checklist.internal_childcare_app_2}
                        onChange={e => setRecord({
                          ...record,
                          checklist: { ...record.checklist, internal_childcare_app_2: e.target.checked }
                        })}
                        className="w-4 h-4 text-teal-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-800">育児休業申請書②</span>
                        <p className="text-[10px] text-slate-500">保育園不承諾等で延長する時</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 2. 添付書類 ＆ 証憑ファイルアップロード */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800 block">📎 添付書類（エビデンス）</span>
                    <span className="text-[10px] text-slate-400">写しの提出・クラウド保存</span>
                  </div>

                  {/* 母子手帳① */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={record.checklist.attached_maternal_handbook_1}
                          onChange={e => setRecord({
                            ...record,
                            checklist: { ...record.checklist, attached_maternal_handbook_1: e.target.checked }
                          })}
                          className="w-4 h-4 text-teal-600 rounded"
                        />
                        母子手帳①（表紙・予定日）
                      </label>
                    </div>
                    {record.attachment_handbook_url ? (
                      <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <span className="truncate max-w-[120px] text-[11px] font-medium text-slate-700">
                          {record.attachment_handbook_filename || '母子手帳写し'}
                        </span>
                        <a
                          href={record.attachment_handbook_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 font-bold hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3 h-3" /> 表示
                        </a>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-1.5 p-2 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:bg-slate-100/80 cursor-pointer text-xs">
                        <Upload className="w-3 h-3" />
                        <span>写しをアップロード</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={e => handleFileUpload(e, 'handbook')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* 母子手帳② 出生証明 */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={record.checklist.attached_maternal_handbook_2}
                        onChange={e => setRecord({
                          ...record,
                          checklist: { ...record.checklist, attached_maternal_handbook_2: e.target.checked }
                        })}
                        className="w-4 h-4 text-teal-600 rounded"
                      />
                      母子手帳②（出生届出済証明）
                    </label>
                    {record.attachment_certificate_url ? (
                      <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <span className="truncate max-w-[120px] text-[11px] font-medium text-slate-700">
                          {record.attachment_certificate_filename || '出生証明写し'}
                        </span>
                        <a
                          href={record.attachment_certificate_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 font-bold hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3 h-3" /> 表示
                        </a>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-1.5 p-2 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:bg-slate-100/80 cursor-pointer text-xs">
                        <Upload className="w-3 h-3" />
                        <span>写しをアップロード</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={e => handleFileUpload(e, 'certificate')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* 子のマイナンバー */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={record.checklist.attached_child_mynumber}
                        onChange={e => setRecord({
                          ...record,
                          checklist: { ...record.checklist, attached_child_mynumber: e.target.checked }
                        })}
                        className="w-4 h-4 text-teal-600 rounded"
                      />
                      お子様のマイナンバー
                    </label>
                    {record.attachment_mynumber_url ? (
                      <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <span className="truncate max-w-[120px] text-[11px] font-medium text-slate-700">
                          {record.attachment_mynumber_filename || '住民票写し'}
                        </span>
                        <a
                          href={record.attachment_mynumber_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 font-bold hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3 h-3" /> 表示
                        </a>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-1.5 p-2 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:bg-slate-100/80 cursor-pointer text-xs">
                        <Upload className="w-3 h-3" />
                        <span>住民票等をアップロード</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={e => handleFileUpload(e, 'mynumber')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* 3. 社外届出（年金機構・健保） */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800 block">🏛️ 社外届出（年金機構・健保）</span>
                    <span className="text-[10px] text-slate-400">会社 ➔ 行政手続き</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={record.checklist.external_maternity_notice_1}
                        onChange={e => setRecord({
                          ...record,
                          checklist: { ...record.checklist, external_maternity_notice_1: e.target.checked }
                        })}
                        className="w-4 h-4 text-teal-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-800">産休取得者申出書①</span>
                        <p className="text-[10px] text-slate-500">産休開始時（保険料免除）</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={record.checklist.external_maternity_notice_2}
                        onChange={e => setRecord({
                          ...record,
                          checklist: { ...record.checklist, external_maternity_notice_2: e.target.checked }
                        })}
                        className="w-4 h-4 text-teal-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-800">産休変更（終了）届②</span>
                        <p className="text-[10px] text-slate-500">実出産日確定・ズレ発生時</p>
                      </div>
                    </label>

                    <div className="border-t border-slate-100 pt-2 my-1"></div>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={record.checklist.external_childcare_notice_1}
                        onChange={e => setRecord({
                          ...record,
                          checklist: { ...record.checklist, external_childcare_notice_1: e.target.checked }
                        })}
                        className="w-4 h-4 text-teal-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-800">育休等取得者申出書①</span>
                        <p className="text-[10px] text-slate-500">育休開始時（保険料免除）</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={record.checklist.external_childcare_notice_2}
                        onChange={e => setRecord({
                          ...record,
                          checklist: { ...record.checklist, external_childcare_notice_2: e.target.checked }
                        })}
                        className="w-4 h-4 text-teal-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-800">育休等取得者申出書②</span>
                        <p className="text-[10px] text-slate-500">育休延長時</p>
                      </div>
                    </label>

                    <div className="border-t border-slate-100 pt-2 my-1"></div>

                    <label className="flex items-start gap-2.5 cursor-pointer bg-rose-50/60 p-2 rounded-lg border border-rose-200">
                      <input
                        type="checkbox"
                        checked={record.checklist.dependent_health_insurance_added}
                        onChange={e => setRecord({
                          ...record,
                          checklist: { ...record.checklist, dependent_health_insurance_added: e.target.checked }
                        })}
                        className="w-4 h-4 text-rose-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-rose-800">子の健康保険被扶養者異動届</span>
                        <p className="text-[10px] text-rose-600">※健診・保険証発行に1〜10日要</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* 原本3記載の実務アラート・ガイダンス */}
              <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-5 text-xs text-slate-700 space-y-2.5">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  実務ガイドライン（原本3記載の注意事項）
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  💡 <span className="font-bold text-slate-800">マイナンバーの早期取得について:</span><br />
                  年金事務所への届出にはお子様のマイナンバーが必要です。出生届を提出した後に、役所窓口にて
                  「マイナンバー記載ありの住民票」を発行請求すれば即日確認・取得が可能です。
                </p>
                <p className="text-slate-600 leading-relaxed">
                  💡 <span className="font-bold text-rose-700">お子様を会社の健康保険扶養に入れる場合:</span><br />
                  乳児健診や予防接種等に健康保険証が必要となります。発行には届出から1週間〜10日前後かかりますので、
                  出生後は速やかに被扶養者異動届および生計維持確認資料を提出してください。
                </p>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 3: 住民税立替表 (原本4完全準拠) */}
          {/* =================================================================== */}
          {activeTab === 'tax_advance' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* サマリーカード */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-sm text-slate-800">
                      住民税立替管理（原本④準拠）
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    休職開始日: <span className="font-bold text-slate-800">{record.maternity_leave_start_date || '未設定'}</span>
                    {' '}/ 従業員台帳設定月額: <span className="font-bold text-slate-800">¥{(employee.resident_tax_monthly || 0).toLocaleString()}</span>
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">会社立替総累計額</span>
                    <span className="text-xl font-black text-rose-600">
                      ¥{(record.resident_tax_advance?.totalAmount || 0).toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      const newSchedule = generateResidentTaxAdvanceSchedule({
                        leaveStartDate: record.maternity_leave_start_date,
                        leaveEndDate: record.childcare_leave_end_date || record.maternity_leave_end_date,
                        monthlyResidentTax: employee.resident_tax_monthly || 0,
                        monthlyDetails: employee.resident_tax_details,
                        existingRecords: record.resident_tax_advance?.records
                      });
                      setRecord(prev => ({ ...prev, resident_tax_advance: newSchedule }));
                    }}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    台帳マトリクス再生成
                  </button>
                </div>
              </div>

              {/* 年・月別マトリクス編集テーブル */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h4 className="font-bold text-xs text-slate-700">月別立替額 編集・集計テーブル</h4>
                  <span className="text-[11px] text-slate-400">※各月の数値を直接変更可能です</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 font-bold text-slate-700">
                        <th className="py-2.5 px-3 border-r border-slate-200 w-24">年度 / 年</th>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                          <th key={m} className="py-2 px-1 border-r border-slate-200 w-16">
                            {m}月
                          </th>
                        ))}
                        <th className="py-2.5 px-3 bg-amber-50/80 text-amber-900 font-bold border-r border-slate-200 w-28">
                          年別小計
                        </th>
                        <th className="py-2.5 px-3 w-24">精算状況</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.resident_tax_advance?.records && record.resident_tax_advance.records.length > 0 ? (
                        record.resident_tax_advance.records.map((rec, yrIdx) => (
                          <tr key={rec.year} className="border-b border-slate-200 hover:bg-slate-50/60">
                            <td className="py-3 px-2 font-bold bg-slate-50 border-r border-slate-200 text-slate-800">
                              {rec.year} 年
                            </td>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                              const amt = rec.monthlyAmounts ? Number(rec.monthlyAmounts[m] || 0) : 0;
                              return (
                                <td key={m} className="p-1 border-r border-slate-200">
                                  <input
                                    type="number"
                                    value={amt}
                                    onChange={e => {
                                      const val = Number(e.target.value) || 0;
                                      const updatedRecords = [...record.resident_tax_advance.records];
                                      const cur = { ...updatedRecords[yrIdx] };
                                      cur.monthlyAmounts = { ...cur.monthlyAmounts, [m]: val };
                                      cur.subtotal = Object.values(cur.monthlyAmounts).reduce((a, b) => a + Number(b), 0);
                                      updatedRecords[yrIdx] = cur;

                                      const totalAmount = updatedRecords.reduce((s, r) => s + r.subtotal, 0);
                                      const settledAmount = updatedRecords.filter(r => r.isSettled).reduce((s, r) => s + r.subtotal, 0);

                                      setRecord(prev => ({
                                        ...prev,
                                        resident_tax_advance: {
                                          ...prev.resident_tax_advance,
                                          records: updatedRecords,
                                          totalAmount,
                                          settledAmount
                                        }
                                      }));
                                    }}
                                    className={`w-full text-center py-1 rounded border text-xs ${
                                      amt > 0
                                        ? 'font-bold bg-amber-50/60 border-amber-300 text-slate-800'
                                        : 'text-slate-300 border-transparent hover:border-slate-200'
                                    }`}
                                  />
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 font-bold bg-amber-50/40 text-amber-900 border-r border-slate-200">
                              ¥{(rec.subtotal || 0).toLocaleString()}
                            </td>
                            <td className="py-2 px-2">
                              <label className="inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={rec.isSettled || false}
                                  onChange={e => {
                                    const updatedRecords = [...record.resident_tax_advance.records];
                                    updatedRecords[yrIdx].isSettled = e.target.checked;
                                    const settledAmount = updatedRecords.filter(r => r.isSettled).reduce((s, r) => s + r.subtotal, 0);
                                    setRecord(prev => ({
                                      ...prev,
                                      resident_tax_advance: {
                                        ...prev.resident_tax_advance,
                                        records: updatedRecords,
                                        settledAmount
                                      }
                                    }));
                                  }}
                                  className="w-3.5 h-3.5 text-emerald-600 rounded"
                                />
                                <span className={rec.isSettled ? 'text-emerald-700' : 'text-slate-400'}>
                                  {rec.isSettled ? '精算済' : '未精算'}
                                </span>
                              </label>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={15} className="py-8 text-slate-400">
                            休業期間が設定されていません。まずは「期間自動計算」タブで出産予定日を設定してください。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 精算方針 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">立替金の精算方法</label>
                  <select
                    value={record.resident_tax_advance?.settlementMethod || 'payroll_deduction'}
                    onChange={e => setRecord({
                      ...record,
                      resident_tax_advance: {
                        ...record.resident_tax_advance,
                        settlementMethod: e.target.value as any
                      }
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="payroll_deduction">復職後の給与から分割天引き</option>
                    <option value="bank_transfer">従業員からの指定口座振込（月別または一括）</option>
                    <option value="lump_sum">復職時の一括現金精算</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">精算に関するメモ</label>
                  <input
                    type="text"
                    value={record.resident_tax_advance?.remarks || ''}
                    placeholder="例: 〇年〇月より月々15,000円天引き予定"
                    onChange={e => setRecord({
                      ...record,
                      resident_tax_advance: {
                        ...record.resident_tax_advance,
                        remarks: e.target.value
                      }
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 4: 公式A4印刷プレビュー (原本1〜4) */}
          {/* =================================================================== */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <OfficialMaternityLeaveDoc
                companyInfo={companyInfo}
                employee={{
                  id: employee.user_id,
                  name: employee.name,
                  name_kana: employee.name_kana,
                  department: employee.department,
                  birth_date: employee.birth_date,
                  join_date: employee.join_date,
                  address: employee.address,
                  phone: record.contact_phone || employee.phone,
                  email: record.contact_email || employee.email
                }}
                record={record}
              />
            </div>
          )}
        </div>
      </div>

      {/* 📱 社員向け 産休・育休申請URL発行モーダル */}
      {showInviteModal && (() => {
        const targetUrl = `${window.location.origin}/maternity/apply?tenant_id=${tenantId}&user_id=${employee.user_id}&name=${encodeURIComponent(employee.name || '')}`;
        const defaultMessage = `${employee.name} 様\n\nお疲れ様です。${companyInfo.name || '会社'} 労務担当です。\n産前産後休業・育児休業の手続きのため、以下の専用URLより出産予定日や休業期間等の入力、および母子健康手帳の写真提出をお願い申し上げます。\n\n▼ 産休・育休申請フォーム（スマートフォン対応）\n${targetUrl}\n\n※ ご不明な点がございましたら労務担当までお気軽にご連絡ください。`;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-60 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center font-bold shadow-xs">
                    <Baby className="w-5 h-5 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-base">
                      産休・育休 社員入力用URLの発行
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {employee.name} 様専用の申請フォームURLを発行し、LINEやメールで送信できます
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    専用申請URL（スマートフォン・PC両対応）
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={targetUrl}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-600 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(targetUrl);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2500);
                      }}
                      className="shrink-0 px-3.5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedUrl ? 'コピー完了' : 'URLコピー'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    社員送信用メッセージ定型文（LINE・チャット・メール用）
                  </label>
                  <textarea
                    readOnly
                    rows={5}
                    value={defaultMessage}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed font-sans select-all resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(defaultMessage);
                      setCopiedMessage(true);
                      setTimeout(() => setCopiedMessage(false), 2500);
                    }}
                    className="mt-2 w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {copiedMessage ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedMessage ? '定型文をコピーしました！' : 'メッセージ全文をコピーしてLINE・メールに貼付け'}
                  </button>
                </div>

                <div className="bg-pink-50/60 p-3 rounded-xl border border-pink-100 text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-pink-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    社員入力後の自動連携について
                  </div>
                  <p>
                    社員様がスマホから出産予定日や母子手帳の写真を送信すると、本システムの「提出書類審査」ビューに自動で届きます。管理者が承認するだけで、公的A4帳票（原本4枚）が即座に自動完成します。
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
export default MaternityLeaveModal;
