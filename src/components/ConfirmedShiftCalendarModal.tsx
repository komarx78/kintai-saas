import React from 'react';
import { X, Printer, Users, CheckCircle2, User } from 'lucide-react';
import { format, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Shift {
  id: string;
  user_id: string;
  target_date: string;
  start_time: string;
  end_time: string;
  status: string;
  role: string;
  user?: { name: string };
}

interface ConfirmedShiftCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  shifts: Shift[];
  users: any[];
  startDate: Date;
  endDate: Date;
  roles?: { name: string; color: string }[];
}

export const ConfirmedShiftCalendarModal: React.FC<ConfirmedShiftCalendarModalProps> = ({
  isOpen,
  onClose,
  shifts,
  users,
  startDate,
  endDate,
}) => {
  if (!isOpen) return null;

  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  // 確定シフトのみ、または実働シフト（ドラフト含む）
  const activeShifts = shifts.filter(s => s.status !== 'request');

  // スタッフを正社員とアルバイトに分類
  const fullTimeEmployees = users.filter(u => u.employment_type === 'full-time' || u.role === 'admin' || u.role === 'superadmin');
  const partTimeEmployees = users.filter(u => u.employment_type !== 'full-time' && u.role !== 'admin' && u.role !== 'superadmin');

  // 印刷実行
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #confirmed-shift-print-area, #confirmed-shift-print-area * {
            visibility: visible;
          }
          #confirmed-shift-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
        }
      `}</style>

      <div 
        id="confirmed-shift-print-area"
        className="bg-white rounded-3xl shadow-2xl w-full max-w-[95vw] lg:max-w-7xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] print:max-h-none print:w-full print:border-none print:shadow-none"
      >
        {/* モーダルヘッダー（印刷時はシンプル化） */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex justify-between items-center shrink-0 print:bg-none print:text-slate-900 print:p-0 print:border-b-2 print:border-slate-800 print:pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1 no-print">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                確定版シフト表（店舗貼り出し・印刷用）
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-white print:text-slate-900">
              <span>📋 確定シフトカレンダー</span>
              <span className="text-sm font-bold text-indigo-200 print:text-slate-600">
                【{format(startDate, 'yyyy年M月d日(E)', { locale: ja })} 〜 {format(endDate, 'M月d日(E)', { locale: ja })}】
              </span>
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 no-print">
              店舗バックヤードへの貼り出しや、全スタッフの確定出勤スケジュール確認にご活用いただけます。
            </p>
          </div>

          <div className="flex items-center gap-2 no-print">
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer hover:scale-105"
              title="A4横サイズで綺麗に印刷・PDF出力します"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ A4横で印刷する</span>
            </button>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* シフト表コンテンツ（スクロール可能領域） */}
        <div className="p-4 sm:p-6 overflow-auto grow bg-slate-50/50 print:bg-white print:p-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border print:border-slate-400">
            <table className="w-full text-left border-collapse text-xs">
              {/* テーブルヘッダー：日付列 */}
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold print:bg-slate-200">
                  <th className="p-2.5 sm:p-3 w-40 border-r border-slate-200 sticky left-0 bg-slate-100 print:bg-slate-200 z-10">
                    スタッフ名 / 区分
                  </th>
                  {dateRange.map(d => {
                    const dow = d.getDay(); // 0:日, 6:土
                    const isSun = dow === 0;
                    const isSat = dow === 6;
                    return (
                      <th 
                        key={d.toISOString()} 
                        className={`p-2 text-center border-r border-slate-200 min-w-[95px] ${
                          isSun ? 'bg-rose-50/70 text-rose-700' : isSat ? 'bg-blue-50/70 text-blue-700' : ''
                        }`}
                      >
                        <div className="text-[11px] font-bold text-slate-500">
                          {format(d, 'M/d')}
                        </div>
                        <div className={`text-xs font-black ${isSun ? 'text-rose-600' : isSat ? 'text-blue-600' : 'text-slate-800'}`}>
                          ({format(d, 'E', { locale: ja })})
                        </div>
                      </th>
                    );
                  })}
                  <th className="p-2 text-center w-20 bg-slate-100 print:bg-slate-200 font-bold">
                    週出勤 / 時間
                  </th>
                </tr>
              </thead>

              {/* テーブル本体 */}
              <tbody className="divide-y divide-slate-200">
                {/* 🏢 正社員セクション */}
                {fullTimeEmployees.length > 0 && (
                  <tr className="bg-indigo-50/60 font-black text-indigo-900 border-t-2 border-indigo-200">
                    <td colSpan={dateRange.length + 2} className="py-1.5 px-3 text-[11px] flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>正社員スタッフ（責任者）: {fullTimeEmployees.length} 名</span>
                    </td>
                  </tr>
                )}
                {fullTimeEmployees.map(emp => {
                  const empShifts = activeShifts.filter(s => s.user_id === emp.id);
                  let totalMinutes = 0;
                  empShifts.forEach(s => {
                    const [sh, sm] = s.start_time.split(':').map(Number);
                    const [eh, em] = s.end_time.split(':').map(Number);
                    let diff = (eh * 60 + em) - (sh * 60 + sm);
                    if (diff < 0) diff += 24 * 60;
                    totalMinutes += diff;
                  });
                  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
                  const workedDays = new Set(empShifts.map(s => s.target_date)).size;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2.5 sm:p-3 border-r border-slate-200 sticky left-0 bg-white z-10 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{emp.name}</span>
                          <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1 rounded font-bold shrink-0">
                            社員
                          </span>
                        </div>
                      </td>
                      {dateRange.map(d => {
                        const dStr = format(d, 'yyyy-MM-dd');
                        const dayShift = empShifts.find(s => s.target_date === dStr);
                        const dow = d.getDay();

                        return (
                          <td 
                            key={dStr} 
                            className={`p-1.5 text-center border-r border-slate-200 align-middle ${
                              dow === 0 ? 'bg-rose-50/20' : dow === 6 ? 'bg-blue-50/20' : ''
                            }`}
                          >
                            {dayShift ? (
                              <div className="bg-indigo-50 border border-indigo-200 rounded-lg py-1 px-1 shadow-2xs print:border-slate-600 print:bg-slate-100">
                                <div className="text-[11px] font-black text-indigo-950 print:text-slate-900">
                                  {dayShift.start_time.substring(0, 5)} - {dayShift.end_time.substring(0, 5)}
                                </div>
                                <div className="text-[9px] font-bold text-indigo-700 print:text-slate-600 mt-0.5">
                                  {dayShift.role}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold text-rose-500/80 bg-rose-50/50 px-1.5 py-0.5 rounded">
                                公休
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center text-slate-700 font-bold">
                        <div className="text-xs font-black text-indigo-900">{workedDays}日</div>
                        <div className="text-[10px] text-slate-500">{totalHours}h</div>
                      </td>
                    </tr>
                  );
                })}

                {/* ☕ パート・アルバイトセクション */}
                {partTimeEmployees.length > 0 && (
                  <tr className="bg-amber-50/60 font-black text-amber-900 border-t-2 border-amber-200">
                    <td colSpan={dateRange.length + 2} className="py-1.5 px-3 text-[11px] flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-amber-600" />
                      <span>パート・アルバイトスタッフ: {partTimeEmployees.length} 名</span>
                    </td>
                  </tr>
                )}
                {partTimeEmployees.map(emp => {
                  const empShifts = activeShifts.filter(s => s.user_id === emp.id);
                  let totalMinutes = 0;
                  empShifts.forEach(s => {
                    const [sh, sm] = s.start_time.split(':').map(Number);
                    const [eh, em] = s.end_time.split(':').map(Number);
                    let diff = (eh * 60 + em) - (sh * 60 + sm);
                    if (diff < 0) diff += 24 * 60;
                    totalMinutes += diff;
                  });
                  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
                  const workedDays = new Set(empShifts.map(s => s.target_date)).size;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2.5 sm:p-3 border-r border-slate-200 sticky left-0 bg-white z-10 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">{emp.name}</span>
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded font-bold shrink-0">
                            パート
                          </span>
                        </div>
                      </td>
                      {dateRange.map(d => {
                        const dStr = format(d, 'yyyy-MM-dd');
                        const dayShift = empShifts.find(s => s.target_date === dStr);
                        const dow = d.getDay();

                        return (
                          <td 
                            key={dStr} 
                            className={`p-1.5 text-center border-r border-slate-200 align-middle ${
                              dow === 0 ? 'bg-rose-50/20' : dow === 6 ? 'bg-blue-50/20' : ''
                            }`}
                          >
                            {dayShift ? (
                              <div className="bg-amber-50/80 border border-amber-200 rounded-lg py-1 px-1 shadow-2xs print:border-slate-600 print:bg-slate-100">
                                <div className="text-[11px] font-black text-amber-950 print:text-slate-900">
                                  {dayShift.start_time.substring(0, 5)} - {dayShift.end_time.substring(0, 5)}
                                </div>
                                <div className="text-[9px] font-bold text-amber-700 print:text-slate-600 mt-0.5">
                                  {dayShift.role}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-300 font-medium">ー</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center text-slate-700 font-bold">
                        <div className="text-xs font-black text-amber-900">{workedDays}日</div>
                        <div className="text-[10px] text-slate-500">{totalHours}h</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* テーブルフッター：日別出勤人数合計 */}
              <tfoot>
                <tr className="bg-slate-100 text-slate-800 font-black border-t-2 border-slate-300 print:bg-slate-200">
                  <td className="p-2.5 sm:p-3 border-r border-slate-200 sticky left-0 bg-slate-100 print:bg-slate-200 z-10 text-xs">
                    出勤人数合計
                  </td>
                  {dateRange.map(d => {
                    const dStr = format(d, 'yyyy-MM-dd');
                    const dayShifts = activeShifts.filter(s => s.target_date === dStr);
                    const fullCount = dayShifts.filter(s => fullTimeEmployees.some(f => f.id === s.user_id)).length;
                    const partCount = dayShifts.filter(s => partTimeEmployees.some(p => p.id === s.user_id)).length;
                    const totalCount = dayShifts.length;

                    return (
                      <td key={dStr} className="p-2 text-center border-r border-slate-200">
                        <div className="text-xs font-black text-indigo-950 print:text-slate-900">
                          {totalCount}名
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold mt-0.5">
                          社{fullCount} / パ{partCount}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2 text-center text-xs font-black text-indigo-900">
                    {activeShifts.length}枠
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-between items-center shrink-0 no-print">
          <div className="text-xs text-slate-500 font-medium">
            ※「A4横で印刷する」を押すと、店舗掲示用の印刷プレビューが開きます。
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ A4横で印刷する</span>
            </button>
            <button
              onClick={onClose}
              className="bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
