import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format, addDays, startOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';

type ShiftType = 'none' | 'working' | 'off';

interface ShiftRequest {
  date: Date;
  type: ShiftType;
  startTime: string;
  endTime: string;
  id?: string;
}

const ShiftEmployeeRequest: React.FC = () => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 次週の月曜日を開始日とする
  const nextWeekStart = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
  const nextWeek = Array.from({ length: 7 }, (_, i) => addDays(nextWeekStart, i));

  const [requests, setRequests] = useState<ShiftRequest[]>(
    nextWeek.map(date => ({
      date,
      type: 'none',
      startTime: '10:00',
      endTime: '15:00'
    }))
  );

  useEffect(() => {
    fetchExistingRequests();
  }, []);

  const fetchExistingRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = format(nextWeek[0], 'yyyy-MM-dd');
      const endDate = format(nextWeek[6], 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('advanced_shift_requests')
        .select('*')
        .eq('user_id', user.id)
        .gte('target_date', startDate)
        .lte('target_date', endDate);

      if (error) throw error;

      if (data && data.length > 0) {
        const updatedReqs = [...requests];
        data.forEach(req => {
          const reqDateStr = req.target_date;
          const idx = updatedReqs.findIndex(r => format(r.date, 'yyyy-MM-dd') === reqDateStr);
          if (idx !== -1) {
            updatedReqs[idx] = {
              ...updatedReqs[idx],
              id: req.id,
              type: req.available_start_time ? 'working' : 'off',
              startTime: req.available_start_time ? req.available_start_time.substring(0, 5) : '10:00',
              endTime: req.available_end_time ? req.available_end_time.substring(0, 5) : '15:00'
            };
          }
        });
        setRequests(updatedReqs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateRequest = (index: number, field: keyof ShiftRequest, value: any) => {
    const newReqs = [...requests];
    newReqs[index] = { ...newReqs[index], [field]: value };
    setRequests(newReqs);
  };

  const setType = (index: number, type: ShiftType) => {
    updateRequest(index, 'type', type);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) throw new Error('Tenant not found');

      // 既存の来週の希望を一旦削除する（UPSERTの重複を防ぐため）
      const startDate = format(nextWeek[0], 'yyyy-MM-dd');
      const endDate = format(nextWeek[6], 'yyyy-MM-dd');
      await supabase
        .from('advanced_shift_requests')
        .delete()
        .eq('user_id', user.id)
        .gte('target_date', startDate)
        .lte('target_date', endDate);

      const toInsert = requests
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 font-sans pb-24">
      {/* App Bar */}
      <div className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-white/50 px-4 py-4 shadow-sm flex items-center justify-between">
        <button onClick={() => navigate('/portal')} className="p-2 -ml-2 rounded-full hover:bg-white/50 transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-lg font-bold text-slate-800 flex items-center">
          <CalendarIcon className="w-5 h-5 mr-2 text-indigo-600" />
          次週のシフト希望
        </h1>
        <div className="w-8"></div>
      </div>

      {loading ? (
         <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div></div>
      ) : (
      <div className="px-4 py-6 max-w-md mx-auto space-y-4">
        <p className="text-sm text-indigo-800 bg-indigo-100/50 p-3 rounded-xl border border-indigo-200/50">
          タップして「出勤希望」か「休み希望」を選択してください。
        </p>

        {requests.map((req, i) => (
          <div 
            key={i} 
            className={`relative overflow-hidden rounded-3xl p-5 transition-all duration-300 border-2 shadow-sm ${
              req.type === 'working' ? 'bg-white/90 border-indigo-400 shadow-indigo-100' :
              req.type === 'off' ? 'bg-slate-50/90 border-slate-300' :
              'bg-white/60 border-white/80 hover:bg-white/80'
            } backdrop-blur-md`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <span className="text-xl font-black text-slate-800">
                  {format(req.date, 'M/d')}
                </span>
                <span className={`ml-2 text-sm font-bold px-2 py-0.5 rounded-lg ${
                  req.date.getDay() === 0 ? 'bg-red-100 text-red-600' :
                  req.date.getDay() === 6 ? 'bg-blue-100 text-blue-600' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {format(req.date, 'E', { locale: ja })}
                </span>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setType(i, 'working')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    req.type === 'working' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  出勤
                </button>
                <button 
                  onClick={() => setType(i, 'off')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    req.type === 'off' ? 'bg-slate-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  休み
                </button>
              </div>
            </div>

            {req.type === 'working' && (
              <div className="flex items-center justify-between pt-4 border-t border-indigo-100 animate-in fade-in slide-in-from-top-2">
                <div className="flex-1 flex flex-col">
                  <label className="text-xs font-bold text-indigo-400 mb-1 ml-1">出勤時間</label>
                  <select 
                    value={req.startTime} 
                    onChange={e => updateRequest(i, 'startTime', e.target.value)}
                    className="bg-indigo-50 border-0 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {hours.map(h => <option key={h} value={`${h.toString().padStart(2, '0')}:00`}>{h}:00</option>)}
                  </select>
                </div>
                <div className="px-4 text-indigo-300 font-black">〜</div>
                <div className="flex-1 flex flex-col">
                  <label className="text-xs font-bold text-indigo-400 mb-1 ml-1">退勤時間</label>
                  <select 
                    value={req.endTime} 
                    onChange={e => updateRequest(i, 'endTime', e.target.value)}
                    className="bg-indigo-50 border-0 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {hours.map(h => <option key={h} value={`${h.toString().padStart(2, '0')}:00`}>{h}:00</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {/* Fixed Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-white/50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto">
          <button 
            disabled={saving}
            onClick={handleSubmit}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-4 font-bold text-lg shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center disabled:opacity-50"
          >
            {saving ? '保存中...' : 'この内容で提出する'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftEmployeeRequest;