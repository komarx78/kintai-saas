import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Users, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday } from 'date-fns';
import { supabase } from '../lib/supabase';
import AppSwitcher from '../components/AppSwitcher';

interface Requirement {
  id: string;
  tenant_id: string;
  target_date: string | null;
  day_of_week: number | null;
  role: string;
  start_time: string;
  end_time: string;
  required_count: number;
}

interface Shift {
  id: string;
  tenant_id: string;
  user_id: string;
  target_date: string;
  role: string;
  start_time: string;
  end_time: string;
  status: string;
}

const ShiftMonthlyView: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const monthStart = startOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const calendarEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });

  const calendarDays = useMemo(() => {
    try {
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } catch (e) {
      console.error("カレンダーの日付生成に失敗:", e);
      return [];
    }
  }, [calendarStart, calendarEnd]);

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // 実データベースからの必要枠＆シフトデータ取得
  useEffect(() => {
    const fetchMonthData = async () => {
      setLoading(true);
      try {
        const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
        if (!tenantId) return;

        const startStr = format(calendarStart, 'yyyy-MM-dd');
        const endStr = format(calendarEnd, 'yyyy-MM-dd');

        // 1. 必要人数枠マスタ取得
        const { data: reqData } = await supabase
          .from('advanced_shift_requirements')
          .select('*')
          .eq('tenant_id', tenantId);
        setRequirements(reqData || []);

        // 2. 確定＆ドラフトシフトデータ取得
        const { data: shiftData } = await supabase
          .from('advanced_shifts')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('target_date', startStr)
          .lte('target_date', endStr);
        setShifts(shiftData || []);
      } catch (err) {
        console.error('月間シフトデータ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMonthData();
  }, [currentDate]);

  // 実データに基づく日別の不足・充足判定（1日詳細カレンダーと完全一致）
  const getDayStatus = (date: Date) => {
    if (!date || isNaN(date.getTime())) {
      return { shortage: 0, hasRequirements: false, isFulfilled: true, assignedCount: 0 };
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const dow = date.getDay(); // 0: 日 〜 6: 土

    // 当日の必要人数枠（日付指定 or 曜日指定）
    const dayReqs = requirements.filter(r => 
      (r.target_date === dateStr) || 
      (!r.target_date && r.day_of_week === dow)
    );

    // 当日の配置済みシフト
    const dayShifts = shifts.filter(s => s.target_date === dateStr);

    if (dayReqs.length === 0) {
      return {
        shortage: 0,
        hasRequirements: false,
        isFulfilled: true,
        assignedCount: dayShifts.length
      };
    }

    // 各役割（ロール）ごとに24時間の必要人数 vs 配置人数を比較
    const uniqueRoles = [...new Set(dayReqs.map(r => r.role))];
    let totalShortageSlots = 0;

    uniqueRoles.forEach(roleName => {
      const roleReqs = dayReqs.filter(r => r.role === roleName);
      const roleShifts = dayShifts.filter(s => s.role === roleName);

      // 各時間帯（0:00〜23:00）で最大不足数を算出
      let maxRoleShortage = 0;

      for (let h = 0; h < 24; h++) {
        let required = 0;
        roleReqs.forEach(req => {
          if (!req.start_time || !req.end_time) return;
          const [sh] = req.start_time.split(':').map(Number);
          const [eh, em] = req.end_time.split(':').map(Number);
          const endHour = em > 0 ? eh : eh - 1;
          if (h >= sh && h <= endHour) {
            required += req.required_count || 1;
          }
        });

        let actual = 0;
        if (required > 0) {
          roleShifts.forEach(shift => {
            if (!shift.start_time || !shift.end_time) return;
            const [sh] = shift.start_time.split(':').map(Number);
            const [eh, em] = shift.end_time.split(':').map(Number);
            const endHour = em > 0 ? eh : eh - 1;
            if (h >= sh && h <= endHour) {
              actual++;
            }
          });
        }

        const diff = required - actual;
        if (diff > maxRoleShortage) {
          maxRoleShortage = diff;
        }
      }

      totalShortageSlots += maxRoleShortage;
    });

    return {
      shortage: totalShortageSlots,
      hasRequirements: true,
      isFulfilled: totalShortageSlots === 0,
      assignedCount: dayShifts.length
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50/30 pb-20">
      {/* App Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-white shadow-sm sticky top-0 z-30 px-4 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/shift/admin')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-lg font-bold text-slate-800 flex items-center">
          <CalendarIcon className="w-5 h-5 mr-2 text-indigo-600" />
          月間シフト状況
        </h1>
        <AppSwitcher currentApp="shift" role="admin" />
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 mt-4">
        {/* 月切り替えヘッダー */}
        <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex items-center text-slate-600 font-bold cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="hidden md:inline">先月</span>
          </button>
          
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-slate-800">
              {format(currentDate, 'yyyy年 M月')}
            </h2>
            {loading && <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />}
          </div>
          
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex items-center text-slate-600 font-bold cursor-pointer"
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
            {calendarDays.map((date, i) => {
              if (!date) return null;
              const isCurrentMonth = isSameMonth(date, monthStart);
              const isTodayDate = isToday(date);
              const status = getDayStatus(date);
              
              return (
                <button
                  key={i}
                  onClick={() => navigate(`/shift/admin/calendar?date=${format(date, 'yyyy-MM-dd')}`)}
                  className={`flex flex-col items-center justify-start min-h-[85px] md:min-h-[105px] p-1 md:p-2 rounded-xl transition-all border cursor-pointer ${
                    !isCurrentMonth ? 'opacity-40 bg-slate-50/50 border-transparent' : 
                    isTodayDate ? 'border-indigo-300 bg-indigo-50 shadow-inner ring-2 ring-indigo-200' : 'border-slate-100 bg-white hover:border-indigo-300 hover:shadow-md'
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
                      {!status.hasRequirements ? (
                        status.assignedCount > 0 ? (
                          <div className="bg-slate-100 text-slate-700 text-[10px] md:text-xs font-bold py-1 px-0.5 rounded-lg w-full text-center flex items-center justify-center border border-slate-200">
                            <Users className="w-3 h-3 mr-1" />
                            <span>{status.assignedCount}名</span>
                          </div>
                        ) : (
                          <div className="text-slate-300 text-[10px] md:text-xs font-medium py-1 px-0.5 rounded-lg w-full text-center">
                            -
                          </div>
                        )
                      ) : status.shortage === 0 ? (
                        <div className="bg-emerald-100 text-emerald-800 text-[10px] md:text-xs font-bold py-1 px-0.5 rounded-lg w-full text-center flex flex-col md:flex-row items-center justify-center border border-emerald-300 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 md:mr-1 mb-0.5 md:mb-0 text-emerald-600" />
                          <span>充足</span>
                        </div>
                      ) : (
                        <div className="bg-rose-100 text-rose-700 text-[10px] md:text-xs font-bold py-1 px-0.5 rounded-lg w-full text-center flex flex-col md:flex-row items-center justify-center border border-rose-300 shadow-2xs animate-in fade-in">
                          <AlertTriangle className="w-3 h-3 md:mr-1 mb-0.5 md:mb-0 text-rose-600" />
                          <span>不足({status.shortage})</span>
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
