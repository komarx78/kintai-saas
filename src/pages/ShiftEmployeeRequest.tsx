import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ArrowLeft, CheckCircle2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import AppSwitcher from '../components/AppSwitcher';

type ShiftType = 'none' | 'working' | 'off';

interface ShiftRequest {
  date: Date;
  type: ShiftType;
  startTime: string;
  endTime: string;
  id?: string;
  status?: string;
  isSaved?: boolean;
}

const ShiftEmployeeRequest: React.FC = () => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deadlineRule, setDeadlineRule] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'request' | 'confirmed'>('request');
  const [isLocked, setIsLocked] = useState(false);
  
  // 当月（1ヶ月）のカレンダー
  const currentMonthStart = startOfMonth(new Date());
  const calendarStart = startOfWeek(currentMonthStart, { weekStartsOn: 0 }); // 日曜始まり
  const calendarEnd = endOfWeek(endOfMonth(currentMonthStart), { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const [requests, setRequests] = useState<Record<string, ShiftRequest>>({});
  const [confirmedShifts, setConfirmedShifts] = useState<ShiftRequest[]>([]);
  
  // モーダル用State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalData, setModalData] = useState<{type: ShiftType, startTime: string, endTime: string}>({
    type: 'none', startTime: '10:00', endTime: '15:00'
  });

  useEffect(() => {
    fetchExistingRequests();
  }, []);

  const fetchExistingRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (tenantIdData) {
        const { data: settings } = await supabase.from('shift_settings').select('submission_deadline_rule, is_submission_locked, auto_lock_day, auto_lock_days').eq('tenant_id', tenantIdData).single();
        if (settings) {
          if (settings.submission_deadline_rule) {
            setDeadlineRule(settings.submission_deadline_rule);
          }
          let locked = settings.is_submission_locked || false;

          // 新しい auto_lock_days (文字列: "10,25" など) がある場合
          if (settings.auto_lock_days) {
            const days = settings.auto_lock_days.split(',').map((d: string) => Number(d.trim())).filter((d: number) => !isNaN(d));
            if (days.length > 0) {
              days.sort((a: number, b: number) => a - b);
              const today = new Date().getDate();
              
              // 次の締め切り日を探す
              let nextDay = days.find((d: number) => d >= today);
              // もし今日がすべての締め切り日を過ぎているなら、次の締め切り日は来月の最初の締め切り日
              if (nextDay === undefined) {
                // 簡易的に月の日数を30日として計算（厳密には月によるが簡易的判定とする）
                nextDay = days[0] + 30;
              }
              
              // 提出開始期間を「次の締め切り日の 10日前 から」とする
              const daysUntilNext = nextDay - today;
              
              // 締め切り日まで10日より遠い場合（＝過去の締め切りは過ぎており、まだ次の開始前）はロックする
              if (daysUntilNext > 10) {
                locked = true;
              }
            }
          } else if (settings.auto_lock_day) {
            const today = new Date().getDate();
            if (today > settings.auto_lock_day) {
              locked = true;
            }
          }
          setIsLocked(locked);
        }
      }

      const startDate = format(currentMonthStart, 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonthStart), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('advanced_shift_requests')
        .select('*')
        .eq('user_id', user.id)
        .gte('target_date', startDate)
        .lte('target_date', endDate);

      if (error) throw error;

      if (data && data.length > 0) {
        const updatedReqs: Record<string, ShiftRequest> = {};
        data.forEach(req => {
          updatedReqs[req.target_date] = {
            date: new Date(req.target_date),
            id: req.id,
            type: req.available_start_time ? 'working' : 'off',
            startTime: req.available_start_time ? req.available_start_time.substring(0, 5) : '10:00',
            endTime: req.available_end_time ? req.available_end_time.substring(0, 5) : '15:00',
            status: req.status,
            isSaved: true
          };
        });
        setRequests(updatedReqs);
      }

      const { data: confirmedData, error: confirmedError } = await supabase
        .from('advanced_shifts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('target_date', startDate)
        .lte('target_date', endDate);

      if (!confirmedError && confirmedData) {
        setConfirmedShifts(
          confirmedData.map(shift => ({
            date: new Date(shift.target_date),
            id: shift.id,
            type: 'working',
            startTime: shift.start_time ? shift.start_time.substring(0, 5) : '10:00',
            endTime: shift.end_time ? shift.end_time.substring(0, 5) : '15:00',
            status: 'confirmed'
          }))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDayClick = (date: Date) => {
    if (isLocked) return;
    // 当月以外の日はクリック不可にする（要件に合わせて）
    if (!isSameMonth(date, currentMonthStart)) return;

    const dateStr = format(date, 'yyyy-MM-dd');
    const req = requests[dateStr] || { type: 'none', startTime: '10:00', endTime: '15:00' };
    
    setSelectedDate(date);
    setModalData({
      type: req.type,
      startTime: req.startTime,
      endTime: req.endTime
    });
  };

  const handleModalSave = () => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    if (modalData.type === 'none') {
      const newReqs = { ...requests };
      delete newReqs[dateStr];
      setRequests(newReqs);
    } else {
      setRequests({
        ...requests,
        [dateStr]: {
          date: selectedDate,
          type: modalData.type,
          startTime: modalData.startTime,
          endTime: modalData.endTime
        }
      });
    }
    setSelectedDate(null);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) throw new Error('Tenant not found');

      const startDate = format(currentMonthStart, 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonthStart), 'yyyy-MM-dd');
      
      // 当月の希望を一旦削除
      await supabase
        .from('advanced_shift_requests')
        .delete()
        .eq('user_id', user.id)
        .gte('target_date', startDate)
        .lte('target_date', endDate);

      const toInsert = Object.values(requests)
        .filter(r => r.type !== 'none')
        .map(r => ({
          tenant_id: tenantIdData,
          user_id: user.id,
          target_date: format(r.date, 'yyyy-MM-dd'),
          available_start_time: r.type === 'working' ? `${r.startTime}:00` : null,
          available_end_time: r.type === 'working' ? `${r.endTime}:00` : null,
          status: 'submitted'
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('advanced_shift_requests').insert(toInsert);
        if (error) throw error;
      }

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        navigate('/portal');
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full border border-white">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">提出完了！</h2>
          <p className="text-slate-500 mb-6">シフト希望を送信しました。<br/>店長の確定をお待ちください。</p>
        </div>
      </div>
    );
  }

  const hours = Array.from({ length: 15 }, (_, i) => i + 9);
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 font-sans pb-24">
      {/* App Bar */}
      <div className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-white/50 px-4 py-4 shadow-sm flex items-center justify-between">
        <button onClick={() => navigate('/portal')} className="p-2 -ml-2 rounded-full hover:bg-white/50 transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-lg font-bold text-slate-800 flex items-center">
          <CalendarIcon className="w-5 h-5 mr-2 text-indigo-600" />
          {format(currentMonthStart, 'yyyy年M月')}のシフト希望
        </h1>
        <AppSwitcher currentApp="shift" role="user" />
      </div>

      {/* Tabs */}
      <div className="flex bg-white/70 backdrop-blur-md border-b border-white/50 px-4 py-2 sticky top-[61px] z-30 shadow-sm">
        <button 
          onClick={() => setActiveTab('request')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'request' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
        >
          📝 シフト希望を出す
        </button>
        <button 
          onClick={() => setActiveTab('confirmed')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ml-2 ${activeTab === 'confirmed' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
        >
          ✅ 確定済みシフト
        </button>
      </div>

      {deadlineRule && (
        <div className="bg-amber-100 border-l-4 border-amber-500 p-3 mx-4 mt-4 mb-2 rounded-r-lg shadow-sm flex items-start max-w-2xl md:mx-auto">
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">【重要】提出ルール</p>
            <p className="text-xs text-amber-700 mt-1 whitespace-pre-wrap">{deadlineRule}</p>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="bg-red-500 text-white p-4 mx-4 mt-4 mb-2 rounded-xl shadow-lg text-center font-bold text-lg animate-pulse flex items-center justify-center flex-col md:flex-row md:max-w-2xl md:mx-auto">
          <span className="text-2xl mr-2 mb-1 md:mb-0">⚠️</span>
          現在、シフト提出期間は終了しているため入力できません
        </div>
      )}

      {loading ? (
         <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div></div>
      ) : activeTab === 'request' ? (
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        <p className="text-sm text-indigo-800 bg-indigo-100/50 p-3 rounded-xl border border-indigo-200/50 text-center font-medium">
          日付をタップして「出勤希望」か「休み希望」を入力してください。
        </p>

        {/* カレンダーグリッド */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-sm border border-white p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day, i) => (
              <div key={day} className={`text-center text-xs font-bold py-2 ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
              }`}>
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {calendarDays.map((date) => {
              const isCurrentMonth = isSameMonth(date, currentMonthStart);
              const dateStr = format(date, 'yyyy-MM-dd');
              const req = requests[dateStr];
              const isTodayDate = isToday(date);
              
              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(date)}
                  disabled={!isCurrentMonth || isLocked}
                  className={`relative flex flex-col items-center justify-start aspect-square p-1 md:p-2 rounded-xl transition-all border ${
                    !isCurrentMonth ? 'opacity-30 cursor-default border-transparent' : 
                    isLocked ? 'opacity-70 cursor-not-allowed border-slate-200 bg-slate-50/50' :
                    isTodayDate ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm'
                  } ${
                    req?.type === 'working' ? 'ring-2 ring-indigo-400 bg-indigo-50/50' : 
                    req?.type === 'off' ? 'ring-2 ring-slate-300 bg-slate-50' : ''
                  }`}
                >
                  <span className={`text-sm md:text-base font-bold ${
                    date.getDay() === 0 ? 'text-red-500' : 
                    date.getDay() === 6 ? 'text-blue-500' : 
                    'text-slate-700'
                  } ${isTodayDate ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-full shadow-sm' : ''}`}>
                    {format(date, 'd')}
                  </span>
                  
                  {req && (
                    <div className="mt-1 md:mt-2 flex flex-col items-center w-full">
                      {req.type === 'working' && (
                        <div className="bg-indigo-600 text-white text-[9px] md:text-[10px] font-bold px-0.5 py-0.5 rounded w-full text-center truncate leading-tight">
                           {req.startTime}-{req.endTime}
                        </div>
                      )}
                      {req.type === 'off' && (
                        <div className="bg-slate-500 text-white text-[10px] md:text-xs font-bold px-1 py-0.5 rounded w-full text-center">
                          休
                        </div>
                      )}
                      {req.isSaved && (
                        <div className="mt-1 bg-green-100 text-green-700 text-[8px] md:text-[9px] font-bold px-0.5 py-0.5 rounded-full flex items-center justify-center w-full truncate border border-green-200">
                          ✅ 送信済
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
      ) : (
        <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
          <h2 className="text-lg font-bold text-slate-800 mb-4">{format(currentMonthStart, 'yyyy年M月')} の確定済みシフト</h2>
          
          <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-sm border border-white p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day, i) => (
                <div key={day} className={`text-center text-xs font-bold py-2 ${
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
                }`}>
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {calendarDays.map((date) => {
                const isCurrentMonth = isSameMonth(date, currentMonthStart);
                const dateStr = format(date, 'yyyy-MM-dd');
                const isTodayDate = isToday(date);
                
                // 該当日の確定シフトを探す
                const dayShifts = confirmedShifts.filter(s => format(s.date, 'yyyy-MM-dd') === dateStr);
                
                return (
                  <div
                    key={dateStr}
                    className={`relative flex flex-col items-center justify-start aspect-square p-1 md:p-2 rounded-xl border ${
                      !isCurrentMonth ? 'opacity-30 bg-transparent border-transparent' : 
                      isTodayDate ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100 bg-white'
                    } ${
                      dayShifts.length > 0 ? 'ring-2 ring-green-400 bg-green-50/50' : ''
                    }`}
                  >
                    <span className={`text-sm md:text-base font-bold ${
                      date.getDay() === 0 ? 'text-red-500' : 
                      date.getDay() === 6 ? 'text-blue-500' : 
                      'text-slate-700'
                    } ${isTodayDate ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-full shadow-sm' : ''}`}>
                      {format(date, 'd')}
                    </span>
                    
                    {dayShifts.length > 0 && (
                      <div className="mt-1 md:mt-2 flex flex-col items-center w-full space-y-1">
                        {dayShifts.map((shift, idx) => (
                          <div key={idx} className="bg-green-600 text-white text-[9px] md:text-[10px] font-bold px-0.5 py-0.5 rounded w-full text-center truncate leading-tight shadow-sm">
                            {shift.startTime}-{shift.endTime}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* モーダル */}
      {selectedDate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100">
            <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 flex items-center">
                {format(selectedDate, 'M月d日 (E)', { locale: ja })} の希望
              </h3>
              <button onClick={() => setSelectedDate(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button 
                  onClick={() => setModalData({...modalData, type: 'working'})}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    modalData.type === 'working' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  出勤希望
                </button>
                <button 
                  onClick={() => setModalData({...modalData, type: 'off'})}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    modalData.type === 'off' ? 'bg-slate-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  休み希望
                </button>
                <button 
                  onClick={() => setModalData({...modalData, type: 'none'})}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    modalData.type === 'none' ? 'bg-white text-slate-800 shadow-md border border-slate-200' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  未定/クリア
                </button>
              </div>

              {modalData.type === 'working' && (
                <div className="flex items-center justify-between pt-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold text-indigo-400 mb-1 ml-1">出勤時間</label>
                    <select 
                      value={modalData.startTime} 
                      onChange={e => setModalData({...modalData, startTime: e.target.value})}
                      className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {hours.map(h => <option key={h} value={`${h.toString().padStart(2, '0')}:00`}>{h}:00</option>)}
                    </select>
                  </div>
                  <div className="px-4 text-indigo-300 font-black pt-4">〜</div>
                  <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold text-indigo-400 mb-1 ml-1">退勤時間</label>
                    <select 
                      value={modalData.endTime} 
                      onChange={e => setModalData({...modalData, endTime: e.target.value})}
                      className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {hours.map(h => <option key={h} value={`${h.toString().padStart(2, '0')}:00`}>{h}:00</option>)}
                    </select>
                  </div>
                </div>
              )}

              <button 
                onClick={handleModalSave}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3.5 font-bold text-base shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
              >
                決定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Submit Button */}
      {activeTab === 'request' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-white/50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-30">
          <div className="max-w-2xl mx-auto">
            <button 
              disabled={saving || isLocked}
              onClick={handleSubmit}
              className={`w-full text-white rounded-2xl py-4 font-bold text-lg shadow-xl transition-all flex items-center justify-center disabled:opacity-50 ${
                isLocked ? 'bg-slate-400 shadow-none cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 active:scale-[0.98]'
              }`}
            >
              {saving ? '保存中...' : isLocked ? '提出期間終了（ロック中）' : 'この内容で提出する'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftEmployeeRequest;