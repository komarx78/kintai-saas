import React, { useState } from 'react';
import { Calendar as CalendarIcon, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';

const ShiftMonthlyView: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const calendarEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });
  // 安全にカレンダー日付を生成
  const calendarDays = (() => {
    try {
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } catch (e) {
      console.error("カレンダーの日付生成に失敗:", e);
      return [];
    }
  })();
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // モックデータ：不足枠数をランダムに生成（0なら充足、1以上なら不足）
  const getMockShortage = (date: Date) => {
    if (!date || isNaN(date.getTime())) return 0;
    const day = date.getDate();
    if (day % 3 === 0) return Math.floor(Math.random() * 3) + 1; // 1〜3枠不足
    if (day % 5 === 0) return 1;
    return 0; // 充足
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50/30 pb-20">
      {/* App Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-white shadow-sm sticky top-0 z-30 px-4 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/shift/admin')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-lg font-bold text-slate-800 flex items-center">
          <CalendarIcon className="w-5 h-5 mr-2 text-indigo-600" />
          月間シフト状況
        </h1>
        <div className="w-9"></div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 mt-4">
        {/* 月切り替えヘッダー */}
        <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex items-center text-slate-600 font-bold"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="hidden md:inline">先月</span>
          </button>
          
          <h2 className="text-2xl font-black text-slate-800">
            {format(currentDate, 'yyyy年 M月')}
          </h2>
          
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex items-center text-slate-600 font-bold"
          >
            <span className="hidden md:inline">翌月</span>
            <ArrowRight className="w-5 h-5 ml-1" />
          </button>
        </div>

        {/* カレンダー */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-2 md:p-4 overflow-hidden">
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
            {weekDays.map((day, i) => (
              <div key={day} className={`text-center font-bold py-2 text-sm md:text-base ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
              }`}>
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {Array.isArray(calendarDays) && calendarDays.map((date, i) => {
              if (!date) return null;
              const isCurrentMonth = isSameMonth(date, monthStart);
              const isTodayDate = isToday(date);
              const shortage = getMockShortage(date);
              
              return (
                <button
                  key={i}
                  onClick={() => navigate(`/shift/admin/calendar?date=${format(date, 'yyyy-MM-dd')}`)}
                  className={`flex flex-col items-center justify-start min-h-[80px] md:min-h-[100px] p-1 md:p-2 rounded-xl transition-all border ${
                    !isCurrentMonth ? 'opacity-40 bg-slate-50/50 border-transparent' : 
                    isTodayDate ? 'border-indigo-300 bg-indigo-50 shadow-inner' : 'border-slate-100 bg-white hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <span className={`text-sm md:text-base font-bold mb-1 md:mb-2 ${
                    date.getDay() === 0 ? 'text-red-500' : 
                    date.getDay() === 6 ? 'text-blue-500' : 
                    'text-slate-700'
                  } ${isTodayDate ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-full shadow-sm' : ''}`}>
                    {format(date, 'd')}
                  </span>
                  
                  {isCurrentMonth && (
                    <div className="w-full mt-auto">
                      {shortage === 0 ? (
                        <div className="bg-green-100 text-green-700 text-[10px] md:text-xs font-bold py-1 px-0.5 rounded-lg w-full text-center flex flex-col md:flex-row items-center justify-center border border-green-200">
                          <CheckCircle2 className="w-3 h-3 md:mr-1 mb-0.5 md:mb-0" />
                          <span>充足</span>
                        </div>
                      ) : (
                        <div className="bg-red-100 text-red-600 text-[10px] md:text-xs font-bold py-1 px-0.5 rounded-lg w-full text-center flex flex-col md:flex-row items-center justify-center border border-red-200 shadow-sm">
                          <AlertTriangle className="w-3 h-3 md:mr-1 mb-0.5 md:mb-0" />
                          <span>不足({shortage})</span>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftMonthlyView;
