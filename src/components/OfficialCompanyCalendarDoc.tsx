import React from 'react';

interface CompanyCalendarDocProps {
  data: {
    companyName: string;
    year: number;
    annualHolidaysCount: number;
    holidaysSet: Set<string>; // 'YYYY-MM-DD'
    holidaySummaryText?: string;
  };
}

export const OfficialCompanyCalendarDoc: React.FC<CompanyCalendarDocProps> = ({ data }) => {
  const year = data.year || 2026;
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

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



  return (
    <div className="bg-white text-slate-800 font-sans p-6 max-w-[900px] mx-auto print:p-0 print:max-w-none print:w-full">
      {/* カレンダーヘッダー */}
      <div className="border-b-2 border-indigo-900 pb-3 mb-4 flex items-end justify-between">
        <div>
          <span className="text-xs font-bold text-indigo-700 tracking-wider">OFFICIAL BUSINESS CALENDAR</span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {year}年 会社年間営業カレンダー
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {data.companyName}　/　年間総休日数: <span className="font-bold text-indigo-700">{data.annualHolidaysCount}日</span>
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span> 休日・休業日
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block"></span> 営業日・稼働日
            </span>
          </div>
          {data.holidaySummaryText && (
            <p className="text-[10px] text-slate-500 mt-1">{data.holidaySummaryText}</p>
          )}
        </div>
      </div>

      {/* 12ヶ月カレンダー グリッド (3列 x 4行) */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3.5 print:grid-cols-3 print:gap-2.5">
        {months.map(m => {
          const days = getDaysInMonth(year, m);
          const firstDayOfWeek = days[0].getDay();
          const paddingDays = Array.from({ length: firstDayOfWeek });

          return (
            <div key={m} className="border border-slate-300 rounded-xl p-2.5 bg-white print:rounded-lg print:p-2 shadow-xs">
              <div className="text-center font-black text-sm text-indigo-950 pb-1.5 mb-1.5 border-b border-slate-200 flex items-center justify-between px-1">
                <span>{m}月</span>
                <span className="text-[10px] text-slate-400 font-bold tracking-widest">{year}.{String(m).padStart(2, '0')}</span>
              </div>

              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 text-center text-[9px] font-black pb-1 mb-1 border-b border-slate-100">
                <span className="text-rose-600">日</span>
                <span className="text-slate-600">月</span>
                <span className="text-slate-600">火</span>
                <span className="text-slate-600">水</span>
                <span className="text-slate-600">木</span>
                <span className="text-slate-600">金</span>
                <span className="text-blue-600">土</span>
              </div>

              {/* 日付グリッド */}
              <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
                {paddingDays.map((_, i) => (
                  <div key={`pad-${i}`} className="h-6"></div>
                ))}

                {days.map(d => {
                  const key = formatDateKey(d);
                  const isHoliday = data.holidaysSet.has(key);
                  const dayNum = d.getDate();
                  const dayOfWeek = d.getDay();

                  return (
                    <div
                      key={key}
                      className={`h-6 flex items-center justify-center font-bold rounded ${
                        isHoliday
                          ? 'bg-rose-500 text-white font-black shadow-xs'
                          : dayOfWeek === 6
                            ? 'text-blue-600'
                            : dayOfWeek === 0
                              ? 'text-rose-600'
                              : 'text-slate-800'
                      }`}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* フッター規約・備考 */}
      <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 print:text-[9px]">
        <div>※ 業務上の都合により休日振替または変更を行う場合があります。</div>
        <div>発行元: {data.companyName}</div>
      </div>
    </div>
  );
};
