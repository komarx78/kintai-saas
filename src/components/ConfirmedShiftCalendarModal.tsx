import React, { useState } from 'react';
import { X, Printer, Users, CheckCircle2, Clock, AlertTriangle, Calendar, ChevronLeft, ChevronRight, BarChart3, ShieldCheck, Flame } from 'lucide-react';
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
  // 表示モード：
  // 'timeline'（★デフォルト：出勤者限定 日別ガントチャート）
  // 'weekly-timeline'（週間ガントチャート：7日間一括）
  // 'staff-matrix'（スタッフ別一覧：給与集計用）
  const [viewMode, setViewMode] = useState<'timeline' | 'weekly-timeline' | 'staff-matrix'>('timeline');
  
  // 選択中の日付
  const [selectedDateStr, setSelectedDateStr] = useState<string>(format(startDate, 'yyyy-MM-dd'));

  if (!isOpen) return null;

  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  // 確定シフトのみ、または実働シフト（ドラフト含む）
  const activeShifts = shifts.filter(s => s.status !== 'request');

  // 正社員判定（責任者）
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

  // ガントチャートの時間軸設定（8:00〜23:00、計15時間）
  const timelineStartHour = 8;
  const timelineEndHour = 23;
  const timelineTotalHours = timelineEndHour - timelineStartHour; // 15時間
  const timelineHours = Array.from({ length: timelineTotalHours }, (_, i) => timelineStartHour + i);
  const baseStartMin = timelineStartHour * 60;
  const baseTotalMin = timelineTotalHours * 60;

  // 選択日の出勤シフト（★休みの人は含めず、出勤者のみ抽出！）
  const currentDayShifts = activeShifts
    .filter(s => s.target_date === selectedDateStr)
    .sort((a, b) => {
      // 1. 開始時間が早い順にソート（朝〜夜への階段状ガント）
      if (a.start_time !== b.start_time) {
        return a.start_time.localeCompare(b.start_time);
      }
      // 2. 開始時間が同じなら社員を上に
      const staffA = users.find(u => u.id === a.user_id);
      const staffB = users.find(u => u.id === b.user_id);
      const aFull = staffA ? isFullTime(staffA) : false;
      const bFull = staffB ? isFullTime(staffB) : false;
      if (aFull && !bFull) return -1;
      if (!aFull && bFull) return 1;
      return 0;
    });

  // 選択日の責任者在店状況
  const currentDayFullTimeCount = currentDayShifts.filter(s => {
    const staff = users.find(u => u.id === s.user_id);
    return staff ? isFullTime(staff) : false;
  }).length;

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
        className="bg-white rounded-3xl shadow-2xl w-full max-w-[96vw] xl:max-w-[1440px] overflow-hidden border border-slate-200 flex flex-col max-h-[95vh] print:max-h-none print:w-full print:border-none print:shadow-none"
      >
        {/* モーダル上部ヘッダー */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 print:bg-none print:text-slate-900 print:p-0 print:border-b-2 print:border-slate-800 print:pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1 no-print">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                店舗運営特化・出勤者限定シフト表（ガントチャート）
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-white print:text-slate-900">
              <span>📋 確定シフト ガントチャート</span>
              <span className="text-sm font-bold text-indigo-200 print:text-slate-600">
                【{format(startDate, 'yyyy年M月d日(E)', { locale: ja })} 〜 {format(endDate, 'M月d日(E)', { locale: ja })}】
              </span>
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 no-print">
              休みの人は非表示にし、出勤スタッフの時間帯・引き継ぎ・ピーク戦力を一目で直感把握できます。
            </p>
          </div>

          {/* ビュー切り替えタブ ＆ アクションボタン */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            {/* タブ切り替えボタン */}
            <div className="bg-slate-800/90 p-1 rounded-xl flex items-center border border-slate-700/60 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title="出勤者限定の1日詳細ガントチャート（ピーク人数と交代が一目でわかる）"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>⏱️ 日別戦力ガント</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly-timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'weekly-timeline'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title="7日間分の出勤者タイムラインを一括表示（A4横印刷・店舗貼り出しに最適）"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>📅 週間一括ガント</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('staff-matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'staff-matrix'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title="スタッフごとの勤務時間と日数の確認（給与計算・労務集計用）"
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
          {/* ビュー1：⏱️ 日別戦力ガント（出勤者限定・早番順階段ガント）★デフォルト   */}
          {/* ----------------------------------------------------------------------- */}
          {viewMode === 'timeline' && (
            <div className="space-y-3">
              
              {/* 日付切り替えバー＆ステータスサマリー */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                {/* 日付ナビゲーション */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
                    title="前日へ"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-700" />
                  </button>
                  <div className="text-lg font-black text-slate-900 flex items-center gap-2 px-1">
                    <Calendar className="w-5 h-5 text-indigo-600" />
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
                <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 md:pb-0">
                  {dateRange.map(d => {
                    const dStr = format(d, 'yyyy-MM-dd');
                    const isSelected = dStr === selectedDateStr;
                    const dow = d.getDay();
                    const dayCount = activeShifts.filter(s => s.target_date === dStr).length;
                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => setSelectedDateStr(dStr)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md scale-105'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        } ${dow === 0 && !isSelected ? 'text-rose-600' : dow === 6 && !isSelected ? 'text-blue-600' : ''}`}
                      >
                        <span>{format(d, 'M/d(E)', { locale: ja })}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {dayCount}名
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 本日の戦力サマリーバッジ */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>出勤戦力: {currentDayShifts.length} 名</span>
                  </div>
                  {currentDayFullTimeCount > 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shadow-2xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>責任者在店 ({currentDayFullTimeCount}名)</span>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shadow-2xs animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>社員不在（要確認）</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ガントチャートメインカード */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                
                {/* 1. 時間帯別の在籍人数メーター（ピーク戦力グラフ） */}
                <div className="p-3.5 border-b border-slate-200 bg-slate-50/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                      <span>時間帯別 在籍人数メーター（ピーク帯の戦力把握）</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-bold">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-rose-100 border border-rose-400"></span> 1名以下（ワンオペ注意）
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-indigo-100 border border-indigo-300"></span> 2〜3名（通常業務）
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 text-white"></span> 4名以上（ピーク対応OK）
                      </span>
                    </div>
                  </div>

                  {/* 在籍人数バーチャート */}
                  <div className="flex items-center gap-3">
                    {/* 左側の名前欄と幅を合わせるためのスペース */}
                    <div className="w-44 shrink-0 text-right pr-2 text-[11px] font-bold text-slate-500">
                      各時間帯の戦力:
                    </div>
                    <div className="grow grid" style={{ gridTemplateColumns: `repeat(${timelineTotalHours}, minmax(0, 1fr))` }}>
                      {timelineHours.map(hour => {
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
                          <div key={hour} className="text-center border-r border-slate-200 last:border-r-0 py-0.5">
                            <div className={`text-xs font-black rounded-lg py-1 mx-0.5 transition ${
                              isPeak 
                                ? 'bg-emerald-500 text-white shadow-xs' 
                                : isLow 
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                  : 'bg-indigo-100 text-indigo-950 border border-indigo-200'
                            }`}>
                              {count}名
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-1 font-bold">
                              {hour}:00
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. 出勤スタッフ限定・階段状ガントバーチャート */}
                <div className="p-4">
                  {currentDayShifts.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 font-bold space-y-2">
                      <Users className="w-8 h-8 mx-auto text-slate-300" />
                      <div className="text-sm">この日の出勤シフトはありません（全員公休）。</div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {currentDayShifts.map((s, index) => {
                        const staff = users.find(u => u.id === s.user_id);
                        const isEmpFull = staff ? isFullTime(staff) : false;
                        
                        const startMin = timeToMinutes(s.start_time);
                        const endMin = timeToMinutes(s.end_time);

                        // 開始位置と幅（%）
                        const leftPercent = Math.max(0, Math.min(100, ((startMin - baseStartMin) / baseTotalMin) * 100));
                        const rightPercent = Math.max(0, Math.min(100, ((endMin - baseStartMin) / baseTotalMin) * 100));
                        const widthPercent = Math.max(3, rightPercent - leftPercent);

                        return (
                          <div key={s.id} className="flex items-center gap-3 group">
                            {/* 左側：スタッフ名・区分 */}
                            <div className="w-44 shrink-0 flex items-center justify-between bg-slate-50 hover:bg-slate-100 p-2 rounded-xl border border-slate-200 transition">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isEmpFull ? (
                                  <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-black shrink-0">社員</span>
                                ) : (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold shrink-0">パート</span>
                                )}
                                <span className="truncate font-black text-xs text-slate-800" title={staff?.name || s.user?.name}>
                                  {staff?.name || s.user?.name || '未設定'}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                                #{index + 1}
                              </span>
                            </div>

                            {/* 右側：タイムライン背景＆ガントバー */}
                            <div className="grow bg-slate-100/80 rounded-xl h-10 relative overflow-hidden border border-slate-200">
                              {/* 時間目盛りガイドライン */}
                              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${timelineTotalHours}, minmax(0, 1fr))` }}>
                                {timelineHours.map(hour => (
                                  <div key={hour} className="border-r border-slate-200/90 last:border-r-0 h-full pointer-events-none" />
                                ))}
                              </div>

                              {/* 勤務バー（朝から夜へ階段状に流れる） */}
                              <div
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                }}
                                className={`absolute top-1 bottom-1 rounded-lg px-2.5 flex items-center justify-between text-xs font-black shadow-xs transition-all hover:scale-[1.01] hover:z-10 ${
                                  isEmpFull
                                    ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white border border-indigo-900 shadow-indigo-200'
                                    : 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 border border-amber-600 shadow-amber-200'
                                }`}
                                title={`${staff?.name}: ${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)} (${s.role || '業務'})`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <Clock className={`w-3.5 h-3.5 shrink-0 ${isEmpFull ? 'text-indigo-200' : 'text-slate-800'}`} />
                                  <span className="font-mono tracking-tight">
                                    {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                                  </span>
                                </div>
                                {s.role && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold truncate max-w-[90px] hidden sm:inline ${
                                    isEmpFull ? 'bg-white/20 text-white' : 'bg-black/10 text-slate-900'
                                  }`}>
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
          {/* ビュー2：📅 週間一括ガント（7日間の出勤者をまとめて可視化・印刷対応）    */}
          {/* ----------------------------------------------------------------------- */}
          {viewMode === 'weekly-timeline' && (
            <div className="space-y-3">
              {/* ガイダンス */}
              <div className="no-print bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center justify-between text-xs text-indigo-950">
                <div className="flex items-center gap-2 font-bold">
                  <Flame className="w-4 h-4 text-indigo-600" />
                  <span>1週間（7日間）の全出勤スタッフの陣形を一括ガント表示しています。休みの人は出さず、店舗貼り出し（A4横印刷）にも最適です。</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-indigo-800">
                    <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600"></span> 正社員
                  </span>
                  <span className="flex items-center gap-1 text-amber-800">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> パート
                  </span>
                </div>
              </div>

              {/* 週間タイムラインカード */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {/* 共通時間目盛りヘッダー */}
                <div className="flex items-center gap-3 p-2.5 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                  <div className="w-36 shrink-0 text-center font-black">
                    日付 / 出勤数
                  </div>
                  <div className="grow grid" style={{ gridTemplateColumns: `repeat(${timelineTotalHours}, minmax(0, 1fr))` }}>
                    {timelineHours.map(hour => (
                      <div key={hour} className="text-center font-mono border-r border-slate-300 last:border-r-0">
                        {hour}:00
                      </div>
                    ))}
                  </div>
                </div>

                {/* 各曜日の行（月〜日） */}
                <div className="divide-y divide-slate-200">
                  {dateRange.map(d => {
                    const dStr = format(d, 'yyyy-MM-dd');
                    const dow = d.getDay();
                    const isSun = dow === 0;
                    const isSat = dow === 6;

                    // その日の出勤シフト（早い順ソート）
                    const dayShifts = activeShifts
                      .filter(s => s.target_date === dStr)
                      .sort((a, b) => a.start_time.localeCompare(b.start_time));

                    return (
                      <div key={dStr} className="p-2.5 flex items-start gap-3 hover:bg-slate-50/60 transition">
                        {/* 曜日・日付ヘッダー */}
                        <div className={`w-36 shrink-0 p-2 rounded-xl text-center border ${
                          isSun 
                            ? 'bg-rose-50 border-rose-200 text-rose-800' 
                            : isSat 
                              ? 'bg-blue-50 border-blue-200 text-blue-800' 
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}>
                          <div className="text-xs font-black">
                            {format(d, 'M/d (E)', { locale: ja })}
                          </div>
                          <div className="text-[10px] font-bold mt-0.5 text-slate-500">
                            出勤: <span className="font-black text-slate-800">{dayShifts.length}名</span>
                          </div>
                        </div>

                        {/* タイムラインエリア（複数スタッフのバーを積み重ねて表示） */}
                        <div className="grow bg-slate-50 rounded-xl min-h-[50px] p-1.5 relative border border-slate-200">
                          {/* 時間目盛り縦ライン */}
                          <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${timelineTotalHours}, minmax(0, 1fr))` }}>
                            {timelineHours.map(hour => (
                              <div key={hour} className="border-r border-slate-200/80 last:border-r-0 h-full" />
                            ))}
                          </div>

                          {/* 出勤者のバー一覧 */}
                          {dayShifts.length === 0 ? (
                            <div className="text-center py-2 text-[11px] text-slate-400 italic">
                              出勤なし
                            </div>
                          ) : (
                            <div className="space-y-1 relative z-10">
                              {dayShifts.map(s => {
                                const staff = users.find(u => u.id === s.user_id);
                                const isEmpFull = staff ? isFullTime(staff) : false;
                                
                                const startMin = timeToMinutes(s.start_time);
                                const endMin = timeToMinutes(s.end_time);

                                const leftPercent = Math.max(0, Math.min(100, ((startMin - baseStartMin) / baseTotalMin) * 100));
                                const rightPercent = Math.max(0, Math.min(100, ((endMin - baseStartMin) / baseTotalMin) * 100));
                                const widthPercent = Math.max(3, rightPercent - leftPercent);

                                return (
                                  <div key={s.id} className="h-6 relative">
                                    <div
                                      style={{
                                        left: `${leftPercent}%`,
                                        width: `${widthPercent}%`,
                                      }}
                                      className={`absolute inset-y-0 rounded-md px-1.5 flex items-center justify-between text-[10px] font-black shadow-2xs ${
                                        isEmpFull
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-amber-400 text-slate-900 border border-amber-500'
                                      }`}
                                      title={`${staff?.name}: ${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}`}
                                    >
                                      <span className="truncate">
                                        {staff?.name} ({s.start_time.substring(0, 5)}-{s.end_time.substring(0, 5)})
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1 rounded font-bold shrink-0">社員</span>
                            <span className="truncate">{emp.name}</span>
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
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded font-bold shrink-0">パート</span>
                            <span className="truncate">{emp.name}</span>
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
            💡 店舗の貼り出しには「📅 週間一括ガント」または「⏱️ 日別戦力ガント」で「🖨️ A4横で印刷」をご活用ください。
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
