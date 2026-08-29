import React from 'react';
import { CreditCard, CheckCircle2 } from 'lucide-react';

export interface BankPassbookDocData {
  companyName: string;
  employeeName: string;
  department: string;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
  attachmentImage?: string;
  appliedDate: string;
  confirmedDate?: string;
}

interface OfficialBankPassbookDocProps {
  data: BankPassbookDocData;
}

export const OfficialBankPassbookDoc: React.FC<OfficialBankPassbookDocProps> = ({ data }) => {
  const [docY, docM, docD] = data.appliedDate.split('-');

  return (
    <div className="bg-white p-6 sm:p-10 max-w-4xl mx-auto text-slate-800 font-sans text-xs leading-relaxed select-text print:p-0 print:m-0 print:max-w-none shadow-sm rounded-2xl border border-slate-200">
      
      {/* 表題 */}
      <div className="text-center pb-4 border-b-2 border-slate-900 mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
          <CreditCard className="w-6 h-6 text-blue-600 print:hidden" />
          給与振込先口座 登録（変更）届 兼 通帳確認書
        </h1>
        <p className="text-[10px] text-slate-500 mt-1">
          {data.companyName}　御中
        </p>
      </div>

      {/* 申請者情報 */}
      <div className="flex justify-between items-end mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <div className="text-[10px] font-bold text-slate-500">【届出者】</div>
          <div className="font-black text-slate-900 text-base mt-0.5">{data.employeeName} 殿</div>
          <div className="text-[11px] text-slate-600">所属部署: {data.department || '本社'}</div>
        </div>
        <div className="text-right text-[11px] text-slate-600">
          届出年月日: {docY}年 {docM}月 {docD}日
        </div>
      </div>

      {/* 振込先口座 明細テーブル */}
      <table className="w-full border-collapse border border-slate-300 mb-6 text-slate-800">
        <tbody>
          <tr className="border-b border-slate-200">
            <th className="w-1/4 bg-slate-100 p-3 font-bold text-left border-r border-slate-300">
              金融機関名
            </th>
            <td className="p-3 font-bold text-slate-900">
              {data.bankName || '未登録'}
            </td>
          </tr>

          <tr className="border-b border-slate-200">
            <th className="bg-slate-100 p-3 font-bold text-left border-r border-slate-300">
              支店名（支店番号）
            </th>
            <td className="p-3 font-bold text-slate-900">
              {data.branchName || '未登録'}
            </td>
          </tr>

          <tr className="border-b border-slate-200">
            <th className="bg-slate-100 p-3 font-bold text-left border-r border-slate-300">
              預金種別 / 口座番号
            </th>
            <td className="p-3">
              <span className="font-bold mr-3">{data.accountType === 'ordinary' ? '普通預金' : '当座預金'}</span>
              <span className="text-base font-black text-indigo-700 tracking-wider">
                {data.accountNumber || '*******'}
              </span>
            </td>
          </tr>

          <tr>
            <th className="bg-slate-100 p-3 font-bold text-left border-r border-slate-300">
              口座名義人（カタカナ）
            </th>
            <td className="p-3 font-black text-sm text-slate-900">
              {data.accountHolder || data.employeeName}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 通帳コピー・エビデンス添付枠 */}
      <div className="mb-6 border border-slate-300 rounded-xl p-4 bg-slate-50/50">
        <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          【証憑】通帳見開きコピー 兼 キャッシュカード確認写真
        </div>
        {data.attachmentImage ? (
          <div className="flex justify-center p-2 bg-white rounded-lg border border-slate-200">
            <img src={data.attachmentImage} alt="通帳コピー" className="max-h-56 max-w-full object-contain rounded" />
          </div>
        ) : (
          <div className="h-36 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-xs">
            通帳見開き（店番号・口座番号・名義人記載面）貼付欄
          </div>
        )}
      </div>

      {/* 確認印枠 */}
      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-300">
        <div className="text-[10px] text-slate-500 space-y-1">
          <div>※ 本人名義の口座であることを通帳・カードの写真にて確認いたしました。</div>
          <div>※ 給与計算マスタの振込口座情報および全銀振込データに自動連動されています。</div>
        </div>

        <div className="border border-slate-300 p-3 rounded-xl flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block">【労務・経理 確認印】</span>
            <div className="text-xs font-bold text-slate-800 mt-1">{data.companyName}</div>
            <div className="text-[10px] text-slate-600">確認日: {data.confirmedDate || `${docY}年 ${docM}月 ${docD}日`}</div>
          </div>
          <div className="w-10 h-10 border border-emerald-400 rounded flex items-center justify-center text-emerald-600 text-[9px] font-bold">
            確認済
          </div>
        </div>
      </div>

    </div>
  );
};
