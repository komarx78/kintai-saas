import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppSwitcher from '../components/AppSwitcher';

type ShiftPattern = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  color: string;
};

type Shift = {
  id: string;
  user_id: string;
  date: string;
  shift_pattern_id: string | null;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number | null;
  color: string | null;
};

export default function MyShifts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
        
      if (userData?.tenant_id) {
        // Fetch patterns
        const { data: patData } = await supabase
          .from('shift_patterns')
          .select('*')
          .eq('tenant_id', userData.tenant_id);
        
        if (patData) setPatterns(patData);

        // Fetch user's shifts for the month
        const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
        
        const { data: shiftData } = await supabase
          .from('shifts')
          .select('*')
          .eq('tenant_id', userData.tenant_id)
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate);
          
        if (shiftData) setShifts(shiftData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getShiftForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return shifts.find(s => s.date === dateStr);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:pb-0 pb-16">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/user')}
            className="p-2 -ml-2 mr-2 rounded-full hover:bg-blue-700 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">自分のシフト</h1>
        </div>
        <AppSwitcher currentApp="shift" role="user" />
      </header>

      {/* Month Selector */}
      <div className="bg-white px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
        <button 
          onClick={handlePrevMonth} 
          className="p-2 rounded-full hover:bg-gray-100 transition"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center text-lg font-bold text-gray-800">
          <Calendar className="w-5 h-5 mr-2 text-blue-600" />
          {year}年 {month + 1}月
        </div>
        <button 
          onClick={handleNextMonth} 
          className="p-2 rounded-full hover:bg-gray-100 transition"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-2 sm:p-4">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {/* Calendar View */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
                {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                  <div 
                    key={d} 
                    className={`text-center py-2 text-xs font-semibold
                      ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}
                    `}
                  >
                    {d}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7">
                {/* Empty cells before the first day of the month */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[80px] p-1 sm:p-2 border-b border-r border-gray-100 bg-gray-50/50"></div>
                ))}
                
                {/* Days of the month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(year, month, day);
                  const dayOfWeek = date.getDay();
                  const isToday = new Date().toDateString() === date.toDateString();
                  
                  const shift = getShiftForDay(day);
                  const pattern = shift?.shift_pattern_id ? patterns.find(p => p.id === shift.shift_pattern_id) : null;
                  const bgColor = pattern ? pattern.color : (shift?.color || '#9CA3AF');
                  
                  return (
                    <div 
                      key={day} 
                      className={`min-h-[80px] p-1 sm:p-2 border-b border-r border-gray-100 flex flex-col transition-colors
                        ${isToday ? 'bg-blue-50/30' : 'bg-white'}
                        hover:bg-gray-50
                      `}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs sm:text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                          ${isToday ? 'bg-blue-600 text-white' : dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'}
                        `}>
                          {day}
                        </span>
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-1 justify-center">
                        {shift ? (
                          <div 
                            className="w-full text-center rounded py-1 px-0.5 shadow-sm flex flex-col items-center justify-center text-white"
                            style={{ backgroundColor: bgColor }}
                          >
                            {pattern && <span className="text-[9px] sm:text-[10px] opacity-90 truncate w-full text-center mb-0.5">{pattern.name}</span>}
                            <span className="text-[10px] sm:text-xs font-bold leading-tight">{shift.start_time?.slice(0, 5)}</span>
                            <span className="text-[10px] sm:text-xs font-bold leading-tight">{shift.end_time?.slice(0, 5)}</span>
                          </div>
                        ) : (
                          <div className="text-center text-gray-300 text-xs">
                            -
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* List View for Mobile Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-700 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  シフト詳細リスト
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {shifts.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    この月のシフトはまだありません。
                  </div>
                ) : (
                  Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const shift = getShiftForDay(day);
                    if (!shift) return null;
                    
                    const date = new Date(year, month, day);
                    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
                    let pattern = shift.shift_pattern_id ? patterns.find(p => p.id === shift.shift_pattern_id) : null;
                    
                    
                    return (
                      <div key={day} className="p-3 sm:p-4 flex items-center justify-between hover:bg-gray-50 transition">
                        <div className="flex items-center space-x-4">
                          <div className={`text-center w-12
                            ${date.getDay() === 0 ? 'text-red-500' : date.getDay() === 6 ? 'text-blue-500' : 'text-gray-700'}
                          `}>
                            <div className="text-sm font-medium">{month + 1}/{day}</div>
                            <div className="text-xs">({dayOfWeek})</div>
                          </div>
                          
                          {pattern ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-800 flex items-center">
                                <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: pattern.color }}></span>
                                {pattern.name}
                              </span>
                              <span className="text-xs text-gray-500 mt-0.5">
                                {pattern.start_time.slice(0, 5)} - {pattern.end_time.slice(0, 5)} (休憩 {pattern.break_minutes}分)
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-800 flex items-center">
                                <span className="w-3 h-3 rounded-full mr-2 bg-gray-400"></span>
                                直接指定
                              </span>
                              <span className="text-xs text-gray-500 mt-0.5">
                                {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)} (休憩 {shift.break_minutes}分)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



