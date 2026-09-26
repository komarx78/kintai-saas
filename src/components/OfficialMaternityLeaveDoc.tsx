import React, { useState } from 'react';
import { Printer, ArrowLeft, CheckSquare, Square, AlertCircle } from 'lucide-react';
import type { MaternityLeaveRecord } from '../lib/maternityLeave';

export interface OfficialMaternityLeaveDocProps {
  companyInfo: {
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number?: string;
    company_seal_url?: string;
  };
  employee: {
    id: string;
    name: string;
    name_kana?: string;
    department?: string;
    birth_date?: string;
    join_date: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  record: MaternityLeaveRecord;
  onBack?: () => void;
}

export const OfficialMaternityLeaveDoc: React.FC<OfficialMaternityLeaveDocProps> = ({
  companyInfo,
  employee,
  record,
  onBack
}) => {
  // 表示ドキュメント種別
  // maternity: 産前産後休業申請書, childcare: 育児休業申請書, checklist: チェックリスト, tax_advance: 住民税立替表
  const [activeTab, setActiveTab] = useState<'maternity' | 'childcare' | 'checklist' | 'tax_advance'>('maternity');

  const handlePrint = () => {
    window.print();
  };

  const formatDateJp = (dateStr?: string) => {
    if (!dateStr) return { y: '　　', m: '　', d: '　' };
    const parts = dateStr.split('-');
    if (parts.length < 3) return { y: '　　', m: '　', d: '　' };
    return { y: parts[0], m: parts[1].replace(/^0/, ''), d: parts[2].replace(/^0/, '') };
  };

  const appDate = formatDateJp(record.application_date || new Date().toISOString().split('T')[0]);
  const expDate = formatDateJp(record.expected_birth_date);
  const actDate = formatDateJp(record.actual_birth_date);
  const mStart = formatDateJp(record.maternity_leave_start_date);
  const mEnd = formatDateJp(record.maternity_leave_end_date);
  const cStart = formatDateJp(record.childcare_leave_start_date);
  const cEnd = formatDateJp(record.childcare_leave_end_date);
  const retDate = formatDateJp(record.return_to_work_date);
  const childBirth = formatDateJp(record.child_birth_date || record.actual_birth_date || record.expected_birth_date);

  // 産後休業開始日（実出産日または予定日の翌日。月跨ぎ・月末オーバーフローを完全遮断）
  const rawBirthDate = record.actual_birth_date || record.expected_birth_date;
  const postPartumStartDate = rawBirthDate ? (() => {
    const d = new Date(rawBirthDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  })() : '';
  const postPartumStart = formatDateJp(postPartumStartDate);

  return (
    <div className="space-y-6">
      {/* 操作ヘッダー (印刷時は非表示) */}
      <div className="print:hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition cursor-pointer"
              title="戻る"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-pink-50 text-pink-700 border border-pink-200">
                👶 産前産後・育児休業 公式労務書類
              </span>
              <span className="text-xs text-slate-400 font-bold">A4公的証明・申請書式</span>
            </div>
            <h2 className="text-lg font-black text-slate-800 mt-1 flex items-center gap-2">
              <span>{employee.name} 殿</span>
              <span className="text-xs font-normal text-slate-500">（{employee.department || '—'}）</span>
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 書式切り替えタブ */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('maternity')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                activeTab === 'maternity' ? 'bg-white text-pink-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ① 産前産後休業申請書
            </button>
            <button
              onClick={() => setActiveTab('childcare')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                activeTab === 'childcare' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ② 育児休業申請書
            </button>
            <button
              onClick={() => setActiveTab('checklist')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                activeTab === 'checklist' ? 'bg-white text-teal-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ③ 手続きチェック＆マニュアル
            </button>
            <button
              onClick={() => setActiveTab('tax_advance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                activeTab === 'tax_advance' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ④ 住民税立替表
            </button>
          </div>

          {/* 印刷ボタン */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            公式A4印刷 / PDF保存
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📄 ① 産前産後休業取得（変更）申請書 (原本1完全準拠) */}
      {/* ========================================================================= */}
      {activeTab === 'maternity' && (
        <div className="official-maternity-print-container bg-white p-10 md:p-14 max-w-[210mm] mx-auto shadow-lg border border-slate-200 rounded-2xl print:shadow-none print:border-none print:p-8 print:m-0 print:w-[210mm]">
          {/* 右上：申請日＆氏名 */}
          <div className="flex justify-end mb-12">
            <div className="w-72 text-right text-sm text-slate-800">
              <div className="flex justify-end items-center gap-2 mb-3">
                <span className="font-medium">{appDate.y}</span> 年
                <span className="font-medium">{appDate.m}</span> 月
                <span className="font-medium">{appDate.d}</span> 日
              </div>
              <div className="flex items-end justify-between border-b-2 border-slate-800 pb-1 pt-2">
                <span className="text-xs text-slate-600 font-bold">氏名：</span>
                <span className="text-base font-bold tracking-wider">{employee.name}</span>
              </div>
            </div>
          </div>

          {/* 表題 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-widest text-slate-900 mb-3">
              産前産後休業取得（変更）申請書
            </h1>
            <p className="text-xs text-slate-700">
              下記のとおり、産前産後休業を取得（変更）いたします。
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              ※変更申請を提出される場合は、"産前産後休業取得（変更）申請書②"のシートを使用してください。
            </p>
          </div>

          {/* 申請内容テーブル (原本1完全一致) */}
          <div className="border-2 border-slate-800 rounded-xs overflow-hidden mb-12">
            {/* 出産予定日 */}
            <div className="grid grid-cols-4 border-b border-slate-800 min-h-[56px] items-center">
              <div className="col-span-1 bg-slate-50 h-full flex items-center justify-center font-bold text-sm text-slate-800 border-r border-slate-800 p-2 text-center">
                出産予定日
              </div>
              <div className="col-span-3 p-3 flex items-center justify-between px-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-16 text-center font-bold border-b border-slate-400">{expDate.y}</span> 年
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{expDate.m}</span> 月
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{expDate.d}</span> 日
                </div>
                <div className="flex items-center gap-6 text-sm font-medium">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={record.pregnancy_type === 'single'}
                      readOnly
                      className="w-4 h-4 rounded border-slate-400 text-slate-800"
                    />
                    <span>単胎</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={record.pregnancy_type === 'multiple'}
                      readOnly
                      className="w-4 h-4 rounded border-slate-400 text-slate-800"
                    />
                    <span>多胎</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 産前休業期間 */}
            <div className="grid grid-cols-4 border-b border-slate-800 min-h-[56px] items-center">
              <div className="col-span-1 bg-slate-50 h-full flex items-center justify-center font-bold text-sm text-slate-800 border-r border-slate-800 p-2 text-center">
                産前休業期間
              </div>
              <div className="col-span-3 p-3 flex items-center px-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-16 text-center font-bold border-b border-slate-400">{mStart.y}</span> 年
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{mStart.m}</span> 月
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{mStart.d}</span> 日
                  <span className="ml-3 text-slate-700">から出産当日まで</span>
                </div>
              </div>
            </div>

            {/* 産後休業期間 */}
            <div className="grid grid-cols-4 border-b border-slate-800 min-h-[72px] items-center">
              <div className="col-span-1 bg-slate-50 h-full flex items-center justify-center font-bold text-sm text-slate-800 border-r border-slate-800 p-2 text-center">
                産後休業期間
              </div>
              <div className="col-span-3 p-3 px-6 text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-16 text-center font-bold border-b border-slate-400">
                    {postPartumStart.y}
                  </span> 年
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">
                    {postPartumStart.m}
                  </span> 月
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">
                    {postPartumStart.d}
                  </span> 日
                  <span className="ml-3 text-slate-700">から</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-16 text-center font-bold border-b border-slate-400">{mEnd.y}</span> 年
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{mEnd.m}</span> 月
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{mEnd.d}</span> 日
                  <span className="ml-3 text-slate-700">まで</span>
                </div>
              </div>
            </div>

            {/* 休業中の連絡先 */}
            <div className="grid grid-cols-4 border-b border-slate-800 min-h-[96px] items-center">
              <div className="col-span-1 bg-slate-50 h-full flex items-center justify-center font-bold text-sm text-slate-800 border-r border-slate-800 p-2 text-center">
                休業中の連絡先
              </div>
              <div className="col-span-3 p-3 px-6 text-sm space-y-1.5">
                <div className="flex items-center">
                  <span className="w-20 text-slate-600 font-bold">（ＴＥＬ）</span>
                  <span className="font-medium">{record.contact_phone || employee.phone || '—'}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-20 text-slate-600 font-bold">（ＭＡＩＬ）</span>
                  <span className="font-medium">{record.contact_email || employee.email || '—'}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-20 text-slate-600 font-bold">（ＬＩＮＥ）</span>
                  <span className="font-medium">{record.contact_line_id || '—'}</span>
                </div>
              </div>
            </div>

            {/* 備考 */}
            <div className="grid grid-cols-4 min-h-[80px] items-center">
              <div className="col-span-1 bg-slate-50 h-full flex items-center justify-center font-bold text-sm text-slate-800 border-r border-slate-800 p-2 text-center">
                備考
              </div>
              <div className="col-span-3 p-3 px-6 text-sm text-slate-700 whitespace-pre-wrap">
                {record.remarks || '（特記事項なし）'}
              </div>
            </div>
          </div>

          {/* 下部：確認印欄 (会社承認) */}
          <div className="flex justify-end mt-16">
            <div className="w-80 border-2 border-slate-800 p-4 rounded-xs text-xs relative">
              <div className="text-center font-bold border-b border-slate-300 pb-1 mb-3 text-slate-800">
                確認印欄
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-600 font-bold">確認日：</span>
                <div className="flex items-center gap-1 font-medium">
                  <span>{appDate.y}</span> 年
                  <span>{appDate.m}</span> 月
                  <span>{appDate.d}</span> 日
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600 font-bold">確認者：</span>
                <span className="font-bold text-slate-900">{companyInfo.representative_name || '代表取締役'}</span>
              </div>
              <div className="text-right text-[10px] text-slate-500 mt-1">
                {companyInfo.name}
              </div>

              {/* 会社角印 */}
              {companyInfo.company_seal_url && (
                <div className="absolute right-4 bottom-2 opacity-85 pointer-events-none">
                  <img src={companyInfo.company_seal_url} alt="社印" className="w-16 h-16 object-contain" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📄 ② 育児休業取得（変更）申請書 (原本2完全準拠) */}
      {/* ========================================================================= */}
      {activeTab === 'childcare' && (
        <div className="official-maternity-print-container bg-white p-10 md:p-14 max-w-[210mm] mx-auto shadow-lg border border-slate-200 rounded-2xl print:shadow-none print:border-none print:p-8 print:m-0 print:w-[210mm]">
          {/* 右上：申請日＆氏名 */}
          <div className="flex justify-end mb-12">
            <div className="w-72 text-right text-sm text-slate-800">
              <div className="flex justify-end items-center gap-2 mb-3">
                <span className="font-medium">{appDate.y}</span> 年
                <span className="font-medium">{appDate.m}</span> 月
                <span className="font-medium">{appDate.d}</span> 日
              </div>
              <div className="flex items-end justify-between border-b-2 border-slate-800 pb-1 pt-2">
                <span className="text-xs text-slate-600 font-bold">氏名：</span>
                <span className="text-base font-bold tracking-wider">{employee.name}</span>
              </div>
            </div>
          </div>

          {/* 表題 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-widest text-slate-900 mb-3">
              育児休業取得（変更）申請書
            </h1>
            <p className="text-xs text-slate-700">
              下記のとおり、育児休業を取得（変更）いたします。
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              ※変更申請を提出される場合は、"育児休業取得（変更）申請書②"のシートを使用してください。
            </p>
          </div>

          {/* 申請内容テーブル (原本2完全一致) */}
          <div className="border-2 border-slate-800 rounded-xs overflow-hidden mb-12">
            {/* 出産日 */}
            <div className="grid grid-cols-4 border-b border-slate-800 min-h-[56px] items-center">
              <div className="col-span-1 bg-slate-50 h-full flex items-center justify-center font-bold text-sm text-slate-800 border-r border-slate-800 p-2 text-center">
                出産日
              </div>
              <div className="col-span-3 p-3 flex items-center justify-between px-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-16 text-center font-bold border-b border-slate-400">
                    {record.actual_birth_date ? actDate.y : expDate.y}
                  </span> 年
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">
                    {record.actual_birth_date ? actDate.m : expDate.m}
                  </span> 月
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">
                    {record.actual_birth_date ? actDate.d : expDate.d}
                  </span> 日
                </div>
                <div className="flex items-center gap-6 text-sm font-medium">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={record.pregnancy_type === 'single'}
                      readOnly
                      className="w-4 h-4 rounded border-slate-400 text-slate-800"
                    />
                    <span>単胎</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={record.pregnancy_type === 'multiple'}
                      readOnly
                      className="w-4 h-4 rounded border-slate-400 text-slate-800"
                    />
                    <span>多胎</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 休業に係る子の情報 */}
            <div className="grid grid-cols-4 border-b border-slate-800 min-h-[96px] items-center">
              <div className="col-span-1 bg-slate-50 h-full flex items-center justify-center font-bold text-sm text-slate-800 border-r border-slate-800 p-2 text-center">
                休業に係る子の情報
              </div>
              <div className="col-span-3 p-3 px-6 text-sm space-y-2">
                <div className="flex items-center">
                  <span className="w-20 text-slate-600 font-bold">氏名：</span>
                  <span className="font-bold text-slate-900">{record.child_name || '（出生届出後確定）'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 text-slate-600 font-bold">生年月日：</span>
                  <span className="inline-block w-14 text-center font-medium border-b border-slate-400">{childBirth.y}</span> 年
                  <span className="inline-block w-8 text-center font-medium border-b border-slate-400">{childBirth.m}</span> 月
                  <span className="inline-block w-8 text-center font-medium border-b border-slate-400">{childBirth.d}</span> 日
                </div>
                <div className="flex items-center">
                  <span className="w-20 text-slate-600 font-bold">続柄：</span>
                  <span className="font-medium">{record.child_relationship || '実子'}</span>
                </div>
              </div>
            </div>

            {/* 育児休業期間 */}
            <div className="grid grid-cols-4 border-b border-slate-800 min-h-[72px] items-center">
              <div className="col-span-1 bg-slate-50 h-full flex items-center justify-center font-bold text-sm text-slate-800 border-r border-slate-800 p-2 text-center">
                育児休業期間
              </div>
              <div className="col-span-3 p-3 px-6 text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-16 text-center font-bold border-b border-slate-400">{cStart.y}</span> 年
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{cStart.m}</span> 月
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{cStart.d}</span> 日
                  <span className="ml-3 text-slate-700">から</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-16 text-center font-bold border-b border-slate-400">{cEnd.y}</span> 年
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{cEnd.m}</span> 月
                  <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{cEnd.d}</span> 日
                  <span className="ml-3 text-slate-700">まで</span>
                  {record.childcare_extended === '1_year_6_months' && (
                    <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded ml-2">※1歳6ヶ月延長</span>
                  )}
                  {record.childcare_extended === '2_years' && (
                    <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded ml-2">※2歳延長</span>
                  )}
                </div>
              </div>
            </div>

            {/* 復職（予定）日 */}
            <div className="grid grid-cols-4 border-b border-slate-800 min-h-[56px] items-center">
              <div className="col-span-1 bg-slate-50 h-full flex items-center justify-center font-bold text-sm text-slate-800 border-r border-slate-800 p-2 text-center">
                復職（予定）日
              </div>
              <div className="col-span-3 p-3 px-6 text-sm flex items-center gap-2">
                <span className="inline-block w-16 text-center font-bold border-b border-slate-400">{retDate.y}</span> 年
                <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{retDate.m}</span> 月
                <span className="inline-block w-10 text-center font-bold border-b border-slate-400">{retDate.d}</span> 日
              </div>
            </div>

            {/* 備考 */}
            <div className="grid grid-cols-4 min-h-[80px] items-center">
              <div className="col-span-1 bg-slate-50 h-full flex items-center justify-center font-bold text-sm text-slate-800 border-r border-slate-800 p-2 text-center">
                備考
              </div>
              <div className="col-span-3 p-3 px-6 text-sm text-slate-700 whitespace-pre-wrap">
                {record.remarks || '（特記事項なし）'}
              </div>
            </div>
          </div>

          {/* 下部：確認印欄 (会社承認) */}
          <div className="flex justify-end mt-16">
            <div className="w-80 border-2 border-slate-800 p-4 rounded-xs text-xs relative">
              <div className="text-center font-bold border-b border-slate-300 pb-1 mb-3 text-slate-800">
                確認印欄
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-600 font-bold">確認日：</span>
                <div className="flex items-center gap-1 font-medium">
                  <span>{appDate.y}</span> 年
                  <span>{appDate.m}</span> 月
                  <span>{appDate.d}</span> 日
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600 font-bold">確認者：</span>
                <span className="font-bold text-slate-900">{companyInfo.representative_name || '代表取締役'}</span>
              </div>
              <div className="text-right text-[10px] text-slate-500 mt-1">
                {companyInfo.name}
              </div>

              {/* 会社角印 */}
              {companyInfo.company_seal_url && (
                <div className="absolute right-4 bottom-2 opacity-85 pointer-events-none">
                  <img src={companyInfo.company_seal_url} alt="社印" className="w-16 h-16 object-contain" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📋 ③ 手続きチェックリスト ＆ 実務マニュアル (原本3完全準拠) */}
      {/* ========================================================================= */}
      {activeTab === 'checklist' && (
        <div className="bg-white p-10 md:p-14 max-w-[210mm] mx-auto shadow-lg border border-slate-200 rounded-2xl print:shadow-none print:border-none print:p-6 print:m-0 print:max-w-none">
          <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
            <h1 className="text-xl font-bold tracking-wider text-slate-900">
              産前産後休業・育児休業 手続きチェックリスト ＆ 実務フロー
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              対象者: {employee.name} 殿 / 所属: {employee.department || '—'}
            </p>
          </div>

          {/* 3区分マトリクステーブル (原本3完全準拠) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* 社内書類 */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-2 mb-3 flex items-center justify-between">
                <span>📁 社内書類</span>
                <span className="text-[10px] font-normal text-slate-500">本人 ➔ 会社</span>
              </h3>
              <div className="space-y-2.5 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  {record.checklist.internal_maternity_app_1 ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">産前産後休業取得（変更）申請書①</span>
                    <p className="text-[10px] text-slate-500">休業前・出産予定日で提出</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {record.checklist.internal_maternity_app_2 ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">産前産後休業取得（変更）申請書②</span>
                    <p className="text-[10px] text-slate-500">休業後・実出産日確定時に提出</p>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2 my-1"></div>

                <div className="flex items-start gap-2">
                  {record.checklist.internal_childcare_app_1 ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">育児休業取得（変更）申請書①</span>
                    <p className="text-[10px] text-slate-500">産休明けにそのまま育休へ入る時</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {record.checklist.internal_childcare_app_2 ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">育児休業取得（変更）申請書②</span>
                    <p className="text-[10px] text-slate-500">保育園不承諾等で延長する時</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 添付書類 */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-2 mb-3 flex items-center justify-between">
                <span>📎 添付書類（エビデンス）</span>
                <span className="text-[10px] font-normal text-slate-500">写しの提出</span>
              </h3>
              <div className="space-y-2.5 text-xs text-slate-700">
                <div className="text-[11px] font-bold text-slate-500 bg-pink-50 px-2 py-0.5 rounded text-pink-700">
                  ［産前産後］
                </div>

                <div className="flex items-start gap-2">
                  {record.checklist.attached_maternal_handbook_1 ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">母子手帳①</span>
                    <p className="text-[10px] text-slate-500">表紙および出産予定日記載ページ</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {record.checklist.attached_maternal_handbook_2 ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">母子手帳②</span>
                    <p className="text-[10px] text-slate-500">出生届出済証明ページ</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {record.checklist.attached_child_mynumber ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">お子様のマイナンバー</span>
                    <p className="text-[10px] text-slate-500">出生届後の住民票（マイナ記載）等</p>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-slate-500 bg-indigo-50 px-2 py-0.5 rounded text-indigo-700 mt-3">
                  ［育児休業］
                </div>
                <p className="text-[11px] text-slate-500">
                  延長時は「保育所入所不承諾通知書（保留通知）」の原本または写し
                </p>
              </div>
            </div>

            {/* 社外届出 */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-2 mb-3 flex items-center justify-between">
                <span>🏛️ 社外届出（年金事務所）</span>
                <span className="text-[10px] font-normal text-slate-500">会社 ➔ 年金機構</span>
              </h3>
              <div className="space-y-2.5 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  {record.checklist.external_maternity_notice_1 ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">産休取得者申出書①</span>
                    <p className="text-[10px] text-slate-500">産休開始時に提出（保険料免除）</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {record.checklist.external_maternity_notice_2 ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">産休変更（終了）届②</span>
                    <p className="text-[10px] text-slate-500">出産日確定・ズレ発生時に提出</p>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2 my-1"></div>

                <div className="flex items-start gap-2">
                  {record.checklist.external_childcare_notice_1 ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">育休等取得者申出書①</span>
                    <p className="text-[10px] text-slate-500">育休開始時に提出（保険料免除）</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {record.checklist.external_childcare_notice_2 ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">育休等取得者申出書②</span>
                    <p className="text-[10px] text-slate-500">育休延長時に提出</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 実務ルール・注意事項 (原本3記載文章完全再現) */}
          <div className="border-2 border-slate-800 rounded-xl p-6 bg-slate-50/70 text-xs space-y-4">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              【実務運用ルール・注意事項】
            </h4>

            <div className="space-y-1">
              <p className="font-bold text-slate-800">■ 産前産後休業取得（変更）申請書</p>
              <p className="text-slate-600 pl-4">
                出産予定日と出産日にズレが生じる場合がありますので、その場合は、
                <span className="font-bold text-slate-800">①休業前は出産予定日で提出</span> ➔ 
                <span className="font-bold text-slate-800">②休業後に出産日で提出</span> してください。
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-bold text-slate-800">■ 育児休業取得（変更）申請書</p>
              <p className="text-slate-600 pl-4">
                ↳ ①産休明けにそのまま育休に入る時　②保育園に入れない等の育休延長をする時に提出してください。
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-bold text-slate-800">■ 母子手帳</p>
              <p className="text-slate-600 pl-4">
                産休育休の証明書用として年金事務所等への提出も必要になるので提出してください。
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-bold text-slate-800">■ マイナンバー</p>
              <p className="text-slate-600 pl-4">
                年金事務所等への提出も必要になるので提出してください。<br />
                <span className="text-indigo-900 font-bold">
                  早く取得できる方法の１つとして、出生届を提出した後に、住民票をマイナンバー記載ありで発行があります。市役所に一度ご確認ください。
                </span>
              </p>
            </div>

            <div className="border-t border-slate-300 pt-3">
              <p className="font-bold text-rose-700">※お子さんを扶養に入れる場合</p>
              <p className="text-slate-700 pl-4 mt-0.5">
                ↳ 別途、必ずご連絡ください。健診等に保険証は必要になりますが発行に1週間〜10日ベースでかかり、時期によって期間は変動します。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📊 ④ 住民税立替表 (原本4完全準拠) */}
      {/* ========================================================================= */}
      {activeTab === 'tax_advance' && (
        <div className="bg-white p-10 md:p-14 max-w-[297mm] mx-auto shadow-lg border border-slate-200 rounded-2xl print:shadow-none print:border-none print:p-6 print:m-0 print:max-w-none">
          {/* ヘッダー情報 */}
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3 mb-8">
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-800 flex items-center gap-2">
                <span className="font-bold">休職開始日：</span>
                <span className="font-bold border-b border-slate-500 px-2">
                  {record.maternity_leave_start_date || '未設定'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold tracking-widest text-slate-900">住民税立替表</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                対象者: {employee.name} 殿（{companyInfo.name}）
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 mb-4">
            ※産前産後・育児休業期間中（無給期間）における特別徴収住民税の会社立替納付および精算管理台帳です。
          </p>

          {/* 立替マトリクステーブル (原本4完全一致) */}
          <div className="overflow-x-auto border-2 border-slate-800 rounded-xs mb-8">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-800 font-bold text-slate-800">
                  <th className="py-2.5 px-3 border-r border-slate-800 w-24">年度 / 年</th>
                  <th className="py-2 px-1 border-r border-slate-300 w-16">1月</th>
                  <th className="py-2 px-1 border-r border-slate-300 w-16">2月</th>
                  <th className="py-2 px-1 border-r border-slate-300 w-16">3月</th>
                  <th className="py-2 px-1 border-r border-slate-300 w-16">4月</th>
                  <th className="py-2 px-1 border-r border-slate-300 w-16">5月</th>
                  <th className="py-2 px-1 border-r border-slate-300 w-16">6月</th>
                  <th className="py-2 px-1 border-r border-slate-300 w-16">7月</th>
                  <th className="py-2 px-1 border-r border-slate-300 w-16">8月</th>
                  <th className="py-2 px-1 border-r border-slate-300 w-16">9月</th>
                  <th className="py-2 px-1 border-r border-slate-300 w-16">10月</th>
                  <th className="py-2 px-1 border-r border-slate-300 w-16">11月</th>
                  <th className="py-2 px-1 border-r border-slate-800 w-16">12月</th>
                  <th className="py-2.5 px-3 bg-slate-200 font-bold text-slate-900 w-28">合計</th>
                </tr>
              </thead>
              <tbody>
                {record.resident_tax_advance?.records && record.resident_tax_advance.records.length > 0 ? (
                  record.resident_tax_advance.records.map((rec) => (
                    <tr key={rec.year} className="border-b border-slate-300 hover:bg-slate-50">
                      <td className="py-3 px-2 font-bold bg-slate-50 border-r border-slate-800 text-slate-800">
                        {rec.year} 年
                      </td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                        const amt = rec.monthlyAmounts ? Number(rec.monthlyAmounts[m] || 0) : 0;
                        return (
                          <td
                            key={m}
                            className={`py-2 px-1 border-r border-slate-300 ${
                              amt > 0 ? 'font-bold text-slate-900 bg-amber-50/40' : 'text-slate-400'
                            }`}
                          >
                            {amt > 0 ? amt.toLocaleString() : '0'}
                          </td>
                        );
                      })}
                      <td className="py-3 px-3 font-bold bg-slate-100 text-slate-900">
                        ¥{(rec.subtotal || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={14} className="py-8 text-slate-400">
                      休業期間・住民税情報が未設定です。「産休・育休手続きステーション」より期間を自動計算してください。
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-200/80 font-black border-t-2 border-slate-800 text-sm">
                  <td colSpan={13} className="py-3 px-4 text-right border-r border-slate-800">
                    立替総累計額：
                  </td>
                  <td className="py-3 px-3 text-right text-rose-700">
                    ¥{(record.resident_tax_advance?.totalAmount || 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 精算状況サマリー */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50/50 text-xs">
            <div>
              <span className="text-slate-500 font-bold block mb-1">会社立替総額</span>
              <span className="text-lg font-black text-slate-800">
                ¥{(record.resident_tax_advance?.totalAmount || 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block mb-1">本人精算済額</span>
              <span className="text-lg font-black text-emerald-600">
                ¥{(record.resident_tax_advance?.settledAmount || 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block mb-1">未精算残高</span>
              <span className="text-lg font-black text-rose-600">
                ¥{Math.max(0, (record.resident_tax_advance?.totalAmount || 0) - (record.resident_tax_advance?.settledAmount || 0)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ A4縦・マージンゼロ・等倍印刷CSS（荀彧 帳票門番規定） */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0mm !important;
            padding: 0mm !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .official-maternity-print-container {
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 10mm !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
};
export default OfficialMaternityLeaveDoc;
