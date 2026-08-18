import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';


const ShiftMonthlyView: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<Record<string, { assigned: number, required: number }>>({});

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) return;

      const startDateStr = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDateStr = format(endOfMonth(currentDate), 'yyyy-MM-dd');

      const { data: shifts } = await supabase.from('advanced_shifts').select('target_date').eq('tenant_id', tenantId).gte('target_date', startDateStr).lte('target_date', endDateStr);
      const { data: reqs } = await supabase.from('advanced_shift_requirements').select('day_of_week, target_date, required_count').eq('tenant_id', tenantId);

      const stats: Record<string, { assigned: number, required: number }> = {};
      const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });

      days.forEach(day => {
        const dStr = format(day, 'yyyy-MM-dd');
        let dbDow = day.getDay();
        if (dbDow === 0) dbDow = 7;

        const assigned = (shifts || []).filter(s => s.target_date === dStr).length;
        const required = (reqs || []).filter(r => r.target_date === dStr || r.day_of_week === dbDow).reduce((sum, r) => sum + r.required_count, 0);

        stats[dStr] = { assigned, required };
      });

      setDailyStats(stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const firstDayOfWeek = days[0].getDay();
  const paddingDays = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/shift/admin')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-2xl font-bold flex items-center">
              <CalendarIcon className="w-6 h-6 mr-3 text-indigo-600" />
              月間シフト状況
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button onClick={() => setCurrentDate(addMonths(currentDate, -1))} className="p-2 hover:bg-white rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-bold px-6 text-lg">
                {format(currentDate, 'yyyy年M月')}
              </span>
              <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-white rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <button 
              onClick={() => navigate('/shift/admin/calendar')}
              className="bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-xl flex items-center hover:bg-indigo-200 transition font-bold"
            >
              <Clock className="w-4 h-4 mr-2" />
              1デイ・ガントチャートへ
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="h-64 flex justify-center items-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
          ) : (
            <div>
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                  <div key={d} className={`p-3 text-center font-bold text-sm ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {paddingDays.map(i => (
                  <div key={`pad-${i}`} className="min-h-[120px] p-2 border-b border-r border-slate-100 bg-slate-50/50"></div>
                ))}
                {days.map(day => {
                  const dStr = format(day, 'yyyy-MM-dd');
                  const stat = dailyStats[dStr];
                  const isSuffient = stat && stat.assigned >= stat.required;
                  const isOver = stat && stat.assigned > stat.required;
                  const isZero = stat && stat.required === 0;

                  return (
                    <div key={dStr} className="min-h-[120px] p-2 border-b border-r border-slate-100 relative group hover:bg-slate-50 transition-colors">
                      <div className="font-bold text-slate-700 mb-2">{format(day, 'd')}</div>
                      
                      {stat && !isZero && (
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500">アサイン状況</div>
                          <div className={`font-black text-lg ${isSuffient ? (isOver ? 'text-blue-500' : 'text-emerald-500') : 'text-red-500'}`}>
                            {stat.assigned} / {stat.required}
                          </div>
                          {!isSuffient && <div className="text-[10px] font-bold text-red-500 bg-red-50 inline-block px-1 rounded border border-red-100">不足あり</div>}
                        </div>
                      )}
                      {stat && isZero && (
                        <div className="text-xs text-slate-400 mt-4 text-center">枠設定なし</div>
                      )}
                      
                      <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors cursor-pointer" onClick={() => navigate('/shift/admin/calendar?date=' + format(day, 'yyyy-MM-dd'))}></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShiftMonthlyView;

