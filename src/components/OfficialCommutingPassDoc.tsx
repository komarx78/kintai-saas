import React from 'react';
import { Train, CheckCircle2 } from 'lucide-react';

export interface CommutingPassDocData {
  companyName: string;
  employeeName: string;
  department: string;
  transportMode: 'train_bus' | 'car_bike' | 'walk_bicycle' | string;
  originStation: string;
  viaStation?: string;
  destinationStation: string;
  transitLines?: string;
  oneWayFare?: number;
  oneMonthPassAmount: number;
  sixMonthPassAmount?: number;
  carDistanceKm?: number;
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

      {/* 通勤経路・金額 明細テーブル */}
      <table className="w-full border-collapse border border-slate-300 mb-5 text-slate-800 text-xs">
        <tbody>
          <tr className="border-b border-slate-200">
            <th className="w-1/4 bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
              通勤手段・区分
            </th>
            <td className="p-2.5 font-bold text-slate-900">
              {isCar ? '自家用車・バイク通勤' : data.transportMode === 'walk_bicycle' ? '徒歩・自転車通勤' : '公共交通機関（電車・路線バス）'}
            </td>
          </tr>

          {!isCar ? (
            <>
              <tr className="border-b border-slate-200">
                <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
                  乗車駅 〜 降車駅
                </th>
                <td className="p-2.5 font-bold text-sm text-indigo-950">
                  【乗車】{data.originStation || '自宅最寄駅'}
                  {data.viaStation ? ` ➔ 【経由・乗換】${data.viaStation}` : ''}
                  {` ➔ 【降車】${data.destinationStation || '会社最寄駅'}`}
                </td>
              </tr>

              <tr className="border-b border-slate-200">
                <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
                  利用路線・経路
                </th>
                <td className="p-2.5 text-slate-700">
                  {data.transitLines || '最短・最も経済的な通常経路'}
                </td>
              </tr>

              <tr className="border-b border-slate-200">
                <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
                  運賃・支給申請額
                </th>
                <td className="p-2.5">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[10px] text-slate-500 block">1ヶ月定期代 (支給額):</span>
                      <span className="text-base font-black text-indigo-700">
                        ¥{data.oneMonthPassAmount.toLocaleString()}
                      </span>
                    </div>
                    {data.oneWayFare && (
                      <div>
                        <span className="text-[10px] text-slate-500 block">片道運賃:</span>
                        <span className="font-bold text-slate-700">¥{data.oneWayFare.toLocaleString()}</span>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400">（所得税法上の非課税限度額: 月額15万円以内）</span>
                  </div>
                </td>
              </tr>
            </>
          ) : (
            <>
              <tr className="border-b border-slate-200">
                <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
                  片道通勤距離
                </th>
                <td className="p-2.5 font-bold text-slate-900">
                  片道 {data.carDistanceKm || 0} km
                </td>
              </tr>

              <tr className="border-b border-slate-200">
                <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
                  マイカー通勤手当（月額）
                </th>
                <td className="p-2.5 font-black text-base text-indigo-700">
                  ¥{data.oneMonthPassAmount.toLocaleString()}
                </td>
              </tr>
            </>
          )}

          <tr>
            <th className="bg-slate-100 p-2.5 font-bold text-left border-r border-slate-300">
              支給適用開始月
            </th>
            <td className="p-2.5 font-bold text-slate-800">
              {docY}年 {docM}月度 給与支給分より適用
            </td>
          </tr>
        </tbody>
      </table>

      {/* 定期券コピー・エビデンス添付枠 */}
      <div className="mb-5 border border-slate-300 rounded-xl p-3.5 bg-slate-50/50">
        <div className="text-[10px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          【証憑】定期券コピー 兼 経路運賃確認書類
        </div>
        {data.attachmentImage ? (
          <div className="flex justify-center bg-white p-2 rounded border border-slate-200">
            <img 
              src={data.attachmentImage} 
              alt="定期券・運賃エビデンス" 
              className="max-h-44 object-contain rounded shadow-xs"
            />
          </div>
        ) : (
          <div className="h-20 border-2 border-dashed border-slate-200 rounded flex items-center justify-center text-slate-400 text-[10px]">
            ※ 電子申請により提出された定期券画像・乗換検索結果がここに保管されます
          </div>
        )}
      </div>

      {/* 会社承認印欄 */}
      <div className="border border-slate-300 p-3 bg-slate-50 rounded-xl flex justify-between items-center text-xs">
        <div>
          <div className="font-bold text-slate-800">【会社承認・決済】</div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            就業規則および通勤手当支給規程に基づき、上記通勤経路および手当支給額を承認いたします。
          </p>
        </div>
        <div className="flex gap-2">
          <div className="w-16 h-14 border border-slate-400 bg-white rounded flex flex-col items-center justify-between p-1">
            <span className="text-[8px] text-slate-400">人事労務</span>
            <span className="text-[10px] font-bold text-slate-400">承認印</span>
          </div>
          <div className="w-16 h-14 border border-slate-400 bg-white rounded flex flex-col items-center justify-between p-1">
            <span className="text-[8px] text-slate-400">代表者</span>
            <span className="text-[10px] font-bold text-slate-400">決裁印</span>
          </div>
        </div>
      </div>

    </div>
  );
};
