import React from 'react';

interface CompanyCalendarDocProps {
  data: {
    companyName: string;
    companyAddress?: string;
    companyPhone?: string;
    year: number;
    annualHolidaysCount: number;
    holidaysSet: Set<string>; // 'YYYY-MM-DD'
    holidaySummaryText?: string;
  };
}

export const OfficialCompanyCalendarDoc: React.FC<CompanyCalendarDocProps> = ({ data }) => {
  const year = data.year || 2026;
  const nextYear = year + 1;

  // 当年12ヶ月 ＋ 翌年1月 の全13ヶ月リスト
  const monthsList = [
    ...Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1, isNextYear: false })),
    { year: nextYear, month: 1, isNextYear: true }
  ];

  const totalDaysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
  const workingDaysCount = totalDaysInYear - data.annualHolidaysCount;

  // 指定年月の全日付を生成
  const getDaysInMonth = (y: number, m: number) => {
    const days = [];
    const date = new Date(y, m - 1, 1);
    while (date.getMonth() === m - 1) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const formatDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 翌年1月の初出勤日（仕事始め）を自動算出
  const nextJanDays = getDaysInMonth(nextYear, 1);
  const firstWorkDayInNextJan = nextJanDays.find(d => !data.holidaysSet.has(formatDateKey(d)));
  const firstWorkDayText = firstWorkDayInNextJan 
    ? `${nextYear}年1月${firstWorkDayInNextJan.getDate()}日 (${['日','月','火','水','木','金','土'][firstWorkDayInNextJan.getDay()]})`
    : '未定';

  return (
    <div className="bg-white text-slate-900 font-sans p-6 max-w-[860px] mx-auto print:p-0 print:m-0 print:max-w-none print:w-full print:text-black">
      {/* 印刷用CSS定義 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* 会社営業カレンダー ヘッダー */}
      <div className="border-b-2 border-slate-900 pb-2 mb-2.5 flex items-end justify-between">
        <div>
          <div className="text-[10px] font-black text-indigo-700 tracking-widest uppercase mb-0.5">
            OFFICIAL BUSINESS CALENDAR ({year} - {nextYear}.01)
          </div>
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              {data.companyName}
            </h1>
            <span className="text-xs sm:text-sm font-bold text-slate-600">
              {year}年 年間営業カレンダー ＆ 翌年1月（年始仕事始め）
            </span>
          </div>
          {data.companyAddress && (
            <p className="text-[9px] text-slate-500 mt-0.5">
              {data.companyAddress} {data.companyPhone ? `| TEL: ${data.companyPhone}` : ''}
            </p>
          )}
        </div>

        <div className="text-right">
          {/* 年間総日数・休日数サマリー ＆ 仕事始めバッジ */}
          <div className="flex items-center gap-1.5 mb-1 justify-end flex-wrap">
            <div className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-[9px] font-bold">
              年間総日数: <span className="font-black text-slate-800">{totalDaysInYear}日</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
              年間休日: <span className="font-black text-rose-800">{data.annualHolidaysCount}日</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
              年間稼働: <span className="font-black text-blue-800">{workingDaysCount}日</span>
            </div>
            <div className="bg-gradient-to-r from-amber-500 to-emerald-600 text-white font-black rounded px-2 py-0.5 text-[9px] shadow-2xs">
              🎍 {nextYear}年 仕事始め: {firstWorkDayText}
            </div>
          </div>

          {/* 凡例 */}
          <div className="flex items-center justify-end gap-3 text-[9px] font-bold text-slate-700">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block"></span> ■ 休日・休業日
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-white border border-slate-400 inline-block"></span> □ 営業日・稼働日
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block"></span> 🎍 仕事始め
            </span>
          </div>
        </div>
      </div>

      {/* 13ヶ月カレンダー グリッド (当年12ヶ月 + 翌年1月) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {monthsList.map(({ year: y, month: m, isNextYear }) => {
          const days = getDaysInMonth(y, m);
          const firstDayOfWeek = days[0].getDay();
          const paddingDays = Array.from({ length: firstDayOfWeek });

          // 当月の休日数カウント
          const monthHolidaysCount = days.filter(d => data.holidaysSet.has(formatDateKey(d))).length;
          const monthWorkDaysCount = days.length - monthHolidaysCount;

          return (
            <div 
              key={`${y}-${m}`} 
              className={`border rounded-lg p-1.5 bg-white ${
                isNextYear 
                  ? 'border-indigo-400 bg-indigo-50/20 col-span-3 sm:col-span-1 shadow-2xs ring-1 ring-indigo-200' 
                  : 'border-slate-300 print:border-slate-400'
              }`}
            >
              {/* 月ヘッダー */}
              <div className={`text-center font-black text-xs pb-1 mb-1 border-b flex items-center justify-between px-1 ${
                isNextYear ? 'border-indigo-200 text-indigo-950' : 'border-slate-200 text-slate-900'
              }`}>
                <div className="flex items-center gap-1">
                  <span className="text-xs sm:text-sm font-black text-indigo-950">
                    {m}月
                  </span>
                  {isNextYear && (
                    <span className="text-[8px] bg-indigo-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                      翌 {y}年
                    </span>
                  )}
                </div>
                <span className="text-[8px] text-slate-500 font-bold">
                  休 {monthHolidaysCount} / 稼 {monthWorkDaysCount}
                </span>
              </div>

              {/* 曜日 */}
              <div className="grid grid-cols-7 text-center text-[8px] font-black pb-0.5 mb-0.5 text-slate-500 border-b border-slate-100">
                <span className="text-rose-600">日</span>
                <span>月</span>
                <span>火</span>
                <span>水</span>
                <span>木</span>
                <span>金</span>
                <span className="text-blue-600">土</span>
              </div>

              {/* 日付 */}
              <div className="grid grid-cols-7 gap-0.5 text-center text-[8px] sm:text-[9px]">
                {paddingDays.map((_, i) => (
                  <div key={`p-${i}`} className="h-4"></div>
                ))}

                {days.map(d => {
                  const key = formatDateKey(d);
                  const isHoliday = data.holidaysSet.has(key);
                  const dayNum = d.getDate();
                  const dayOfWeek = d.getDay();
                  const isFirstWorkDay = isNextYear && firstWorkDayInNextJan && formatDateKey(firstWorkDayInNextJan) === key;

                  return (
                    <div
                      key={key}
                      className={`h-4 flex items-center justify-center font-bold rounded-xs transition-colors ${
                        isFirstWorkDay
                          ? 'bg-emerald-600 text-white font-black ring-1 ring-emerald-300 print:bg-emerald-600 print:text-white'
                          : isHoliday
                            ? 'bg-rose-500 text-white font-black print:bg-rose-500 print:text-white'
                            : dayOfWeek === 6
                              ? 'text-blue-600 font-bold'
                              : dayOfWeek === 0
                                ? 'text-rose-600 font-bold'
                                : 'text-slate-800'
                      }`}
                      title={isFirstWorkDay ? `🎍 ${nextYear}年 仕事始め` : isHoliday ? '休日' : '稼働日'}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>

              {isNextYear && firstWorkDayInNextJan && (
                <div className="mt-1 text-[8px] text-center font-bold text-emerald-800 bg-emerald-50 rounded py-0.5 border border-emerald-200">
                  🎍 仕事始め: 1/{firstWorkDayInNextJan.getDate()}({['日','月','火','水','木','金','土'][firstWorkDayInNextJan.getDay()]})
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* フッター備考・規程 */}
      <div className="mt-2.5 pt-1.5 border-t border-slate-300 flex items-center justify-between text-[8px] sm:text-[9px] text-slate-500">
        <div>
          {data.holidaySummaryText ? `【休日規定】${data.holidaySummaryText}` : '※ 業務の都合により休日振替または変更を行う場合があります。'}
          <span className="ml-2 font-bold text-indigo-700">（翌年1月の年始スケジュールを含みます）</span>
        </div>
        <div className="font-bold">
          発行元: {data.companyName}
        </div>
      </div>
    </div>
  );
};
