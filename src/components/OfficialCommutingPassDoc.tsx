import React from 'react';
import { Train, CheckCircle2 } from 'lucide-react';
import { type CommuteRouteSegment, TRANSPORT_TYPE_LABELS } from '../lib/commutingCalculator';

export interface CommutingPassDocData {
  companyName: string;
  employeeName: string;
  department: string;
  transportMode: 'train_bus' | 'car_bike' | 'walk_bicycle' | string;
  originStation?: string;
  destinationStation?: string;
  transitLines?: string;
  oneWayFare?: number;
  oneMonthPassAmount: number;
  sixMonthPassAmount?: number;
  carDistanceKm?: number;
  routeDetailNote?: string;
  segments?: CommuteRouteSegment[];
  attachmentImage?: string;
  appliedDate: string;
  approvedDate?: string;
}

interface OfficialCommutingPassDocProps {
  data: CommutingPassDocData;
}

export const OfficialCommutingPassDoc: React.FC<OfficialCommutingPassDocProps> = ({ data }) => {
  const appliedParts = (data.appliedDate || '2026-04-01').split('-');
  const docY = appliedParts[0] || '2026';
  const docM = appliedParts[1] || '04';
  const docD = appliedParts[2] || '01';

  const isCar = data.transportMode === 'car_bike';
  const isWalk = data.transportMode === 'walk_bicycle';

  const segments = data.segments && data.segments.length > 0 ? data.segments : [
    {
      id: 'default',
      transportType: 'jr' as const,
      fromStation: data.originStation || '自宅最寄',
      toStation: data.destinationStation || '会社最寄',
      lineName: data.transitLines || '最短ルート',
      oneWayFare: data.oneWayFare || 210,
      oneMonthPassAmount: data.oneMonthPassAmount || 7550,
      sixMonthPassAmount: data.sixMonthPassAmount || (data.oneMonthPassAmount * 5.4)
    }
  ];

  return (
    <div className="bg-white p-6 sm:p-10 max-w-4xl mx-auto text-slate-800 font-sans text-xs leading-relaxed select-text print:p-0 print:m-0 print:max-w-none shadow-sm rounded-2xl border border-slate-200">
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>

      {/* 表題 */}
      <div className="text-center pb-3 border-b-2 border-slate-900 mb-5">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
          <Train className="w-6 h-6 text-blue-600 print:hidden" />
          通勤交通費 支給申請書 兼 承認決定書
        </h1>
        <p className="text-[10px] text-slate-500 mt-1">
          {data.companyName}　御中
        </p>
      </div>

      {/* 申請者情報 */}
      <div className="flex justify-between items-end mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div>
          <div className="text-[10px] font-bold text-slate-500">【申請者】</div>
          <div className="font-black text-slate-900 text-base mt-0.5">{data.employeeName} 殿</div>
          <div className="text-[11px] text-slate-600">所属部署: {data.department || '本社'}</div>
        </div>
        <div className="text-right text-[11px] text-slate-600">
          申請年月日: {docY}年 {docM}月 {docD}日
        </div>
      </div>

      {/* 通勤手段 */}
      <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
        <span className="font-bold text-slate-700">通勤区分・手段:</span>
        <span className="font-black text-slate-900 text-sm">
          {isCar ? '🚗 自家用車・バイク通勤' : isWalk ? '🚶 徒歩・自転車通勤' : '🚆 公共交通機関（電車・路線バス・乗り継ぎ）'}
        </span>
      </div>

      {/* 1. 電車・バス（複数乗り継ぎ区間テーブル） */}
      {!isCar && !isWalk && (
        <div className="mb-5 space-y-2">
          <div className="font-bold text-slate-700 text-xs">【通勤乗り継ぎ経路 明細】</div>
          <table className="w-full border-collapse border border-slate-300 text-slate-800 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                <th className="p-2 border-r border-slate-300 text-center w-12">区間</th>
                <th className="p-2 border-r border-slate-300 text-center w-24">交通種別</th>
                <th className="p-2 border-r border-slate-300 text-left">乗車駅/バス停 ➔ 降車駅/バス停</th>
                <th className="p-2 border-r border-slate-300 text-left">利用路線名</th>
                <th className="p-2 border-r border-slate-300 text-right w-20">片道運賃</th>
                <th className="p-2 text-right w-28">1ヶ月定期代</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg, idx) => {
                const badge = TRANSPORT_TYPE_LABELS[seg.transportType] || TRANSPORT_TYPE_LABELS.other;
                return (
                  <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                    <td className="p-2 border-r border-slate-300 text-center font-bold text-slate-600">
                      第{idx + 1}区間
                    </td>
                    <td className="p-2 border-r border-slate-300 text-center font-bold">
                      {badge.label}
                    </td>
                    <td className="p-2 border-r border-slate-300 font-bold text-slate-900">
                      {seg.fromStation} ➔ {seg.toStation}
                    </td>
                    <td className="p-2 border-r border-slate-300 text-slate-600">
                      {seg.lineName}
                    </td>
                    <td className="p-2 border-r border-slate-300 text-right font-mono">
                      ¥{(seg.oneWayFare || 0).toLocaleString()}
                    </td>
                    <td className="p-2 text-right font-bold font-mono text-slate-900">
                      ¥{(seg.oneMonthPassAmount || 0).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {/* 合計行 */}
              <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400">
                <td colSpan={4} className="p-2.5 text-right border-r border-slate-300">
                  支給対象 1ヶ月定期代 合計（月額支給額）:
                </td>
                <td className="p-2.5 text-right border-r border-slate-300 font-mono">
                  ¥{segments.reduce((sum, s) => sum + (s.oneWayFare || 0), 0).toLocaleString()}
                </td>
                <td className="p-2.5 text-right font-mono text-sm text-indigo-700">
                  ¥{(data.oneMonthPassAmount || segments.reduce((sum, s) => sum + (s.oneMonthPassAmount || 0), 0)).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="text-[10px] text-slate-500 text-right">
            ※ 国税庁通勤手当非課税限度額: 月額150,000円以内（全額所得税非課税）
          </div>
        </div>
      )}

      {/* 2. マイカー・バイクの場合 */}
      {isCar && (
        <table className="w-full border-collapse border border-slate-300 mb-5 text-slate-800 text-xs">
          <tbody>
            <tr className="border-b border-slate-200">
              <th className="w-1/3 bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
                片道通勤距離（自宅〜会社所在地）
              </th>
              <td className="p-2.5 font-bold text-slate-900">
                {data.carDistanceKm || 8.5} km
              </td>
            </tr>
            <tr className="border-b border-slate-200">
              <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
                支給手当額（所得税法施行令・非課税基準）
              </th>
              <td className="p-2.5 font-black text-indigo-700 text-sm">
                月額 ¥{(data.oneMonthPassAmount || 12900).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* 3. 添付証憑・原本写真の表示 */}
      {data.attachmentImage && (
        <div className="mb-5 border border-slate-200 rounded-xl p-3 bg-slate-50">
          <div className="font-bold text-slate-700 text-xs mb-2">【添付された定期券・証憑原本】</div>
          <div className="max-h-56 overflow-hidden rounded-lg border border-slate-300 bg-white flex items-center justify-center">
            <img
              src={data.attachmentImage}
              alt="定期券原本"
              className="max-h-56 object-contain"
            />
          </div>
        </div>
      )}

      {/* 会社承認印・決裁欄 */}
      <div className="mt-8 pt-4 border-t-2 border-slate-900 flex justify-between items-center text-xs">
        <div className="space-y-1">
          <div className="font-bold text-slate-900">【会社承認・決裁状況】</div>
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            上記通勤経路および支給金額を正規に承認・決定いたしました。
          </div>
        </div>

        <div className="flex gap-4">
          <div className="border border-slate-400 w-20 h-20 text-center flex flex-col justify-between p-1 bg-slate-50">
            <span className="text-[9px] text-slate-500">人事労務</span>
            <span className="text-[10px] font-bold text-emerald-600 border border-emerald-600 rounded-full py-0.5 px-1 inline-block">承認印</span>
            <span className="text-[8px] text-slate-400">{docY}.{docM}.{docD}</span>
          </div>
          <div className="border border-slate-400 w-20 h-20 text-center flex flex-col justify-between p-1 bg-slate-50">
            <span className="text-[9px] text-slate-500">代表決裁</span>
            <span className="text-[10px] font-bold text-emerald-600 border border-emerald-600 rounded-full py-0.5 px-1 inline-block">決裁印</span>
            <span className="text-[8px] text-slate-400">{docY}.{docM}.{docD}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
