import React from 'react';
import { Train, CheckCircle2 } from 'lucide-react';

export interface CommutingPassDocData {
  companyName: string;
  employeeName: string;
  department: string;
  originStation: string;
  destinationStation: string;
  viaRoute: string;
  transportMode: string;
  oneMonthPassAmount: number;
  attachmentImage?: string;
  appliedDate: string;
  approvedDate?: string;
}

interface OfficialCommutingPassDocProps {
  data: CommutingPassDocData;
}

export const OfficialCommutingPassDoc: React.FC<OfficialCommutingPassDocProps> = ({ data }) => {
  const [docY, docM, docD] = data.appliedDate.split('-');

  return (
    <div className="bg-white p-6 sm:p-10 max-w-4xl mx-auto text-slate-800 font-sans text-xs leading-relaxed select-text print:p-0 print:m-0 print:max-w-none shadow-sm rounded-2xl border border-slate-200">
      
      {/* 表題 */}
      <div className="text-center pb-4 border-b-2 border-slate-900 mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
          <Train className="w-6 h-6 text-blue-600 print:hidden" />
          通勤交通費 支給申請書 兼 承認決定通知書
        </h1>
        <p className="text-[10px] text-slate-500 mt-1">
          {data.companyName}　御中
        </p>
      </div>

      {/* 申請者情報 */}
      <div className="flex justify-between items-end mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <div className="text-[10px] font-bold text-slate-500">【申請者】</div>
          <div className="font-black text-slate-900 text-base mt-0.5">{data.employeeName} 殿</div>
          <div className="text-[11px] text-slate-600">所属部署: {data.department || '本社'}</div>
        </div>
        <div className="text-right text-[11px] text-slate-600">
          申請年月日: {docY}年 {docM}月 {docD}日
        </div>
      </div>

      {/* 通勤経路・金額 明細テーブル */}
      <table className="w-full border-collapse border border-slate-300 mb-6 text-slate-800">
        <tbody>
          <tr className="border-b border-slate-200">
            <th className="w-1/4 bg-slate-100 p-3 font-bold text-left border-r border-slate-300">
              通勤経路（区間）
            </th>
            <td className="p-3 font-bold text-sm text-slate-900">
              {data.originStation || '自宅最寄駅'}　〜　{data.destinationStation || '勤務先最寄駅'}
            </td>
          </tr>

          <tr className="border-b border-slate-200">
            <th className="bg-slate-100 p-3 font-bold text-left border-r border-slate-300">
              利用交通機関・経由
            </th>
            <td className="p-3 text-slate-700">
              {data.viaRoute || '直通（最短・経済的ルート）'} （交通手段: {data.transportMode === 'train' ? '電車・鉄道' : data.transportMode === 'bus' ? '路線バス' : 'マイカー・その他'}）
            </td>
          </tr>

          <tr className="border-b border-slate-200">
            <th className="bg-slate-100 p-3 font-bold text-left border-r border-slate-300">
              1ヶ月定期代（支給申請額）
            </th>
            <td className="p-3">
              <span className="text-lg font-black text-indigo-700">
                ¥{data.oneMonthPassAmount.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-500 ml-2">（非課税限度額月額15万円以内）</span>
            </td>
          </tr>

          <tr>
            <th className="bg-slate-100 p-3 font-bold text-left border-r border-slate-300">
              支給適用開始月
            </th>
            <td className="p-3 font-bold text-slate-800">
              {docY}年 {docM}月度給与支給分より適用
            </td>
          </tr>
        </tbody>
      </table>

      {/* 定期券コピー・エビデンス添付枠 */}
      <div className="mb-6 border border-slate-300 rounded-xl p-4 bg-slate-50/50">
        <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          【証憑】定期券コピー 兼 運賃証明書
        </div>
        {data.attachmentImage ? (
          <div className="flex justify-center p-2 bg-white rounded-lg border border-slate-200">
            <img src={data.attachmentImage} alt="定期券コピー" className="max-h-48 max-w-full object-contain rounded" />
          </div>
        ) : (
          <div className="h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-xs">
            定期券コピーまたは運賃検索証明書 貼付欄
          </div>
        )}
      </div>

      {/* 会社承認印枠 */}
      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-300">
        <div className="text-[10px] text-slate-500 space-y-1">
          <div>※ 上記経路・運賃が最も合理的かつ経済的であることを確認し承認いたしました。</div>
          <div>※ 給与マスタの通勤手当（非課税）へ自動反映されています。</div>
        </div>

        <div className="border border-slate-300 p-3 rounded-xl flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block">【会社 承認印】</span>
            <div className="text-xs font-bold text-slate-800 mt-1">{data.companyName}</div>
            <div className="text-[10px] text-slate-600">承認日: {data.approvedDate || `${docY}年 ${docM}月 ${docD}日`}</div>
          </div>
          <div className="w-10 h-10 border border-emerald-400 rounded flex items-center justify-center text-emerald-600 text-[9px] font-bold">
            承認済
          </div>
        </div>
      </div>

    </div>
  );
};
