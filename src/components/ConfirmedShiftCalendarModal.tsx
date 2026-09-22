import React, { useState } from 'react';
import { X, Printer, Users, CheckCircle2, User, Clock, AlertTriangle, Calendar, ChevronLeft, ChevronRight, BarChart3, Sun, Moon, Sunrise, Coffee } from 'lucide-react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Shift {
  id: string;
  user_id: string;
  target_date: string;
  start_time: string;
  end_time: string;
  status: string;
  role: string;
  user?: { name: string; employment_type?: string; role?: string };
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

// 時刻文字列（HH:mm）を分数に変換
const timeToMinutes = (t: string): number => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const ConfirmedShiftCalendarModal: React.FC<ConfirmedShiftCalendarModalProps> = ({
  isOpen,
  onClose,
  shifts,
  users,
  startDate,
  endDate,
}) => {
  // 表示モード：'daily-blocks'（日別戦力・週間ブロック）、'timeline'（日別タイムライン・ガント）、'staff-matrix'（スタッフ別一覧）
  const [viewMode, setViewMode] = useState<'daily-blocks' | 'timeline' | 'staff-matrix'>('daily-blocks');
  
  // タイムライン表示で選択中の日付
  const [selectedDateStr, setSelectedDateStr] = useState<string>(format(startDate, 'yyyy-MM-dd'));

  if (!isOpen) return null;

  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  // 確定シフトのみ、または実働シフト（ドラフト含む）
  const activeShifts = shifts.filter(s => s.status !== 'request');

  // スタッフを正社員とアルバイトに分類
  const isFullTime = (u: any) => u.employment_type === 'full-time' || u.role === 'admin' || u.role === 'superadmin';
  const fullTimeEmployees = users.filter(isFullTime);
  const partTimeEmployees = users.filter(u => !isFullTime(u));

  // 印刷実行
  const handlePrint = () => {
    window.print();
  };

  // タイムラインの日付切り替え
  const handlePrevDay = () => {
    const currentIndex = dateRange.findIndex(d => format(d, 'yyyy-MM-dd') === selectedDateStr);
    if (currentIndex > 0) {
      setSelectedDateStr(format(dateRange[currentIndex - 1], 'yyyy-MM-dd'));
    }
  };

  const handleNextDay = () => {
    const currentIndex = dateRange.findIndex(d => format(d, 'yyyy-MM-dd') === selectedDateStr);
    if (currentIndex < dateRange.length - 1) {
      setSelectedDateStr(format(dateRange[currentIndex + 1], 'yyyy-MM-dd'));
    }
  };

  // タイムライン用の時間軸設定（8:00〜23:00、計15時間）
  const timelineStartHour = 8;
  const timelineEndHour = 23;
  const timelineTotalHours = timelineEndHour - timelineStartHour; // 15時間
  const timelineHours = Array.from({ length: timelineTotalHours }, (_, i) => timelineStartHour + i);

  // 選択日のシフト
  const currentDayShifts = activeShifts.filter(s => s.target_date === selectedDateStr);

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
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
            padding: 6mm;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
        }
      `}</style>

      <div 
        id="confirmed-shift-print-area"
        className="bg-white rounded-3xl shadow-2xl w-full max-w-[96vw] xl:max-w-[1400px] overflow-hidden border border-slate-200 flex flex-col max-h-[94vh] print:max-h-none print:w-full print:border-none print:shadow-none"
      >
        {/* モーダル上部ヘッダー */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 print:bg-none print:text-slate-900 print:p-0 print:border-b-2 print:border-slate-800 print:pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1 no-print">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                確定版シフト表（店舗運営・バックヤード掲示用）
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-white print:text-slate-900">
              <span>📋 確定シフトカレンダー</span>
              <span className="text-sm font-bold text-indigo-200 print:text-slate-600">
                【{format(startDate, 'yyyy年M月d日(E)', { locale: ja })} 〜 {format(endDate, 'M月d日(E)', { locale: ja })}】
              </span>
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 no-print">
              日ごとの戦力配置や時間帯別の陣形（早番・中番・遅番・公休）を一目で把握できます。
            </p>
          </div>

          {/* ビュー切り替えタブ ＆ アクションボタン */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            {/* タブ切り替えボタン */}
            <div className="bg-slate-800/80 p-1 rounded-xl flex items-center border border-slate-700/60 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('daily-blocks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'daily-blocks'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title="日ごとに早番・中番・遅番・公休で戦力を整理表示（店舗貼り出しに最適）"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>📅 日別戦力配置</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title="時間帯ごとの勤務帯バーとピーク人数の把握に最適"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>⏱️ 時間帯タイムライン</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('staff-matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'staff-matrix'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title="スタッフごとの勤務時間と日数の確認（給与計算用）"
              >
                <Users className="w-3.5 h-3.5" />
                <span>👥 スタッフ別一覧</span>
              </button>
            </div>

            {/* 印刷ボタン */}
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer hover:scale-105"
              title="A4横サイズで綺麗に印刷・PDF出力します"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ A4横で印刷</span>
            </button>

            {/* 閉じるボタン */}
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* メインコンテンツ領域                                                      */}
        {/* ========================================================================= */}
        <div className="p-3 sm:p-5 overflow-auto grow bg-slate-50/60 print:bg-white print:p-0">

          {/* ----------------------------------------------------------------------- */}
          {/* ビュー1：📅 日別戦力配置（週間ブロック・店舗貼り出し用）                     */}
          {/* ----------------------------------------------------------------------- */}
          {viewMode === 'daily-blocks' && (
            <div className="space-y-4">
              {/* 操作ガイダンス（印刷時は非表示） */}
              <div className="no-print bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center justify-between text-xs text-indigo-950 shadow-2xs">
                <div className="flex items-center gap-2 font-bold">
                  <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]">i</span>
                  <span>各日の陣形（早番・中番・遅番）と責任者の在店状況が一目でわかる店舗運営ビューです。A4横印刷にも対応しています。</span>
                </div>
                <div className="text-[11px] text-indigo-700 font-medium">
                  早番：〜11:00開始 / 中番：11:00〜16:00開始 / 遅番：16:00以降開始
                </div>
              </div>

              {/* 日別カードグリッド（7列レイアウト） */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3 print:grid-cols-7 print:gap-1.5">
                {dateRange.map(d => {
                  const dStr = format(d, 'yyyy-MM-dd');
                  const dow = d.getDay(); // 0:日, 6:土
                  const isSun = dow === 0;
                  const isSat = dow === 6;

                  // その日のシフト
                  const dayShifts = activeShifts.filter(s => s.target_date === dStr);
                  
                  // 時間帯別分類
                  const morningShifts = dayShifts.filter(s => s.start_time < '11:00').sort((a, b) => a.start_time.localeCompare(b.start_time));
                  const afternoonShifts = dayShifts.filter(s => s.start_time >= '11:00' && s.start_time < '16:00').sort((a, b) => a.start_time.localeCompare(b.start_time));
                  const eveningShifts = dayShifts.filter(s => s.start_time >= '16:00').sort((a, b) => a.start_time.localeCompare(b.start_time));

                  // 出勤しているスタッフID
                  const workingUserIds = new Set(dayShifts.map(s => s.user_id));

                  // 正社員の出勤人数・アルバイトの出勤人数
                  const fullTimeWorking = dayShifts.filter(s => fullTimeEmployees.some(f => f.id === s.user_id));
                  const partTimeWorking = dayShifts.filter(s => partTimeEmployees.some(p => p.id === s.user_id));

                  // 責任者在店チェック（正社員が1名以上いるか）
                  const hasLeader = fullTimeWorking.length > 0;

                  // その日の公休スタッフ（シフトに入っていないスタッフ）
                  const offUsers = users.filter(u => !workingUserIds.has(u.id));
                  const offFullTime = offUsers.filter(isFullTime);
                  const offPartTime = offUsers.filter(u => !isFullTime(u));

                  return (
                    <div 
                      key={dStr}
                      className={`bg-white rounded-2xl border flex flex-col shadow-xs overflow-hidden transition hover:shadow-md print:shadow-none print:border-slate-400 print:rounded-lg ${
                        isSun 
                          ? 'border-rose-300 bg-rose-50/10' 
                          : isSat 
                            ? 'border-blue-300 bg-blue-50/10' 
                            : 'border-slate-200'
                      }`}
                    >
                      {/* カードヘッダー：日付・曜日 */}
                      <div className={`p-2.5 border-b text-center shrink-0 ${
                        isSun 
                          ? 'bg-rose-500 text-white border-rose-600' 
                          : isSat 
                            ? 'bg-blue-600 text-white border-blue-700' 
                            : 'bg-slate-800 text-white border-slate-900'
                      }`}>
                        <div className="text-xs font-bold opacity-90">
                          {format(d, 'yyyy/M/d')}
                        </div>
                        <div className="text-base font-black flex items-center justify-center gap-1">
                          <span>{format(d, 'M月d日')}</span>
                          <span className="text-sm">({format(d, 'E', { locale: ja })})</span>
                        </div>

                        {/* 人数バッジ ＆ 責任者ステータス */}
                        <div className="mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                          <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            出勤: {dayShifts.length}名
                          </span>
                          {hasLeader ? (
                            <span className="bg-emerald-400/90 text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title={`正社員 ${fullTimeWorking.length}名 在店`}>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>社{fullTimeWorking.length}</span>
                            </span>
                          ) : (
                            <span className="bg-amber-300 text-amber-950 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title="正社員の出勤がありません">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>社員不在</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* カードボディ：時間帯別戦力 */}
                      <div className="p-2 space-y-2.5 grow flex flex-col justify-between text-xs">
                        
                        {/* 🌅 早番セクション */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-amber-800 bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-200">
                            <span className="flex items-center gap-1">
                              <Sunrise className="w-3 h-3 text-amber-600" />
                              <span>早番</span>
                            </span>
                            <span className="font-black">{morningShifts.length}名</span>
                          </div>
                          {morningShifts.length === 0 ? (
                            <div className="text-[10px] text-slate-400 italic px-1 py-0.5 text-center">ー なし ー</div>
                          ) : (
                            <div className="space-y-1">
                              {morningShifts.map(s => {
                                const staff = users.find(u => u.id === s.user_id);
                                const isEmpFull = staff ? isFullTime(staff) : false;
                                return (
                                  <div 
                                    key={s.id} 
                                    className={`p-1.5 rounded-lg border text-[11px] shadow-2xs ${
                                      isEmpFull 
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-bold' 
                                        : 'bg-white border-slate-200 text-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1 min-w-0">
                                        {isEmpFull ? (
                                          <span className="text-[9px] bg-indigo-600 text-white px-1 rounded font-black shrink-0">社</span>
                                        ) : (
                                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold shrink-0">パ</span>
                                        )}
                                        <span className="truncate font-black">{staff?.name || s.user?.name || '未設定'}</span>
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-slate-600 font-mono mt-0.5 flex justify-between items-center">
                                      <span>{s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}</span>
                                      {s.role && (
                                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded truncate max-w-[50px]">{s.role}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* ☀️ 中番セクション */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-sky-800 bg-sky-50/80 px-1.5 py-0.5 rounded border border-sky-200">
                            <span className="flex items-center gap-1">
                              <Sun className="w-3 h-3 text-sky-600" />
                              <span>中番</span>
                            </span>
                            <span className="font-black">{afternoonShifts.length}名</span>
                          </div>
                          {afternoonShifts.length === 0 ? (
                            <div className="text-[10px] text-slate-400 italic px-1 py-0.5 text-center">ー なし ー</div>
                          ) : (
                            <div className="space-y-1">
                              {afternoonShifts.map(s => {
                                const staff = users.find(u => u.id === s.user_id);
                                const isEmpFull = staff ? isFullTime(staff) : false;
                                return (
                                  <div 
                                    key={s.id} 
                                    className={`p-1.5 rounded-lg border text-[11px] shadow-2xs ${
                                      isEmpFull 
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-bold' 
                                        : 'bg-white border-slate-200 text-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1 min-w-0">
                                        {isEmpFull ? (
                                          <span className="text-[9px] bg-indigo-600 text-white px-1 rounded font-black shrink-0">社</span>
                                        ) : (
                                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold shrink-0">パ</span>
                                        )}
                                        <span className="truncate font-black">{staff?.name || s.user?.name || '未設定'}</span>
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-slate-600 font-mono mt-0.5 flex justify-between items-center">
                                      <span>{s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}</span>
                                      {s.role && (
                                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded truncate max-w-[50px]">{s.role}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 🌙 遅番セクション */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-indigo-900 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-200">
                            <span className="flex items-center gap-1">
                              <Moon className="w-3 h-3 text-indigo-600" />
                              <span>遅番</span>
                            </span>
                            <span className="font-black">{eveningShifts.length}名</span>
                          </div>
                          {eveningShifts.length === 0 ? (
                            <div className="text-[10px] text-slate-400 italic px-1 py-0.5 text-center">ー なし ー</div>
                          ) : (
                            <div className="space-y-1">
                              {eveningShifts.map(s => {
                                const staff = users.find(u => u.id === s.user_id);
                                const isEmpFull = staff ? isFullTime(staff) : false;
                                return (
                                  <div 
                                    key={s.id} 
                                    className={`p-1.5 rounded-lg border text-[11px] shadow-2xs ${
                                      isEmpFull 
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-bold' 
                                        : 'bg-white border-slate-200 text-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1 min-w-0">
                                        {isEmpFull ? (
                                          <span className="text-[9px] bg-indigo-600 text-white px-1 rounded font-black shrink-0">社</span>
                                        ) : (
                                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold shrink-0">パ</span>
                                        )}
                                        <span className="truncate font-black">{staff?.name || s.user?.name || '未設定'}</span>
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-slate-600 font-mono mt-0.5 flex justify-between items-center">
                                      <span>{s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}</span>
                                      {s.role && (
                                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded truncate max-w-[50px]">{s.role}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 💤 公休セクション */}
                        <div className="pt-2 border-t border-slate-200 mt-auto">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                            <span className="flex items-center gap-1">
                              <Coffee className="w-3 h-3 text-slate-400" />
                              <span>公休（休み）</span>
                            </span>
                            <span>{offUsers.length}名</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {offFullTime.map(u => (
                              <span key={u.id} className="text-[10px] bg-rose-50 border border-rose-200 text-rose-800 font-bold px-1.5 py-0.5 rounded truncate max-w-[85px]" title={`${u.name} (社員公休)`}>
                                社: {u.name}
                              </span>
                            ))}
                            {offPartTime.map(u => (
                              <span key={u.id} className="text-[9px] bg-slate-100 border border-slate-200 text-slate-600 px-1 py-0.5 rounded truncate max-w-[70px]" title={u.name}>
                                {u.name}
                              </span>
                            ))}
                            {offUsers.length === 0 && (
                              <span className="text-[10px] text-slate-400 italic">全員出勤</span>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* カードフッター：出勤サマリー */}
                      <div className="bg-slate-50 p-2 border-t border-slate-200 text-[10px] font-bold text-slate-600 flex justify-between items-center shrink-0">
                        <span>内訳: 社{fullTimeWorking.length} / パ{partTimeWorking.length}</span>
                        <span className="text-indigo-900 font-black">計 {dayShifts.length} 名</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* ビュー2：⏱️ 時間帯タイムライン（1日詳細ガントチャート）                      */}
          {/* ----------------------------------------------------------------------- */}
          {viewMode === 'timeline' && (
            <div className="space-y-4">
              {/* 日付切り替えバー */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
                    title="前日へ"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-700" />
                  </button>
                  <div className="text-base font-black text-slate-900 flex items-center gap-2 px-2">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>{format(parseISO(selectedDateStr), 'yyyy年M月d日 (E)', { locale: ja })}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleNextDay}
                    className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
                    title="翌日へ"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-700" />
                  </button>
                </div>

                {/* 週間日付ピルボタン */}
                <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
                  {dateRange.map(d => {
                    const dStr = format(d, 'yyyy-MM-dd');
                    const isSelected = dStr === selectedDateStr;
                    const dow = d.getDay();
                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => setSelectedDateStr(dStr)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        } ${dow === 0 && !isSelected ? 'text-rose-600' : dow === 6 && !isSelected ? 'text-blue-600' : ''}`}
                      >
                        {format(d, 'M/d(E)', { locale: ja })}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* タイムラインチャートコンテナ */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                
                {/* 1. 時間帯別の在籍人数メーター（戦力グラフ） */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/70">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                      <span>時間帯別 在籍人数メーター（ピーク帯の戦力把握）</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-bold">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-rose-200 border border-rose-400"></span> 1名以下（要確認）
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-indigo-100 border border-indigo-300"></span> 2〜3名（通常）
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 text-white"></span> 4名以上（ピーク対応）
                      </span>
                    </div>
                  </div>

                  {/* 在籍人数バーチャート */}
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${timelineTotalHours}, minmax(0, 1fr))` }}>
                    {timelineHours.map(hour => {
                      // その1時間（hour:00 〜 hour:59）に被っているシフト人数
                      const hourStartMin = hour * 60;
                      const hourEndMin = (hour + 1) * 60;
                      const count = currentDayShifts.filter(s => {
                        const sMin = timeToMinutes(s.start_time);
                        const eMin = timeToMinutes(s.end_time);
                        return sMin < hourEndMin && eMin > hourStartMin;
                      }).length;

                      const isPeak = count >= 4;
                      const isLow = count <= 1;

                      return (
                        <div key={hour} className="text-center border-r border-slate-200 last:border-r-0 py-1">
                          <div className={`text-xs font-black rounded-lg py-1 mx-0.5 transition ${
                            isPeak 
                              ? 'bg-emerald-500 text-white shadow-xs' 
                              : isLow 
                                ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                : 'bg-indigo-100 text-indigo-950 border border-indigo-200'
                          }`}>
                            {count}名
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            {hour}:00
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. スタッフ別ガントバーチャート */}
                <div className="p-4 space-y-3">
                  <div className="text-xs font-black text-slate-700 mb-2">
                    出勤スタッフ勤務帯一覧（計 {currentDayShifts.length} 名）
                  </div>

                  {currentDayShifts.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm font-bold">
                      この日の出勤シフトはありません。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentDayShifts.map(s => {
                        const staff = users.find(u => u.id === s.user_id);
                        const isEmpFull = staff ? isFullTime(staff) : false;
                        
                        const startMin = timeToMinutes(s.start_time);
                        const endMin = timeToMinutes(s.end_time);
                        const baseStartMin = timelineStartHour * 60;
                        const baseTotalMin = timelineTotalHours * 60;

                        // 開始位置と幅（%）
                        const leftPercent = Math.max(0, Math.min(100, ((startMin - baseStartMin) / baseTotalMin) * 100));
                        const rightPercent = Math.max(0, Math.min(100, ((endMin - baseStartMin) / baseTotalMin) * 100));
                        const widthPercent = Math.max(2, rightPercent - leftPercent);

                        return (
                          <div key={s.id} className="flex items-center gap-3">
                            {/* スタッフ名ラベル */}
                            <div className="w-36 shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-800">
                              {isEmpFull ? (
                                <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-black shrink-0">社員</span>
                              ) : (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold shrink-0">パート</span>
                              )}
                              <span className="truncate">{staff?.name || s.user?.name || '未設定'}</span>
                            </div>

                            {/* ガントタイムライン背景＆バー */}
                            <div className="grow bg-slate-100 rounded-xl h-8 relative overflow-hidden border border-slate-200">
                              {/* 時間目盛りガイドライン */}
                              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${timelineTotalHours}, minmax(0, 1fr))` }}>
                                {timelineHours.map(hour => (
                                  <div key={hour} className="border-r border-slate-200/80 last:border-r-0 h-full pointer-events-none" />
                                ))}
                              </div>

                              {/* 勤務バー */}
                              <div
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                }}
                                className={`absolute top-1 bottom-1 rounded-lg px-2 flex items-center justify-between text-[10px] font-black shadow-xs transition-all ${
                                  isEmpFull
                                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border border-indigo-800'
                                    : 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 border border-amber-600'
                                }`}
                                title={`${staff?.name}: ${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)} (${s.role || '業務'})`}
                              >
                                <span className="truncate">
                                  {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                                </span>
                                {s.role && (
                                  <span className="text-[9px] opacity-80 truncate hidden sm:inline ml-1">
                                    {s.role}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* ビュー3：👥 スタッフ別一覧（従来の給与計算・マトリクス表）                    */}
          {/* ----------------------------------------------------------------------- */}
          {viewMode === 'staff-matrix' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border print:border-slate-400">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold print:bg-slate-200">
                    <th className="p-2.5 sm:p-3 w-44 border-r border-slate-200 sticky left-0 bg-slate-100 print:bg-slate-200 z-10">
                      スタッフ名 / 区分
                    </th>
                    {dateRange.map(d => {
                      const dow = d.getDay();
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
                    <th className="p-2 text-center w-24 bg-slate-100 print:bg-slate-200 font-bold">
                      週出勤 / 時間
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {/* 正社員セクション */}
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
                      const diff = timeToMinutes(s.end_time) - timeToMinutes(s.start_time);
                      totalMinutes += diff > 0 ? diff : diff + 1440;
                    });
                    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
                    const workedDays = new Set(empShifts.map(s => s.target_date)).size;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 sm:p-3 border-r border-slate-200 sticky left-0 bg-white z-10 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">{emp.name}</span>
                            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1 rounded font-bold shrink-0">社員</span>
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

                  {/* パート・アルバイトセクション */}
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
                      const diff = timeToMinutes(s.end_time) - timeToMinutes(s.start_time);
                      totalMinutes += diff > 0 ? diff : diff + 1440;
                    });
                    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
                    const workedDays = new Set(empShifts.map(s => s.target_date)).size;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 sm:p-3 border-r border-slate-200 sticky left-0 bg-white z-10 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">{emp.name}</span>
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded font-bold shrink-0">パート</span>
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

                {/* 出勤人数合計 */}
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
          )}

        </div>

        {/* モーダル下部フッター */}
        <div className="bg-slate-100 p-3 sm:p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 no-print">
          <div className="text-xs text-slate-600 font-medium">
            💡 店舗の貼り出しには「📅 日別戦力配置」画面で「🖨️ A4横で印刷」をご活用ください。
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
